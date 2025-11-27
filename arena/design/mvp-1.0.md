# 기본 게임 서버 설계 일지 (MVP 1.0)
> 1v1 듀얼 게임을 위한 최소 온라인 인프라 구현 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Checkpoint A 듀얼 게임을 위한 최소 온라인 인프라 제공:
- 단일 매치 서버로 플레이어 WebSocket 연결 수용
- 결정적 60 ticks-per-second 시뮬레이션 루프 실행
- 키보드 + 마우스 이동 입력 처리
- 세션 라이프사이클 이벤트를 PostgreSQL에 영속화

### 1.2 기능 요구사항

#### 1.2.1 설정 로딩
- 환경 변수에서 틱 레이트, 포트, 데이터베이스 DSN 로드
- 안전한 기본값 제공
- `GameConfig`를 통해 노출

#### 1.2.2 결정적 게임 루프
- 16.67ms ±1ms마다 콜백 실행하는 `GameLoop` 구현
- Start/Stop, 실제 TPS 메트릭, 정상 종료 제공

#### 1.2.3 플레이어 이동 시스템
- 두 명의 동시 플레이어를 지원하는 `PlayerState`를 가진 `GameSession` 구현
- WASD 플래그를 기본 속도(5 m/s)로 해석
- 마우스 벡터가 `atan2`를 통해 방향 각도 설정
- 정규화된 벡터를 사용하여 대각선 속도 제한

#### 1.2.4 WebSocket 입출력
- Boost.Beast를 사용한 `WebSocketServer` 구현
- 텍스트 프레임 형식: `input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y>`
- `GameSession`을 통해 입력 적용
- 틱당 한 번씩 각 연결에 `state <player_id> <x> <y> <angle> <tick>` 응답
- 정상 연결 해제 지원

#### 1.2.5 PostgreSQL 통합
- libpq를 사용하는 `PostgresStorage` 제공
- 서버 시작 시 연결 시도, `isConnected()` 노출
- 파라미터화된 `INSERT`를 통해 이벤트를 저장하는 `recordSessionEvent(player_id, event)` 구현
- DB를 사용할 수 없을 때 오류 로그만 기록하고 서버는 계속 실행

#### 1.2.6 메트릭 & 로깅
- 간단한 Prometheus exposition string builder를 통해 `game_tick_rate` 및 `game_tick_duration_seconds` 발행
- 주요 라이프사이클 이벤트 로그 (시작, 새 연결, 연결 해제, DB 오류)

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 틱 실행 편차 ≤ 1.0ms (120 틱 샘플 기준, 테스트에서 검증)
- WebSocket 에코 지연(입력 → 상태) ≤ 20ms (루프백 테스트 하네스)

#### 1.3.2 코드 품질
- C++17 현대적 관용구 (RAII, 스마트 포인터, 이동 의미론)
- 스레드 안전성: `std::mutex`, `std::atomic`
- Const-correctness: `const` 메서드, `noexcept`
- 명시적 오류 처리

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 60 TPS인가?

**게임 루프 틱 레이트 선택:**
- **60 Hz = 16.67ms 틱**: 표준 디스플레이 주사율과 일치
- **결정론**: 고정 시간 단계로 예측 가능한 물리 시뮬레이션
- **응답성**: 16.67ms 틱은 인간의 반응 시간에 충분히 빠름 (평균 ~200ms)

**트레이드오프:**
- 더 높은 틱 레이트 (120 Hz): CPU 사용량 2배, 네트워크 대역폭 증가
- 더 낮은 틱 레이트 (30 Hz): 지연 인식 증가, 응답성 저하

### 2.2 WebSocket vs UDP

**MVP 1.0에서 WebSocket을 선택한 이유:**
- **개발 속도**: 브라우저 네이티브 지원, 방화벽 친화적
- **디버깅**: 텍스트 프레임, 쉬운 검사
- **신뢰성**: TCP 기반, 패킷 순서 보장
- **HTTP 호환성**: 기존 인프라와 통합

**제약사항 (MVP 1.1+에서 해결):**
- Head-of-Line Blocking (나중에 UDP로 전환)
- 높은 오버헤드 (프로토콜 버퍼로 최적화)

---

## 3. 아키텍처 설계

### 3.1 시스템 레이어

```
┌──────────────────────────────────────┐
│         Clients (WebSocket)          │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│      WebSocketServer (Boost.Beast)   │
│  ┌────────────────────────────────┐  │
│  │   GameLoop (60 TPS)            │  │
│  │     └─ Callback notification   │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │   GameSession                  │  │
│  │     ├─ Players (2 max)         │  │
│  │     ├─ Movement physics        │  │
│  │     └─ State snapshots         │  │
│  └────────────────────────────────┘  │
└──────────────┬───────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼────────┐
│ PostgreSQL  │  │ Prometheus    │
│ (Sessions)  │  │ (Metrics)     │
└─────────────┘  └───────────────┘
```

### 3.2 컴포넌트 책임

**GameConfig (config.h/cpp):**
- 환경 변수에서 설정 로드
- 불변 설정 홀더
- 스레드 안전 (생성 후 불변)

**GameLoop (game_loop.h/cpp):**
- 고정 시간 단계 스케줄러
- 60 TPS 유지 (적응형 슬립)
- 틱 지속 시간 메트릭 수집
- 정상 종료 (조건 변수)

**PlayerState (player_state.h):**
- 플레이어 데이터 모델 (위치, 방향, 시퀀스)
- 스냅샷 기반 상태 (클라이언트로 복사)

**MovementInput (movement.h):**
- 클라이언트 입력 구조
- 시퀀스 번호 (순서 보장)
- WASD + 마우스 좌표 + fire 플래그

**GameSession (game_session.h/cpp):**
- 게임 상태 컨테이너
- 플레이어 관리 (upsert/remove)
- 입력 적용 (movement physics)
- 상태 스냅샷 생성

**WebSocketServer (websocket_server.h/cpp):**
- Boost.Asio/Beast 기반 비동기 I/O
- 클라이언트 세션 관리
- 입력 파싱 및 상태 브로드캐스트
- 라이프사이클 콜백 (on_join, on_leave)

**PostgresStorage (postgres_storage.h/cpp):**
- libpq 래퍼
- 동기 연결 관리
- 파라미터화된 쿼리 (SQL 인젝션 방지)
- 정상 저하 (연결 실패 시 로그만)

---

## 4. 상세 설계

### 4.1 GameConfig 클래스

**인터페이스:**
```cpp
class GameConfig {
public:
    static GameConfig FromEnv();

    uint16_t Port() const;
    uint16_t MetricsPort() const;
    double TickRate() const;
    std::string DatabaseDSN() const;
private:
    uint16_t port_;
    uint16_t metrics_port_;
    double tick_rate_;
    std::string database_dsn_;
};
```

**환경 변수 매핑:**
```
ARENA60_PORT          → port_          (default: 8080)
ARENA60_METRICS_PORT  → metrics_port_  (default: 9090)
ARENA60_TICK_RATE     → tick_rate_     (default: 60.0)
ARENA60_DATABASE_DSN  → database_dsn_  (default: "host=localhost ...")
```

**구현 포인트:**
- `std::getenv()` 호출 후 `nullptr` 체크
- 파싱 실패 시 기본값 사용
- 로그에 사용된 값 출력

---

### 4.2 GameLoop 클래스

**클래스 구조:**
```cpp
struct TickInfo {
    std::uint64_t tick;               // 0부터 시작하는 틱 카운트
    double delta_seconds;             // 프레임 델타 시간
    std::chrono::steady_clock::time_point frame_start;
};

class GameLoop {
public:
    explicit GameLoop(double tick_rate);
    ~GameLoop();

    void Start();
    void Stop();
    void Join();

    void SetUpdateCallback(std::function<void(const TickInfo&)> callback);

    double TargetDelta() const noexcept;
    double CurrentTickRate() const;
    std::vector<double> LastDurations() const;
    std::string PrometheusSnapshot() const;

private:
    void Run();

    const double tick_rate_;
    const std::chrono::duration<double> target_delta_;

    std::function<void(const TickInfo&)> callback_;

    std::atomic<bool> running_{false};
    std::thread thread_;
    mutable std::mutex mutex_;
    std::condition_variable stop_cv_;
    bool stop_requested_{false};

    mutable std::mutex metrics_mutex_;
    std::vector<double> last_durations_;
    std::uint64_t tick_counter_{0};
};
```

**핵심 알고리즘 (`Run` 메서드):**
```cpp
void GameLoop::Run() {
    auto next_frame = std::chrono::steady_clock::now();

    while (running_) {
        auto frame_start = next_frame;
        auto tick = tick_counter_++;

        // 콜백 실행
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (!running_) break;
            if (callback_) {
                TickInfo info{tick, target_delta_.count(), frame_start};
                callback_(info);
            }
        }

        auto frame_end = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration<double>(frame_end - frame_start);

        // 메트릭 수집
        {
            std::lock_guard<std::mutex> lock(metrics_mutex_);
            last_durations_.push_back(elapsed.count());
            if (last_durations_.size() > 240) {
                last_durations_.erase(last_durations_.begin());
            }
        }

        // 다음 프레임까지 슬립
        next_frame += std::chrono::duration_cast<
            std::chrono::steady_clock::duration>(target_delta_);

        std::unique_lock<std::mutex> lock(mutex_);
        stop_cv_.wait_until(lock, next_frame, [this] {
            return stop_requested_;
        });

        if (stop_requested_) break;
    }
}
```

**타이밍 보장:**
- `next_frame`을 누적하여 드리프트 방지
- `wait_until`로 정확한 타이밍 (OS 스케줄러 정밀도 내)
- 틱이 오래 걸려도 다음 틱은 즉시 시작 (정상 저하)

**메트릭 수집:**
- 순환 버퍼 (최근 240 틱 = 4초 @ 60 TPS)
- 분리된 뮤텍스로 읽기 경합 최소화
- Prometheus 형식 export

---

### 4.3 PlayerState & MovementInput

**PlayerState 구조:**
```cpp
struct PlayerState {
    std::string player_id;
    double x, y;                      // 위치 (미터)
    double facing_radians;            // 방향 (라디안)
    std::uint64_t last_sequence;      // 마지막 처리된 시퀀스
    int health{100};                  // HP (MVP 1.1+)
    bool is_alive{true};              // 생존 상태
    int shots_fired{0};               // 통계
    int hits_landed{0};
    int deaths{0};
};
```

**MovementInput 구조:**
```cpp
struct MovementInput {
    std::uint64_t sequence;           // 입력 시퀀스 (순서 보장)
    bool up, down, left, right;       // 이동 방향
    double mouse_x, mouse_y;          // 에임 방향 벡터
    bool fire{false};                 // 발사 버튼 (MVP 1.1+)
};
```

**파싱 (WebSocket 텍스트 프레임):**
```cpp
MovementInput ParseInput(const std::string& message) {
    // Format: input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y>
    std::istringstream iss(message);
    std::string cmd, player_id;
    MovementInput input;

    iss >> cmd >> player_id >> input.sequence
        >> input.up >> input.down >> input.left >> input.right
        >> input.mouse_x >> input.mouse_y;

    return input;
}
```

---

### 4.4 GameSession 클래스

**클래스 구조:**
```cpp
class GameSession {
public:
    explicit GameSession(double tick_rate);

    void UpsertPlayer(const std::string& player_id);
    void RemovePlayer(const std::string& player_id);

    void ApplyInput(const std::string& player_id,
                    const MovementInput& input,
                    double delta_seconds);

    void Tick(std::uint64_t tick, double delta_seconds);

    PlayerState GetPlayer(const std::string& player_id) const;
    std::vector<PlayerState> Snapshot() const;

    std::string MetricsSnapshot() const;

private:
    struct PlayerRuntimeState {
        PlayerState state;
        // MVP 1.1+: HealthComponent, fire tracking
    };

    double speed_per_second_;         // 5.0 m/s
    double elapsed_time_{0.0};

    mutable std::mutex mutex_;
    std::unordered_map<std::string, PlayerRuntimeState> players_;
};
```

**핵심 알고리즘:**

**1. UpsertPlayer:**
```cpp
void GameSession::UpsertPlayer(const std::string& player_id) {
    std::lock_guard<std::mutex> lock(mutex_);

    if (players_.find(player_id) != players_.end()) {
        return;  // 이미 존재
    }

    PlayerRuntimeState runtime;
    runtime.state.player_id = player_id;
    runtime.state.x = 100.0;          // 기본 스폰 위치
    runtime.state.y = 200.0;
    runtime.state.facing_radians = 0.0;
    runtime.state.last_sequence = 0;

    players_[player_id] = std::move(runtime);
}
```

**2. ApplyInput (이동 물리):**
```cpp
void GameSession::ApplyInput(const std::string& player_id,
                             const MovementInput& input,
                             double delta_seconds) {
    std::lock_guard<std::mutex> lock(mutex_);

    auto it = players_.find(player_id);
    if (it == players_.end()) return;

    auto& state = it->second.state;

    // 시퀀스 번호 체크 (오래된 입력 무시)
    if (input.sequence <= state.last_sequence) {
        return;
    }
    state.last_sequence = input.sequence;

    // 이동 벡터 계산 (WASD → [-1, 1] 범위)
    double dx = 0.0, dy = 0.0;
    if (input.right) dx += 1.0;
    if (input.left)  dx -= 1.0;
    if (input.down)  dy += 1.0;
    if (input.up)    dy -= 1.0;

    // 정규화 (대각선 속도 제한)
    double magnitude = std::sqrt(dx * dx + dy * dy);
    if (magnitude > 0.0) {
        dx /= magnitude;
        dy /= magnitude;
    }

    // 위치 업데이트
    double distance = speed_per_second_ * delta_seconds;
    state.x += dx * distance;
    state.y += dy * distance;

    // 에임 방향 업데이트
    double aim_dx = input.mouse_x - state.x;
    double aim_dy = input.mouse_y - state.y;
    state.facing_radians = std::atan2(aim_dy, aim_dx);
}
```

**3. Tick (물리 시뮬레이션):**
```cpp
void GameSession::Tick(std::uint64_t tick, double delta_seconds) {
    std::lock_guard<std::mutex> lock(mutex_);
    elapsed_time_ += delta_seconds;

    // MVP 1.0: 이동만 처리 (입력 기반)
    // MVP 1.1+: 발사체 업데이트, 충돌 감지
}
```

**4. Snapshot (상태 복사):**
```cpp
std::vector<PlayerState> GameSession::Snapshot() const {
    std::lock_guard<std::mutex> lock(mutex_);

    std::vector<PlayerState> states;
    states.reserve(players_.size());

    for (const auto& [id, runtime] : players_) {
        states.push_back(runtime.state);
    }

    return states;
}
```

---

### 4.5 WebSocketServer 클래스

**클래스 구조:**
```cpp
class WebSocketServer : public std::enable_shared_from_this<WebSocketServer> {
public:
    WebSocketServer(boost::asio::io_context& io_context,
                    std::uint16_t port,
                    GameSession& session,
                    GameLoop& loop);
    ~WebSocketServer();

    void Start();
    void Stop();

    std::string MetricsSnapshot() const;
    std::uint16_t Port() const;

    void SetLifecycleHandlers(
        std::function<void(const std::string&)> on_join,
        std::function<void(const std::string&)> on_leave);

private:
    class ClientSession;  // 내부 클래스

    void DoAccept();
    void BroadcastState(std::uint64_t tick, double delta_seconds);
    void RegisterClient(const std::string& player_id,
                       std::shared_ptr<ClientSession> client);
    void UnregisterClient(const std::string& player_id);

    boost::asio::io_context& io_context_;
    boost::asio::ip::tcp::acceptor acceptor_;
    std::atomic<bool> running_{false};

    GameSession& session_;
    GameLoop& loop_;

    std::function<void(const std::string&)> on_join_;
    std::function<void(const std::string&)> on_leave_;

    mutable std::mutex clients_mutex_;
    std::unordered_map<std::string, std::weak_ptr<ClientSession>> clients_;
    std::uint64_t last_broadcast_tick_{0};
    std::atomic<std::uint32_t> connection_count_{0};
};
```

**ClientSession 상태 머신:**
```
TCP Connect → WebSocket Handshake → ReadLoop
    │
    ├─ ReadLoop: 입력 메시지 파싱
    │     Format: input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y>
    │     → ApplyInput to GameSession
    │
    ├─ EnqueueState: 브로드캐스트 콜백
    │     Queue: state <player_id> <x> <y> <angle> <tick>
    │
    └─ DoWrite: 비동기 쓰기 파이프라인
          → write_queue_ 처리 (한 번에 하나씩)

Connection Close → UnregisterClient → Stop
```

**BroadcastState (틱마다 호출):**
```cpp
void WebSocketServer::BroadcastState(std::uint64_t tick,
                                     double delta_seconds) {
    auto states = session_.Snapshot();

    std::lock_guard<std::mutex> lock(clients_mutex_);

    for (const auto& state : states) {
        auto it = clients_.find(state.player_id);
        if (it == clients_.end()) continue;

        auto client = it->second.lock();
        if (!client) continue;

        std::ostringstream oss;
        oss << "state " << state.player_id << " "
            << state.x << " " << state.y << " "
            << state.facing_radians << " " << tick;

        client->EnqueueMessage(oss.str());
    }
}
```

**스레딩 모델:**
- 모든 WebSocket I/O는 `io_context_` (단일 스레드 또는 풀)
- `clients_` 맵은 `clients_mutex_`로 보호
- Weak 포인터로 use-after-free 방지
- 클라이언트별 `write_mutex_`로 출력 메시지 직렬화

---

### 4.6 PostgresStorage 클래스

**클래스 구조:**
```cpp
class PostgresStorage {
public:
    explicit PostgresStorage(std::string dsn);
    ~PostgresStorage();

    bool Connect();
    bool IsConnected() const;
    bool RecordSessionEvent(const std::string& player_id,
                           const std::string& event);
    std::string MetricsSnapshot() const;

private:
    struct ConnDeleter {
        void operator()(PGconn* conn) {
            if (conn) PQfinish(conn);
        }
    };

    std::string dsn_;
    std::unique_ptr<PGconn, ConnDeleter> connection_;
    std::atomic<double> last_query_seconds_{0.0};
};
```

**연결 관리:**
```cpp
bool PostgresStorage::Connect() {
    connection_.reset(PQconnectdb(dsn_.c_str()));

    if (PQstatus(connection_.get()) != CONNECTION_OK) {
        std::cerr << "PostgreSQL connection failed: "
                  << PQerrorMessage(connection_.get()) << std::endl;
        connection_.reset();
        return false;
    }

    std::cout << "PostgreSQL connected" << std::endl;
    return true;
}
```

**이벤트 기록 (파라미터화된 쿼리):**
```cpp
bool PostgresStorage::RecordSessionEvent(const std::string& player_id,
                                        const std::string& event) {
    if (!IsConnected()) {
        return false;  // 정상 저하
    }

    const char* params[2] = {player_id.c_str(), event.c_str()};

    const char* query =
        "INSERT INTO session_events(player_id, event_type, created_at) "
        "VALUES($1, $2, NOW())";

    auto start = std::chrono::steady_clock::now();

    auto result = PQexecParams(connection_.get(), query, 2, nullptr,
                              params, nullptr, nullptr, 0);

    auto end = std::chrono::steady_clock::now();
    last_query_seconds_ =
        std::chrono::duration<double>(end - start).count();

    bool success = (PQresultStatus(result) == PGRES_COMMAND_OK);
    PQclear(result);

    return success;
}
```

**정상 저하:**
- 연결 실패 시 로그만 기록
- 쿼리 실패 시 false 반환하지만 서버는 계속 실행
- 메트릭으로 레이턴시 추적

---

## 5. 이벤트 플로우

### 5.1 서버 시작

```
main() 시작
  │
  ├─ GameConfig::FromEnv() → 설정 로드
  │
  ├─ PostgresStorage 생성 → Connect() 시도
  │
  ├─ GameSession 생성 (tick_rate)
  │
  ├─ GameLoop 생성 (tick_rate)
  │     SetUpdateCallback(BroadcastState)
  │
  ├─ WebSocketServer 생성 (port, session, loop)
  │     SetLifecycleHandlers(on_join, on_leave)
  │
  ├─ WebSocketServer::Start() → 리스닝 시작
  │
  ├─ GameLoop::Start() → 전용 스레드에서 Run()
  │
  └─ io_context.run() → 이벤트 루프 (블로킹)
```

### 5.2 플레이어 연결

```
TCP Accept
  │
  ├─ ClientSession 생성
  │
  ├─ WebSocket Handshake
  │
  ├─ ReadLoop 시작
  │
  ├─ 첫 입력 메시지 파싱 → player_id 추출
  │
  ├─ RegisterClient(player_id, session)
  │     └─ clients_[player_id] = weak_ptr<ClientSession>
  │
  ├─ on_join(player_id) 콜백
  │     └─ GameSession::UpsertPlayer(player_id)
  │
  └─ 입력 대기
```

### 5.3 게임 루프 틱

```
GameLoop::Run() (60 Hz)
  │
  ├─ callback_(TickInfo) 호출
  │     │
  │     ├─ GameSession::Tick(tick, delta)
  │     │
  │     └─ WebSocketServer::BroadcastState(tick, delta)
  │           │
  │           ├─ Snapshot() → 모든 플레이어 상태
  │           │
  │           └─ 각 클라이언트에 state 메시지 전송
  │
  ├─ 메트릭 수집 (틱 지속 시간)
  │
  └─ 다음 프레임까지 슬립
```

### 5.4 플레이어 입력

```
ClientSession::ReadLoop
  │
  ├─ async_read(message) → 입력 메시지 수신
  │
  ├─ 파싱: input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y>
  │
  ├─ GameSession::ApplyInput(player_id, input, delta)
  │     │
  │     ├─ 시퀀스 번호 체크
  │     │
  │     ├─ 이동 벡터 정규화
  │     │
  │     └─ 위치 업데이트
  │
  └─ 다음 틱에서 BroadcastState로 반영
```

### 5.5 플레이어 연결 해제

```
ClientSession::Stop/Close
  │
  ├─ UnregisterClient(player_id)
  │     └─ clients_.erase(player_id)
  │
  ├─ on_leave(player_id) 콜백
  │     └─ GameSession::RemovePlayer(player_id)
  │
  └─ WebSocket 연결 종료
```

---

## 6. 성능 예산

### 6.1 틱당 시간 예산: 16.67ms

| 단계 | 예상 시간 | 비고 |
|------|----------|------|
| 입력 수신 및 파싱 | ~0.3ms | WebSocket recv + 문자열 파싱 |
| 게임 로직 업데이트 | ~2ms | 2 플레이어 이동 물리 |
| 상태 스냅샷 생성 | ~0.1ms | 2 PlayerState 복사 |
| 브로드캐스트 (2 클라이언트) | ~0.2ms | 비동기 큐 (블로킹 없음) |
| DB 이벤트 기록 (선택) | ~1ms | 비동기로 처리 가능 |
| **여유 (headroom)** | **~12.4ms** | 버퍼 |

MVP 1.0은 매우 가벼우므로 60 TPS 유지 여유 충분.

### 6.2 메모리 풋프린트

- 플레이어당: ~500 bytes (state + runtime)
- 연결당: ~2KB (Boost.Asio 버퍼)
- 총 (2 플레이어): ~5KB

---

## 7. 검증 전략

### 7.1 유닛 테스트

**대상 파일:**
- `tests/unit/test_game_loop.cpp`
- `tests/unit/test_game_session.cpp`
- `tests/unit/test_config.cpp`
- `tests/unit/test_postgres_storage.cpp`

**커버리지:**

1. **GameLoop 정확도:**
```cpp
TEST(GameLoopTest, TickRateAccuracy) {
    GameLoop loop(60.0);
    std::atomic<int> ticks{0};

    loop.SetUpdateCallback([&](const TickInfo&) {
        ticks++;
    });

    loop.Start();
    std::this_thread::sleep_for(std::chrono::seconds(2));
    loop.Stop();
    loop.Join();

    // 60 TPS × 2초 = 120 ±2 틱
    EXPECT_NEAR(ticks.load(), 120, 2);
}
```

2. **GameSession 이동:**
```cpp
TEST(GameSessionTest, PlayerMovement) {
    GameSession session(60.0);
    session.UpsertPlayer("p1");

    MovementInput input;
    input.sequence = 1;
    input.up = true;  // Y 감소 (위로)

    session.ApplyInput("p1", input, 1.0 / 60.0);

    auto state = session.GetPlayer("p1");
    EXPECT_LT(state.y, 200.0);  // 스폰 위치에서 위로 이동
}
```

3. **Config 파싱:**
```cpp
TEST(ConfigTest, EnvironmentVariables) {
    setenv("ARENA60_PORT", "9999", 1);
    setenv("ARENA60_TICK_RATE", "30.0", 1);

    auto config = GameConfig::FromEnv();

    EXPECT_EQ(config.Port(), 9999);
    EXPECT_DOUBLE_EQ(config.TickRate(), 30.0);

    unsetenv("ARENA60_PORT");
    unsetenv("ARENA60_TICK_RATE");
}
```

### 7.2 통합 테스트

**대상 파일:**
- `tests/integration/test_websocket_server.cpp`

**시나리오:**

1. **WebSocket 연결 및 상태 동기화:**
```cpp
TEST(WebSocketIntegration, StateSync) {
    // 서버 시작
    boost::asio::io_context io;
    GameSession session(60.0);
    GameLoop loop(60.0);
    WebSocketServer server(io, 8080, session, loop);

    server.Start();
    loop.Start();

    // 클라이언트 연결
    auto ws = ConnectWebSocket("ws://localhost:8080");

    // 입력 전송
    ws->send("input p1 0 1 0 0 0 150.0 200.0");

    // 상태 수신
    auto response = ws->receive();
    EXPECT_TRUE(response.starts_with("state p1"));

    loop.Stop();
    server.Stop();
}
```

### 7.3 성능 테스트

**대상 파일:**
- `tests/performance/test_tick_variance.cpp`

**목표:**
- 120 틱 샘플에서 틱 편차 ≤ 1.0ms

```cpp
TEST(PerformanceTest, TickVariance) {
    GameLoop loop(60.0);
    loop.Start();

    std::this_thread::sleep_for(std::chrono::seconds(2));

    auto durations = loop.LastDurations();

    double mean = std::accumulate(durations.begin(), durations.end(), 0.0)
                  / durations.size();

    double variance = 0.0;
    for (auto d : durations) {
        variance += (d - mean) * (d - mean);
    }
    variance /= durations.size();
    double stddev = std::sqrt(variance);

    EXPECT_LT(stddev, 0.001);  // 1.0ms 이하

    loop.Stop();
}
```

---

## 8. Prometheus 메트릭

### 8.1 GameLoop 메트릭

```
# TYPE game_tick_rate gauge
game_tick_rate 60.02

# TYPE game_tick_duration_seconds gauge
game_tick_duration_seconds 0.002156
```

### 8.2 WebSocket 메트릭

```
# TYPE websocket_connections_total gauge
websocket_connections_total 2

# TYPE player_actions_total counter
player_actions_total 150
```

### 8.3 PostgreSQL 메트릭

```
# TYPE database_query_duration_seconds gauge
database_query_duration_seconds 0.001234
```

---

## 9. 알려진 제약 & 향후 개선점

### 9.1 현재 제약

1. **동시 접속 제한**: 2 플레이어만 지원
   - MVP 1.2+: 매치메이킹으로 여러 게임 세션 관리

2. **WebSocket 오버헤드**: 텍스트 프레임, 높은 파싱 비용
   - 개선: Protocol Buffers 바이너리 직렬화

3. **단일 스레드 게임 로직**: 뮤텍스 경합
   - 개선: 게임 세션별 전용 스레드 (MVP 1.2+)

4. **PostgreSQL 동기 쿼리**: 블로킹 I/O
   - 개선: 비동기 큐 또는 libpqxx 비동기 API

### 9.2 보안 고려사항 (MVP 1.2+)

- 입력 검증 (범위 체크, 악의적 좌표)
- 레이트 리미팅 (초당 입력 수 제한)
- 인증 토큰 (누구나 연결 가능)

---

## 10. 체크리스트 (MVP 1.0 완료 기준)

- [x] `GameConfig` 클래스 구현 및 환경 변수 로드
- [x] `GameLoop` 60 TPS 고정 시간 단계 구현
- [x] `PlayerState` 및 `MovementInput` 데이터 구조
- [x] `GameSession` 플레이어 관리 및 이동 물리
- [x] `WebSocketServer` Boost.Beast 기반 구현
- [x] 입력 파싱 및 상태 브로드캐스트
- [x] `PostgresStorage` libpq 래퍼 및 파라미터화된 쿼리
- [x] 유닛 테스트 (game_loop, game_session, config, postgres_storage)
- [x] 통합 테스트 (websocket_server)
- [x] 성능 테스트 (tick_variance ≤ 1.0ms)
- [x] Prometheus 메트릭 수집 및 export
- [x] CI 파이프라인 (빌드, 테스트, 커버리지)
- [x] 문서화 (README, 아키텍처, 프로토콜)

---

## 11. MVP 1.1과의 연결

**MVP 1.0에서 확립된 것:**
- 게임 루프 인프라
- WebSocket 통신 파이프라인
- 플레이어 상태 관리
- 메트릭 수집 체계

**MVP 1.1에서 추가될 것:**
- 발사체 시스템 (Projectile 클래스)
- 충돌 감지 (원-원 교차)
- 데미지 시스템 (HealthComponent)
- 사망 메커니즘 (is_alive 플래그)
- 전투 로그 (CombatLog 링 버퍼)

MVP 1.0은 "움직일 수 있는" 게임 서버이며, MVP 1.1은 "싸울 수 있는" 게임 서버로 진화한다.
