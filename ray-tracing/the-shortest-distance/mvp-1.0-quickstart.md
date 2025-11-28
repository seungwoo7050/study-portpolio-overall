# MVP 1.0 빠른 시작 - Basic Game Server

## 0. 이 문서의 역할

**대상**: C++ 서버 개발 경험 있지만, Boost.Asio/Beast + 게임 루프는 처음인 개발자

**목표**:
- 60 TPS 고정 스텝 게임 루프 구현
- WebSocket 기반 실시간 통신
- 플레이어 이동 시스템
- PostgreSQL 연동

**소요 시간**: 2-3주 (C++ + CMake 경험자 기준)

---

## 1. 전체 아키텍처 한눈에

```
[Client (Browser/wscat)]
         │ WebSocket
         ▼
[WebSocketServer (Boost.Beast)]
         │ ApplyInput()
         ▼
[GameSession]
    - PlayerState (x, y, angle)
    - ApplyInput → 위치 업데이트
         ▲
         │ Tick callback (60 TPS)
         │
[GameLoop (dedicated thread)]
    - std::thread
    - std::chrono::steady_clock
    - Fixed timestep (16.67ms)
```

**핵심 흐름**:
1. 클라이언트가 WebSocket으로 "input ..." 전송
2. WebSocketServer가 파싱 → GameSession::ApplyInput() 호출
3. GameLoop가 60 TPS로 Tick callback 실행
4. WebSocketServer가 모든 PlayerState를 "state ..." 로 브로드캐스트

---

## 2. 최소 환경 설정 (30분)

### 2.1. vcpkg 설치

```bash
git clone https://github.com/Microsoft/vcpkg.git ~/vcpkg
cd ~/vcpkg
./bootstrap-vcpkg.sh
export VCPKG_ROOT=$HOME/vcpkg
```

### 2.2. 의존성 설치

```bash
$VCPKG_ROOT/vcpkg install boost-asio boost-beast libpq gtest
```

### 2.3. 프로젝트 구조 생성

```bash
mkdir arena60 && cd arena60
mkdir -p server/{include/arena60/{core,game,network,storage},src/{core,game,network,storage},tests/unit}
```

### 2.4. CMakeLists.txt (루트)

```cmake
cmake_minimum_required(VERSION 3.20)
project(arena60 CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# vcpkg 통합
set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake")

find_package(Boost REQUIRED COMPONENTS system)
find_package(PostgreSQL REQUIRED)
find_package(GTest REQUIRED)

add_subdirectory(server)
```

---

## 3. 핵심 구현 1단계: GameLoop (60 TPS)

### 3.1. 고정 스텝 알고리즘 이해

**문제**: `while (true) { update(); sleep(16ms); }`는 누적 오차 발생
**해결**: "다음 프레임 절대 시각"을 미리 계산

```cpp
auto next_frame = steady_clock::now();
const auto delta = duration<double>(1.0 / 60.0);  // 16.67ms

while (running) {
    auto frame_start = steady_clock::now();

    // 콜백 실행
    if (callback_) {
        callback_(TickInfo{tick_counter_, delta.count(), frame_start});
    }

    tick_counter_++;
    next_frame += delta;  // 절대 시각 누적

    std::this_thread::sleep_until(next_frame);
}
```

**핵심**:
- `sleep_until(next_frame)` 으로 누적 오차 방지
- `steady_clock` 사용 (시스템 시간 변경 영향 없음)

### 3.2. 최소 구현 (game_loop.h)

```cpp
// server/include/arena60/core/game_loop.h
#pragma once
#include <atomic>
#include <chrono>
#include <functional>
#include <thread>

namespace arena60 {

struct TickInfo {
    std::uint64_t tick;
    double delta_seconds;
    std::chrono::steady_clock::time_point frame_start;
};

class GameLoop {
public:
    explicit GameLoop(double tick_rate)
        : tick_rate_(tick_rate),
          target_delta_(std::chrono::duration<double>(1.0 / tick_rate)) {}

    ~GameLoop() {
        Stop();
        Join();
    }

    void Start() {
        running_ = true;
        thread_ = std::thread([this]() { Run(); });
    }

    void Stop() {
        running_ = false;
    }

    void Join() {
        if (thread_.joinable()) {
            thread_.join();
        }
    }

    void SetUpdateCallback(std::function<void(const TickInfo&)> callback) {
        callback_ = std::move(callback);
    }

private:
    void Run() {
        auto next_frame = std::chrono::steady_clock::now();
        std::uint64_t tick_counter = 0;

        while (running_) {
            auto frame_start = std::chrono::steady_clock::now();

            if (callback_) {
                TickInfo info{tick_counter, target_delta_.count(), frame_start};
                callback_(info);
            }

            tick_counter++;
            next_frame += target_delta_;
            std::this_thread::sleep_until(next_frame);
        }
    }

    const double tick_rate_;
    const std::chrono::duration<double> target_delta_;
    std::function<void(const TickInfo&)> callback_;
    std::atomic<bool> running_{false};
    std::thread thread_;
};

}  // namespace arena60
```

### 3.3. 테스트 (간단 확인)

```cpp
// server/src/main.cpp (임시)
#include <iostream>
#include "arena60/core/game_loop.h"

int main() {
    arena60::GameLoop loop(60.0);

    loop.SetUpdateCallback([](const arena60::TickInfo& info) {
        std::cout << "Tick " << info.tick << std::endl;
    });

    loop.Start();
    std::this_thread::sleep_for(std::chrono::seconds(2));
    loop.Stop();
    loop.Join();

    return 0;
}
```

**빌드 & 실행**:
```bash
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make
./arena60_server
```

**예상 출력**: 2초 동안 약 120개의 "Tick N" 출력

---

## 4. 핵심 구현 2단계: GameSession (플레이어 이동)

### 4.1. PlayerState & MovementInput

```cpp
// server/include/arena60/game/player_state.h
#pragma once
#include <string>

namespace arena60 {

struct PlayerState {
    std::string player_id;
    double pos_x{0.0};
    double pos_y{0.0};
    double angle{0.0};  // 라디안
    std::uint32_t last_seq{0};
};

struct MovementInput {
    std::uint32_t seq;
    bool up{false};
    bool down{false};
    bool left{false};
    bool right{false};
    double mouse_x{0.0};
    double mouse_y{0.0};
};

}  // namespace arena60
```

### 4.2. GameSession 최소 구현

```cpp
// server/include/arena60/game/game_session.h
#pragma once
#include <mutex>
#include <unordered_map>
#include <vector>
#include "arena60/game/player_state.h"

namespace arena60 {

class GameSession {
public:
    explicit GameSession(double tick_rate)
        : speed_per_second_(5.0) {}  // 5 m/s

    void UpsertPlayer(const std::string& player_id) {
        std::lock_guard<std::mutex> lk(mutex_);
        if (players_.find(player_id) == players_.end()) {
            PlayerState state;
            state.player_id = player_id;
            players_[player_id] = state;
        }
    }

    void ApplyInput(const std::string& player_id, const MovementInput& input, double delta) {
        std::lock_guard<std::mutex> lk(mutex_);

        auto it = players_.find(player_id);
        if (it == players_.end()) return;

        auto& state = it->second;
        state.last_seq = input.seq;

        // 이동 벡터 계산
        double dx = 0.0, dy = 0.0;
        if (input.up) dy += 1.0;
        if (input.down) dy -= 1.0;
        if (input.left) dx -= 1.0;
        if (input.right) dx += 1.0;

        // 정규화 (대각선 이동 시 속도 보정)
        double len = std::sqrt(dx * dx + dy * dy);
        if (len > 0.0) {
            dx /= len;
            dy /= len;
            state.pos_x += dx * speed_per_second_ * delta;
            state.pos_y += dy * speed_per_second_ * delta;
        }

        // 마우스로 facing angle 계산
        if (input.mouse_x != 0.0 || input.mouse_y != 0.0) {
            double aim_dx = input.mouse_x - state.pos_x;
            double aim_dy = input.mouse_y - state.pos_y;
            state.angle = std::atan2(aim_dy, aim_dx);
        }
    }

    std::vector<PlayerState> Snapshot() const {
        std::lock_guard<std::mutex> lk(mutex_);
        std::vector<PlayerState> result;
        for (const auto& [id, state] : players_) {
            result.push_back(state);
        }
        return result;
    }

private:
    double speed_per_second_;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, PlayerState> players_;
};

}  // namespace arena60
```

---

## 5. 핵심 구현 3단계: WebSocketServer

### 5.1. Boost.Beast 기본 패턴

**핵심 개념**:
- `io_context`: 비동기 I/O의 중심 (이벤트 루프)
- `async_accept`: 비동기 연결 수락
- `async_read`: 비동기 읽기
- `async_write`: 비동기 쓰기
- `shared_from_this()`: 콜백 체인 중 객체 생명 주기 보장

### 5.2. ClientSession (간소화 버전)

```cpp
// server/src/network/websocket_server.cpp
class ClientSession : public std::enable_shared_from_this<ClientSession> {
public:
    explicit ClientSession(tcp::socket socket, WebSocketServer* server)
        : ws_(std::move(socket)), server_(server) {}

    void Start() {
        ws_.async_accept([self = shared_from_this()](beast::error_code ec) {
            if (!ec) {
                self->DoRead();
            }
        });
    }

    void DoRead() {
        ws_.async_read(buffer_, [self = shared_from_this()](beast::error_code ec, std::size_t bytes) {
            if (ec) return;  // 연결 종료

            // 메시지 파싱
            std::string message = beast::buffers_to_string(self->buffer_.data());
            self->buffer_.consume(bytes);

            std::istringstream iss(message);
            std::string cmd;
            iss >> cmd;

            if (cmd == "input") {
                std::string player_id;
                std::uint32_t seq;
                int up, down, left, right;
                double mouse_x, mouse_y;

                iss >> player_id >> seq >> up >> down >> left >> right >> mouse_x >> mouse_y;

                MovementInput input{seq, up != 0, down != 0, left != 0, right != 0, mouse_x, mouse_y};

                // GameSession에 전달
                self->server_->session_.ApplyInput(player_id, input, 1.0 / 60.0);

                // 첫 입력 시 플레이어 등록
                if (self->player_id_.empty()) {
                    self->player_id_ = player_id;
                    self->server_->session_.UpsertPlayer(player_id);
                }
            }

            self->DoRead();  // 다음 읽기
        });
    }

    void Send(const std::string& message) {
        auto msg = std::make_shared<std::string>(message);
        ws_.async_write(asio::buffer(*msg), [msg](beast::error_code, std::size_t) {
            // 쓰기 완료 (msg는 자동 해제)
        });
    }

private:
    websocket::stream<tcp::socket> ws_;
    WebSocketServer* server_;
    beast::flat_buffer buffer_;
    std::string player_id_;
};
```

### 5.3. WebSocketServer 골격

```cpp
class WebSocketServer {
public:
    WebSocketServer(asio::io_context& io_context, uint16_t port,
                    GameSession& session, GameLoop& loop)
        : io_context_(io_context),
          acceptor_(io_context, tcp::endpoint(tcp::v4(), port)),
          session_(session),
          loop_(loop) {

        loop_.SetUpdateCallback([this](const TickInfo& info) {
            BroadcastState(info.tick);
        });
    }

    void Start() {
        running_ = true;
        DoAccept();
    }

    void Stop() {
        running_ = false;
        acceptor_.close();
    }

private:
    void DoAccept() {
        acceptor_.async_accept([this](beast::error_code ec, tcp::socket socket) {
            if (!ec) {
                auto session = std::make_shared<ClientSession>(std::move(socket), this);
                session->Start();
            }

            if (running_) {
                DoAccept();
            }
        });
    }

    void BroadcastState(uint64_t tick) {
        auto states = session_.Snapshot();

        for (const auto& state : states) {
            std::ostringstream oss;
            oss << "state " << state.player_id << " "
                << state.pos_x << " " << state.pos_y << " "
                << state.angle << " " << tick;

            // 모든 클라이언트에 전송 (간소화)
            // 실제로는 clients_ 맵 관리 필요
        }
    }

    asio::io_context& io_context_;
    tcp::acceptor acceptor_;
    GameSession& session_;
    GameLoop& loop_;
    std::atomic<bool> running_{false};
};
```

---

## 6. main.cpp 통합

```cpp
#include <iostream>
#include <boost/asio.hpp>
#include "arena60/core/game_loop.h"
#include "arena60/game/game_session.h"
#include "arena60/network/websocket_server.h"

int main() {
    try {
        boost::asio::io_context io_context;

        arena60::GameSession session(60.0);
        arena60::GameLoop loop(60.0);
        arena60::WebSocketServer server(io_context, 8080, session, loop);

        server.Start();
        loop.Start();

        std::cout << "Server started on port 8080" << std::endl;
        std::cout << "Press Ctrl+C to stop" << std::endl;

        io_context.run();  // 블로킹

        loop.Stop();
        server.Stop();
    } catch (std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
```

---

## 7. 테스트 (wscat)

### 7.1. wscat 설치

```bash
npm install -g wscat
```

### 7.2. 연결 및 입력

```bash
wscat -c ws://localhost:8080

# W키 누름, 마우스 (100, 50)
> input player1 0 1 0 0 0 100.0 50.0

# 서버 응답
< state player1 0.0 0.0 0.785 1
< state player1 0.083 0.0 0.785 2
< state player1 0.167 0.0 0.785 3
```

**해석**:
- `pos_x`가 0 → 0.083 → 0.167로 증가 (W키로 위로 이동)
- `angle = 0.785` (약 45도, atan2(50, 100))

---

## 8. 자주 발생하는 문제

### 8.1. 컴파일 에러: Boost 못 찾음

**증상**:
```
CMake Error: Could not find Boost
```

**해결**:
```bash
export VCPKG_ROOT=/path/to/vcpkg
cmake .. -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake
```

### 8.2. 런타임 에러: Address already in use

**증상**:
```
bind: Address already in use
```

**해결**:
```cpp
acceptor_.set_option(asio::socket_base::reuse_address(true));
```

### 8.3. 틱 레이트 불안정

**증상**: 59 TPS 또는 61 TPS로 흔들림

**원인**: `sleep(16ms)` 사용 (누적 오차)

**해결**: `sleep_until(next_frame)` 패턴 사용 (위 GameLoop 구현 참조)

### 8.4. WebSocket 연결 후 응답 없음

**증상**: wscat 연결은 되지만 메시지 안 옴

**원인**: `io_context.run()` 호출 안 함

**해결**: main에서 `io_context.run()` 실행 (블로킹)

---

## 9. 다음 단계: MVP 1.1

MVP 1.0 완료 후:
1. `mvp-1.1-quickstart.md` 읽기
2. Projectile 시스템 추가
3. 충돌 감지 구현
4. Health & Death 처리

**MVP 1.0 완료 체크리스트**:
- [ ] GameLoop 60 TPS로 안정 실행
- [ ] WebSocket 클라이언트 연결 가능
- [ ] WASD + 마우스 입력 동작
- [ ] 플레이어 위치가 화면에 표시됨
- [ ] 모든 테스트 통과

---

**참고 자료**:
- [Boost.Asio 튜토리얼](https://www.boost.org/doc/libs/release/doc/html/boost_asio/tutorial.html)
- [Boost.Beast WebSocket](https://www.boost.org/doc/libs/release/libs/beast/doc/html/beast/using_websocket.html)
- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/)
