#pragma once

#include <string>
#include <vector>
#include <memory>
#include <optional>
#include <cstdint>

namespace mini {

struct MatchRequest {
    std::string player_id;
    int mmr;  // Matchmaking rating
    std::int64_t timestamp;
};

struct RoomAssignment {
    std::string room_id;
    std::string addr;  // e.g., "127.0.0.1:7777"
    std::string player_id;
    std::string opponent_id;
};

/**
 * Matchmaker manages the match queue and assigns players to rooms.
 *
 * Uses Redis ZSET for queue (score = MMR, member = player_id).
 * Matches players with similar MMR.
 */
class Matchmaker {
public:
    explicit Matchmaker(const std::string& redis_host = "127.0.0.1",
                       int redis_port = 6379);
    ~Matchmaker();

    // Disable copy, allow move
    Matchmaker(const Matchmaker&) = delete;
    Matchmaker& operator=(const Matchmaker&) = delete;
    Matchmaker(Matchmaker&&) noexcept;
    Matchmaker& operator=(Matchmaker&&) noexcept;

    /**
     * Add a player to the match queue
     * @param player_id Unique player identifier
     * @param mmr Player's matchmaking rating
     * @return true if successfully queued
     */
    bool enqueue(const std::string& player_id, int mmr);

    /**
     * Remove a player from the queue (e.g., if they disconnect)
     * @param player_id Player to remove
     * @return true if player was in queue
     */
    bool dequeue(const std::string& player_id);

    /**
     * Attempt to match players from the queue
     * Creates room assignments for matched pairs
     * @return List of room assignments (pairs of players)
     */
    std::vector<RoomAssignment> process_queue();

    /**
     * Get current queue size
     */
    std::size_t queue_size() const;

    /**
     * Store player's room assignment in Redis
     * @param player_id Player identifier
     * @param room_id Room identifier
     * @param addr Room server address
     * @param ttl_seconds Time-to-live (default: 300 = 5 minutes)
     */
    bool store_room_assignment(const std::string& player_id,
                              const std::string& room_id,
                              const std::string& addr,
                              int ttl_seconds = 300);

    /**
     * Retrieve player's room assignment
     * @param player_id Player identifier
     * @return Room assignment if exists
     */
    std::optional<RoomAssignment> get_room_assignment(const std::string& player_id) const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;

    // MMR tolerance for matching (players within this range can be matched)
    static constexpr int MMR_TOLERANCE = 200;
};

} // namespace mini
