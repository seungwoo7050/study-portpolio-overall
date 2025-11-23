#pragma once

#include "player.h"

#include <cstdint>
#include <mutex>

namespace core {

struct WorldConfig {
  double width{800.0};
  double height{480.0};
  double paddle_width{12.0};
  double paddle_height{96.0};
  double ball_radius{8.0};
  double paddle_speed{420.0};
  double ball_speed{380.0};
  double paddle_x_offset{32.0};
};

struct WorldState {
  double ball_x{0.0};
  double ball_y{0.0};
  double ball_vx{0.0};
  double ball_vy{0.0};
  double left_paddle_y{0.0};
  double right_paddle_y{0.0};
  std::uint32_t left_score{0};
  std::uint32_t right_score{0};
  std::uint64_t tick{0};
  int left_direction{0};
  int right_direction{0};
};

class World {
public:
  World();

  void set_player_input(PlayerSide side, int direction);
  WorldState step(double dt_seconds);
  WorldState snapshot() const;

  const WorldConfig &config() const { return config_; }

private:
  void apply_player_input_locked(PlayerSide side, int direction);

  WorldConfig config_{};
  mutable std::mutex mutex_;
  WorldState state_{};
};

} // namespace core
