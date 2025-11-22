#include "echo_server.h"

#include <atomic>       // std::atomic
#include <cstdint>      // std::uint16_t
#include <csignal>      // std::signal, std::sig_atomic_t
#include <cstdlib>      // std::exit
#include <exception>    // std::exception
#include <iostream>     // std::cerr
#include <limits>       // std::numeric_limits

namespace {
std::atomic<net::EchoServer *> g_server_instance{nullptr};
std::atomic<bool> g_signal_received{false};

void signal_handler(int) {
    g_signal_received.store(true);
    if (auto *server = g_server_instance.load()) {
        server->stop();
    }
}
} // namespace

int main(int argc, char *argv[]) {
    uint16_t port = 8080;
    if (argc > 1) {
        char *end = nullptr;
        unsigned long parsed = std::strtoul(argv[1], &end, 10);
        if (!end || *end != '\0' || parsed > std::numeric_limits<uint16_t>::max()) {
            std::cerr << "Invalid port number: " << (argv[1] ? argv[1] : "") << std::endl;
            return EXIT_FAILURE;
        }
        port = static_cast<uint16_t>(parsed);
    }

    std::string prefix;
    if (argc > 2) {
        prefix = argv[2];
    }

    try {
        net::EchoServer server(port, prefix);
        g_server_instance.store(&server);
        std::signal(SIGINT, signal_handler);
        std::signal(SIGTERM, signal_handler);

        std::cout << "Echo server listening on port " << port << std::endl;
        std::cout << "Press Ctrl+C to stop." << std::endl;
        server.run();
        g_server_instance.store(nullptr);
        if (g_signal_received.load()) {
            std::cout << "\nSignal received. Shutting down server..." << std::endl;
        }
        std::cout << "Server stopped." << std::endl;
    } catch (const std::exception &ex) {
        g_server_instance.store(nullptr);
        std::cerr << "Fatal error: " << ex.what() << std::endl;
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}