# 통계 & 순위 시스템 설계 일지 (MVP 1.3)
> 매치 후 통계, ELO 등급, 전역 리더보드 및 프로필 API 구현 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Checkpoint A 듀얼 게임에 완전한 통계 및 순위 시스템 제공:
- 매치 후 통계 (샷, 히트, 정확도, 데미지, 킬, 데스)
- ELO 등급 조정 (매치당 K-factor 25)
- 전역 리더보드 (등급별 정렬)
- HTTP API (프로필 및 순위 조회)

### 1.2 기능 요구사항

#### 1.2.1 매치 결과 수집
- 매치 종료 시 전투 로그 및 플레이어 상태에서 통계 수집
- `MatchResult` 생성 (승자, 패자, 플레이어 통계)
- `MatchStatsCollector`를 통해 회고적 분석

#### 1.2.2 플레이어 프로필 관리
- 평생 통계 집계 (매치, 승, 패, 킬, 데스, 샷, 히트, 데미지)
- 현재 ELO 등급 추적
- 정확도 계산 (`hits / shots`)

#### 1.2.3 ELO 등급 시스템
- 표준 ELO 공식 (K-factor 25, 스케일링 상수 400)
- 매치당 승자/패자 등급 조정
- 반올림된 정수 등급

#### 1.2.4 리더보드 저장소
- 등급별로 정렬된 플레이어
- Top N 쿼리 (기본 10, 최대 50)
- Redis 준비 인터페이스 (메모리 내 폴백)

#### 1.2.5 HTTP API
- `GET /profiles/{player_id}`: JSON 프로필 응답
- `GET /leaderboard?limit=N`: Top N 플레이어
- `GET /metrics`: Prometheus 메트릭 집계

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 프로필 서비스 (100 매치) ≤ 5ms (성능 테스트로 검증)
- HTTP 응답 지연 p99 < 20ms

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 ELO 등급인가?

**대안:**
1. 승/패 비율: 단순하지만 스킬 측정 부정확
2. 레벨 시스템: 시간 기반, 스킬 반영 안 됨
3. TrueSkill: 복잡, 특허 문제

**ELO의 장점:**
- 업계 표준 (체스, LoL, DOTA)
- 수학적으로 건전 (확률 기반)
- 자기 조정 (수렴)
- 단순 구현

### 2.2 ELO 공식

**표준 ELO 업데이트:**
```
expected_winner = 1.0 / (1.0 + 10^((loser_rating - winner_rating) / 400))
expected_loser = 1.0 / (1.0 + 10^((winner_rating - loser_rating) / 400))

winner_new = winner_rating + K × (1.0 - expected_winner)
loser_new = loser_rating + K × (0.0 - expected_loser)
```

**파라미터:**
- **K-factor**: 25 (안정적 시스템)
- **스케일링 상수**: 400 (표준 ELO 변형)

**예시:**
```
승자: 1200, 패자: 1100

expected_winner = 1.0 / (1.0 + 10^((1100-1200)/400))
                = 1.0 / (1.0 + 10^(-0.25))
                = 1.0 / (1.0 + 0.562)
                = 0.640

winner_new = 1200 + 25 × (1.0 - 0.640) = 1200 + 9 = 1209
loser_new = 1100 + 25 × (0.0 - 0.360) = 1100 - 9 = 1091
```

### 2.3 리더보드 데이터 구조

**요구사항:**
- 등급별 정렬
- Top N 빠른 조회
- Upsert/Erase 효율적

**선택: 이중 인덱스**
```cpp
std::unordered_map<std::string, int> scores_;        // player_id → rating
std::map<int, std::set<std::string>, greater<int>> ordered_;  // rating → {player_ids}
```

**장점:**
- O(log S) Upsert (S = 고유 점수 수)
- O(N) Top N 쿼리
- O(1) 플레이어 조회

---

## 3. 상세 설계

### 3.1 PlayerProfile 구조

**데이터 구조:**
```cpp
struct PlayerProfile {
    std::string player_id;
    int rating{1200};                 // 현재 ELO 등급
    std::uint64_t matches{0};         // 평생 매치
    std::uint64_t wins{0};
    std::uint64_t losses{0};
    std::uint64_t kills{0};
    std::uint64_t deaths{0};
    std::uint64_t shots_fired{0};
    std::uint64_t hits_landed{0};
    std::uint64_t damage_dealt{0};
    std::uint64_t damage_taken{0};

    double Accuracy() const {
        return shots_fired == 0 ? 0.0
            : static_cast<double>(hits_landed) / shots_fired;
    }

    std::string ToJson() const;
};
```

**JSON 직렬화:**
```cpp
std::string PlayerProfile::ToJson() const {
    std::ostringstream oss;
    oss << "{"
        << "\"player_id\":\"" << player_id << "\","
        << "\"rating\":" << rating << ","
        << "\"matches\":" << matches << ","
        << "\"wins\":" << wins << ","
        << "\"losses\":" << losses << ","
        << "\"kills\":" << kills << ","
        << "\"deaths\":" << deaths << ","
        << "\"shots_fired\":" << shots_fired << ","
        << "\"hits_landed\":" << hits_landed << ","
        << "\"damage_dealt\":" << damage_dealt << ","
        << "\"damage_taken\":" << damage_taken << ","
        << "\"accuracy\":" << std::fixed << std::setprecision(4)
        << Accuracy()
        << "}";
    return oss.str();
}
```

---

### 3.2 PlayerMatchStats & MatchResult

**PlayerMatchStats (매치별 통계):**
```cpp
class PlayerMatchStats {
public:
    PlayerMatchStats(std::string match_id,
                    std::string player_id,
                    std::uint32_t shots_fired,
                    std::uint32_t hits_landed,
                    std::uint32_t kills,
                    std::uint32_t deaths,
                    std::uint64_t damage_dealt,
                    std::uint64_t damage_taken);

    std::string MatchId() const;
    std::string PlayerId() const;
    std::uint32_t ShotsFired() const;
    std::uint32_t HitsLanded() const;
    std::uint32_t Kills() const;
    std::uint32_t Deaths() const;
    std::uint64_t DamageDealt() const;
    std::uint64_t DamageTaken() const;
    double Accuracy() const;

private:
    std::string match_id_;
    std::string player_id_;
    std::uint32_t shots_fired_;
    std::uint32_t hits_landed_;
    std::uint32_t kills_;
    std::uint32_t deaths_;
    std::uint64_t damage_dealt_;
    std::uint64_t damage_taken_;
};
```

**MatchResult (매치 결과):**
```cpp
class MatchResult {
public:
    MatchResult(std::string match_id,
               std::string winner_id,
               std::string loser_id,
               std::chrono::system_clock::time_point completed_at,
               std::vector<PlayerMatchStats> player_stats);

    std::string MatchId() const;
    std::string WinnerId() const;
    std::string LoserId() const;
    std::chrono::system_clock::time_point CompletedAt() const;
    std::vector<PlayerMatchStats> PlayerStats() const;

private:
    std::string match_id_;
    std::string winner_id_;
    std::string loser_id_;
    std::chrono::system_clock::time_point completed_at_;
    std::vector<PlayerMatchStats> player_stats_;  // 2명
};
```

---

### 3.3 MatchStatsCollector

**클래스 구조:**
```cpp
class MatchStatsCollector {
public:
    MatchResult Collect(const CombatEvent& death_event,
                       const GameSession& session);
};
```

**핵심 알고리즘 (회고적 분석):**
```cpp
MatchResult MatchStatsCollector::Collect(
    const CombatEvent& death_event,
    const GameSession& session) {

    // 1단계: 플레이어 상태 및 전투 로그 스냅샷
    auto states = session.Snapshot();
    auto combat_log = session.CombatLogSnapshot();

    // 2단계: 각 플레이어에 대한 누적 집계 초기화
    struct PlayerTally {
        int shots_fired{0};
        int hits_landed{0};
        int kills{0};
        int deaths{0};
        std::uint64_t damage_dealt{0};
        std::uint64_t damage_taken{0};
    };

    std::unordered_map<std::string, PlayerTally> tallies;

    for (const auto& state : states) {
        auto& tally = tallies[state.player_id];
        tally.shots_fired = state.shots_fired;
        tally.hits_landed = state.hits_landed;
        tally.deaths = state.deaths;
    }

    // 3단계: 전투 로그 처리 (death_event.tick까지)
    for (const auto& event : combat_log) {
        if (event.tick > death_event.tick) {
            continue;  // 사망 후 이벤트 무시
        }

        if (event.type == CombatEventType::Hit) {
            tallies[event.shooter_id].damage_dealt += event.damage;
            tallies[event.target_id].damage_taken += event.damage;
        }
        else if (event.type == CombatEventType::Death) {
            if (!event.shooter_id.empty()) {
                tallies[event.shooter_id].kills++;
            }
            tallies[event.target_id].deaths = 1;  // 정확히 1
        }
    }

    // 4단계: 승자/패자 결정
    std::string winner_id, loser_id;

    for (const auto& [player_id, tally] : tallies) {
        if (tally.deaths == 0) {
            winner_id = player_id;
        } else {
            loser_id = player_id;
        }
    }

    // 5단계: PlayerMatchStats 생성
    std::vector<PlayerMatchStats> player_stats;

    for (const auto& [player_id, tally] : tallies) {
        player_stats.emplace_back(
            "match-" + std::to_string(rand()),  // match_id
            player_id,
            tally.shots_fired,
            tally.hits_landed,
            tally.kills,
            tally.deaths,
            tally.damage_dealt,
            tally.damage_taken
        );
    }

    // 플레이어 ID로 정렬 (결정론적 순서)
    std::sort(player_stats.begin(), player_stats.end(),
        [](const auto& a, const auto& b) {
            return a.PlayerId() < b.PlayerId();
        });

    // 6단계: MatchResult 반환
    return MatchResult(
        "match-id",
        winner_id,
        loser_id,
        std::chrono::system_clock::now(),
        player_stats
    );
}
```

**설계 결정:**
- 회고적: 게임 상태 + 전투 로그에서 통계 도출
- 사망 이벤트가 권위적 (승자 결정)
- 전투 로그에서 데미지 추적
- 킬 = shooter에 귀속된 사망 이벤트 수
- 단일 사망 강제 (로그에 여러 개가 나타나더라도)

---

### 3.4 EloRatingCalculator

**클래스 구조:**
```cpp
class EloRatingCalculator {
public:
    static constexpr double kFactor = 25.0;
    static constexpr double kScalingConstant = 400.0;

    std::pair<int, int> Calculate(int winner_rating,
                                 int loser_rating) const;
};
```

**구현:**
```cpp
std::pair<int, int> EloRatingCalculator::Calculate(
    int winner_rating,
    int loser_rating) const {

    double expected_winner = 1.0 / (1.0 + std::pow(10.0,
        (loser_rating - winner_rating) / kScalingConstant));

    double expected_loser = 1.0 / (1.0 + std::pow(10.0,
        (winner_rating - loser_rating) / kScalingConstant));

    int winner_new = static_cast<int>(std::round(
        winner_rating + kFactor * (1.0 - expected_winner)));

    int loser_new = static_cast<int>(std::round(
        loser_rating + kFactor * (0.0 - expected_loser)));

    return {winner_new, loser_new};
}
```

**속성:**
- 영합 (이상적 분포에서)
- 업셋 승리가 더 큰 포인트 보상
- 더 큰 등급 차이가 승자 이득 증가, 패자 손실 감소
- 반올림으로 정수 등급 보장

---

### 3.5 LeaderboardStore 인터페이스

**추상 인터페이스:**
```cpp
class LeaderboardStore {
public:
    virtual ~LeaderboardStore() = default;

    virtual void Upsert(const std::string& player_id, int score) = 0;
    virtual void Erase(const std::string& player_id) = 0;
    virtual std::vector<std::pair<std::string, int>>
        TopN(std::size_t limit) const = 0;
    virtual std::optional<int>
        Get(const std::string& player_id) const = 0;
};
```

**InMemoryLeaderboardStore 구현:**
```cpp
class InMemoryLeaderboardStore : public LeaderboardStore {
public:
    void Upsert(const std::string& player_id, int score) override;
    void Erase(const std::string& player_id) override;
    std::vector<std::pair<std::string, int>>
        TopN(std::size_t limit) const override;
    std::optional<int> Get(const std::string& player_id) const override;

private:
    std::unordered_map<std::string, int> scores_;
    std::map<int, std::set<std::string>, std::greater<int>> ordered_;
};
```

**핵심 알고리즘:**

**1. Upsert:**
```cpp
void InMemoryLeaderboardStore::Upsert(const std::string& player_id,
                                     int score) {
    auto it = scores_.find(player_id);

    if (it != scores_.end()) {
        int old_score = it->second;

        if (old_score == score) {
            return;  // 변경 없음
        }

        // 이전 점수 버킷에서 제거
        auto& old_bucket = ordered_[old_score];
        old_bucket.erase(player_id);

        if (old_bucket.empty()) {
            ordered_.erase(old_score);
        }
    }

    // 새 점수 버킷에 추가
    scores_[player_id] = score;
    ordered_[score].insert(player_id);
}
```

**2. TopN:**
```cpp
std::vector<std::pair<std::string, int>>
InMemoryLeaderboardStore::TopN(std::size_t limit) const {

    std::vector<std::pair<std::string, int>> result;
    result.reserve(limit);

    // ordered_는 내림차순으로 정렬됨 (greater<int>)
    for (const auto& [score, players] : ordered_) {
        for (const auto& player_id : players) {
            result.emplace_back(player_id, score);

            if (result.size() >= limit) {
                return result;
            }
        }
    }

    return result;
}
```

**복잡도:**
- Upsert: O(log S) (S = 고유 점수 수)
- TopN: O(N)
- Get: O(1)

---

### 3.6 PlayerProfileService

**클래스 구조:**
```cpp
struct AggregateStats {
    std::uint64_t matches{0};
    std::uint64_t wins{0};
    std::uint64_t losses{0};
    std::uint64_t kills{0};
    std::uint64_t deaths{0};
    std::uint64_t shots_fired{0};
    std::uint64_t hits_landed{0};
    std::uint64_t damage_dealt{0};
    std::uint64_t damage_taken{0};
    int rating{1200};
};

class PlayerProfileService {
public:
    explicit PlayerProfileService(
        std::shared_ptr<LeaderboardStore> leaderboard);

    void RecordMatch(const MatchResult& result);

    std::optional<PlayerProfile>
        GetProfile(const std::string& player_id) const;

    std::vector<PlayerProfile> TopProfiles(std::size_t limit) const;

    std::string MetricsSnapshot() const;

private:
    std::shared_ptr<LeaderboardStore> leaderboard_;
    EloRatingCalculator calculator_;

    mutable std::mutex mutex_;
    std::unordered_map<std::string, AggregateStats> aggregates_;

    std::uint64_t matches_recorded_total_{0};
    std::uint64_t rating_updates_total_{0};
};
```

**핵심 알고리즘:**

**1. RecordMatch:**
```cpp
void PlayerProfileService::RecordMatch(const MatchResult& result) {
    std::lock_guard<std::mutex> lock(mutex_);

    // 승자/패자 프로필 가져오기
    auto& winner_agg = aggregates_[result.WinnerId()];
    auto& loser_agg = aggregates_[result.LoserId()];

    // ELO 등급 업데이트
    auto [winner_new, loser_new] = calculator_.Calculate(
        winner_agg.rating, loser_agg.rating);

    winner_agg.rating = winner_new;
    loser_agg.rating = loser_new;

    rating_updates_total_ += 2;

    // 리더보드 동기화
    if (leaderboard_) {
        leaderboard_->Upsert(result.WinnerId(), winner_new);
        leaderboard_->Upsert(result.LoserId(), loser_new);
    }

    // 각 플레이어 통계 집계
    for (const auto& stats : result.PlayerStats()) {
        auto& agg = aggregates_[stats.PlayerId()];

        agg.matches++;
        agg.kills += stats.Kills();
        agg.deaths += stats.Deaths();
        agg.shots_fired += stats.ShotsFired();
        agg.hits_landed += stats.HitsLanded();
        agg.damage_dealt += stats.DamageDealt();
        agg.damage_taken += stats.DamageTaken();

        if (stats.PlayerId() == result.WinnerId()) {
            agg.wins++;
        } else {
            agg.losses++;
        }
    }

    matches_recorded_total_++;
}
```

**2. GetProfile:**
```cpp
std::optional<PlayerProfile> PlayerProfileService::GetProfile(
    const std::string& player_id) const {

    std::lock_guard<std::mutex> lock(mutex_);

    auto it = aggregates_.find(player_id);
    if (it == aggregates_.end()) {
        return std::nullopt;
    }

    const auto& agg = it->second;

    PlayerProfile profile;
    profile.player_id = player_id;
    profile.rating = agg.rating;
    profile.matches = agg.matches;
    profile.wins = agg.wins;
    profile.losses = agg.losses;
    profile.kills = agg.kills;
    profile.deaths = agg.deaths;
    profile.shots_fired = agg.shots_fired;
    profile.hits_landed = agg.hits_landed;
    profile.damage_dealt = agg.damage_dealt;
    profile.damage_taken = agg.damage_taken;

    return profile;
}
```

**3. TopProfiles:**
```cpp
std::vector<PlayerProfile> PlayerProfileService::TopProfiles(
    std::size_t limit) const {

    std::lock_guard<std::mutex> lock(mutex_);

    std::vector<PlayerProfile> profiles;

    if (leaderboard_) {
        auto top = leaderboard_->TopN(limit);

        for (const auto& [player_id, rating] : top) {
            auto it = aggregates_.find(player_id);
            if (it == aggregates_.end()) continue;

            auto profile = BuildProfile(player_id, it->second);
            profiles.push_back(profile);
        }
    } else {
        // 폴백: 모든 프로필 수집 및 정렬
        for (const auto& [player_id, agg] : aggregates_) {
            profiles.push_back(BuildProfile(player_id, agg));
        }

        std::sort(profiles.begin(), profiles.end(),
            [](const auto& a, const auto& b) {
                return a.rating > b.rating;
            });

        if (profiles.size() > limit) {
            profiles.resize(limit);
        }
    }

    return profiles;
}
```

**스레딩 모델:**
- 모든 변경은 `mutex_`로 보호
- `RecordMatch()`: WebSocket I/O 스레드에서 호출됨
- 읽기 (`GetProfile`, `TopProfiles`): 잠금 게이트

---

### 3.7 ProfileHttpRouter

**클래스 구조:**
```cpp
class ProfileHttpRouter {
public:
    using RequestHandler = std::function<
        std::string(const std::string& method,
                   const std::string& path)>;

    static RequestHandler CreateHandler(
        PlayerProfileService& profile_service,
        const std::function<std::string()>& metrics_fn);
};
```

**엔드포인트:**

**1. GET /metrics:**
```cpp
if (path == "/metrics") {
    return metrics_fn();  // Prometheus 집계
}
```

**2. GET /profiles/{player_id}:**
```cpp
if (path.starts_with("/profiles/")) {
    std::string player_id = path.substr(10);  // "/profiles/" 이후

    auto profile = profile_service.GetProfile(player_id);

    if (!profile) {
        return "HTTP/1.1 404 Not Found\r\n"
               "Content-Length: 0\r\n\r\n";
    }

    std::string json = profile->ToJson();

    return "HTTP/1.1 200 OK\r\n"
           "Content-Type: application/json\r\n"
           "Content-Length: " + std::to_string(json.size()) + "\r\n"
           "\r\n" + json;
}
```

**3. GET /leaderboard?limit=N:**
```cpp
if (path.starts_with("/leaderboard")) {
    std::size_t limit = 10;  // 기본값

    auto pos = path.find("?limit=");
    if (pos != std::string::npos) {
        limit = std::stoul(path.substr(pos + 7));
        limit = std::min(limit, 50);  // 최대 50
    }

    auto profiles = profile_service.TopProfiles(limit);

    std::ostringstream oss;
    oss << "[";
    for (std::size_t i = 0; i < profiles.size(); i++) {
        oss << profiles[i].ToJson();
        if (i + 1 < profiles.size()) {
            oss << ",";
        }
    }
    oss << "]";

    std::string json = oss.str();

    return "HTTP/1.1 200 OK\r\n"
           "Content-Type: application/json\r\n"
           "Content-Length: " + std::to_string(json.size()) + "\r\n"
           "\r\n" + json;
}
```

---

## 4. 이벤트 플로우

### 4.1 매치 완료

```
WebSocket::BroadcastState
  │
  ├─ session_.ConsumeDeathEvents() → 사망 이벤트
  │
  ├─ 사망 감지됨
  │
  ├─ MatchStatsCollector::Collect(death_event, session)
  │     │
  │     ├─ 플레이어 상태 스냅샷
  │     │
  │     ├─ 전투 로그 처리
  │     │
  │     ├─ 승자/패자 결정
  │     │
  │     └─ MatchResult 반환
  │
  ├─ match_completed_callback(result)
  │     │
  │     └─ PlayerProfileService::RecordMatch(result)
  │           │
  │           ├─ ELO 등급 업데이트 (승자/패자)
  │           │
  │           ├─ 리더보드 동기화
  │           │
  │           ├─ 통계 집계 (샷, 히트, 킬, 데스, 데미지)
  │           │
  │           └─ 메트릭 업데이트
  │
  └─ 매치 기록 완료
```

### 4.2 프로필 조회

```
HTTP GET /profiles/player1
  │
  ├─ ProfileHttpRouter::CreateHandler()
  │
  ├─ PlayerProfileService::GetProfile("player1")
  │     │
  │     ├─ aggregates_["player1"] 조회
  │     │
  │     └─ PlayerProfile 반환 (또는 nullopt)
  │
  ├─ profile.ToJson()
  │
  └─ HTTP 200 OK + JSON 응답
```

### 4.3 리더보드 조회

```
HTTP GET /leaderboard?limit=10
  │
  ├─ ProfileHttpRouter::CreateHandler()
  │
  ├─ 쿼리 파라미터 파싱 (limit=10)
  │
  ├─ PlayerProfileService::TopProfiles(10)
  │     │
  │     ├─ leaderboard_->TopN(10)
  │     │     │
  │     │     └─ ordered_ 반복 (내림차순 등급)
  │     │
  │     └─ 각 player_id에 대한 프로필 수집
  │
  ├─ JSON 배열 구축
  │
  └─ HTTP 200 OK + JSON 응답
```

---

## 5. 성능 예산

### 5.1 RecordMatch 복잡도

| 단계 | 복잡도 | 예상 시간 | 비고 |
|------|--------|----------|------|
| ELO 계산 | O(1) | ~0.1ms | pow() 호출 2회 |
| 리더보드 Upsert | O(log S) | ~0.2ms | S=100 점수 |
| 통계 집계 | O(1) | ~0.1ms | 2 플레이어 |
| **총** | | **~0.4ms** | < 5ms 목표 ✓ |

### 5.2 TopProfiles 복잡도

| 단계 | 복잡도 | 예상 시간 | 비고 |
|------|--------|----------|------|
| leaderboard->TopN(10) | O(N) | ~0.1ms | N=10 |
| 프로필 수집 | O(N) | ~0.1ms | 집계 조회 |
| **총** | | **~0.2ms** | < 5ms 목표 ✓ |

---

## 6. Prometheus 메트릭

```
# TYPE player_profiles_total gauge
player_profiles_total 50

# TYPE leaderboard_entries_total gauge
leaderboard_entries_total 50

# TYPE matches_recorded_total counter
matches_recorded_total 120

# TYPE rating_updates_total counter
rating_updates_total 240
```

---

## 7. 검증 전략

### 7.1 유닛 테스트

**대상 파일:**
- `tests/unit/test_leaderboard_store.cpp`
- `tests/unit/test_player_profile_service.cpp`
- `tests/unit/test_match_stats.cpp`

**커버리지:**

1. **ELO 계산:**
```cpp
TEST(EloRatingCalculatorTest, BasicCalculation) {
    EloRatingCalculator calc;

    auto [winner_new, loser_new] = calc.Calculate(1200, 1100);

    // 1200 vs 1100: 승자 expected ~0.64
    // winner_new = 1200 + 25 * (1.0 - 0.64) = 1209
    // loser_new = 1100 + 25 * (0.0 - 0.36) = 1091

    EXPECT_NEAR(winner_new, 1209, 1);
    EXPECT_NEAR(loser_new, 1091, 1);
}
```

2. **리더보드 순서:**
```cpp
TEST(LeaderboardStoreTest, TopNOrdering) {
    InMemoryLeaderboardStore store;

    store.Upsert("p1", 1200);
    store.Upsert("p2", 1300);
    store.Upsert("p3", 1100);

    auto top = store.TopN(3);

    EXPECT_EQ(top[0].first, "p2");  // 1300
    EXPECT_EQ(top[1].first, "p1");  // 1200
    EXPECT_EQ(top[2].first, "p3");  // 1100
}
```

3. **프로필 집계:**
```cpp
TEST(PlayerProfileServiceTest, StatAggregation) {
    auto leaderboard = std::make_shared<InMemoryLeaderboardStore>();
    PlayerProfileService service(leaderboard);

    // 매치 기록
    MatchResult result("match-1", "p1", "p2", now, {
        PlayerMatchStats("match-1", "p1", 10, 5, 1, 0, 100, 50),
        PlayerMatchStats("match-1", "p2", 8, 2, 0, 1, 40, 100)
    });

    service.RecordMatch(result);

    // 프로필 확인
    auto p1 = service.GetProfile("p1");
    ASSERT_TRUE(p1.has_value());
    EXPECT_EQ(p1->wins, 1);
    EXPECT_EQ(p1->shots_fired, 10);
    EXPECT_EQ(p1->hits_landed, 5);
    EXPECT_EQ(p1->damage_dealt, 100);
}
```

### 7.2 통합 테스트

**대상 파일:**
- `tests/integration/test_profile_http.cpp`

**시나리오:**

1. **HTTP 프로필 엔드포인트:**
```cpp
TEST(ProfileHttpIntegration, GetProfile) {
    // 서버 시작
    boost::asio::io_context io;
    auto leaderboard = std::make_shared<InMemoryLeaderboardStore>();
    PlayerProfileService profile_service(leaderboard);

    // 매치 기록
    MatchResult result(...);
    profile_service.RecordMatch(result);

    // HTTP 요청
    auto handler = ProfileHttpRouter::CreateHandler(
        profile_service, []{ return ""; });

    std::string response = handler("GET", "/profiles/p1");

    EXPECT_TRUE(response.contains("200 OK"));
    EXPECT_TRUE(response.contains("\"player_id\":\"p1\""));
    EXPECT_TRUE(response.contains("\"rating\":"));
}
```

### 7.3 성능 테스트

**대상 파일:**
- `tests/performance/test_profile_service_perf.cpp`

**목표:**
- 100 매치 기록 < 5ms

```cpp
TEST(PerformanceTest, ProfileServiceThroughput) {
    auto leaderboard = std::make_shared<InMemoryLeaderboardStore>();
    PlayerProfileService service(leaderboard);

    // 100 매치 생성
    std::vector<MatchResult> results;
    for (int i = 0; i < 100; i++) {
        results.push_back(CreateMockMatchResult(i));
    }

    // 벤치마크
    auto start = std::chrono::steady_clock::now();

    for (const auto& result : results) {
        service.RecordMatch(result);
    }

    auto end = std::chrono::steady_clock::now();
    auto duration = std::chrono::duration<double>(end - start);

    EXPECT_LT(duration.count(), 0.005);  // < 5ms
}
```

---

## 8. 알려진 제약 & 향후 개선점

### 8.1 현재 제약

1. **메모리 내 저장소**: Redis 통합 없음
   - 개선: `RedisLeaderboardStore` 완전 구현

2. **단순 JSON 직렬화**: 수동 문자열 구축
   - 개선: nlohmann/json 또는 Protocol Buffers

3. **동기 HTTP**: 블로킹 I/O
   - 개선: Boost.Beast 비동기 핸들러

4. **고정 K-factor**: 모든 플레이어 25
   - 개선: 신규/베테랑별 K-factor 조정

---

## 9. 체크리스트 (MVP 1.3 완료 기준)

- [x] `PlayerProfile` 구조 (통계, 정확도)
- [x] `PlayerMatchStats` 및 `MatchResult` 클래스
- [x] `MatchStatsCollector` (회고적 분석)
- [x] `EloRatingCalculator` (표준 ELO 공식)
- [x] `LeaderboardStore` 인터페이스 및 `InMemoryLeaderboardStore` 구현
- [x] `PlayerProfileService` (집계, ELO 업데이트)
- [x] `ProfileHttpRouter` (프로필, 리더보드, 메트릭 엔드포인트)
- [x] 유닛 테스트 (leaderboard_store, player_profile_service, match_stats)
- [x] 통합 테스트 (profile_http)
- [x] 성능 테스트 (profile_service_perf < 5ms)
- [x] Prometheus 메트릭 (profiles, leaderboard, matches_recorded, rating_updates)
- [x] 문서화 (ELO 공식, 리더보드 구조, HTTP API)

---

## 10. Checkpoint A 완료

**MVP 1.0-1.3에서 확립된 것:**
- 완전한 게임 서버 인프라
- 실시간 전투 시스템
- ELO 기반 매치메이킹
- 통계 및 순위 추적
- HTTP API

**Checkpoint B (MVP 2.0+)에서 추가될 것:**
- 60인 동시 플레이어 지원
- 공간 분할 (쿼드트리)
- 델타 압축
- 객체 풀 최적화
- 관심 관리

**Checkpoint A는 "추적할 수 있는" 게임 서버로, 1v1 듀얼 게임의 완전한 구현이다.**
