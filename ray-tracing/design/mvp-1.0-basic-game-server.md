# MVP 1.0 – Basic Game Server 설계 일지
> WebSocket 기반 실시간 게임 서버의 기초 구현: 60 TPS 게임 루프, 플레이어 이동, PostgreSQL 연동

## 1. 문제 정의 & 요구사항

### 1.1 목표

1v1 듀얼 게임을 위한 최소한의 온라인 인프라를 구축한다:
- **실시간 통신**: WebSocket을 통한 양방향 통신
- **결정적 시뮬레이션**: 60 TPS (Ticks Per Second) 고정 스텝 게임 루프
- **플레이어 이동**: WASD + 마우스 입력 처리
- **데이터 영속성**: PostgreSQL을 통한 세션 이벤트 기록

### 1.2 기능 요구사항

#### 1.2.1 설정 관리 (GameConfig)
- **환경 변수 기반 설정 로드**:
  - `TICK_RATE`: 게임 루프 틱 속도 (기본값: 60)
  - `WEBSOCKET_PORT`: WebSocket 서버 포트 (기본값: 8080)
  - `HTTP_PORT`: HTTP 메트릭 서버 포트 (기본값: 8081)
  - `POSTGRES_DSN`: PostgreSQL 연결 문자열
- **불변성 보장**: 설정은 서버 시작 시 한 번만 로드하고 변경 불가

#### 1.2.2 게임 루프 (GameLoop)
- **고정 스텝 스케줄러**: 정확히 16.67ms (60 TPS) 간격으로 콜백 실행
- **지터 모니터링**: 틱 간격의 분산 추적 (목표: ≤1ms)
- **그레이스풀 셧다운**: `Stop()` 호출 시 현재 틱 완료 후 종료
- **메트릭 제공**:
  - 실제 TPS 계산
  - 최근 N개 틱의 실행 시간 이력

#### 1.2.3 플레이어 이동 시스템 (GameSession)
- **PlayerState 관리**:
  - 위치 `(x, y)` (미터 단위)
  - 바라보는 각도 `angle` (라디안)
  - 마지막 처리된 시퀀스 ID `last_seq`
- **입력 처리**:
  - WASD 플래그를 카디널 방향 벡터로 변환
  - 이동 속도: 5 m/s (고정)
  - 대각선 이동 시 속도 정규화 (√2로 나눔)
  - 마우스 벡터로 `atan2` 계산하여 facing angle 결정
- **동시성**:
  - 최대 2명의 플레이어 동시 지원
  - 플레이어별 독립적인 상태 관리

#### 1.2.4 WebSocket 입출력 (WebSocketServer)
- **입력 프로토콜** (텍스트 프레임):
  ```
  input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y>
  ```
  - `player_id`: 플레이어 고유 식별자 (문자열)
  - `seq`: 클라이언트 시퀀스 번호 (증가)
  - `up/down/left/right`: 키 상태 (1=눌림, 0=안눌림)
  - `mouse_x/mouse_y`: 마우스 월드 좌표

- **출력 프로토콜** (틱마다 브로드캐스트):
  ```
  state <player_id> <x> <y> <angle> <tick>
  ```
  - 각 연결된 클라이언트에 틱당 한 번 전송
  - 권위 있는 서버 상태만 전송

- **연결 관리**:
  - 그레이스풀 연결 해제 처리
  - 연결 수 메트릭 추적

#### 1.2.5 PostgreSQL 연동 (PostgresStorage)
- **연결 관리**:
  - 서버 시작 시 연결 시도
  - `isConnected()` 상태 확인 제공
  - 연결 실패 시 로그만 출력하고 서버는 계속 동작

- **세션 이벤트 기록**:
  - `recordSessionEvent(player_id, event)` 제공
  - 파라미터화된 `INSERT` 쿼리 사용 (SQL 인젝션 방지)
  - DB 사용 불가 시 에러 로그만 출력

#### 1.2.6 메트릭 & 로깅
- **Prometheus 메트릭**:
  - `game_tick_rate`: 현재 틱 레이트 (게이지)
  - `game_tick_duration_seconds`: 틱 실행 시간 (게이지)
  - 간단한 exposition 문자열 빌더 제공

- **로깅 정책**:
  - 서버 시작/종료
  - 새 연결/연결 해제
  - DB 에러
  - 모든 로그는 `std::cout`으로 출력

### 1.3 비기능 요구사항

#### 1.3.1 성능
- **틱 실행 분산**: 120 틱 샘플에서 ≤1.0ms 분산 (테스트로 검증)
- **WebSocket 레이턴시**: 입력→상태 응답 ≤20ms (루프백 환경)
- **메모리 안정성**: 장시간 실행 시 메모리 누수 없음

#### 1.3.2 확장성
- 동시 2 플레이어 처리 (1v1 듀얼)
- 이후 MVP에서 확장 가능한 아키텍처

#### 1.3.3 코드 품질
- C++17 표준 준수
- RAII 패턴으로 리소스 관리
- 스레드 안전성: `std::mutex`로 공유 상태 보호
- 테스트 커버리지 ≥70%

---

## 2. 아키텍처 설계

### 2.1 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                     WebSocket Clients                        │
│                  (Browser / Test Tools)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │ input frames
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              WebSocketServer (Boost.Beast)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ClientSession (per connection)                         │ │
│  │  - Parse input frames                                  │ │
│  │  - Forward to GameSession                              │ │
│  │  - Send state frames                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      GameSession                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PlayerRuntimeState (per player)                        │ │
│  │  - PlayerState (x, y, angle, seq)                      │ │
│  │  - ApplyInput(MovementInput)                           │ │
│  │  - Tick(delta) → 물리 업데이트                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                       GameLoop                               │
│  - Fixed-step scheduler (60 TPS)                            │
│  - SetUpdateCallback(tick_info)                             │
│  - Metrics tracking                                         │
└─────────────────────────────────────────────────────────────┘

       ┌──────────────────┐              ┌──────────────────┐
       │ PostgresStorage  │              │ MetricsHttpServer│
       │ (libpq)          │              │ (Prometheus)     │
       └──────────────────┘              └──────────────────┘
```

### 2.2 스레드 모델

**메인 스레드**:
- Boost.Asio io_context 실행
- WebSocket 연결 수락
- 입력 프레임 파싱 및 GameSession에 전달

**게임 루프 스레드**:
- 독립된 스레드에서 60 TPS로 실행
- 콜백에서 GameSession::Tick() 호출
- 상태 스냅샷을 WebSocketServer에 전달

**동기화**:
- `GameSession::mutex_` 로 플레이어 상태 보호
- `WebSocketServer::clients_mutex_` 로 연결 맵 보호
- 데드락 방지: 항상 같은 순서로 락 획득

---

## 3. 핵심 컴포넌트 상세 설계

### 3.1 GameLoop 설계

#### 3.1.1 고정 스텝 알고리즘

```cpp
void GameLoop::Run() {
    auto previous = std::chrono::steady_clock::now();
    auto next_frame = previous + target_delta_;

    while (true) {
        // 1. 종료 확인
        {
            std::unique_lock<std::mutex> lk(mutex_);
            if (stop_requested_) {
                running_ = false;
                break;
            }
        }

        // 2. 프레임 시작 시각 기록
        const auto frame_start = std::chrono::steady_clock::now();

        // 3. 콜백 실행 (GameSession::Tick)
        if (callback_) {
            TickInfo info{
                .tick = tick_counter_,
                .delta_seconds = target_delta_.count(),
                .frame_start = frame_start
            };
            callback_(info);
        }

        // 4. 메트릭 기록
        const auto frame_end = std::chrono::steady_clock::now();
        const auto elapsed = frame_end - frame_start;
        {
            std::lock_guard<std::mutex> lk(metrics_mutex_);
            last_durations_.push_back(
                std::chrono::duration<double>(elapsed).count()
            );
            if (last_durations_.size() > 120) {
                last_durations_.erase(last_durations_.begin());
            }
            tick_counter_++;
        }

        // 5. 다음 프레임까지 대기
        next_frame += target_delta_;
        std::this_thread::sleep_until(next_frame);
    }
}
```

**설계 포인트**:
- `std::chrono::steady_clock` 사용 (단조 증가 보장)
- `sleep_until` 로 누적 오차 방지
- 틱 시간 > 16.67ms 여도 다음 틱은 정확한 시각에 시작
- 최근 120개 틱의 실행 시간 보관 (2초분)

#### 3.1.2 메트릭 계산

```cpp
double GameLoop::CurrentTickRate() const {
    std::lock_guard<std::mutex> lk(metrics_mutex_);
    if (last_durations_.empty()) {
        return tick_rate_;
    }
    const double latest = last_durations_.back();
    if (latest == 0.0) {
        return tick_rate_;
    }
    return 1.0 / latest;  // 실제 TPS = 1 / 실행 시간
}
```

### 3.2 GameSession 설계

#### 3.2.1 PlayerState 구조

```cpp
struct PlayerState {
    std::string player_id;
    double pos_x{0.0};
    double pos_y{0.0};
    double angle{0.0};        // 라디안
    std::uint32_t last_seq{0};
};
```

#### 3.2.2 이동 입력 처리

```cpp
void GameSession::ApplyInput(
    const std::string& player_id,
    const MovementInput& input,
    double delta_seconds
) {
    std::lock_guard<std::mutex> lk(mutex_);

    auto it = players_.find(player_id);
    if (it == players_.end()) {
        return;  // 플레이어 없음
    }

    auto& runtime = it->second;
    auto& state = runtime.state;

    // 1. 시퀀스 번호 업데이트
    state.last_seq = input.seq;

    // 2. 이동 벡터 계산
    double dx = 0.0;
    double dy = 0.0;
    if (input.up) dy += 1.0;
    if (input.down) dy -= 1.0;
    if (input.left) dx -= 1.0;
    if (input.right) dx += 1.0;

    // 3. 정규화 (대각선 이동 시 속도 보정)
    const double len = std::sqrt(dx * dx + dy * dy);
    if (len > 0.0) {
        dx /= len;
        dy /= len;

        // 4. 위치 업데이트
        state.pos_x += dx * speed_per_second_ * delta_seconds;
        state.pos_y += dy * speed_per_second_ * delta_seconds;
    }

    // 5. 마우스로 facing angle 계산
    if (input.mouse_x != 0.0 || input.mouse_y != 0.0) {
        const double aim_dx = input.mouse_x - state.pos_x;
        const double aim_dy = input.mouse_y - state.pos_y;
        state.angle = std::atan2(aim_dy, aim_dx);
    }
}
```

**설계 포인트**:
- 대각선 이동 시 `√2` 속도 방지 위해 벡터 정규화
- `atan2` 사용으로 모든 사분면 커버
- 마우스 좌표가 0일 경우 angle 유지

#### 3.2.3 Tick 처리

```cpp
void GameSession::Tick(std::uint64_t tick, double delta_seconds) {
    // MVP 1.0에서는 입력 처리만 수행
    // 물리 시뮬레이션은 ApplyInput에서 이미 처리됨
    // 이후 MVP에서 projectile 업데이트 등 추가
}
```

### 3.3 WebSocketServer 설계

#### 3.3.1 연결 수락

```cpp
void WebSocketServer::DoAccept() {
    acceptor_.async_accept(
        [self = shared_from_this()](
            boost::beast::error_code ec,
            boost::asio::ip::tcp::socket socket
        ) {
            if (!ec) {
                // ClientSession 생성 및 시작
                auto session = std::make_shared<ClientSession>(
                    std::move(socket),
                    self
                );
                session->Start();
            }

            // 다음 연결 대기
            if (self->running_) {
                self->DoAccept();
            }
        }
    );
}
```

#### 3.3.2 ClientSession 입력 처리

```cpp
void ClientSession::OnRead(boost::beast::error_code ec, std::size_t bytes) {
    if (ec) {
        // 연결 종료 처리
        return;
    }

    // 1. 텍스트 프레임 파싱
    std::string message = boost::beast::buffers_to_string(buffer_.data());
    buffer_.consume(bytes);

    // 2. "input" 프로토콜 파싱
    std::istringstream iss(message);
    std::string cmd;
    iss >> cmd;

    if (cmd == "input") {
        std::string player_id;
        std::uint32_t seq;
        int up, down, left, right;
        double mouse_x, mouse_y;

        iss >> player_id >> seq
            >> up >> down >> left >> right
            >> mouse_x >> mouse_y;

        // 3. MovementInput 구성
        MovementInput input{
            .seq = seq,
            .up = (up != 0),
            .down = (down != 0),
            .left = (left != 0),
            .right = (right != 0),
            .mouse_x = mouse_x,
            .mouse_y = mouse_y
        };

        // 4. GameSession에 전달
        session_.ApplyInput(player_id, input, loop_.TargetDelta());

        // 5. 첫 입력 시 플레이어 등록
        if (player_id_.empty()) {
            player_id_ = player_id;
            server_->RegisterClient(player_id, shared_from_this());
            session_.UpsertPlayer(player_id);
        }
    }

    // 6. 다음 읽기 대기
    DoRead();
}
```

#### 3.3.3 상태 브로드캐스트

```cpp
void WebSocketServer::BroadcastState(std::uint64_t tick, double delta) {
    // 1. 모든 플레이어 상태 스냅샷
    auto states = session_.Snapshot();

    // 2. 각 클라이언트에 전송
    std::lock_guard<std::mutex> lk(clients_mutex_);
    for (const auto& state : states) {
        auto it = clients_.find(state.player_id);
        if (it == clients_.end()) {
            continue;
        }

        auto client = it->second.lock();
        if (!client) {
            continue;
        }

        // 3. "state" 프로토콜 생성
        std::ostringstream oss;
        oss << "state " << state.player_id << " "
            << state.pos_x << " " << state.pos_y << " "
            << state.angle << " " << tick;

        // 4. 비동기 전송
        client->Send(oss.str());
    }

    last_broadcast_tick_ = tick;
}
```

**설계 포인트**:
- `weak_ptr` 사용으로 댕글링 포인터 방지
- 스냅샷 먼저 획득 후 브로드캐스트 (락 시간 최소화)
- 비동기 전송으로 블로킹 방지

### 3.4 PostgresStorage 설계

#### 3.4.1 연결 관리

```cpp
PostgresStorage::PostgresStorage(const std::string& dsn)
    : dsn_(dsn), conn_(nullptr)
{
    conn_ = PQconnectdb(dsn.c_str());

    if (PQstatus(conn_) != CONNECTION_OK) {
        std::cerr << "PostgreSQL connection failed: "
                  << PQerrorMessage(conn_) << std::endl;
        PQfinish(conn_);
        conn_ = nullptr;
    } else {
        std::cout << "PostgreSQL connected" << std::endl;
    }
}

bool PostgresStorage::isConnected() const {
    return conn_ != nullptr && PQstatus(conn_) == CONNECTION_OK;
}
```

#### 3.4.2 세션 이벤트 기록

```cpp
void PostgresStorage::recordSessionEvent(
    const std::string& player_id,
    const std::string& event
) {
    if (!isConnected()) {
        std::cerr << "Cannot record event: DB not connected" << std::endl;
        return;
    }

    // 파라미터화된 쿼리 (SQL 인젝션 방지)
    const char* query =
        "INSERT INTO session_events (player_id, event, created_at) "
        "VALUES ($1, $2, NOW())";

    const char* params[2] = {player_id.c_str(), event.c_str()};

    PGresult* result = PQexecParams(
        conn_, query,
        2,      // 파라미터 개수
        nullptr, params, nullptr, nullptr,
        0       // 텍스트 포맷
    );

    if (PQresultStatus(result) != PGRES_COMMAND_OK) {
        std::cerr << "INSERT failed: "
                  << PQerrorMessage(conn_) << std::endl;
    }

    PQclear(result);
}
```

---

## 4. 프로토콜 설계

### 4.1 WebSocket 프로토콜

**클라이언트 → 서버 (입력)**:
```
input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y>
```

**예시**:
```
input player1 0 1 0 0 0 150.5 200.0
```
- W키 누름 (`up=1`)
- 마우스 위치 (150.5, 200.0)

**서버 → 클라이언트 (상태)**:
```
state <player_id> <x> <y> <angle> <tick>
```

**예시**:
```
state player1 105.0 200.0 0.785 123
```
- 위치: (105.0, 200.0)
- 각도: 0.785 라디안 (약 45도)
- 틱: 123

### 4.2 확장성 고려

프로토콜은 향후 확장을 위해 설계됨:
- MVP 1.1에서 `fire` 플래그 추가 예정
- MVP 1.3에서 `death` 이벤트 추가 예정

---

## 5. 동시성 & 스레드 안전성

### 5.1 락 순서 정책

**데드락 방지 규칙**:
1. `GameSession::mutex_` → `WebSocketServer::clients_mutex_` 순서로 획득
2. 같은 스레드에서 재귀 락 금지
3. 락 보유 중 I/O 작업 금지

### 5.2 경쟁 조건 분석

**시나리오 1**: 클라이언트가 입력을 보내는 동시에 게임 루프가 Tick 실행
```
Thread A (Asio):     ApplyInput() → mutex_ lock → 위치 업데이트
Thread B (GameLoop): Tick() → (현재는 비어있음, 충돌 없음)
                     BroadcastState() → Snapshot() → mutex_ lock → 읽기
```
→ `GameSession::mutex_`로 보호됨 ✅

**시나리오 2**: 클라이언트 연결 해제 중 상태 브로드캐스트
```
Thread A (Asio):     ~ClientSession() → UnregisterClient() → clients_mutex_
Thread B (GameLoop): BroadcastState() → clients_mutex_ → weak_ptr.lock()
```
→ `weak_ptr` 사용으로 안전 ✅

---

## 6. 성능 최적화

### 6.1 핫 패스 분석

**1초당 호출 횟수**:
- `GameLoop::Run()`: 60회
- `GameSession::ApplyInput()`: ~60회 × 2 플레이어 = 120회
- `WebSocketServer::BroadcastState()`: 60회

**병목 지점**:
- 틱당 16.67ms 예산
- ApplyInput: < 0.1ms (간단한 벡터 연산)
- BroadcastState: < 0.5ms (2 플레이어, 짧은 문자열)
- → **여유 있음**, MVP 1.0에서는 최적화 불필요

### 6.2 메모리 최적화

- `last_durations_` 벡터 크기 제한 (120개)
- `std::string` 재사용 (oss.str() 대신 버퍼 재활용 가능, 현재는 비용 낮음)
- `weak_ptr` 로 순환 참조 방지

---

## 7. 테스트 전략

### 7.1 유닛 테스트

**test_game_loop.cpp**:
```cpp
TEST(GameLoopTest, TickIntervalAccuracy) {
    GameLoop loop(60.0);
    std::atomic<int> tick_count{0};

    loop.SetUpdateCallback([&](const TickInfo& info) {
        tick_count++;
    });

    loop.Start();
    std::this_thread::sleep_for(std::chrono::seconds(2));
    loop.Stop();
    loop.Join();

    // 2초 동안 60 TPS → 약 120 틱
    EXPECT_GE(tick_count, 115);
    EXPECT_LE(tick_count, 125);
}

TEST(GameLoopTest, TickVariance) {
    GameLoop loop(60.0);
    loop.Start();
    std::this_thread::sleep_for(std::chrono::seconds(2));
    loop.Stop();
    loop.Join();

    auto durations = loop.LastDurations();
    ASSERT_GE(durations.size(), 100);

    // 평균 및 분산 계산
    double mean = 0.0;
    for (double d : durations) mean += d;
    mean /= durations.size();

    double variance = 0.0;
    for (double d : durations) {
        variance += (d - mean) * (d - mean);
    }
    variance /= durations.size();
    double stddev = std::sqrt(variance);

    // 표준편차 < 1ms
    EXPECT_LT(stddev * 1000.0, 1.0);
}
```

**test_game_session.cpp**:
```cpp
TEST(GameSessionTest, DiagonalMovementSpeedClamping) {
    GameSession session(60.0);
    session.UpsertPlayer("player1");

    MovementInput input{
        .seq = 1,
        .up = true,
        .right = true,  // 대각선
        .mouse_x = 100.0,
        .mouse_y = 100.0
    };

    // 1초 동안 이동
    for (int i = 0; i < 60; i++) {
        session.ApplyInput("player1", input, 1.0 / 60.0);
    }

    auto state = session.GetPlayer("player1");

    // 5 m/s × 1s = 5m 이동
    double dist = std::sqrt(state.pos_x * state.pos_x +
                           state.pos_y * state.pos_y);
    EXPECT_NEAR(dist, 5.0, 0.1);  // 오차 10cm
}

TEST(GameSessionTest, FacingAngleFromMouse) {
    GameSession session(60.0);
    session.UpsertPlayer("player1");

    // 플레이어가 (0, 0)에서 마우스 (1, 1) 바라봄
    MovementInput input{
        .mouse_x = 1.0,
        .mouse_y = 1.0
    };

    session.ApplyInput("player1", input, 0.016);
    auto state = session.GetPlayer("player1");

    // atan2(1, 1) = π/4 = 0.785 라디안
    EXPECT_NEAR(state.angle, M_PI / 4.0, 0.01);
}
```

### 7.2 통합 테스트

**test_websocket_server.cpp**:
```cpp
TEST(WebSocketIntegrationTest, InputToStateRoundTrip) {
    boost::asio::io_context io_context;
    GameSession session(60.0);
    GameLoop loop(60.0);

    WebSocketServer server(io_context, 8080, session, loop);
    server.Start();

    // 게임 루프 시작
    loop.SetUpdateCallback([&](const TickInfo& info) {
        session.Tick(info.tick, info.delta_seconds);
        // 상태 브로드캐스트는 WebSocketServer가 자동 처리
    });
    loop.Start();

    // 클라이언트 연결
    boost::asio::ip::tcp::socket socket(io_context);
    socket.connect(tcp::endpoint(
        boost::asio::ip::address::from_string("127.0.0.1"), 8080
    ));

    boost::beast::websocket::stream<tcp::socket> ws(std::move(socket));
    ws.handshake("127.0.0.1", "/");

    // 입력 전송
    std::string input_msg = "input player1 0 1 0 0 0 100.0 50.0";
    ws.write(boost::asio::buffer(input_msg));

    // 상태 수신 대기 (최대 1초)
    boost::beast::flat_buffer buffer;
    auto start = std::chrono::steady_clock::now();
    ws.read(buffer);
    auto end = std::chrono::steady_clock::now();

    // 레이턴시 확인
    auto latency = std::chrono::duration_cast<std::chrono::milliseconds>(
        end - start
    ).count();
    EXPECT_LT(latency, 20);  // < 20ms

    // 상태 메시지 파싱
    std::string response = boost::beast::buffers_to_string(buffer.data());
    EXPECT_TRUE(response.find("state player1") != std::string::npos);

    // 정리
    ws.close(boost::beast::websocket::close_code::normal);
    loop.Stop();
    server.Stop();
}
```

### 7.3 성능 테스트

**test_tick_variance.cpp**:
```cpp
TEST(PerformanceTest, TickVarianceUnderLoad) {
    GameLoop loop(60.0);
    GameSession session(60.0);

    // 2명의 플레이어 추가
    session.UpsertPlayer("player1");
    session.UpsertPlayer("player2");

    // 틱마다 입력 처리
    loop.SetUpdateCallback([&](const TickInfo& info) {
        MovementInput input{
            .up = true,
            .right = true,
            .mouse_x = 100.0,
            .mouse_y = 100.0
        };

        session.ApplyInput("player1", input, info.delta_seconds);
        session.ApplyInput("player2", input, info.delta_seconds);
        session.Tick(info.tick, info.delta_seconds);
    });

    loop.Start();
    std::this_thread::sleep_for(std::chrono::seconds(2));
    loop.Stop();
    loop.Join();

    // 분산 검증
    auto durations = loop.LastDurations();
    double mean = 0.0;
    for (double d : durations) mean += d;
    mean /= durations.size();

    double variance = 0.0;
    for (double d : durations) {
        variance += (d - mean) * (d - mean);
    }
    variance /= durations.size();

    // 표준편차 < 1ms
    EXPECT_LT(std::sqrt(variance) * 1000.0, 1.0);
}
```

---

## 8. 배포 & 운영

### 8.1 환경 변수 설정

```bash
export TICK_RATE=60
export WEBSOCKET_PORT=8080
export HTTP_PORT=8081
export POSTGRES_DSN="host=localhost port=5432 dbname=arena60 user=arena60 password=arena60"
```

### 8.2 Docker 환경

**docker-compose.yml** (PostgreSQL):
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: arena60
      POSTGRES_USER: arena60
      POSTGRES_PASSWORD: arena60
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 8.3 모니터링

**Prometheus 쿼리 예시**:
```promql
# 틱 레이트 모니터링
game_tick_rate

# 틱 실행 시간 (밀리초)
game_tick_duration_seconds * 1000

# 틱 레이트 안정성 (1분 평균)
avg_over_time(game_tick_rate[1m])
```

---

## 9. 알려진 제약사항 & 향후 개선

### 9.1 현재 제약사항

1. **맵 경계 없음**: 플레이어가 무한히 이동 가능
   - **해결**: MVP 1.1에서 월드 경계 추가 예정

2. **연결 인증 없음**: 누구나 임의의 player_id로 접속 가능
   - **해결**: 향후 JWT 토큰 기반 인증 추가

3. **재연결 미지원**: 연결 끊김 시 세션 손실
   - **해결**: 세션 복구 메커니즘 필요

4. **PostgreSQL 선택적**: DB 없어도 서버 동작
   - **현재**: 로그만 출력
   - **개선**: 필수 컴포넌트로 전환 또는 대체 저장소 제공

### 9.2 향후 개선 방향

**MVP 1.1**:
- Combat 시스템 추가
- Projectile 물리
- Health & Death 관리

**MVP 1.2**:
- Matchmaking 서비스
- Redis 큐 통합

**MVP 1.3**:
- 통계 & 랭킹
- ELO 레이팅
- HTTP API 확장

---

## 10. 참고 자료

### 10.1 외부 문서
- [Boost.Asio 공식 문서](https://www.boost.org/doc/libs/release/doc/html/boost_asio.html)
- [Boost.Beast WebSocket 예제](https://www.boost.org/doc/libs/release/libs/beast/doc/html/beast/examples.html)
- [libpq 프로그래밍 가이드](https://www.postgresql.org/docs/current/libpq.html)
- [Fixed Timestep 게임 루프](https://gafferongames.com/post/fix_your_timestep/)

### 10.2 코드 위치
- `server/include/arena60/core/game_loop.h` - GameLoop 헤더
- `server/src/core/game_loop.cpp` - 고정 스텝 구현
- `server/include/arena60/game/game_session.h` - GameSession 헤더
- `server/src/game/game_session.cpp` - 이동 로직
- `server/include/arena60/network/websocket_server.h` - WebSocket 서버
- `server/src/network/websocket_server.cpp` - 연결 관리
- `server/tests/unit/test_game_loop.cpp` - 게임 루프 테스트
- `server/tests/integration/test_websocket_server.cpp` - 통합 테스트

---

**작성일**: 2025-01-30
**MVP 버전**: 1.0
**상태**: ✅ 완료 (Checkpoint A)
