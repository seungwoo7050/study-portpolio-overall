#include "game_loop.h"

#include <condition_variable>

namespace core {

namespace {
constexpr double kMinTps = 1.0;
}

GameLoop::GameLoop(double target_tps)
    : target_tps_(target_tps < kMinTps ? kMinTps : target_tps),
      tick_duration_(std::chrono::duration_cast<std::chrono::nanoseconds>(
          std::chrono::duration<double>(1.0 / target_tps_))),
      running_(false) {}

GameLoop::~GameLoop() { stop(); }

void GameLoop::start(TickHandler handler) {
  {
    std::lock_guard<std::mutex> lock(handler_mutex_);
    handler_ = std::move(handler);
  }
  bool expected = false;
  if (!running_.compare_exchange_strong(expected, true)) {
    return;
  }
  thread_ = std::thread([this] { run(); });
}

void GameLoop::stop() {
  bool expected = true;
  if (running_.compare_exchange_strong(expected, false)) {
    if (thread_.joinable()) {
      thread_.join();
    }
  } else {
    running_.store(false);
    if (thread_.joinable()) {
      thread_.join();
    }
  }
}

void GameLoop::run() {
  using Clock = std::chrono::steady_clock;
  auto next_tick = Clock::now();
  auto last_tick = next_tick;
  std::uint64_t tick_counter = 0;

  while (running_.load()) {
    auto now = Clock::now();
    if (now < next_tick) {
      std::this_thread::sleep_until(next_tick);
      continue;
    }

    double dt_seconds = std::chrono::duration<double>(now - last_tick).count();
    if (dt_seconds <= 0.0) {
      dt_seconds = 1.0 / target_tps_;
    }

    TickHandler handler_copy;
    {
      std::lock_guard<std::mutex> lock(handler_mutex_);
      handler_copy = handler_;
    }

    if (handler_copy) {
      handler_copy(tick_counter, dt_seconds);
    }

    last_tick = now;
    next_tick += tick_duration_;
    if (now - next_tick > tick_duration_) {
      next_tick = now + tick_duration_;
    }
    ++tick_counter;
  }
}

} // namespace core
