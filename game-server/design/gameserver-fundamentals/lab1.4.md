# WebSocket 멀티룸 채팅 서버 설계 일지 (C++ / Boost.Beast)
## 0. 목표 / 범위 정리
### 0.1 최종 목표

* C++17 / Boost.Asio / Boost.Beast 기반 Pong 게임 서버
* WebSocket + JSON 프로토콜
* 구성 요소:

  * 서버: `main.cpp`, `pong_server.{h,cpp}`, `pong_game.{h,cpp}`
  * 브라우저 클라: `pong_client.html`
  * 메트릭 클라: `metrics_client.cpp`
* 특징 (게임 서버스럽게):

  * **매치(룸) 추상화**: `PongMatch`
  * **재접속 / 역할 복구**: `player_id` 기반
  * **입력 시퀀스 / 타임싱크**: `seq`, `tick`, `server_time_ms`
  * **서버/클라 메트릭**: tick 간격, input latency

### 0.2 비범위

* 멀티 매치 동시 운영(코드 구조는 대비, 실제 동시 운영은 1매치로 고정)
* 외부 DB / 영속 저장소
* 복잡한 매치메이킹, 랭킹 시스템
* 클라 prediction/rollback 구현 (프로토콜만 지원)

## 1. 전체 구조 개요

### 1.1 프로세스 / 스레드

* 프로세스: 1개
* 스레드:

  * `io_context` 스레드 1개
  * 게임 루프 스레드 1개

### 1.2 주요 타입/파일

* `pong_game.h / .cpp`

  * `class PongGame`
  * `struct GameSnapshot`

* `pong_server.h / .cpp`

  * `class PongServer`

    * `class Session` (내부 혹은 별도)
    * `class PongMatch`
    * 메트릭 구조체들

* `main.cpp`

  * 인자 파싱, `PongServer` 생성, signal 처리

* 클라이언트:

  * `pong_client.html`
  * `metrics_client.cpp`

---

## 2. 프로토콜 설계 (JSON)

**모든 메시지 공통 필드**

* `type`: 문자열
* 선택: `match_id`, `server_time_ms`, `tick`

### 2.1 초기 핸드셰이크

#### 클라 → 서버: `hello`

```json
{
  "type": "hello",
  "player_id": "optional-or-null",
  "match_id": "optional-or-null",
  "client_time_ms": 1730000000000
}
```

#### 서버 → 클라: `welcome`

```json
{
  "type": "welcome",
  "player_id": "assigned-or-echoed-id",
  "match_id": "default",
  "role": "left | right | spectator",
  "reconnected": true,
  "server_time_ms": 1730000000000,
  "tick": 1234,
  "tick_rate": 60
}
```

### 2.2 서버 → 클라이언트

1. `roles`

```json
{
  "type": "roles",
  "match_id": "default",
  "slots": {
    "left":  { "status": "active | reconnecting | empty" },
    "right": { "status": "active | reconnecting | empty" }
  }
}
```

2. `state`

```json
{
  "type": "state",
  "match_id": "default",
  "tick": 1234,
  "server_time_ms": 1730000000000,
  "ball": { "x": 0.5, "y": 0.3, "vx": 0.01, "vy": -0.02 },
  "paddles": {
    "left":  { "y": 0.4, "dir": -1 },
    "right": { "y": 0.6, "dir": 0 }
  },
  "scores": { "left": 2, "right": 3 }
}
```

3. `input-ack`

```json
{
  "type": "input-ack",
  "match_id": "default",
  "seq": 42,
  "applied_direction": -1,
  "applied_tick": 1235,
  "latency_ms": 23.4,
  "server_time_ms": 1730000000000
}
```

4. `pong`

```json
{
  "type": "pong",
  "match_id": "default",
  "tick": 1234,
  "server_time_ms": 1730000000000
}
```

5. `metrics`

```json
{
  "type": "metrics",
  "match_id": "default",
  "server_time_ms": 1730000000000,
  "ticks": {
    "samples": 1000,
    "min_ms": 16.0,
    "max_ms": 20.0,
    "avg_ms": 16.7
  },
  "input_latency": {
    "samples": 500,
    "min_ms": 10.0,
    "max_ms": 50.0,
    "avg_ms": 20.0
  }
}
```

### 2.3 클라이언트 → 서버

1. `input`

```json
{
  "type": "input",
  "match_id": "default",
  "seq": 42,
  "direction": -1,
  "client_time_ms": 1730000000000
}
```

2. `ping`

```json
{
  "type": "ping",
  "match_id": "default",
  "client_time_ms": 1730000000000
}
```

3. `metrics-request`

```json
{
  "type": "metrics-request",
  "match_id": "default"
}
```

---

## 3. 도메인 모델 설계

### 3.1 PongGame (`pong_game.h / .cpp`)

**역할**: 순수 게임 로직만 담당. 네트워크 모름.

```cpp
enum class PlayerSide { Left, Right };

struct GameSnapshot {
    uint64_t tick;
    float ball_x, ball_y;
    float ball_vx, ball_vy;
    float left_paddle_y, right_paddle_y;
    int   left_direction, right_direction;
    uint32_t left_score, right_score;
};
```

```cpp
class PongGame {
public:
    PongGame();

    GameSnapshot snapshot() const;

    void set_player_direction(PlayerSide side, int direction);
    GameSnapshot update(double dt_seconds);

private:
    mutable std::mutex mutex_;

    GameSnapshot state_;

    void reset_ball_locked();
    void step_locked(double dt);
};
```

**구현 포인트**

* 좌표 범위는 0.0~1.0 로 정규화.
* 패들 이동 속도, 공 속도, 반사 로직은 상수로 관리.
* `update` 안에서:

  * 입력 방향에 따라 패들 위치 변화
  * 벽/패들 충돌
  * 점수 발생 시 `reset_ball_locked()` 호출

---

### 3.2 PongMatch (`pong_server.h / .cpp`)

**역할**: 단일 매치(룸) 단위 게임 관리.

```cpp
struct PlayerSlot {
    std::string player_id;
    std::weak_ptr<class Session> session;
    enum class Status { Empty, Active, Reconnecting } status = Status::Empty;
    std::chrono::steady_clock::time_point disconnected_at;
};

struct PendingAck {
    bool pending = false;
    uint64_t seq = 0;
    std::chrono::steady_clock::time_point requested_at;
    int direction = 0;
    uint64_t target_tick = 0;
};

class PongMatch {
public:
    explicit PongMatch(std::string match_id);

    const std::string& id() const noexcept;

    // 게임 루프에서 호출
    GameSnapshot update(double dt_seconds);
    void handle_pending_acks(const GameSnapshot& snap);

    // 세션/플레이어 관리
    void on_session_hello(std::shared_ptr<Session> session,
                          const std::string& optional_player_id,
                          /* out */ std::string& assigned_player_id,
                          /* out */ std::string& role,
                          /* out */ bool& reconnected);

    void on_session_disconnected(std::shared_ptr<Session> session);

    void on_input(std::shared_ptr<Session> session,
                  int direction,
                  uint64_t seq);

    void for_each_session(std::function<void(std::shared_ptr<Session>)> fn);

    // roles 브로드캐스트용 상태 조회
    void get_roles_snapshot(/* out 구조체 */) const;

private:
    std::string match_id_;
    mutable std::mutex mutex_;

    PongGame game_;
    PlayerSlot left_;
    PlayerSlot right_;
    std::vector<std::weak_ptr<Session>> spectators_;

    PendingAck left_pending_;
    PendingAck right_pending_;

    std::chrono::milliseconds reconnect_timeout_{10000};

    // 내부 헬퍼들
    void attach_player_locked(std::shared_ptr<Session>, const std::string& player_id);
    void attach_spectator_locked(std::shared_ptr<Session>, const std::string& player_id);
    void detach_session_locked(std::shared_ptr<Session>);
    void cleanup_reconnect_timeouts_locked();
};
```

**핵심 로직 요약**

* `on_session_hello`:

  * `player_id` 있으면 재접속 후보, 없으면 새 id 발급.
  * 기존 슬롯(left/right) 중 `player_id`가 일치하고 `Status::Reconnecting`이면 그 슬롯에 attach.
  * 아니면:

    * `Empty` 슬롯 있으면 left → right 순으로 배정.
    * 둘 다 차면 spectator.
* `on_input`:

  * 세션이 어떤 슬롯인지 확인 후:

    * `PongGame::set_player_direction` 호출
    * 해당 슬롯의 `PendingAck` 업데이트 (`pending=true`, `seq`, `requested_at`, `target_tick = current_tick + 1`, `direction`)
* `update`:

  * `PongGame::update(dt)` 호출 후 snapshot 반환.
* `handle_pending_acks`:

  * `snapshot.tick`가 `PendingAck.target_tick` 이상인 pending 들에 대해:

    * latency 계산
    * `Session`에 `input-ack` 전송
    * 서버 메트릭에 기록(실제 기록은 `PongServer`로 콜백)

---

### 3.3 PongServer & Session (`pong_server.h / .cpp`)

```cpp
class PongServer : public std::enable_shared_from_this<PongServer> {
public:
    PongServer(boost::asio::io_context& ioc,
               tcp::endpoint endpoint);

    void run();
    void stop();

    // 게임 루프용
    GameSnapshot current_snapshot(const std::string& match_id);

    // 매치 접근
    std::shared_ptr<PongMatch> get_or_create_match(const std::string& id);

    // 메트릭 스냅샷
    struct TickMetrics { ... };
    struct InputLatencyMetrics { ... };
    struct MetricsSnapshot { TickMetrics ticks; InputLatencyMetrics input; };

    MetricsSnapshot metrics_snapshot(const std::string& match_id) const;

private:
    boost::asio::io_context& ioc_;
    tcp::acceptor acceptor_;

    mutable std::mutex mutex_;
    std::unordered_map<std::string, std::shared_ptr<PongMatch>> matches_;

    std::atomic<bool> running_{false};
    std::thread loop_thread_;

    // 서버 메트릭
    bool have_last_tick_time_ = false;
    std::chrono::steady_clock::time_point last_tick_time_;
    TickMetrics tick_metrics_;
    InputLatencyMetrics input_latency_metrics_;

    void do_accept();
    void on_accept(boost::system::error_code ec, tcp::socket socket);

    void game_loop();
    void precise_sleep_until(std::chrono::steady_clock::time_point tp);

    void record_tick_interval(double ms);
    void record_input_latency(double ms);

    friend class Session;
};
```

#### Session (요약)

```cpp
class Session : public std::enable_shared_from_this<Session> {
public:
    Session(PongServer& server, tcp::socket socket);

    void run();
    void send(std::string message);

    // PongMatch에서 사용
    std::string player_id() const;
    std::string match_id() const;

private:
    PongServer& server_;
    websocket::stream<tcp::socket> ws_;
    boost::beast::flat_buffer buffer_;
    std::deque<std::string> write_queue_;
    bool write_in_progress_ = false;

    std::string player_id_;
    std::string match_id_;

    void do_read();
    void on_read(boost::system::error_code ec, std::size_t bytes_transferred);
    void on_write(boost::system::error_code ec, std::size_t bytes_transferred);

    void handle_hello(const nlohmann::json& j);
    void handle_input(const nlohmann::json& j);
    void handle_ping(const nlohmann::json& j);
    void handle_metrics_request(const nlohmann::json& j);
};
```

**핵심 흐름**

1. `run()`에서 async_accept 완료 후:

   * `do_read()` 호출
   * 첫 메시지는 반드시 `hello`로 처리 (`handle_hello`)
2. `handle_hello`:

   * `match_id`, `player_id` 추출
   * `PongServer::get_or_create_match` → `PongMatch::on_session_hello` 호출
   * `welcome` + 초기 `state` + `roles` 전송
3. 이후:

   * `input` → 해당 매치의 `on_input`
   * `ping` → `pong`
   * `metrics-request` → `metrics` 응답

---

## 4. 구현 순서 (단계별 가이드)

### 단계 1. 프로젝트 스캐폴딩 & 빌드

**파일 준비**

* `pong_game.h / .cpp`
* `pong_server.h / .cpp`
* `main.cpp`
* (나중) `metrics_client.cpp`, `pong_client.html`

**할 일**

1. CMake 또는 빌드 스크립트에서 위 파일들 빌드 설정.
2. Boost.Asio / Boost.Beast 포함 경로, 링크 설정.
3. 빈 클래스 골격만 만들어서 빌드 통과 확인.

---

### 단계 2. PongGame 구현

**대상 파일**: `pong_game.h / .cpp`

1. `GameSnapshot` 구조체 정의.
2. `PongGame` 멤버 변수:

   * `GameSnapshot state_;`
   * `std::mutex mutex_;`
3. `PongGame` 생성자에서 초기 상태 세팅.
4. `snapshot()`:

   * `lock_guard` → `state_` 복사 반환.
5. `set_player_direction`:

   * side에 따라 `state_.left_direction` 또는 `right_direction` 설정.
6. `update(double dt)`:

   * lock 잡고:

     * 입력 기반 패들 y 이동
     * 상하 경계 clamp
     * 공 이동
     * 벽/패들 충돌 처리
     * 점수 처리 시 `reset_ball_locked()`
     * `state_.tick++`
   * 최종 `state_` 복사해 반환.

**테스트**

* 임시 `main`에서 `PongGame`만 돌려보고 tick, ball 위치 printf로 확인.

---

### 단계 3. PongServer 기본 골격 + main

**대상 파일**: `pong_server.h / .cpp`, `main.cpp`

1. `PongServer` 생성자:

   * `acceptor_(ioc, endpoint)` 초기화
2. `run()`:

   * `running_ = true`
   * `loop_thread_ = std::thread(&PongServer::game_loop, this)`
   * `do_accept()`
3. `stop()`:

   * `running_ = false`
   * `acceptor_.close()`
   * `loop_thread_.join()` (joinable 체크)
4. `do_accept()` / `on_accept()`:

   * `acceptor_.async_accept(...)` → 성공 시 `std::make_shared<Session>` 생성 후 `run()`
5. `main.cpp`:

   * `io_context` 생성
   * `endpoint` (host/port) 인자 파싱
   * `auto server = std::make_shared<PongServer>(ioc, endpoint);`
   * `server->run();`
   * `signal_set`으로 SIGINT/SIGTERM 등록 → 콜백에서 `server->stop(); ioc.stop();`
   * `ioc.run();`

**테스트**

* 아직 WebSocket/X는 안 맞춰도 됨. 그냥 accept 로그만 출력.

---

### 단계 4. Session + WebSocket 핸드셰이크

**대상 파일**: `pong_server.{h,cpp}`

1. `Session` 클래스 정의:

   * `websocket::stream<tcp::socket> ws_;`
   * `flat_buffer buffer_;`
   * `run()`에서:

     * `ws_.set_option(...)` (timeout, decorator 등)
     * `ws_.async_accept(...)` → `on_accept`
   * `on_accept` 성공 시 `do_read()`
2. `do_read()`:

   * `ws_.async_read(buffer_, ...)` → `on_read`
3. `on_read()`:

   * 에러 처리 후, 성공이면 buffer → 문자열 → JSON parse 준비
   * 일단 “받은 문자열 그대로 echo" 정도로 시작
4. `send(std::string)` + write 큐:

   * `write_queue_` 비었을 때만 `async_write` 시작
   * `on_write()`에서 큐 pop 후 남은 게 있으면 다시 write

**테스트**

* 임시로 text echo 서버.
* 브라우저 콘솔이나 `websocat` 같은 툴로 접속해서 메시지 왕복 확인.

---

### 단계 5. hello / welcome / match 기본 연결

**대상**: `Session::handle_hello`, `PongServer::get_or_create_match`, `PongMatch::on_session_hello`

1. `Session::on_read()`에서:

   * `nlohmann::json j = nlohmann::json::parse(text);`
   * `j["type"]`가 `"hello"`면 `handle_hello(j)` 호출.
2. `handle_hello`:

   * `match_id = j.value("match_id", "default");`
   * `optional_player_id = j.value("player_id", "");`
   * `server_.get_or_create_match(match_id)` 호출
   * `PongMatch::on_session_hello(shared_from_this(), optional_player_id, assigned_player_id, role, reconnected);`
   * 멤버 `player_id_`, `match_id_` 채우기
   * `welcome` JSON 만들어서 `send()`
   * `roles`도 함께 브로드캐스트하도록 서버에 요청
3. `PongServer::get_or_create_match`:

   * mutex lock
   * map에서 찾고 없으면 `std::make_shared<PongMatch>(match_id)` 생성해서 저장/반환
4. `PongMatch::on_session_hello`:

   * mutex lock
   * reconnect 후보 찾기 → 정책대로 결정 → `assigned_player_id`, `role`, `reconnected` 채움
   * spectators_에 새 세션 push

**테스트**

* 브라우저 devtools로 `hello` 보내고 `welcome` 응답 확인.
* 여러 탭 연결해서 역할 할당(left/right/spectator) 잘 나오는지 확인.

---

### 단계 6. 게임 루프 + state 브로드캐스트

**대상**: `PongServer::game_loop`, `PongMatch::update`, `PongMatch::for_each_session`

1. `PongServer::game_loop()`:

   * `auto next_tick = steady_clock::now();`
   * while(running_):

     * `next_tick += frame_duration(16.666ms)`
     * `precise_sleep_until(next_tick)`
     * 각 매치에 대해:

       * `match->update(dt)`
       * `match->handle_pending_acks(snapshot)` (나중 단계에서 fleshing)
       * `state` JSON 만들고 `match->for_each_session([&](session){ session->send(state_json); });`
     * tick 메트릭 기록
2. `PongMatch::update`:

   * `return game_.update(dt_seconds);`
3. state JSON 구성:

   * `GameSnapshot` → 필드 그대로 매핑.

**테스트**

* 브라우저 클라에서 `state` 로그 찍고, ball/paddle 움직이는 값 넘어오는지만 확인.
* 아직 입력은 안 붙여도 됨.

---

### 단계 7. 입력 처리 + PendingAck + input-ack

**대상**: `PongMatch::on_input`, `PongMatch::handle_pending_acks`, `Session::handle_input`

1. `Session::handle_input`:

   * `direction = j["direction"].get<int>();`
   * `seq = j["seq"].get<uint64_t>();`
   * `auto match = server_.get_or_create_match(match_id_);`
   * `match->on_input(shared_from_this(), direction, seq);`
2. `PongMatch::on_input`:

   * mutex lock
   * 이 세션이 left인지 right인지 찾기
   * 해당 side에 대해:

     * `game_.set_player_direction(side, direction);`
     * `PendingAck& pa = (side == Left ? left_pending_ : right_pending_);`
     * `pa.pending = true; pa.seq = seq; pa.direction = direction;`
     * `pa.requested_at = steady_clock::now();`
     * 현재 snapshot or 내부 state tick + 1 → `pa.target_tick` 설정
3. `PongMatch::handle_pending_acks`:

   * snapshot.tick를 기준으로:

     * left/right `PendingAck`가 `pending && snapshot.tick >= target_tick`이면:

       * `now = steady_clock::now();`
       * `latency_ms = duration_cast<milliseconds>(now - pa.requested_at).count();`
       * 해당 `Session`의 shared_ptr lock
       * `input-ack` JSON 만들어 `session->send(...)`
       * `server_.record_input_latency(latency_ms);`
       * `pa.pending = false;`

**테스트**

* 브라우저에서 `input` 보내고, `input-ack` 수신 확인.
* `applied_tick`, `seq`, `latency_ms` 값이 정상인지 로그 확인.

---

### 단계 8. 타임싱크 / seq / server_time_ms 정식 반영

**대상**: state, input-ack, pong, metrics JSON 생성 코드

1. 서버 현재 시간:

   * `auto now_sys = std::chrono::system_clock::now();`
   * `int64_t server_time_ms = duration_cast<milliseconds>(now_sys.time_since_epoch()).count();`
2. `state` / `input-ack` / `pong` / `metrics` 메시지 작성 시:

   * `server_time_ms` 필드 추가.
3. 클라가 보내는 메시지에선 `client_time_ms` 받아서 지금은 단순히 무시해도 됨.
4. 입력 시퀀스:

   * 이미 `seq`를 사용 중이므로, 이 값이 그대로 왕복하도록 유지.

**테스트**

* 클라 로그에서 각 메시지 `server_time_ms` 증가하는지 확인.
* `seq` 왕복, `applied_tick` 증가 확인.

---

### 단계 9. 재접속 로직 마무리

**대상**: `PongMatch::on_session_disconnected`, `cleanup_reconnect_timeouts_locked`, 역할 스냅샷

1. `Session` 소멸 / close 시:

   * `PongServer`로 콜백 → 해당 match의 `on_session_disconnected(shared_from_this())`
2. `PongMatch::on_session_disconnected`:

   * mutex lock
   * 해당 session이 left/right면:

     * status = `Reconnecting`
     * `disconnected_at = now`
   * spectator면 `spectators_`에서 제거
3. `cleanup_reconnect_timeouts_locked`:

   * 게임 루프에서 일정 주기마다 호출:

     * reconnect_timeout 지난 슬롯은 `Status::Empty`로 변경, `player_id` 비움
4. `get_roles_snapshot`:

   * left/right status를 한 번에 반환
   * `PongServer`가 이걸 이용해 `roles` 메시지 브로드캐스트

**테스트**

* 브라우저 탭 닫기 → 일정 시간 내 다시 접속:

  * `welcome.reconnected == true`
  * 이전 역할 유지
* reconnect_timeout 넘긴 후 접속:

  * 새 player로 배정.

---

### 단계 10. 브라우저 클라이언트 (`pong_client.html`)

**핵심 구현 포인트**

1. `player_id` 관리

   * `localStorage.getItem("pong_player_id")`
   * 없으면 null로 `hello` 보냄
   * `welcome.player_id` 받으면 localStorage에 저장
2. WebSocket 연결

   * `new WebSocket("ws://host:port");`
   * `onopen`에서 `hello` 전송
3. 메시지 핸들링

   * `welcome` → 역할, tick_rate, match_id 저장
   * `roles` → UI에 슬롯 상태(선택)
   * `state` → 마지막 상태를 전역 변수에 저장 후 Canvas render
   * `input-ack` → 마지막 입력 지연 표시
4. 입력 전송

   * 현재 키 상태를 관리(W/S/↑/↓).
   * 일정 주기(예: requestAnimationFrame 또는 setInterval 30~60Hz)로:

     * 현재 방향 결정 → direction
     * `seq++`
     * `input` 메시지 전송

---

### 단계 11. metrics_client.cpp

**역할**

* 서버에 붙어서:

  * 주기적으로 입력 토글
  * `state` 도착 간격으로 tick 간격 측정
  * `input-ack.latency_ms`로 input latency 측정
  * 일정 간격마다 `metrics-request` 보내서 서버 메트릭 조회

**구현 흐름**

1. `websocket::stream<tcp::socket>`로 서버 연결.
2. `hello` 전송 (player_id 생략 or 고정 값 지정).
3. 별도 쓰레드 or sync 루프에서:

   * 일정 주기마다 `input` 토글
4. 읽기 루프:

   * `state` → last_state_time과의 차이로 tick 간격 샘플링
   * `input-ack` → latency_ms 모아서 평균/최소/최대
   * `metrics` → 서버 메트릭 출력

---

## 5. 언제 “완료"로 볼 수 있는지 체크리스트

1. 서버가 60 tick/s 근사로 안정적으로 동작.
2. 브라우저 2개 접속:

   * 첫 두 명이 left/right, 이후 spectator.
   * 입력에 따라 패들이 정상적으로 움직임.
3. 브라우저 탭 강제 종료 후 재접속:

   * 같은 `player_id`로 들어가면 같은 역할 복구.
4. `input-ack`:

   * `seq`가 그대로 돌아옴.
   * `latency_ms`가 0이 아닌 합리적인 값.
5. `metrics_client`:

   * tick interval 평균 ~16~17ms 근처.
   * input latency 통계 출력.
6. Ctrl+C로 종료 시:

   * 서버가 죽지 않고 정상 종료.
   * 재실행 시 포트 bind 문제 없이 바로 뜸.