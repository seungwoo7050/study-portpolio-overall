# 전투 시스템 설계 일지 (MVP 1.1)
> 1v1 듀얼 게임에 결정적, 저지연 전투 루프 추가 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Checkpoint A 듀얼 게임에 결정적, 저지연 전투 루프 제공:
- 마우스 입력으로 발사체 발사
- 서버에서 권위 있는 히트 검증
- 동기화 없이 사망 상태 해결

### 1.2 기능 요구사항

#### 1.2.1 플레이어 체력 추적
- `PlayerState`를 `health` 및 `is_alive` 필드로 확장
- 모든 플레이어는 100 HP, `is_alive=true`로 스폰
- `is_alive=false`일 때 이동 입력 거부
- 상태 복제를 위해 체력 데이터 노출

#### 1.2.2 발사체 발사
- 입력 프레임 형식 확장: `input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y> <fire>`
- `fire=1`일 때, 플레이어의 현재 위치에서 에임 방향으로 0.3m 앞에 발사체 생성
- 죽은 플레이어 또는 0 길이 에임 벡터의 요청 무시
- 플레이어당 초당 10발의 발사 속도 제한 적용

#### 1.2.3 발사체 시뮬레이션
- 게임 루프(60 TPS)의 권위 델타를 사용하여 틱당 한 번 모든 발사체 업데이트
- 30 m/s의 직선 운동 사용
- 만료(`lifetime > 1.5s`) 또는 히트 후 발사체 제거

#### 1.2.4 충돌 감지
- 플레이어를 반지름 0.5m 원으로 모델링
- 발사체 반지름 0.2m와 플레이어 반지름 간 원-원 교차 사용
- 발사체가 소유자를 맞출 수 없도록 보장
- 히트 발생 시, shooter id, target id, projectile id, damage, tick을 포함하는 `CombatEvent` 큐에 추가

#### 1.2.5 데미지 해결 & 사망
- 히트당 20 HP 데미지 적용, 0으로 클램프
- 체력이 0에 도달하면 `is_alive=false` 표시 및 `death` 타입의 `CombatEvent` 발행
- WebSocket 메시지를 통해 클라이언트에 사망 브로드캐스트: `death <player_id> <tick>`
- 사망당 정확히 한 번 메시지 전송 보장

#### 1.2.6 메트릭 & 로깅
- 발사체 메트릭 및 활성 사망 카운트 포함하도록 `WebSocketServer::MetricsSnapshot` 확장
- 모든 전투 상태 전환 로그: 히트, 사망

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 2 플레이어와 ≤32개 발사체에 대한 발사체 업데이트 + 충돌 패스는 단일 스레드에서 틱당 0.5ms 이내 완료

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 서버 권위(Server-Authoritative)인가?

**클라이언트 예측의 문제:**
- 치팅 가능 (클라이언트가 히트/데미지 보고)
- 네트워크 지연으로 인한 불일치
- 복잡한 리컨실리에이션 로직 필요

**서버 권위의 장점:**
- 모든 충돌 감지가 서버에서 실행
- 클라이언트는 입력만 전송 (fire 플래그)
- 서버가 히트 여부 결정
- 치팅 방지 (서버가 진실의 원천)

### 2.2 충돌 감지 알고리즘 선택

**후보:**
1. AABB (Axis-Aligned Bounding Box): 빠르지만 부정확
2. 원-원 교차: 정확하고 빠름
3. SAT (Separating Axis Theorem): 다각형용, 과도함

**선택: 원-원 교차**
- O(1) 복잡도
- 간단한 수학: `distance² ≤ (r1 + r2)²`
- 플레이어/발사체를 원으로 모델링 (시각적으로 합리적)

### 2.3 발사 속도 제한

**이유:**
- 스팸 방지 (클라이언트가 무한 발사 전송)
- 밸런스 (공평한 게임플레이)
- 성능 (발사체 수 제한)

**구현:**
- 쿨다운: 0.1초 (초당 10발)
- `elapsed_time_` 기반 결정론적 타이밍
- 각 스폰 시도 전 확인

---

## 3. 상세 설계

### 3.1 HealthComponent 클래스

**클래스 구조:**
```cpp
class HealthComponent {
public:
    HealthComponent(int max_hp);

    bool ApplyDamage(int amount);
    void Reset();

    int Current() const;
    int Max() const;
    bool IsAlive() const;

private:
    int max_;
    int current_;
};
```

**핵심 알고리즘:**
```cpp
bool HealthComponent::ApplyDamage(int amount) {
    if (amount <= 0 || current_ <= 0) {
        return false;  // 이미 죽었거나 잘못된 데미지
    }

    current_ = std::max(0, current_ - amount);

    return current_ == 0;  // 방금 죽었으면 true
}
```

**설계 포인트:**
- 상태 전환 감지를 위한 boolean 반환 (사망 이벤트 생성용)
- 이미 죽은 플레이어에게 데미지 적용 방지
- `Reset()`으로 재스폰 지원 (MVP 1.2+)

---

### 3.2 Projectile 클래스

**클래스 구조:**
```cpp
class Projectile {
public:
    Projectile(std::string id,
               std::string owner_id,
               double x, double y,
               double dir_x, double dir_y,
               double spawn_time);

    void Advance(double delta_seconds);
    bool IsExpired(double elapsed_time) const;

    std::string Id() const;
    std::string OwnerId() const;
    double X() const;
    double Y() const;
    bool IsActive() const;
    void Deactivate();

    static constexpr double kSpeed = 30.0;        // m/s
    static constexpr double kLifetime = 1.5;      // 초
    static constexpr double kRadius = 0.2;        // 미터

private:
    std::string id_;
    std::string owner_id_;
    double x_, y_;
    double dir_x_, dir_y_;  // 정규화된 방향 벡터
    double spawn_time_;
    bool active_{true};
};
```

**핵심 알고리즘:**

**1. 생성자 (방향 정규화):**
```cpp
Projectile::Projectile(std::string id, std::string owner_id,
                      double x, double y,
                      double dir_x, double dir_y,
                      double spawn_time)
    : id_(std::move(id)),
      owner_id_(std::move(owner_id)),
      x_(x), y_(y),
      spawn_time_(spawn_time) {

    double magnitude = std::sqrt(dir_x * dir_x + dir_y * dir_y);
    if (magnitude == 0.0) {
        throw std::invalid_argument("Zero direction vector");
    }

    dir_x_ = dir_x / magnitude;
    dir_y_ = dir_y / magnitude;
}
```

**2. Advance (선형 운동):**
```cpp
void Projectile::Advance(double delta_seconds) {
    if (!active_) return;

    double distance = kSpeed * delta_seconds;
    x_ += dir_x_ * distance;
    y_ += dir_y_ * distance;
}
```

**3. IsExpired (생명주기 체크):**
```cpp
bool Projectile::IsExpired(double elapsed_time) const {
    return (elapsed_time - spawn_time_) >= kLifetime;
}
```

---

### 3.3 CombatEvent & CombatLog

**데이터 구조:**
```cpp
enum class CombatEventType { Hit, Death };

struct CombatEvent {
    CombatEventType type;
    std::string shooter_id;
    std::string target_id;
    std::string projectile_id;
    int damage;
    std::uint64_t tick;
};

class CombatLog {
public:
    explicit CombatLog(std::size_t capacity = 32);

    void Append(const CombatEvent& event);
    std::vector<CombatEvent> Snapshot() const;
    void Clear();

private:
    std::deque<CombatEvent> events_;
    std::size_t capacity_;
};
```

**링 버퍼 구현:**
```cpp
void CombatLog::Append(const CombatEvent& event) {
    if (events_.size() >= capacity_) {
        events_.pop_front();  // 가장 오래된 이벤트 제거
    }
    events_.push_back(event);
}
```

**목적:**
- 매치 리플레이 및 통계를 위한 감사 추적
- 순환 버퍼로 무한 메모리 증가 방지
- 게임 세션 업데이트 중 일관된 읽기를 위한 스냅샷 기능

---

### 3.4 GameSession 확장 (전투 로직)

**PlayerRuntimeState 확장:**
```cpp
struct PlayerRuntimeState {
    PlayerState state;
    HealthComponent health{100};
    double last_fire_time{std::numeric_limits<double>::lowest()};
    bool death_announced{false};
    int shots_fired{0};
    int hits_landed{0};
    int deaths{0};
};
```

**GameSession에 추가된 멤버:**
```cpp
class GameSession {
private:
    std::vector<Projectile> projectiles_;
    std::vector<CombatEvent> pending_deaths_;
    CombatLog combat_log_;

    std::uint64_t projectile_counter_{0};
    std::uint64_t projectiles_spawned_total_{0};
    std::uint64_t projectiles_hits_total_{0};
    std::uint64_t players_dead_total_{0};
    std::uint64_t collisions_checked_total_{0};

    void AppendCombatEvent(const CombatEvent& event);
    bool TrySpawnProjectile(PlayerRuntimeState& runtime,
                           const MovementInput& input);
    void UpdateProjectilesLocked(std::uint64_t tick,
                                double delta_seconds);
};
```

**핵심 알고리즘:**

**1. TrySpawnProjectile (발사 로직):**
```cpp
bool GameSession::TrySpawnProjectile(PlayerRuntimeState& runtime,
                                     const MovementInput& input) {
    if (!input.fire) return false;
    if (!runtime.state.is_alive) return false;

    // 발사 속도 제한 체크
    constexpr double kFireCooldown = 0.1;  // 0.1초 = 초당 10발
    if (elapsed_time_ - runtime.last_fire_time < kFireCooldown) {
        return false;
    }

    // 에임 방향 계산
    double aim_dx = input.mouse_x - runtime.state.x;
    double aim_dy = input.mouse_y - runtime.state.y;
    double magnitude = std::sqrt(aim_dx * aim_dx + aim_dy * aim_dy);

    if (magnitude == 0.0) return false;  // 0 길이 벡터

    aim_dx /= magnitude;
    aim_dy /= magnitude;

    // 스폰 위치 (플레이어 위치에서 0.3m 앞)
    constexpr double kSpawnOffset = 0.3;
    double spawn_x = runtime.state.x + aim_dx * kSpawnOffset;
    double spawn_y = runtime.state.y + aim_dy * kSpawnOffset;

    // 발사체 생성
    std::string proj_id = "proj-" + std::to_string(projectile_counter_++);
    projectiles_.emplace_back(
        proj_id,
        runtime.state.player_id,
        spawn_x, spawn_y,
        aim_dx, aim_dy,
        elapsed_time_
    );

    runtime.last_fire_time = elapsed_time_;
    runtime.shots_fired++;
    projectiles_spawned_total_++;

    std::cout << "projectile spawn " << proj_id
              << " owner=" << runtime.state.player_id << std::endl;

    return true;
}
```

**2. UpdateProjectilesLocked (충돌 감지 및 데미지):**
```cpp
void GameSession::UpdateProjectilesLocked(std::uint64_t tick,
                                         double delta_seconds) {
    // 1단계: 모든 발사체 이동
    for (auto& proj : projectiles_) {
        if (!proj.IsActive()) continue;
        proj.Advance(delta_seconds);
    }

    // 2단계: 만료된 발사체 제거
    auto remove_it = std::remove_if(
        projectiles_.begin(), projectiles_.end(),
        [this](const Projectile& p) {
            return !p.IsActive() || p.IsExpired(elapsed_time_);
        }
    );
    projectiles_.erase(remove_it, projectiles_.end());

    // 3단계: 충돌 감지
    constexpr double kPlayerRadius = 0.5;
    const double radius_sum = Projectile::kRadius + kPlayerRadius;
    const double radius_sum_sq = radius_sum * radius_sum;

    for (auto& proj : projectiles_) {
        if (!proj.IsActive()) continue;

        for (auto& [player_id, runtime] : players_) {
            if (!runtime.state.is_alive) continue;
            if (proj.OwnerId() == player_id) continue;  // 자기 자신 맞추기 방지

            // AABB 조기 종료 체크
            double dx = proj.X() - runtime.state.x;
            double dy = proj.Y() - runtime.state.y;
            double dist_sq = dx * dx + dy * dy;

            collisions_checked_total_++;

            if (dist_sq <= radius_sum_sq) {
                // 충돌 발생!
                HandleCollision(proj, runtime, tick);
                proj.Deactivate();
                break;  // 이 발사체는 하나만 맞춤
            }
        }
    }

    // 4단계: 사망 감지
    for (auto& [player_id, runtime] : players_) {
        if (!runtime.state.is_alive && !runtime.death_announced) {
            CombatEvent death_event;
            death_event.type = CombatEventType::Death;
            death_event.target_id = player_id;
            death_event.tick = tick;

            pending_deaths_.push_back(death_event);
            combat_log_.Append(death_event);

            runtime.death_announced = true;
            runtime.deaths++;
            players_dead_total_++;

            std::cout << "death " << player_id << std::endl;
        }
    }
}
```

**3. HandleCollision (히트 처리):**
```cpp
void GameSession::HandleCollision(const Projectile& proj,
                                  PlayerRuntimeState& target_runtime,
                                  std::uint64_t tick) {
    constexpr int kDamagePerHit = 20;

    // 발사자 업데이트
    auto shooter_it = players_.find(proj.OwnerId());
    if (shooter_it != players_.end()) {
        shooter_it->second.hits_landed++;
    }

    // 히트 이벤트 생성
    CombatEvent hit_event;
    hit_event.type = CombatEventType::Hit;
    hit_event.shooter_id = proj.OwnerId();
    hit_event.target_id = target_runtime.state.player_id;
    hit_event.projectile_id = proj.Id();
    hit_event.damage = kDamagePerHit;
    hit_event.tick = tick;

    combat_log_.Append(hit_event);
    projectiles_hits_total_++;

    std::cout << "hit " << proj.OwnerId() << "->"
              << target_runtime.state.player_id
              << " dmg=" << kDamagePerHit << std::endl;

    // 데미지 적용
    bool died = target_runtime.health.ApplyDamage(kDamagePerHit);
    target_runtime.state.health = target_runtime.health.Current();

    if (died) {
        target_runtime.state.is_alive = false;
    }
}
```

---

### 3.5 WebSocketServer 확장 (사망 브로드캐스트)

**BroadcastState 수정:**
```cpp
void WebSocketServer::BroadcastState(std::uint64_t tick,
                                     double delta_seconds) {
    auto states = session_.Snapshot();
    auto deaths = session_.ConsumeDeathEvents();

    std::lock_guard<std::mutex> lock(clients_mutex_);

    // 상태 브로드캐스트
    for (const auto& state : states) {
        auto it = clients_.find(state.player_id);
        if (it == clients_.end()) continue;

        auto client = it->second.lock();
        if (!client) continue;

        std::ostringstream oss;
        oss << "state " << state.player_id << " "
            << state.x << " " << state.y << " "
            << state.facing_radians << " " << tick << " "
            << delta_seconds << " "
            << state.health << " " << state.is_alive << " "
            << state.shots_fired << " " << state.hits_landed << " "
            << state.deaths;

        client->EnqueueMessage(oss.str());
    }

    // 사망 브로드캐스트
    for (const auto& death_event : deaths) {
        auto it = clients_.find(death_event.target_id);
        if (it == clients_.end()) continue;

        auto client = it->second.lock();
        if (!client) continue;

        std::ostringstream oss;
        oss << "death " << death_event.target_id << " " << tick;

        client->EnqueueMessage(oss.str());
    }
}
```

---

## 4. 성능 예산

### 4.1 틱당 시간 예산: 16.67ms

| 단계 | 예상 시간 | 비고 |
|------|----------|------|
| 발사체 업데이트 (32개) | ~0.1ms | 선형 운동 |
| 충돌 감지 (32 × 2 = 64 체크) | ~0.3ms | 원-원 교차 |
| 데미지 적용 | ~0.05ms | 히트당 |
| 만료 발사체 제거 | ~0.05ms | std::remove_if |
| 상태 브로드캐스트 | ~0.2ms | 기존과 동일 |
| **총 전투 오버헤드** | **~0.7ms** | |
| **여유 (headroom)** | **~15.97ms** | 충분 |

MVP 1.1은 발사체가 32개 이하일 때 목표 달성 여유 충분.

### 4.2 메모리 풋프린트

- 발사체당: ~150 bytes
- 32개 발사체: ~5KB
- CombatLog (32 이벤트): ~2KB
- 총 추가: ~7KB

---

## 5. Prometheus 메트릭

```
# TYPE projectiles_active gauge
projectiles_active 8

# TYPE projectiles_spawned_total counter
projectiles_spawned_total 45

# TYPE projectiles_hits_total counter
projectiles_hits_total 12

# TYPE players_dead_total counter
players_dead_total 1

# TYPE collisions_checked_total counter
collisions_checked_total 640
```

---

## 6. 검증 전략

### 6.1 유닛 테스트

**대상 파일:**
- `tests/unit/test_projectile.cpp`
- `tests/unit/test_combat.cpp`

**커버리지:**

1. **발사체 이동 및 만료:**
```cpp
TEST(ProjectileTest, LinearMotion) {
    Projectile proj("id", "owner", 0.0, 0.0, 1.0, 0.0, 0.0);

    proj.Advance(0.5);  // 0.5초 = 15m @ 30 m/s

    EXPECT_NEAR(proj.X(), 15.0, 0.01);
    EXPECT_NEAR(proj.Y(), 0.0, 0.01);
}

TEST(ProjectileTest, Expiration) {
    Projectile proj("id", "owner", 0.0, 0.0, 1.0, 0.0, 0.0);

    EXPECT_FALSE(proj.IsExpired(1.0));   // 1초 경과
    EXPECT_TRUE(proj.IsExpired(1.6));    // 1.6초 경과 (> 1.5초)
}
```

2. **충돌 감지:**
```cpp
TEST(CombatTest, CircleCollision) {
    Projectile proj("id", "owner", 100.0, 100.0, 1.0, 0.0, 0.0);

    PlayerState player;
    player.x = 100.5;  // 0.5m 거리
    player.y = 100.0;

    // radius_sum = 0.2 + 0.5 = 0.7m
    // distance = 0.5m < 0.7m → 충돌
    bool hit = CheckCollision(proj, player);

    EXPECT_TRUE(hit);
}
```

3. **데미지 적용:**
```cpp
TEST(CombatTest, DamageApplication) {
    HealthComponent health(100);

    bool died = health.ApplyDamage(20);
    EXPECT_FALSE(died);
    EXPECT_EQ(health.Current(), 80);

    health.ApplyDamage(60);
    EXPECT_EQ(health.Current(), 20);

    died = health.ApplyDamage(20);
    EXPECT_TRUE(died);  // 방금 죽음
    EXPECT_EQ(health.Current(), 0);
}
```

### 6.2 통합 테스트

**대상 파일:**
- `tests/integration/test_websocket_combat.cpp`

**시나리오:**

1. **전체 전투 시나리오:**
```cpp
TEST(WebSocketCombatIntegration, FullCombat) {
    // 서버 시작
    GameSession session(60.0);
    GameLoop loop(60.0);
    WebSocketServer server(io, 8080, session, loop);

    server.Start();
    loop.Start();

    // 두 클라이언트 연결
    auto p1 = ConnectWebSocket("ws://localhost:8080");
    auto p2 = ConnectWebSocket("ws://localhost:8080");

    // p1이 p2를 향해 발사
    p1->send("input p1 0 0 0 0 0 110.0 200.0 1");  // fire=1

    // 여러 틱 대기 (발사체 비행)
    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    // p2 상태 확인 (체력 감소)
    auto p2_state = p2->receive();
    EXPECT_TRUE(p2_state.contains("health 80"));

    // p1이 p2를 5번 더 맞춤 (총 6발 = 120 HP → 죽음)
    for (int i = 0; i < 5; i++) {
        p1->send("input p1 " + std::to_string(i+1) +
                " 0 0 0 0 110.0 200.0 1");
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    // 사망 메시지 확인
    auto death_msg = p2->receive();
    EXPECT_TRUE(death_msg.starts_with("death p2"));

    loop.Stop();
    server.Stop();
}
```

### 6.3 성능 테스트

**대상 파일:**
- `tests/performance/test_projectile_perf.cpp`

**목표:**
- 2 플레이어, 32 발사체로 120 틱 벤치마크
- 틱당 런타임 < 0.5ms

```cpp
TEST(PerformanceTest, ProjectileUpdatePerformance) {
    GameSession session(60.0);
    session.UpsertPlayer("p1");
    session.UpsertPlayer("p2");

    // 32개 발사체 스폰
    for (int i = 0; i < 32; i++) {
        MovementInput input;
        input.fire = true;
        input.mouse_x = 110.0;
        input.mouse_y = 200.0;
        session.ApplyInput("p1", input, 1.0 / 60.0);
    }

    // 120 틱 벤치마크
    auto start = std::chrono::steady_clock::now();

    for (int tick = 0; tick < 120; tick++) {
        session.Tick(tick, 1.0 / 60.0);
    }

    auto end = std::chrono::steady_clock::now();
    auto duration = std::chrono::duration<double>(end - start);
    double avg_tick = duration.count() / 120.0;

    EXPECT_LT(avg_tick, 0.0005);  // < 0.5ms
}
```

---

## 7. 알려진 제약 & 향후 개선점

### 7.1 현재 제약

1. **브루트 포스 충돌 감지**: O(P × J) 복잡도
   - 개선: 공간 분할 (쿼드트리, MVP 2.0+)

2. **고정 데미지**: 히트당 20 HP
   - 개선: 무기 타입, 헤드샷 배율

3. **재스폰 없음**: 사망 후 게임 종료
   - 개선: 매치 종료 감지 및 새 게임 (MVP 1.2+)

4. **발사체 풀 없음**: 매 발사마다 할당
   - 개선: 객체 풀 (MVP 2.0+)

---

## 8. 체크리스트 (MVP 1.1 완료 기준)

- [x] `HealthComponent` 클래스 구현 (데미지, 사망 감지)
- [x] `Projectile` 클래스 구현 (선형 운동, 만료)
- [x] `CombatEvent` 및 `CombatLog` 구조
- [x] `GameSession` 발사체 스폰 로직 (발사 속도 제한)
- [x] 충돌 감지 (원-원 교차)
- [x] 데미지 적용 및 사망 처리
- [x] WebSocket 사망 브로드캐스트
- [x] 유닛 테스트 (projectile, combat)
- [x] 통합 테스트 (websocket_combat)
- [x] 성능 테스트 (projectile_perf < 0.5ms)
- [x] Prometheus 메트릭 (projectiles, hits, deaths)
- [x] 문서화 (전투 프로토콜, 충돌 알고리즘)

---

## 9. MVP 1.2와의 연결

**MVP 1.1에서 확립된 것:**
- 전투 루프 인프라
- 발사체 시스템
- 충돌 감지 및 데미지
- 사망 메커니즘

**MVP 1.2에서 추가될 것:**
- 매치메이킹 시스템
- ELO 기반 매칭
- 여러 게임 세션 관리
- 매치 생성 및 알림

MVP 1.1은 "싸울 수 있는" 게임 서버이며, MVP 1.2는 "매칭할 수 있는" 게임 서버로 진화한다.
