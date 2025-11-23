# Sagaline E-commerce 플랫폼 - 아키텍처 기반 설계 일지 (Stage 1)
> 한국 시장을 위한 프로덕션급 전자상거래 플랫폼의 모놀리식 아키텍처 기반 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

한국 시장 특화 전자상거래 플랫폼 구축을 위한 견고한 모놀리식 기반 시스템:
- 완전한 E2E 전자상거래 기능 (회원가입 → 상품 조회 → 장바구니 → 주문 → 결제)
- 한국 시장 통합 (Kakao OAuth, Toss Payments, PIPA 준수)
- 프로덕션 수준의 품질 (보안, 성능, 가용성)
- 향후 마이크로서비스로의 진화 준비

### 1.2 기능 요구사항

#### 1.2.1 핵심 도메인 (6개)
1. **사용자 관리 (User Management)**
   - 회원가입 및 로그인
   - JWT 기반 인증
   - Kakao OAuth 2.0 소셜 로그인
   - 역할 기반 접근 제어 (RBAC)
   - 프로필 관리

2. **상품 카탈로그 (Product Catalog)**
   - 상품 CRUD
   - 카테고리 계층 구조
   - 한글 전문 검색 (Elasticsearch + Nori)
   - 패싯 검색 (카테고리, 가격대, 브랜드)
   - 자동완성

3. **장바구니 (Shopping Cart)**
   - 세션 기반 장바구니
   - 상품 추가/삭제/수량 변경
   - 장바구니 조회 및 초기화

4. **주문 관리 (Order Management)**
   - 주문 생성 및 추적
   - 주문 상태 관리 (대기, 확인, 배송, 완료, 취소)
   - 주문 내역 조회
   - 주문 이벤트 발행 (Kafka)

5. **결제 처리 (Payment Processing)**
   - Toss Payments 통합
   - 결제 상태 관리
   - 결제 실패 처리
   - Circuit Breaker 패턴

6. **재고 관리 (Inventory Management)**
   - 재고 수량 추적
   - 예약 수량 관리
   - 재고 부족 감지

#### 1.2.2 횡단 관심사 (Cross-cutting Concerns)
- **보안**: JWT, OAuth2, PII 암호화, Rate Limiting
- **관찰성**: Prometheus 메트릭, 분산 추적, 구조화된 로깅
- **캐싱**: Redis 기반 다층 캐싱
- **비동기 처리**: Kafka 이벤트 기반 아키텍처
- **복원력**: Circuit Breaker, Retry, Timeout

### 1.3 비기능 요구사항

#### 1.3.1 성능
- API 응답 시간 p99 ≤ 100ms (단순 쿼리)
- API 응답 시간 p99 ≤ 200ms (복잡한 쿼리)
- 동시 사용자 100명 이상 처리
- 검색 응답 시간 p99 ≤ 200ms

#### 1.3.2 가용성 & 신뢰성
- 시스템 가용성 ≥ 99.9% (30일 기준)
- 오류율 ≤ 1% (4xx 제외)
- 결제 서비스 장애 시 graceful degradation
- 데이터베이스 연결 풀 관리

#### 1.3.3 보안
- OWASP Top 10 취약점 방어
- PII 데이터 암호화 (AES-256)
- SQL Injection 방지 (JPA)
- XSS, CSRF 방어
- TLS 1.3 전송 암호화
- Critical/High 취약점 0건

#### 1.3.4 코드 품질
- 테스트 커버리지 ≥ 80%
- 유닛 테스트 + 통합 테스트
- OpenAPI 3.0 문서화
- CI/CD 자동화

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 모놀리식 먼저인가?

**선택 근거:**
- **빠른 개발 속도**: 단일 코드베이스, 통합 배포
- **간단한 디버깅**: 로컬에서 전체 스택 실행 가능
- **트랜잭션 관리**: ACID 트랜잭션 자연스럽게 보장
- **성능**: 네트워크 호출 없는 직접 함수 호출
- **도메인 이해**: 경계를 먼저 파악한 후 분해

**트레이드오프:**
- 초기 배포 속도는 빠르지만, 나중에 스케일링 복잡도 증가
- 하지만 도메인 패키지 분리로 마이크로서비스 전환 준비

**마이크로서비스 전환 준비:**
```
src/main/java/com/sagaline/
├── user/              # → user-service
├── product/           # → product-service
├── cart/              # → order-service (cart + order)
├── order/             # → order-service
├── payment/           # → payment-service
└── inventory/         # → inventory-service
```

### 2.2 기술 스택 선택

#### 2.2.1 Spring Boot 3.2.0 (Java 17)

**선택 이유:**
- **생산성**: Auto-configuration, 방대한 생태계
- **한국 시장**: 국내 백엔드 개발 표준 스택
- **엔터프라이즈 지원**: 대규모 시스템 검증됨
- **관찰성**: Actuator + Micrometer 통합
- **보안**: Spring Security 6.x 최신 기능

**Java 17 선택:**
- Record, Pattern Matching, Text Blocks
- Long-term Support (LTS)
- 성능 개선 (GC, JIT)

#### 2.2.2 PostgreSQL 15+

**선택 이유:**
- **ACID 보장**: 금융 거래 수준의 트랜잭션
- **JSON 지원**: JSONB 타입으로 유연성
- **성능**: 복잡한 쿼리 최적화
- **확장성**: 파티셔닝, 리플리케이션
- **오픈소스**: 라이선스 비용 없음

**트레이드오프:**
- 수평 확장은 샤딩/리플리케이션 필요 (Stage 9에서 추가)
- 하지만 수직 확장으로 충분한 성능

#### 2.2.3 Redis 7+

**선택 이유:**
- **캐싱**: 초고속 메모리 기반 캐시
- **Rate Limiting**: 분산 환경에서도 정확한 제한
- **세션 저장소**: JWT 리프레시 토큰 관리
- **Pub/Sub**: 실시간 이벤트 (Stage 8)

**캐싱 전략:**
- Cache-aside 패턴
- TTL 기반 자동 만료
- 이벤트 기반 캐시 무효화

#### 2.2.4 Elasticsearch 8.x + Nori

**선택 이유:**
- **한글 검색**: Nori 형태소 분석기로 한국어 처리
- **전문 검색**: Full-text search with relevance scoring
- **패싯 검색**: 실시간 필터링 (카테고리, 가격)
- **자동완성**: N-gram 기반 검색어 제안
- **확장성**: 수평 확장 (샤딩)

**Nori Tokenizer:**
```
"노트북 추천" → ["노트북", "추천"]
"삼성 갤럭시" → ["삼성", "갤럭시"]
```

#### 2.2.5 Apache Kafka 3.x

**선택 이유:**
- **이벤트 기반 아키텍처**: 도메인 간 느슨한 결합
- **비동기 처리**: 주문 생성 → 이메일 발송 분리
- **확장성**: 파티셔닝으로 처리량 증가
- **내구성**: 로그 기반 메시지 저장
- **마이크로서비스 준비**: 서비스 간 통신 패턴

**이벤트 토픽:**
```
user-events       : 회원가입, 프로필 변경
order-events      : 주문 생성, 상태 변경
payment-events    : 결제 완료, 실패
inventory-events  : 재고 예약, 해제
notification-events: 알림 발송 큐
```

---

## 3. 시스템 아키텍처

### 3.1 전체 아키텍처 (Monolithic with Domain Separation)

```
┌────────────────────────────────────────────────────────────────┐
│                         Client (Web/Mobile)                     │
└────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Spring Boot Application                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    API Layer (Controllers)               │   │
│  │  /api/auth  /api/products  /api/cart  /api/orders       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          Security Layer (JWT + OAuth2 Filter)            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Domain Services Layer                     │  │
│  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │  │
│  │ │  User  │ │Product │ │  Cart  │ │ Order  │ │Payment │ │  │
│  │ │Service │ │Service │ │Service │ │Service │ │Client  │ │  │
│  │ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Infrastructure Layer                         │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │  │
│  │  │  JPA   │  │ Redis  │  │  ES    │  │ Kafka  │         │  │
│  │  │  Repos │  │ Cache  │  │ Search │  │ Events │         │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
              │           │           │           │
              ▼           ▼           ▼           ▼
    ┌──────────────┐ ┌────────┐ ┌──────────┐ ┌────────┐
    │ PostgreSQL   │ │ Redis  │ │Elastic   │ │ Kafka  │
    │              │ │        │ │ search   │ │        │
    └──────────────┘ └────────┘ └──────────┘ └────────┘
```

### 3.2 레이어 아키텍처 (Clean Architecture 기반)

#### 3.2.1 API Layer (Presentation)
- **책임**: HTTP 요청/응답 처리, DTO 변환
- **구성 요소**: Controllers, RequestDTO, ResponseDTO
- **패턴**: REST API, OpenAPI 문서화
- **보안**: JWT 검증, Rate Limiting

**예시: ProductController**
```java
@RestController
@RequestMapping("/api/products")
public class ProductController {
    @Autowired
    private ProductService productService;

    @GetMapping("/{id}")
    public ResponseEntity<ProductDTO> getProduct(@PathVariable Long id) {
        Product product = productService.getProductById(id);
        return ResponseEntity.ok(toDTO(product));
    }
}
```

#### 3.2.2 Domain Layer (Business Logic)
- **책임**: 비즈니스 로직, 도메인 규칙, 트랜잭션
- **구성 요소**: Services, Domain Entities, Events
- **패턴**: Domain-Driven Design (DDD)
- **특징**: 인프라 독립적, 순수 비즈니스 로직

**예시: OrderService**
```java
@Service
@Transactional
public class OrderService {
    public Order createOrder(Long userId) {
        // 1. 장바구니 조회
        Cart cart = cartRepository.findByUserId(userId);

        // 2. 주문 생성
        Order order = Order.fromCart(cart, userId);

        // 3. 저장
        orderRepository.save(order);

        // 4. 이벤트 발행
        eventPublisher.publish(new OrderCreatedEvent(order));

        // 5. 장바구니 초기화
        cartService.clearCart(userId);

        return order;
    }
}
```

#### 3.2.3 Infrastructure Layer
- **책임**: 외부 시스템 연동, 데이터 영속화
- **구성 요소**: Repositories, Clients, Adapters
- **기술**: JPA, Redis, Elasticsearch, Kafka

**예시: ProductRepository**
```java
@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByCategoryId(Long categoryId);

    @Query("SELECT p FROM Product p WHERE p.isActive = true")
    List<Product> findAllActive();
}
```

### 3.3 도메인 간 상호작용

#### 3.3.1 동기 통신 (Direct Method Call)
```
OrderService.createOrder():
  ├─ CartRepository.findByUserId()      // 장바구니 조회
  ├─ ProductRepository.findById()        // 상품 정보 확인
  ├─ OrderRepository.save()              // 주문 저장
  └─ CartService.clearCart()             // 장바구니 초기화
```

#### 3.3.2 비동기 통신 (Kafka Events)
```
OrderService.createOrder():
  └─ EventPublisher.publish(OrderCreatedEvent)
       ↓ Kafka [order-events]
       ├─ NotificationService → 주문 확인 이메일
       ├─ AnalyticsService → 매출 집계
       └─ InventoryService → 재고 예약 (향후)
```

---

## 4. 데이터베이스 설계

### 4.1 스키마 구조 (6개 도메인, 16개 테이블)

#### 4.1.1 User Domain (3 tables)
```sql
users
├─ id (BIGSERIAL PRIMARY KEY)
├─ email (VARCHAR UNIQUE NOT NULL)
├─ password_hash (VARCHAR NOT NULL)
├─ name (VARCHAR NOT NULL)
├─ phone_number (VARCHAR, encrypted)  -- PII 암호화
├─ created_at, updated_at, last_login_at
├─ is_active, is_email_verified

user_profiles
├─ id, user_id (FK → users)
├─ address, city, postal_code, country
└─ created_at, updated_at

user_roles
├─ id, user_id (FK → users)
├─ role (VARCHAR: USER, ADMIN)
└─ created_at
```

#### 4.1.2 Product Domain (2 tables)
```sql
products
├─ id, name, description
├─ price, sku, brand
├─ image_url, is_active
└─ created_at, updated_at

categories
├─ id, name, description
├─ parent_id (self-referencing FK)
└─ created_at, updated_at

product_categories (many-to-many)
├─ product_id (FK → products)
└─ category_id (FK → categories)
```

#### 4.1.3 Cart Domain (2 tables)
```sql
carts
├─ id, user_id (FK → users)
├─ total_amount, total_items
└─ created_at, updated_at

cart_items
├─ id, cart_id (FK → carts)
├─ product_id (FK → products)
├─ quantity, price
└─ created_at, updated_at
```

#### 4.1.4 Order Domain (2 tables)
```sql
orders
├─ id, user_id (FK → users)
├─ total_amount, status (ENUM)
├─ shipping_address
└─ created_at, updated_at

order_items
├─ id, order_id (FK → orders)
├─ product_id (FK → products)
├─ quantity, price
└─ created_at
```

#### 4.1.5 Payment Domain (1 table)
```sql
payments
├─ id, order_id (FK → orders)
├─ amount, currency (KRW)
├─ status (PENDING, SUCCESS, FAILED, REFUNDED)
├─ payment_method, provider (TOSS)
├─ provider_transaction_id
└─ created_at, updated_at
```

#### 4.1.6 Inventory Domain (1 table)
```sql
inventory
├─ id, product_id (FK → products)
├─ quantity, reserved_quantity
├─ low_stock_threshold
└─ created_at, updated_at
```

#### 4.1.7 Auth Domain (1 table)
```sql
refresh_tokens
├─ id, user_id (FK → users)
├─ token (VARCHAR UNIQUE)
├─ expires_at
└─ created_at
```

### 4.2 인덱스 전략

**성능 최적화 인덱스:**
```sql
-- 사용자 조회
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- 상품 조회
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_category ON product_categories(category_id);

-- 주문 조회
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- 장바구니 조회
CREATE INDEX idx_carts_user_id ON carts(user_id);
```

### 4.3 마이그레이션 전략 (Flyway)

**버전 관리:**
```
V001__create_user_schema.sql
V002__create_product_schema.sql
V003__create_cart_schema.sql
V004__create_order_schema.sql
V005__create_payment_schema.sql
V006__create_inventory_schema.sql
V007__create_refresh_tokens.sql
```

**장점:**
- 버전 기록 (flyway_schema_history 테이블)
- 롤백 가능 (rollback 스크립트)
- 환경별 적용 (dev, staging, prod)
- CI/CD 통합

---

## 5. API 설계

### 5.1 RESTful API 원칙

**리소스 중심 설계:**
```
GET    /api/users/{id}          # 사용자 조회
POST   /api/users/register      # 회원가입
POST   /api/auth/login          # 로그인
POST   /api/auth/refresh        # 토큰 갱신

GET    /api/products            # 상품 목록
GET    /api/products/{id}       # 상품 상세
POST   /api/products            # 상품 생성 (ADMIN)
PUT    /api/products/{id}       # 상품 수정 (ADMIN)

GET    /api/cart                # 장바구니 조회
POST   /api/cart/items          # 상품 추가
DELETE /api/cart/items/{id}     # 상품 제거

GET    /api/orders              # 주문 목록
POST   /api/orders              # 주문 생성
GET    /api/orders/{id}         # 주문 상세
```

### 5.2 인증 흐름

**JWT 기반 인증:**
```
1. POST /api/auth/login
   Request: { email, password }
   Response: {
     accessToken: "eyJ...",
     refreshToken: "abc...",
     expiresIn: 900000  // 15분
   }

2. Authorization: Bearer <accessToken>
   → JwtAuthenticationFilter 검증
   → SecurityContext에 userId 저장
   → Controller에서 @AuthenticationPrincipal Long userId 주입

3. Access Token 만료 시:
   POST /api/auth/refresh
   Request: { refreshToken }
   Response: { accessToken, refreshToken, expiresIn }
```

### 5.3 에러 응답 표준화

**GlobalExceptionHandler:**
```json
{
  "timestamp": "2025-11-23T10:30:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Product with id 999 not found",
  "path": "/api/products/999"
}
```

### 5.4 OpenAPI 3.0 문서화

**자동 생성 (SpringDoc):**
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI Spec: `http://localhost:8080/v3/api-docs`

---

## 6. 인프라 구조

### 6.1 로컬 개발 환경 (Docker Compose)

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:15-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: sagaline
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    ports: ["9200:9200"]
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    ports: ["9092:9092"]
    depends_on: [zookeeper]

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    ports: ["2181:2181"]

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
```

**실행:**
```bash
cd infrastructure/docker
docker-compose up -d
```

### 6.2 애플리케이션 설정 (application.yml)

**주요 설정:**
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/sagaline
    hikari:
      maximum-pool-size: 10
      connection-timeout: 30000

  jpa:
    hibernate:
      ddl-auto: validate  # Flyway가 스키마 관리
    open-in-view: false   # N+1 문제 방지

  data:
    redis:
      host: localhost
      port: 6379

  elasticsearch:
    uris: http://localhost:9200

  kafka:
    bootstrap-servers: localhost:9092
    producer:
      acks: all  # 모든 replica 확인
      retries: 3

management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  tracing:
    sampling:
      probability: 1.0  # 100% 샘플링 (개발)

jwt:
  secret: ${JWT_SECRET}
  expiration: 900000     # 15분
  refresh-expiration: 604800000  # 7일
```

---

## 7. 개발 워크플로우

### 7.1 로컬 개발

**1단계: 인프라 시작**
```bash
cd infrastructure/docker
docker-compose up -d
```

**2단계: 애플리케이션 빌드 및 실행**
```bash
mvn clean install
mvn spring-boot:run
```

**3단계: 검증**
```bash
# Health Check
curl http://localhost:8080/api/health

# Actuator
curl http://localhost:8080/actuator/health

# Prometheus Metrics
curl http://localhost:8080/actuator/prometheus

# Swagger UI
open http://localhost:8080/swagger-ui.html
```

### 7.2 테스트 전략

#### 7.2.1 유닛 테스트 (JUnit 5 + Mockito)
```java
@Test
void createOrder_Success() {
    // Given
    when(cartRepository.findByUserId(1L)).thenReturn(cart);

    // When
    Order order = orderService.createOrder(1L);

    // Then
    assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
    verify(eventPublisher).publish(any(OrderCreatedEvent.class));
}
```

#### 7.2.2 통합 테스트 (@SpringBootTest)
```java
@SpringBootTest
@AutoConfigureMockMvc
class OrderControllerIntegrationTest {
    @Test
    void createOrder_E2E_Success() {
        mockMvc.perform(post("/api/orders")
            .header("Authorization", "Bearer " + token))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("PENDING"));
    }
}
```

#### 7.2.3 코드 커버리지 (Jacoco)
```bash
mvn clean verify
open target/site/jacoco/index.html
```

**기준:**
- 최소 80% 라인 커버리지
- CI에서 자동 검증

### 7.3 CI/CD 파이프라인

**GitHub Actions (.github/workflows/ci.yml):**
```yaml
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'

      - name: Start Infrastructure
        run: docker-compose up -d

      - name: Build
        run: mvn clean install

      - name: Run Tests
        run: mvn verify

      - name: Check Coverage
        run: mvn jacoco:check

      - name: Security Scan
        run: mvn dependency-check:check

      - name: OpenAPI Validation
        run: npx @redocly/cli lint docs/api/openapi.yaml
```

**품질 게이트:**
1. ✅ 빌드 성공
2. ✅ 모든 테스트 통과
3. ✅ 커버리지 ≥ 80%
4. ✅ 보안 스캔 (Critical/High 0건)
5. ✅ OpenAPI 유효성 검증

---

## 8. 성능 & 확장성 전략

### 8.1 데이터베이스 최적화

**연결 풀 관리 (HikariCP):**
```yaml
hikari:
  maximum-pool-size: 10     # CPU 코어 수 * 2
  minimum-idle: 5
  connection-timeout: 30000
  idle-timeout: 600000      # 10분
  max-lifetime: 1800000     # 30분
```

**쿼리 최적화:**
- N+1 문제 방지: `@EntityGraph`, Fetch Join
- 인덱스 활용: 자주 조회되는 컬럼
- Pagination: `Pageable` 사용

### 8.2 캐싱 전략

**다층 캐싱:**
```
L1 Cache (JVM Heap)     : @Cacheable (TTL: 5분)
L2 Cache (Redis)        : Distributed Cache (TTL: 1시간)
L3 Cache (Elasticsearch): Search Results (TTL: 10분)
```

**캐시 무효화:**
```java
@CacheEvict(value = "products", key = "#id")
public void updateProduct(Long id, ProductDTO dto) {
    // 업데이트 로직
}
```

### 8.3 수평 확장 준비

**Stateless 애플리케이션:**
- 세션 저장소: Redis (JWT 리프레시 토큰)
- 파일 업로드: S3 (향후)
- 분산 캐시: Redis

**로드 밸런싱 준비:**
- Health Check 엔드포인트: `/actuator/health`
- Readiness Probe: DB, Redis 연결 확인
- Liveness Probe: 애플리케이션 정상 동작

---

## 9. 보안 아키텍처

### 9.1 인증 & 권한

**Security Filter Chain:**
```
Request
  → JwtAuthenticationFilter (JWT 검증)
  → SecurityContext (userId, roles 저장)
  → Controller (@PreAuthorize 검사)
  → Service (비즈니스 로직)
```

**역할 기반 접근 제어:**
```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping("/api/products")
public ResponseEntity<ProductDTO> createProduct(...) {
    // ADMIN만 접근 가능
}
```

### 9.2 데이터 보호

**PII 암호화 (AES-256):**
```java
@Convert(converter = PiiEncryptionConverter.class)
private String phoneNumber;  // 암호화 저장
```

**SQL Injection 방지:**
- JPA/JPQL 사용 (Parameterized Queries)
- Native Query 시 `@Query` 파라미터 바인딩

**XSS/CSRF 방지:**
- Content Security Policy 헤더
- CSRF 토큰 (REST API는 Stateless이므로 비활성화)

---

## 10. 관찰성 아키텍처

### 10.1 메트릭 (Prometheus + Micrometer)

**비즈니스 메트릭:**
```java
@Counted("user.registrations")
@Timed("user.registration.duration")
public User register(RegisterRequest request) {
    // 회원가입 로직
}
```

**인프라 메트릭:**
- `hikaricp_connections_active`: DB 연결 수
- `http_server_requests_seconds`: API 응답 시간
- `jvm_memory_used_bytes`: JVM 메모리

### 10.2 분산 추적 (Zipkin + Micrometer Tracing)

**Trace Context 전파:**
```
POST /api/orders
  trace-id: abc123
  span-id: def456
  ├─ OrderService.createOrder()
  │   ├─ CartRepository.findByUserId()
  │   ├─ OrderRepository.save()
  │   └─ EventPublisher.publish()
  └─ Kafka Producer → trace-id 전달
```

### 10.3 구조화된 로깅 (Logback + Logstash Encoder)

**JSON 로그 형식:**
```json
{
  "timestamp": "2025-11-23T10:30:00.123Z",
  "level": "INFO",
  "trace_id": "abc123",
  "span_id": "def456",
  "service": "sagaline",
  "class": "OrderService",
  "method": "createOrder",
  "user_id": "12345",
  "message": "Order created successfully",
  "order_id": "67890"
}
```

---

## 11. 향후 진화 경로

### 11.1 Phase 2: 마이크로서비스 분해 (Stage 5)

**서비스 경계:**
```
Monolith
  ├─ user/         → user-service
  ├─ product/      → product-service
  ├─ cart/ + order/ → order-service
  ├─ payment/      → payment-service
  └─ inventory/    → inventory-service
```

**통신 패턴:**
- 동기: REST API (Feign Client)
- 비동기: Kafka Events

### 11.2 Phase 3: 클라우드 네이티브 (Stage 6-9)

- **Stage 6**: 컨테이너화 (Docker)
- **Stage 7**: Kubernetes 배포
- **Stage 8**: WebSocket 실시간 알림
- **Stage 9**: 멀티 리전 복제

---

## 12. 검증 체크리스트

- [ ] 모든 도메인 API 동작 확인 (Postman 컬렉션)
- [ ] JWT 인증 흐름 테스트
- [ ] Kakao OAuth 로그인 (Mock)
- [ ] 상품 검색 (한글) 동작 확인
- [ ] 장바구니 → 주문 E2E 흐름
- [ ] Toss Payments 통합 (Mock)
- [ ] Kafka 이벤트 발행/구독 확인
- [ ] Prometheus 메트릭 수집 확인
- [ ] Zipkin 분산 추적 확인
- [ ] 테스트 커버리지 ≥ 80%
- [ ] 보안 스캔 통과 (Critical/High 0건)
- [ ] API 응답 시간 p99 < 200ms
- [ ] Docker Compose로 전체 스택 실행

---

## 13. 참고 자료

- [Spring Boot 3.2 Documentation](https://docs.spring.io/spring-boot/docs/3.2.0/reference/)
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
- [Elasticsearch 8.x Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/8.11/index.html)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Resilience4j Documentation](https://resilience4j.readme.io/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
