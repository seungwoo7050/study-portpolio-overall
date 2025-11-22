#pragma once

#include <string>
#include <vector>
#include <memory>
#include <optional>
#include <cstdint>

namespace mini {

struct RoomInfo {
    std::string room_id;
    std::string addr;  // "host:port"
    int player_count;
    int max_players;
    bool is_active;
};

struct SessionInfo {
    std::string player_id;
    std::string token;
    std::int64_t expires;
};

/**
 * RoomManager handles room server registration and player session management.
 *
 * Uses Redis to:
 * - Track available room servers
 * - Store player sessions with tokens
 * - Store room checkpoints for reconnection
 */
class RoomManager {
public:
    explicit RoomManager(const std::string& redis_host = "127.0.0.1",
                        int redis_port = 6379);
    ~RoomManager();

    // Disable copy, allow move
    RoomManager(const RoomManager&) = delete;
    RoomManager& operator=(const RoomManager&) = delete;
    RoomManager(RoomManager&&) noexcept;
    RoomManager& operator=(RoomManager&&) noexcept;

    /**
     * Register a room server
     * @param room_id Unique room identifier
     * @param addr Server address (host:port)
     * @param max_players Maximum players per room
     * @param ttl_seconds Heartbeat TTL (default: 60s)
     */
    bool register_room(const std::string& room_id,
                      const std::string& addr,
                      int max_players = 2,
                      int ttl_seconds = 60);

    /**
     * Update room player count
     */
    bool update_room_players(const std::string& room_id, int player_count);

    /**
     * Get available room (least loaded)
     * @return Room info or nullopt if none available
     */
    std::optional<RoomInfo> get_available_room() const;

    /**
     * Get specific room info
     */
    std::optional<RoomInfo> get_room(const std::string& room_id) const;

    /**
     * Store player session
     * @param player_id Player identifier
     * @param token Session token
     * @param ttl_seconds Session lifetime (default: 86400 = 24h)
     */
    bool create_session(const std::string& player_id,
                       const std::string& token,
                       int ttl_seconds = 86400);

    /**
     * Validate and retrieve session
     * @param token Session token
     * @return Session info if valid
     */
    std::optional<SessionInfo> get_session(const std::string& token) const;

    /**
     * Remove session (logout)
     */
    bool delete_session(const std::string& token);

    /**
     * Store room checkpoint (game state snapshot)
     * @param room_id Room identifier
     * @param snapshot Binary snapshot data
     * @param ttl_seconds Checkpoint lifetime (default: 30s)
     */
    bool store_checkpoint(const std::string& room_id,
                         const std::vector<std::uint8_t>& snapshot,
                         int ttl_seconds = 30);

    /**
     * Retrieve room checkpoint for reconnection
     */
    std::optional<std::vector<std::uint8_t>> get_checkpoint(const std::string& room_id) const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace mini
