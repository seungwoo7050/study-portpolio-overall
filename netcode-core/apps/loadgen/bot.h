#pragma once

#include <atomic>
#include <chrono>
#include <cstdint>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/udp.hpp>

namespace apps::loadgen {

class Bot {
public:
  struct Config {
    std::string server_host{"127.0.0.1"};
    std::uint16_t server_port{40000};
    double input_rate{60.0}; // inputs per second
    bool measure_rtt{true};
  };

  struct Stats {
    std::uint64_t packets_sent{0};
    std::uint64_t packets_received{0};
    std::vector<double> rtt_samples_ms;
    std::chrono::steady_clock::time_point start_time;
    std::chrono::steady_clock::time_point last_input_time;
  };

  Bot(boost::asio::io_context &io_context, Config config);
  ~Bot();

  void start();
  void stop();

  Stats get_stats() const;

private:
  void send_input();
  void receive_loop();
  void schedule_next_input();

  boost::asio::io_context &io_context_;
  Config config_;
  std::unique_ptr<boost::asio::ip::udp::socket> socket_;
  std::unique_ptr<boost::asio::ip::udp::endpoint> server_endpoint_;

  std::atomic<bool> running_{false};
  std::atomic<std::uint32_t> client_seq_{0};

  mutable std::mutex stats_mutex_;
  Stats stats_;

  std::map<std::uint32_t, std::chrono::steady_clock::time_point>
      pending_acks_;
};

} // namespace apps::loadgen
