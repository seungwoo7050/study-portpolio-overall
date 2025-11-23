#pragma once

#include <atomic>
#include <chrono>
#include <cstdint>
#include <functional>
#include <mutex>
#include <thread>

namespace core {

class GameLoop {
public:
  using TickHandler =
      std::function<void(std::uint64_t tick, double dt_seconds)>;

  explicit GameLoop(double target_tps);
  ~GameLoop();

  void start(TickHandler handler);
  void stop();

private:
  void run();

  double target_tps_;
  std::chrono::nanoseconds tick_duration_;
  std::atomic<bool> running_;
  std::thread thread_;
  TickHandler handler_;
  std::mutex handler_mutex_;
};

} // namespace core
