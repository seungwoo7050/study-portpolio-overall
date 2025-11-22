#include "socket.h"

#include <arpa/inet.h>  // for htons, inet_pton
#include <netinet/in.h> // for sockaddr_in
#include <sys/socket.h> // for socket, bind, listen, accept, setsockopt
#include <unistd.h>     // for close, shutdown, read, write

#include <cstddef>      // for std::size_t
#include <cerrno>       // for errno
#include <cstring>      // for std::memset
#include <system_error> // for std::system_error, std::generic_category

namespace net {
namespace {
[[noreturn]] void throw_system_error(const char *action) {
    throw std::system_error(errno, std::generic_category(), action);
}
}   // namespace

SocketError::SocketError(const std::string &message): std::runtime_error(message) {}

Socket::Socket() noexcept : fd_(-1) {}

Socket::Socket(int fd) noexcept: fd_(fd) {}

Socket::Socket(Socket &&other) noexcept: fd_(other.fd_) {
    other.fd_ = -1;
}

Socket &Socket::operator=(Socket &&other) noexcept {
    if (this != &other) {
        close();
        fd_ = other.fd_;
        other.fd_ = -1;
    }
    return *this;
}

Socket::~Socket() {
    close();
}

Socket Socket::create_tcp() {
    int fd = ::socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        throw_system_error("socket");
    }
    return Socket(fd);
}

bool Socket::is_valid() const noexcept {
    return fd_ >= 0;
}

int Socket::native_handle() const noexcept {
    return fd_;
}

void Socket::close() noexcept {
    if (fd_ >= 0) {
        ::close(fd_);
        fd_ = -1;
    }
}

void Socket::shutdown(int how) noexcept {
    if (fd_ >= 0) {
        ::shutdown(fd_, how);
    }
}

void Socket::set_reuse_address(bool enable) const {
    if (fd_ < 0) {
        throw SocketError("Attempted to set option on invalid socket");
    }
    int value = enable ? 1 : 0;
    if (::setsockopt(fd_, SOL_SOCKET, SO_REUSEADDR, &value, sizeof(value)) < 0) {
        throw_system_error("setsockopt(SO_REUSEADDR)");
    }
}

void Socket::bind(uint16_t port, const char *address) const {
    if (fd_ < 0) {
        throw SocketError("Attempted to bind invalid socket");
    }

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    if (address) {
        in_addr_t parsed = ::inet_addr(address);
        if (parsed == INADDR_NONE && std::strcmp(address, "255.255.255.255") != 0) {
            throw SocketError("Invalid IPv4 address");
        }
        addr.sin_addr.s_addr = parsed;
    } else {
        addr.sin_addr.s_addr = htonl(INADDR_ANY);
    }

    if (::bind(fd_, reinterpret_cast<sockaddr *>(&addr), sizeof(addr)) < 0) {
        throw_system_error("bind");
    }
}

void Socket::listen(int backlog) const {
    if (fd_ < 0) {
        throw SocketError("Attempted to listend on invalid socket");
    }

    if (::listen(fd_, backlog) < 0) {
        throw_system_error("listen");
    }
}

Socket Socket::accept() const {
    if (fd_ < 0) {
        throw SocketError("Attempted to accept on invalid socket");
    }

    while (true) {
        int client_fd = ::accept(fd_, nullptr, nullptr);
        if (client_fd < 0) {
            if (errno == EINTR) {
                continue;
            }
            throw_system_error("accept");
        }
        return Socket(client_fd);
    }
}

std::size_t Socket::send_all(const void *buffer, std::size_t length) const {
    if (fd_ < 0) {
        throw SocketError("Attempted to send on invalid socket");
    }

    const auto *data = static_cast<const std::byte *>(buffer);
    std::size_t total_sent = 0;
    while (total_sent < length) {
        ssize_t sent = ::send(fd_, data + total_sent, length - total_sent, 0);
        if (sent < 0) {
            if (errno == EINTR) {
                continue;
            }
            throw_system_error("send");
        }
        if (sent == 0) {
            break;
        }
        total_sent += static_cast<std::size_t>(sent);
    }
    return total_sent;
}

std::size_t Socket::receive(void *buffer, std::size_t length) const {
    if (fd_ < 0) {
        throw SocketError("Attempted to receive on invalid socket");
    }

    while (true) {
        ssize_t received = ::recv(fd_, buffer, length, 0);
        if (received < 0) {
            if (errno == EINTR) {
                continue;
            }
            throw_system_error("recv");
        }
        return static_cast<std::size_t>(received);
    }
}

} // namespace net

// 이름 없는 namespace: 내부 구현 세부 사항을 캡슐화하는 데 사용됩니다. 이는 해당 네임스페이스 내의 함수와 변수가 외부에 노출되지 않도록 하여 충돌을 방지하고 코드의 모듈성을 향상시킵니다. 이름 없는 네임스페이스를 사용할 때는 해당 네임스페이스가 파일 내에서만 사용된다는 점을 명확히 이해하는 것이 중요합니다.
// [[noreturn]]: 함수가 반환하지 않는다는 것을 나타내기 위해 [[noreturn]] 속성을 사용하는 것이 좋습니다. 이는 컴파일러에게 해당 함수가 종료되지 않는다는 것을 알리며, 코드 분석 및 최적화에 도움이 됩니다. 이러한 함수는 일반적으로 예외를 던지거나 프로그램을 종료하는 역할을 합니다.
// '::': 전역 네임스페이스 연산자(::)는 특정 식별자가 전역 네임스페이스에 속함을 명시적으로 나타내기 위해 사용됩니다. 이는 특히 동일한 이름의 식별자가 여러 네임스페이스에 존재할 때 유용합니다. 예를 들어, net::socket()과 전역 socket() 함수를 구분할 때 사용됩니다.
// native_handle: 네이티브 핸들은 운영 체제 수준의 리소스를 나타내는 정수 값입니다. 소켓, 파일 디스크립터 등과 같은 리소스를 직접 조작할 때 사용됩니다. 네이티브 핸들을 사용할 때는 해당 리소스의 수명 관리에 주의해야 하며, 적절한 시점에 해제해야 합니다.