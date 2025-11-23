#pragma once

#include "socket.h"

#include <atomic>       // for std::atomic
#include <cstddef>      // for std::size_t
#include <cstdint>      // for uint16_t
#include <mutex>        // for std::mutex
#include <string>       // for std::string
#include <thread>       // for std::thread
#include <vector>       // for std::vector

namespace net {
class EchoServer {
public:
    explicit EchoServer(uint16_t port, std::string prefix, int backlog = 128);
    ~EchoServer();

    void run();
    void stop();

private:
    void accept_loop();
    void handle_client(Socket client);
    void wait_for_clients();

    uint16_t port_;
    int backlog_;
    std::atomic<bool> running_;
    Socket server_socket_;
    std::string prefix_;

    std::mutex clients_mutex_;
    std::vector<std::thread> client_threads_;
};

} // namespace net