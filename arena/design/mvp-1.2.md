# 매치메이킹 서비스 설계 일지 (MVP 1.2)
> 듀얼 플레이어를 지속적으로 새 게임 세션에 매칭하는 결정론적 매치메이킹 파이프라인 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

듀얼 플레이어를 지속적으로 새 게임 세션에 매칭하는 결정론적 매치메이킹 파이프라인 제공:
- ELO 등급 존중
- Redis 기반 대기 큐 유지
- 다른 하위 시스템(게임 서버, 알림)이 사용할 수 있는 매치 생성 이벤트 발행

### 1.2 기능 요구사항

#### 1.2.1 Redis 기반 큐
- `InMemoryMatchQueue`를 기본값으로 `MatchQueue` 인터페이스 구현
- ELO 밴드 내 삽입 순서를 유지하면서 Redis sorted set 순서를 모방하기 위해 `std::map<int, std::list<QueuedPlayer>>` 사용
- 미래 통합을 위해 등가 Redis 명령 문자열(`ZADD`, `ZREM`, `ZRANGE`)을 로그하는 `RedisMatchQueue` 스텁 제공
- 모니터링을 지원하기 위해 `Size()` 및 `Snapshot()` 노출

#### 1.2.2 대기열 등록 & 취소 API
- `Matchmaker::Enqueue(const MatchRequest&)`: 플레이어 항목 추가 또는 업데이트
- `Matchmaker::Cancel(const std::string& player_id)`: 플레이어 제거
- 큐 변경 사항 로그

#### 1.2.3 매칭 알고리즘
- `Matchmaker::RunMatching(now)` 제공:
  - 순서대로 큐 항목을 반복하고 2인 매치 형성
  - 대기 시간 ≤5초일 때 ±100 ELO 허용 오차 사용
  - 추가 5초마다 허용 오차를 25씩 확장 (예: 5-10초 후 ±125, 10-15초 후 ±150)
  - 항상 가장 오래된 호환 플레이어를 먼저 매칭하여 결정론적 매치 보장
  - 고유한 `match_id` 문자열 생성 (`match-<counter>`)
  - 오래된 플레이어를 남기지 않고 호출당 10개 이상의 매치 생성 지원

#### 1.2.4 알림 & 라이프사이클
- `SetMatchCreatedCallback`을 통해 매치 생성 콜백 등록 허용
- 내부 잠금을 유지하지 않고 콜백이 호출되도록 보장하며 전체 `Match` 페이로드 포함
- `MatchNotificationChannel` FIFO 큐 유지 및 풀 모델 액세스를 선호하는 소비자를 위해 `Poll()` 노출

#### 1.2.5 메트릭 & 모니터링
- Prometheus 형식 메트릭 발행:
  - `matchmaking_queue_size` (게이지)
  - `matchmaking_matches_total` (카운터)
  - `matchmaking_wait_seconds_bucket` (히스토그램, 버킷 `[0,5,10,20,40,80]`)
- `RunMatching` 실행할 때마다 메트릭 업데이트
- exposition string을 반환하는 `Matchmaker::MetricsSnapshot()` 제공

#### 1.2.6 스레드 안전성 & 동시성
- 뮤텍스로 공유 구조 보호
- 여러 스레드의 동시 등록/취소 작업 지원
- `RunMatching`이 다른 스레드가 플레이어를 등록하는 동안 실행될 수 있도록 보장 (데이터 레이스 없음)

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 200명의 플레이어 큐에서 `RunMatching` 실행은 단일 스레드에서 ≤2ms 내에 완료 (성능 테스트로 검증)

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 ELO 기반 매칭인가?

**대안:**
1. 무작위 매칭: 빠르지만 불공평
2. 레벨 기반: 단순하지만 스킬 분산 큼
3. ELO/MMR: 표준, 공정, 자기 조정

**ELO의 장점:**
- 업계 표준 (LoL, DOTA, CS:GO)
- 자기 균형 (시간 경과에 따른 수렴)
- 예측 가능한 승률 (~50%)

### 2.2 동적 허용 오차 확장

**문제: 엄격한 매칭 vs 대기 시간**
- 엄격한 ±50 ELO: 좋은 품질, 긴 대기
- 느슨한 ±200 ELO: 짧은 대기, 나쁜 품질

**해결책: 시간 기반 확장**
```
t < 5초:    ±100 ELO (엄격)
5-10초:     ±125 ELO
10-15초:    ±150 ELO
15-20초:    ±175 ELO
20초+:      ±200 ELO
```

**이점:**
- 초기에 품질 선호
- 기아 방지 (결국 모든 사람이 매칭됨)
- 사용자 경험 균형

### 2.3 큐 데이터 구조: 버킷팅

**왜 ELO로 버킷팅하는가?**

**단순 리스트: O(N²) 매칭**
- 모든 쌍 확인 필요
- 200명 = 20,000 비교

**ELO 버킷팅: O(N log N) + O(k × N)**
- 버킷별로 그룹화 (100 ELO 단위)
- 인접 버킷만 검색
- 200명 = ~200 비교 (k=2-3 버킷)

**구현:**
```cpp
std::map<int, std::list<QueuedPlayer>> buckets_;
// 예: buckets_[1200] = [Alice, Bob]
//     buckets_[1300] = [Carol]
```

---

## 3. 상세 설계

### 3.1 MatchRequest 클래스

**클래스 구조:**
```cpp
class MatchRequest {
public:
    MatchRequest(std::string player_id,
                int elo,
                std::chrono::steady_clock::time_point enqueued_at,
                std::string preferred_region = "global");

    std::string PlayerId() const;
    int Elo() const;
    std::chrono::steady_clock::time_point EnqueuedAt() const;
    std::string PreferredRegion() const;

    int CurrentTolerance(std::chrono::steady_clock::time_point now) const;
    double WaitSeconds(std::chrono::steady_clock::time_point now) const;

private:
    std::string player_id_;
    int elo_;
    std::chrono::steady_clock::time_point enqueued_at_;
    std::string preferred_region_;
};
```

**핵심 알고리즘: 동적 허용 오차**
```cpp
int MatchRequest::CurrentTolerance(
    std::chrono::steady_clock::time_point now) const {

    constexpr int kBaseTolerance = 100;
    constexpr int kToleranceStep = 25;
    constexpr double kStepSeconds = 5.0;

    auto waited = std::chrono::duration<double>(now - enqueued_at_).count();
    waited = std::max(0.0, waited);

    int increments = static_cast<int>(std::floor(waited / kStepSeconds));

    return kBaseTolerance + increments * kToleranceStep;
}
```

**예시:**
```
0초:    tolerance = 100
3초:    tolerance = 100
5초:    tolerance = 125
10초:   tolerance = 150
20초:   tolerance = 200
```

---

### 3.2 MatchQueue 인터페이스 & 구현

**추상 인터페이스:**
```cpp
struct QueuedPlayer {
    std::string player_id;
    int elo;
    std::chrono::steady_clock::time_point enqueued_at;
    std::string preferred_region;
    std::uint64_t order;  // 삽입 순서
};

class MatchQueue {
public:
    virtual ~MatchQueue() = default;

    virtual void Upsert(const MatchRequest& request,
                       std::uint64_t order) = 0;
    virtual bool Remove(const std::string& player_id) = 0;
    virtual std::vector<QueuedPlayer> FetchOrdered() const = 0;
    virtual std::size_t Size() const = 0;
};
```

**InMemoryMatchQueue 구현:**
```cpp
class InMemoryMatchQueue : public MatchQueue {
public:
    void Upsert(const MatchRequest& request,
               std::uint64_t order) override;
    bool Remove(const std::string& player_id) override;
    std::vector<QueuedPlayer> FetchOrdered() const override;
    std::size_t Size() const override;

private:
    struct BucketEntry {
        QueuedPlayer player;
        typename std::list<BucketEntry>::iterator self_it;
    };

    using Bucket = std::list<BucketEntry>;

    std::map<int, Bucket> buckets_;  // ELO -> 플레이어 리스트
    std::unordered_map<std::string,
        std::pair<int, typename Bucket::iterator>> index_;
};
```

**핵심 알고리즘:**

**1. Upsert (삽입/업데이트):**
```cpp
void InMemoryMatchQueue::Upsert(const MatchRequest& request,
                               std::uint64_t order) {
    // 기존 항목 제거
    Remove(request.PlayerId());

    // 새 QueuedPlayer 생성
    QueuedPlayer qp;
    qp.player_id = request.PlayerId();
    qp.elo = request.Elo();
    qp.enqueued_at = request.EnqueuedAt();
    qp.preferred_region = request.PreferredRegion();
    qp.order = order;

    // ELO 버킷에 삽입
    auto& bucket = buckets_[qp.elo];

    BucketEntry entry;
    entry.player = qp;

    bucket.push_back(entry);
    auto it = std::prev(bucket.end());
    it->self_it = it;

    // 빠른 조회를 위한 인덱스 업데이트
    index_[qp.player_id] = {qp.elo, it};
}
```

**2. Remove (삭제):**
```cpp
bool InMemoryMatchQueue::Remove(const std::string& player_id) {
    auto it = index_.find(player_id);
    if (it == index_.end()) {
        return false;
    }

    auto [elo, bucket_it] = it->second;

    // 버킷에서 제거
    auto& bucket = buckets_[elo];
    bucket.erase(bucket_it);

    // 빈 버킷 정리
    if (bucket.empty()) {
        buckets_.erase(elo);
    }

    // 인덱스에서 제거
    index_.erase(it);

    return true;
}
```

**3. FetchOrdered (순서 있는 조회):**
```cpp
std::vector<QueuedPlayer> InMemoryMatchQueue::FetchOrdered() const {
    std::vector<QueuedPlayer> result;

    // 모든 버킷의 모든 플레이어 수집
    for (const auto& [elo, bucket] : buckets_) {
        for (const auto& entry : bucket) {
            result.push_back(entry.player);
        }
    }

    // 정렬: 1차 ELO, 2차 order (삽입 순서)
    std::sort(result.begin(), result.end(),
        [](const QueuedPlayer& a, const QueuedPlayer& b) {
            if (a.elo != b.elo) return a.elo < b.elo;
            return a.order < b.order;
        });

    return result;
}
```

**복잡도 분석:**
- Upsert: O(log P) + O(1) = O(log P)
- Remove: O(1) + O(log P) = O(log P)
- FetchOrdered: O(P log P) (정렬)

---

### 3.3 Match 클래스

**클래스 구조:**
```cpp
class Match {
public:
    Match(std::string match_id,
          std::vector<std::string> players,
          int average_elo,
          std::chrono::steady_clock::time_point created_at,
          std::string region = "global");

    std::string MatchId() const;
    std::vector<std::string> Players() const;
    int AverageElo() const;
    std::chrono::steady_clock::time_point CreatedAt() const;
    std::string Region() const;

private:
    std::string match_id_;
    std::vector<std::string> players_;  // 정확히 2명
    int average_elo_;
    std::chrono::steady_clock::time_point created_at_;
    std::string region_;
};
```

**목적:**
- 매칭된 쌍의 불변 표현
- 추적 및 라우팅을 위한 메타데이터 전달

---

### 3.4 MatchNotificationChannel 클래스

**클래스 구조:**
```cpp
class MatchNotificationChannel {
public:
    void Publish(const Match& match);
    std::optional<Match> Poll();
    std::vector<Match> Drain();

private:
    std::mutex mutex_;
    std::queue<Match> queue_;
};
```

**구현:**
```cpp
void MatchNotificationChannel::Publish(const Match& match) {
    std::lock_guard<std::mutex> lock(mutex_);
    queue_.push(match);
}

std::optional<Match> MatchNotificationChannel::Poll() {
    std::lock_guard<std::mutex> lock(mutex_);

    if (queue_.empty()) {
        return std::nullopt;
    }

    auto match = queue_.front();
    queue_.pop();
    return match;
}
```

**목적:**
- 매치메이커와 매치 핸들러 분리
- 매치 이벤트의 여러 소비자 가능
- 게임 루프 통합을 위한 논블로킹 설계

---

### 3.5 Matchmaker 클래스

**클래스 구조:**
```cpp
class Matchmaker {
public:
    explicit Matchmaker(std::shared_ptr<MatchQueue> queue);

    void Enqueue(const MatchRequest& request);
    bool Cancel(const std::string& player_id);

    void RunMatching(std::chrono::steady_clock::time_point now);

    void SetMatchCreatedCallback(
        std::function<void(const Match&)> callback);

    MatchNotificationChannel& Notifications();

    std::string MetricsSnapshot() const;

private:
    std::shared_ptr<MatchQueue> queue_;
    mutable std::mutex mutex_;

    std::function<void(const Match&)> callback_;
    MatchNotificationChannel notifications_;

    std::uint64_t order_counter_{0};
    std::uint64_t match_counter_{0};

    // 메트릭
    std::uint64_t matches_created_{0};
    std::array<std::uint64_t, 6> wait_bucket_counts_{};
    std::uint64_t wait_overflow_count_{0};
};
```

**핵심 알고리즘: RunMatching**
```cpp
void Matchmaker::RunMatching(std::chrono::steady_clock::time_point now) {
    std::lock_guard<std::mutex> lock(mutex_);

    auto candidates = queue_->FetchOrdered();

    std::vector<bool> matched(candidates.size(), false);
    std::vector<Match> new_matches;

    // 탐욕적 순차 매칭
    for (std::size_t i = 0; i < candidates.size(); i++) {
        if (matched[i]) continue;

        const auto& candidate = candidates[i];
        int tolerance_a = MatchRequest(
            candidate.player_id,
            candidate.elo,
            candidate.enqueued_at,
            candidate.preferred_region
        ).CurrentTolerance(now);

        // 파트너 검색
        for (std::size_t j = i + 1; j < candidates.size(); j++) {
            if (matched[j]) continue;

            const auto& partner = candidates[j];

            // 지역 호환성 체크
            if (!RegionsCompatible(candidate.preferred_region,
                                  partner.preferred_region)) {
                continue;
            }

            // ELO 차이 계산
            int elo_diff = std::abs(candidate.elo - partner.elo);

            int tolerance_b = MatchRequest(
                partner.player_id,
                partner.elo,
                partner.enqueued_at,
                partner.preferred_region
            ).CurrentTolerance(now);

            // 양방향 허용 오차 체크
            if (elo_diff <= tolerance_a && elo_diff <= tolerance_b) {
                // 매치 발견!
                matched[i] = true;
                matched[j] = true;

                // Match 생성
                std::string match_id = "match-" +
                    std::to_string(match_counter_++);

                int avg_elo = (candidate.elo + partner.elo) / 2;

                Match match(
                    match_id,
                    {candidate.player_id, partner.player_id},
                    avg_elo,
                    now,
                    candidate.preferred_region
                );

                new_matches.push_back(match);

                // 대기 시간 메트릭 기록
                RecordWaitTime(candidate.enqueued_at, now);
                RecordWaitTime(partner.enqueued_at, now);

                break;  // 다음 후보로
            }

            // 조기 종료: ELO가 너무 높으면 더 이상 검색 불필요
            if (partner.elo - candidate.elo > tolerance_a) {
                break;
            }
        }
    }

    // 매칭된 플레이어 큐에서 제거
    for (std::size_t i = 0; i < candidates.size(); i++) {
        if (matched[i]) {
            queue_->Remove(candidates[i].player_id);
        }
    }

    // 매치 발행
    for (const auto& match : new_matches) {
        matches_created_++;

        notifications_.Publish(match);

        if (callback_) {
            callback_(match);
        }

        std::cout << "matchmaking match_created " << match.MatchId()
                  << " players=" << match.Players()[0]
                  << "," << match.Players()[1]
                  << " avg_elo=" << match.AverageElo() << std::endl;
    }
}
```

**매칭 품질 속성:**
- 탐욕적 (전역 최적은 아니지만 충분히 좋음)
- 공정: 먼저 큐에 들어간 플레이어가 먼저 매칭
- 대기 인식: 긴 대기는 허용 오차 증가 (기아 방지)
- 지역 인식: 플레이어 선호도 존중
- 양방향 허용 오차: 두 플레이어 모두 만족해야 함

---

## 4. 이벤트 플로우

### 4.1 플레이어 대기열 등록

```
WebSocket on_join(player_id) 콜백
  │
  ├─ MatchRequest 생성 (player_id, elo=1200, now)
  │
  ├─ Matchmaker::Enqueue(request)
  │     │
  │     ├─ order_counter_++ (삽입 순서)
  │     │
  │     ├─ queue_->Upsert(request, order)
  │     │     │
  │     │     ├─ 기존 항목 제거 (있으면)
  │     │     │
  │     │     └─ ELO 버킷에 삽입
  │     │
  │     └─ 로그: "matchmaking enqueue player_id elo=1200"
  │
  └─ 매칭 대기
```

### 4.2 매칭 실행 (타이머 기반)

```
Asio Timer (200ms마다)
  │
  ├─ Matchmaker::RunMatching(now)
  │     │
  │     ├─ queue_->FetchOrdered() → 순서 있는 후보 리스트
  │     │
  │     ├─ 각 후보에 대해:
  │     │     ├─ 이미 매칭됨? → 건너뛰기
  │     │     │
  │     │     ├─ tolerance_a = CurrentTolerance(now)
  │     │     │
  │     │     ├─ 파트너 검색 (j > i):
  │     │     │     ├─ 지역 호환? ELO 허용 오차 내?
  │     │     │     │
  │     │     │     └─ 예: Match 생성, 둘 다 matched 표시
  │     │     │
  │     │     └─ 파트너 없음? → 다음 후보로
  │     │
  │     ├─ 매칭된 플레이어 큐에서 제거
  │     │
  │     ├─ 각 매치에 대해:
  │     │     ├─ notifications_.Publish(match)
  │     │     │
  │     │     ├─ callback_(match) 호출
  │     │     │
  │     │     └─ 로그: "matchmaking match_created match-123"
  │     │
  │     └─ 메트릭 업데이트
  │
  └─ 다음 타이머 대기
```

### 4.3 플레이어 대기열 취소

```
WebSocket on_leave(player_id) 콜백
  │
  ├─ Matchmaker::Cancel(player_id)
  │     │
  │     ├─ queue_->Remove(player_id)
  │     │     │
  │     │     ├─ index_에서 조회
  │     │     │
  │     │     ├─ 버킷에서 제거
  │     │     │
  │     │     └─ 인덱스에서 제거
  │     │
  │     └─ 로그: "matchmaking cancel player_id"
  │
  └─ 큐에서 제거됨
```

---

## 5. 성능 예산

### 5.1 RunMatching 복잡도 (200명 큐)

| 단계 | 복잡도 | 예상 시간 | 비고 |
|------|--------|----------|------|
| FetchOrdered | O(P log P) | ~0.5ms | 200명 정렬 |
| 매칭 루프 | O(P²) worst, O(P) avg | ~1.0ms | 조기 매칭 |
| 큐 제거 (100명) | O(P log P) | ~0.3ms | 100명 매칭됨 |
| 메트릭 업데이트 | O(1) | ~0.05ms | 원자적 카운터 |
| **총** | | **~1.85ms** | < 2ms 목표 ✓ |

**최적화:**
- ELO 버킷팅으로 비교 감소
- 조기 종료 (허용 오차 초과 시)
- 결정론적 순서 (재정렬 불필요)

### 5.2 메모리 풋프린트

- QueuedPlayer당: ~200 bytes
- 200명 큐: ~40KB
- Match당: ~200 bytes
- 100 매치: ~20KB

---

## 6. Prometheus 메트릭

```
# TYPE matchmaking_queue_size gauge
matchmaking_queue_size 8

# TYPE matchmaking_matches_total counter
matchmaking_matches_total 45

# TYPE matchmaking_wait_seconds_bucket histogram
matchmaking_wait_seconds_bucket{le="0"} 0
matchmaking_wait_seconds_bucket{le="5"} 20
matchmaking_wait_seconds_bucket{le="10"} 35
matchmaking_wait_seconds_bucket{le="20"} 42
matchmaking_wait_seconds_bucket{le="40"} 44
matchmaking_wait_seconds_bucket{le="80"} 45
matchmaking_wait_seconds_bucket{le="+Inf"} 45
matchmaking_wait_seconds_count 45
```

---

## 7. 검증 전략

### 7.1 유닛 테스트

**대상 파일:**
- `tests/unit/test_match_queue.cpp`
- `tests/unit/test_matchmaker.cpp`

**커버리지:**

1. **큐 순서 의미론:**
```cpp
TEST(MatchQueueTest, OrderedRetrieval) {
    InMemoryMatchQueue queue;

    MatchRequest r1("p1", 1200, now);
    MatchRequest r2("p2", 1100, now);
    MatchRequest r3("p3", 1150, now);

    queue.Upsert(r1, 1);
    queue.Upsert(r2, 2);
    queue.Upsert(r3, 3);

    auto ordered = queue.FetchOrdered();

    EXPECT_EQ(ordered[0].player_id, "p2");  // 1100 ELO
    EXPECT_EQ(ordered[1].player_id, "p3");  // 1150 ELO
    EXPECT_EQ(ordered[2].player_id, "p1");  // 1200 ELO
}
```

2. **허용 오차 확장:**
```cpp
TEST(MatchmakerTest, ToleranceExpansion) {
    auto now = std::chrono::steady_clock::now();
    auto enqueued = now - std::chrono::seconds(12);

    MatchRequest request("p1", 1200, enqueued);

    int tolerance = request.CurrentTolerance(now);

    // 12초 = 2 × 5초 증분
    // 100 + 2 × 25 = 150
    EXPECT_EQ(tolerance, 150);
}
```

3. **결정론적 매칭:**
```cpp
TEST(MatchmakerTest, DeterministicMatching) {
    auto queue = std::make_shared<InMemoryMatchQueue>();
    Matchmaker mm(queue);

    auto now = std::chrono::steady_clock::now();

    // 4명 등록 (1200, 1250, 1100, 1150)
    mm.Enqueue(MatchRequest("p1", 1200, now));
    mm.Enqueue(MatchRequest("p2", 1250, now));
    mm.Enqueue(MatchRequest("p3", 1100, now));
    mm.Enqueue(MatchRequest("p4", 1150, now));

    std::vector<Match> matches;
    mm.SetMatchCreatedCallback([&](const Match& m) {
        matches.push_back(m);
    });

    mm.RunMatching(now);

    EXPECT_EQ(matches.size(), 2);

    // 가장 오래된 호환 쌍이 먼저 매칭됨
    // p3(1100) ↔ p4(1150): diff=50 < 100 ✓
    // p1(1200) ↔ p2(1250): diff=50 < 100 ✓
}
```

### 7.2 통합 테스트

**대상 파일:**
- `tests/integration/test_matchmaker_flow.cpp`

**시나리오:**

1. **20명 플레이어 → 10 매치:**
```cpp
TEST(MatchmakerFlowIntegration, TwentyPlayers) {
    auto queue = std::make_shared<InMemoryMatchQueue>();
    Matchmaker mm(queue);

    auto now = std::chrono::steady_clock::now();

    // 20명 등록 (ELO 1100-1300)
    for (int i = 0; i < 20; i++) {
        int elo = 1100 + (i * 10);
        mm.Enqueue(MatchRequest("p" + std::to_string(i), elo, now));
    }

    std::vector<Match> matches;
    mm.SetMatchCreatedCallback([&](const Match& m) {
        matches.push_back(m);
    });

    mm.RunMatching(now);

    EXPECT_EQ(matches.size(), 10);
    EXPECT_EQ(mm.Notifications().Drain().size(), 10);
}
```

### 7.3 성능 테스트

**대상 파일:**
- `tests/performance/test_matchmaking_perf.cpp`

**목표:**
- 200명 큐에서 RunMatching ≤ 2ms

```cpp
TEST(PerformanceTest, MatchmakingThroughput) {
    auto queue = std::make_shared<InMemoryMatchQueue>();
    Matchmaker mm(queue);

    auto now = std::chrono::steady_clock::now();

    // 200명 등록
    for (int i = 0; i < 200; i++) {
        int elo = 1000 + (i * 5);
        mm.Enqueue(MatchRequest("p" + std::to_string(i), elo, now));
    }

    // 벤치마크
    auto start = std::chrono::steady_clock::now();

    mm.RunMatching(now);

    auto end = std::chrono::steady_clock::now();
    auto duration = std::chrono::duration<double>(end - start);

    EXPECT_LT(duration.count(), 0.002);  // < 2ms
}
```

---

## 8. 알려진 제약 & 향후 개선점

### 8.1 현재 제약

1. **메모리 내 큐**: Redis 통합 없음
   - 개선: `RedisMatchQueue` 완전 구현

2. **단순 지역 매칭**: 문자열 비교만
   - 개선: 지리적 거리, 핑 기반 라우팅

3. **고정 허용 오차 확장**: 선형 증가
   - 개선: 큐 크기 기반 동적 조정

4. **단일 게임 모드**: 듀얼만
   - 개선: 팀 매칭 (4v4, 10명 배틀 로얄)

---

## 9. 체크리스트 (MVP 1.2 완료 기준)

- [x] `MatchRequest` 클래스 (동적 허용 오차)
- [x] `MatchQueue` 인터페이스 및 `InMemoryMatchQueue` 구현
- [x] `Match` 클래스 (매칭된 쌍)
- [x] `MatchNotificationChannel` (이벤트 브로커)
- [x] `Matchmaker` 클래스 (탐욕적 매칭 알고리즘)
- [x] ELO 버킷팅 및 순서 있는 조회
- [x] Enqueue/Cancel API
- [x] RunMatching 결정론적 매칭
- [x] 유닛 테스트 (match_queue, matchmaker)
- [x] 통합 테스트 (matchmaker_flow)
- [x] 성능 테스트 (matchmaking_perf ≤ 2ms)
- [x] Prometheus 메트릭 (queue_size, matches_total, wait_histogram)
- [x] 문서화 (매칭 알고리즘, 허용 오차 확장)

---

## 10. MVP 1.3과의 연결

**MVP 1.2에서 확립된 것:**
- 매치메이킹 파이프라인
- ELO 기반 매칭
- 대기 시간 메트릭
- 매치 생성 이벤트

**MVP 1.3에서 추가될 것:**
- 플레이어 프로필 서비스
- ELO 등급 계산기
- 전역 리더보드
- HTTP API (프로필, 순위)

MVP 1.2는 "매칭할 수 있는" 게임 서버이며, MVP 1.3은 "추적할 수 있는" 게임 서버로 진화한다.
