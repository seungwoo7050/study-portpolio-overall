#pragma once

#include "net/transport.h"

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/udp.hpp>

#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <functional>
#include <map>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

class UdpTransportTestPeer;

namespace net::udp {

struct UdpHeader {
  std::uint16_t seq{0};
  std::uint16_t ack{0};
  std::uint32_t ack_bits{0};
};

class UdpTransport : public net::ITransport {
public:
  using Clock = std::chrono::steady_clock;

  UdpTransport(boost::asio::io_context &io_context,
               const boost::asio::ip::udp::endpoint &endpoint);
  ~UdpTransport() override;

  void start(ReceiveHandler handler) override;
  void stop() override;

  void send(const Endpoint &endpoint, std::vector<std::uint8_t> data,
            bool reliable) override;
  void update() override;

  void set_metrics_enabled(bool enabled) override;
  Counters sample_counters() const override;

  boost::asio::ip::udp::endpoint local_endpoint() const;

  struct ReceiveState {
    bool has_last_seq{false};
    std::uint16_t last_seq{0};
    std::uint32_t ack_bits{0};
  };

  struct PendingPacket {
    std::uint16_t seq{0};
    std::vector<std::uint8_t> payload;
    Clock::time_point first_sent{};
    Clock::time_point last_sent{};
    Clock::time_point next_send{};
    std::uint32_t retries{0};
  };

  struct ClientState {
    Endpoint endpoint;
    std::uint16_t next_send_seq{0};
    ReceiveState receive_state{};
    std::map<std::uint16_t, PendingPacket> pending;
    Clock::time_point last_heard{};
  };

  static bool is_seq_newer(std::uint16_t lhs, std::uint16_t rhs);
  static bool is_seq_acked(std::uint16_t seq, std::uint16_t ack,
                           std::uint32_t ack_bits);
  static void update_receive_state(ReceiveState &state, std::uint16_t seq);
  static bool has_received(const ReceiveState &state, std::uint16_t seq);

private:
  ClientState &
  ensure_client_locked(const boost::asio::ip::udp::endpoint &endpoint);

  void do_receive();
  void handle_receive(boost::system::error_code ec,
                      std::size_t bytes_transferred);
  void process_packet(const Endpoint &endpoint, const UdpHeader &header,
                      std::vector<std::uint8_t> &&payload);
  void handle_ack(ClientState &client, std::uint16_t ack,
                  std::uint32_t ack_bits);

  std::vector<std::uint8_t>
  compose_packet(const ClientState &client, std::uint16_t seq,
                 const std::vector<std::uint8_t> &payload) const;
  void post_send_buffer(std::shared_ptr<std::vector<std::uint8_t>> buffer,
                        const boost::asio::ip::udp::endpoint &endpoint);
  void expire_pending_locked(ClientState &client, const Clock::time_point &now,
                             std::vector<std::uint16_t> &expired);
  void log_drop(const std::string &reason, const Endpoint &endpoint,
                std::uint16_t seq);

  boost::asio::io_context &io_context_;
  boost::asio::ip::udp::socket socket_;
  ReceiveHandler handler_;
  std::array<std::uint8_t, 2048> recv_buffer_{};
  boost::asio::ip::udp::endpoint remote_endpoint_;
  std::mutex mutex_;
  std::unordered_map<std::string, ClientState> clients_;
  std::atomic<bool> running_{false};
  std::atomic<bool> metrics_enabled_{false};
  std::atomic<std::uint64_t> reliable_retries_total_{0};
  std::atomic<std::uint64_t> reliable_timeouts_total_{0};
  std::atomic<std::uint64_t> dropped_duplicates_total_{0};
  std::atomic<std::uint64_t> dropped_old_total_{0};
  std::atomic<std::uint64_t> dropped_window_total_{0};

  friend class ::UdpTransportTestPeer;
};

} // namespace net::udp
