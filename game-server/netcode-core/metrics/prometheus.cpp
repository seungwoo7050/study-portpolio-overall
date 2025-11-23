#include "prometheus.h"

#include <algorithm>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sstream>
#include <sys/socket.h>
#include <thread>
#include <unistd.h>

namespace metrics {

PrometheusExporter::PrometheusExporter() {}

PrometheusExporter::~PrometheusExporter() { stop(); }

void PrometheusExporter::start(std::uint16_t port) {
  if (running_.exchange(true)) {
    return; // Already running
  }

  port_ = port;
  server_thread_ = std::thread([this]() { run_http_server(); });
}

void PrometheusExporter::stop() {
  if (!running_.exchange(false)) {
    return; // Not running
  }

  if (server_thread_.joinable()) {
    server_thread_.join();
  }
}

void PrometheusExporter::set_game_tick_rate(double tps) {
  game_tick_rate_.store(tps);
}

void PrometheusExporter::set_rtt_p50(double ms) { rtt_p50_.store(ms); }

void PrometheusExporter::set_rtt_p99(double ms) { rtt_p99_.store(ms); }

void PrometheusExporter::set_rooms_active(std::uint32_t count) {
  rooms_active_.store(count);
}

void PrometheusExporter::set_players_active(std::uint32_t count) {
  players_active_.store(count);
}

void PrometheusExporter::inc_dropped_packets(const std::string &reason,
                                              std::uint64_t count) {
  std::lock_guard<std::mutex> lock(mutex_);
  dropped_packets_[reason] += count;
}

void PrometheusExporter::inc_retransmit_total(std::uint64_t count) {
  retransmit_total_.fetch_add(count);
}

void PrometheusExporter::inc_resimulations_total(std::uint64_t count) {
  resimulations_total_.fetch_add(count);
}

void PrometheusExporter::observe_tick_duration(double seconds) {
  std::lock_guard<std::mutex> lock(mutex_);
  tick_duration_hist_.observe(seconds);
}

void PrometheusExporter::observe_resim_depth(std::uint32_t depth) {
  std::lock_guard<std::mutex> lock(mutex_);
  resim_depth_hist_.observe(static_cast<double>(depth));
}

std::string PrometheusExporter::get_metrics() const {
  std::ostringstream oss;

  // HELP and TYPE headers
  oss << "# HELP game_tick_rate Current game tick rate (TPS)\n";
  oss << "# TYPE game_tick_rate gauge\n";
  oss << "game_tick_rate " << game_tick_rate_.load() << "\n\n";

  oss << "# HELP rtt_ms_p50 Round-trip time 50th percentile (ms)\n";
  oss << "# TYPE rtt_ms_p50 gauge\n";
  oss << "rtt_ms_p50 " << rtt_p50_.load() << "\n\n";

  oss << "# HELP rtt_ms_p99 Round-trip time 99th percentile (ms)\n";
  oss << "# TYPE rtt_ms_p99 gauge\n";
  oss << "rtt_ms_p99 " << rtt_p99_.load() << "\n\n";

  oss << "# HELP rooms_active Number of active game rooms\n";
  oss << "# TYPE rooms_active gauge\n";
  oss << "rooms_active " << rooms_active_.load() << "\n\n";

  oss << "# HELP players_active Number of active players\n";
  oss << "# TYPE players_active gauge\n";
  oss << "players_active " << players_active_.load() << "\n\n";

  // Counters
  oss << "# HELP dropped_packets_total Total dropped packets by reason\n";
  oss << "# TYPE dropped_packets_total counter\n";
  {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &[reason, count] : dropped_packets_) {
      oss << "dropped_packets_total{reason=\"" << reason << "\"} " << count
          << "\n";
    }
  }
  oss << "\n";

  oss << "# HELP retransmit_total Total packet retransmissions\n";
  oss << "# TYPE retransmit_total counter\n";
  oss << "retransmit_total " << retransmit_total_.load() << "\n\n";

  oss << "# HELP resimulations_total Total client resimulations\n";
  oss << "# TYPE resimulations_total counter\n";
  oss << "resimulations_total " << resimulations_total_.load() << "\n\n";

  // Histograms
  oss << "# HELP game_tick_duration_seconds Game tick duration histogram\n";
  oss << "# TYPE game_tick_duration_seconds histogram\n";
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!tick_duration_hist_.values.empty()) {
      double p50 = tick_duration_hist_.percentile(0.50);
      double p90 = tick_duration_hist_.percentile(0.90);
      double p99 = tick_duration_hist_.percentile(0.99);
      oss << "game_tick_duration_seconds{quantile=\"0.5\"} " << p50 << "\n";
      oss << "game_tick_duration_seconds{quantile=\"0.9\"} " << p90 << "\n";
      oss << "game_tick_duration_seconds{quantile=\"0.99\"} " << p99 << "\n";
    }
  }
  oss << "\n";

  oss << "# HELP resim_depth_bucket Client resimulation depth histogram\n";
  oss << "# TYPE resim_depth_bucket histogram\n";
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!resim_depth_hist_.values.empty()) {
      double p50 = resim_depth_hist_.percentile(0.50);
      double p90 = resim_depth_hist_.percentile(0.90);
      double p99 = resim_depth_hist_.percentile(0.99);
      oss << "resim_depth_bucket{quantile=\"0.5\"} " << p50 << "\n";
      oss << "resim_depth_bucket{quantile=\"0.9\"} " << p90 << "\n";
      oss << "resim_depth_bucket{quantile=\"0.99\"} " << p99 << "\n";
    }
  }
  oss << "\n";

  return oss.str();
}

void PrometheusExporter::run_http_server() {
  int server_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) {
    return;
  }

  int opt = 1;
  setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

  struct sockaddr_in addr;
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = INADDR_ANY;
  addr.sin_port = htons(port_);

  if (bind(server_fd, reinterpret_cast<struct sockaddr *>(&addr),
           sizeof(addr)) < 0) {
    close(server_fd);
    return;
  }

  if (listen(server_fd, 10) < 0) {
    close(server_fd);
    return;
  }

  // Set non-blocking with timeout for accept
  struct timeval tv;
  tv.tv_sec = 1;
  tv.tv_usec = 0;
  setsockopt(server_fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

  while (running_.load()) {
    struct sockaddr_in client_addr;
    socklen_t client_len = sizeof(client_addr);
    int client_fd = accept(server_fd,
                           reinterpret_cast<struct sockaddr *>(&client_addr),
                           &client_len);

    if (client_fd < 0) {
      continue; // Timeout or error, check running_ flag
    }

    // Read HTTP request (simplified - just read and ignore)
    char buffer[1024];
    ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer));
    (void)bytes_read; // Suppress unused warning

    // Generate metrics
    std::string metrics = get_metrics();

    // Send HTTP response
    std::ostringstream response;
    response << "HTTP/1.1 200 OK\r\n";
    response << "Content-Type: text/plain; version=0.0.4\r\n";
    response << "Content-Length: " << metrics.size() << "\r\n";
    response << "\r\n";
    response << metrics;

    std::string response_str = response.str();
    ssize_t bytes_written = write(client_fd, response_str.c_str(), response_str.size());
    (void)bytes_written; // Suppress unused warning
    close(client_fd);
  }

  close(server_fd);
}

// Histogram implementation
void PrometheusExporter::Histogram::observe(double value) {
  values.push_back(value);

  // Maintain buckets for histogram
  // Define standard buckets: 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0
  static const std::vector<double> bucket_bounds = {
      0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0};

  for (double bound : bucket_bounds) {
    if (value <= bound) {
      buckets[bound]++;
    }
  }
}

double PrometheusExporter::Histogram::percentile(double p) const {
  if (values.empty()) {
    return 0.0;
  }

  auto sorted = values;
  std::sort(sorted.begin(), sorted.end());

  std::size_t index =
      static_cast<std::size_t>(p * static_cast<double>(sorted.size() - 1));
  return sorted[index];
}

void PrometheusExporter::Histogram::clear() {
  values.clear();
  buckets.clear();
}

} // namespace metrics
