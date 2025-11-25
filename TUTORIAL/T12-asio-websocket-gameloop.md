# T12: Boost.Asio + WebSocket + 게임 루프

> **목표**: Boost.Asio와 WebSocket으로 비동기 게임 서버 구축 및 게임 루프 구현
> **예상 시간**: 18-25시간 (주 9-12시간)
> **난이도**: 🟠 고급
> **선행 요구사항**: [T11: Modern C++17 + RAII + TCP](./T11-cpp-raii-tcp.md)
> **적용 프로젝트**: game-server lab1.3-1.4
> **퀄리티 보장**: 비동기 서버, WebSocket 통신, 게임 루프
> **효율성 보장**: Asio 패턴, 실습 채팅/Pong, 디버깅

---

## 개요

Boost.Asio와 Boost.Beast를 사용하여 비동기 WebSocket 게임 서버를 구축하고, 고정 타임스텝 게임 루프를 구현합니다. 실시간 멀티플레이어 게임 서버의 핵심 패턴을 학습합니다.

**학습 목표**:
- Boost.Asio 비동기 I/O 패턴 이해
- Boost.Beast WebSocket 서버 구현
- 고정 타임스텝 (Fixed Timestep) 게임 루프
- 세션 관리 및 브로드캐스팅
- 멀티스레드 게임 서버 아키텍처

**프로젝트 연관성**:
- **game-server (gameserver-fundamentals)**: lab1.3 (WebSocket 멀티룸 채팅), lab1.4 (Pong 게임 서버 + 게임 루프)

---

## 목차

1. [Boost.Asio 기초](#1-boostasio-기초)
2. [Boost.Beast WebSocket](#2-boostbeast-websocket)
3. [고정 타임스텝 게임 루프](#3-고정-타임스텝-게임-루프)
4. [통합: WebSocket 게임 서버](#4-통합-websocket-게임-서버)
5. [성능 최적화](#5-성능-최적화)
6. [트러블슈팅](#6-트러블슈팅)
7. [면접 대비 질문](#7-면접-대비-질문)
8. [다음 단계](#8-다음-단계)
9. [공통 오류와 해결](#9-공통-오류와-해결)
10. [퀴즈 및 다음 단계](#10-퀴즈-및-다음-단계)
11. [추가 리소스](#11-추가-리소스)

---

## 1. Boost.Asio 기초

### 1.1 설치

```bash
# Ubuntu/Debian
sudo apt-get install libboost-all-dev

# macOS
brew install boost

# CMakeLists.txt
find_package(Boost 1.75 REQUIRED COMPONENTS system)
target_link_libraries(server Boost::system pthread)
```

### 1.2 io_context와 비동기 작업

**io_context**는 Asio의 핵심으로, 비동기 작업을 관리하고 실행합니다.

```cpp
// src/asio_basics.cpp
#include <boost/asio.hpp>
#include <iostream>
#include <chrono>

namespace asio = boost::asio;

void print_with_delay(asio::io_context& io, int delay_ms, const std::string& message) {
    auto timer = std::make_shared<asio::steady_timer>(io, std::chrono::milliseconds(delay_ms));

    timer->async_wait([timer, message](const boost::system::error_code& ec) {
        if (!ec) {
            std::cout << message << std::endl;
        }
    });
}

int main() {
    asio::io_context io;

    print_with_delay(io, 1000, "Hello after 1 second");
    print_with_delay(io, 2000, "Hello after 2 seconds");
    print_with_delay(io, 3000, "Hello after 3 seconds");

    std::cout << "Starting io_context..." << std::endl;
    io.run(); // 모든 비동기 작업 실행
    std::cout << "Finished!" << std::endl;

    return 0;
}
```

**출력**:
```
Starting io_context...
Hello after 1 second
Hello after 2 seconds
Hello after 3 seconds
Finished!
```

### 1.3 비동기 TCP 서버

```cpp
// src/tcp_async_server.cpp
#include <boost/asio.hpp>
#include <iostream>
#include <memory>

namespace asio = boost::asio;
using tcp = asio::ip::tcp;

class Session : public std::enable_shared_from_this<Session> {
public:
    Session(tcp::socket socket) : socket_(std::move(socket)) {}

    void start() {
        do_read();
    }

private:
    void do_read() {
        auto self = shared_from_this();
        socket_.async_read_some(
            asio::buffer(buffer_),
            [this, self](boost::system::error_code ec, std::size_t length) {
                if (!ec) {
                    std::cout << "Received: " << std::string(buffer_.data(), length) << std::endl;
                    do_write(length);
                }
            }
        );
    }

    void do_write(std::size_t length) {
        auto self = shared_from_this();
        asio::async_write(
            socket_,
            asio::buffer(buffer_, length),
            [this, self](boost::system::error_code ec, std::size_t /*length*/) {
                if (!ec) {
                    do_read();
                }
            }
        );
    }

    tcp::socket socket_;
    std::array<char, 1024> buffer_;
};

class Server {
public:
    Server(asio::io_context& io, short port)
        : acceptor_(io, tcp::endpoint(tcp::v4(), port)) {
        do_accept();
    }

private:
    void do_accept() {
        acceptor_.async_accept(
            [this](boost::system::error_code ec, tcp::socket socket) {
                if (!ec) {
                    std::cout << "New connection accepted" << std::endl;
                    std::make_shared<Session>(std::move(socket))->start();
                }
                do_accept(); // 다음 연결 대기
            }
        );
    }

    tcp::acceptor acceptor_;
};

int main() {
    try {
        asio::io_context io;
        Server server(io, 8080);
        std::cout << "Server listening on port 8080..." << std::endl;
        io.run();
    } catch (std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
    }
    return 0;
}
```

### 1.4 멀티스레드 io_context

```cpp
// src/multi_threaded_server.cpp
#include <boost/asio.hpp>
#include <thread>
#include <vector>
#include <iostream>

namespace asio = boost::asio;

int main() {
    asio::io_context io;
    auto work = asio::make_work_guard(io); // io_context가 종료되지 않도록 유지

    // 워커 스레드 생성 (CPU 코어 수만큼)
    std::vector<std::thread> threads;
    unsigned int num_threads = std::thread::hardware_concurrency();

    std::cout << "Starting " << num_threads << " worker threads..." << std::endl;

    for (unsigned int i = 0; i < num_threads; ++i) {
        threads.emplace_back([&io, i]() {
            std::cout << "Thread " << i << " started" << std::endl;
            io.run();
            std::cout << "Thread " << i << " finished" << std::endl;
        });
    }

    // 작업 예약
    for (int i = 0; i < 10; ++i) {
        asio::post(io, [i]() {
            std::cout << "Task " << i << " executed on thread "
                      << std::this_thread::get_id() << std::endl;
        });
    }

    // 5초 후 종료
    std::this_thread::sleep_for(std::chrono::seconds(5));
    work.reset(); // work guard 해제 → io_context 종료 허용

    for (auto& t : threads) {
        t.join();
    }

    return 0;
}
```

---

## 2. Boost.Beast WebSocket

### 2.1 WebSocket 기초

```cpp
// src/websocket_session.hpp
#pragma once

#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio.hpp>
#include <memory>
#include <iostream>

namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = net::ip::tcp;

class WebSocketSession : public std::enable_shared_from_this<WebSocketSession> {
public:
    explicit WebSocketSession(tcp::socket socket)
        : ws_(std::move(socket)) {}

    void start() {
        ws_.async_accept(
            beast::bind_front_handler(
                &WebSocketSession::on_accept,
                shared_from_this()
            )
        );
    }

    void send(const std::string& message) {
        auto self = shared_from_this();
        ws_.async_write(
            net::buffer(message),
            [this, self](beast::error_code ec, std::size_t bytes_transferred) {
                if (ec) {
                    std::cerr << "Write error: " << ec.message() << std::endl;
                }
            }
        );
    }

private:
    void on_accept(beast::error_code ec) {
        if (ec) {
            std::cerr << "Accept error: " << ec.message() << std::endl;
            return;
        }

        std::cout << "WebSocket connection accepted" << std::endl;
        do_read();
    }

    void do_read() {
        ws_.async_read(
            buffer_,
            beast::bind_front_handler(
                &WebSocketSession::on_read,
                shared_from_this()
            )
        );
    }

    void on_read(beast::error_code ec, std::size_t bytes_transferred) {
        if (ec == websocket::error::closed) {
            std::cout << "WebSocket closed" << std::endl;
            return;
        }

        if (ec) {
            std::cerr << "Read error: " << ec.message() << std::endl;
            return;
        }

        std::string message = beast::buffers_to_string(buffer_.data());
        std::cout << "Received: " << message << std::endl;
        buffer_.consume(buffer_.size());

        // Echo back
        ws_.text(ws_.got_text());
        send(message);

        do_read();
    }

    websocket::stream<tcp::socket> ws_;
    beast::flat_buffer buffer_;
};
```

### 2.2 WebSocket 서버

```cpp
// src/websocket_server.cpp
#include "websocket_session.hpp"
#include <memory>

class WebSocketServer {
public:
    WebSocketServer(net::io_context& io, tcp::endpoint endpoint)
        : io_(io), acceptor_(io, endpoint) {
        do_accept();
    }

private:
    void do_accept() {
        acceptor_.async_accept(
            [this](beast::error_code ec, tcp::socket socket) {
                if (!ec) {
                    std::cout << "New connection from "
                              << socket.remote_endpoint() << std::endl;
                    std::make_shared<WebSocketSession>(std::move(socket))->start();
                }

                do_accept();
            }
        );
    }

    net::io_context& io_;
    tcp::acceptor acceptor_;
};

int main() {
    try {
        net::io_context io;
        WebSocketServer server(io, tcp::endpoint(tcp::v4(), 9001));

        std::cout << "WebSocket server listening on port 9001..." << std::endl;
        io.run();
    } catch (std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
    }

    return 0;
}
```

### 2.3 브로드캐스팅 (모든 클라이언트에게 전송)

```cpp
// src/broadcast_server.hpp
#pragma once

#include "websocket_session.hpp"
#include <set>
#include <mutex>

class BroadcastSession : public std::enable_shared_from_this<BroadcastSession> {
public:
    explicit BroadcastSession(tcp::socket socket, std::set<BroadcastSession*>& sessions)
        : ws_(std::move(socket)), sessions_(sessions) {}

    ~BroadcastSession() {
        leave();
    }

    void start() {
        join();
        ws_.async_accept(
            beast::bind_front_handler(
                &BroadcastSession::on_accept,
                shared_from_this()
            )
        );
    }

    void send(const std::string& message) {
        auto self = shared_from_this();
        net::post(
            ws_.get_executor(),
            [this, self, message]() {
                bool write_in_progress = !write_queue_.empty();
                write_queue_.push_back(message);

                if (!write_in_progress) {
                    do_write();
                }
            }
        );
    }

private:
    void join() {
        std::lock_guard<std::mutex> lock(sessions_mutex_);
        sessions_.insert(this);
    }

    void leave() {
        std::lock_guard<std::mutex> lock(sessions_mutex_);
        sessions_.erase(this);
    }

    void on_accept(beast::error_code ec) {
        if (ec) return;
        do_read();
    }

    void do_read() {
        ws_.async_read(
            buffer_,
            beast::bind_front_handler(
                &BroadcastSession::on_read,
                shared_from_this()
            )
        );
    }

    void on_read(beast::error_code ec, std::size_t) {
        if (ec) {
            leave();
            return;
        }

        std::string message = beast::buffers_to_string(buffer_.data());
        buffer_.consume(buffer_.size());

        // 모든 클라이언트에게 브로드캐스트
        broadcast(message);

        do_read();
    }

    void do_write() {
        ws_.async_write(
            net::buffer(write_queue_.front()),
            beast::bind_front_handler(
                &BroadcastSession::on_write,
                shared_from_this()
            )
        );
    }

    void on_write(beast::error_code ec, std::size_t) {
        if (ec) {
            leave();
            return;
        }

        write_queue_.pop_front();

        if (!write_queue_.empty()) {
            do_write();
        }
    }

    void broadcast(const std::string& message) {
        std::lock_guard<std::mutex> lock(sessions_mutex_);
        for (auto* session : sessions_) {
            session->send(message);
        }
    }

    websocket::stream<tcp::socket> ws_;
    beast::flat_buffer buffer_;
    std::set<BroadcastSession*>& sessions_;
    std::deque<std::string> write_queue_;
    static std::mutex sessions_mutex_;
};

std::mutex BroadcastSession::sessions_mutex_;
```

---

## 3. 고정 타임스텝 게임 루프

### 3.1 기본 게임 루프

```cpp
// src/game_loop.cpp
#include <chrono>
#include <thread>
#include <iostream>

using namespace std::chrono;

class GameLoop {
public:
    GameLoop(int target_tps = 60)
        : target_tps_(target_tps),
          frame_duration_(milliseconds(1000 / target_tps)) {}

    void run() {
        running_ = true;
        auto next_frame_time = steady_clock::now();

        while (running_) {
            auto frame_start = steady_clock::now();

            // 게임 로직 업데이트
            update(frame_duration_.count() / 1000.0f);

            // 다음 프레임 시간 계산
            next_frame_time += frame_duration_;

            // 프레임 완료까지 대기
            std::this_thread::sleep_until(next_frame_time);

            auto frame_end = steady_clock::now();
            auto frame_time = duration_cast<microseconds>(frame_end - frame_start);

            // 프레임 시간 로깅 (매 60프레임마다)
            if (++frame_count_ % 60 == 0) {
                std::cout << "Frame time: " << frame_time.count() / 1000.0 << "ms" << std::endl;
            }
        }
    }

    void stop() {
        running_ = false;
    }

private:
    void update(float delta_time) {
        // 게임 상태 업데이트
        // 예: 플레이어 위치 업데이트, 충돌 검사 등
    }

    int target_tps_;
    milliseconds frame_duration_;
    bool running_ = false;
    int frame_count_ = 0;
};

int main() {
    GameLoop loop(60); // 60 TPS
    loop.run();
    return 0;
}
```

### 3.2 가변 타임스텝 + 보간 (Semi-Fixed Timestep)

```cpp
// src/semi_fixed_timestep.cpp
#include <chrono>
#include <iostream>

using namespace std::chrono;

class GameServer {
public:
    GameServer(int target_tps = 60)
        : target_tps_(target_tps),
          fixed_dt_(1.0f / target_tps) {}

    void run() {
        running_ = true;
        auto previous_time = steady_clock::now();
        float accumulator = 0.0f;

        while (running_) {
            auto current_time = steady_clock::now();
            auto frame_time = duration_cast<microseconds>(current_time - previous_time).count() / 1000000.0f;
            previous_time = current_time;

            // 최대 프레임 시간 제한 (스파이크 방지)
            if (frame_time > 0.25f) {
                frame_time = 0.25f;
            }

            accumulator += frame_time;

            // 고정 타임스텝으로 여러 번 업데이트
            while (accumulator >= fixed_dt_) {
                update(fixed_dt_);
                accumulator -= fixed_dt_;
            }

            // 보간을 위한 alpha 값 계산
            float alpha = accumulator / fixed_dt_;
            render(alpha);

            // 간단한 슬립 (CPU 사용률 제어)
            std::this_thread::sleep_for(milliseconds(1));
        }
    }

    void stop() {
        running_ = false;
    }

private:
    void update(float dt) {
        // 물리 시뮬레이션 등
        std::cout << "Update with dt=" << dt << std::endl;
    }

    void render(float alpha) {
        // 보간된 상태로 렌더링
        // state = previous_state * (1 - alpha) + current_state * alpha
    }

    int target_tps_;
    float fixed_dt_;
    bool running_ = false;
};
```

### 3.3 게임 상태 관리

```cpp
// src/game_state.hpp
#pragma once

#include <glm/glm.hpp>
#include <unordered_map>
#include <mutex>

struct Player {
    int id;
    glm::vec2 position;
    glm::vec2 velocity;
    float rotation;
    int health;

    void update(float dt) {
        position += velocity * dt;

        // 간단한 감속
        velocity *= 0.95f;
    }
};

class GameState {
public:
    void add_player(int id) {
        std::lock_guard<std::mutex> lock(mutex_);
        players_[id] = Player{id, {0.0f, 0.0f}, {0.0f, 0.0f}, 0.0f, 100};
    }

    void remove_player(int id) {
        std::lock_guard<std::mutex> lock(mutex_);
        players_.erase(id);
    }

    void update(float dt) {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto& [id, player] : players_) {
            player.update(dt);
        }
    }

    void set_player_velocity(int id, const glm::vec2& velocity) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (players_.count(id)) {
            players_[id].velocity = velocity;
        }
    }

    std::unordered_map<int, Player> get_snapshot() {
        std::lock_guard<std::mutex> lock(mutex_);
        return players_; // 복사본 반환
    }

private:
    std::unordered_map<int, Player> players_;
    std::mutex mutex_;
};
```

---

## 4. 통합: WebSocket 게임 서버

### 4.1 게임 세션 관리

```cpp
// src/game_session.hpp
#pragma once

#include "websocket_session.hpp"
#include "game_state.hpp"
#include <nlohmann/json.hpp>
#include <memory>

using json = nlohmann::json;

class GameSession : public std::enable_shared_from_this<GameSession> {
public:
    explicit GameSession(tcp::socket socket, GameState& game_state, int player_id)
        : ws_(std::move(socket)), game_state_(game_state), player_id_(player_id) {}

    ~GameSession() {
        game_state_.remove_player(player_id_);
    }

    void start() {
        game_state_.add_player(player_id_);

        ws_.async_accept(
            beast::bind_front_handler(
                &GameSession::on_accept,
                shared_from_this()
            )
        );
    }

    void send_state_update(const json& state) {
        std::string message = state.dump();

        auto self = shared_from_this();
        net::post(
            ws_.get_executor(),
            [this, self, message]() {
                ws_.async_write(
                    net::buffer(message),
                    beast::bind_front_handler(
                        &GameSession::on_write,
                        shared_from_this()
                    )
                );
            }
        );
    }

private:
    void on_accept(beast::error_code ec) {
        if (ec) return;
        do_read();
    }

    void do_read() {
        ws_.async_read(
            buffer_,
            beast::bind_front_handler(
                &GameSession::on_read,
                shared_from_this()
            )
        );
    }

    void on_read(beast::error_code ec, std::size_t) {
        if (ec) return;

        std::string message = beast::buffers_to_string(buffer_.data());
        buffer_.consume(buffer_.size());

        try {
            json input = json::parse(message);

            if (input["type"] == "move") {
                float vx = input["velocity"]["x"];
                float vy = input["velocity"]["y"];
                game_state_.set_player_velocity(player_id_, {vx, vy});
            }
        } catch (json::exception& e) {
            std::cerr << "JSON error: " << e.what() << std::endl;
        }

        do_read();
    }

    void on_write(beast::error_code ec, std::size_t) {
        // 쓰기 완료
    }

    websocket::stream<tcp::socket> ws_;
    beast::flat_buffer buffer_;
    GameState& game_state_;
    int player_id_;
};
```

### 4.2 메인 서버

```cpp
// src/main.cpp
#include "game_session.hpp"
#include <thread>
#include <atomic>

class GameServer {
public:
    GameServer(net::io_context& io, tcp::endpoint endpoint, int tps = 60)
        : io_(io), acceptor_(io, endpoint), target_tps_(tps),
          frame_duration_(milliseconds(1000 / tps)) {
        do_accept();
        start_game_loop();
    }

private:
    void do_accept() {
        acceptor_.async_accept(
            [this](beast::error_code ec, tcp::socket socket) {
                if (!ec) {
                    int player_id = next_player_id_++;
                    std::cout << "Player " << player_id << " connected" << std::endl;

                    auto session = std::make_shared<GameSession>(
                        std::move(socket), game_state_, player_id
                    );
                    sessions_.push_back(session);
                    session->start();
                }

                do_accept();
            }
        );
    }

    void start_game_loop() {
        game_loop_thread_ = std::thread([this]() {
            auto next_frame_time = steady_clock::now();

            while (running_) {
                // 게임 상태 업데이트
                game_state_.update(1.0f / target_tps_);

                // 상태 브로드캐스트
                broadcast_state();

                // 다음 프레임까지 대기
                next_frame_time += frame_duration_;
                std::this_thread::sleep_until(next_frame_time);
            }
        });
    }

    void broadcast_state() {
        auto snapshot = game_state_.get_snapshot();

        json state;
        state["type"] = "state_update";
        state["players"] = json::array();

        for (const auto& [id, player] : snapshot) {
            json player_json;
            player_json["id"] = id;
            player_json["position"] = {player.position.x, player.position.y};
            player_json["rotation"] = player.rotation;
            player_json["health"] = player.health;
            state["players"].push_back(player_json);
        }

        // 모든 세션에 전송
        for (auto& session : sessions_) {
            session->send_state_update(state);
        }
    }

    net::io_context& io_;
    tcp::acceptor acceptor_;
    GameState game_state_;
    std::vector<std::shared_ptr<GameSession>> sessions_;
    std::atomic<int> next_player_id_{0};

    int target_tps_;
    milliseconds frame_duration_;
    std::thread game_loop_thread_;
    std::atomic<bool> running_{true};
};

int main() {
    try {
        net::io_context io;
        GameServer server(io, tcp::endpoint(tcp::v4(), 9001), 60);

        std::cout << "Game server listening on port 9001 (60 TPS)..." << std::endl;
        io.run();
    } catch (std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
    }

    return 0;
}
```

---

## 5. 성능 최적화

### 5.1 객체 풀 (Object Pool)

```cpp
// src/object_pool.hpp
#pragma once

#include <vector>
#include <memory>
#include <mutex>

template<typename T>
class ObjectPool {
public:
    ObjectPool(size_t initial_size = 100) {
        for (size_t i = 0; i < initial_size; ++i) {
            available_.push_back(std::make_unique<T>());
        }
    }

    std::unique_ptr<T> acquire() {
        std::lock_guard<std::mutex> lock(mutex_);

        if (available_.empty()) {
            return std::make_unique<T>();
        }

        auto obj = std::move(available_.back());
        available_.pop_back();
        return obj;
    }

    void release(std::unique_ptr<T> obj) {
        std::lock_guard<std::mutex> lock(mutex_);
        available_.push_back(std::move(obj));
    }

private:
    std::vector<std::unique_ptr<T>> available_;
    std::mutex mutex_;
};
```

### 5.2 메시지 배칭 (Batching)

```cpp
// src/message_batcher.hpp
#pragma once

#include <nlohmann/json.hpp>
#include <vector>

using json = nlohmann::json;

class MessageBatcher {
public:
    void add_message(const json& message) {
        batch_.push_back(message);
    }

    std::string flush() {
        if (batch_.empty()) {
            return "";
        }

        json batch_message;
        batch_message["type"] = "batch";
        batch_message["messages"] = batch_;

        std::string result = batch_message.dump();
        batch_.clear();

        return result;
    }

    bool should_flush() const {
        return batch_.size() >= 10; // 10개 메시지마다 전송
    }

private:
    std::vector<json> batch_;
};
```

### 5.3 Strand를 사용한 동기화

```cpp
// src/strand_example.cpp
#include <boost/asio.hpp>
#include <memory>

namespace asio = boost::asio;

class StrandSession {
public:
    StrandSession(asio::io_context& io)
        : strand_(asio::make_strand(io)) {}

    void send_message(const std::string& message) {
        // strand를 통해 직렬화 보장
        asio::post(strand_, [this, message]() {
            write_queue_.push_back(message);
            if (write_queue_.size() == 1) {
                do_write();
            }
        });
    }

private:
    void do_write() {
        // strand 내에서 실행 → 동기화 불필요
        auto& message = write_queue_.front();
        // ... 실제 쓰기 작업
        write_queue_.pop_front();

        if (!write_queue_.empty()) {
            do_write();
        }
    }

    asio::strand<asio::io_context::executor_type> strand_;
    std::deque<std::string> write_queue_;
};
```

---

## 6. 트러블슈팅

### 6.1 "Too many open files" 에러

**원인**: 파일 디스크립터 제한 초과

**해결**:
```bash
# 현재 제한 확인
ulimit -n

# 제한 증가 (현재 세션)
ulimit -n 65536

# 영구 설정 (/etc/security/limits.conf)
* soft nofile 65536
* hard nofile 65536
```

### 6.2 높은 레이턴시

**원인**: Nagle 알고리즘, 스레드 경합

**해결**:
```cpp
// TCP_NODELAY 활성화 (Nagle 비활성화)
socket.set_option(tcp::no_delay(true));

// 적절한 버퍼 크기
socket.set_option(socket_base::receive_buffer_size(65536));
socket.set_option(socket_base::send_buffer_size(65536));
```

### 6.3 게임 루프 지터 (Jitter)

**원인**: sleep 정밀도 문제, 스케줄링 우선순위

**해결**:
```cpp
// 더 정밀한 타이머 사용
auto next_frame_time = std::chrono::steady_clock::now();
while (running_) {
    update();

    next_frame_time += frame_duration;
    std::this_thread::sleep_until(next_frame_time); // sleep_for 대신 sleep_until 사용
}
```

---

## 7. 면접 대비 질문

### Q1: Asio의 async vs sync 작업의 차이는?

**답변**:
- **Sync**: 작업이 완료될 때까지 블로킹. 단순하지만 확장성 낮음
- **Async**: 즉시 반환, 완료 시 콜백 호출. 높은 동시성, 복잡한 에러 처리

### Q2: Fixed Timestep의 장점은?

**답변**:
- 결정적 시뮬레이션 (같은 입력 → 같은 결과)
- 물리 엔진 안정성
- 리플레이 가능
- 단점: 느린 하드웨어에서 스파이럴링 가능성

### Q3: shared_from_this()의 역할은?

**답변**:
- 비동기 작업에서 객체 생명주기 보장
- 콜백이 실행될 때까지 객체가 삭제되지 않도록 함
- `enable_shared_from_this` 상속 필요

### Q4: WebSocket vs UDP의 차이는?

**답변**:
- **WebSocket**: TCP 기반, 신뢰성, 브라우저 호환, HTTP 핸드셰이크
- **UDP**: 비신뢰성, 낮은 레이턴시, NAT 순회 어려움

**선택 기준**:
- WebSocket: 브라우저 게임, 중간 수준 동시성
- UDP: 네이티브 FPS, MOBA (T11-2 참고)

### Q5: io_context::run()을 여러 스레드에서 호출하는 이유는?

**답변**:
- 멀티코어 활용
- CPU 집약적 핸들러 병렬 처리
- 주의: 핸들러 간 동기화 필요 (strand 사용)

### Q6: Boost.Asio strand의 역할은?

**답변**:
- 핸들러 직렬화 실행
- 경쟁 조건 방지
- 특정 객체에 대한 스레드 안전성 보장

### Q7: WebSocket 서브프로토콜의 용도는?

**답변**:
- 애플리케이션별 메시지 포맷 협상
- 예: STOMP, MQTT over WebSocket

### Q8: 게임 서버에서 고정 타임스텝이 중요한 이유는?

**답변**:
- 클라이언트 예측 정확성
- 리플레이 시스템 구현 용이
- 물리 시뮬레이션 일관성

### Q9: Asio의 completion token 패턴은?

**답변**:
- 콜백 vs 코루틴 vs future 지원
- 비동기 API의 유연한 인터페이스

### Q10: WebSocket 압축의 장점은?

**답변**:
- 대역폭 절약
- 특히 텍스트 메시지에서 효과적
- per-message-deflate 확장

---

## 8. 다음 단계

### T11 완료 후:
1. **T11-2 (UDP 넷코드)**: netcode-core 별도 프로젝트로 진행
2. **실전 프로젝트**: gameserver-fundamentals lab1.3-1.4 (WebSocket 게임 서버)
3. **부하 테스트**: 동시 접속 1000명 목표

---

**마지막 업데이트**: 2025년 1월
**다음 튜토리얼**: [T11-2 - UDP 넷코드 →](./T11-2-udp-netcode.md)

---

## 9. 공통 오류와 해결

- **컴파일 에러**: Boost 헤더 → include 경로 확인.
- **런타임 크래시**: io_context → run() 호출 누락.
- **연결 실패**: WebSocket 핸드셰이크 → HTTP 업그레이드.
- **데드락**: 스레드 동기화 → mutex 사용.
- **메모리 누수**: shared_ptr → RAII 준수.

---

## 10. 퀴즈 및 다음 단계

**퀴즈**:
1. io_context? (비동기 작업 관리)
2. WebSocket 핸드셰이크? (HTTP 업그레이드)
3. 고정 타임스텝? (일정한 업데이트 간격)
4. 브로드캐스팅? (모든 클라이언트 전송)
5. async_wait? (비동기 타이머)
6. shared_from_this? (객체 생명주기)
7. strand? (직렬화 핸들러)
8. 게임 루프? (업데이트/렌더링 반복)
9. WebSocket 프레이밍? (메시지 단위)
10. Boost.Beast? (HTTP/WebSocket 라이브러리)

**완료 조건**: 채팅 서버 실행, Pong 게임 작동.

**다음**: T11-2!

---

## 11. 추가 리소스

### Boost.Asio
- [Boost Docs](https://www.boost.org/doc/libs/1_84_0/doc/html/boost_asio.html): 공식 문서.
- [Asio Tutorial](https://think-async.com/Asio/asio-1.28.0/doc/asio/tutorial.html): 튜토리얼.
- [Asio Examples](https://www.boost.org/doc/libs/1_84_0/doc/html/boost_asio/examples.html): 샘플 코드.

### WebSocket
- [RFC 6455](https://tools.ietf.org/html/rfc6455): 프로토콜 스펙.
- [Boost.Beast](https://www.boost.org/doc/libs/1_84_0/libs/beast/doc/html/index.html): 라이브러리.
- [WebSocket.org](https://websocket.org/): 프로토콜 설명.

### 게임 루프
- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/): 고정 타임스텝 가이드.
- [Game Loop](https://gameprogrammingpatterns.com/game-loop.html): 패턴 설명.
- [Valve Source Engine](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking): 게임 넷워킹.

### 튜토리얼
- [WebSocket Server](https://github.com/boostorg/beast/tree/develop/example): Beast 예제.
- [Asio Chat Server](https://www.boost.org/doc/libs/1_84_0/doc/html/boost_asio/tutorial/tuttimer3.html): 채팅 예제.

### 비디오
- [CppCon Asio](https://www.youtube.com/results?search_query=cppcon+asio): 컨퍼런스 발표.
- [Game Dev Netcode](https://www.youtube.com/results?search_query=game+dev+netcode): 넷코드 비디오.
- [BoostCon](https://www.youtube.com/results?search_query=boostcon): Boost 라이브러리.

### 실습 플랫폼
- [Compiler Explorer](https://godbolt.org/): C++ 온라인 컴파일러.
- [Wandbox](https://wandbox.org/): Boost 지원 온라인 IDE.

### 커뮤니티
- [Stack Overflow Boost](https://stackoverflow.com/questions/tagged/boost): Q&A.
- [Reddit r/cpp](https://www.reddit.com/r/cpp/): C++ 토론.
- [Boost Users Mailing List](https://lists.boost.org/mailman/listinfo.cgi/boost-users): 메일링 리스트.

---

**완료 체크리스트**:
- [ ] Boost.Asio 기초
  - [ ] io_context와 비동기 작업
  - [ ] 비동기 TCP 서버 구현
  - [ ] 멀티스레드 io_context
- [ ] Boost.Beast WebSocket
  - [ ] WebSocket 핸드셰이크
  - [ ] 메시지 송수신
  - [ ] 세션 관리
- [ ] 고정 타임스텝 게임 루프
  - [ ] 게임 루프 개념
  - [ ] 고정 타임스텝 구현
  - [ ] 가변 타임스텝 vs 고정 타임스텝
- [ ] 통합: WebSocket 게임 서버
  - [ ] 채팅 서버 구현
  - [ ] Pong 게임 서버
  - [ ] 브로드캐스팅
- [ ] 성능 최적화
  - [ ] strand 사용
  - [ ] 메모리 관리
- [ ] 트러블슈팅
  - [ ] 공통 오류 해결
- [ ] 퀴즈 80% 이상 정답

**학습 시간**: _____ 시간 소요
**다음 튜토리얼**: _____
