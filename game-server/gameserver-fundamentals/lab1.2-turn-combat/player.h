#pragma once

#include <algorithm>
#include <string>

namespace game {

class Player {
public:
    Player();
    Player(int id, std::string name);

    int id() const noexcept { return id_;}
    const std::string& name() const noexcept { return name_; }
    int health() const noexcept { return health_;}
    bool is_alive() const noexcept { return health_ > 0; }
    bool is_connected() const noexcept { return connected_; }

    void set_id(int id) noexcept { id_ = id; }
    void set_name(const std::string& name) { name_ = name; }
    void set_connected(bool connected) noexcept {connected_ = connected; }
    void reset_health(int health) noexcept { health_ = health; }
    void apply_damage(int amount) noexcept {
        health_ = std::max(0, health_ - amount);
    }

private:
    int id_;
    std::string name_;
    int health_;
    bool connected_;
};

inline Player::Player(): id_(-1), health_(100), connected_(false) {}

inline Player::Player(int id, std::string name)
    : id_(id), name_(std::move(name)), health_(100), connected_(true) {}

enum class CommandType { Attack };

struct Command {
    int player_id;
    CommandType type;
};

}  // namespace game
