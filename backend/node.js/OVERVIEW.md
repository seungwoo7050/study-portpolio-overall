# Web Phase 1.5 – Node.js 패턴 훈련 (N2.0–N2.5)

## 개요

**목적**

* HTTP/라우팅/미들웨어/DI/DB/비동기 기본기는 이미 이해했다고 가정.
* 실제 서비스에서 자주 쓰는 **Node.js + NestJS 기반 웹 백엔드 패턴**을
  **작은 도메인**에 여러 번 반복 적용해서 손에 익히는 단계.
* 이 N2.x 이후에 이커머스 같은 실제 프로덕트로 넘어가기 쉽게 만드는 게 목표.

**핵심 포인트**

* **단일 NestJS 프로젝트** 하나만 쓴다. N2.0 ~ N2.5를 같은 코드베이스에서 확장.
* **N2.0에서 CI를 세팅**해두고,
  이후 마일스톤마다 **해당 마일스톤 수준의 테스트를 추가**해서
  GitHub push 시마다 자동 검증되도록 유지.

---

## 공통 규칙

### 기술 스택(권장)

* 런타임: Node.js 20+
* 언어: TypeScript
* 프레임워크: NestJS 10.x (Express 어댑터 기준)
* 패키지 매니저: npm 또는 pnpm
* DB:

  * 개발/테스트: SQLite (파일/메모리) – Prisma로 접근
  * 실제 서비스 상상: PostgreSQL
* ORM / DB 클라이언트:

  * Prisma (schema-first, 타입 강함)
* 테스트:

  * Jest
  * e2e: supertest 또는 pactum
* 기타:

  * 환경변수: `@nestjs/config` + `.env` 계열
  * 로깅: Nest 기본 Logger 또는 pino 통합 (선택)

### 프로젝트 구조(예시)

하나의 레포, 하나의 NestJS 앱 안에 도메인 모듈로 나눈다.

```text
web-phase1-5-node/
  package.json
  tsconfig.json
  prisma/
    schema.prisma
  src/
    main.ts            // 부트스트랩
    app.module.ts      // 루트 모듈
    common/            // 공통 (config, error filter, interceptor 등)
    issue/             // N2.1
    team/              // N2.2
    stats/             // N2.3
    search/            // N2.4
    order/             // N2.5
  test/
    app.e2e-spec.ts    // 기본 e2e
    issue/
    team/
    ...
```

* `app.module.ts`가 루트 모듈.
* 각 도메인은 `XxxModule`, `XxxController`, `XxxService`, `XxxRepository` (또는 Prisma 직접 사용) 구조 권장.

### Git / CI 기본 규칙

* GitHub에 레포 하나.
* 브랜치 전략(예시):

  * `main`: 항상 빌드/테스트 통과 상태
  * `feature/n2.1-issue`, `feature/n2.2-team` 식의 작업 브랜치
* CI:

  * `.github/workflows/ci.yml` 하나
  * 트리거:

    * `push` to `main`, `develop`, `feature/**`
    * `pull_request` to `main`, `develop`
  * 최소 단계:

    1. checkout
    2. Node 20 세팅
    3. `npm ci` (또는 `pnpm install --frozen-lockfile`)
    4. `npm test` (또는 `npm run test` + `npm run test:e2e`)
    5. (옵션) 커버리지 리포트

N2.0에서는 **테스트 한 개짜리라도 통과하도록 CI 세팅만 끝내는 것**이 목표고,
N2.1부터는 각 마일스톤 기능에 맞는 테스트를 추가.

---

## Milestone N2.0 – NestJS 부트스트랩 & CI 베이스라인

**목표**

* N2.1~N2.5를 올릴 **단일 NestJS 프로젝트 골격**을 만든다.
* GitHub Actions CI를 붙여서, push할 때마다 `npm test`가 돌게 만든다.

### 요구 사항

1. **NestJS 앱 생성**

   * Nest CLI 사용: `npx @nestjs/cli new web-phase1-5-node`
   * `main.ts`:

     * `NestFactory.create(AppModule)`
     * 글로벌 ValidationPipe, Logger 설정은 이후 단계에서 추가해도 됨.

2. **환경 설정**

   * `.env`, `.env.test` 등 기본 파일 준비.
   * `@nestjs/config`로 환경 변수 주입.
   * `prisma/schema.prisma`:

     * dev/test: SQLite
     * provider는 나중에 Postgres로 바꿀 수 있게 설계.
   * 최소 설정:

     * app name
     * DB 연결 문자열
     * 포트

3. **헬스 체크 엔드포인트**

   * 예시:

     * `GET /api/health`
     * 응답: 200 + `{ "status": "OK", "timestamp": "..." }`
   * 간단한 `HealthController` 하나로 구현.

4. **기본 테스트**

   * e2e 테스트 하나:

     * `app.e2e-spec.ts`에서 Nest 앱 띄우고
     * `/api/health` 200 확인 (supertest)
   * 또는 최소한:

     * `AppModule` context load 테스트(Jest + TestingModule).

5. **CI 구성**

   * `.github/workflows/ci.yml`:

     * `actions/checkout`
     * `actions/setup-node` (node-version: 20)
     * `npm ci`
     * `npm test` 또는 `npm run test && npm run test:e2e`

### 완료 기준

* 로컬:

  * `npm test` 성공
  * `npm run start:dev` 후 `/api/health` 200
* GitHub:

  * push → CI 파이프라인 동작 → 성공
* 이 시점에서는 도메인 로직 거의 없어도 된다.

  * CI + 프로젝트 구조 확보가 핵심.

---

## Milestone N2.1 – 레이어드 CRUD & 트랜잭션 패턴 (Issue Tracker)

**목표**

* **Controller / Service / Repository + DTO + 트랜잭션** 패턴을 NestJS/Prisma 기준으로 연습.
* 작은 Issue Tracker 도메인 구현.

### 도메인 (예시)

Prisma schema 기준 개념만 정의 (필드는 자유롭게 조정 가능):

* `User`

  * `id`
  * `email` (unique)
  * `passwordHash`
  * `nickname`
  * `createdAt`
* `Project`

  * `id`
  * `name`
  * `description`
  * `createdAt`
* `Issue`

  * `id`
  * `projectId`
  * `reporterId`
  * `assigneeId` (nullable)
  * `title`
  * `description`
  * `status` (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
  * `createdAt`
  * `updatedAt`
* `Comment`

  * `id`
  * `issueId`
  * `authorId`
  * `content`
  * `createdAt`
  * `updatedAt`

### 기능(예시)

* 회원/인증(간단 버전)

  * `POST /api/users` – 회원가입
  * `POST /api/auth/login` – JWT 발급
* 프로젝트

  * `POST /api/projects`
  * `GET /api/projects`
* 이슈

  * `POST /api/projects/{projectId}/issues`
  * `GET /api/projects/{projectId}/issues?status=&page=&size=`
  * `GET /api/issues/{id}`
  * `PUT /api/issues/{id}`
  * `DELETE /api/issues/{id}`
* 댓글

  * `POST /api/issues/{id}/comments`
  * `GET /api/issues/{id}/comments`

### 패턴 요구 (권장)

* **레이어 분리**

  * Controller:

    * Nest `@Controller`, `@Get`, `@Post` 등.
    * 요청 DTO → 서비스 호출 → 응답 DTO 변환.
  * Service:

    * 비즈니스 로직.
    * Prisma 클라이언트 의존.
    * 복합 연산은 `prisma.$transaction()` 사용.
  * Repository:

    * 선택사항.

      * 단순 CRUD면 Service에서 Prisma 직접 써도 됨.
      * 복잡해지면 Repository 클래스로 추출.

* **DTO vs Entity**

  * 요청/응답 DTO:

    * `class-validator` + `class-transformer` + `ValidationPipe`.
  * Prisma 모델 그대로 응답에 노출하지 말고 DTO로 감싸기.

* **Validation**

  * `@IsEmail`, `@IsString`, `@IsEnum`, `@Length` 등 사용.
  * `main.ts`에서 글로벌 `ValidationPipe` 적용.

* **에러 응답**

  * 공통 예외 필터(`HttpExceptionFilter`) 정의해서 포맷 통일:

    ```json
    { "code": "ISSUE_NOT_FOUND", "message": "Issue not found" }
    ```
  * 도메인 에러는 커스텀 예외 클래스로 구분해도 됨.

### 테스트 & CI

* 테스트 최소 기준:

  * 서비스/리포지토리 단위 테스트 몇 개:

    * 이슈 생성, 상태 변경, 삭제 등.
  * e2e 테스트 1~2개:

    * `POST /api/projects/{id}/issues` → `GET /api/issues/{id}` 플로우.
* CI:

  * 여전히 `npm test` 한 줄로 돌아가야 한다.
  * 테스트만 추가하고, N2.0에서 만든 워크플로우는 그대로 둔다.

---

## Milestone N2.2 – 팀 & 역할 기반 권한(RBAC)

**목표**

* **팀/역할 도메인** 설계.
* ROLE에 따라 허용/차단되는 행동을 Nest Guard/Service에서 표현.
* 401 / 403 / 404를 구분해서 응답.

### 도메인 (예시)

* `Team`

  * `id`
  * `name`
  * `createdAt`
* `TeamMember`

  * `id`
  * `teamId`
  * `userId`
  * `role` (OWNER, MANAGER, MEMBER)
  * `joinedAt`
* `WorkspaceItem`

  * `id`
  * `teamId`
  * `title`
  * `content`
  * `createdBy`
  * `createdAt`
  * `updatedAt`

### 기능(예시)

* 팀 관리

  * `POST /api/teams` – 현재 로그인 유저를 OWNER로 생성
  * `GET /api/teams` – 내가 속한 팀 목록
  * `GET /api/teams/{id}` – 팀 상세 + 일부 멤버 정보
* 팀 멤버 관리

  * `POST /api/teams/{id}/members` – OWNER/MANAGER만
  * `GET /api/teams/{id}/members`
  * `PATCH /api/teams/{id}/members/{memberId}` – 역할 변경
  * `DELETE /api/teams/{id}/members/{memberId}`

    * OWNER 삭제 규칙 등 비즈니스 룰 정의
* 워크스페이스 리소스

  * `POST /api/teams/{teamId}/items`
  * `GET /api/teams/{teamId}/items`
  * `GET /api/items/{id}`
  * `PUT /api/items/{id}`
  * `DELETE /api/items/{id}`
  * → 해당 팀 멤버만 접근 가능

### 권한 패턴 (NestJS 관점)

* **인증**

  * N2.1의 JWT 유지.
  * `AuthGuard('jwt')` 또는 커스텀 Guard로 인증 처리.
* **인가 (RBAC)**

  * Guard + 커스텀 데코레이터 패턴:

    * `@Roles('OWNER', 'MANAGER')`
    * `RolesGuard`에서 팀/멤버 role 조회 후 허용/거부.
  * 또는 서비스 계층에서:

    * `assertTeamMember(userId, teamId)`
    * `assertCanManageMembers(userId, teamId)`
* **상태 코드**

  * 미로그인: Guard에서 401
  * 로그인 했지만 권한 없음: Guard에서 403
  * 존재하지 않거나 감추고 싶은 리소스:

    * 404를 의도적으로 리턴하도록 처리.

### 테스트 & CI

* 테스트 최소 기준:

  * “같은 API를 다른 사용자로 호출했을 때 응답이 달라지는” e2e 테스트 1~2개:

    * 팀 OWNER → 200 / MEMBER → 403 같은 것.
* CI:

  * 계속 `npm test`.
  * N2.1 테스트 + N2.2 테스트가 함께 통과해야 한다.

---

## Milestone N2.3 – 배치, 통계 테이블, 캐시, 외부 API

**목표**

* 배치 작업, 리포팅용 테이블, 캐시, 외부 HTTP API 호출을 한 번에 경험.
* 운영/성능 관련 패턴을 Node 환경에서 연습.

### 도메인 (예시)

N2.1 Issue/Comment 재활용:

* `DailyIssueStats`

  * `date`
  * `createdCount`
  * `resolvedCount`
  * `commentCount`
  * `createdAt`
* 필요하다면:

  * `DailyUserActivity` 등 추가.

### 기능(예시)

1. **배치 – 일별 통계 집계**

   * `@nestjs/schedule` 모듈 사용.
   * 매일 새벽 3시 (개발 중엔 더 짧게):

     * “어제” 기준:

       * 생성된 이슈 수
       * RESOLVED/CLOSED로 바뀐 이슈 수
       * 작성된 댓글 수
     * `DailyIssueStats`에 upsert:

       * 동일 날짜 중복 방지.

2. **통계 조회 API**

   * `GET /api/stats/daily?from=2025-01-01&to=2025-01-31`
   * 날짜 범위 내 통계를 배열로 반환.

3. **인기 이슈 캐싱**

   * 정의 예:

     * 최근 7일간 `조회수 + 댓글 수` 기준 상위 10개.
   * `GET /api/issues/popular`
   * 동작:

     * 캐시 미스 → DB 조회/계산 → 캐시 저장(TTL 5분) → 반환
     * 캐시 히트 → 캐시 사용
   * 캐시 백엔드:

     * 처음엔 in-memory (`@nestjs/cache-manager` 기본 메모리)로 시작.
     * 가능하면 Redis로 교체.

4. **외부 API 연동**

   * 공공 API나 dummy JSON API 하나 선택.
   * `GET /api/external/example`
   * 요구:

     * HTTP 클라이언트: `axios` 또는 `@nestjs/axios`.
     * 타임아웃 설정.
     * 재시도(간단히 최대 3회).
     * 최종 실패 시 fallback 응답 + 로그.

### 패턴 포인트

* 배치 스케줄러 함수 안에 로직 다 넣지 말고,
  **별도 서비스**로 로직 분리 후 스케줄러에서 서비스만 호출.
* 캐시:

  * Nest CacheModule 사용 + 캐시 키/TTL 명확히 정의.
* 외부 API:

  * 전용 서비스 모듈로 분리.
  * 타임아웃, 재시도, 에러 래핑 규칙을 통일.

### 테스트 & CI

* 배치:

  * 실제 스케줄러를 돌리기보다는,
    “특정 날짜에 대해 집계 서비스가 올바른 결과를 만든다” 테스트.
* 캐시:

  * 같은 인자로 두 번 호출했을 때,
    내부에서 실제 DB 조회가 한 번만 일어나는지 (메서드 호출 카운트) 정도 확인.
* 외부 API:

  * 실제 API 대신 `nock`이나 `msw`, axios mock 등으로 타임아웃/재시도 흐름 검증.

CI는 그대로 `npm test`.
테스트 수만 늘어난다.

---

## Milestone N2.4 – Elasticsearch 검색

**목표**

* RDB와 분리된 **검색 인덱스** 설계.
* ES 기반 검색 API 구현.
* 검색 일관성 / 동기화 전략 고민.

### 도메인 (예시)

심플한 상품 카탈로그:

* `Product`

  * `id`
  * `name`
  * `description`
  * `category`
  * `brand`
  * `price`
  * `status` (ACTIVE/INACTIVE)
  * `createdAt`
  * `updatedAt`

### 기능(예시)

1. **상품 CRUD (DB 기준)**

   * `POST /api/products`
   * `PUT /api/products/{id}`
   * `DELETE /api/products/{id}`
   * `GET /api/products/{id}`

2. **ES 인덱스**

   * 인덱스 예: `products`
   * 클라이언트: 공식 `@elastic/elasticsearch`
   * 필드 매핑:

     * `id`: numeric
     * `name`, `description`: `text`
     * `category`, `brand`: `keyword`
     * `price`: numeric
     * `created_at`: `date`
   * 한국어 토크나이저(Nori)는 옵션.

3. **검색 API**

   * `GET /api/search/products`
   * 파라미터:

     * `q`: 키워드 (name/description 대상)
     * `category`, `brand`
     * `minPrice`, `maxPrice`
     * `page`, `size`
   * 구현:

     * ES로 쿼리 구성 → 결과를 DTO로 변환 후 반환.

4. **동기화 전략**

   * 단순 전략:

     * 상품 생성/수정/삭제 시:

       * DB 작업 성공 후 ES 인덱스 갱신.
   * 선택:

     * “전체 재색인” 관리자 엔드포인트:

       * `POST /api/admin/reindex/products`

### 테스트 & CI

* 통합 테스트(이상적):

  * docker-compose나 testcontainers로 ES 띄워서:

    * 상품 생성 → 검색 API에서 조회되는지 확인.
    * 수정 → 검색 결과 반영 확인.
* 현실 타협:

  * ES 클라이언트 부분은 mock 처리한 서비스 테스트만 자동화.
  * 실제 통합 테스트는 로컬 환경에서 수동으로라도 한 번 수행.

CI:

* 가능하면 ES 포함 통합 테스트를 CI에서 돌리되,
* 환경 구축이 번거로우면 ES 의존 테스트는 프로파일/환경변수로 끄고,
  로컬에서만 실행하는 선택도 가능.

---

## Milestone N2.5 – Kafka 비동기 이벤트 처리

**목표**

* Kafka를 이용해 **도메인 이벤트 발행/소비** 패턴을 Node/Nest 환경에서 연습.

### 도메인 (예시)

단순 주문 + 알림:

* `Order`

  * `id`
  * `userId`
  * `totalAmount`
  * `status` (PENDING, PAID, CANCELLED)
  * `createdAt`
* `OrderItem`

  * `id`
  * `orderId`
  * `productId`
  * `quantity`
  * `price`
* `Notification`

  * `id`
  * `userId`
  * `type` (ORDER_CREATED, ORDER_PAID, …)
  * `message`
  * `createdAt`

### Kafka 이벤트

* 토픽:

  * `order-events`
* 이벤트 스키마(예시):

```json
{
  "eventId": "uuid",
  "eventType": "ORDER_CREATED",
  "timestamp": "2025-01-30T10:15:30.123Z",
  "orderId": 123,
  "userId": 45,
  "totalAmount": 50000
}
```

### 기능(예시)

1. **주문 생성 API (Producer)**

   * `POST /api/orders`
   * 내부 플로우:

     * Prisma 트랜잭션:

       * Order + OrderItem insert
       * `totalAmount` 계산
     * 트랜잭션 성공 후:

       * `ORDER_CREATED` 이벤트를 Kafka에 발행.
   * Kafka 클라이언트:

     * `kafkajs` 또는 Nest `@nestjs/microservices` Kafka transport.

2. **Notification Consumer**

   * Nest microservice 또는 별도 프로세스:

     * `@MessagePattern`(microservice) 또는 `kafkajs` consumer loop.
   * `ORDER_CREATED` 수신 시:

     * Notification 레코드 insert
     * 또는 “메일 전송” 시뮬레이션 로그.

3. **비동기 특성**

   * 주문 API 응답은 이벤트 처리와 분리:

     * 주문 생성 성공 → 201 바로 반환.
     * 알림은 나중에 처리돼도 상관없음.
   * Consumer 중단/재시작 시:

     * Kafka에 쌓여 있다가 재시작 후 처리.

4. **선택: 추가 이벤트**

   * `ORDER_PAID`, `ORDER_CANCELLED` 등 추가.
   * 재고/통계/로그 등 다른 Consumer를 하나 더 만들어도 됨.

### 테스트 & CI

* 통합 테스트(이상적):

  * testcontainers 또는 docker-compose로 Kafka 띄우고,
  * 주문 생성 → 이벤트 발행 → Consumer까지 돌아가 Notification DB에 쌓이는지 확인.
* 현실 타협:

  * Producer:

    * Kafka 클라이언트 mock 해서 “이벤트 형식/발행 시점”만 검증.
  * Consumer:

    * 메시지 핸들러 함수를 직접 호출하는 단위 테스트.

CI:

* Kafka 포함 통합 테스트를 CI에서 돌릴 수 있으면 좋지만,
* 환경 구축이 귀찮으면 Kafka 의존 테스트는 선택적으로 돌리고,
  핵심 로직은 unit 수준에서 커버.

---

## 추가로 신경 쓸 점

1. **초기에 CI를 준비하는 이유**

   * N2.0에서 CI를 만들어두면,
   * 이후 마일스톤은 “설정 손대지 않고 테스트만 추가”하면 된다.
   * 현실 흐름과 비슷하게 가져가는 게 목적.

2. **마일스톤별 태그/브랜치**

   * 원하면:

     * `vN2.1`, `vN2.2` 태그 찍어두면 회귀/비교 용이.
   * 필수는 아님.

3. **환경 분리**

   * 최소:

     * `.env` – 공통 기본
     * `.env.local` – 로컬(dev)
     * `.env.test` – test
   * Nest ConfigModule에서 profile별로 나누거나,
     환경 변수로 분기.

4. **로깅/관측**

   * Nest 기본 로그 + 요청 로깅 미들웨어.
   * N2.3에서 배치/캐시 다룰 때,
     간단한 메트릭이나 trace ID 정도 맛만 봐두면 좋다.

5. **오버엔지니어링 방지**

   * N2.x는 “패턴 훈련” 단계다.
   * 완벽한 설계보다는:

     * 문제 정의 → 어떤 패턴(레이어 구조, Guard, 배치, 이벤트 등)으로 풀지 결정 → 빠르게 적용
   * 이 리듬을 몸에 익히는 걸 우선으로 두면 된다.