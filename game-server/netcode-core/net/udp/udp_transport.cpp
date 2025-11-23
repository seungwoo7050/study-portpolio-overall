#include "udp_transport.h"

#include <boost/asio/post.hpp>
#include <boost/endian/conversion.hpp>

#include <cstddef>
#include <cstring>
#include <iostream>
#include <stdexcept>

namespace net::udp {

namespace {
std::string endpoint_key(const boost::asio::ip::udp::endpoint &endpoint) {
  boost::system::error_code ec;
  const std::string address = endpoint.address().to_string(ec);
  if (ec) {
    return std::string{"invalid:"} + std::to_string(endpoint.port());
  }
  return address + ':' + std::to_string(endpoint.port());
}

constexpr std::size_t kHeaderSize = sizeof(UdpHeader);
constexpr std::size_t kMaxWindow = 32;
constexpr std::uint32_t kMaxRetries = 5;
const std::chrono::milliseconds kBaseRetransmit{50};
const std::chrono::milliseconds kTtl{500};

std::chrono::milliseconds backoff_for(std::uint32_t retries) {
  double interval = static_cast<double>(kBaseRetransmit.count());
  for (std::uint32_t i = 0; i < retries; ++i) {
    interval *= 1.5;
  }
  return std::chrono::milliseconds(static_cast<std::int64_t>(interval));
}
} // namespace

UdpTransport::UdpTransport(boost::asio::io_context &io_context,
                           const boost::asio::ip::udp::endpoint &endpoint)
    : io_context_(io_context), socket_(io_context) {
  boost::system::error_code ec;
  socket_.open(endpoint.protocol(), ec);
  if (ec) {
    throw std::runtime_error("failed to open UDP socket: " + ec.message());
  }
  socket_.bind(endpoint, ec);
  if (ec) {
    throw std::runtime_error("failed to bind UDP socket: " + ec.message());
  }
}

UdpTransport::~UdpTransport() { stop(); }

void UdpTransport::start(ReceiveHandler handler) {
  handler_ = std::move(handler);
  running_.store(true);
  do_receive();
}

void UdpTransport::stop() {
  running_.store(false);
  boost::system::error_code ec;
  socket_.cancel(ec);
  socket_.close(ec);
}

void UdpTransport::set_metrics_enabled(bool enabled) {
  metrics_enabled_.store(enabled);
}

net::ITransport::Counters UdpTransport::sample_counters() const {
  Counters counters;
  counters.reliable_retries_total = reliable_retries_total_.load();
  counters.reliable_timeouts_total = reliable_timeouts_total_.load();
  counters.dropped_duplicates_total = dropped_duplicates_total_.load();
  counters.dropped_old_total = dropped_old_total_.load();
  counters.dropped_window_total = dropped_window_total_.load();
  return counters;
}

boost::asio::ip::udp::endpoint UdpTransport::local_endpoint() const {
  boost::system::error_code ec;
  const auto ep = socket_.local_endpoint(ec);
  if (ec) {
    return {boost::asio::ip::udp::v4(), 0};
  }
  return ep;
}

void UdpTransport::send(const Endpoint &endpoint,
                        std::vector<std::uint8_t> data, bool reliable) {
  const auto now = Clock::now();
  std::shared_ptr<std::vector<std::uint8_t>> buffer;
  boost::asio::ip::udp::endpoint endpoint_copy;
  bool drop_for_window = false;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    ClientState &client = ensure_client_locked(endpoint);
    endpoint_copy = client.endpoint;
    const std::uint16_t seq = client.next_send_seq++;
    if (reliable && client.pending.size() >= kMaxWindow) {
      drop_for_window = true;
      dropped_window_total_.fetch_add(1);
    } else {
      auto packet_buffer = compose_packet(client, seq, data);
      if (reliable) {
        PendingPacket pending;
        pending.seq = seq;
        pending.payload = data;
        pending.first_sent = now;
        pending.last_sent = now;
        pending.next_send = now + backoff_for(0);
        pending.retries = 0;
        client.pending[seq] = std::move(pending);
      }
      buffer =
          std::make_shared<std::vector<std::uint8_t>>(std::move(packet_buffer));
    }
  }

  if (drop_for_window) {
    log_drop("window", endpoint, 0);
    return;
  }

  if (buffer) {
    post_send_buffer(buffer, endpoint_copy);
  }
}

void UdpTransport::update() {
  const auto now = Clock::now();
  std::vector<std::shared_ptr<std::vector<std::uint8_t>>> buffers;
  std::vector<boost::asio::ip::udp::endpoint> endpoints;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto &pair : clients_) {
      ClientState &client = pair.second;
      std::vector<std::uint16_t> expired;
      expire_pending_locked(client, now, expired);
      for (auto seq : expired) {
        client.pending.erase(seq);
      }
      for (auto &pending_pair : client.pending) {
        PendingPacket &pending = pending_pair.second;
        if (pending.next_send <= now) {
          auto resend_buffer =
              compose_packet(client, pending.seq, pending.payload);
          pending.last_sent = now;
          ++pending.retries;
          pending.next_send = now + backoff_for(pending.retries);
          buffers.emplace_back(std::make_shared<std::vector<std::uint8_t>>(
              std::move(resend_buffer)));
          endpoints.push_back(client.endpoint);
          reliable_retries_total_.fetch_add(1);
          if (metrics_enabled_.load()) {
            std::cout << "[DEBUG] retransmit seq=" << pending.seq
                      << " retries=" << pending.retries
                      << " endpoint=" << endpoint_key(client.endpoint)
                      << std::endl;
          }
        }
      }
    }
  }

  for (std::size_t i = 0; i < buffers.size(); ++i) {
    post_send_buffer(buffers[i], endpoints[i]);
  }
}

UdpTransport::ClientState &UdpTransport::ensure_client_locked(
    const boost::asio::ip::udp::endpoint &endpoint) {
  const std::string key = endpoint_key(endpoint);
  auto [it, inserted] = clients_.try_emplace(key);
  if (inserted) {
    it->second.endpoint = endpoint;
    it->second.next_send_seq = 1;
  } else {
    it->second.endpoint = endpoint;
  }
  return it->second;
}

bool UdpTransport::is_seq_newer(std::uint16_t lhs, std::uint16_t rhs) {
  return static_cast<std::int16_t>(lhs - rhs) > 0;
}

bool UdpTransport::is_seq_acked(std::uint16_t seq, std::uint16_t ack,
                                std::uint32_t ack_bits) {
  if (seq == ack) {
    return true;
  }
  const std::int16_t diff = static_cast<std::int16_t>(ack - seq);
  if (diff <= 0) {
    return false;
  }
  if (diff > 32) {
    return false;
  }
  const std::uint32_t mask = 1u << (static_cast<std::uint32_t>(diff) - 1u);
  return (ack_bits & mask) != 0u;
}

void UdpTransport::do_receive() {
  socket_.async_receive_from(
      boost::asio::buffer(recv_buffer_), remote_endpoint_,
      [this](boost::system::error_code ec, std::size_t bytes_transferred) {
        handle_receive(ec, bytes_transferred);
      });
}

void UdpTransport::handle_receive(boost::system::error_code ec,
                                  std::size_t bytes_transferred) {
  if (ec) {
    if (running_.load() && ec != boost::asio::error::operation_aborted) {
      do_receive();
    }
    return;
  }

  if (bytes_transferred < kHeaderSize) {
    if (running_.load()) {
      do_receive();
    }
    return;
  }

  UdpHeader header{};
  std::memcpy(&header, recv_buffer_.data(), kHeaderSize);
  header.seq = boost::endian::big_to_native(header.seq);
  header.ack = boost::endian::big_to_native(header.ack);
  header.ack_bits = boost::endian::big_to_native(header.ack_bits);

  std::vector<std::uint8_t> payload(
      recv_buffer_.begin() + static_cast<std::ptrdiff_t>(kHeaderSize),
      recv_buffer_.begin() + static_cast<std::ptrdiff_t>(bytes_transferred));

  process_packet(remote_endpoint_, header, std::move(payload));

  if (running_.load()) {
    do_receive();
  }
}

void UdpTransport::process_packet(const Endpoint &endpoint,
                                  const UdpHeader &header,
                                  std::vector<std::uint8_t> &&payload) {
  ReceiveHandler handler_copy;
  bool drop_packet = false;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    ClientState &client = ensure_client_locked(endpoint);
    client.last_heard = Clock::now();
    handle_ack(client, header.ack, header.ack_bits);
    if (client.receive_state.has_last_seq) {
      if (!is_seq_newer(header.seq, client.receive_state.last_seq)) {
        const std::uint16_t diff = static_cast<std::uint16_t>(
            client.receive_state.last_seq - header.seq);
        if (diff == 0 || has_received(client.receive_state, header.seq)) {
          drop_packet = true;
          dropped_duplicates_total_.fetch_add(1);
          log_drop("dup", endpoint, header.seq);
        } else if (diff > 32) {
          drop_packet = true;
          dropped_old_total_.fetch_add(1);
          log_drop("old", endpoint, header.seq);
        }
      }
    }
    if (!drop_packet) {
      update_receive_state(client.receive_state, header.seq);
      handler_copy = handler_;
    }
  }

  if (!drop_packet && handler_copy) {
    handler_copy(endpoint, std::move(payload));
  }
}

void UdpTransport::handle_ack(ClientState &client, std::uint16_t ack,
                              std::uint32_t ack_bits) {
  auto it = client.pending.begin();
  while (it != client.pending.end()) {
    if (is_seq_acked(it->first, ack, ack_bits)) {
      it = client.pending.erase(it);
    } else {
      ++it;
    }
  }
}

void UdpTransport::update_receive_state(ReceiveState &state,
                                        std::uint16_t seq) {
  if (!state.has_last_seq) {
    state.has_last_seq = true;
    state.last_seq = seq;
    state.ack_bits = 0;
    return;
  }

  if (is_seq_newer(seq, state.last_seq)) {
    const std::uint16_t diff = static_cast<std::uint16_t>(seq - state.last_seq);
    if (diff >= 32) {
      state.ack_bits = 0;
    } else {
      state.ack_bits <<= diff;
      state.ack_bits |= (1u << (diff - 1u));
    }
    state.last_seq = seq;
  } else {
    const std::uint16_t diff = static_cast<std::uint16_t>(state.last_seq - seq);
    if (diff >= 1 && diff <= 32) {
      state.ack_bits |= (1u << (diff - 1u));
    }
  }
}

bool UdpTransport::has_received(const ReceiveState &state, std::uint16_t seq) {
  if (!state.has_last_seq) {
    return false;
  }
  if (seq == state.last_seq) {
    return true;
  }
  if (is_seq_newer(seq, state.last_seq)) {
    return false;
  }
  const std::uint16_t diff = static_cast<std::uint16_t>(state.last_seq - seq);
  if (diff == 0) {
    return true;
  }
  if (diff > 32) {
    return false;
  }
  const std::uint32_t mask = 1u << (diff - 1u);
  return (state.ack_bits & mask) != 0u;
}

std::vector<std::uint8_t>
UdpTransport::compose_packet(const ClientState &client, std::uint16_t seq,
                             const std::vector<std::uint8_t> &payload) const {
  UdpHeader header{};
  header.seq = boost::endian::native_to_big(seq);
  if (client.receive_state.has_last_seq) {
    header.ack = boost::endian::native_to_big(client.receive_state.last_seq);
    header.ack_bits =
        boost::endian::native_to_big(client.receive_state.ack_bits);
  } else {
    header.ack = 0;
    header.ack_bits = 0;
  }

  std::vector<std::uint8_t> buffer;
  buffer.resize(kHeaderSize + payload.size());
  std::memcpy(buffer.data(), &header, kHeaderSize);
  if (!payload.empty()) {
    std::memcpy(buffer.data() + static_cast<std::ptrdiff_t>(kHeaderSize),
                payload.data(), payload.size());
  }
  return buffer;
}

void UdpTransport::post_send_buffer(
    std::shared_ptr<std::vector<std::uint8_t>> buffer,
    const boost::asio::ip::udp::endpoint &endpoint) {
  boost::asio::post(io_context_, [this, buffer, endpoint]() {
    if (!socket_.is_open()) {
      return;
    }
    socket_.async_send_to(boost::asio::buffer(*buffer), endpoint,
                          [buffer](boost::system::error_code /*ec*/,
                                   std::size_t /*bytes_sent*/) {});
  });
}

void UdpTransport::expire_pending_locked(ClientState &client,
                                         const Clock::time_point &now,
                                         std::vector<std::uint16_t> &expired) {
  for (const auto &pair : client.pending) {
    const PendingPacket &pending = pair.second;
    const bool ttl_expired = now - pending.first_sent >= kTtl;
    const bool retries_exceeded = pending.retries >= kMaxRetries;
    if (ttl_expired || retries_exceeded) {
      expired.push_back(pair.first);
      reliable_timeouts_total_.fetch_add(1);
      if (metrics_enabled_.load()) {
        std::cout << "[DEBUG] reliable timeout seq=" << pending.seq
                  << " endpoint=" << endpoint_key(client.endpoint) << std::endl;
      }
    }
  }
}

void UdpTransport::log_drop(const std::string &reason, const Endpoint &endpoint,
                            std::uint16_t seq) {
  if (!metrics_enabled_.load()) {
    return;
  }
  std::cout << "[DEBUG] drop reason=" << reason << " seq=" << seq
            << " endpoint=" << endpoint_key(endpoint) << std::endl;
}

} // namespace net::udp
