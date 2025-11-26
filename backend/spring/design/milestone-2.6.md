# Docker, PostgreSQL, Redis 인프라 설계 일지 (Milestone 2.6)
> 프로덕션 배포를 위한 데이터베이스 전환, 분산 캐싱, 컨테이너 오케스트레이션

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 2.0~2.5까지 구축한 **기능들을 프로덕션 환경에서 운영 가능하도록** 인프라를 강화한다:
- H2 → PostgreSQL 전환 (프로덕션 DB)
- Simple → Redis 캐시 전환 (분산 캐싱)
- Docker 기반 전체 스택 컨테이너화
- 클라우드 배포 준비 (환경 분리)

### 1.2 기능 요구사항

#### 1.2.1 데이터베이스 전환 (H2 → PostgreSQL)

**문제:**
- H2는 개발/테스트에는 편리하지만 프로덕션 환경에 부적합:
  - 인메모리 제약 (재시작 시 데이터 손실)
  - 동시성 제한 (파일 DB 모드에서도)
  - 확장성 한계 (단일 JVM 프로세스 내)

**요구사항:**
1. **PostgreSQL 16 사용**
   - ACID 트랜잭션 보장
   - MVCC 동시성 제어
   - 확장 가능한 아키텍처

2. **Spring Boot Profile 분리**
   - **local**: H2 인메모리 (빠른 로컬 개발)
   - **test**: H2 인메모리 (빠른 테스트)
   - **prod**: PostgreSQL (안정성)

3. **JPA 설정 변경**
   - Hibernate dialect: PostgreSQLDialect
   - ddl-auto: validate (프로덕션)
   - show-sql: false (프로덕션)

#### 1.2.2 Redis 캐시 전환

**문제:**
- Milestone 2.3에서 구현한 Simple 캐시는 단일 인스턴스 전용:
  - 서버 재시작 시 캐시 손실
  - 다중 인스턴스 환경에서 캐시 불일치
  - 메모리 제약

**요구사항:**
1. **Redis 7 통합**
   - 분산 캐시 지원
   - 영속성 옵션 (AOF)
   - TTL 자동 관리

2. **Fallback 전략**
   - Redis 미설정 시 Simple 캐시 사용
   - 개발 환경 편의성 유지

3. **기존 코드 호환성**
   - Milestone 2.3 캐싱 코드 수정 없이 동작
   - `@Cacheable` 어노테이션 기반 유지

#### 1.2.3 Docker & 컨테이너화

**요구사항:**
1. **Dockerfile**
   - Multi-stage build (의존성 다운로드 + 빌드 + 실행)
   - Eclipse Temurin JRE 17 (경량 런타임)
   - Health check 포함

2. **docker-compose.yml**
   - 전체 스택 오케스트레이션:
     - `app`: Spring Boot 애플리케이션
     - `db`: PostgreSQL 16
     - `redis`: Redis 7
     - `elasticsearch`: Elasticsearch 8.11 (Milestone 2.4용)
     - `kafka`, `zookeeper`: Kafka 스트리밍 (Milestone 2.5용)
   - 네트워크 격리 (`app-network`)
   - 볼륨 영속성 (`postgres_data`, `redis_data`, `elasticsearch_data`)

3. **환경 변수 관리**
   - `.env.example`: 템플릿
   - Docker Compose 내부 환경 변수 설정
   - 민감 정보 분리 (외부 Secret 관리)

### 1.3 비기능 요구사항

#### 1.3.1 성능
- PostgreSQL 연결 풀링 (HikariCP 기본)
- Redis 캐시 히트율 80% 이상 (인기 이슈)
- Docker 이미지 크기 < 300MB

#### 1.3.2 안정성
- PostgreSQL 트랜잭션 ACID 보장
- Redis 장애 시 Simple 캐시로 자동 전환
- 컨테이너 재시작 정책 (`restart: unless-stopped`)

#### 1.3.3 확장성
- 수평 확장 가능 (Redis 공유 캐시)
- DB 연결 풀 설정 (동시 연결 제어)

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 PostgreSQL인가?

**H2의 한계:**
```text
동시성:
  - 인메모리 모드: JVM 내부만 접근 가능
  - 파일 모드: 동시 쓰기 제한

확장성:
  - 단일 인스턴스, 네트워크 분리 불가
  - 대용량 데이터 처리 시 성능 저하

타입 지원:
  - 일부 PostgreSQL 전용 타입 미지원
  - SQL 호환성 제한적
```

**PostgreSQL의 강점:**
```text
동시성:
  - MVCC (Multi-Version Concurrency Control)
  - 읽기-쓰기 블로킹 최소화

확장성:
  - 네트워크 DB (서버-DB 분리)
  - 파티셔닝, 리플리케이션 지원

타입 시스템:
  - JSONB, ARRAY, 사용자 정의 타입
  - 전문 검색 (tsvector, tsquery)
```

**마이그레이션 전략:**
- JPA/Hibernate 덕분에 엔티티 코드 변경 불필요
- 개발 환경은 H2 유지 (빠른 프로토타이핑)
- CI/CD는 PostgreSQL로 통일 가능

### 2.2 왜 Redis인가?

**Simple 캐시의 문제:**
```java
// ❌ 문제: 다중 인스턴스 환경
[서버 A] → Simple 캐시 A (인기 이슈: [1, 2, 3])
[서버 B] → Simple 캐시 B (캐시 없음, DB 재조회)
→ 로드 밸런서 뒤에서 캐시 불일치
```

**Redis의 장점:**
```text
분산 캐시:
  - 모든 인스턴스가 동일 캐시 공유
  - 수평 확장 시에도 일관성 유지

영속성:
  - AOF (Append Only File) 로그
  - 재시작 후 캐시 복구 가능

확장성:
  - 클러스터 모드 (수십 GB 캐시)
  - Pub/Sub, Stream 등 고급 기능
```

**Fallback 전략:**
```java
// CacheConfig.java
@Bean
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
public CacheManager redisCacheManager(RedisConnectionFactory factory) {
    // Redis 설정
}

@Bean
@ConditionalOnProperty(name = "spring.cache.type", havingValue = "simple", matchIfMissing = true)
public CacheManager simpleCacheManager() {
    // Simple 캐시 (fallback)
}
```
→ 개발 환경에서는 Redis 없이도 동작

### 2.3 Docker Compose의 역할

**왜 Docker Compose인가:**
- **로컬 개발 환경 일관성**: 팀원 모두 동일한 PostgreSQL, Redis 버전 사용
- **통합 테스트**: 전체 스택 실행 후 e2e 테스트
- **프로덕션 유사 환경**: 배포 전 로컬에서 검증

**대안 비교:**

| 방식 | 장점 | 단점 |
|------|------|------|
| 로컬 설치 | 설정 자유도 높음 | 환경 차이, 설치 복잡 |
| Docker Compose | 일관성, 재현성 | 초기 학습 곡선 |
| Kubernetes | 프로덕션 수준 오케스트레이션 | 과도한 복잡도 (개발 단계) |

→ Milestone 2.6에서는 Docker Compose 채택 (적절한 복잡도)

---

## 3. 데이터베이스 설정 설계

### 3.1 application.yml 프로파일 분리

**기본 설정 (application.yml):**
```yaml
spring:
  application:
    name: web-phase1-5

  # JPA 공통 설정
  jpa:
    open-in-view: false
    properties:
      hibernate:
        format_sql: true

jwt:
  secret: ${JWT_SECRET:default-secret}
  expiration: ${JWT_EXPIRATION:86400000}
```

**로컬 개발 (application-local.yml):**
```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb
    driver-class-name: org.h2.Driver
    username: sa
    password:

  h2:
    console:
      enabled: true

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

  cache:
    type: simple
```

**프로덕션 (application-prod.yml):**
```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: org.postgresql.Driver

  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect

  cache:
    type: redis

  data:
    redis:
      host: ${REDIS_HOST}
      port: ${REDIS_PORT}
```

### 3.2 build.gradle 의존성 추가

```gradle
dependencies {
    // 기존 의존성...

    // S2.6: PostgreSQL (production DB)
    runtimeOnly 'org.postgresql:postgresql'

    // S2.6: Redis cache
    implementation 'org.springframework.boot:spring-boot-starter-data-redis'

    // H2 (development/test DB)
    runtimeOnly 'com.h2database:h2'
}
```

**설계 포인트:**
- PostgreSQL과 H2 모두 runtimeOnly (컴파일 시 불필요)
- Redis는 implementation (CacheConfig에서 직접 사용)

---

## 4. Redis 캐시 통합

### 4.1 CacheConfig.java

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    @Primary
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
    public CacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration cacheConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(5))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(
                                new StringRedisSerializer()
                        )
                )
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(
                                new GenericJackson2JsonRedisSerializer()
                        )
                );

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(cacheConfig)
                .build();
    }

    @Bean
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "simple", matchIfMissing = true)
    public CacheManager simpleCacheManager() {
        logger.warn("Redis not configured. Using in-memory cache");
        return new ConcurrentMapCacheManager("popularIssues", "stats", "external");
    }
}
```

**설계 결정:**
- `@ConditionalOnProperty`: 프로파일에 따라 자동 선택
- `@Primary`: Redis가 우선, Simple은 fallback
- `GenericJackson2JsonRedisSerializer`: 객체 직렬화 (JSON)
- TTL 5분: 데이터 신선도와 DB 부하 균형

### 4.2 기존 코드 호환성

**Milestone 2.3에서 작성한 코드 변경 없음:**
```java
// IssueService.java (Milestone 2.3)
@Cacheable(value = "popularIssues")
public List<IssueResponse> findPopular() {
    // DB 조회 + 계산
    return calculatePopularIssues();
}
```

**추상화 레벨:**
- `@Cacheable` 어노테이션 기반
- CacheManager 구현체 투명
- 환경 변수만으로 캐시 전환

---

## 5. Docker & 컨테이너화

### 5.1 Dockerfile

```dockerfile
# Multi-stage build
FROM gradle:8.5-jdk17-alpine AS build

WORKDIR /app

# Copy Gradle configuration
COPY build.gradle settings.gradle ./
COPY gradle ./gradle

# Download dependencies (cached layer)
RUN gradle dependencies --no-daemon || true

# Copy source code
COPY src ./src

# Build application
RUN gradle clean build -x test --no-daemon

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy JAR from build stage
COPY --from=build /app/build/libs/*.jar app.jar

# Environment variables
ENV SPRING_PROFILES_ACTIVE=prod
ENV SERVER_PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Run application
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

**설계 결정:**
- **Multi-stage build**: 빌드 의존성과 런타임 분리 (이미지 크기 최소화)
- **Alpine 베이스**: 경량 이미지 (~150MB)
- **Health check**: Docker가 컨테이너 상태 자동 모니터링
- **ENTRYPOINT**: 컨테이너 시작 시 자동 실행

### 5.2 docker-compose.yml

```yaml
version: '3.8'

services:
  # Spring Boot application
  app:
    build: .
    container_name: spring-training-app
    depends_on:
      - db
      - redis
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: training
      DB_USER: app
      DB_PASSWORD: app
      REDIS_HOST: redis
      REDIS_PORT: 6379
      # ... 기타 환경 변수
    ports:
      - "8080:8080"
    networks:
      - app-network

  # PostgreSQL 16
  db:
    image: postgres:16-alpine
    container_name: postgres
    environment:
      POSTGRES_DB: training
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

  # Redis 7
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - app-network

  # Elasticsearch, Kafka 등 기존 서비스...

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
```

**설계 포인트:**

1. **의존성 관리**
   - `depends_on`: 시작 순서 제어 (db, redis 먼저 시작)
   - 애플리케이션은 DB 준비 후 시작

2. **네트워크 격리**
   - `app-network`: 모든 컨테이너 연결
   - 서비스 간 호스트명으로 통신 (예: `db:5432`)

3. **볼륨 영속성**
   - `postgres_data`: PostgreSQL 데이터 보존
   - `redis_data`: Redis AOF 파일 보존

4. **포트 매핑**
   - 로컬 개발: `localhost:8080`, `localhost:5432`, `localhost:6379`
   - 컨테이너 내부: 서비스명으로 접근

### 5.3 실행 명령어

```bash
# 전체 스택 시작 (백그라운드)
docker-compose up -d

# 로그 확인
docker-compose logs -f app

# 전체 스택 중지
docker-compose down

# 볼륨까지 삭제 (DB 데이터 초기화)
docker-compose down -v
```

---

## 6. 환경 변수 관리

### 6.1 .env.example (템플릿)

```env
# Application
SPRING_PROFILES_ACTIVE=local
SERVER_PORT=8080

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=training
DB_USER=app
DB_PASSWORD=app

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch
ELASTICSEARCH_URIS=http://localhost:9200

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# JWT
JWT_SECRET=mySecretKeyForJWTTokenGenerationAndValidationThatIsLongEnough
JWT_EXPIRATION=86400000
```

### 6.2 환경별 설정 전략

**로컬 개발:**
- Profile: `local`
- DB: H2 인메모리
- Cache: Simple (in-memory)

**Docker 환경:**
- Profile: `prod`
- DB: PostgreSQL (docker-compose)
- Cache: Redis (docker-compose)

**클라우드 프로덕션:**
- Profile: `prod`
- DB: Managed PostgreSQL (AWS RDS, Azure Database 등)
- Cache: Managed Redis (AWS ElastiCache, Azure Cache 등)
- 환경 변수: Secret Manager로 관리

---

## 7. 검증 체크리스트

### 7.1 PostgreSQL 전환

- [ ] `build.gradle`에 PostgreSQL 의존성 추가
- [ ] `application-prod.yml` PostgreSQL 설정 완료
- [ ] Docker Compose로 PostgreSQL 실행 (`docker-compose up -d db`)
- [ ] 애플리케이션이 PostgreSQL에 연결되어 정상 동작
- [ ] 트랜잭션 테스트 (Milestone 2.1) 통과

### 7.2 Redis 캐시

- [ ] `build.gradle`에 Redis 의존성 추가
- [ ] `CacheConfig.java` 작성 (Redis + fallback)
- [ ] Docker Compose로 Redis 실행 (`docker-compose up -d redis`)
- [ ] `@Cacheable` 어노테이션 동작 확인
- [ ] Redis CLI로 캐시 키 확인 (`docker exec -it redis redis-cli KEYS '*'`)
- [ ] Redis 미설정 시 Simple 캐시로 전환 확인

### 7.3 Docker

- [ ] `Dockerfile` 작성 (Multi-stage build)
- [ ] `docker-compose.yml` 전체 스택 작성
- [ ] `.dockerignore` 작성
- [ ] `docker-compose build` 성공
- [ ] `docker-compose up -d` 전체 스택 시작
- [ ] `docker-compose logs app` 에러 없이 실행
- [ ] `curl http://localhost:8080/api/health` 200 응답

### 7.4 환경 분리

- [ ] 로컬 개발: `local` 프로파일 (H2 + Simple 캐시)
- [ ] Docker: `prod` 프로파일 (PostgreSQL + Redis)
- [ ] 테스트: `test` 프로파일 (H2 인메모리)

---

## 8. 완료 기준 (Definition of Done)

✅ `build.gradle`에 PostgreSQL, Redis 의존성 추가 완료
✅ `application-prod.yml` 프로파일 작성 완료
✅ `CacheConfig.java` Redis + fallback 설정 완료
✅ `Dockerfile` Multi-stage build 작성 완료
✅ `docker-compose.yml` 전체 스택 오케스트레이션 완료
✅ `.env.example` 환경 변수 템플릿 작성 완료
✅ 로컬/Docker 환경 모두 정상 동작
✅ 기존 테스트 모두 통과 (H2 환경)
✅ README.md에 Docker 실행 가이드 추가

---

## 9. 다음 마일스톤과의 연결

### Milestone 2.6에서 확립된 것

- PostgreSQL 프로덕션 DB
- Redis 분산 캐시
- Docker Compose 전체 스택
- 환경별 설정 분리 전략 (local/test/prod)

### Milestone 2.7+ (향후 확장)

- **Kubernetes 배포**
  - Helm Chart
  - ConfigMap/Secret 관리
  - HPA (Horizontal Pod Autoscaler)

- **모니터링 & 로깅**
  - Prometheus + Grafana
  - ELK Stack (Elasticsearch, Logstash, Kibana)
  - Spring Boot Actuator 메트릭

- **CI/CD 고도화**
  - Docker 이미지 자동 빌드
  - 레지스트리 Push (Docker Hub, ECR)
  - 자동 배포 (ArgoCD, Flux)

---

## 10. 알려진 제약 & 향후 개선점

### 10.1 현재 제약

1. **데이터 마이그레이션**
   - H2 → PostgreSQL 데이터 이관 스크립트 없음
   - 개선: Flyway 또는 Liquibase 도입

2. **Redis 고가용성**
   - 단일 인스턴스 (SPOF)
   - 개선: Redis Sentinel, Redis Cluster

3. **Docker 이미지 크기**
   - ~200MB (최적화 여지)
   - 개선: Jlink로 Custom JRE 생성

4. **환경 변수 검증**
   - 필수 변수 누락 시 런타임 에러
   - 개선: `@ConfigurationProperties` + `@Validated`

### 10.2 확장 포인트

- **데이터베이스 복제**: Primary-Replica 구성 (읽기 전용 복제본)
- **Redis Pub/Sub**: 실시간 알림 (WebSocket과 연계)
- **Nginx 리버스 프록시**: 로드 밸런싱
- **SSL/TLS**: HTTPS 적용

---

## 11. 참고 자료

- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)
- [Redis 공식 문서](https://redis.io/documentation)
- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [Spring Boot Data Redis](https://docs.spring.io/spring-boot/docs/current/reference/html/data.html#data.nosql.redis)
- [Spring Boot Profiles](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.profiles)
- [Hibernate PostgreSQL Dialect](https://docs.jboss.org/hibernate/orm/6.0/userguide/html_single/Hibernate_User_Guide.html#database-dialect)
