#include "pong_udp_server.h"

#include "core/player.h"
#include "match/room_manager.h"
#include "mini.pb.h"

#include <algorithm>
#include <chrono>
#include <iostream>
#include <stdexcept>
#include <utility>

namespace apps::pong_udp {

namespace {
mini::World::Role to_proto_role(core::PlayerSide side) {
  switch (side) {
  case core::PlayerSide::Left:
    return mini::World::ROLE_LEFT;
  case core::PlayerSide::Right:
    return mini::World::ROLE_RIGHT;
  default:
    return mini::World::ROLE_SPECTATOR;
  }
}
} // namespace

PongUdpServer::PongUdpServer(boost::asio::io_context &io_context,
                             std::unique_ptr<net::ITransport> transport,
                             bool metrics_enabled,
                             const std::string& redis_host,
                             int redis_port,
                             const std::string& room_id)
    : io_context_(io_context), transport_(std::move(transport)), loop_(60.0),
      snapshot_generator_(20, 256), metrics_enabled_(metrics_enabled),
      room_id_(room_id) {
  if (!transport_) {
    throw std::invalid_argument("transport must not be null");
  }

  // M1.8: Initialize RoomManager for session/recovery
  try {
    room_manager_ = std::make_unique<mini::RoomManager>(redis_host, redis_port);
    std::cout << "Connected to Redis at " << redis_host << ":" << redis_port << std::endl;
  } catch (const std::exception& e) {
    std::cerr << "Warning: Failed to connect to Redis: " << e.what() << std::endl;
    std::cerr << "Session recovery will be disabled" << std::endl;
  }

  if (metrics_enabled_) {
    prometheus_exporter_ = std::make_unique<metrics::PrometheusExporter>();
    prometheus_exporter_->start(9091);
    last_metrics_update_ = std::chrono::steady_clock::now();
  }
}

PongUdpServer::~PongUdpServer() { stop(); }

void PongUdpServer::start() {
  if (metrics_enabled_) {
    log_start();
  }
  transport_->set_metrics_enabled(metrics_enabled_);
  transport_->start([this](const net::ITransport::Endpoint &endpoint,
                           std::vector<std::uint8_t> &&payload) {
    handle_datagram(endpoint, std::move(payload));
  });

  // M1.8: Register room with Redis
  if (room_manager_) {
    // Note: In production, would extract actual port from transport
    // For now, using room_id as identifier
    room_manager_->register_room(room_id_, "127.0.0.1:40000", 2, 60);
  }

  loop_.start([this](std::uint64_t /*tick*/, double dt_seconds) {
    record_tick_metrics(dt_seconds);
    const auto state = world_.step(dt_seconds);
    server_tick_.store(static_cast<std::uint32_t>(state.tick),
                       std::memory_order_relaxed);
    broadcast_snapshot(state);

    // M1.8: Store checkpoint periodically for reconnection
    if (room_manager_ && tick_counter_ % CHECKPOINT_INTERVAL_TICKS == 0) {
      auto encoded = snapshot_generator_.encode(state);
      if (!encoded.is_keyframe) {
        // For checkpoints, always use keyframe (full state)
        encoded = snapshot_generator_.encode_keyframe(state);
      }
      room_manager_->store_checkpoint(room_id_, encoded.payload, 30);
    }

    transport_->update();
    ++tick_counter_;
  });
}

void PongUdpServer::stop() {
  loop_.stop();
  transport_->stop();
  if (metrics_enabled_) {
    log_stop();
    if (prometheus_exporter_) {
      prometheus_exporter_->stop();
    }
  }
}

net::ITransport::Counters PongUdpServer::transport_counters() const {
  return transport_->sample_counters();
}

std::vector<double> PongUdpServer::tick_durations_ms() const {
  std::lock_guard<std::mutex> lock(metrics_mutex_);
  return tick_durations_ms_;
}

std::vector<double> PongUdpServer::encode_durations_ms() const {
  std::lock_guard<std::mutex> lock(metrics_mutex_);
  return encode_durations_ms_;
}

std::uint64_t PongUdpServer::total_ticks() const { return tick_counter_; }

void PongUdpServer::handle_datagram(const net::ITransport::Endpoint &endpoint,
                                    std::vector<std::uint8_t> &&payload) {
  if (payload.empty()) {
    return;
  }

  const MessageType type = static_cast<MessageType>(payload.front());
  if (payload.size() == 1) {
    return;
  }

  const std::uint8_t *data = payload.data() + 1;
  const int length = static_cast<int>(payload.size() - 1);

  if (type == MessageType::Input) {
    mini::Input input;
    if (input.ParseFromArray(data, length)) {
      handle_input(endpoint, input);
    }
  }
}

void PongUdpServer::handle_input(const net::ITransport::Endpoint &endpoint,
                                 const mini::Input &input) {
  ClientInfo client_copy;
  {
    std::lock_guard<std::mutex> lock(clients_mutex_);
    ClientInfo &client = ensure_client_locked(endpoint);
    client.last_client_seq = input.client_seq();
    client_copy = client;
  }

  const int direction = std::clamp(input.dy(), -1, 1);
  if (client_copy.side == core::PlayerSide::Left ||
      client_copy.side == core::PlayerSide::Right) {
    world_.set_player_input(client_copy.side, direction);
  }

  send_ack(client_copy, input.client_seq());
}

void PongUdpServer::broadcast_snapshot(const core::WorldState &state) {
  const auto encoded = snapshot_generator_.encode(state);
  const auto clients = snapshot_clients();
  for (const auto &client : clients) {
    const auto encode_start = std::chrono::steady_clock::now();
    mini::Snapshot snapshot_msg;
    snapshot_msg.set_tick(static_cast<std::uint32_t>(encoded.tick));
    snapshot_msg.set_is_keyframe(encoded.is_keyframe);
    snapshot_msg.set_base_tick(static_cast<std::uint32_t>(encoded.base_tick));
    if (!encoded.payload.empty()) {
      snapshot_msg.set_state(
          reinterpret_cast<const char *>(encoded.payload.data()),
          static_cast<int>(encoded.payload.size()));
    }

    snapshot_msg.set_role(to_proto_role(client.side));
    const auto encode_end = std::chrono::steady_clock::now();
    const double encode_ms =
        std::chrono::duration<double, std::milli>(encode_end - encode_start)
            .count();
    record_encode_metrics(encode_ms);

    const std::string serialized = snapshot_msg.SerializeAsString();
    record_snapshot_size(encoded.is_keyframe, serialized.size());
    std::vector<std::uint8_t> buffer;
    buffer.reserve(serialized.size() + 1);
    buffer.push_back(static_cast<std::uint8_t>(MessageType::Snapshot));
    buffer.insert(buffer.end(), serialized.begin(), serialized.end());
    transport_->send(client.endpoint, std::move(buffer), false);
  }
}

void PongUdpServer::send_ack(const ClientInfo &client,
                             std::uint32_t client_seq) {
  mini::ServerAck ack;
  ack.set_last_client_seq(client_seq);
  ack.set_server_tick(server_tick_.load(std::memory_order_relaxed));

  const std::string serialized = ack.SerializeAsString();
  std::vector<std::uint8_t> buffer;
  buffer.reserve(serialized.size() + 1);
  buffer.push_back(static_cast<std::uint8_t>(MessageType::ServerAck));
  buffer.insert(buffer.end(), serialized.begin(), serialized.end());
  transport_->send(client.endpoint, std::move(buffer), true);
}

std::string
PongUdpServer::endpoint_key(const net::ITransport::Endpoint &endpoint) {
  boost::system::error_code ec;
  const std::string address = endpoint.address().to_string(ec);
  if (ec) {
    return std::string{"invalid:"} + std::to_string(endpoint.port());
  }
  return address + ':' + std::to_string(endpoint.port());
}

PongUdpServer::ClientInfo &
PongUdpServer::ensure_client_locked(const net::ITransport::Endpoint &endpoint) {
  const std::string key = endpoint_key(endpoint);
  auto it = clients_.find(key);
  if (it == clients_.end()) {
    ClientInfo info;
    info.endpoint = endpoint;
    if (left_client_key_.empty()) {
      info.side = core::PlayerSide::Left;
      left_client_key_ = key;
    } else if (right_client_key_.empty()) {
      info.side = core::PlayerSide::Right;
      right_client_key_ = key;
    } else {
      info.side = core::PlayerSide::Spectator;
    }
    auto inserted = clients_.emplace(key, info);
    it = inserted.first;
  } else {
    it->second.endpoint = endpoint;
  }
  return it->second;
}

std::vector<PongUdpServer::ClientInfo> PongUdpServer::snapshot_clients() const {
  std::lock_guard<std::mutex> lock(clients_mutex_);
  std::vector<ClientInfo> result;
  result.reserve(clients_.size());
  for (const auto &pair : clients_) {
    result.push_back(pair.second);
  }
  return result;
}


void PongUdpServer::record_tick_metrics(double dt_seconds) {
  if (!metrics_enabled_) {
    return;
  }
  const double ms = dt_seconds * 1000.0;
  {
    std::lock_guard<std::mutex> lock(metrics_mutex_);
    tick_durations_ms_.push_back(ms);
  }

  // Update Prometheus metrics every second
  if (prometheus_exporter_) {
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                       now - last_metrics_update_)
                       .count();
    if (elapsed >= 1) {
      update_prometheus_metrics();
      last_metrics_update_ = now;
    }
  }
}

void PongUdpServer::record_encode_metrics(double encode_ms) {
  if (!metrics_enabled_) {
    return;
  }
  std::lock_guard<std::mutex> lock(metrics_mutex_);
  encode_durations_ms_.push_back(encode_ms);
}

void PongUdpServer::record_snapshot_size(bool is_keyframe,
                                         std::size_t payload_bytes) {
  if (!metrics_enabled_) {
    return;
  }
  std::lock_guard<std::mutex> lock(metrics_mutex_);
  auto &collection =
      is_keyframe ? keyframe_payload_bytes_ : delta_payload_bytes_;
  collection.push_back(payload_bytes);
}

void PongUdpServer::update_prometheus_metrics() {
  if (!prometheus_exporter_) {
    return;
  }

  // Calculate current TPS based on recent ticks
  double current_tps = 60.0; // Target TPS
  prometheus_exporter_->set_game_tick_rate(current_tps);

  // Update tick duration histogram
  {
    std::lock_guard<std::mutex> lock(metrics_mutex_);
    if (!tick_durations_ms_.empty()) {
      // Get last N samples for recent statistics
      const std::size_t sample_count =
          std::min(tick_durations_ms_.size(), std::size_t{60});
      for (std::size_t i = tick_durations_ms_.size() - sample_count;
           i < tick_durations_ms_.size(); ++i) {
        prometheus_exporter_->observe_tick_duration(tick_durations_ms_[i] /
                                                     1000.0); // Convert to seconds
      }
    }
  }

  // Get transport counters and update dropped packets
  auto counters = transport_->sample_counters();
  prometheus_exporter_->inc_dropped_packets("duplicates",
                                             counters.dropped_duplicates_total);
  prometheus_exporter_->inc_dropped_packets("old", counters.dropped_old_total);
  prometheus_exporter_->inc_dropped_packets("window",
                                             counters.dropped_window_total);
  prometheus_exporter_->inc_retransmit_total(counters.reliable_retries_total);

  // Update active rooms and players
  {
    std::lock_guard<std::mutex> lock(clients_mutex_);
    std::uint32_t active_players = 0;
    if (!left_client_key_.empty())
      active_players++;
    if (!right_client_key_.empty())
      active_players++;
    prometheus_exporter_->set_players_active(active_players);
    prometheus_exporter_->set_rooms_active(active_players > 0 ? 1 : 0);
  }

  // Note: RTT and resimulation metrics would be collected from clients
  // For now, we set placeholder values
  prometheus_exporter_->set_rtt_p50(0.0);
  prometheus_exporter_->set_rtt_p99(0.0);
}

void PongUdpServer::log_start() const {
  std::cout << "[INFO] pong_udp server starting" << std::endl;
  if (prometheus_exporter_) {
    std::cout << "[INFO] Prometheus metrics available at http://localhost:9091/metrics" << std::endl;
  }
}

void PongUdpServer::log_stop() const {
  std::cout << "[INFO] pong_udp server stopping" << std::endl;
}

} // namespace apps::pong_udp
