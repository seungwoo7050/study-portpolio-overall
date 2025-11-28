# Arena60 학습·구현 로드맵 (Checkpoint A)

## 0. 전체 흐름 한눈에

**큰 단계만 먼저 보면 이렇게 간다:**

1. **전체 그림 파악**
   - mvp-1.0-quickstart 한 번 쭉 읽기
   - design/ 문서들 훑어보기

2. **MVP 1.0 준비 (C++/Boost 기초)**
   - C++17 현대적 기능 복습
   - Boost.Asio/Beast 기본 개념
   - CMake + vcpkg 빌드 환경

3. **MVP 1.0 구현 - Basic Game Server**
   - GameLoop (60 TPS)
   - WebSocketServer (Boost.Beast)
   - PlayerState & Movement
   - PostgreSQL 연동

4. **MVP 1.1 구현 - Combat System**
   - Projectile 물리
   - Collision Detection
   - Health & Death
   - CombatLog

5. **MVP 1.2 구현 - Matchmaking**
   - MatchQueue (InMemory/Redis)
   - ELO 기반 매칭 알고리즘
   - MatchNotificationChannel

6. **MVP 1.3 구현 - Statistics & Ranking**
   - MatchStatsCollector
   - EloRatingCalculator
   - LeaderboardStore
   - HTTP API (JSON)

아래부터는 단계별로 "언제 / 무엇을 / 어떤 순서로"만 딱 정리한다.

---

## 1. 제일 처음 – 전체 지도 한 번 보기

### Step 1-1. MVP quickstart 문서들 훑어보기

**언제:** 완전 맨 처음 1회.

**읽을 순서:**
1. `mvp-1.0-quickstart.md`
   - 전체 아키텍처
   - 60 TPS 게임 루프 개념
   - WebSocket 통신 구조

2. `mvp-1.1-quickstart.md`
   - 전투 시스템 개요
   - 발사체 물리 기본

3. `mvp-1.2-quickstart.md`
   - 매치메이킹 흐름
   - ELO 레이팅 기초

4. `mvp-1.3-quickstart.md`
   - 통계 수집 구조
   - HTTP API 설계

**목적:**
- "이 프로젝트가 어디까지 갈 건지" 전체 지도만 머리에 넣기
- 세부 내용 이해/암기까지는 신경 안 써도 됨

### Step 1-2. design/ 문서 훑어보기 (선택)

**파일:**
- `design/mvp-1.0-basic-game-server.md`
- `design/mvp-1.1-combat-system.md`
- `design/mvp-1.2-matchmaking.md`
- `design/mvp-1.3-statistics-ranking.md`

**목적:**
- 상세 설계를 미리 보고 싶다면
- 구현 중 막혔을 때 참조용

---

## 2. MVP 1.0 준비 – C++/Boost 기초

이 단계에서 **"최신 C++ + Boost.Asio 뇌 전환"**을 한다.

### Step 2-1. C++17 현대적 기능 복습

**핵심 체크리스트:**
- [ ] `std::chrono::steady_clock` 사용법
- [ ] `std::thread`, `std::mutex`, `std::atomic` 기본
- [ ] `std::unique_ptr`, `std::shared_ptr` RAII
- [ ] `std::optional`, `std::variant` (C++17)
- [ ] Range-based for loop
- [ ] Lambda 표현식
- [ ] `auto` 타입 추론

**추천 학습 자료:**
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/)
- [cppreference.com](https://en.cppreference.com/)

### Step 2-2. Boost.Asio/Beast 기본 개념

**언제:** C++17 복습 후.

**핵심 개념:**
1. `io_context` - 이벤트 루프의 중심
2. `async_accept`, `async_read`, `async_write` - 비동기 I/O
3. `boost::beast::websocket::stream` - WebSocket 추상화
4. 콜백 체인 - `[self = shared_from_this()](error_code ec) {...}`

**간단한 실습:**
```cpp
// Echo Server 예제 구현
boost::asio::io_context io_context;
tcp::acceptor acceptor(io_context, tcp::endpoint(tcp::v4(), 8080));

// async_accept로 연결 수락
// async_read로 데이터 읽기
// async_write로 그대로 돌려주기

io_context.run();
```

**추천 학습 자료:**
- [Boost.Asio 공식 튜토리얼](https://www.boost.org/doc/libs/release/doc/html/boost_asio/tutorial.html)
- [Boost.Beast WebSocket 예제](https://www.boost.org/doc/libs/release/libs/beast/doc/html/beast/examples.html)

### Step 2-3. CMake + vcpkg 빌드 환경

**언제:** 첫 코드 작성 직전.

**필수 설정:**
```bash
# vcpkg 설치
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg
./bootstrap-vcpkg.sh
export VCPKG_ROOT=$(pwd)

# 의존성 설치
./vcpkg install boost-asio boost-beast libpq gtest
```

**CMakeLists.txt 기본 구조:**
```cmake
cmake_minimum_required(VERSION 3.20)
project(arena60)

set(CMAKE_CXX_STANDARD 17)

find_package(Boost REQUIRED COMPONENTS system)
find_package(PostgreSQL REQUIRED)

add_executable(arena60_server src/main.cpp)
target_link_libraries(arena60_server Boost::system PostgreSQL::PostgreSQL)
```

---

## 3. MVP 1.0 구현 – Basic Game Server

### Step 3-1. mvp-1.0-quickstart.md 정독

**언제:** MVP 1.0 구현 시작 직전.

**읽을 포인트:**
- GameLoop 고정 스텝 알고리즘
- WebSocketServer 구조
- PlayerState & MovementInput
- PostgreSQL 연결 패턴

### Step 3-2. design/mvp-1.0-basic-game-server.md 참조

**언제:** 구현 중 막혔을 때.

**유용한 섹션:**
- `## 3. 핵심 컴포넌트 상세 설계` - 코드 스니펫
- `## 5. 테스트 전략` - 테스트 코드 예시
- `## 4. 프로토콜 설계` - WebSocket 메시지 포맷

### Step 3-3. MVP 1.0 구현 순서

**1단계: GameLoop**
```cpp
// server/include/arena60/core/game_loop.h
class GameLoop {
public:
    explicit GameLoop(double tick_rate);
    void Start();
    void Stop();
    void SetUpdateCallback(std::function<void(const TickInfo&)> callback);
};
```

**목표:**
- 60 TPS로 정확히 실행되는 루프
- `std::chrono::steady_clock` 사용
- `std::thread`로 별도 스레드 실행

**2단계: GameSession**
```cpp
// server/include/arena60/game/game_session.h
class GameSession {
public:
    void UpsertPlayer(const std::string& player_id);
    void ApplyInput(const std::string& player_id, const MovementInput& input, double delta);
    std::vector<PlayerState> Snapshot() const;
};
```

**목표:**
- 플레이어 상태 관리
- WASD 입력 → 위치 업데이트
- 마우스 → 각도 계산

**3단계: WebSocketServer**
```cpp
// server/include/arena60/network/websocket_server.h
class WebSocketServer {
public:
    WebSocketServer(boost::asio::io_context& io_context, uint16_t port,
                    GameSession& session, GameLoop& loop);
    void Start();
    void Stop();
};
```

**목표:**
- `async_accept` → 새 연결 수락
- `async_read` → "input ..." 파싱
- `async_write` → "state ..." 브로드캐스트

**4단계: PostgresStorage**
```cpp
// server/include/arena60/storage/postgres_storage.h
class PostgresStorage {
public:
    explicit PostgresStorage(const std::string& dsn);
    void recordSessionEvent(const std::string& player_id, const std::string& event);
};
```

**목표:**
- libpq 연결
- 파라미터화된 쿼리 (SQL 인젝션 방지)

### Step 3-4. MVP 1.0 테스트

**테스트 순서:**
1. GameLoop 테스트
   ```bash
   ./build/tests/unit/test_game_loop
   ```
   - 틱 레이트 정확도
   - 분산 ≤1ms

2. WebSocket 통합 테스트
   ```bash
   wscat -c ws://localhost:8080
   > input player1 0 1 0 0 0 100.0 50.0
   < state player1 0.0 0.0 0.785 1
   ```

3. 성능 테스트
   ```bash
   ./build/tests/performance/test_tick_variance
   ```

---

## 4. MVP 1.1 구현 – Combat System

### Step 4-1. mvp-1.1-quickstart.md 정독

**언제:** MVP 1.0 완료 후.

**핵심 포인트:**
- Projectile 구조
- 충돌 감지 알고리즘
- CombatLog 링 버퍼

### Step 4-2. MVP 1.1 구현 순서

**1단계: HealthComponent**
```cpp
class HealthComponent {
public:
    bool ApplyDamage(int amount);  // returns true if died
    int current_hp() const;
};
```

**2단계: Projectile**
```cpp
struct Projectile {
    uint64_t id;
    std::string owner_id;
    double pos_x, pos_y;
    double dir_x, dir_y;
    void Advance(double delta_seconds);
    bool IsExpired(std::chrono::steady_clock::time_point now) const;
};
```

**3단계: 충돌 감지**
```cpp
// GameSession::UpdateProjectilesLocked
for (auto& proj : projectiles_) {
    for (auto& [player_id, runtime] : players_) {
        double dx = proj.pos_x - runtime.state.pos_x;
        double dy = proj.pos_y - runtime.state.pos_y;
        double dist_sq = dx * dx + dy * dy;

        if (dist_sq < (0.2 + 0.5) * (0.2 + 0.5)) {
            // HIT!
        }
    }
}
```

**4단계: CombatLog**
```cpp
class CombatLog {
public:
    void Append(const CombatEvent& event);
    std::vector<CombatEvent> Snapshot() const;
private:
    std::array<CombatEvent, 32> events_;
    size_t write_index_{0};
};
```

### Step 4-3. MVP 1.1 테스트

```bash
# 발사체 물리 테스트
./build/tests/unit/test_projectile

# 전투 로직 테스트
./build/tests/unit/test_combat

# 성능 테스트 (32 발사체)
./build/tests/performance/test_projectile_perf
```

---

## 5. MVP 1.2 구현 – Matchmaking

### Step 5-1. mvp-1.2-quickstart.md 정독

**핵심 개념:**
- ELO 레이팅 시스템
- MatchQueue 추상화 (InMemory/Redis)
- 대기 시간에 따른 허용 범위 확대

### Step 5-2. MVP 1.2 구현 순서

**1단계: MatchRequest**
```cpp
class MatchRequest {
public:
    int CurrentTolerance(std::chrono::steady_clock::time_point now) const {
        double wait_seconds = WaitSeconds(now);
        int initial = 100;
        int expansion = 25;
        int interval = 5;
        return initial + (static_cast<int>(wait_seconds) / interval) * expansion;
    }
};
```

**2단계: InMemoryMatchQueue**
```cpp
class InMemoryMatchQueue : public MatchQueue {
private:
    std::map<int, std::list<BucketEntry>> buckets_;  // ELO → players
    std::unordered_map<std::string, std::pair<int, iterator>> index_;
};
```

**3단계: Matchmaker::RunMatching**
```cpp
std::vector<Match> Matchmaker::RunMatching(std::chrono::steady_clock::time_point now) {
    auto ordered = queue_->FetchOrdered();  // ELO 오름차순

    for (size_t i = 0; i < ordered.size(); ++i) {
        int tolerance_a = ordered[i].request.CurrentTolerance(now);

        for (size_t j = i + 1; j < ordered.size(); ++j) {
            int diff = abs(ordered[i].request.elo() - ordered[j].request.elo());
            if (diff <= tolerance_a && diff <= tolerance_b) {
                // Match found!
                break;
            }
        }
    }
}
```

**4단계: MatchNotificationChannel**
```cpp
class MatchNotificationChannel {
public:
    void Publish(const Match& match);
    std::optional<Match> Poll();
private:
    std::mutex mutex_;
    std::queue<Match> queue_;
};
```

### Step 5-3. MVP 1.2 테스트

```bash
# 큐 순서 테스트
./build/tests/unit/test_match_queue

# 매칭 알고리즘 테스트
./build/tests/unit/test_matchmaker

# 통합 테스트 (20명 → 10 매치)
./build/tests/integration/test_matchmaker_flow

# 성능 테스트 (200명)
./build/tests/performance/test_matchmaking_perf
```

---

## 6. MVP 1.3 구현 – Statistics & Ranking

### Step 6-1. mvp-1.3-quickstart.md 정독

**핵심 개념:**
- MatchStatsCollector - combat log → stats
- EloRatingCalculator - K-factor 25
- HTTP JSON API

### Step 6-2. MVP 1.3 구현 순서

**1단계: MatchStatsCollector**
```cpp
class MatchStatsCollector {
public:
    MatchResult Collect(
        const CombatEvent& death_event,
        const GameSession& session,
        std::chrono::system_clock::time_point completed_at
    ) const;
};
```

**2단계: EloRatingCalculator**
```cpp
class EloRatingCalculator {
public:
    EloRatingUpdate Update(int winner_rating, int loser_rating) const {
        double expected_winner = 1.0 / (1.0 + pow(10.0, (loser - winner) / 400.0));
        int winner_new = lround(winner + 25.0 * (1.0 - expected_winner));
        // ...
    }
};
```

**3단계: InMemoryLeaderboardStore**
```cpp
class InMemoryLeaderboardStore : public LeaderboardStore {
private:
    std::map<int, std::set<std::string>, std::greater<int>> leaderboard_;
    std::unordered_map<std::string, int> player_ratings_;
};
```

**4단계: ProfileHttpRouter**
```cpp
// GET /profiles/<player_id>
if (target.starts_with("/profiles/")) {
    std::string player_id = target.substr(10);
    auto profile = profile_service_.GetProfile(player_id);

    if (!profile) {
        res.result(http::status::not_found);
        return;
    }

    res.body() = SerializeProfile(*profile);  // JSON
}
```

### Step 6-3. MVP 1.3 테스트

```bash
# 통계 수집 테스트
./build/tests/unit/test_match_stats

# ELO 계산 테스트
./build/tests/unit/test_player_profile_service

# HTTP API 테스트
./build/tests/integration/test_profile_http

# 성능 테스트 (100 매치 기록)
./build/tests/performance/test_profile_service_perf
```

---

## 7. 최종 타임라인 요약 (문서 기준)

**읽기/실습 순서를 딱 문서 기준으로만 다시 정리하면:**

1. **roadmap.md** - 전체 흐름 파악
2. **mvp-1.0-quickstart.md** - 게임 서버 아키텍처 이해
3. C++17 복습 - 현대적 기능 체크리스트
4. Boost.Asio/Beast 튜토리얼 - Echo server 실습
5. CMake + vcpkg 환경 설정
6. **design/mvp-1.0-basic-game-server.md** - 상세 설계 참조
7. MVP 1.0 구현 - GameLoop, WebSocketServer, GameSession, PostgresStorage
8. MVP 1.0 테스트 - 단위/통합/성능 테스트
9. **mvp-1.1-quickstart.md** - 전투 시스템 개요
10. **design/mvp-1.1-combat-system.md** - 충돌 감지 알고리즘 참조
11. MVP 1.1 구현 - Projectile, HealthComponent, CombatLog
12. MVP 1.1 테스트
13. **mvp-1.2-quickstart.md** - 매치메이킹 흐름
14. **design/mvp-1.2-matchmaking.md** - 매칭 알고리즘 상세
15. MVP 1.2 구현 - MatchQueue, Matchmaker, MatchNotificationChannel
16. MVP 1.2 테스트
17. **mvp-1.3-quickstart.md** - 통계 & 랭킹 개요
18. **design/mvp-1.3-statistics-ranking.md** - HTTP API 설계
19. MVP 1.3 구현 - MatchStatsCollector, EloRatingCalculator, LeaderboardStore, ProfileHttpRouter
20. MVP 1.3 테스트
21. **통합 실행** - 전체 서버 구동 및 wscat/curl 테스트

---

## 8. 체크포인트별 완료 기준

### MVP 1.0 완료 기준
- [ ] 서버가 60 TPS로 안정적으로 실행됨 (분산 ≤1ms)
- [ ] WebSocket 클라이언트 2명 동시 연결 가능
- [ ] WASD + 마우스 입력으로 플레이어 이동
- [ ] PostgreSQL에 세션 이벤트 기록
- [ ] 모든 테스트 통과 (단위/통합/성능)

### MVP 1.1 완료 기준
- [ ] 마우스 클릭으로 발사체 생성
- [ ] 발사체-플레이어 충돌 감지
- [ ] 데미지 적용 및 사망 처리
- [ ] "death" 메시지 브로드캐스트
- [ ] 성능: 32 발사체 처리 < 0.5ms

### MVP 1.2 완료 기준
- [ ] 플레이어 Enqueue/Cancel 동작
- [ ] ELO 기반 자동 매칭 (허용 범위 확대)
- [ ] 20명 → 10 매치 생성
- [ ] 성능: 200명 매칭 < 2ms
- [ ] Prometheus 메트릭 노출

### MVP 1.3 완료 기준
- [ ] 매치 종료 시 통계 자동 수집
- [ ] ELO 레이팅 자동 업데이트
- [ ] GET /profiles/<id> JSON 응답
- [ ] GET /leaderboard?limit=N JSON 응답
- [ ] 성능: 100 매치 기록 < 5ms

---

## 9. 추천 학습 자료

### C++ & Boost
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/)
- [Boost.Asio 공식 문서](https://www.boost.org/doc/libs/release/doc/html/boost_asio.html)
- [Boost.Beast 예제](https://www.boost.org/doc/libs/release/libs/beast/doc/html/beast/examples.html)

### 게임 서버 아키텍처
- [Gaffer on Games - Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/)
- [Valve - Source Multiplayer Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)

### 테스트 & 품질
- [Google Test 문서](https://google.github.io/googletest/)
- [CMake 튜토리얼](https://cmake.org/cmake/help/latest/guide/tutorial/index.html)

---

**최종 목표:** Checkpoint A 완료 → 1v1 듀얼 게임 서버 포트폴리오 완성

**예상 소요 시간:**
- MVP 1.0: 2-3주
- MVP 1.1: 1-2주
- MVP 1.2: 1-2주
- MVP 1.3: 1-2주
- **총**: 6-9주 (C++/Boost 경험 있는 개발자 기준)
