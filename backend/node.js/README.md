# Web Phase 1.5 - Node.js 패턴 훈련

이 프로젝트는 NestJS를 사용한 Node.js 백엔드 패턴 훈련을 위한 Web Phase 1.5 마일스톤 (N2.0-N2.6)을 구현합니다.

## 현재 상태

**모든 마일스톤 완료 (N2.0 - N2.6)** ✅

**마일스톤 N2.0** - NestJS Bootstrap & CI 베이스라인 ✅
- ✅ NestJS 애플리케이션 설정
- ✅ 환경 설정
- ✅ 헬스 체크 엔드포인트
- ✅ 기본 e2e 테스트
- ✅ GitHub Actions CI 파이프라인

**마일스톤 N2.1** - 레이어드 CRUD & 트랜잭션 패턴 ✅
- ✅ 이슈 트래커 도메인 (User, Project, Issue, Comment)
- ✅ Prisma를 사용한 Controller/Service/Repository 패턴
- ✅ JWT 인증
- ✅ class-validator를 사용한 DTO 검증
- ✅ 트랜잭션 지원

**마일스톤 N2.2** - Team & 역할 기반 접근 제어 ✅
- ✅ Team 및 TeamMember 모델
- ✅ 커스텀 가드 및 데코레이터를 사용한 RBAC
- ✅ 401/403/404 상태 코드 처리
- ✅ 인가 테스트

**마일스톤 N2.3** - 배치 작업, 통계, 캐시, 외부 API ✅
- ✅ 일일 통계 배치 작업 (@nestjs/schedule 사용)
- ✅ 통계 API 엔드포인트
- ✅ @nestjs/cache-manager를 사용한 인메모리 캐싱
- ✅ 재시도 로직을 사용한 외부 API 통합

**마일스톤 N2.4** - Elasticsearch 검색 ✅
- ✅ 상품 카탈로그 도메인
- ✅ Elasticsearch 통합
- ✅ 전문 검색 API
- ✅ Elasticsearch와 상품 동기화

**마일스톤 N2.5** - Kafka 비동기 이벤트 처리 ✅
- ✅ Order 및 Notification 도메인
- ✅ 주문 이벤트용 Kafka 프로듀서
- ✅ 알림용 Kafka 컨슈머
- ✅ 이벤트 주도 아키텍처
- ✅ 로컬 개발용 Docker Compose 설정

**마일스톤 N2.6** - 프로덕션 준비 (DB, 캐시, 배포 가능) ✅
- ✅ 빠른 로컬/테스트 실행을 위한 SQLite 우선 스키마 (Docker를 통한 PostgreSQL 선택 가능)
- ✅ 인기 이슈 및 외부 API 결과용 Redis 기반 글로벌 캐싱
- ✅ Dockerfile 및 Postgres, Redis, 앱 서비스가 포함된 확장된 Docker Compose
- ✅ local/test/prod 환경 프로파일

## 기술 스택

- **런타임**: Node.js 20+
- **언어**: TypeScript
- **프레임워크**: NestJS 10.x
- **데이터베이스**: SQLite (기본 dev/test) 또는 Docker Compose를 통한 PostgreSQL
- **ORM**: Prisma
- **검색**: Elasticsearch 8.x
- **메시지 큐**: Kafka (KafkaJS를 통해)
- **인증**: JWT (Passport)
- **캐싱**: 인메모리 캐시 (@nestjs/cache-manager)
- **검증**: class-validator, class-transformer
- **테스트**: Jest, Supertest
- **패키지 관리자**: npm

## 시작하기

### 필수 요구사항

- Node.js 20 이상
- npm
- Docker (Postgres/Redis/Kafka/Elasticsearch 서비스용)

### 설치

```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성 (기본 SQLite)
npm run prisma:generate

# 선택사항: 외부 인프라 시작 (Postgres + Redis). 필요에 따라 kafka/elasticsearch 추가
docker compose up -d db redis
```

### 애플리케이션 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 모드
npm run build
npm run start:prod
```

애플리케이션은 `http://localhost:3000`에서 사용 가능합니다

#### Docker Compose로 실행

```bash
# 핵심 스택 빌드 및 시작 (app + Postgres + Redis)
docker compose up --build app db redis

# 선택적으로 서비스를 추가하여 Kafka/Elasticsearch 포함
docker compose up --build app db redis kafka zookeeper kafka-ui elasticsearch
```

### API 엔드포인트

#### 헬스 & 인증
- `GET /api/health` - 헬스 체크 엔드포인트
- `POST /api/users` - 사용자 등록
- `POST /api/auth/login` - 사용자 로그인 (JWT 반환)

#### 이슈 트래커 (N2.1)
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects` - 프로젝트 목록
- `POST /api/projects/:id/issues` - 이슈 생성
- `GET /api/projects/:id/issues` - 이슈 목록
- `GET /api/issues/:id` - 이슈 상세 조회
- `PUT /api/issues/:id` - 이슈 업데이트
- `DELETE /api/issues/:id` - 이슈 삭제
- `POST /api/issues/:id/comments` - 댓글 추가
- `GET /api/issues/:id/comments` - 댓글 목록

#### Teams & RBAC (N2.2)
- `POST /api/teams` - 팀 생성
- `GET /api/teams` - 사용자의 팀 목록
- `GET /api/teams/:id` - 팀 상세 조회
- `POST /api/teams/:id/members` - 팀 멤버 추가
- `GET /api/teams/:id/members` - 팀 멤버 목록
- `PATCH /api/teams/:id/members/:memberId` - 멤버 역할 업데이트
- `DELETE /api/teams/:id/members/:memberId` - 멤버 제거
- `POST /api/teams/:teamId/items` - 워크스페이스 아이템 생성
- `GET /api/teams/:teamId/items` - 워크스페이스 아이템 목록

#### 통계 (N2.3)
- `GET /api/stats/daily` - 일일 이슈 통계 조회
- `GET /api/issues/popular` - 인기 이슈 조회 (캐시됨)
- `GET /api/external/posts/:id` - 외부 API 예시

#### 상품 & 검색 (N2.4)
- `POST /api/products` - 상품 생성
- `GET /api/products/:id` - 상품 조회
- `PUT /api/products/:id` - 상품 업데이트
- `DELETE /api/products/:id` - 상품 삭제
- `GET /api/search/products` - 상품 검색 (Elasticsearch)
- `POST /api/admin/reindex/products` - 모든 상품 재색인

#### 주문 & 알림 (N2.5)
- `POST /api/orders` - 주문 생성
- `GET /api/orders` - 사용자의 주문 목록
- `GET /api/orders/:id` - 주문 상세 조회
- `PATCH /api/orders/:id/pay` - 주문을 결제 완료로 표시
- `PATCH /api/orders/:id/cancel` - 주문 취소
- `GET /api/notifications` - 사용자의 알림 목록

### 테스트

e2e는 기본적으로 SQLite를 사용하므로 Docker 서비스는 선택사항입니다. 외부 서비스를 테스트하려는 경우에만 먼저 Postgres/Redis를 시작하세요 (예: `docker compose up -d db redis`).

```bash
# 유닛 테스트
npm test

# e2e 테스트
npm run test:e2e

# 테스트 커버리지
npm run test:cov
```

### 환경 변수

`.env.example`을 `.env.local`로 복사하고 설정:

```env
# 애플리케이션
PORT=3000
NODE_ENV=development

# 데이터베이스 (기본 SQLite)
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=1d

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_ENABLED=false  # Elasticsearch를 활성화하려면 true로 설정

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=web-phase1-5-node
KAFKA_GROUP_ID=notification-consumer-group
KAFKA_ENABLED=true  # Kafka를 비활성화하려면 false로 설정

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 프로젝트 구조

```
web-phase1-5-node/
  ├── prisma/
  │   ├── schema.prisma              # 데이터베이스 스키마
  │   └── migrations/                # 데이터베이스 마이그레이션
  ├── src/
  │   ├── common/
  │   │   ├── health/                # 헬스 체크 모듈
  │   │   ├── prisma/                # Prisma 서비스
  │   │   └── filters/               # 예외 필터
  │   ├── auth/                      # 인증 (N2.1)
  │   ├── user/                      # 사용자 관리 (N2.1)
  │   ├── project/                   # 프로젝트 모듈 (N2.1)
  │   ├── issue/                     # 이슈 트래커 (N2.1)
  │   ├── comment/                   # 댓글 (N2.1)
  │   ├── team/                      # Team & RBAC (N2.2)
  │   ├── stats/                     # 통계 & 배치 작업 (N2.3)
  │   ├── external/                  # 외부 API 통합 (N2.3)
  │   ├── elasticsearch/             # Elasticsearch 클라이언트 (N2.4)
  │   ├── product/                   # 상품 카탈로그 (N2.4)
  │   ├── search/                    # 검색 API (N2.4)
  │   ├── admin/                     # 관리자 엔드포인트 (N2.4)
  │   ├── kafka/                     # Kafka 프로듀서 서비스 (N2.5)
  │   ├── order/                     # 주문 관리 (N2.5)
  │   ├── notification/              # 알림 컨슈머 (N2.5)
  │   ├── app.module.ts              # 루트 모듈
  │   └── main.ts                    # 애플리케이션 진입점
  ├── test/
  │   ├── app.e2e-spec.ts            # 기본 e2e 테스트
  │   ├── issue.e2e-spec.ts          # 이슈 트래커 e2e 테스트
  │   ├── team.e2e-spec.ts           # Team & RBAC e2e 테스트
  │   ├── stats.e2e-spec.ts          # Stats e2e 테스트
  │   ├── product/                   # 상품 e2e 테스트
  │   ├── order.e2e-spec.ts          # 주문 e2e 테스트 (N2.5)
  │   └── utils/                     # 테스트 유틸리티
  ├── docker-compose.yml             # Kafka & Elasticsearch 설정
  └── .github/
      └── workflows/
          └── ci.yml                 # CI 파이프라인
```

## CI/CD

GitHub Actions 워크플로우 실행 시점:
- `main`, `develop`, `feature/**` 브랜치로 `push`
- `main`, `develop`에 대한 `pull_request`

파이프라인:
1. 코드 체크아웃
2. Node.js 20 설정
3. 의존성 설치
4. Prisma 클라이언트 생성
5. 유닛 테스트 실행
6. e2e 테스트 실행
7. 애플리케이션 빌드

## 라이선스

MIT
