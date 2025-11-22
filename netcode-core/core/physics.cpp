#include "physics.h"

#include <algorithm>
#include <cmath>

namespace core::physics {

namespace {
[[nodiscard]] bool is_paddle_collision(double ball_y, double paddle_y,
                                       double half_paddle, double ball_radius) {
  return std::abs(ball_y - paddle_y) <= (half_paddle + ball_radius);
}

[[nodiscard]] double clamp_direction(int direction) {
  if (direction > 0) {
    return 1.0;
  }
  if (direction < 0) {
    return -1.0;
  }
  return 0.0;
}
} // namespace

void advance(WorldState &state, const WorldConfig &config, double dt_seconds) {
  const double half_paddle = config.paddle_height / 2.0;

  state.left_paddle_y +=
      clamp_direction(state.left_direction) * config.paddle_speed * dt_seconds;
  state.right_paddle_y +=
      clamp_direction(state.right_direction) * config.paddle_speed * dt_seconds;

  state.left_paddle_y =
      std::clamp(state.left_paddle_y, half_paddle, config.height - half_paddle);
  state.right_paddle_y = std::clamp(state.right_paddle_y, half_paddle,
                                    config.height - half_paddle);

  state.ball_x += state.ball_vx * dt_seconds;
  state.ball_y += state.ball_vy * dt_seconds;

  if (state.ball_y <= config.ball_radius) {
    state.ball_y = config.ball_radius;
    state.ball_vy = std::abs(state.ball_vy);
  } else if (state.ball_y >= config.height - config.ball_radius) {
    state.ball_y = config.height - config.ball_radius;
    state.ball_vy = -std::abs(state.ball_vy);
  }

  const double left_paddle_x =
      config.paddle_x_offset + config.paddle_width / 2.0;
  const double right_paddle_x =
      config.width - config.paddle_x_offset - config.paddle_width / 2.0;

  if (state.ball_vx < 0.0 &&
      state.ball_x - config.ball_radius <= left_paddle_x) {
    if (is_paddle_collision(state.ball_y, state.left_paddle_y, half_paddle,
                            config.ball_radius)) {
      state.ball_x = left_paddle_x + config.ball_radius;
      const double relative = std::clamp(
          (state.ball_y - state.left_paddle_y) / half_paddle, -1.0, 1.0);
      state.ball_vy = relative * config.ball_speed * 0.75;
      const double vy_sq = state.ball_vy * state.ball_vy;
      state.ball_vx = std::sqrt(
          std::max(config.ball_speed * config.ball_speed - vy_sq, 0.0));
    }
  }

  if (state.ball_vx > 0.0 &&
      state.ball_x + config.ball_radius >= right_paddle_x) {
    if (is_paddle_collision(state.ball_y, state.right_paddle_y, half_paddle,
                            config.ball_radius)) {
      state.ball_x = right_paddle_x - config.ball_radius;
      const double relative = std::clamp(
          (state.ball_y - state.right_paddle_y) / half_paddle, -1.0, 1.0);
      state.ball_vy = relative * config.ball_speed * 0.75;
      const double vy_sq = state.ball_vy * state.ball_vy;
      state.ball_vx = -std::sqrt(
          std::max(config.ball_speed * config.ball_speed - vy_sq, 0.0));
    }
  }

  if (state.ball_x < -config.ball_radius) {
    ++state.right_score;
    state.ball_x = config.width / 2.0;
    state.ball_y = config.height / 2.0;
    state.ball_vx = config.ball_speed;
    state.ball_vy = 0.0;
  } else if (state.ball_x > config.width + config.ball_radius) {
    ++state.left_score;
    state.ball_x = config.width / 2.0;
    state.ball_y = config.height / 2.0;
    state.ball_vx = -config.ball_speed;
    state.ball_vy = 0.0;
  }
}

} // namespace core::physics
