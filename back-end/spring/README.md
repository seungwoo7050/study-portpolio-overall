# Web Phase 1.5 – Spring 패턴 훈련 (2.0–2.5)

## 개요

**목적**

* mini-spring(1.x)에서 HTTP/라우팅/DI/커넥션풀/비동기 기본기를 익혔다고 가정한다.
* 이제 실제 현업에서 많이 쓰는 **Spring Boot 기반 웹 백엔드 패턴**을
  **작은 도메인**에 반복 적용하는 훈련을 한다.
* 이 2.x 단계 이후에 **Sagaline(이커머스 프로덕트)**로 넘어간다.

**핵심 포인트**

* **단일 Spring Boot 프로젝트**에서 2.0 ~ 2.5를 순차적으로 확장한다.
* **2.0에서 CI를 세팅**해두고,
  이후 마일스톤마다 **해당 마일스톤 수준의 테스트를 추가**해서
  GitHub push 시마다 자동으로 검증되게 한다.

---

## 공통 규칙

### 기술 스택(권장)

* 언어: Java 17
* 프레임워크: Spring Boot 3.x
* 빌드: Gradle 또는 Maven (둘 중 아무거나, 예시는 Gradle 기준으로 적는다)
* DB:

  * 개발/테스트: H2 (in-memory)
  * 실제 서비스 상상: PostgreSQL (프로덕션용 설정만 베이스로 잡아두면 됨)
* 테스트:

  * JUnit 5
  * Spring Boot Test
  * 필요 시 MockMvc/WebTestClient

### 프로젝트 구조(예시)

하나의 레포, 하나의 Spring Boot 앱 안에 도메인 패키지로 나눈다.

```text
web-phase1-5/
  build.gradle
  settings.gradle
  src/
    main/
      java/
        com/example/training/
          Application.java        // 부트스트랩
          common/                 // 공통 (config, error, health 등)
          issue/                  // 2.1
          team/                   // 2.2
          stats/                  // 2.3
          search/                 // 2.4
          order/                  // 2.5
      resources/
        application.yml
        application-local.yml
        application-test.yml
    test/
      java/
        com/example/training/
          ...
```

패키지 이름/폴더 구조는 크게 강제하지 않는다.
단, **Application.java가 최상위 패키지 루트**가 되어
하위 패키지를 전부 컴포넌트 스캔하도록 한다.

### Git / CI 기본 규칙

* GitHub에 레포 하나 만든다.
* 브랜치 전략(예시):

  * `main`: 항상 빌드/테스트 통과 상태
  * `feature/2.1-issue`, `feature/2.2-team` 같은 식으로 작업 브랜치
* CI:

  * `.github/workflows/ci.yml` 하나
  * 트리거:

    * `push` to `main`, `develop`, `feature/**`
    * `pull_request` to `main`, `develop`
  * 최소 단계:

    1. checkout
    2. JDK 17 세팅
    3. `./gradlew clean test` (또는 `mvn test`)
    4. (옵션) JaCoCo 리포트 생성

2.0에서는 **테스트 한 개짜리라도 통과하도록 세팅만 끝내는 것**이 목표고,
2.1 이후부터는 각 마일스톤에서 만든 기능에 맞는 테스트를 추가한다.

---

## Milestone 2.0 – Spring Boot 부트스트랩 & CI 베이스라인

**목표**

* 2.1~2.5를 올릴 **단일 Spring Boot 프로젝트 골격**을 만든다.
* GitHub Actions CI를 붙여서, push할 때마다 `test`가 돌도록 만든다.

### 요구 사항

1. **Spring Boot 앱 생성**

   * `Application.java`에 `@SpringBootApplication` + `main` 메서드.
   * `./gradlew bootRun` 또는 IDE에서 실행 가능해야 한다.

2. **기본 설정 파일**

   * `application.yml`:

     * `spring.application.name` 정도
     * H2 연결 (dev/test 기준)
     * JPA 설정 (`ddl-auto`는 `update` / `create-drop` / `validate` 중 선택)
   * `application-test.yml`:

     * 테스트 시 사용할 설정(포트 랜덤 등)만 간단히.

3. **헬스 체크 엔드포인트**

   * 예시:

     * `GET /api/health`
     * 응답: 200 + `{ "status": "OK", "timestamp": "..." }`
   * 구현 방식은 자유.

4. **기본 테스트**

   * 최소 한 개:

     * `@SpringBootTest`로 컨텍스트 로딩 테스트
     * 또는 `MockMvc`로 `/api/health` 200 확인

5. **CI 구성**

   * `.github/workflows/ci.yml`:

     * `gradlew` 실행 권한 부여
     * `./gradlew clean test` 수행
   * main/feature 브랜치에 push 시 자동 실행.

### 완료 기준

* 로컬에서:

  * `./gradlew clean test` 성공
  * `./gradlew bootRun` 후 `/api/health` 호출 200
* GitHub:

  * push → CI 파이프라인 동작 → 초록불
* 이 시점에서는 **도메인 로직은 거의 없어도 된다.**

  * CI와 기본 구조만 확보하는 단계.

---

## Milestone 2.1 – 레이어드 CRUD & 트랜잭션 패턴

**목표**

* 전형적인 **Controller / Service / Repository + DTO + 트랜잭션** 패턴을 연습한다.
* 작은 Issue Tracker 도메인을 만든다.

### 도메인 (예시)

필드는 필요하면 추가/수정 가능. 핵심은 패턴.

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

  * Controller: DTO 변환, HTTP 관련 처리만.
  * Service: 비즈니스 로직 + `@Transactional`.
  * Repository: `JpaRepository` 등으로 DB 접근.
* **DTO vs Entity**

  * 엔티티를 API 응답에 직접 노출하지 않는다.
* **Validation**

  * Bean Validation (`@NotBlank`, `@Email`, `@Size` 등) 활용.
* **에러 응답**

  * 공통 에러 응답 포맷을 하나 정해서 사용.
    예)

    ```json
    { "code": "ISSUE_NOT_FOUND", "message": "Issue not found" }
    ```

### 테스트 & CI

* 이 마일스톤에서 **도입해야 하는 테스트 최소 기준**:

  * 서비스/리포지토리 단위 테스트 몇 개 (이슈 생성, 상태 변경 등).
  * 통합 테스트 1~2개:

    * `@SpringBootTest` + `@AutoConfigureMockMvc`로

      * 이슈 생성 → 조회 플로우 검증.
* CI는 그대로 `./gradlew test`만 돌리면 된다.

  * 2.0에서 깔아둔 워크플로우 수정 없이,
    **테스트 케이스만 추가**하는 것이 목표.

---

## Milestone 2.2 – 팀 & 역할 기반 권한(RBAC)

**목표**

* **팀/역할 도메인**을 설계하고,
  ROLE에 따라 허용/차단되는 행동을 코드로 표현한다.
* 401 / 403 / 404를 구분해서 처리한다.

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

  * `POST /api/teams` – 현재 로그인 유저가 OWNER로 생성
  * `GET /api/teams` – 내가 속한 팀 목록
  * `GET /api/teams/{id}` – 팀 상세 + 멤버 정보 일부
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

### 권한 패턴

* 인증:

  * JWT 기반 인증을 유지(2.1과 연속).
* 권한 체크:

  * 서비스 계층에서:

    * `assertTeamMember(userId, teamId)`
    * `assertCanManageMembers(userId, teamId)`
      같은 함수로 도메인 규칙으로 표현.
  * 또는 Spring Security `@PreAuthorize` 사용해도 됨.
* 상태 코드:

  * 미로그인: 401
  * 로그인 했지만 권한 없음: 403
  * 존재하지 않거나 볼 권한이 없어서 숨기고 싶을 때: 404

### 테스트 & CI

* 테스트 최소 기준:

  * “같은 API를 다른 사용자로 호출했을 때 응답이 달라지는” 테스트 1~2개.

    * 예: 팀 OWNER → 200 / MEMBER → 403.
* CI:

  * 여전히 `./gradlew test` 한 줄로 돌아가야 한다.
  * 2.1에서 만들어둔 테스트 + 2.2 테스트가 함께 통과해야 한다.

---

## Milestone 2.3 – 배치, 통계 테이블, 캐시, 외부 API

**목표**

* 배치 작업, 리포팅용 테이블, 캐시, 외부 HTTP API 호출을 한번에 경험한다.
* 운영/성능 패턴을 작은 범위에서 연습한다.

### 도메인 (예시)

2.1의 Issue/Comment를 활용한다고 가정:

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

   * 매일 새벽 3시(개발 중엔 더 짧게 잡아도 됨) `@Scheduled`로 실행.
   * “어제” 날짜 기준:

     * 생성된 이슈 수
     * RESOLVED/CLOSED로 변경된 이슈 수
     * 작성된 댓글 수
   * `DailyIssueStats`에 upsert:

     * 동일 날짜 중복 생성 방지.

2. **통계 조회 API**

   * `GET /api/stats/daily?from=2025-01-01&to=2025-01-31`
   * 날짜 범위 안에 있는 통계를 배열로 반환.

3. **인기 이슈 캐싱**

   * 정의 예:

     * 최근 7일간 `조회수 + 댓글수` 기준 상위 10개.
   * `GET /api/issues/popular`
   * 동작:

     * 캐시 미스 → DB 조회 → 계산 → 캐시에 저장(TTL 5분) → 반환.
     * 캐시 히트 → 캐시에서 바로 응답.
   * 이슈 수정/삭제 시 캐시 무효화 전략은 단순해도 된다 (TTL에만 의존해도 됨).

4. **외부 API 연동**

   * 공공 API나 dummy JSON API 하나 선정.
   * `GET /api/external/example`
   * 요구:

     * 타임아웃 설정.
     * 재시도(예: 최대 3회).
     * 최종 실패 시 fallback 응답 + 로그.

### 패턴 포인트

* 배치 로직은 스케줄러 메서드 내부에 직접 쓰지 말고, 서비스로 분리.
* Spring Cache, Redis를 쓰면 좋지만, 처음에는 in-memory 캐시도 허용.
* 외부 API는 `WebClient` 또는 `RestTemplate` + 타임아웃/재시도.

### 테스트 & CI

* 배치:

  * 스케줄러를 직접 돌리기보다는,
    “특정 날짜에 대해 집계 서비스 메서드가 올바른 결과를 만든다”는 서비스 테스트를 작성.
* 캐시:

  * 같은 입력으로 두 번 호출했을 때,
    실제 DB 호출이 한 번만 일어나는지 정도는 간단히 검증해볼 수 있다(카운터/log 기반).
* 외부 API:

  * 실제 API 대신 Mock server or `MockWebServer` 등으로 테스트 가능.
  * 최소한 타임아웃/재시도 흐름을 검증하는 테스트 1개.

CI는 그대로 `./gradlew test`.
테스트 개수만 늘어난다.

---

## Milestone 2.4 – Elasticsearch 검색

**목표**

* RDB와 분리된 **검색 인덱스**를 설계하고, ES 기반 검색 API를 구현한다.
* 검색 일관성, 동기화 전략을 고민해본다.

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

   * 인덱스 이름 예: `products`
   * 필드 매핑:

     * `id`: numeric
     * `name`, `description`: `text`
     * `category`, `brand`: `keyword`
     * `price`: numeric
     * `created_at`: `date`
   * 한국어 토크나이저(Nori)는 선택 사항.

3. **검색 API**

   * `GET /api/search/products`
   * 파라미터 예:

     * `q`: 키워드 (name/description 대상)
     * `category`, `brand`
     * `minPrice`, `maxPrice`
     * `page`, `size`
   * 구현:

     * ES 클라이언트로 검색 쿼리 구성 → 결과를 DTO로 변환.

4. **동기화 전략**

   * 단순하게:

     * 상품 생성/수정/삭제 시 DB 작업 후 ES 인덱스도 같이 갱신.
   * 선택:

     * “전체 재색인”용 관리자 엔드포인트 (`POST /api/admin/reindex/products`) 하나 만들어도 좋다.

### 테스트 & CI

* 통합 테스트:

  * ES를 포함한 테스트 환경을 구성할 수 있으면 best.
    (docker-compose, testcontainers 등 활용)
  * 최소 수준:

    * 상품 생성 → 검색 API에서 나오는지 확인.
    * 상품 수정 → 검색 결과에 반영되는지 확인.
* 현실적으로 테스트 세팅이 복잡하면:

  * “ES 클라이언트 호출 부분을 Mocking한 서비스 테스트”로 타협 가능.
  * 대신 실제 통합 테스트는 수동으로라도 해보는 게 좋다.

CI:

* 가능하면 통합 테스트도 CI에서 돌리되,
* ES 의존을 제거해야 한다면 해당 테스트는 `@Disabled` + 로컬에서만 실행해도 된다
  (훈련 목표에 맞게 판단).

---

## Milestone 2.5 – Kafka 비동기 이벤트 처리

**목표**

* Kafka를 이용해 **도메인 이벤트를 발행**하고,
  별도의 Consumer에서 **비동기적으로 처리**하는 패턴을 연습한다.

### 도메인 (예시)

간단한 주문 + 알림:

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

     * DB 트랜잭션:

       * Order + OrderItem insert
       * totalAmount 계산
     * 트랜잭션 성공 이후:

       * `ORDER_CREATED` 이벤트를 Kafka에 `send`

2. **Notification Consumer**

   * `@KafkaListener(topics = "order-events", ...)`
   * `ORDER_CREATED` 수신 시:

     * Notification 레코드 insert
     * (혹은 단순히 로그로 “메일 전송” 시뮬레이션)

3. **비동기 특성**

   * 주문 API 응답은 **이벤트 처리와 분리**:

     * 주문 생성 성공 → 즉시 201 반환
     * 알림은 약간 늦게 처리되어도 괜찮다.
   * Consumer 중단/재시작 시:

     * 이벤트는 Kafka에 쌓였다가
     * 재시작 후 backlog 처리가 되어야 한다.

4. **선택: 추가 이벤트**

   * `ORDER_PAID`, `ORDER_CANCELLED` 등을 추가해도 된다.
   * 이 경우 통계/재고/로그 등을 처리하는 Consumer를 하나 더 만들 수 있다.

### 테스트 & CI

* 통합 테스트(이상적 시나리오):

  * testcontainers 또는 docker-compose로 Kafka 띄우고,
  * 주문 생성 → 이벤트 발행 → Consumer까지 동작해 Notification이 쌓이는지 확인.
* 현실 타협:

  * KafkaTemplate/Listener 레벨에서 단위테스트/슬라이스 테스트만 하고,
  * 실제 Kafka 환경 테스트는 로컬 docker-compose로 수동 수행.

CI:

* Kafka 포함 통합 테스트는 CI 환경 구축이 번거로울 수 있다.

  * testcontainers를 쓰면 CI에서도 자동으로 띄울 수 있음.
  * 아니면 Kafka 의존 테스트는 프로파일로 분리해서,
    CI는 unit 중심, 통합은 수동 실행으로 가져가도 된다.

---

## 추가로 신경 쓸 점

질문 답변 겸해서 정리한다.

1. **초기에 CI를 준비하는 이유**

   * 2.0에서 CI를 세팅해두면,
   * 이후 마일스톤에서는 “설정 건드리지 않고, 테스트만 추가”하면 된다.
   * 이게 현실 개발 흐름과 가장 비슷하다.
   * 구현 안 된 기능에 대한 테스트는 당연히 작성하지 않는다.
     → **“마일스톤 구현 → 그걸 커버하는 테스트 추가”** 순서가 맞다.

2. **마일스톤별 태그/브랜치**

   * 원하면:

     * `v2.1`, `v2.2` 태그를 찍어두면 회귀/비교용으로 좋다.
   * 필수는 아니다.
     다만 학습 관점에서 “2.0 시점, 2.1 시점 코드”를 되돌려볼 수 있게 남겨두면 이득.

3. **환경 분리**

   * 최소:

     * `application.yml` – 공통 기본
     * `application-local.yml` – 로컬(dev)
     * `application-test.yml` – test
   * 이 정도만 있어도, 후에 Sagaline으로 넘어갈 때 환경 분리가 덜 고통스럽다.

4. **로깅/관측(필수까지는 아님)**

   * Actuator 정도는 켜두면 좋다.
   * 2.x 단계에서는 필수는 아니지만,
     2.3에서 배치/캐시 할 때 메트릭, 로깅을 약간 맛 봐두면
     Sagaline Observability에서 이해가 빨라진다.

5. **오버엔지니어링 방지**

   * 2.x는 “패턴 훈련” 단계다.
   * 완벽한 설계/리팩터링을 목표로 잡지 말고,

     * “문제 → 어떤 패턴으로 풀지 결정 → 빠르게 적용해보기”에 집중하는 게 맞다.