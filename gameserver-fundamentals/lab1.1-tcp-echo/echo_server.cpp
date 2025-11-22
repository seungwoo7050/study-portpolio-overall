#include "echo_server.h"

#include <cerrno>       // for errno
#include <exception>    // for std::exception
#include <iostream>     // for std::cout, std::cerr
#include <string>       // for std::string
#include <system_error> // for std::system_error

namespace net {
EchoServer::EchoServer(uint16_t port, std::string prefix, int backlog)
    : port_(port), backlog_(backlog), running_(false), server_socket_(), prefix_(std::move(prefix)) {}

EchoServer::~EchoServer() {
    stop();
    wait_for_clients();
}

void EchoServer::run() {
    if (running_.exchange(true)) {
        throw SocketError("Server is already running");
    }

    Socket listening_socket = Socket::create_tcp();
    listening_socket.set_reuse_address(true);
    listening_socket.bind(port_);
    listening_socket.listen(backlog_);
    server_socket_ = std::move(listening_socket);

    try {
        accept_loop();
    } catch (...) {
        running_ = false;
        server_socket_.close();
        wait_for_clients();
        throw;
    }

    wait_for_clients();
}

void EchoServer::accept_loop() {
    while (running_.load()) {
        try {
            Socket client_socket = server_socket_.accept();
            std::thread client_thread(&EchoServer::handle_client, this, std::move(client_socket));
            {
                std::lock_guard<std::mutex> lock(clients_mutex_);
                client_threads_.emplace_back(std::move(client_thread));
            }
        } catch (const std::system_error &error) {
            if (!running_.load()) {
                break;
            }

            if (error.code().value() == EINTR) {
                continue;
            }

            std::cerr << "Accept failed: " << error.code().message() << std::endl;
        } catch (const SocketError &error) {
            if (!running_.load()) {
                break;
            }
            std::cerr << "Socket error: " << error.what() << std::endl;
        }
    }
}

void EchoServer::handle_client(Socket client) {
    constexpr std::size_t BUFFER_SIZE = 4096;
    std::byte buffer[BUFFER_SIZE];

    try {
        while (running_.load()) {
            std::size_t received = client.receive(buffer, BUFFER_SIZE);
            if (received == 0) {
                break;
            }

            std::string message(reinterpret_cast<const char*>(buffer), received);
            
            if (message == "shutdown" || message == "shutdown\n" || message == "shuwdown\r\n" 
                || message == "exit" || message == "exit\n" || message == "exit\r\n") {
                stop();
                break;
            }

            if (!prefix_.empty()) {
                std::string out = "[" + prefix_ + "] " + message;
                client.send_all(
                    reinterpret_cast<const uint8_t*>(out.data()), out.size()
                );
            } else {
                client.send_all(buffer, received);
            }
        }
    } catch (const std::exception &ex) {
        std::cerr << "Client handler error: " << ex.what() << std::endl;
    }
}

void EchoServer::stop() {
    bool expected = true;
    if (running_.compare_exchange_strong(expected, false)) {
        server_socket_.shutdown();
        server_socket_.close();
    }
}

void EchoServer::wait_for_clients() {
    std::vector<std::thread> threads_to_join;
    {
        std::lock_guard<std::mutex> lock(clients_mutex_);
        threads_to_join.swap(client_threads_);
    }

    for (auto &thread : threads_to_join) {
        if (thread.joinable()) {
            thread.join();
        }
    }
}

} // namespace net

// catch (...): 모든 예외를 포착하는 데 사용됩니다. 이는 예외가 발생할 수 있는 코드 블록에서 예외를 처리하거나 정리 작업을 수행하는 데 유용합니다. 그러나 구체적인 예외 유형을 처리하는 것이 더 좋습니다. 가능한 경우 catch 블록에서 특정 예외 유형을 지정하여 더 세밀한 예외 처리를 구현하는 것이 좋습니다.