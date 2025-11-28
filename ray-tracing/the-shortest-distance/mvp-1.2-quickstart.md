# MVP 1.2 빠른 시작 - Matchmaking Service

## 0. 전제 & 목표

**전제**: MVP 1.1 완료 (전투 시스템 동작 중)

**목표**:
- ELO 기반 플레이어 매칭
- 대기 시간에 따른 허용 범위 확대
- Match 생성 및 알림
- Redis 준비 (InMemory 먼저)

**소요 시간**: 1-2주

---

## 1. 핵심 개념

### 1.1. ELO 매칭 알고리즘

```
초기 허용 범위: ±100 ELO
시간 경과: 5초마다 ±25 확대

예시:
- 0-5초: ±100
- 5-10초: ±125
- 10-15초: ±150
```

### 1.2. 매칭 흐름

```
1. Player A (ELO 1200) Enqueue
2. Player B (ELO 1180) Enqueue
3. RunMatching(now):
   - FetchOrdered() → [B(1180), A(1200)]  // ELO 오름차순
   - B 기준: tolerance = 100, diff = 20 ≤ 100 ✓
   - A 기준: tolerance = 100, diff = 20 ≤ 100 ✓
   - Match!
4. Match{id: "match-1", players: [B, A], avg_elo: 1190}
5. Publish to MatchNotificationChannel
```

---

## 2. 구현 순서

### Step 1: MatchRequest

```cpp
// server/include/arena60/matchmaking/match_request.h
class MatchRequest {
public:
    MatchRequest(std::string player_id, int elo,
                 std::chrono::steady_clock::time_point enqueued_at,
                 std::string region = "")
        : player_id_(std::move(player_id)),
          elo_(elo),
          enqueued_at_(enqueued_at),
          region_(std::move(region)) {}

    const std::string& player_id() const { return player_id_; }
    int elo() const { return elo_; }

    double WaitSeconds(std::chrono::steady_clock::time_point now) const {
        return std::chrono::duration<double>(now - enqueued_at_).count();
    }

    int CurrentTolerance(std::chrono::steady_clock::time_point now) const {
        const double wait = WaitSeconds(now);
        const int initial = 100;
        const int expansion = 25;
        const int interval = 5;

        return initial + (static_cast<int>(wait) / interval) * expansion;
    }

private:
    std::string player_id_;
    int elo_;
    std::chrono::steady_clock::time_point enqueued_at_;
    std::string region_;
};
```

### Step 2: InMemoryMatchQueue

```cpp
// server/include/arena60/matchmaking/match_queue.h
class InMemoryMatchQueue : public MatchQueue {
public:
    void Upsert(const MatchRequest& request, uint64_t order) override {
        Remove(request.player_id());  // 기존 제거

        BucketEntry entry{request, order};
        int elo = request.elo();

        auto& bucket = buckets_[elo];
        bucket.push_back(entry);

        auto it = bucket.end();
        --it;
        index_[request.player_id()] = {elo, it};
    }

    bool Remove(const std::string& player_id) override {
        auto it = index_.find(player_id);
        if (it == index_.end()) return false;

        int elo = it->second.first;
        auto bucket_it = it->second.second;

        buckets_[elo].erase(bucket_it);
        if (buckets_[elo].empty()) {
            buckets_.erase(elo);
        }

        index_.erase(it);
        return true;
    }

    std::vector<QueuedPlayer> FetchOrdered() const override {
        std::vector<QueuedPlayer> result;

        for (const auto& [elo, bucket] : buckets_) {
            for (const auto& entry : bucket) {
                result.push_back({entry.request, entry.order});
            }
        }

        return result;  // ELO 오름차순
    }

    std::size_t Size() const override {
        return index_.size();
    }

private:
    struct BucketEntry {
        MatchRequest request;
        uint64_t order;
    };

    std::map<int, std::list<BucketEntry>> buckets_;  // ELO → list
    std::unordered_map<std::string, std::pair<int, std::list<BucketEntry>::iterator>> index_;
};
```

### Step 3: Matchmaker::RunMatching

```cpp
std::vector<Match> Matchmaker::RunMatching(std::chrono::steady_clock::time_point now) {
    std::vector<Match> matches;
    std::lock_guard<std::mutex> lk(mutex_);

    auto ordered = queue_->FetchOrdered();
    std::unordered_set<std::string> used;

    for (size_t i = 0; i < ordered.size(); ++i) {
        const auto& candidate = ordered[i];
        const auto& request = candidate.request;

        if (used.count(request.player_id())) continue;

        int tolerance_a = request.CurrentTolerance(now);
        size_t partner_index = ordered.size();

        for (size_t j = i + 1; j < ordered.size(); ++j) {
            const auto& other = ordered[j];

            if (used.count(other.request.player_id())) continue;

            int diff = std::abs(request.elo() - other.request.elo());
            int tolerance_b = other.request.CurrentTolerance(now);

            if (diff <= tolerance_a && diff <= tolerance_b) {
                partner_index = j;
                break;  // 첫 번째 호환 플레이어
            }

            // 조기 종료
            if (other.request.elo() - request.elo() > tolerance_a) {
                break;
            }
        }

        if (partner_index >= ordered.size()) continue;

        // Match 생성
        const auto& partner = ordered[partner_index].request;
        queue_->Remove(request.player_id());
        queue_->Remove(partner.player_id());
        used.insert(request.player_id());
        used.insert(partner.player_id());

        std::ostringstream id_stream;
        id_stream << "match-" << ++match_counter_;

        int avg_elo = (request.elo() + partner.elo()) / 2;

        Match match(id_stream.str(),
                    {request.player_id(), partner.player_id()},
                    avg_elo, now, "");

        matches.push_back(match);

        std::cout << "matchmaking match " << match.match_id()
                  << " players=" << request.player_id()
                  << ',' << partner.player_id()
                  << " elo=" << avg_elo << std::endl;
    }

    return matches;
}
```

### Step 4: 매칭 주기 실행

```cpp
// main.cpp에서
auto matchmaker = std::make_shared<Matchmaker>(queue);

// 1초마다 매칭 실행
boost::asio::steady_timer timer(io_context);

std::function<void(boost::system::error_code)> do_match;
do_match = [&](boost::system::error_code ec) {
    if (ec) return;

    auto now = std::chrono::steady_clock::now();
    auto matches = matchmaker->RunMatching(now);

    for (const auto& match : matches) {
        // 게임 세션 생성 등 처리
    }

    timer.expires_after(std::chrono::seconds(1));
    timer.async_wait(do_match);
};

timer.expires_after(std::chrono::seconds(1));
timer.async_wait(do_match);
```

---

## 3. Prometheus 메트릭

```cpp
std::string Matchmaker::MetricsSnapshot() const {
    std::lock_guard<std::mutex> lk(mutex_);

    std::ostringstream oss;
    oss << "# TYPE matchmaking_queue_size gauge\n";
    oss << "matchmaking_queue_size " << queue_->Size() << "\n";

    oss << "# TYPE matchmaking_matches_total counter\n";
    oss << "matchmaking_matches_total " << matches_created_ << "\n";

    oss << "# TYPE matchmaking_wait_seconds histogram\n";
    // 버킷: 0, 5, 10, 20, 40, 80
    // ... (대기 시간 히스토그램)

    return oss.str();
}
```

---

## 4. 테스트

### 4.1. 유닛 테스트

```cpp
TEST(MatchmakerTest, ToleranceExpansion) {
    auto t0 = std::chrono::steady_clock::now();
    MatchRequest req("A", 1200, t0, "");

    auto t1 = t0 + std::chrono::seconds(3);
    EXPECT_EQ(req.CurrentTolerance(t1), 100);

    auto t2 = t0 + std::chrono::seconds(7);
    EXPECT_EQ(req.CurrentTolerance(t2), 125);

    auto t3 = t0 + std::chrono::seconds(12);
    EXPECT_EQ(req.CurrentTolerance(t3), 150);
}

TEST(MatchmakerTest, BasicMatching) {
    auto queue = std::make_shared<InMemoryMatchQueue>();
    Matchmaker mm(queue);
    auto now = std::chrono::steady_clock::now();

    mm.Enqueue(MatchRequest("A", 1200, now, ""));
    mm.Enqueue(MatchRequest("B", 1180, now, ""));

    auto matches = mm.RunMatching(now);
    ASSERT_EQ(matches.size(), 1);
    EXPECT_EQ(matches[0].average_elo(), 1190);
}
```

### 4.2. 통합 테스트

```cpp
TEST(MatchmakerIntegrationTest, TwentyPlayersToTenMatches) {
    auto queue = std::make_shared<InMemoryMatchQueue>();
    Matchmaker mm(queue);
    auto now = std::chrono::steady_clock::now();

    for (int i = 0; i < 20; i++) {
        std::string id = "player" + std::to_string(i);
        int elo = 1000 + i * 10;
        mm.Enqueue(MatchRequest(id, elo, now, ""));
    }

    auto matches = mm.RunMatching(now);
    EXPECT_EQ(matches.size(), 10);
    EXPECT_EQ(queue->Size(), 0);  // 모두 매칭됨
}
```

---

## 5. 자주 발생하는 문제

### 5.1. 매칭이 안 됨

**원인**: 허용 범위 너무 좁음

**해결**: `CurrentTolerance()` 로직 확인, 대기 시간 확인

### 5.2. 같은 플레이어 중복 매칭

**원인**: `used` 집합 미사용

**해결**: `std::unordered_set<std::string> used` 추가

### 5.3. 큐에서 제거 안 됨

**원인**: `Remove()` 호출 누락

**해결**:
```cpp
queue_->Remove(request.player_id());
queue_->Remove(partner.player_id());
```

---

## 6. 다음 단계: MVP 1.3

MVP 1.2 완료 후:
1. `mvp-1.3-quickstart.md` 읽기
2. 매치 통계 수집
3. ELO 레이팅 업데이트
4. HTTP JSON API

**MVP 1.2 완료 체크리스트**:
- [ ] Enqueue/Cancel 동작
- [ ] ELO 기반 자동 매칭
- [ ] 20명 → 10 매치
- [ ] 성능: 200명 < 2ms
- [ ] Prometheus 메트릭 노출

---

**참고 자료**:
- [ELO Rating System](https://en.wikipedia.org/wiki/Elo_rating_system)
- [Redis Sorted Sets](https://redis.io/docs/data-types/sorted-sets/)
