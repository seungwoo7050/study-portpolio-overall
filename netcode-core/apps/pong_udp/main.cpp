#include "pong_udp_server.h"

#include "net/udp/udp_transport.h"

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/udp.hpp>
#include <boost/asio/signal_set.hpp>

#include <csignal>
#include <cstdint>
#include <cstring>
#include <exception>
#include <iostream>
#include <memory>
#include <string>

int main(int argc, char **argv) {
  std::uint16_t port = 40000;
  bool metrics_enabled = false;
  std::string redis_host = "127.0.0.1";
  int redis_port = 6379;
  std::string room_id = "default_room";

  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    if (arg == "--metrics") {
      metrics_enabled = true;
    } else if (arg == "--redis-host" && i + 1 < argc) {
      redis_host = argv[++i];
    } else if (arg == "--redis-port" && i + 1 < argc) {
      redis_port = std::stoi(argv[++i]);
    } else if (arg == "--room-id" && i + 1 < argc) {
      room_id = argv[++i];
    } else if (arg == "--port" && i + 1 < argc) {
      port = static_cast<std::uint16_t>(std::stoul(argv[++i]));
    } else if (arg == "--help") {
      std::cout << "Usage: " << argv[0] << " [options]\n"
                << "Options:\n"
                << "  --port <port>         UDP port (default: 40000)\n"
                << "  --metrics             Enable Prometheus metrics\n"
                << "  --redis-host <host>   Redis host (default: 127.0.0.1)\n"
                << "  --redis-port <port>   Redis port (default: 6379)\n"
                << "  --room-id <id>        Room identifier (default: default_room)\n"
                << "  --help                Show this help\n";
      return 0;
    } else {
      // Try parsing as port for backward compatibility
      try {
        port = static_cast<std::uint16_t>(std::stoul(arg));
      } catch (const std::exception &) {
        std::cerr << "Invalid argument: " << arg << std::endl;
        return 1;
      }
    }
  }

  try {
    boost::asio::io_context io_context;
    auto endpoint =
        boost::asio::ip::udp::endpoint(boost::asio::ip::udp::v4(), port);
    auto transport =
        std::make_unique<net::udp::UdpTransport>(io_context, endpoint);
    apps::pong_udp::PongUdpServer server(io_context, std::move(transport),
                                         metrics_enabled, redis_host, redis_port, room_id);
    server.start();

    boost::asio::signal_set signals(io_context, SIGINT, SIGTERM);
    signals.async_wait([&](const boost::system::error_code &, int) {
      server.stop();
      io_context.stop();
    });

    std::cout << "UDP Pong server listening on port " << port;
    if (metrics_enabled) {
      std::cout << " with metrics enabled";
    }
    std::cout << "\nRoom ID: " << room_id << std::endl;
    std::cout << "Redis: " << redis_host << ":" << redis_port << std::endl;

    io_context.run();
    server.stop();
    return 0;
  } catch (const std::exception &ex) {
    std::cerr << "Fatal error: " << ex.what() << std::endl;
    return 1;
  }
}
