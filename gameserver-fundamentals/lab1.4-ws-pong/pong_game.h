#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <mutex>

namespace pong {

enum class PlayerSide {
    Left,
    Right,
    Spectator
};

struct GameSnapshot {
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

class PongGame {
public:
    PongGame();

    void set_player_direction(PlayerSide side, int direction);
    GameSnapshot update(double dt_seconds);
    GameSnapshot snapshot() const;

    static constexpr double WIDTH = 800.0;
    static constexpr double HEIGHT = 480.0;
    static constexpr double PADDLE_WIDTH = 12.0;
    static constexpr double PADDLE_HEIGHT = 96.0;
    static constexpr double BALL_RADIUS = 8.0;

private:
    static constexpr double PADDLE_SPEED = 420.0;
    static constexpr double BALL_SPEED = 380.0;
    static constexpr double PADDLE_X_OFFSET = 32.0;

    void reset_ball(int horizontal_direction);

    mutable std::mutex mutex_;
    int left_input_{0};
    int right_input_{0};

    double left_paddle_y_;
    double right_paddle_y_;
    double ball_x_;
    double ball_y_;
    double ball_vx_;
    double ball_vy_;
    std::uint32_t left_score_;
    std::uint32_t right_score_;
    std::uint64_t tick_counter_;
    int next_direction_;
    GameSnapshot last_snapshot_;
};

inline PongGame::PongGame()
    : left_paddle_y_(HEIGHT / 2.0), right_paddle_y_(HEIGHT / 2.0), ball_x_(WIDTH / 2.0), ball_y_(HEIGHT / 2.0),
      ball_vx_(BALL_SPEED), ball_vy_(0.0), left_score_(0), right_score_(0), tick_counter_(0), next_direction_(-1) {
    last_snapshot_ = snapshot();
}

inline void PongGame::set_player_direction(PlayerSide side, int direction) {
    const int clamped = std::clamp(direction, -1, 1);
    std::lock_guard<std::mutex> lock(mutex_);
    if (side == PlayerSide::Left) {
        left_input_ = clamped;
    } else if (side == PlayerSide::Right) {
        right_input_ = clamped;
    }
}

inline GameSnapshot PongGame::update(double dt_seconds) {
    std::lock_guard<std::mutex> lock(mutex_);
    const double half_paddle = PADDLE_HEIGHT / 2.0;

    left_paddle_y_ += static_cast<double>(left_input_) * PADDLE_SPEED * dt_seconds;
    right_paddle_y_ += static_cast<double>(right_input_) * PADDLE_SPEED * dt_seconds;
    left_paddle_y_ = std::clamp(left_paddle_y_, half_paddle, HEIGHT - half_paddle);
    right_paddle_y_ = std::clamp(right_paddle_y_, half_paddle, HEIGHT - half_paddle);

    ball_x_ += ball_vx_ * dt_seconds;
    ball_y_ += ball_vy_ * dt_seconds;

    if (ball_y_ <= BALL_RADIUS) {
        ball_y_ = BALL_RADIUS;
        ball_vy_ = std::abs(ball_vy_);
    } else if (ball_y_ >= HEIGHT - BALL_RADIUS) {
        ball_y_ = HEIGHT - BALL_RADIUS;
        ball_vy_ = -std::abs(ball_vy_);
    }

    const double left_paddle_x = PADDLE_X_OFFSET + PADDLE_WIDTH / 2.0;
    const double right_paddle_x = WIDTH - PADDLE_X_OFFSET - PADDLE_WIDTH / 2.0;

    // Left paddle collision
    if (ball_vx_ < 0.0 && ball_x_ - BALL_RADIUS <= left_paddle_x) {
        if (std::abs(ball_y_ - left_paddle_y_) <= half_paddle + BALL_RADIUS) {
            ball_x_ = left_paddle_x + BALL_RADIUS;
            const double relative = std::clamp((ball_y_ - left_paddle_y_) / half_paddle, -1.0, 1.0);
            const double speed = BALL_SPEED;
            ball_vy_ = relative * speed * 0.75;
            const double vy_sq = ball_vy_ * ball_vy_;
            ball_vx_ = std::sqrt(std::max(speed * speed - vy_sq, 0.0));
        }
    }

    // Right paddle collision
    if (ball_vx_ > 0.0 && ball_x_ + BALL_RADIUS >= right_paddle_x) {
        if (std::abs(ball_y_ - right_paddle_y_) <= half_paddle + BALL_RADIUS) {
            ball_x_ = right_paddle_x - BALL_RADIUS;
            const double relative = std::clamp((ball_y_ - right_paddle_y_) / half_paddle, -1.0, 1.0);
            const double speed = BALL_SPEED;
            ball_vy_ = relative * speed * 0.75;
            const double vy_sq = ball_vy_ * ball_vy_;
            ball_vx_ = -std::sqrt(std::max(speed * speed - vy_sq, 0.0));
        }
    }

    if (ball_x_ < -BALL_RADIUS) {
        ++right_score_;
        reset_ball(1);
    } else if (ball_x_ > WIDTH + BALL_RADIUS) {
        ++left_score_;
        reset_ball(-1);
    }

    ++tick_counter_;
    last_snapshot_.ball_x = ball_x_;
    last_snapshot_.ball_y = ball_y_;
    last_snapshot_.ball_vx = ball_vx_;
    last_snapshot_.ball_vy = ball_vy_;
    last_snapshot_.left_paddle_y = left_paddle_y_;
    last_snapshot_.right_paddle_y = right_paddle_y_;
    last_snapshot_.left_score = left_score_;
    last_snapshot_.right_score = right_score_;
    last_snapshot_.tick = tick_counter_;
    last_snapshot_.left_direction = left_input_;
    last_snapshot_.right_direction = right_input_;
    return last_snapshot_;
}

inline GameSnapshot PongGame::snapshot() const {
    std::lock_guard<std::mutex> lock(mutex_);
    GameSnapshot snapshot{};
    snapshot.ball_x = ball_x_;
    snapshot.ball_y = ball_y_;
    snapshot.ball_vx = ball_vx_;
    snapshot.ball_vy = ball_vy_;
    snapshot.left_paddle_y = left_paddle_y_;
    snapshot.right_paddle_y = right_paddle_y_;
    snapshot.left_score = left_score_;
    snapshot.right_score = right_score_;
    snapshot.tick = tick_counter_;
    snapshot.left_direction = left_input_;
    snapshot.right_direction = right_input_;
    return snapshot;
}

inline void PongGame::reset_ball(int horizontal_direction) {
    ball_x_ = WIDTH / 2.0;
    ball_y_ = HEIGHT / 2.0;
    const double direction = static_cast<double>(horizontal_direction);
    ball_vx_ = std::clamp(direction, -1.0, 1.0) * BALL_SPEED;
    if (ball_vx_ == 0.0) {
        ball_vx_ = BALL_SPEED * static_cast<double>(next_direction_);
    }
    ball_vy_ = 0.0;
    next_direction_ = -static_cast<int>(std::copysign(1.0, ball_vx_));
}

} // namespace pong

