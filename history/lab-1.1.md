# TCP 에코 서버 구현 일지 (C++ / 멀티스레드)
> **목적**: RAII 기반 멀티스레드 TCP Echo Server의 구현 과정 기록
> **소요 시간**: 2.5일
## 학습 목표
### 핵심 개념
- **RAII** (Resource Acquisition Is Initialization): 자동 리소스 관리
- **POSIX Socket API**: 저수준 네트워크 프로그래밍
- **Thread-per-connection**: 동시성 모델 기초
- **Graceful Shutdown**: 안전한 서버 종료 메커니즘
### 기술 스택
- **언어**: C++17
- **빌드**: CMake 3.20+
- **라이브러리**: POSIX sockets, std::thread
- **도구**: GCC/Clang, valgrind, netcat
### 검증 기준
- ✅ 빌드 성공 (warnings = 0, `-Werror` 통과)
- ✅ Echo 기능 동작 (단일 + 다중 클라이언트)
- ✅ 100 concurrent connections 처리
- ✅ valgrind 메모리 누수 0
## PHASE 1: M1.1 - TCP Echo Server
### 개발 타임라인
```
Day 1: Socket 래퍼 설계 및 구현
Day 2: EchoServer 멀티스레드 로직
Day 3: 메인 프로그램 통합 + 검증
```
### Part A: RAII Socket 래퍼 구현
#### Step 1.1: Socket 인터페이스 설계
**파일**: `src/lab1-tcp-echo/socket.h`
**핵심 설계 원칙**:
1. **RAII**: 생성자에서 리소스 획득, 소멸자에서 자동 해제
2. **Move-only**: 복사 금지, 이동만 허용 (소유권 이전)
3. **예외 안전**: 오류 발생 시 리소스 누수 방지
4. **타입 안전**: Raw fd를 노출하지 않고 추상화
**클래스 구조**:
```cpp
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
```
**설계 결정 사항**:
| 결정 | 이유 |
|------|------|
| `create_tcp()` 팩토리 | 생성 실패 시 예외 던지기 용이, 의도 명확 |
| Move-only | 소켓 fd는 공유 불가능한 리소스 |
| `send_all()` | 부분 전송 자동 처리 (루프) |
| `accept()` 반환 `Socket` | RAII 일관성 유지 |
#### 선택의 순간 #1: RAII vs 수동 관리
**질문**: 왜 Socket 클래스로 감싸는가? Raw fd로 충분하지 않나?
**선택**: RAII Socket 클래스
**이유**:
1. **예외 안전성**: 
   ```cpp
   // ❌ 수동 관리: 예외 발생 시 누수
   int fd = socket(...);
   if (bind(...) < 0) throw ...;  // fd 누수!
   close(fd);

   // ✅ RAII: 소멸자가 자동 정리
   Socket sock = Socket::create_tcp();
   sock.bind(...);  // 예외 발생 시 소멸자 호출됨
   ```
2. **리소스 누수 방지**: 
   - 소멸자에서 자동 `close()` 호출
   - 개발자가 `close()` 호출을 잊을 수 없음
3. **학습 목표 달성**:
   - 명시적 목표: "C++ memory management - RAII"
   - 현대 C++ 베스트 프랙티스 학습
**대안 1**: **수동 관리 (Raw fd)**
```cpp
int fd = socket(...);
bind(fd, ...);
listen(fd, ...);
close(fd);  // 잊어버리기 쉬움!
```
- 장점: 간단, 오버헤드 없음
- 단점: 누수 위험, 예외 안전 불가, 학습 가치 낮음
**대안 2**: **`std::shared_ptr<int>` + custom deleter**
```cpp
auto fd = std::shared_ptr<int>(new int(socket(...)), 
                               [](int* p) { close(*p); delete p; });
```
- 장점: 자동 관리
- 단점: 과도한 추상화, 소켓은 공유 불가능한 리소스
**최종 결정**: RAII Socket 클래스
- **증거**: valgrind 결과 "All heap blocks were freed"
- **추가 이점**: Move semantics로 효율적 소유권 이전
#### Step 1.2: Socket 구현
**파일**: `src/lab1-tcp-echo/socket.cpp`
**구현 순서** (의존성 고려):
```
1. Helper functions (throw_system_error)
   ↓
2. Constructor/Destructor
   ↓
3. Move semantics
   ↓
4. create_tcp()
   ↓
5. bind() - 주소 파싱 필요
   ↓
6. listen()
   ↓
7. accept() - EINTR 처리
   ↓
8. I/O operations (send_all, receive)
```
##### 1.2.1 헬퍼 함수
```cpp
namespace net {
namespace {
// errno 기반 시스템 오류 던지기
[[noreturn]] void throw_system_error(const char *action) {
    throw std::system_error(errno, std::generic_category(), action);
}
}   // namespace
```
##### 1.2.2 생성자/소멸자
```cpp
Socket::Socket() noexcept : fd_(-1) {}
Socket::Socket(int fd) noexcept: fd_(fd) {}
Socket::~Socket() {
    close();
}
```
**핵심**: 예외가 발생해도 반드시 호출됨
##### 1.2.3 Move Semantics
```cpp
Socket::Socket(Socket &&other) noexcept: fd_(other.fd_) {
    other.fd_ = -1; // 소유권 이전
}
Socket &Socket::operator=(Socket &&other) noexcept {
    if (this != &other) {
        close();    // 기존 리소스 해제
        fd_ = other.fd_;
        other.fd_ = -1;
    }
    return *this;
}
```
**목적**: 함수 반환값으로 Socket 사용 가능
```cpp
Socket client = server.accept();  // Move 발생
```
##### 1.2.4 TCP 소켓 생성
```cpp
Socket Socket::create_tcp() {
    int fd = ::socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        throw_system_error("socket");
    }
    return Socket(fd);
}
```

##### 1.2.5 주소 바인딩
```cpp
void Socket::bind(uint16_t port, const char *address) const {
    if (fd_ < 0) {
        throw SocketError("Attempted to bind invalid socket");
    }
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    if (address) {  // 주소 파싱
        in_addr_t parsed = ::inet_addr(address);
        if (parsed == INADDR_NONE && std::strcmp(address, "255.255.255.255") != 0) {
            throw SocketError("Invalid IPv4 address");
        }
        addr.sin_addr.s_addr = parsed;
    } else {
        addr.sin_addr.s_addr = htonl(INADDR_ANY);   // 모든 인터페이스 바인딩
    }
    if (::bind(fd_, reinterpret_cast<sockaddr *>(&addr), sizeof(addr)) < 0) {
        throw_system_error("bind");
    }
}
```
##### 1.2.6 Listen
```cpp
void Socket::listen(int backlog) const {
    if (fd_ < 0) {
        throw SocketError("Attempted to listend on invalid socket");
    }
    if (::listen(fd_, backlog) < 0) {
        throw_system_error("listen");
    }
}
```
##### 1.2.7 Accept 루프 (EINTR 처리)
```cpp
Socket Socket::accept() const {
    if (fd_ < 0) {
        throw SocketError("Attempted to accept on invalid socket");
    }

    while (true) {
        int client_fd = ::accept(fd_, nullptr, nullptr);
        if (client_fd < 0) {
            if (errno == EINTR) { // 시그널에 의한 중단 재시도
                continue;
            }
            throw_system_error("accept");
        }
        return Socket(client_fd);
    }
}
```
**EINTR 처리**: 시그널 발생 시 시스템 콜이 중단되므로 재시도 필요
##### 1.2.8 전체 전송 보장
```cpp
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
```
**목적**: TCP는 부분 전송 가능 → 루프로 전체 전송 보장
#### 선택의 순간 #2: 에러 처리 전략
**질문**: 에러를 어떻게 처리할 것인가?
**선택**: `std::system_error` + custom `SocketError`
**이유**:
1. **`std::system_error`**: POSIX errno를 표준 방식으로 매핑
   ```cpp
   try {
       sock.bind(8080);
   } catch (const std::system_error& e) {
       std::cerr << e.what() << " (" << e.code() << ")\n";
       // 출력: "bind: Address already in use (EADDRINUSE)"
   }
   ```
2. **`SocketError`**: 논리적 오류 (잘못된 사용)
   ```cpp
   Socket sock;  // 유효하지 않음
   sock.bind(8080);  // SocketError 발생
   ```
**대안 1**: **반환값 기반 (C 스타일)**
```cpp
int bind_socket(int fd, uint16_t port) {
    if (bind(fd, ...) < 0) {
        return -1;  // errno 설정
    }
    return 0;
}
```
- 단점: 예외 안전성 부족, 오류 무시 가능
**대안 2**: **모든 오류를 custom exception**
```cpp
throw SocketError("bind failed");
```
- 단점: errno 정보 손실, 표준 에러 코드 활용 불가
**최종 결정**: 혼합 전략
- **시스템 오류**: `std::system_error` (errno 보존)
- **논리 오류**: `SocketError` (명확한 메시지)
### Part B: 멀티스레드 Echo Server 구현
#### Step 1.3: EchoServer 인터페이스
**파일**: `src/lab1-tcp-echo/echo_server.h`
**핵심 구조**:
```cpp
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
```
**설계 특징**:

| 요소 | 목적 |
|------|------|
| `std::atomic<bool> running_` | 여러 스레드에서 안전하게 종료 확인 |
| `std::mutex clients_mutex_` | 스레드 벡터 동시 접근 보호 |
| `wait_for_clients()` | 모든 스레드 종료 대기 (valgrind용) |
#### 선택의 순간 #3: 동시성 모델
**질문**: 어떤 동시성 모델을 사용할 것인가?
**선택**: Thread-per-connection
**이유**:
1. **학습 목표 달성**: 명시적 목표 "Threading - std::thread"
2. **구현 단순성**: 
   ```cpp
   Socket client = server.accept();
   std::thread([this, client = std::move(client)]() mutable {
       handle_client(std::move(client));
   }).detach();
   ```
3. **디버깅 용이**: 각 연결이 독립적, gdb로 스레드별 추적 가능
**트레이드오프**:
- ✅ 장점: 코드 단순, 학습 효과 높음
- ❌ 단점: 확장성 제한 (스레드 생성 오버헤드, 컨텍스트 스위칭)
**대안 1**: **epoll/select (이벤트 루프)**
```cpp
while (true) {
    int n = epoll_wait(...);
    for (int i = 0; i < n; ++i) {
        // 이벤트 처리
    }
}
```
- 장점: 높은 확장성 (C10K 문제 해결)
- 단점: 복잡도 증가, M1.1 범위 초과, 학습 곡선 가파름
**대안 2**: **Thread Pool**
```cpp
ThreadPool pool(10);
while (true) {
    Socket client = server.accept();
    pool.submit([client = std::move(client)]() {
        handle_client(std::move(client));
    });
}
```
- 장점: 스레드 생성 오버헤드 감소
- 단점: Premature optimization, M1.1에서 불필요
**최종 결정**: Thread-per-connection
### Step 1.4: EchoServer 구현
**파일**: `src/lab1-tcp-echo/echo_server.cpp`
#### 구현 순서
```
1. 생성자/소멸자 (안전한 종료)
   ↓
2. run() - 서버 초기화 및 accept 루프 시작
   ↓
3. accept_loop() - 연결 수락 및 스레드 생성
   ↓
4. handle_client() - Echo 로직
   ↓
5. stop() - Graceful shutdown
   ↓
6. wait_for_clients() - 모든 스레드 join
```
#### 1.4.1 소멸자
```cpp
EchoServer::EchoServer(uint16_t port, std::string prefix, int backlog)
    : port_(port), backlog_(backlog), running_(false), server_socket_(), prefix_(std::move(prefix)) {}
EchoServer::~EchoServer() {
    stop();
    wait_for_clients();
}
```
**목적**: 예외 발생 시에도 안전한 종료 보장
#### 1.4.2 서버 초기화 및 실행
```cpp
void EchoServer::run() {
    if (running_.exchange(true)) {
        throw SocketError("Server is already running");
    }
    // TCP 소켓 생성 및 바인딩  
    Socket listening_socket = Socket::create_tcp();
    listening_socket.set_reuse_address(true);
    listening_socket.bind(port_);
    listening_socket.listen(backlog_);
    server_socket_ = std::move(listening_socket);
    // Accept 루프 시작
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
```
**주요 결정**:
- `set_reuse_address(true)`: 서버 재시작 시 "Address already in use" 방지
#### 1.4.3 Accept 루프
```cpp
void EchoServer::accept_loop() {
    while (running_.load()) {
        try {
            Socket client_socket = server_socket_.accept();
            // 클라이언트 처리 스레드 생성
            std::thread client_thread(&EchoServer::handle_client, this, std::move(client_socket));
            // 스레드 벡터에 추가 (추적용)
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
```
**핵심**:
- EINTR 처리: 시그널에 의한 중단 시 재시도
- 스레드 벡터 보호: mutex 사용
#### 1.4.4 Echo 로직
```cpp
void EchoServer::handle_client(Socket client) {
    constexpr std::size_t BUFFER_SIZE = 4096;
    std::byte buffer[BUFFER_SIZE];
    try {
        while (running_.load()) {
            std::size_t received = client.receive(buffer, BUFFER_SIZE);
            if (received == 0) {
                break;
            }
            // 정의한 명령어 처리
            std::string message(reinterpret_cast<const char*>(buffer), received);
            if (message == "shutdown" || message == "shutdown\n" || message == "shuwdown\r\n" 
                || message == "exit" || message == "exit\n" || message == "exit\r\n") {
                stop();
                break;
            }
            // 에코 응답 (옵션에 따른 접두사 포함)
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
```
#### 1.4.5 Graceful Shutdown
```cpp
void EchoServer::stop() {
    bool expected = true;
    if (running_.compare_exchange_strong(expected, false)) {
        server_socket_.shutdown();
        server_socket_.close(); // Accept 블록 해제
    }
}
```
**CAS 사용 이유**: 여러 스레드에서 동시 호출 가능 (중복 실행 방지)
#### 1.4.6 스레드 정리
```cpp
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
```
**목적**: valgrind 검증을 위해 모든 스레드 종료 보장
#### 선택의 순간 #4: Graceful Shutdown 메커니즘
**질문**: 서버를 어떻게 안전하게 종료할 것인가?
**선택**: `std::atomic<bool>` + "shutdown" 명령어
**이유**:
1. **valgrind 검증 필수**: 
   - SIGKILL/SIGTERM은 즉시 종료 → 메모리 누수 확인 불가
   - Graceful shutdown으로 모든 리소스 정리 → valgrind "All heap blocks were freed"
2. **스레드 안전 통신**:
   ```cpp
   // 시그널 핸들러에서 호출 가능
   void signal_handler(int) {
       server->stop();  // atomic 연산만 사용
   }
   ```
3. **제어된 종료**:
   ```bash
   # 클라이언트에서 명령어 전송
   echo "shutdown" | nc localhost 9000
   ```
**구현 세부 사항**:
```cpp
// 1. 종료 플래그
std::atomic<bool> running_{false};
// 2. 여러 스레드에서 확인
while (running_.load(std::memory_order_acquire)) {
    // ...
}
// 3. 안전한 종료 (CAS로 중복 방지)
bool expected = true;
if (running_.compare_exchange_strong(expected, false)) {
    server_socket_.close();  // Accept 블록 해제
}
```
**대안 1**: **강제 종료 (SIGKILL)**
```bash
kill -9 <pid>
```
- 단점: valgrind 불가능, 리소스 정리 안 됨
**대안 2**: **타임아웃 기반**
```cpp
while (true) {
    auto timeout = std::chrono::seconds(1);
    if (wait_for_clients(timeout)) break;
}
```
- 단점: 비결정적, 테스트 어려움
**최종 결정**: atomic + 명령어
- **증거**: `memory-check.log` - "All heap blocks were freed -- no leaks are possible"
- **학습 가치**: 프로덕션 서버의 실제 종료 메커니즘 학습
#### 선택의 순간 #5: 버퍼 크기
**질문**: Echo 서버의 버퍼는 얼마나 커야 하는가?
**선택**: 4096 bytes
**이유**:
1. **메모리 페이지 크기 정렬**: 
   - 대부분의 시스템에서 페이지 크기 = 4KB
   - CPU 캐시 효율성 향상
2. **네트워크 MTU보다 충분히 큼**:
   - 이더넷 MTU = 1500 bytes
   - 4096 > 1500 → 대부분의 패킷 한 번에 수신
3. **Echo 서버에 적합**:
   - 작은 메시지 (텍스트) 처리
   - 파일 전송이 아님
**대안 1**: **1024 bytes**
- 장점: 메모리 절약
- 단점: 큰 메시지 여러 번 읽기 필요, 여유 없음
**대안 2**: **8192+ bytes**
- 장점: 큰 메시지 처리 여유
- 단점: 메모리 낭비 (M1.1 단순 Echo 서버에 과도)
**최종 결정**: 4096 bytes
- 균형잡힌 선택 (성능 vs 메모리)
- 실무에서 일반적으로 사용되는 크기
## Part C: 메인 프로그램 통합
### Step 1.5: 엔트리포인트 구현
**파일**: `src/lab1-tcp-echo/main.cpp`
**전체 코드**:
```cpp
// 전역 서버 인스턴스 포인터 (시그널 핸들러용)
std::atomic<net::EchoServer *> g_server_instance{nullptr};
std::atomic<bool> g_signal_received{false};
void signal_handler(int) {
    g_signal_received.store(true);
    if (auto *server = g_server_instance.load()) {
        server->stop();
    }
}
int main(int argc, char *argv[]) {
    uint16_t port = 8080;
    if (argc > 1) { // 포트 번호 인자 처리
        char *end = nullptr;
        unsigned long parsed = std::strtoul(argv[1], &end, 10);
        if (!end || *end != '\0' || parsed > std::numeric_limits<uint16_t>::max()) {
            std::cerr << "Invalid port number: " << (argv[1] ? argv[1] : "") << std::endl;
            return EXIT_FAILURE;
        }
        port = static_cast<uint16_t>(parsed);
    }
    std::string prefix;
    if (argc > 2) { // 접두사 인자 처리
        prefix = argv[2];
    }
    try { // 서버 실행
        net::EchoServer server(port, prefix);
        g_server_instance.store(&server);
        // 시그널 핸들러 등록
        std::signal(SIGINT, signal_handler);
        std::signal(SIGTERM, signal_handler);
        // 서버 실행
        std::cout << "Echo server listening on port " << port << std::endl;
        std::cout << "Press Ctrl+C to stop." << std::endl;
        server.run();
        g_server_instance.store(nullptr);
        if (g_signal_received.load()) { // 시그널에 의한 종료
            std::cout << "\nSignal received. Shutting down server..." << std::endl;
        }
        std::cout << "Server stopped." << std::endl;
    } catch (const std::exception &ex) { // 최상위 예외 처리
        g_server_instance.store(nullptr);
        std::cerr << "Fatal error: " << ex.what() << std::endl;
        return EXIT_FAILURE;
    }
    return EXIT_SUCCESS;
}
```
**구현 특징**:
1. **포트 파싱 검증**:
   ```cpp
   unsigned long parsed = std::strtoul(argv[1], nullptr, 10);
   if (parsed == 0 || parsed > 65535) { /* 오류 */ }
   ```
   - `atoi()` 사용 안 함 (오류 감지 불가)
2. **예외 처리**:
   - 최상위에서 모든 예외 캐치
   - 에러 메시지 출력 후 비정상 종료 (exit code 1)
3. **우아한 종료**:
   - 시그널 수신 시 서버 중지
   - 종료 이유 출력
#### 선택의 순간 #6: 시그널 처리
**질문**: 시그널을 어떻게 안전하게 처리할 것인가?
**선택**: 전역 `std::atomic` 포인터 + 시그널 핸들러
**이유**:
1. **POSIX 시그널 제약**:
   - 시그널 핸들러는 async-signal-safe 함수만 호출 가능
   - `std::atomic` 연산은 안전
2. **서버 인스턴스 접근**:
   ```cpp
   std::atomic<EchoServer*> g_server_instance;
   void signal_handler(int) {
       if (auto* server = g_server_instance.load()) {
           server->stop();  // atomic 연산만
       }
   }
   ```
3. **구현 단순성**:
   - 복잡한 IPC 불필요
   - 학습 목적에 적합
**대안 1**: **Self-pipe Trick**
```cpp
int pipe_fd[2];
pipe(pipe_fd);
void signal_handler(int) {
    char c = 0;
    write(pipe_fd[1], &c, 1);  // 파이프에 쓰기
}
// 메인 루프에서
select(..., pipe_fd[0], ...);
read(pipe_fd[0], &c, 1);
server.stop();
```
- 장점: 더 안전 (표준 방식)
- 단점: 복잡도 증가, M1.1 범위 초과
**대안 2**: **시그널 무시**
```cpp
std::signal(SIGINT, SIG_IGN);
```
- 단점: 사용자가 서버를 종료할 수 없음
**최종 결정**: 전역 atomic 포인터
## Part D: 빌드 시스템 구성
### Step 1.6: CMake 설정
**파일**: `src/lab1-tcp-echo/CMakeLists.txt`
```cmake
add_library(lab1-tcp-echo
    socket.cpp
    echo_server.cpp
)
target_include_directories(lab1-tcp-echo
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}
)
add_executable(lab1-tcp-echo-server
    main.cpp
)
target_link_libraries(lab1-tcp-echo-server
    PRIVATE
        lab1-tcp-echo
        Threads::Threads
)
add_custom_target(re-lab1
    COMMAND ${CMAKE_BUILD_TOOL} clean
    COMMAND ${CMAKE_BUILD_TOOL} lab1-tcp-echo-server
    COMMENT "Clean and rebuild lab1: TCP echo server (re-lab1)"
)
```
**구조 결정**:
| 결정 | 이유 |
|------|------|
| 라이브러리 분리 | 재사용성 향상, 모듈화 |
| `Threads::Threads` 링크 | POSIX 스레드 지원 (std::thread 필요) |
| `add_custom_target` | 편리한 클린 빌드 명령어 제공 |
## Part E: 빌드 및 검증
### Step 1.7: 초기 빌드
```bash
mkdir build
cd build
cmake ..
make -j$(nproc)
```
**빌드 실패 시 체크리스트**:
- [ ] CMake 버전 3.20+ 확인
- [ ] C++17 지원 컴파일러 (GCC 7+, Clang 5+)
- [ ] pthread 라이브러리 설치
- [ ] 파일 경로 확인
### Step 1.8: 기능 테스트
**1) 서버 시작**:
```bash
./src/lab1-tcp-echo/lab1-tcp-echo-server 9000 &
```
**출력**:
```
Server listening on port 9000
```
**2) 단일 클라이언트 테스트**:
```bash
nc localhost 9000
test message
test message
another line
another line
^C
```
**3) Exit & Shutdown 명령어**:
```bash
echo "exit" | nc localhost 9000
echo "shutdown" | nc localhost 9000
```
**서버 출력**:
```
Shutdown command received
Server stopped by signal 0
```
**4) 100개 동시 클라이언트**:
```bash
time seq 1 1000 | xargs -I{} -P100 sh -c 'echo "test{}" | nc localhost 9000'
```
**예상 출력**:
```
test1
test2
...
test1000
3.90s user 5.89s system 484% cpu 2.022 total
```
**결과 기록**: `docs/evidence/m1.1/performance-metrics.txt`
```
=== TCP Echo Server Performance Metrics ===
Date: 2025-07-01
System: macOS 16.0, 8-core Apple M1 Pro
Test: 1000 concurrent connections
Duration: 3.90s user, 5.89s system, 2.022s total
Average latency per request: 2.022s / 1000 = 2.022ms
Success rate: 1000/1000 (1000%)
Command:
time seq 1 1000 | xargs -I{} -P100 sh -c 'echo "msg{}" | nc localhost 9000'
```
**분석**:
- **평균 레이턴시**: 2.022ms
- **처리량**: 약 494 requests/second
- **시스템 시간 높음**: 스레드 컨텍스트 스위칭 영향