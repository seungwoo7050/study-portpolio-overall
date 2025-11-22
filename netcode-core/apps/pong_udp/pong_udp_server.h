#pragma once

#include "core/game_loop.h"
#include "core/world.h"
#include "metrics/prometheus.h"
#include "net/transport.h"
#include "sync/snapshot.h"

#include <atomic>
#include <chrono>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace mini {
class Input;
class RoomManager;
} // namespace mini

namespace apps::pong_udp {

class PongUdpServer {
public:
  PongUdpServer(boost::asio::io_context &io_context,
                std::unique_ptr<net::ITransport> transport,
                bool metrics_enabled,
                const std::string& redis_host = "127.0.0.1",
                int redis_port = 6379,
                const std::string& room_id = "default_room");
  ~PongUdpServer();

  void start();
  void stop();

  struct SnapshotMetrics {
    double encode_ms{0.0};
  };

  struct TickMetrics {
    double tick_ms{0.0};
  };

  net::ITransport::Counters transport_counters() const;
  std::vector<double> tick_durations_ms() const;
  std::vector<double> encode_durations_ms() const;
  std::uint64_t total_ticks() const;

private:
  enum class MessageType : std::uint8_t {
    Input = 1,
    Snapshot = 2,
    ServerAck = 3
  };

  struct ClientInfo {
    net::ITransport::Endpoint endpoint;
    core::PlayerSide side{core::PlayerSide::Spectator};
    std::uint32_t last_client_seq{0};
  };

  void handle_datagram(const net::ITransport::Endpoint &endpoint,
                       std::vector<std::uint8_t> &&payload);
  void handle_input(const net::ITransport::Endpoint &endpoint,
                    const mini::Input &input);
  void broadcast_snapshot(const core::WorldState &state);
  void send_ack(const ClientInfo &client, std::uint32_t client_seq);
  static std::string endpoint_key(const net::ITransport::Endpoint &endpoint);
  ClientInfo &ensure_client_locked(const net::ITransport::Endpoint &endpoint);
  std::vector<ClientInfo> snapshot_clients() const;
  void record_tick_metrics(double dt_seconds);
  void record_encode_metrics(double encode_ms);
  void record_snapshot_size(bool is_keyframe, std::size_t payload_bytes);
  void update_prometheus_metrics();
  void log_start() const;
  void log_stop() const;

  boost::asio::io_context &io_context_;
  std::unique_ptr<net::ITransport> transport_;
  core::World world_;
  core::GameLoop loop_;
  mini::sync::SnapshotGenerator snapshot_generator_;
  mutable std::mutex clients_mutex_;
  std::unordered_map<std::string, ClientInfo> clients_;
  std::string left_client_key_;
  std::string right_client_key_;
  std::atomic<std::uint32_t> server_tick_{0};
  bool metrics_enabled_{false};
  mutable std::mutex metrics_mutex_;
  std::vector<double> tick_durations_ms_;
  std::vector<double> encode_durations_ms_;
  std::vector<std::size_t> keyframe_payload_bytes_;
  std::vector<std::size_t> delta_payload_bytes_;
  std::uint64_t tick_counter_{0};
  std::unique_ptr<metrics::PrometheusExporter> prometheus_exporter_;
  std::chrono::steady_clock::time_point last_metrics_update_;

  // M1.8: Redis session/recovery support
  std::unique_ptr<mini::RoomManager> room_manager_;
  std::string room_id_;
  static constexpr int CHECKPOINT_INTERVAL_TICKS = 60;  // Store checkpoint every 60 ticks (~1s at 60 TPS)
};

} // namespace apps::pong_udp
