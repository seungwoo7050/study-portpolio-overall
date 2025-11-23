#pragma once

#include <atomic>
#include <chrono>
#include <cstdint>
#include <map>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace metrics {

class PrometheusExporter {
public:
  PrometheusExporter();
  ~PrometheusExporter();

  // Start HTTP server on specified port
  void start(std::uint16_t port);
  void stop();

  // Gauge metrics (current value)
  void set_game_tick_rate(double tps);
  void set_rtt_p50(double ms);
  void set_rtt_p99(double ms);
  void set_rooms_active(std::uint32_t count);
  void set_players_active(std::uint32_t count);

  // Counter metrics (increment only)
  void inc_dropped_packets(const std::string &reason, std::uint64_t count = 1);
  void inc_retransmit_total(std::uint64_t count = 1);
  void inc_resimulations_total(std::uint64_t count = 1);

  // Histogram metrics (observe values)
  void observe_tick_duration(double seconds);
  void observe_resim_depth(std::uint32_t depth);

  // Get metrics in Prometheus text format
  std::string get_metrics() const;

private:
  struct Histogram {
    std::vector<double> values;
    std::map<double, std::uint64_t>
        buckets; // bucket upper bound -> count

    void observe(double value);
    double percentile(double p) const;
    void clear();
  };

  mutable std::mutex mutex_;

  // Gauges
  std::atomic<double> game_tick_rate_{0.0};
  std::atomic<double> rtt_p50_{0.0};
  std::atomic<double> rtt_p99_{0.0};
  std::atomic<std::uint32_t> rooms_active_{0};
  std::atomic<std::uint32_t> players_active_{0};

  // Counters
  std::map<std::string, std::uint64_t> dropped_packets_;
  std::atomic<std::uint64_t> retransmit_total_{0};
  std::atomic<std::uint64_t> resimulations_total_{0};

  // Histograms
  Histogram tick_duration_hist_;
  Histogram resim_depth_hist_;

  // HTTP server state
  std::atomic<bool> running_{false};
  std::uint16_t port_{0};
  void run_http_server();
  std::thread server_thread_;
};

} // namespace metrics
