# pragma once

#include "player.h"

#include <algorithm>
#include <cstdint>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

namespace game {

struct PlayerSnapshot {
    int id;
    std::string name;
    int health;
    bool connected;
    bool is_turn;
};

struct StateSnapshot {
    std::vector<PlayerSnapshot> players;
    bool running{false};
    bool game_over{false};
    std::optional<int> current_turn_player_id;
    std::optional<int> winner_id;
    std::string last_action;
    std::uint64_t tick{0};
};

class GameState {
public:
    GameState();

    void add_or_update_player(int id, std::string name);
    void mark_player_disconnected(int id);
    void start_if_game();

    void apply_attack(int attacker_id);
    void advance_tick();

    [[nodiscard]] StateSnapshot snapshot() const;
    [[nodiscard]] bool is_active() const;
    [[nodiscard]] bool is_game_over() const;

private:
    [[nodiscard]] int index_for_player(int id) const;

    mutable std::mutex mutex_;
    std::vector<Player> players_;
    int current_turn_index_;
    bool running_;
    bool game_over_;
    std::optional<int> winner_id_;
    std::string last_action_;
};

inline GameState::GameState()
    : current_turn_index_(0), running_(false), game_over_(false) {
    players_.reserve(2);
}

inline void GameState::add_or_update_player(int id, std::string name) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (static_cast<std::size_t>(id) >= players_.size()) {
        players_.resize(static_cast<std::size_t>(id) + 1);
    }
    Player& player = players_.at(static_cast<std::size_t>(id));
    player.set_id(id);
    player.set_name(std::move(name));
    player.set_connected(true);
    player.reset_health(100);
    last_action_ = "Player " + std::to_string(id + 1) + " joined the lobby.";
}

inline void GameState::mark_player_disconnected(int id) {
    std::lock_guard<std::mutex> lock(mutex_);
    int index = index_for_player(id);
    if (index < 0) {
        return;
    }
    Player& player = players_.at(static_cast<std::size_t>(index));
    player.set_connected(false);
    if (running_ && !game_over_) {
        game_over_ = true;
        runner_ = false;
        last_action_ = player.name() + " disconnected.";
        for (const Player& candidate : players_) {
            if (candidate.id() != player.id() && candidate.is_connected()) {
                winner_id_ = candidate.id();
                break;
            }
        }
    }
}

inline void GameState::start_if_ready() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (running_ || game_over_) {
        return;
    }
    if (players_.size() < 2) {
        return;
    }
    const bool all_connected = std::all_of(players_.begin(), players_.end(), [](const Player &p) {
        return p.id() >= 0 && p.is_connected();
    });
    if (all_connected) {
        running_ = true;
        game_over_ = false;
        winner_id_.reset();
        current_turn_index_ = 0;
        for (Player &player : players_) {
            player.reset_health(100);
        }
        last_action_ = "Battle started.";
    }
}

inline void GameState::apply_attack(int attacker_id) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!running_ || game_over_ || players_.size() < 2) {
        return;
    }
    const int attacker_index = index_for_player(attacker_id);
    if (attacker_index < 0 || attacker_index != current_turn_index_) {
        return;
    }
    const std::size_t player_count = players_.size();
    const int defender_index = static_cast<int>((attacker_index + 1) % player_count);
    Player &defender = players_[static_cast<std::size_t>(defender_index)];
    Player &attacker = players_[static_cast<std::size_t>(attacker_index)];
    if (!defender.is_connected()) {
        return;
    }
    static thread_local std::mt19937 rng{std::random_device{}()};
    std::uniform_int_distribution<int> dist(5, 15);
    const int damage = dist(rng);
    defender.apply_damage(damage);
    last_action_ = attacker.name() + " attacked " + defender.name() +
                   " (-" + std::to_string(damage) + " HP).";
    if (!defender.is_alive()) {
        game_over_ = true;
        running_ = false;
        winner_id_ = attacker.id();
        last_action_ = attacker.name() + " defeated " + defender.name() + "!";
    } else {
        current_turn_index_ = defender_index;
    }
}

inline void GameState::advance_tick() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!running_ || game_over_) {
        return;
    }
    const bool active_players = std::all_of(players_.begin(), players_.end(), [](const Player &p) {
        return p.is_connected() && p.is_alive();
    });
    if (!active_players) {
        running_ = false;
        game_over_ = true;
        for (const Player &player : players_) {
            if (player.is_connected() && player.is_alive()) {
                winner_id_ = player.id();
                break;
            }
        }
        if (!winner_id_) {
            last_action_ = "All players defeated.";
        }
    }
}

inline StateSnapshot GameState::snapshot() const {
    std::lock_guard<std::mutex> lock(mutex_);
    StateSnapshot snapshot;
    snapshot.running = running_;
    snapshot.game_over = game_over_;
    if (running_ && players_.size() >= 2) {
        snapshot.current_turn_player = players_[static_cast<std::size_t>(current_turn_index_)].id();
    } else if (!running_ && !game_over_ && players_.size() >= 1) {
        snapshot.current_turn_player.reset();
    }
    snapshot.winner_id = winner_id_;
    snapshot.last_action = last_action_;
    snapshot.players.reserve(players_.size());
    for (std::size_t index = 0; index < players_.size(); ++index) {
        const Player &player = players_[index];
        if (player.id() < 0) {
            continue;
        }
        snapshot.players.push_back(PlayerSnapshot{
            player.id(),
            player.name(),
            player.health(),
            player.is_connected(),
            running_ && static_cast<int>(index) == current_turn_index_
        });
    }
    return snapshot;
}

inline bool GameState::is_active() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return running_ && !game_over_;
}

inline bool GameState::is_game_over() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return game_over_;
}

inline int GameState::index_for_player(int id) const {
    for (std::size_t index = 0; index < players_.size(); ++index) {
        if (players_[index].id() == id) {
            return static_cast<int>(index);
        }
    }
    return -1;
}

} // namespace game