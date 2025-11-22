#pragma once

#include <cstddef>      // for std::size_t
#include <cstdint>      // for uint16_t
#include <stdexcept>    // for std::runtime_error
#include <string>       // for std::string

#include <sys/socket.h> // for SHUT_RDWR, SOMAXCONN

namespace net {
class SocketError: public std::runtime_error {
public:
    explicit SocketError(const std::string &message);
};

class Socket {
public:
    Socket() noexcept;
    explicit Socket(int fd) noexcept;
    Socket(const Socket &other) = delete;
    Socket &operator=(const Socket &other) = delete;
    Socket(Socket &&other) noexcept;
    Socket &operator=(Socket &&other) noexcept;
    ~Socket();

    static Socket create_tcp();

    [[nodiscard]] bool is_valid() const noexcept;
    [[nodiscard]] int native_handle() const noexcept;

    void close() noexcept;
    void shutdown(int how = SHUT_RDWR) noexcept;
    void set_reuse_address(bool enable) const;
    void bind(uint16_t port, const char *address = nullptr) const;
    void listen(int backlog = SOMAXCONN) const;
    Socket accept() const;

    std::size_t send_all(const void *buffer, std::size_t length) const;
    std::size_t receive(void *buffer, std::size_t length) const;

private:
    int fd_;
};

} // namespace net

// namespace: 네임스페이스는 관련된 클래스와 함수를 그룹화하는 데 사용됩니다. 이를 통해 이름 충돌을 방지하고 코드의 가독성을 높일 수 있습니다. 네임스페이스를 사용할 때는 명확한 이름을 선택하고, 필요에 따라 중첩 네임스페이스를 사용하는 것이 좋습니다.
// explicit: 단일 인자 생성자와 변환 연산자에는 기본적으로 explicit 키워드를 사용하는 것이 좋습니다. 이는 암묵적 변환을 방지하여 코드의 명확성을 높이고, 의도하지 않은 버그를 줄이는 데 도움이 됩니다.
// noexcept: 예외가 발생하지 않는다는 것을 명시적으로 나타내기 위해 noexcept 키워드를 사용하는 것이 좋습니다. 이는 성능 최적화에 도움이 될 수 있으며, 함수가 예외를 던지지 않는다는 것을 컴파일러와 다른 개발자에게 명확히 전달합니다.
// [[nodiscard]]: 함수의 반환 값을 반드시 사용해야 한다는 것을 나타내기 위해 [[nodiscard]] 속성을 사용하는 것이 좋습니다. 이는 반환 값을 무시하는 실수를 방지하는 데 도움이 됩니다.
// using: 특정 네임스페이스의 이름을 사용할 때는 using 선언을 최소한으로 제한하는 것이 좋습니다. 예를 들어, 함수 내부나 특정 블록 내에서만 using을 사용하여 전역 네임스페이스 오염을 방지하는 것이 좋습니다.