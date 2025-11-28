# MVP 1.3 빠른 시작 - Statistics & Ranking

## 0. 전제 & 목표

**전제**: MVP 1.2 완료 (매치메이킹 동작 중)

**목표**:
- 매치 종료 시 통계 자동 수집
- ELO 레이팅 업데이트 (K-factor 25)
- 글로벌 리더보드 관리
- HTTP JSON API (/profiles, /leaderboard)

**소요 시간**: 1-2주

---

## 1. 핵심 개념

### 1.1. MatchResult 구조

```cpp
struct PlayerMatchStats {
    std::string player_id;
    int shots_fired;
    int hits_landed;
    int kills;
    int deaths;
    int damage_dealt;
    int damage_taken;

    double Accuracy() const {
        return shots_fired > 0
            ? static_cast<double>(hits_landed) / shots_fired
            : 0.0;
    }
};

struct MatchResult {
    std::string match_id;
    std::string winner_id;
    std::string loser_id;
    std::chrono::system_clock::time_point completed_at;
    std::vector<PlayerMatchStats> player_stats;
};
```

### 1.2. ELO 계산

```cpp
EloRatingUpdate EloRatingCalculator::Update(int winner_rating, int loser_rating) const {
    double expected_winner = 1.0 / (1.0 + std::pow(10.0, (loser_rating - winner_rating) / 400.0));
    double expected_loser = 1.0 / (1.0 + std::pow(10.0, (winner_rating - loser_rating) / 400.0));

    constexpr double kFactor = 25.0;

    int winner_new = std::lround(winner_rating + kFactor * (1.0 - expected_winner));
    int loser_new = std::lround(loser_rating + kFactor * (0.0 - expected_loser));

    return {winner_new, loser_new};
}
```

**예시**:
- A (1200) vs B (1200): A 승 → A: 1213, B: 1187 (±13)
- A (1300) vs B (1100): A 승 → A: 1305, B: 1095 (±5)
- A (1100) vs B (1300): A 승 → A: 1145, B: 1255 (±45, 업셋!)

---

## 2. 구현 순서

### Step 1: MatchStatsCollector

```cpp
class MatchStatsCollector {
public:
    MatchResult Collect(
        const CombatEvent& death_event,
        const GameSession& session,
        std::chrono::system_clock::time_point completed_at
    ) const {
        std::string winner_id = death_event.shooter_id;
        std::string loser_id = death_event.target_id;

        std::ostringstream oss;
        oss << "match-" << death_event.tick
            << "-" << winner_id << "-vs-" << loser_id;
        std::string match_id = oss.str();

        std::vector<PlayerMatchStats> player_stats;

        // GameSession에서 통계 읽기
        for (const auto& state : session.Snapshot()) {
            PlayerMatchStats stats{
                .player_id = state.player_id,
                .shots_fired = /* from session */,
                .hits_landed = /* from session */,
                .kills = (state.player_id == winner_id) ? 1 : 0,
                .deaths = (state.player_id == loser_id) ? 1 : 0,
                .damage_dealt = /* hits * 20 */,
                .damage_taken = /* 100 - health */
            };
            player_stats.push_back(stats);
        }

        std::cout << "match complete " << match_id
                  << " winner=" << winner_id
                  << " loser=" << loser_id << std::endl;

        return MatchResult{match_id, winner_id, loser_id, completed_at, player_stats};
    }
};
```

### Step 2: PlayerProfileService

```cpp
class PlayerProfileService {
public:
    explicit PlayerProfileService(std::shared_ptr<LeaderboardStore> leaderboard)
        : leaderboard_(std::move(leaderboard)) {}

    void RecordMatch(const MatchResult& result) {
        std::lock_guard<std::mutex> lk(mutex_);

        // 통계 집계
        for (const auto& stats : result.player_stats()) {
            auto& agg = aggregates_[stats.player_id()];
            agg.matches += 1;
            agg.shots_fired += stats.shots_fired();
            agg.hits_landed += stats.hits_landed();
            agg.damage_dealt += stats.damage_dealt();
            agg.damage_taken += stats.damage_taken();
            agg.kills += stats.kills();
            agg.deaths += stats.deaths();
        }

        // 승패 기록
        auto& winner = aggregates_[result.winner_id()];
        auto& loser = aggregates_[result.loser_id()];
        winner.wins += 1;
        loser.losses += 1;

        // ELO 업데이트
        auto update = calculator_.Update(winner.rating, loser.rating);
        winner.rating = update.winner_new;
        loser.rating = update.loser_new;

        // 리더보드 갱신
        if (leaderboard_) {
            leaderboard_->Upsert(result.winner_id(), winner.rating);
            leaderboard_->Upsert(result.loser_id(), loser.rating);
        }

        ++matches_recorded_total_;
    }

    std::optional<PlayerProfile> GetProfile(const std::string& player_id) const {
        std::lock_guard<std::mutex> lk(mutex_);
        auto it = aggregates_.find(player_id);
        if (it == aggregates_.end()) return std::nullopt;
        return BuildProfile(player_id, it->second);
    }

    std::vector<PlayerProfile> TopProfiles(std::size_t limit) const {
        std::lock_guard<std::mutex> lk(mutex_);
        auto ordered = leaderboard_->TopN(limit);
        std::vector<PlayerProfile> result;
        for (const auto& [player_id, rating] : ordered) {
            auto it = aggregates_.find(player_id);
            if (it != aggregates_.end()) {
                result.push_back(BuildProfile(player_id, it->second));
            }
        }
        return result;
    }

private:
    struct AggregateStats {
        int rating{1200};
        uint64_t matches{0};
        uint64_t wins{0};
        uint64_t losses{0};
        // ...
    };

    std::shared_ptr<LeaderboardStore> leaderboard_;
    EloRatingCalculator calculator_;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, AggregateStats> aggregates_;
    uint64_t matches_recorded_total_{0};
};
```

### Step 3: InMemoryLeaderboardStore

```cpp
class InMemoryLeaderboardStore : public LeaderboardStore {
public:
    void Upsert(const std::string& player_id, int rating) override {
        // 기존 제거
        auto it = player_ratings_.find(player_id);
        if (it != player_ratings_.end()) {
            int old_rating = it->second;
            leaderboard_[old_rating].erase(player_id);
            if (leaderboard_[old_rating].empty()) {
                leaderboard_.erase(old_rating);
            }
        }

        // 새 항목 추가
        leaderboard_[rating].insert(player_id);
        player_ratings_[player_id] = rating;
    }

    std::vector<std::pair<std::string, int>> TopN(std::size_t limit) const override {
        std::vector<std::pair<std::string, int>> result;

        for (const auto& [rating, players] : leaderboard_) {
            for (const auto& player_id : players) {
                result.emplace_back(player_id, rating);
                if (result.size() >= limit) return result;
            }
        }

        return result;
    }

private:
    // rating → players (내림차순)
    std::map<int, std::set<std::string>, std::greater<int>> leaderboard_;
    std::unordered_map<std::string, int> player_ratings_;
};
```

### Step 4: HTTP API (ProfileHttpRouter)

```cpp
void ProfileHttpRouter::HandleRequest(const http::request<http::string_body>& req,
                                      http::response<http::string_body>& res) {
    std::string target = req.target();

    // GET /profiles/<player_id>
    if (target.starts_with("/profiles/")) {
        std::string player_id = target.substr(10);

        auto profile = profile_service_.GetProfile(player_id);
        if (!profile) {
            res.result(http::status::not_found);
            res.body() = R"({"error": "Player not found"})";
            res.prepare_payload();
            return;
        }

        res.result(http::status::ok);
        res.set(http::field::content_type, "application/json");
        res.body() = SerializeProfile(*profile);
        res.prepare_payload();
        return;
    }

    // GET /leaderboard?limit=N
    if (target.starts_with("/leaderboard")) {
        std::size_t limit = 10;

        auto query_pos = target.find('?');
        if (query_pos != std::string::npos) {
            std::string query = target.substr(query_pos + 1);
            if (query.starts_with("limit=")) {
                limit = std::stoi(query.substr(6));
                limit = std::clamp(limit, 1UL, 50UL);
            }
        }

        auto profiles = profile_service_.TopProfiles(limit);

        res.result(http::status::ok);
        res.set(http::field::content_type, "application/json");
        res.body() = SerializeLeaderboard(profiles);
        res.prepare_payload();
        return;
    }

    // 404
    res.result(http::status::not_found);
    res.body() = R"({"error": "Not found"})";
    res.prepare_payload();
}
```

### Step 5: JSON 직렬화

```cpp
std::string PlayerProfileService::SerializeProfile(const PlayerProfile& profile) const {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2);
    oss << "{\n";
    oss << "  \"player_id\": \"" << profile.player_id << "\",\n";
    oss << "  \"rating\": " << profile.rating << ",\n";
    oss << "  \"matches\": " << profile.matches << ",\n";
    oss << "  \"wins\": " << profile.wins << ",\n";
    oss << "  \"losses\": " << profile.losses << ",\n";
    oss << "  \"kills\": " << profile.kills << ",\n";
    oss << "  \"deaths\": " << profile.deaths << ",\n";
    oss << "  \"shots_fired\": " << profile.shots_fired << ",\n";
    oss << "  \"hits_landed\": " << profile.hits_landed << ",\n";
    oss << "  \"damage_dealt\": " << profile.damage_dealt << ",\n";
    oss << "  \"damage_taken\": " << profile.damage_taken << ",\n";
    oss << "  \"accuracy\": " << profile.Accuracy() << "\n";
    oss << "}";
    return oss.str();
}
```

---

## 3. WebSocketServer 통합

```cpp
// WebSocketServer::BroadcastState에서
auto deaths = session_.ConsumeDeathEvents();

for (const auto& death : deaths) {
    // 사망 브로드캐스트
    BroadcastDeathMessage(death);

    // 통계 수집
    if (match_completed_callback_) {
        auto result = match_stats_collector_.Collect(
            death, session_, std::chrono::system_clock::now()
        );
        match_completed_callback_(result);
    }
}

// main.cpp에서
server.SetMatchCompletedCallback([&](const MatchResult& result) {
    profile_service.RecordMatch(result);
});
```

---

## 4. 테스트

### 4.1. curl로 HTTP API 테스트

```bash
# 프로필 조회
curl http://localhost:8081/profiles/player1
```

**응답**:
```json
{
  "player_id": "player1",
  "rating": 1225,
  "matches": 10,
  "wins": 6,
  "losses": 4,
  "kills": 12,
  "deaths": 8,
  "shots_fired": 150,
  "hits_landed": 45,
  "damage_dealt": 900,
  "damage_taken": 600,
  "accuracy": 0.30
}
```

```bash
# 리더보드 조회
curl http://localhost:8081/leaderboard?limit=5
```

**응답**:
```json
[
  {
    "player_id": "player1",
    "rating": 1250,
    "wins": 15,
    "losses": 5,
    "matches": 20
  },
  ...
]
```

### 4.2. 유닛 테스트

```cpp
TEST(EloCalculatorTest, EqualRatings) {
    EloRatingCalculator calc;
    auto update = calc.Update(1200, 1200);

    EXPECT_EQ(update.winner_new, 1213);
    EXPECT_EQ(update.loser_new, 1187);

    int gain = update.winner_new - 1200;
    int loss = 1200 - update.loser_new;
    EXPECT_NEAR(gain, loss, 2);  // 거의 대칭
}

TEST(PlayerProfileServiceTest, RecordMatch) {
    auto leaderboard = std::make_shared<InMemoryLeaderboardStore>();
    PlayerProfileService service(leaderboard);

    MatchResult result{
        .match_id = "match-1",
        .winner_id = "A",
        .loser_id = "B",
        .player_stats = {/*...*/}
    };

    service.RecordMatch(result);

    auto profile = service.GetProfile("A");
    ASSERT_TRUE(profile.has_value());
    EXPECT_EQ(profile->wins, 1);
    EXPECT_GT(profile->rating, 1200);
}
```

---

## 5. 자주 발생하는 문제

### 5.1. JSON 파싱 에러

**원인**: 수동 직렬화 오타 (쉼표, 따옴표)

**해결**: JSON validator 사용 (jsonlint.com)

### 5.2. 리더보드 순서 틀림

**원인**: `std::map` 기본 오름차순

**해결**: `std::greater<int>` 사용
```cpp
std::map<int, std::set<std::string>, std::greater<int>> leaderboard_;
```

### 5.3. ELO 업데이트 안 됨

**원인**: `RecordMatch()` 호출 누락

**해결**: `SetMatchCompletedCallback` 등록 확인

---

## 6. Checkpoint A 완료!

**MVP 1.3 완료 체크리스트**:
- [ ] 매치 종료 시 통계 자동 수집
- [ ] ELO 레이팅 업데이트
- [ ] GET /profiles/<id> 동작
- [ ] GET /leaderboard?limit=N 동작
- [ ] 성능: 100 매치 < 5ms

**Checkpoint A 전체 완료**:
- [ ] MVP 1.0 ✓ (60 TPS 게임 루프)
- [ ] MVP 1.1 ✓ (전투 시스템)
- [ ] MVP 1.2 ✓ (매치메이킹)
- [ ] MVP 1.3 ✓ (통계 & 랭킹)
- [ ] 모든 테스트 통과
- [ ] 포트폴리오 준비 완료

---

**다음 단계**: Checkpoint B (60-player Battle Royale) 준비

**참고 자료**:
- [ELO Rating](https://en.wikipedia.org/wiki/Elo_rating_system)
- [Boost.Beast HTTP Server](https://www.boost.org/doc/libs/release/libs/beast/doc/html/beast/using_http.html)
