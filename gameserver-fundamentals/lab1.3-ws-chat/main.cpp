#include "websocket_server.h"

#include <boost/asio/io_context.hpp>

#include <cstdlib>
#include <iostream>
#include <memory>
#include <string>

int main(int argc, char *argv[]) {
    try {
        const unsigned short port = argc > 1 ? static_cast<unsigned short>(std::stoi(argv[1])) : 8080;
        boost::asio::io_context ioc{1};
        auto server = std::make_shared<ws::WebSocketServer>(ioc, ws::WebSocketServer::tcp::endpoint(ws::WebSocketServer::tcp::v4(), port));
        server->run();
        std::cout << "WebSocket chat server listening on port " << port << std::endl;
        ioc.run();
    } catch (const std::exception &ex) {
        std::cerr << "Fatal error: " << ex.what() << std::endl;
        return EXIT_FAILURE;
    }
    return EXIT_SUCCESS;
}
