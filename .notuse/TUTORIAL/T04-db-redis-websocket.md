# T04: Database + Redis + WebSocket 패턴

> **목표**: PostgreSQL, Redis, WebSocket을 활용한 실시간 백엔드 시스템 구축
> **예상 시간**: 15-20시간
> **난이도**: 🟡 중급
> **선행 요구사항**: [T01](./T01-js-ts-core.md), [T03](./T03-nest-bootstrap.md)
> **적용 프로젝트**: video-editor v1.3, backend/node.js N2.1-N2.3

---

## 목차

1. [PostgreSQL 기초](#1-postgresql-기초)
2. [Prisma ORM](#2-prisma-orm)
3. [Redis 캐싱 패턴](#3-redis-캐싱-패턴)
4. [WebSocket 실시간 통신](#4-websocket-실시간-통신)
5. [통합 패턴](#5-통합-패턴)
6. [트러블슈팅](#6-트러블슈팅)
7. [프로젝트 적용](#7-프로젝트-적용)

---

## 1. PostgreSQL 기초

### 1.1 기본 SQL 명령어

```sql
-- 테이블 생성
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 데이터 삽입
INSERT INTO users (email, name, password_hash)
VALUES ('alice@example.com', 'Alice', 'hashed_password_123');

-- 데이터 조회
SELECT * FROM users WHERE email = 'alice@example.com';

-- 데이터 업데이트
UPDATE users
SET name = 'Alice Updated', updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- 데이터 삭제
DELETE FROM users WHERE id = 1;

-- JOIN 쿼리
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT users.name, posts.title, posts.created_at
FROM users
INNER JOIN posts ON users.id = posts.user_id
WHERE users.id = 1
ORDER BY posts.created_at DESC;

-- 집계 함수
SELECT user_id, COUNT(*) as post_count
FROM posts
GROUP BY user_id
HAVING COUNT(*) > 5;

-- 트랜잭션
BEGIN;

INSERT INTO users (email, name, password_hash)
VALUES ('bob@example.com', 'Bob', 'hashed_password_456');

INSERT INTO posts (user_id, title, content)
VALUES (LAST_INSERT_ID(), 'First Post', 'Hello, World!');

COMMIT; -- 또는 ROLLBACK;
```

---

### 1.2 고급 쿼리 패턴

```sql
-- 페이지네이션 (Offset-based)
SELECT * FROM posts
ORDER BY created_at DESC
LIMIT 20 OFFSET 0; -- 첫 페이지
-- OFFSET 20 -- 두 번째 페이지

-- 페이지네이션 (Cursor-based, 더 효율적)
SELECT * FROM posts
WHERE id < 100 -- 이전 마지막 id
ORDER BY id DESC
LIMIT 20;

-- Full-text search (PostgreSQL)
ALTER TABLE posts ADD COLUMN search_vector tsvector;

UPDATE posts SET search_vector =
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''));

CREATE INDEX idx_posts_search ON posts USING gin(search_vector);

SELECT * FROM posts
WHERE search_vector @@ to_tsquery('english', 'javascript & typescript');

-- JSON 필드 쿼리 (JSONB)
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- JSONB 데이터 삽입
INSERT INTO events (data)
VALUES ('{"user_id": 1, "action": "login", "ip": "192.168.1.1"}');

-- JSONB 쿼리
SELECT * FROM events
WHERE data->>'action' = 'login';

SELECT * FROM events
WHERE data @> '{"user_id": 1}';

-- JSONB 인덱스
CREATE INDEX idx_events_data ON events USING gin(data);
```

---

## 2. Prisma ORM

### 2.1 Prisma 스키마 정의

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  name         String
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  posts        Post[]
  sessions     Session[]

  @@index([email])
  @@map("users")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?  @db.Text
  published Boolean  @default(false)
  authorId  Int      @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@index([published, createdAt])
  @@map("posts")
}

model Session {
  id        String   @id @default(uuid())
  userId    Int      @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("sessions")
}
```

---

### 2.2 Prisma Client 사용

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// 생성 (Create)
async function createUser(email: string, name: string, passwordHash: string) {
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  return user;
}

// 조회 (Read)
async function findUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      posts: {
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  return user;
}

// 업데이트 (Update)
async function updateUser(id: number, data: { name?: string; email?: string }) {
  const user = await prisma.user.update({
    where: { id },
    data,
  });

  return user;
}

// 삭제 (Delete)
async function deleteUser(id: number) {
  await prisma.user.delete({
    where: { id },
  });
}

// 복잡한 쿼리
async function searchPosts(query: string, limit: number = 20) {
  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
      ],
      published: true,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return posts;
}

// 트랜잭션
async function createUserWithPost(
  email: string,
  name: string,
  passwordHash: string,
  postTitle: string,
  postContent: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, passwordHash },
    });

    const post = await tx.post.create({
      data: {
        title: postTitle,
        content: postContent,
        authorId: user.id,
        published: true,
      },
    });

    return { user, post };
  });

  return result;
}

// 배치 작업
async function deleteOldSessions() {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`Deleted ${result.count} expired sessions`);
}

// Raw query (필요 시)
async function complexQuery() {
  const result = await prisma.$queryRaw`
    SELECT u.name, COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN posts p ON u.id = p.author_id
    GROUP BY u.id, u.name
    HAVING COUNT(p.id) > 5
    ORDER BY post_count DESC
  `;

  return result;
}
```

---

### 2.3 Prisma 마이그레이션

```bash
# 마이그레이션 생성
npx prisma migrate dev --name init

# 마이그레이션 적용 (프로덕션)
npx prisma migrate deploy

# 스키마 동기화 (개발 시)
npx prisma db push

# Prisma Client 재생성
npx prisma generate

# 데이터베이스 초기화 (주의!)
npx prisma migrate reset

# Seed 데이터 스크립트
# prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 사용자 생성
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: 'hashed_password_123',
      posts: {
        create: [
          {
            title: 'First Post',
            content: 'Hello, World!',
            published: true,
          },
          {
            title: 'Second Post',
            content: 'More content',
            published: true,
          },
        ],
      },
    },
  });

  console.log('Seed data created:', alice);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 3. Redis 캐싱 패턴

### 3.1 Redis 기본 명령어

```typescript
import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

async function initRedis() {
  redisClient = createClient({
    url: 'redis://localhost:6379',
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));

  await redisClient.connect();
}

// 문자열 저장/조회
async function setGetExample() {
  await redisClient.set('key', 'value');
  const value = await redisClient.get('key');
  console.log(value); // 'value'
}

// TTL (Time To Live) 설정
async function setWithTTL() {
  // 60초 후 자동 삭제
  await redisClient.setEx('session:abc123', 60, 'user_data');

  // TTL 확인
  const ttl = await redisClient.ttl('session:abc123');
  console.log(`TTL: ${ttl} seconds`);
}

// JSON 데이터 저장
async function setJSON(key: string, data: object) {
  await redisClient.set(key, JSON.stringify(data));
}

async function getJSON<T>(key: string): Promise<T | null> {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

// Hash (객체 저장)
async function hashExample() {
  await redisClient.hSet('user:1', {
    name: 'Alice',
    email: 'alice@example.com',
    age: '25',
  });

  const user = await redisClient.hGetAll('user:1');
  console.log(user); // { name: 'Alice', email: 'alice@example.com', age: '25' }

  const name = await redisClient.hGet('user:1', 'name');
  console.log(name); // 'Alice'
}

// List (큐, 스택)
async function listExample() {
  // 오른쪽에 추가 (큐)
  await redisClient.rPush('queue', ['task1', 'task2', 'task3']);

  // 왼쪽에서 제거 (큐)
  const task = await redisClient.lPop('queue');
  console.log(task); // 'task1'

  // 리스트 전체 조회
  const remaining = await redisClient.lRange('queue', 0, -1);
  console.log(remaining); // ['task2', 'task3']
}

// Set (중복 제거)
async function setExample() {
  await redisClient.sAdd('tags', ['javascript', 'typescript', 'node']);

  const isMember = await redisClient.sIsMember('tags', 'javascript');
  console.log(isMember); // true

  const members = await redisClient.sMembers('tags');
  console.log(members); // ['javascript', 'typescript', 'node']
}

// Sorted Set (순위, 리더보드)
async function sortedSetExample() {
  await redisClient.zAdd('leaderboard', [
    { score: 100, value: 'player1' },
    { score: 200, value: 'player2' },
    { score: 150, value: 'player3' },
  ]);

  // 상위 3명 조회 (내림차순)
  const top3 = await redisClient.zRangeWithScores('leaderboard', 0, 2, {
    REV: true,
  });
  console.log(top3);
  // [
  //   { value: 'player2', score: 200 },
  //   { value: 'player3', score: 150 },
  //   { value: 'player1', score: 100 }
  // ]

  // 순위 조회 (0-based)
  const rank = await redisClient.zRevRank('leaderboard', 'player3');
  console.log(rank); // 1 (2등)
}

// 키 삭제
async function deleteKey(key: string) {
  await redisClient.del(key);
}

// 키 존재 확인
async function exists(key: string): Promise<boolean> {
  const result = await redisClient.exists(key);
  return result === 1;
}

// 패턴 매칭 키 조회 (주의: 프로덕션에서는 사용 자제)
async function findKeysByPattern(pattern: string) {
  const keys = await redisClient.keys(pattern);
  return keys;
}
```

---

### 3.2 캐싱 패턴

**Cache-Aside (Lazy Loading)**:

```typescript
async function getUserWithCache(userId: number) {
  const cacheKey = `user:${userId}`;

  // 1. 캐시 확인
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    console.log('Cache hit');
    return JSON.parse(cached);
  }

  console.log('Cache miss');

  // 2. DB 조회
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  // 3. 캐시 저장 (TTL 1시간)
  await redisClient.setEx(cacheKey, 3600, JSON.stringify(user));

  return user;
}

// 캐시 무효화
async function invalidateUserCache(userId: number) {
  const cacheKey = `user:${userId}`;
  await redisClient.del(cacheKey);
}
```

**Write-Through**:

```typescript
async function updateUserWithCache(userId: number, data: { name?: string }) {
  // 1. DB 업데이트
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });

  // 2. 캐시 업데이트
  const cacheKey = `user:${userId}`;
  await redisClient.setEx(cacheKey, 3600, JSON.stringify(user));

  return user;
}
```

**Cache-aside with refresh**:

```typescript
interface CacheOptions {
  ttl: number;
  refreshThreshold?: number; // TTL의 몇 %에서 백그라운드 새로고침
}

async function getWithRefresh<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const cached = await redisClient.get(cacheKey);

  if (cached) {
    const data = JSON.parse(cached);

    // TTL 확인하여 새로고침 필요 여부 판단
    if (options.refreshThreshold) {
      const ttl = await redisClient.ttl(cacheKey);
      const refreshAt = options.ttl * (options.refreshThreshold / 100);

      if (ttl < refreshAt) {
        // 백그라운드에서 새로고침 (응답은 캐시 반환)
        fetchFn().then((fresh) => {
          redisClient.setEx(cacheKey, options.ttl, JSON.stringify(fresh));
        });
      }
    }

    return data;
  }

  // 캐시 미스: 데이터 가져와서 저장
  const fresh = await fetchFn();
  await redisClient.setEx(cacheKey, options.ttl, JSON.stringify(fresh));

  return fresh;
}

// 사용 예제
const user = await getWithRefresh(
  `user:${userId}`,
  () => prisma.user.findUnique({ where: { id: userId } }),
  { ttl: 3600, refreshThreshold: 20 } // TTL 20% 남았을 때 백그라운드 새로고침
);
```

---

## 4. WebSocket 실시간 통신

### 4.1 WebSocket 서버 (ws 라이브러리)

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

interface ExtendedWebSocket extends WebSocket {
  userId?: number;
  roomId?: string;
}

const wss = new WebSocketServer({ port: 8080 });

// 연결된 클라이언트 관리
const clients = new Map<number, ExtendedWebSocket>();
const rooms = new Map<string, Set<ExtendedWebSocket>>();

wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
  console.log('New client connected');

  // 인증 (쿼리 파라미터에서 토큰 추출)
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Token required');
    return;
  }

  // 토큰 검증 (실제로는 JWT 검증)
  const userId = verifyToken(token);
  if (!userId) {
    ws.close(1008, 'Invalid token');
    return;
  }

  ws.userId = userId;
  clients.set(userId, ws);

  // 메시지 수신
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      await handleMessage(ws, message);
    } catch (error) {
      console.error('Message handling error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  });

  // 연결 종료
  ws.on('close', () => {
    console.log(`Client ${userId} disconnected`);
    clients.delete(userId);

    // 모든 룸에서 제거
    rooms.forEach((roomClients, roomId) => {
      roomClients.delete(ws);
      if (roomClients.size === 0) {
        rooms.delete(roomId);
      }
    });
  });

  // Ping/Pong (연결 유지)
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  // 환영 메시지
  ws.send(JSON.stringify({ type: 'welcome', userId }));
});

// Ping/Pong 주기 (30초마다)
const interval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// 메시지 핸들러
async function handleMessage(ws: ExtendedWebSocket, message: any) {
  switch (message.type) {
    case 'join_room':
      joinRoom(ws, message.roomId);
      break;

    case 'leave_room':
      leaveRoom(ws, message.roomId);
      break;

    case 'send_message':
      broadcastToRoom(message.roomId, {
        type: 'new_message',
        userId: ws.userId,
        content: message.content,
        timestamp: Date.now(),
      });
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

// 룸 참가
function joinRoom(ws: ExtendedWebSocket, roomId: string) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  rooms.get(roomId)!.add(ws);
  ws.roomId = roomId;

  ws.send(JSON.stringify({ type: 'joined_room', roomId }));

  // 다른 사용자에게 알림
  broadcastToRoom(roomId, {
    type: 'user_joined',
    userId: ws.userId,
  }, ws);
}

// 룸 퇴장
function leaveRoom(ws: ExtendedWebSocket, roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }

  ws.send(JSON.stringify({ type: 'left_room', roomId }));

  // 다른 사용자에게 알림
  broadcastToRoom(roomId, {
    type: 'user_left',
    userId: ws.userId,
  });
}

// 룸 내 브로드캐스트
function broadcastToRoom(roomId: string, message: any, exclude?: ExtendedWebSocket) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(message);

  room.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// 특정 사용자에게 메시지 전송
function sendToUser(userId: number, message: any) {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

// 토큰 검증 (예시)
function verifyToken(token: string): number | null {
  // 실제로는 JWT 검증
  if (token === 'valid_token') {
    return 1;
  }
  return null;
}
```

---

### 4.2 WebSocket 클라이언트

```typescript
// 클라이언트 (브라우저)
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string, token: string) {
    this.ws = new WebSocket(`${url}?token=${token}`);

    this.ws.onopen = () => {
      console.log('Connected to WebSocket server');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from WebSocket server');
      this.reconnect(url, token);
    };
  }

  private reconnect(url: string, token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms...`);

    setTimeout(() => {
      this.connect(url, token);
    }, delay);
  }

  send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    } else {
      console.error('WebSocket is not open');
    }
  }

  joinRoom(roomId: string) {
    this.send('join_room', { roomId });
  }

  leaveRoom(roomId: string) {
    this.send('leave_room', { roomId });
  }

  sendMessage(roomId: string, content: string) {
    this.send('send_message', { roomId, content });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'welcome':
        console.log('Welcome, userId:', message.userId);
        break;

      case 'joined_room':
        console.log('Joined room:', message.roomId);
        break;

      case 'new_message':
        console.log('New message:', message);
        break;

      case 'user_joined':
        console.log('User joined:', message.userId);
        break;

      case 'user_left':
        console.log('User left:', message.userId);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 사용 예제
const client = new WebSocketClient();
client.connect('ws://localhost:8080', 'valid_token');

client.joinRoom('room-123');
client.sendMessage('room-123', 'Hello, everyone!');
```

---

## 5. 통합 패턴

### 5.1 실시간 진행률 업데이트 (video-editor 예제)

```typescript
// 서버: 비디오 처리 작업 + WebSocket 진행률
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const wss = new WebSocketServer({ port: 8080 });

interface ProcessingJob {
  id: string;
  userId: number;
  inputPath: string;
  operation: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

const jobs = new Map<string, ProcessingJob>();

async function processVideo(jobId: string, inputPath: string, outputPath: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  broadcastJobUpdate(job);

  const ffmpegProcess = spawn('ffmpeg', [
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'medium',
    outputPath,
  ]);

  ffmpegProcess.stderr.on('data', (data) => {
    const output = data.toString();

    // ffmpeg 진행률 파싱
    const match = output.match(/time=(\d+:\d+:\d+\.\d+)/);
    if (match) {
      const progress = calculateProgress(match[1]);
      job.progress = progress;
      broadcastJobUpdate(job);
    }
  });

  ffmpegProcess.on('close', (code) => {
    if (code === 0) {
      job.status = 'completed';
      job.progress = 100;
    } else {
      job.status = 'error';
    }

    broadcastJobUpdate(job);
  });
}

function broadcastJobUpdate(job: ProcessingJob) {
  wss.clients.forEach((client: any) => {
    if (client.userId === job.userId) {
      client.send(JSON.stringify({
        type: 'job_update',
        job: {
          id: job.id,
          progress: job.progress,
          status: job.status,
        },
      }));
    }
  });
}

function calculateProgress(time: string): number {
  // 시간을 초로 변환하여 진행률 계산
  // 실제로는 전체 비디오 길이와 비교
  return 0;
}
```

---

### 5.2 Redis Pub/Sub + WebSocket

```typescript
// Redis Pub/Sub을 통한 다중 서버 WebSocket 동기화
import { createClient } from 'redis';

const publisher = createClient();
const subscriber = createClient();

await Promise.all([publisher.connect(), subscriber.connect()]);

// 메시지 발행
async function publishMessage(channel: string, message: any) {
  await publisher.publish(channel, JSON.stringify(message));
}

// 메시지 구독
await subscriber.subscribe('notifications', (message) => {
  const data = JSON.parse(message);

  // 모든 WebSocket 클라이언트에 브로드캐스트
  wss.clients.forEach((client: any) => {
    if (client.userId === data.userId) {
      client.send(JSON.stringify(data));
    }
  });
});

// 사용 예제: 알림 전송
async function notifyUser(userId: number, notification: any) {
  await publishMessage('notifications', {
    userId,
    type: 'notification',
    ...notification,
  });
}
```

---

## 6. 트러블슈팅

### 6.1 N+1 쿼리 문제

**문제**: 사용자 목록 조회 시 각 사용자의 게시글을 별도로 조회

```typescript
// ❌ N+1 문제 발생
const users = await prisma.user.findMany();

for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
  // N번의 추가 쿼리
}

// ✅ 해결: include로 한 번에 조회
const users = await prisma.user.findMany({
  include: {
    posts: true,
  },
});
```

---

### 6.2 WebSocket 메모리 누수

**문제**: 연결 종료 시 이벤트 리스너 제거 안 됨

```typescript
// ✅ 이벤트 리스너 제거
ws.on('close', () => {
  ws.removeAllListeners();
  clients.delete(userId);
});
```

---

## 7. 프로젝트 적용

**video-editor v1.3: 실시간 진행률 + 캐싱**

```typescript
// 전체 아키텍처
// PostgreSQL: 비디오 메타데이터, 프로젝트 저장
// Redis: 메타데이터 캐시, 작업 큐
// WebSocket: 실시간 진행률 업데이트
```

---

## 면접 질문

1. **N+1 문제란 무엇이고 어떻게 해결하나요?**
2. **Redis의 주요 데이터 구조는?**
3. **WebSocket과 HTTP 폴링의 차이는?**
4. **트랜잭션의 ACID 속성은?**
5. **캐시 무효화 전략에는 어떤 것들이 있나요?**

---

## 다음 단계

- 고급 백엔드 패턴 → [T05: Elasticsearch/Kafka/RBAC](./T05-advanced-backend.md)
- 프로덕션 배포 → [T13: Docker + 모니터링](./T13-docker-deployment.md)
