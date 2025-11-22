#include "bot.h"

#include <boost/asio/io_context.hpp>
#include <boost/asio/signal_set.hpp>

#include <csignal>
#include <fstream>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace {

struct LoadgenConfig {
  std::uint32_t num_clients{100};
  std::string server_host{"127.0.0.1"};
  std::uint16_t server_port{40000};
  std::uint32_t duration_seconds{60};
  std::string csv_output;
  double input_rate{60.0};
};

void print_usage(const char *program_name) {
  std::cout << "Usage: " << program_name << " [options]\n";
  std::cout << "Options:\n";
  std::cout << "  --clients N         Number of clients (default: 100)\n";
  std::cout << "  --host HOST         Server host (default: 127.0.0.1)\n";
  std::cout << "  --port PORT         Server port (default: 40000)\n";
  std::cout << "  --duration SECS     Test duration in seconds (default: 60)\n";
  std::cout << "  --csv FILE          Output CSV file path\n";
  std::cout << "  --rate RATE         Input rate per client (default: 60)\n";
  std::cout << "  --help              Show this help\n";
}

LoadgenConfig parse_args(int argc, char **argv) {
  LoadgenConfig config;

  for (int i = 1; i < argc; ++i) {
    std::string arg = argv[i];

    if (arg == "--help") {
      print_usage(argv[0]);
      std::exit(0);
    } else if (arg == "--clients" && i + 1 < argc) {
      config.num_clients = std::stoul(argv[++i]);
    } else if (arg == "--host" && i + 1 < argc) {
      config.server_host = argv[++i];
    } else if (arg == "--port" && i + 1 < argc) {
      config.server_port = static_cast<std::uint16_t>(std::stoul(argv[++i]));
    } else if (arg == "--duration" && i + 1 < argc) {
      config.duration_seconds = std::stoul(argv[++i]);
    } else if (arg == "--csv" && i + 1 < argc) {
      config.csv_output = argv[++i];
    } else if (arg == "--rate" && i + 1 < argc) {
      config.input_rate = std::stod(argv[++i]);
    } else {
      std::cerr << "Unknown argument: " << arg << "\n";
      print_usage(argv[0]);
      std::exit(1);
    }
  }

  return config;
}

void write_csv(const std::string &filepath,
               const std::vector<apps::loadgen::Bot::Stats> &all_stats) {
  std::ofstream file(filepath);
  if (!file.is_open()) {
    std::cerr << "Failed to open CSV file: " << filepath << "\n";
    return;
  }

  // Header
  file << "bot_id,packets_sent,packets_received,avg_rtt_ms,p50_rtt_ms,p99_rtt_"
          "ms\n";

  // Data
  for (std::size_t i = 0; i < all_stats.size(); ++i) {
    const auto &stats = all_stats[i];

    double avg_rtt = 0.0;
    double p50_rtt = 0.0;
    double p99_rtt = 0.0;

    if (!stats.rtt_samples_ms.empty()) {
      double sum = 0.0;
      for (double rtt : stats.rtt_samples_ms) {
        sum += rtt;
      }
      avg_rtt = sum / static_cast<double>(stats.rtt_samples_ms.size());

      auto sorted = stats.rtt_samples_ms;
      std::sort(sorted.begin(), sorted.end());
      p50_rtt = sorted[sorted.size() / 2];
      p99_rtt = sorted[static_cast<std::size_t>(sorted.size() * 0.99)];
    }

    file << i << "," << stats.packets_sent << "," << stats.packets_received
         << "," << avg_rtt << "," << p50_rtt << "," << p99_rtt << "\n";
  }

  file.close();
  std::cout << "Wrote CSV to: " << filepath << "\n";
}

} // namespace

int main(int argc, char **argv) {
  auto config = parse_args(argc, argv);

  std::cout << "Load Generator Configuration:\n";
  std::cout << "  Clients: " << config.num_clients << "\n";
  std::cout << "  Server: " << config.server_host << ":" << config.server_port
            << "\n";
  std::cout << "  Duration: " << config.duration_seconds << " seconds\n";
  std::cout << "  Input rate: " << config.input_rate << " Hz\n";
  if (!config.csv_output.empty()) {
    std::cout << "  CSV output: " << config.csv_output << "\n";
  }
  std::cout << "\n";

  try {
    boost::asio::io_context io_context;

    // Create bots
    std::vector<std::unique_ptr<apps::loadgen::Bot>> bots;
    apps::loadgen::Bot::Config bot_config;
    bot_config.server_host = config.server_host;
    bot_config.server_port = config.server_port;
    bot_config.input_rate = config.input_rate;

    for (std::uint32_t i = 0; i < config.num_clients; ++i) {
      bots.push_back(
          std::make_unique<apps::loadgen::Bot>(io_context, bot_config));
    }

    // Start all bots
    std::cout << "Starting " << bots.size() << " bots...\n";
    for (auto &bot : bots) {
      bot->start();
    }

    // Run for duration
    boost::asio::signal_set signals(io_context, SIGINT, SIGTERM);
    bool stopped = false;
    signals.async_wait([&](const boost::system::error_code &, int) {
      if (!stopped) {
        stopped = true;
        std::cout << "\nStopping load generator...\n";
        for (auto &bot : bots) {
          bot->stop();
        }
        io_context.stop();
      }
    });

    // Run for specified duration
    std::thread timer_thread([&]() {
      std::this_thread::sleep_for(
          std::chrono::seconds(config.duration_seconds));
      if (!stopped) {
        stopped = true;
        std::cout << "\nDuration elapsed, stopping...\n";
        for (auto &bot : bots) {
          bot->stop();
        }
        io_context.stop();
      }
    });

    io_context.run();
    timer_thread.join();

    // Collect stats
    std::cout << "\nCollecting statistics...\n";
    std::vector<apps::loadgen::Bot::Stats> all_stats;
    std::uint64_t total_sent = 0;
    std::uint64_t total_received = 0;

    for (auto &bot : bots) {
      auto stats = bot->get_stats();
      total_sent += stats.packets_sent;
      total_received += stats.packets_received;
      all_stats.push_back(std::move(stats));
    }

    std::cout << "\nResults:\n";
    std::cout << "  Total packets sent: " << total_sent << "\n";
    std::cout << "  Total packets received: " << total_received << "\n";
    std::cout << "  Packet rate: "
              << (total_sent / static_cast<double>(config.duration_seconds))
              << " pkt/s\n";

    // Write CSV if requested
    if (!config.csv_output.empty()) {
      write_csv(config.csv_output, all_stats);
    }

    return 0;
  } catch (const std::exception &ex) {
    std::cerr << "Fatal error: " << ex.what() << "\n";
    return 1;
  }
}
