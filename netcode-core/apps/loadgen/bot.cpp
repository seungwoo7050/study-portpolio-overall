#include "bot.h"

#include "mini.pb.h"

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/udp.hpp>
#include <boost/asio/steady_timer.hpp>

#include <iostream>
#include <random>

namespace apps::loadgen {

Bot::Bot(boost::asio::io_context &io_context, Config config)
    : io_context_(io_context), config_(std::move(config)) {

  socket_ = std::make_unique<boost::asio::ip::udp::socket>(
      io_context_, boost::asio::ip::udp::v4());

  // Resolve server endpoint
  boost::asio::ip::udp::resolver resolver(io_context_);
  auto endpoints = resolver.resolve(boost::asio::ip::udp::v4(),
                                     config_.server_host,
                                     std::to_string(config_.server_port));
  server_endpoint_ =
      std::make_unique<boost::asio::ip::udp::endpoint>(*endpoints.begin());
}

Bot::~Bot() { stop(); }

void Bot::start() {
  if (running_.exchange(true)) {
    return; // Already running
  }

  stats_.start_time = std::chrono::steady_clock::now();
  stats_.last_input_time = stats_.start_time;

  schedule_next_input();
}

void Bot::stop() {
  if (!running_.exchange(false)) {
    return; // Not running
  }
}

void Bot::send_input() {
  if (!running_.load()) {
    return;
  }

  // Generate random input
  static std::random_device rd;
  static std::mt19937 gen(rd());
  static std::uniform_int_distribution<> move_dist(-1, 1);
  static std::uniform_int_distribution<> fire_dist(0, 1);

  mini::Input input;
  std::uint32_t seq = client_seq_.fetch_add(1);
  input.set_client_seq(seq);
  input.set_timestamp_ns(
      std::chrono::steady_clock::now().time_since_epoch().count());
  input.set_dx(move_dist(gen));
  input.set_dy(move_dist(gen));
  input.set_fire(fire_dist(gen) == 1);

  // Serialize
  std::vector<std::uint8_t> payload(1 + input.ByteSizeLong());
  payload[0] = 1; // MessageType::Input
  input.SerializeToArray(payload.data() + 1, static_cast<int>(payload.size() - 1));

  // Send
  try {
    socket_->send_to(boost::asio::buffer(payload), *server_endpoint_);

    std::lock_guard<std::mutex> lock(stats_mutex_);
    stats_.packets_sent++;
    stats_.last_input_time = std::chrono::steady_clock::now();

    if (config_.measure_rtt) {
      pending_acks_[seq] = std::chrono::steady_clock::now();
    }
  } catch (const std::exception &) {
    // Ignore send errors
  }

  schedule_next_input();
}

void Bot::receive_loop() {
  // Simplified - in a real implementation, this would run in a separate thread
  // or use async_receive_from
}

void Bot::schedule_next_input() {
  if (!running_.load()) {
    return;
  }

  auto timer = std::make_shared<boost::asio::steady_timer>(io_context_);
  auto interval_ms = static_cast<long>(1000.0 / config_.input_rate);
  timer->expires_after(std::chrono::milliseconds(interval_ms));

  timer->async_wait([this, timer](const boost::system::error_code &ec) {
    if (!ec && running_.load()) {
      send_input();
    }
  });
}

Bot::Stats Bot::get_stats() const {
  std::lock_guard<std::mutex> lock(stats_mutex_);
  return stats_;
}

} // namespace apps::loadgen
