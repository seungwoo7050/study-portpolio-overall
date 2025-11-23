#include "world.h"

#include "physics.h"

#include <algorithm>

namespace core {

World::World() {
  state_.ball_x = config_.width / 2.0;
  state_.ball_y = config_.height / 2.0;
  state_.ball_vx = config_.ball_speed;
  state_.ball_vy = 0.0;
  state_.left_paddle_y = config_.height / 2.0;
  state_.right_paddle_y = config_.height / 2.0;
}

void World::set_player_input(PlayerSide side, int direction) {
  std::lock_guard<std::mutex> lock(mutex_);
  apply_player_input_locked(side, direction);
}

WorldState World::step(double dt_seconds) {
  std::lock_guard<std::mutex> lock(mutex_);
  physics::advance(state_, config_, dt_seconds);
  ++state_.tick;
  return state_;
}

WorldState World::snapshot() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return state_;
}

void World::apply_player_input_locked(PlayerSide side, int direction) {
  const int clamped = std::clamp(direction, -1, 1);
  if (side == PlayerSide::Left) {
    state_.left_direction = clamped;
  } else if (side == PlayerSide::Right) {
    state_.right_direction = clamped;
  }
}

} // namespace core
