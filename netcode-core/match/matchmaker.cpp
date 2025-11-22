#include "matchmaker.h"
#include <hiredis/hiredis.h>
#include <iostream>
#include <sstream>
#include <random>
#include <chrono>

namespace mini {

// PIMPL implementation to hide Redis details
class Matchmaker::Impl {
public:
    redisContext* ctx = nullptr;
    std::string redis_host;
    int redis_port;
    std::mt19937 rng;

    explicit Impl(const std::string& host, int port)
        : redis_host(host), redis_port(port),
          rng(std::random_device{}()) {
        connect();
    }

    ~Impl() {
        disconnect();
    }

    void connect() {
        if (ctx) {
            redisFree(ctx);
        }

        struct timeval timeout = { 1, 500000 }; // 1.5 seconds
        ctx = redisConnectWithTimeout(redis_host.c_str(), redis_port, timeout);

        if (!ctx || ctx->err) {
            if (ctx) {
                std::cerr << "Redis connection error: " << ctx->errstr << std::endl;
                redisFree(ctx);
                ctx = nullptr;
            } else {
                std::cerr << "Redis connection error: can't allocate context" << std::endl;
            }
            throw std::runtime_error("Failed to connect to Redis");
        }
    }

    void disconnect() {
        if (ctx) {
            redisFree(ctx);
            ctx = nullptr;
        }
    }

    void ensure_connected() {
        if (!ctx || ctx->err) {
            connect();
        }
    }

    std::string generate_room_id() {
        std::uniform_int_distribution<int> dist(100000, 999999);
        return "room_" + std::to_string(dist(rng));
    }
};

Matchmaker::Matchmaker(const std::string& redis_host, int redis_port)
    : impl_(std::make_unique<Impl>(redis_host, redis_port)) {
}

Matchmaker::~Matchmaker() = default;

Matchmaker::Matchmaker(Matchmaker&&) noexcept = default;
Matchmaker& Matchmaker::operator=(Matchmaker&&) noexcept = default;

bool Matchmaker::enqueue(const std::string& player_id, int mmr) {
    try {
        impl_->ensure_connected();

        // ZADD match:queue <mmr> <player_id>
        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "ZADD match:queue %d %s", mmr, player_id.c_str())
        );

        if (!reply) {
            std::cerr << "Redis ZADD failed: " << impl_->ctx->errstr << std::endl;
            return false;
        }

        bool success = (reply->type != REDIS_REPLY_ERROR);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        std::cerr << "Matchmaker::enqueue exception: " << e.what() << std::endl;
        return false;
    }
}

bool Matchmaker::dequeue(const std::string& player_id) {
    try {
        impl_->ensure_connected();

        // ZREM match:queue <player_id>
        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "ZREM match:queue %s", player_id.c_str())
        );

        if (!reply) {
            return false;
        }

        bool success = (reply->integer > 0);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        std::cerr << "Matchmaker::dequeue exception: " << e.what() << std::endl;
        return false;
    }
}

std::vector<RoomAssignment> Matchmaker::process_queue() {
    std::vector<RoomAssignment> assignments;

    try {
        impl_->ensure_connected();

        // Get all players in queue with scores (ZRANGE with WITHSCORES)
        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "ZRANGE match:queue 0 -1 WITHSCORES")
        );

        if (!reply || reply->type != REDIS_REPLY_ARRAY) {
            if (reply) freeReplyObject(reply);
            return assignments;
        }

        // Parse results: [player1, score1, player2, score2, ...]
        std::vector<MatchRequest> requests;
        for (size_t i = 0; i + 1 < reply->elements; i += 2) {
            MatchRequest req;
            req.player_id = reply->element[i]->str;
            req.mmr = std::stoi(reply->element[i + 1]->str);
            req.timestamp = std::chrono::system_clock::now().time_since_epoch().count();
            requests.push_back(req);
        }

        freeReplyObject(reply);

        // Simple matching: pair adjacent players with similar MMR
        for (size_t i = 0; i + 1 < requests.size(); i += 2) {
            const auto& p1 = requests[i];
            const auto& p2 = requests[i + 1];

            // Check if MMR is within tolerance
            if (std::abs(p1.mmr - p2.mmr) <= MMR_TOLERANCE) {
                RoomAssignment assignment;
                assignment.room_id = impl_->generate_room_id();
                assignment.addr = "127.0.0.1:7777";  // Default room server
                assignment.player_id = p1.player_id;
                assignment.opponent_id = p2.player_id;

                // Store assignments for both players
                store_room_assignment(p1.player_id, assignment.room_id, assignment.addr);
                store_room_assignment(p2.player_id, assignment.room_id, assignment.addr);

                // Remove matched players from queue
                dequeue(p1.player_id);
                dequeue(p2.player_id);

                assignments.push_back(assignment);
            }
        }

    } catch (const std::exception& e) {
        std::cerr << "Matchmaker::process_queue exception: " << e.what() << std::endl;
    }

    return assignments;
}

std::size_t Matchmaker::queue_size() const {
    try {
        impl_->ensure_connected();

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "ZCARD match:queue")
        );

        if (!reply || reply->type != REDIS_REPLY_INTEGER) {
            if (reply) freeReplyObject(reply);
            return 0;
        }

        std::size_t size = reply->integer;
        freeReplyObject(reply);
        return size;

    } catch (const std::exception& e) {
        return 0;
    }
}

bool Matchmaker::store_room_assignment(const std::string& player_id,
                                      const std::string& room_id,
                                      const std::string& addr,
                                      int ttl_seconds) {
    try {
        impl_->ensure_connected();

        // Store as JSON-like string: room_map:{player_id} -> "{room_id}:{addr}"
        std::string key = "room_map:" + player_id;
        std::string value = room_id + ":" + addr;

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "SETEX %s %d %s",
                        key.c_str(), ttl_seconds, value.c_str())
        );

        if (!reply) {
            return false;
        }

        bool success = (reply->type != REDIS_REPLY_ERROR);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        std::cerr << "Matchmaker::store_room_assignment exception: " << e.what() << std::endl;
        return false;
    }
}

std::optional<RoomAssignment> Matchmaker::get_room_assignment(const std::string& player_id) const {
    try {
        impl_->ensure_connected();

        std::string key = "room_map:" + player_id;

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "GET %s", key.c_str())
        );

        if (!reply || reply->type != REDIS_REPLY_STRING) {
            if (reply) freeReplyObject(reply);
            return std::nullopt;
        }

        // Parse "room_id:addr"
        std::string value = reply->str;
        freeReplyObject(reply);

        auto colon_pos = value.find(':');
        if (colon_pos == std::string::npos) {
            return std::nullopt;
        }

        RoomAssignment assignment;
        assignment.room_id = value.substr(0, colon_pos);
        assignment.addr = value.substr(colon_pos + 1);
        assignment.player_id = player_id;

        return assignment;

    } catch (const std::exception& e) {
        return std::nullopt;
    }
}

} // namespace mini
