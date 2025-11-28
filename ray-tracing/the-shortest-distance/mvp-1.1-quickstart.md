# MVP 1.1 빠른 시작 - Combat System

## 0. 전제 & 목표

**전제**: MVP 1.0 완료 (GameLoop, WebSocketServer, GameSession 동작 중)

**목표**:
- 마우스 클릭으로 발사체 생성
- 발사체-플레이어 충돌 감지
- 데미지 & 사망 처리
- "death" 메시지 브로드캐스트

**소요 시간**: 1-2주

---

## 1. 핵심 개념

### 1.1. Projectile 구조

```cpp
struct Projectile {
    uint64_t id;
    std::string owner_id;
    double pos_x, pos_y;
    double dir_x, dir_y;  // 정규화된 방향
    std::chrono::steady_clock::time_point spawn_time;
    bool is_active{true};

    static constexpr double kSpeed = 30.0;  // m/s
    static constexpr double kRadius = 0.2;  // m
    static constexpr double kLifetime = 1.5;  // s
};
```

### 1.2. 원-원 충돌 감지

```cpp
// 거리 제곱 비교 (sqrt 회피)
double dx = proj.pos_x - player.pos_x;
double dy = proj.pos_y - player.pos_y;
double dist_sq = dx * dx + dy * dy;

double threshold = proj_radius + player_radius;  // 0.2 + 0.5 = 0.7
double threshold_sq = threshold * threshold;     // 0.49

if (dist_sq < threshold_sq) {
    // 충돌!
}
```

---

## 2. 구현 순서

### Step 1: HealthComponent 추가

```cpp
// server/include/arena60/game/combat.h
class HealthComponent {
public:
    explicit HealthComponent(int max_hp = 100)
        : max_hp_(max_hp), current_hp_(max_hp) {}

    bool ApplyDamage(int amount) {
        current_hp_ = std::max(0, current_hp_ - amount);
        return current_hp_ == 0;  // died?
    }

    int current_hp() const { return current_hp_; }
    bool is_alive() const { return current_hp_ > 0; }

private:
    const int max_hp_;
    int current_hp_;
};
```

**GameSession에 추가**:
```cpp
struct PlayerRuntimeState {
    PlayerState state;
    HealthComponent health;  // 추가
    double last_fire_time{-999.0};
    int shots_fired{0};
    int hits_landed{0};
};
```

### Step 2: Projectile & 발사 로직

```cpp
// GameSession::TrySpawnProjectile
bool GameSession::TrySpawnProjectile(PlayerRuntimeState& runtime, const MovementInput& input) {
    if (!input.fire) return false;
    if (!runtime.health.is_alive()) return false;

    // 쿨다운 체크 (100ms)
    double now = elapsed_time_;
    if (now - runtime.last_fire_time < 0.1) {
        return false;
    }

    // Aim 방향 계산
    double aim_dx = input.mouse_x - runtime.state.pos_x;
    double aim_dy = input.mouse_y - runtime.state.pos_y;
    double aim_len = std::sqrt(aim_dx * aim_dx + aim_dy * aim_dy);

    if (aim_len < 1e-6) return false;

    double norm_dx = aim_dx / aim_len;
    double norm_dy = aim_dy / aim_len;

    // 발사 위치 (플레이어 앞 0.3m)
    double spawn_x = runtime.state.pos_x + norm_dx * 0.3;
    double spawn_y = runtime.state.pos_y + norm_dy * 0.3;

    // Projectile 생성
    Projectile proj{
        .id = projectile_counter_++,
        .owner_id = runtime.state.player_id,
        .pos_x = spawn_x,
        .pos_y = spawn_y,
        .dir_x = norm_dx,
        .dir_y = norm_dy,
        .spawn_time = std::chrono::steady_clock::now()
    };

    projectiles_.push_back(proj);
    runtime.last_fire_time = now;
    runtime.shots_fired++;

    std::cout << "projectile spawn " << proj.id << " owner=" << proj.owner_id << std::endl;
    return true;
}
```

### Step 3: Tick에서 발사체 업데이트

```cpp
void GameSession::Tick(uint64_t tick, double delta) {
    std::lock_guard<std::mutex> lk(mutex_);
    elapsed_time_ += delta;

    UpdateProjectilesLocked(tick, delta);
}

void GameSession::UpdateProjectilesLocked(uint64_t tick, double delta) {
    auto now = std::chrono::steady_clock::now();

    for (auto& proj : projectiles_) {
        if (!proj.is_active) continue;

        // 수명 체크
        auto elapsed = std::chrono::duration<double>(now - proj.spawn_time).count();
        if (elapsed > Projectile::kLifetime) {
            proj.is_active = false;
            continue;
        }

        // 위치 업데이트
        proj.pos_x += proj.dir_x * Projectile::kSpeed * delta;
        proj.pos_y += proj.dir_y * Projectile::kSpeed * delta;

        // 충돌 검사
        for (auto& [player_id, runtime] : players_) {
            if (player_id == proj.owner_id) continue;  // 자기 발사체
            if (!runtime.health.is_alive()) continue;  // 이미 사망

            double dx = proj.pos_x - runtime.state.pos_x;
            double dy = proj.pos_y - runtime.state.pos_y;
            double dist_sq = dx * dx + dy * dy;

            const double collision_radius = Projectile::kRadius + 0.5;  // player radius
            if (dist_sq < collision_radius * collision_radius) {
                // HIT!
                const int damage = 20;
                bool died = runtime.health.ApplyDamage(damage);

                std::cout << "hit " << proj.owner_id << " -> " << player_id
                          << " dmg=" << damage << std::endl;

                // 발사자 통계
                auto shooter_it = players_.find(proj.owner_id);
                if (shooter_it != players_.end()) {
                    shooter_it->second.hits_landed++;
                }

                if (died) {
                    std::cout << "death " << player_id << std::endl;
                    CombatEvent death_event{
                        .type = CombatEvent::DEATH,
                        .shooter_id = proj.owner_id,
                        .target_id = player_id,
                        .tick = tick
                    };
                    pending_deaths_.push_back(death_event);
                }

                proj.is_active = false;
                break;
            }
        }
    }

    // 비활성 발사체 제거
    projectiles_.erase(
        std::remove_if(projectiles_.begin(), projectiles_.end(),
            [](const Projectile& p) { return !p.is_active; }),
        projectiles_.end()
    );
}
```

### Step 4: 사망 메시지 브로드캐스트

```cpp
// WebSocketServer::BroadcastState
void WebSocketServer::BroadcastState(uint64_t tick, double delta) {
    auto states = session_.Snapshot();
    auto deaths = session_.ConsumeDeathEvents();  // 추가

    // 1. 상태 브로드캐스트
    for (const auto& state : states) {
        std::ostringstream oss;
        oss << "state " << state.player_id << " "
            << state.pos_x << " " << state.pos_y << " "
            << state.angle << " "
            << state.health << " "  // 추가
            << tick;
        BroadcastToAll(oss.str());
    }

    // 2. 사망 브로드캐스트
    for (const auto& death : deaths) {
        std::ostringstream oss;
        oss << "death " << death.target_id << " " << death.tick;
        BroadcastToAll(oss.str());
    }
}
```

---

## 3. 프로토콜 확장

### 3.1. 입력 프레임 (fire 플래그 추가)

```
input <player_id> <seq> <up> <down> <left> <right> <mouse_x> <mouse_y> <fire>
```

**예시**:
```
input player1 10 0 0 0 0 300.0 100.0 1
```
- fire=1: 발사
- fire=0: 미발사

### 3.2. 상태 프레임 (health 추가)

```
state <player_id> <x> <y> <angle> <health> <tick>
```

**예시**:
```
state player1 105.0 200.0 0.785 80 123
```

### 3.3. 사망 메시지 (신규)

```
death <player_id> <tick>
```

**예시**:
```
death player2 150
```

---

## 4. 테스트

### 4.1. wscat으로 테스트

```bash
# 터미널 1: 서버 실행
./arena60_server

# 터미널 2: Player1 연결
wscat -c ws://localhost:8080
> input player1 0 0 0 0 0 100.0 0.0 0

# 터미널 3: Player2 연결
wscat -c ws://localhost:8080
> input player2 0 0 0 0 0 100.0 0.0 0

# Player1이 Player2를 향해 발사 (5회)
# 터미널 2:
> input player1 1 0 0 0 0 100.0 0.0 1
# (0.15초 대기 후)
> input player1 2 0 0 0 0 100.0 0.0 1
# (반복 3회 더)

# 터미널 3에서 death 메시지 확인:
< state player2 100.0 0.0 0.0 80 50
< state player2 100.0 0.0 0.0 60 60
< state player2 100.0 0.0 0.0 40 70
< state player2 100.0 0.0 0.0 20 80
< state player2 100.0 0.0 0.0 0 90
< death player2 90
```

### 4.2. 유닛 테스트

```cpp
// tests/unit/test_combat.cpp
TEST(CombatTest, DamageAndDeath) {
    HealthComponent health(100);

    EXPECT_FALSE(health.ApplyDamage(20));  // 80 HP
    EXPECT_EQ(health.current_hp(), 80);

    EXPECT_FALSE(health.ApplyDamage(20));  // 60 HP
    EXPECT_FALSE(health.ApplyDamage(20));  // 40 HP
    EXPECT_FALSE(health.ApplyDamage(20));  // 20 HP
    EXPECT_TRUE(health.ApplyDamage(20));   // 0 HP, died

    EXPECT_FALSE(health.is_alive());
}

TEST(CombatTest, CircleCircleCollision) {
    double dx = 0.6;
    double dy = 0.0;
    double dist_sq = dx * dx + dy * dy;  // 0.36

    double threshold = 0.2 + 0.5;  // 0.7
    double threshold_sq = threshold * threshold;  // 0.49

    EXPECT_LT(dist_sq, threshold_sq);  // 충돌!
}
```

---

## 5. 자주 발생하는 문제

### 5.1. 발사체가 즉시 사라짐

**원인**: `IsExpired()` 조건 잘못 설정

**해결**: `elapsed > kLifetime` 확인 (1.5초)

### 5.2. 자기 발사체에 맞음

**원인**: owner_id 체크 누락

**해결**:
```cpp
if (player_id == proj.owner_id) continue;
```

### 5.3. 사망 메시지 중복 전송

**원인**: `pending_deaths_` 소비 안 함

**해결**:
```cpp
std::vector<CombatEvent> GameSession::ConsumeDeathEvents() {
    std::lock_guard<std::mutex> lk(mutex_);
    std::vector<CombatEvent> result = std::move(pending_deaths_);
    pending_deaths_.clear();  // 중요!
    return result;
}
```

### 5.4. 충돌 감지 안 됨

**원인**: 플레이어 반지름 잘못 설정

**해결**: player radius = 0.5m (설계 참조)

---

## 6. 다음 단계: MVP 1.2

MVP 1.1 완료 후:
1. `mvp-1.2-quickstart.md` 읽기
2. ELO 기반 매치메이킹 구현
3. Redis 큐 연동 준비

**MVP 1.1 완료 체크리스트**:
- [ ] 마우스 클릭으로 발사체 생성
- [ ] 발사체가 직선으로 이동 (30 m/s)
- [ ] 충돌 시 데미지 적용 (20 HP)
- [ ] 5회 히트로 사망
- [ ] "death" 메시지 브로드캐스트
- [ ] 성능: 32 발사체 < 0.5ms

---

**참고 자료**:
- [Circle-Circle Collision](https://www.jeffreythompson.org/collision-detection/circle-circle.php)
- [Game Programming Patterns - Object Pool](https://gameprogrammingpatterns.com/object-pool.html)
