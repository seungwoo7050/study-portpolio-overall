#include "pong_server.h"

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/address.hpp>
#include <boost/asio/signal_set.hpp>

#include <csignal>
#include <iostream>
#include <memory>
#include <string>

int main(int argc, char **argv) {
    try {
        std::string host = "0.0.0.0";
        std::uint16_t port = 8081;
        if (argc >= 2) {
            port = static_cast<std::uint16_t>(std::stoi(argv[1]));
        }
        if (argc >= 3) {
            host = argv[2];
        }

        boost::asio::io_context ioc{1};
        auto address = boost::asio::ip::make_address(host);
        auto endpoint = pong::PongServer::tcp::endpoint{address, port};
        auto server = std::make_shared<pong::PongServer>(ioc, endpoint);
        server->run();

        boost::asio::signal_set signals(ioc, SIGINT, SIGTERM);
        signals.async_wait([server, &ioc](const boost::system::error_code &, int) {
            server->stop();
            ioc.stop();
        });

        std::cout << "Pong server listening on " << host << ":" << port << std::endl;
        ioc.run();
        server->stop();
    } catch (const std::exception &ex) {
        std::cerr << "Fatal error: " << ex.what() << std::endl;
        return 1;
    }
    return 0;
}
