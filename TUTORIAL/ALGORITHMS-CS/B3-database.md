# B3: DB 기초

> **목표**: DB 핵심 개념을 본인 프로젝트 DB 설계로 설명 가능
> **예상 시간**: 15-20시간
> **난이도**: 🟡 중급
> **선행 요구사항**: SQL 기본 문법
> **완료 기준**: 본인 프로젝트 DB 설계를 ERD로 그리고 인덱스/트랜잭션 설명 가능

---

## 목차

1. [관계형 모델 & 정규화](#1-관계형-모델--정규화)
2. [인덱스](#2-인덱스)
3. [트랜잭션 & 격리수준](#3-트랜잭션--격리수준)
4. [락 & 경쟁](#4-락--경쟁)
5. [ORM 패턴](#5-orm-패턴)
6. [게임 서버 DB 패턴](#6-게임-서버-db-패턴)
7. [프로젝트 연계](#7-프로젝트-연계)

---

## 1. 관계형 모델 & 정규화

### 기본 개념

**관계형 DB**:
- 테이블 (Table/Relation)
- 행 (Row/Tuple)
- 열 (Column/Attribute)
- PK (Primary Key): 유일 식별자
- FK (Foreign Key): 다른 테이블 참조

### 정규화

**목적**: 중복 제거, 갱신 이상 방지

**1NF (제1정규형)**:
- 각 칼럼이 원자값(atomic)을 가짐

```sql
-- ❌ 1NF 위반
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    hobbies VARCHAR(200)  -- '독서, 영화, 게임' (원자값 아님)
);

-- ✅ 1NF 만족
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50)
);

CREATE TABLE hobbies (
    user_id INT REFERENCES users(id),
    hobby VARCHAR(50)
);
```

**2NF (제2정규형)**:
- 1NF + 부분 함수 종속 제거
- 모든 비주요 속성이 PK 전체에 완전 함수 종속

**3NF (제3정규형)**:
- 2NF + 이행적 함수 종속 제거
- 비주요 속성이 다른 비주요 속성에 종속 안 됨

```sql
-- ❌ 3NF 위반
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    dept_id INT,
    dept_name VARCHAR(50)  -- dept_id로 결정됨 (이행적 종속)
);

-- ✅ 3NF 만족
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    dept_id INT REFERENCES departments(id)
);

CREATE TABLE departments (
    id INT PRIMARY KEY,
    name VARCHAR(50)
);
```

---

## 2. 인덱스

### 개념

**인덱스**: 테이블의 데이터를 빠르게 찾기 위한 자료구조

**B-Tree 인덱스**:
- 대부분의 RDBMS 기본 인덱스
- O(log N) 검색
- 범위 쿼리에 효율적

### 인덱스 생성

```sql
-- 단일 컬럼 인덱스
CREATE INDEX idx_users_email ON users(email);

-- 복합 인덱스
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);

-- 유니크 인덱스
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);
```

### 인덱스가 효과적인 경우

```sql
-- ✅ 인덱스 사용 (WHERE, JOIN, ORDER BY)
SELECT * FROM users WHERE email = 'alice@example.com';

SELECT * FROM orders
WHERE user_id = 1
ORDER BY created_at DESC;

SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id;
```

### 인덱스가 비효율적인 경우

```sql
-- ❌ 함수 적용
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';

-- ❌ 앞부분 와일드카드
SELECT * FROM users WHERE email LIKE '%@example.com';

-- ❌ OR 조건 (인덱스 개별적으로는 가능하지만 합치기 비효율)
SELECT * FROM users WHERE email = 'a@example.com' OR name = 'Alice';

-- ❌ 타입 불일치
SELECT * FROM users WHERE id = '123';  -- id는 INT인데 문자열 비교
```

### 복합 인덱스 순서

**규칙**: 선택도가 높은 컬럼을 앞에

```sql
-- 예: (user_id, created_at) 인덱스

-- ✅ user_id만 사용 (인덱스 활용)
SELECT * FROM orders WHERE user_id = 1;

-- ✅ user_id + created_at (인덱스 활용)
SELECT * FROM orders WHERE user_id = 1 AND created_at > '2024-01-01';

-- ❌ created_at만 사용 (인덱스 활용 안 됨)
SELECT * FROM orders WHERE created_at > '2024-01-01';
```

**최적화 예**:
```sql
-- 쿼리 패턴 분석
-- 1. WHERE user_id = ? (90%)
-- 2. WHERE user_id = ? AND created_at > ? (50%)
-- 3. WHERE created_at > ? (10%)

-- 최적 인덱스: (user_id, created_at)
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);

-- 추가 인덱스 (3번 쿼리용)
CREATE INDEX idx_orders_created ON orders(created_at);
```

---

## 3. 트랜잭션 & 격리수준

### ACID

- **Atomicity (원자성)**: 트랜잭션의 모든 작업이 성공하거나 모두 실패
- **Consistency (일관성)**: 트랜잭션 전후에 DB가 일관된 상태
- **Isolation (고립성)**: 트랜잭션이 서로 간섭하지 않음
- **Durability (지속성)**: 커밋된 트랜잭션은 영구 반영

### 트랜잭션 기본

```sql
BEGIN;  -- 트랜잭션 시작

UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

COMMIT;  -- 커밋 (영구 반영)
-- 또는
ROLLBACK;  -- 롤백 (모든 변경 취소)
```

### 격리수준 (Isolation Level)

| 격리수준 | Dirty Read | Non-Repeatable Read | Phantom Read |
|---------|-----------|---------------------|-------------|
| **Read Uncommitted** | ✅ | ✅ | ✅ |
| **Read Committed** | ❌ | ✅ | ✅ |
| **Repeatable Read** | ❌ | ❌ | ✅ |
| **Serializable** | ❌ | ❌ | ❌ |

**Dirty Read**: 커밋되지 않은 데이터 읽기
**Non-Repeatable Read**: 같은 쿼리가 다른 결과 반환
**Phantom Read**: 범위 쿼리에서 새 행 등장

### 예제: Non-Repeatable Read

```sql
-- Transaction A
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000

-- (Transaction B가 balance를 1500으로 변경하고 커밋)

SELECT balance FROM accounts WHERE id = 1;  -- 1500 (다른 결과!)
COMMIT;
```

**해결**: Repeatable Read 이상 사용

---

## 4. 락 & 경쟁

### Row-Level Lock

```sql
-- 비관적 락 (Pessimistic Lock)
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;  -- 행 잠금
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;

-- 낙관적 락 (Optimistic Lock)
-- version 컬럼 사용
UPDATE accounts
SET balance = balance - 100, version = version + 1
WHERE id = 1 AND version = 10;  -- version 체크

-- 영향 받은 행이 0이면 충돌 발생 → 재시도
```

### Deadlock

**발생 예**:
```sql
-- Transaction A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;  -- 1번 잠금
-- ... 대기 ...
UPDATE accounts SET balance = balance + 100 WHERE id = 2;  -- 2번 잠금 대기
COMMIT;

-- Transaction B
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;   -- 2번 잠금
-- ... 대기 ...
UPDATE accounts SET balance = balance + 50 WHERE id = 1;   -- 1번 잠금 대기
COMMIT;

-- ⚠️ Deadlock 발생!
```

**해결**:
1. **락 순서 고정**: 항상 낮은 id부터 잠금
2. **타임아웃**: 일정 시간 후 롤백 후 재시도
3. **락 범위 최소화**: 트랜잭션을 짧게 유지

### Long Transaction의 문제

```sql
-- ❌ 긴 트랜잭션
BEGIN;
-- 복잡한 계산 (5초)
UPDATE ...;
-- 외부 API 호출 (10초)
UPDATE ...;
COMMIT;  -- 총 15초

-- 문제:
-- 1. 다른 트랜잭션 블로킹
-- 2. 락 경쟁 증가
-- 3. 데드락 가능성 증가
```

**해결**:
```sql
-- ✅ 트랜잭션 최소화
-- 1. 계산/API 호출 먼저
-- 2. 트랜잭션은 DB 작업만
BEGIN;
UPDATE ...;
UPDATE ...;
COMMIT;  -- 0.1초
```

---

## 5. ORM 패턴

### N+1 문제

```typescript
// ❌ N+1 쿼리
const users = await prisma.user.findMany();  // 1 쿼리

for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { userId: user.id }
  });  // N 쿼리 (users 개수만큼)
}

// ✅ Eager Loading
const users = await prisma.user.findMany({
  include: {
    posts: true  // JOIN으로 1 쿼리
  }
});
```

### Prisma 트랜잭션

```typescript
// NestJS + Prisma
await prisma.$transaction(async (tx) => {
  // 사용자 생성
  const user = await tx.user.create({
    data: { name: 'Alice', email: 'alice@example.com' }
  });

  // 프로필 생성
  await tx.profile.create({
    data: { userId: user.id, bio: 'Hello' }
  });

  // 중간에 에러 발생 시 자동 롤백
});
```

---

## 6. 게임 서버 DB 패턴

### Redis 세션 관리

**패턴**: Write-Through Cache

```typescript
// 로그인 시 세션 저장
await redis.set(`session:${userId}`, JSON.stringify(sessionData), 'EX', 3600);

// 게임 중 세션 확인 (빠름)
const sessionData = await redis.get(`session:${userId}`);

// 로그아웃 시 세션 삭제
await redis.del(`session:${userId}`);
```

### PostgreSQL 리더보드

**패턴**: Write-Back Cache

```sql
-- 리더보드 테이블
CREATE TABLE leaderboard (
    user_id INT PRIMARY KEY,
    score INT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);

-- 상위 10명 조회
SELECT user_id, score
FROM leaderboard
ORDER BY score DESC
LIMIT 10;
```

**Redis + PostgreSQL 조합**:
```typescript
// 게임 중: Redis에 점수 업데이트 (빠름)
await redis.zincrby('leaderboard', 100, userId);

// 5분마다: Redis → PostgreSQL 영속화 (배치)
setInterval(async () => {
  const entries = await redis.zrevrange('leaderboard', 0, -1, 'WITHSCORES');

  await prisma.$transaction(async (tx) => {
    for (const [userId, score] of entries) {
      await tx.leaderboard.upsert({
        where: { userId },
        update: { score },
        create: { userId, score }
      });
    }
  });
}, 5 * 60 * 1000);
```

### 게임 상태는 메모리, 결과만 DB

**패턴**:
1. 게임 진행 중: 메모리에 상태 유지
2. 게임 종료 시: DB에 결과 영속화

```cpp
// 게임 서버 메모리
struct GameSession {
    std::vector<Player> players;
    GameState state;
    // ...
};

std::unordered_map<SessionId, GameSession> activeSessions;

// 게임 종료 시
void endGame(SessionId sessionId) {
    auto& session = activeSessions[sessionId];

    // DB에 결과 저장
    saveGameResult(session);

    // 메모리에서 제거
    activeSessions.erase(sessionId);
}
```

---

## 7. 프로젝트 연계

### NestJS 백엔드

**Prisma Schema**:
```prisma
// schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  issues    Issue[]
  @@index([email])
}

model Issue {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  status      String   @default("OPEN")
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
}
```

**트랜잭션**:
```typescript
// N2.1: Issue 생성 + 알림
async createIssue(dto: CreateIssueDto) {
  return await this.prisma.$transaction(async (tx) => {
    // Issue 생성
    const issue = await tx.issue.create({
      data: dto
    });

    // 알림 생성
    await tx.notification.create({
      data: {
        userId: dto.userId,
        message: `Issue #${issue.id} created`
      }
    });

    return issue;
  });
}
```

### video-editor

**프로젝트 저장** (v1.3):
```sql
-- 프로젝트 테이블
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 비디오 클립 테이블
CREATE TABLE clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    video_path VARCHAR(500) NOT NULL,
    start_time FLOAT NOT NULL,
    end_time FLOAT NOT NULL,
    order_index INT NOT NULL
);

CREATE INDEX idx_clips_project_order ON clips(project_id, order_index);
```

---

## 면접 질문

### 1. 인덱스를 어디에 걸었나요? 왜?
**답변**: Issue 테이블에 (user_id, created_at) 복합 인덱스를 걸었습니다. "특정 사용자의 최근 이슈 조회" 쿼리가 전체의 70%를 차지했기 때문입니다. user_id를 앞에 둔 이유는 선택도가 높고, 대부분 쿼리가 user_id로 필터링하기 때문입니다.

### 2. 트랜잭션을 어디에 사용했나요?
**답변**: Issue 생성 + 알림 생성 로직에서 사용했습니다. 두 작업이 원자적으로 수행되어야 하며, 알림 생성 실패 시 Issue 생성도 롤백되어야 하기 때문입니다. Prisma의 $transaction API를 사용했습니다.

### 3. 게임 서버에서 Redis와 PostgreSQL을 어떻게 구분해서 사용하나요?
**답변**: Redis는 빠른 읽기/쓰기가 필요한 세션 관리와 실시간 리더보드에 사용하고, PostgreSQL은 영속성이 중요한 사용자 계정과 게임 결과에 사용합니다. Redis는 Write-Through Cache 패턴으로 즉시 업데이트하고, 주기적으로 PostgreSQL에 배치로 영속화합니다.

---

## 다음 단계

✅ **B3 완료 후**:
- 알고리즘 트랙으로 복귀 또는
- 프로젝트 개발 시작

**체크리스트**:
- [ ] 정규화 개념 이해
- [ ] 인덱스 설계 가능
- [ ] 트랜잭션/격리수준 설명 가능
- [ ] 본인 프로젝트 DB ERD 작성 완료

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
