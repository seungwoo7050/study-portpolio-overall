#include "room_manager.h"
#include <hiredis/hiredis.h>
#include <iostream>
#include <chrono>
#include <sstream>

namespace mini {

class RoomManager::Impl {
public:
    redisContext* ctx = nullptr;
    std::string redis_host;
    int redis_port;

    explicit Impl(const std::string& host, int port)
        : redis_host(host), redis_port(port) {
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
};

RoomManager::RoomManager(const std::string& redis_host, int redis_port)
    : impl_(std::make_unique<Impl>(redis_host, redis_port)) {
}

RoomManager::~RoomManager() = default;

RoomManager::RoomManager(RoomManager&&) noexcept = default;
RoomManager& RoomManager::operator=(RoomManager&&) noexcept = default;

bool RoomManager::register_room(const std::string& room_id,
                                const std::string& addr,
                                int max_players,
                                int ttl_seconds) {
    try {
        impl_->ensure_connected();

        // Store room info as hash: room:{id} with fields
        std::string key = "room:" + room_id;

        // Use HMSET to set multiple fields
        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "HMSET %s addr %s max_players %d player_count %d is_active %d",
                        key.c_str(), addr.c_str(), max_players, 0, 1)
        );

        if (!reply || reply->type == REDIS_REPLY_ERROR) {
            if (reply) freeReplyObject(reply);
            return false;
        }
        freeReplyObject(reply);

        // Set TTL for heartbeat
        reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "EXPIRE %s %d", key.c_str(), ttl_seconds)
        );

        if (!reply) {
            return false;
        }

        bool success = (reply->type != REDIS_REPLY_ERROR);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        std::cerr << "RoomManager::register_room exception: " << e.what() << std::endl;
        return false;
    }
}

bool RoomManager::update_room_players(const std::string& room_id, int player_count) {
    try {
        impl_->ensure_connected();

        std::string key = "room:" + room_id;

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "HSET %s player_count %d", key.c_str(), player_count)
        );

        if (!reply) {
            return false;
        }

        bool success = (reply->type != REDIS_REPLY_ERROR);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        std::cerr << "RoomManager::update_room_players exception: " << e.what() << std::endl;
        return false;
    }
}

std::optional<RoomInfo> RoomManager::get_available_room() const {
    try {
        impl_->ensure_connected();

        // Simple implementation: scan for rooms and find one with capacity
        // In production, would use a more efficient index

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "KEYS room:*")
        );

        if (!reply || reply->type != REDIS_REPLY_ARRAY) {
            if (reply) freeReplyObject(reply);
            return std::nullopt;
        }

        // Find room with capacity
        for (size_t i = 0; i < reply->elements; ++i) {
            std::string key = reply->element[i]->str;

            // Skip checkpoint keys
            if (key.find(":checkpoint") != std::string::npos) {
                continue;
            }

            auto room_info = get_room(key.substr(5)); // Remove "room:" prefix
            if (room_info && room_info->is_active &&
                room_info->player_count < room_info->max_players) {
                freeReplyObject(reply);
                return room_info;
            }
        }

        freeReplyObject(reply);
        return std::nullopt;

    } catch (const std::exception& e) {
        return std::nullopt;
    }
}

std::optional<RoomInfo> RoomManager::get_room(const std::string& room_id) const {
    try {
        impl_->ensure_connected();

        std::string key = "room:" + room_id;

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "HGETALL %s", key.c_str())
        );

        if (!reply || reply->type != REDIS_REPLY_ARRAY || reply->elements == 0) {
            if (reply) freeReplyObject(reply);
            return std::nullopt;
        }

        // Parse hash: [field1, value1, field2, value2, ...]
        RoomInfo info;
        info.room_id = room_id;

        for (size_t i = 0; i + 1 < reply->elements; i += 2) {
            std::string field = reply->element[i]->str;
            std::string value = reply->element[i + 1]->str;

            if (field == "addr") {
                info.addr = value;
            } else if (field == "max_players") {
                info.max_players = std::stoi(value);
            } else if (field == "player_count") {
                info.player_count = std::stoi(value);
            } else if (field == "is_active") {
                info.is_active = (std::stoi(value) != 0);
            }
        }

        freeReplyObject(reply);
        return info;

    } catch (const std::exception& e) {
        return std::nullopt;
    }
}

bool RoomManager::create_session(const std::string& player_id,
                                 const std::string& token,
                                 int ttl_seconds) {
    try {
        impl_->ensure_connected();

        // Store session:{token} with player_id and expires timestamp
        std::string key = "session:" + token;
        auto expires = std::chrono::system_clock::now() +
                      std::chrono::seconds(ttl_seconds);
        auto expires_ts = std::chrono::duration_cast<std::chrono::seconds>(
            expires.time_since_epoch()).count();

        std::ostringstream value;
        value << player_id << ":" << expires_ts;

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "SETEX %s %d %s",
                        key.c_str(), ttl_seconds, value.str().c_str())
        );

        if (!reply) {
            return false;
        }

        bool success = (reply->type != REDIS_REPLY_ERROR);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        std::cerr << "RoomManager::create_session exception: " << e.what() << std::endl;
        return false;
    }
}

std::optional<SessionInfo> RoomManager::get_session(const std::string& token) const {
    try {
        impl_->ensure_connected();

        std::string key = "session:" + token;

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "GET %s", key.c_str())
        );

        if (!reply || reply->type != REDIS_REPLY_STRING) {
            if (reply) freeReplyObject(reply);
            return std::nullopt;
        }

        // Parse "player_id:expires"
        std::string value = reply->str;
        freeReplyObject(reply);

        auto colon_pos = value.find(':');
        if (colon_pos == std::string::npos) {
            return std::nullopt;
        }

        SessionInfo info;
        info.player_id = value.substr(0, colon_pos);
        info.token = token;
        info.expires = std::stoll(value.substr(colon_pos + 1));

        // Check if expired
        auto now = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();

        if (now > info.expires) {
            return std::nullopt;
        }

        return info;

    } catch (const std::exception& e) {
        return std::nullopt;
    }
}

bool RoomManager::delete_session(const std::string& token) {
    try {
        impl_->ensure_connected();

        std::string key = "session:" + token;

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "DEL %s", key.c_str())
        );

        if (!reply) {
            return false;
        }

        bool success = (reply->integer > 0);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        return false;
    }
}

bool RoomManager::store_checkpoint(const std::string& room_id,
                                   const std::vector<std::uint8_t>& snapshot,
                                   int ttl_seconds) {
    try {
        impl_->ensure_connected();

        std::string key = "room:" + room_id + ":checkpoint";

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "SETEX %s %d %b",
                        key.c_str(), ttl_seconds,
                        snapshot.data(), snapshot.size())
        );

        if (!reply) {
            return false;
        }

        bool success = (reply->type != REDIS_REPLY_ERROR);
        freeReplyObject(reply);
        return success;

    } catch (const std::exception& e) {
        std::cerr << "RoomManager::store_checkpoint exception: " << e.what() << std::endl;
        return false;
    }
}

std::optional<std::vector<std::uint8_t>> RoomManager::get_checkpoint(const std::string& room_id) const {
    try {
        impl_->ensure_connected();

        std::string key = "room:" + room_id + ":checkpoint";

        redisReply* reply = static_cast<redisReply*>(
            redisCommand(impl_->ctx, "GET %s", key.c_str())
        );

        if (!reply || reply->type != REDIS_REPLY_STRING) {
            if (reply) freeReplyObject(reply);
            return std::nullopt;
        }

        std::vector<std::uint8_t> snapshot(
            reinterpret_cast<const std::uint8_t*>(reply->str),
            reinterpret_cast<const std::uint8_t*>(reply->str) + reply->len
        );

        freeReplyObject(reply);
        return snapshot;

    } catch (const std::exception& e) {
        return std::nullopt;
    }
}

} // namespace mini
