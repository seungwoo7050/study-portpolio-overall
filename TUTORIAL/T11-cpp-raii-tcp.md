# T11: Modern C++17 + RAII + TCP 소켓

> **목표**: Modern C++ 기초와 네트워크 프로그래밍 완전 정복
> **예상 시간**: 15-20시간 (주 7-10시간)
> **난이도**: 🟠 고급
> **선행 요구사항**: [T10: C++ 기초](./T10-cpp-basics.md)
> **적용 프로젝트**: game-server lab1.1-1.2
> **퀄리티 보장**: 안전한 코드, RAII 패턴, 실행 서버
> **효율성 보장**: 단계적 학습, 실습 프로젝트, 디버깅 팁

---

## 목차

1. [Modern C++17 기초](#1-modern-c17-기초)
2. [RAII 패턴](#2-raii-패턴)
3. [Smart Pointers](#3-smart-pointers)
4. [Move Semantics](#4-move-semantics)
5. [멀티스레딩](#5-멀티스레딩)
6. [TCP 소켓 프로그래밍](#6-tcp-소켓-프로그래밍)
7. [에코 서버 구현](#7-에코-서버-구현)
8. [트러블슈팅](#8-트러블슈팅)
9. [프로젝트 적용](#9-프로젝트-적용)
10. [공통 오류와 해결](#10-공통-오류와-해결)
11. [퀴즈 및 다음 단계](#11-퀴즈-및-다음-단계)
12. [추가 리소스](#12-추가-리소스)

---

## 1. Modern C++17 기초

### 1.1 auto 키워드

```cpp
// C++11 이전
std::vector<int>::iterator it = vec.begin();

// ✅ C++11 이후
auto it = vec.begin();

// 함수 반환 타입 추론
auto add(int a, int b) -> int {
    return a + b;
}

// 람다
auto lambda = [](int x) { return x * 2; };

// 구조화된 바인딩 (C++17)
std::map<std::string, int> scores = {{"Alice", 100}, {"Bob", 90}};

for (const auto& [name, score] : scores) {
    std::cout << name << ": " << score << std::endl;
}
```

---

### 1.2 Range-based for loop

```cpp
std::vector<int> numbers = {1, 2, 3, 4, 5};

// ❌ C 스타일
for (size_t i = 0; i < numbers.size(); ++i) {
    std::cout << numbers[i] << std::endl;
}

// ✅ Range-based for
for (int num : numbers) {
    std::cout << num << std::endl;
}

// 참조로 수정
for (int& num : numbers) {
    num *= 2;
}

// const 참조 (복사 방지)
for (const auto& num : numbers) {
    std::cout << num << std::endl;
}
```

---

### 1.3 Lambda 표현식

```cpp
// 기본 람다
auto add = [](int a, int b) { return a + b; };
int result = add(3, 5); // 8

// 캡처 리스트
int multiplier = 3;

// 값 캡처
auto multiply = [multiplier](int x) { return x * multiplier; };

// 참조 캡처
auto increment = [&multiplier]() { multiplier++; };

// 모든 변수 값 캡처
auto lambda1 = [=](int x) { return x + multiplier; };

// 모든 변수 참조 캡처
auto lambda2 = [&](int x) { multiplier += x; };

// STL 알고리즘과 함께
std::vector<int> nums = {1, 2, 3, 4, 5};
std::transform(nums.begin(), nums.end(), nums.begin(),
               [](int n) { return n * n; });
// nums: {1, 4, 9, 16, 25}

// 조건부 필터링
auto isEven = [](int n) { return n % 2 == 0; };
auto it = std::find_if(nums.begin(), nums.end(), isEven);
```

---

## 2. RAII 패턴

### 2.1 개념

**RAII (Resource Acquisition Is Initialization)**:
- 리소스 획득은 초기화
- 생성자에서 리소스 할당
- 소멸자에서 자동 해제
- 예외 안전성 보장

**문제 (RAII 없이)**:
```cpp
// ❌ 리소스 누수 위험
void processFile() {
    FILE* file = fopen("data.txt", "r");

    // 예외 발생 시 fclose 호출 안 됨
    if (someCondition()) {
        throw std::runtime_error("Error");
    }

    fclose(file); // 실행 안 될 수 있음
}
```

**해결 (RAII 사용)**:
```cpp
// ✅ RAII 래퍼 클래스
class File {
public:
    explicit File(const std::string& filename, const char* mode)
        : file_(fopen(filename.c_str(), mode)) {
        if (!file_) {
            throw std::runtime_error("Failed to open file");
        }
    }

    ~File() {
        if (file_) {
            fclose(file_);
        }
    }

    // 복사 금지
    File(const File&) = delete;
    File& operator=(const File&) = delete;

    // Move는 허용
    File(File&& other) noexcept : file_(other.file_) {
        other.file_ = nullptr;
    }

    FILE* get() const { return file_; }

private:
    FILE* file_;
};

// 사용
void processFile() {
    File file("data.txt", "r");

    // 예외 발생해도 소멸자가 자동으로 fclose 호출
    if (someCondition()) {
        throw std::runtime_error("Error");
    }

    // 명시적 fclose 불필요
}
```

---

### 2.2 실전 예제: 소켓 RAII

```cpp
class Socket {
public:
    Socket() : fd_(-1) {}

    explicit Socket(int domain, int type, int protocol) {
        fd_ = socket(domain, type, protocol);
        if (fd_ < 0) {
            throw std::runtime_error("Failed to create socket");
        }
    }

    ~Socket() {
        close();
    }

    // 복사 금지
    Socket(const Socket&) = delete;
    Socket& operator=(const Socket&) = delete;

    // Move 허용
    Socket(Socket&& other) noexcept : fd_(other.fd_) {
        other.fd_ = -1;
    }

    Socket& operator=(Socket&& other) noexcept {
        if (this != &other) {
            close();
            fd_ = other.fd_;
            other.fd_ = -1;
        }
        return *this;
    }

    void close() {
        if (fd_ >= 0) {
            ::close(fd_);
            fd_ = -1;
        }
    }

    int fd() const { return fd_; }
    bool is_open() const { return fd_ >= 0; }

private:
    int fd_;
};

// 사용
void example() {
    Socket sock(AF_INET, SOCK_STREAM, 0);

    // 예외 발생해도 소멸자가 자동으로 close 호출
    // ...

} // sock 소멸자 자동 호출
```

---

## 3. Smart Pointers

### 3.1 unique_ptr

**개념**: 독점 소유권, 복사 불가, Move 가능

```cpp
#include <memory>

// ❌ Raw pointer (수동 메모리 관리)
int* ptr = new int(42);
delete ptr; // 잊으면 메모리 누수

// ✅ unique_ptr (자동 메모리 관리)
std::unique_ptr<int> ptr = std::make_unique<int>(42);
// 스코프 벗어나면 자동 삭제

// 배열
std::unique_ptr<int[]> arr = std::make_unique<int[]>(10);

// 커스텀 삭제자
auto deleter = [](FILE* f) { if (f) fclose(f); };
std::unique_ptr<FILE, decltype(deleter)> file(
    fopen("data.txt", "r"), deleter
);

// Move (소유권 이전)
std::unique_ptr<int> ptr1 = std::make_unique<int>(10);
std::unique_ptr<int> ptr2 = std::move(ptr1); // ptr1은 nullptr이 됨

// 함수 반환 (자동 Move)
std::unique_ptr<int> createInt() {
    return std::make_unique<int>(42);
}

auto ptr = createInt();
```

---

### 3.2 shared_ptr

**개념**: 공유 소유권, 참조 카운팅

```cpp
// shared_ptr 생성
std::shared_ptr<int> ptr1 = std::make_shared<int>(42);

// 복사 (참조 카운트 증가)
std::shared_ptr<int> ptr2 = ptr1;

std::cout << "Count: " << ptr1.use_count() << std::endl; // 2

// ptr2 해제 (참조 카운트 감소)
ptr2.reset();

std::cout << "Count: " << ptr1.use_count() << std::endl; // 1

// 마지막 shared_ptr이 소멸될 때 메모리 해제

// 실전: 리소스 공유
class Image {
public:
    Image(int width, int height) : width_(width), height_(height) {
        data_ = new uint8_t[width * height];
    }

    ~Image() {
        delete[] data_;
    }

private:
    int width_, height_;
    uint8_t* data_;
};

// 여러 곳에서 동일한 이미지 공유
std::shared_ptr<Image> image = std::make_shared<Image>(1920, 1080);

std::vector<std::shared_ptr<Image>> images;
images.push_back(image); // 참조 카운트 증가
```

---

### 3.3 weak_ptr

**개념**: 순환 참조 방지

```cpp
class Node {
public:
    std::shared_ptr<Node> next;
    std::weak_ptr<Node> prev; // 순환 참조 방지

    ~Node() {
        std::cout << "Node destroyed\n";
    }
};

// 이중 연결 리스트
auto node1 = std::make_shared<Node>();
auto node2 = std::make_shared<Node>();

node1->next = node2;      // shared_ptr
node2->prev = node1;      // weak_ptr (참조 카운트 증가 안 함)

// node1, node2가 스코프 벗어나면 자동 삭제
```

---

## 4. Move Semantics

### 4.1 개념

```cpp
class Buffer {
public:
    explicit Buffer(size_t size) : size_(size), data_(new char[size]) {
        std::cout << "Constructor\n";
    }

    ~Buffer() {
        delete[] data_;
        std::cout << "Destructor\n";
    }

    // 복사 생성자 (비효율적)
    Buffer(const Buffer& other) : size_(other.size_), data_(new char[other.size_]) {
        std::copy(other.data_, other.data_ + size_, data_);
        std::cout << "Copy constructor\n";
    }

    // Move 생성자 (효율적)
    Buffer(Buffer&& other) noexcept
        : size_(other.size_), data_(other.data_) {
        other.size_ = 0;
        other.data_ = nullptr;
        std::cout << "Move constructor\n";
    }

    // Move 할당 연산자
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;

            size_ = other.size_;
            data_ = other.data_;

            other.size_ = 0;
            other.data_ = nullptr;
        }
        return *this;
    }

private:
    size_t size_;
    char* data_;
};

// 사용
Buffer createBuffer() {
    Buffer buf(1024);
    return buf; // RVO 또는 Move
}

Buffer buf = createBuffer(); // Move constructor 호출 (복사 아님!)
```

---

## 5. 멀티스레딩

### 5.1 std::thread

```cpp
#include <thread>
#include <iostream>

void printNumbers(int start, int end) {
    for (int i = start; i <= end; ++i) {
        std::cout << i << " ";
    }
    std::cout << std::endl;
}

int main() {
    // 스레드 생성
    std::thread t1(printNumbers, 1, 5);
    std::thread t2(printNumbers, 6, 10);

    // 스레드 완료 대기
    t1.join();
    t2.join();

    // 람다 사용
    std::thread t3([]() {
        std::cout << "Lambda thread\n";
    });

    t3.join();

    return 0;
}
```

---

### 5.2 Mutex와 Lock Guard

```cpp
#include <mutex>
#include <thread>
#include <vector>

std::mutex mtx;
int counter = 0;

void increment(int times) {
    for (int i = 0; i < times; ++i) {
        // ❌ Race condition
        // counter++;

        // ✅ Mutex로 보호
        std::lock_guard<std::mutex> lock(mtx); // RAII
        counter++;
        // lock 소멸자에서 자동으로 unlock
    }
}

int main() {
    std::vector<std::thread> threads;

    for (int i = 0; i < 10; ++i) {
        threads.emplace_back(increment, 1000);
    }

    for (auto& t : threads) {
        t.join();
    }

    std::cout << "Counter: " << counter << std::endl; // 10000

    return 0;
}
```

---

### 5.3 Condition Variable

```cpp
#include <condition_variable>
#include <queue>

std::mutex mtx;
std::condition_variable cv;
std::queue<int> dataQueue;
bool done = false;

// Producer
void producer() {
    for (int i = 0; i < 10; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

        {
            std::lock_guard<std::mutex> lock(mtx);
            dataQueue.push(i);
            std::cout << "Produced: " << i << std::endl;
        }

        cv.notify_one(); // Consumer에게 알림
    }

    {
        std::lock_guard<std::mutex> lock(mtx);
        done = true;
    }
    cv.notify_all();
}

// Consumer
void consumer() {
    while (true) {
        std::unique_lock<std::mutex> lock(mtx);

        // 데이터가 있거나 done일 때까지 대기
        cv.wait(lock, []{ return !dataQueue.empty() || done; });

        while (!dataQueue.empty()) {
            int data = dataQueue.front();
            dataQueue.pop();
            std::cout << "Consumed: " << data << std::endl;
        }

        if (done && dataQueue.empty()) {
            break;
        }
    }
}
```

---

## 6. TCP 소켓 프로그래밍

### 6.1 서버 소켓 생성

```cpp
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstring>

class TcpServer {
public:
    explicit TcpServer(uint16_t port) : port_(port), server_fd_(-1) {}

    ~TcpServer() {
        if (server_fd_ >= 0) {
            close(server_fd_);
        }
    }

    void start() {
        // 1. 소켓 생성
        server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
        if (server_fd_ < 0) {
            throw std::runtime_error("Socket creation failed");
        }

        // 2. SO_REUSEADDR 설정 (빠른 재시작)
        int opt = 1;
        setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        // 3. 주소 바인딩
        sockaddr_in address{};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port_);

        if (bind(server_fd_, (sockaddr*)&address, sizeof(address)) < 0) {
            throw std::runtime_error("Bind failed");
        }

        // 4. Listen
        if (listen(server_fd_, 10) < 0) {
            throw std::runtime_error("Listen failed");
        }

        std::cout << "Server listening on port " << port_ << std::endl;
    }

    int accept_client() {
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);

        int client_fd = accept(server_fd_, (sockaddr*)&client_addr, &client_len);
        if (client_fd < 0) {
            throw std::runtime_error("Accept failed");
        }

        char client_ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &client_addr.sin_addr, client_ip, sizeof(client_ip));

        std::cout << "Client connected: " << client_ip << ":"
                  << ntohs(client_addr.sin_port) << std::endl;

        return client_fd;
    }

private:
    uint16_t port_;
    int server_fd_;
};
```

---

### 6.2 클라이언트 소켓

```cpp
class TcpClient {
public:
    TcpClient() : sock_fd_(-1) {}

    ~TcpClient() {
        if (sock_fd_ >= 0) {
            close(sock_fd_);
        }
    }

    void connect(const std::string& host, uint16_t port) {
        // 소켓 생성
        sock_fd_ = socket(AF_INET, SOCK_STREAM, 0);
        if (sock_fd_ < 0) {
            throw std::runtime_error("Socket creation failed");
        }

        // 서버 주소 설정
        sockaddr_in server_addr{};
        server_addr.sin_family = AF_INET;
        server_addr.sin_port = htons(port);

        if (inet_pton(AF_INET, host.c_str(), &server_addr.sin_addr) <= 0) {
            throw std::runtime_error("Invalid address");
        }

        // 연결
        if (::connect(sock_fd_, (sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
            throw std::runtime_error("Connection failed");
        }

        std::cout << "Connected to " << host << ":" << port << std::endl;
    }

    ssize_t send(const void* data, size_t size) {
        return ::send(sock_fd_, data, size, 0);
    }

    ssize_t receive(void* buffer, size_t size) {
        return recv(sock_fd_, buffer, size, 0);
    }

private:
    int sock_fd_;
};
```

---

## 7. 에코 서버 구현

### 7.1 단일 클라이언트 에코 서버

```cpp
#include <iostream>
#include <cstring>

int main() {
    try {
        TcpServer server(8080);
        server.start();

        // 클라이언트 연결 수락
        int client_fd = server.accept_client();

        char buffer[1024];

        while (true) {
            // 데이터 수신
            ssize_t bytes_read = recv(client_fd, buffer, sizeof(buffer) - 1, 0);

            if (bytes_read <= 0) {
                std::cout << "Client disconnected\n";
                break;
            }

            buffer[bytes_read] = '\0';
            std::cout << "Received: " << buffer << std::endl;

            // 에코 (그대로 전송)
            send(client_fd, buffer, bytes_read, 0);
        }

        close(client_fd);

    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
```

---

### 7.2 멀티스레드 에코 서버

```cpp
void handle_client(int client_fd) {
    char buffer[1024];

    while (true) {
        ssize_t bytes_read = recv(client_fd, buffer, sizeof(buffer) - 1, 0);

        if (bytes_read <= 0) {
            std::cout << "Client disconnected\n";
            break;
        }

        buffer[bytes_read] = '\0';
        std::cout << "Received: " << buffer << std::endl;

        send(client_fd, buffer, bytes_read, 0);
    }

    close(client_fd);
}

int main() {
    try {
        TcpServer server(8080);
        server.start();

        while (true) {
            int client_fd = server.accept_client();

            // 각 클라이언트마다 별도 스레드
            std::thread client_thread(handle_client, client_fd);
            client_thread.detach(); // 독립적으로 실행
        }

    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
```

---

## 8. 트러블슈팅

### 8.1 Address already in use

**문제**: `bind: Address already in use`

**해결**:
```cpp
int opt = 1;
setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
```

---

### 8.2 Broken pipe

**문제**: 클라이언트가 연결을 끊은 후 send 시도

**해결**:
```cpp
ssize_t bytes_sent = send(client_fd, buffer, size, MSG_NOSIGNAL);
if (bytes_sent < 0) {
    if (errno == EPIPE) {
        // 클라이언트 연결 끊김
    }
}
```

---

## 9. 프로젝트 적용

### game-server lab1.1-1.2

```cpp
// lab1.1: TCP 에코 서버
// lab1.2: 턴제 전투 서버 (상태 관리 추가)

class GameServer {
    std::map<int, Player> players_;
    std::mutex players_mutex_;

public:
    void handle_client(int client_fd) {
        Player player;
        player.health = 100;

        {
            std::lock_guard<std::mutex> lock(players_mutex_);
            players_[client_fd] = player;
        }

        // 게임 로직...
    }
};
```

---

## 면접 질문

1. **RAII란 무엇이고 왜 중요한가?**
2. **unique_ptr과 shared_ptr의 차이는?**
3. **Move semantics가 성능에 미치는 영향은?**
4. **Mutex와 Lock Guard의 관계는?**
5. **TCP 3-way handshake 과정은?**
6. **auto 키워드의 장점은?**
7. **Lambda 캡처 리스트의 종류는?**
8. **RAII가 예외 안전성을 보장하는 이유는?**
9. **std::thread와 join/detach의 차이는?**
10. **TCP와 UDP의 차이는?**

---

## 퀴즈 및 다음 단계

**퀴즈**:
1. auto 키워드? (타입 추론)
2. RAII 패턴? (리소스 관리)
3. unique_ptr? (단독 소유권)
4. move semantics? (효율적 복사)
5. std::thread? (스레드 생성)
6. TCP 소켓? (연결 지향)
7. bind() 함수? (소켓 주소 바인딩)
8. listen() 함수? (연결 대기)
9. accept() 함수? (연결 수락)
10. RAII 소멸자? (자동 정리)

**완료 조건**: 에코 서버 실행, 멀티스레드 테스트.

**다음**: T11 Asio + WebSocket!

---

## 추가 리소스

### Modern C++ 문서
- [C++17 Features](https://en.cppreference.com/w/cpp/17): C++17 표준 기능.
- [Modern C++ Best Practices](https://github.com/cpp-best-practices/cppbestpractices): 가이드라인.

### 네트워크 프로그래밍
- [Beej's Guide to Network Programming](https://beej.us/guide/bgnet/): TCP/IP 튜토리얼.
- [TCP/IP Illustrated](https://www.amazon.com/TCP-IP-Illustrated-Vol-Addison-Wesley-Professional/dp/0201633469): 교과서.

### RAII와 스마트 포인터
- [Smart Pointers in C++](https://www.geeksforgeeks.org/smart-pointers-cpp/): 상세 설명.
- [RAII Explained](https://www.modernescpp.com/index.php/raii-dynamically-and-statically): 심화.

### 튜토리얼
- [C++ Concurrency in Action](https://www.manning.com/books/c-plus-plus-concurrency-in-action): 멀티스레딩 책.
- [Boost.Asio Documentation](https://www.boost.org/doc/libs/1_75_0/doc/html/boost_asio.html): 비동기 IO.

### 실습 플랫폼
- [Compiler Explorer](https://godbolt.org/): C++ 컴파일러 온라인.
- [Coliru](http://coliru.stacked-crooked.com/): 코드 공유.

### 커뮤니티
- [Stack Overflow C++](https://stackoverflow.com/questions/tagged/c%2B%2B): Q&A.
- [Reddit r/cpp](https://www.reddit.com/r/cpp/): 토론.

## 다음 단계

- Boost.Asio 비동기 IO → [T11: Asio + WebSocket](./T11-asio-websocket-gameloop.md)
- UDP 넷코드 → [T11-2: UDP 넷코드](./T11-2-udp-netcode.md)

---

**완료 체크리스트**:
- [ ] Modern C++17 기초
  - [ ] auto 키워드와 타입 추론
  - [ ] Range-based for loop
  - [ ] Lambda 표현식
- [ ] RAII 패턴
  - [ ] RAII 개념 이해
  - [ ] RAII 래퍼 클래스 구현
- [ ] Smart Pointers
  - [ ] unique_ptr 사용
  - [ ] shared_ptr와 weak_ptr
- [ ] Move Semantics
  - [ ] lvalue vs rvalue
  - [ ] move 생성자와 할당자
- [ ] 멀티스레딩
  - [ ] std::thread 생성
  - [ ] mutex와 lock
  - [ ] condition_variable
- [ ] TCP 소켓 프로그래밍
  - [ ] 소켓 생성과 바인딩
  - [ ] 연결 수립
  - [ ] 데이터 송수신
- [ ] 에코 서버 구현
  - [ ] 싱글 스레드 서버
  - [ ] 멀티스레드 서버
- [ ] 트러블슈팅
  - [ ] 공통 오류 해결
- [ ] 프로젝트 적용
  - [ ] game-server 통합
- [ ] 퀴즈 80% 이상 정답

**학습 시간**: _____ 시간 소요
