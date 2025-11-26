# Spring Boot 백엔드 학습 로드맵

## 0. 제일 처음

### Step 0-1. 문서 1 (1.md)

* **언제:** 완전 맨 처음 1회.
* **어디까지:**

  * `## 1. 이 문서의 역할`
  * `## 2. 최종 목표: 어떤 서버를 만들 것인가`
  * `## 3. 전체 아키텍처 한 번에 보기`
  * `## 4. Stage별 로드맵 개요`
  * `## 5~7 Stage 1/2/3 개요`까지 그냥 쭉 읽기
* 목적: 전체 지도만 머리에 넣는 용도. 암기할 필요 없음.

---

## 1. Stage 1 준비 (Spring Boot 기초)

### Step 1-1. 문서 2 1차 읽기 (Java + Spring Boot 개념)

**문서 2 (2.md)**

* **언제:** 첫 코딩 들어가기 전에.

* **어디까지 읽냐:**
  1차는 여기까지만:

  * `## 0. 전제 / 목표`
  * `## 1. Java + Spring Boot 핵심 개념`

* 이 단계 목표:

  * Java 기본 문법 이해 (클래스, 인터페이스, 레코드)
  * Spring Boot 핵심 개념 파악 (DI, Controller, Service, Repository)

**아직 안 읽는 부분 (2차로 미룸):**

* `## 2. S2.0: Spring Boot Bootstrap & CI Baseline`
* `## 3. S2.1: Layered CRUD & Transaction Pattern`
* `## 4. S2.0-S2.1 체크리스트`

이 부분은 **실습할 때 참고**할 거라, 그 타이밍에 읽는 게 더 잘 박힌다.

---

## 2. Stage 1 본격 실습 (S2.0-S2.1)

### Step 2-1. 문서 2 2차 읽기 (S2.0 Bootstrap)

**문서 2 (2.md)**

* **언제:** S2.0 구현 직전.
* **이번에 추가로 읽을 부분:**

  * `## 2. S2.0: Spring Boot Bootstrap & CI Baseline`

### Step 2-2. S2.0 구현

* **프로젝트 생성**:

  * Spring Initializr 또는 `gradle init`
  * 환경 설정 (`application.yml`, H2)

* **헬스 체크 엔드포인트**:

  * `GET /api/health`

* **CI 파이프라인**:

  * `.github/workflows/ci.yml` 작성
  * GitHub push → 자동 테스트 확인

* **빌드 & 실행**:

  ```bash
  ./gradlew bootRun
  curl http://localhost:8080/api/health
  ```

---

### Step 2-3. 문서 2 3차 읽기 (S2.1 CRUD)

**문서 2 (2.md)**

* **언제:** S2.1 구현 직전.
* **이번에 추가로 읽을 부분:**

  * `## 3. S2.1: Layered CRUD & Transaction Pattern`
  * `## 4. S2.0-S2.1 체크리스트`

### Step 2-4. S2.1 구현

* **JPA Entity**:

  * Issue Tracker 도메인 (User, Project, Issue, Comment)

* **DTO 정의**:

  * Bean Validation (`@NotBlank`, `@NotNull`)
  * `CreateUserDto`, `CreateIssueDto` 등

* **JWT 인증**:

  * Spring Security 설정
  * JwtUtil, JwtAuthenticationFilter 구현

* **Service Layer**:

  * `IssueService` - CRUD 작업
  * `@Transactional` 트랜잭션

* **빌드 & 테스트**:

  ```bash
  ./gradlew test
  ./gradlew build
  ```

---

## 3. Stage 2 전반부 (S2.2-S2.3)

### Step 3-1. 문서 3 읽기 (RBAC, Batch, Cache)

**문서 3 (3.md)**

* **언제:** Stage 1 (S2.0-S2.1) 끝나고.
* **전체 읽기:**

  * `## 1. S2.2: Team & RBAC`
  * `## 2. S2.3: Batch Jobs, Stats, Cache, External API`
  * `## 3. S2.2-S2.3 체크리스트`

* 목적: RBAC, 배치 작업, 캐싱, 외부 API 패턴 이해

---

### Step 3-2. S2.2-S2.3 구현

* **S2.2: Team & RBAC**

  * JPA Entity: `Team`, `TeamMember`, `WorkspaceItem`
  * 커스텀 어노테이션: `@PreAuthorize`
  * `TeamSecurityService` 구현

* **S2.3: Batch, Stats, Cache, External API**

  * `@Scheduled` - 배치 작업
  * `DailyIssueStats` 테이블 설계
  * `@Cacheable` - 캐싱
  * `RestTemplate` - 외부 API 호출 + 재시도

* **빌드 & 실행**:

  ```bash
  ./gradlew bootRun
  # 배치 작업 확인
  # 캐시 동작 확인
  ```

---

## 4. Stage 2 후반부 (S2.4-S2.5, 선택)

### Step 4-1. 문서 4 읽기 (Elasticsearch, Kafka)

**문서 4 (4.md)**

* **언제:** S2.3까지 끝나고, 외부 시스템 통합을 경험하고 싶을 때.
* **전체 읽기:**

  * `## 1. S2.4: Elasticsearch Search`
  * `## 2. S2.5: Kafka Async Events`
  * `## 3. S2.6: Docker, PostgreSQL, Redis 인프라`
  * `## 4. S2.4-S2.6 체크리스트`

* 목적: Elasticsearch 검색, Kafka 이벤트 스트리밍, 프로덕션 인프라 패턴 이해

---

### Step 4-2. S2.4-S2.5 구현

* **S2.4: Elasticsearch**

  * Docker Compose로 Elasticsearch 실행
  * Elasticsearch Java Client 통합
  * Product 도메인 (DB + ES 동기화)
  * 전문 검색 API (`GET /api/search/products`)

* **S2.5: Kafka**

  * Docker Compose로 Kafka 실행
  * Spring Kafka 설정
  * Order 도메인 (Producer)
  * Notification Consumer
  * 이벤트 발행 → 비동기 처리 확인

* **빌드 & 실행**:

  ```bash
  docker-compose up -d elasticsearch kafka
  ./gradlew bootRun
  # 검색 API 테스트
  # 주문 생성 → 알림 확인
  ```

---

## 5. Stage 3 - 프로덕션 인프라 (S2.6)

### Step 5-1. 문서 4 S2.6 섹션 읽기

**문서 4 (4.md)**

* **언제:** S2.0-S2.5까지 완료하고, 프로덕션 배포를 준비할 때.
* **읽을 부분:**

  * `## 3. S2.6: Docker, PostgreSQL, Redis 인프라`

* 목적: 프로덕션 환경을 위한 인프라 구축 방법 이해

### Step 5-2. S2.6 구현

* **PostgreSQL 전환**

  * `application-prod.yml`에 PostgreSQL 설정
  * Hibernate dialect 변경
  * Docker Compose PostgreSQL 16 서비스 추가

* **Redis 캐시**

  * `CacheConfig` Redis 통합
  * Fallback 전략 (Redis 미설정 시 Simple 캐시)
  * 기존 캐싱 코드 호환성 유지

* **Docker 컨테이너화**

  * Dockerfile 작성 (Multi-stage build)
  * docker-compose.yml 전체 스택 오케스트레이션
  * 환경 변수 관리 (개발/Docker/프로덕션)

* **빌드 & 실행**:

  ```bash
  # 전체 스택 시작
  docker-compose up -d

  # 헬스 체크
  curl http://localhost:8080/api/health

  # PostgreSQL 확인
  docker-compose exec db psql -U app -d training -c "\dt"

  # Redis 캐시 확인
  docker-compose exec redis redis-cli KEYS '*'
  ```

---

## 최종 타임라인 요약

1. **시작 전**

   * 1.md 전체 1회

2. **Stage 1 준비**

   * 2.md: `0~1` (Java + Spring Boot 개념)

3. **Stage 1 본격 실습 (S2.0-S2.1)**

   * 2.md: `2` (S2.0 Bootstrap)
   * S2.0 구현
   * 2.md: `3~4` (S2.1 CRUD)
   * S2.1 구현

4. **Stage 2 전반부 (S2.2-S2.3)**

   * **3.md: 고급 패턴 I (RBAC, Batch, Cache)**
   * S2.2, S2.3 구현

5. **Stage 2 후반부 (S2.4-S2.5, 선택)**

   * **4.md: 고급 패턴 II (Elasticsearch, Kafka)**
   * S2.4, S2.5 구현

6. **Stage 3 (S2.6, 프로덕션 인프라)**

   * **4.md: S2.6 섹션 (PostgreSQL, Redis, Docker)**
   * S2.6 구현

---

## 학습 팁

1. **CI를 먼저 세팅하는 이유**

   * S2.0에서 CI를 만들어두면,
   * 이후 마일스톤은 "설정 손대지 않고 테스트만 추가"하면 된다.
   * 실전 흐름과 비슷하게 가져가는 게 목적.

2. **테스트 중요성**

   * 각 마일스톤마다 최소 1~2개의 통합 테스트 추가
   * 전체 플로우가 정상 동작하는지 자동 검증

3. **오버엔지니어링 방지**

   * S2.x는 "패턴 훈련" 단계다.
   * 완벽한 설계보다는:

     * 문제 정의 → 어떤 패턴으로 풀지 결정 → 빠르게 적용
   * 이 리듬을 몸에 익히는 걸 우선으로 두면 된다.

4. **환경 분리**

   * 최소:

     * `application.yml` – 공통 기본
     * `application-local.yml` – 로컬(dev)
     * `application-test.yml` – test
     * `application-prod.yml` – production
   * Profile 기반으로 환경별 설정 관리

5. **JPA 사용 팁**

   * Entity 변경 시 항상:

     ```bash
     ./gradlew clean build
     ```
   * 테스트 환경에서는 H2 인메모리 DB 사용 (빠른 테스트)
   * 프로덕션에서는 ddl-auto: validate (안전)

---

## 참고 자료

* [Spring Boot 공식 문서](https://spring.io/projects/spring-boot)
* [Spring Data JPA 공식 문서](https://spring.io/projects/spring-data-jpa)
* [Spring Security 공식 문서](https://spring.io/projects/spring-security)
* [Elasticsearch Java Client](https://www.elastic.co/guide/en/elasticsearch/client/java-api-client/current/index.html)
* [Spring Kafka Documentation](https://docs.spring.io/spring-kafka/reference/)
* [PostgreSQL Official Docs](https://www.postgresql.org/docs/)
* [Redis Official Docs](https://redis.io/documentation)
* [Docker Compose Official Docs](https://docs.docker.com/compose/)
