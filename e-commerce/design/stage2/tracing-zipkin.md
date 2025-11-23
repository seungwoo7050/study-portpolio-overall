# Stage 2: 분산 추적 (Distributed Tracing) - Zipkin

## 문서 정보
- **작성일**: 2025-11-23
- **Stage**: 2 - Observability
- **구성 요소**: Zipkin, Micrometer Tracing, Brave
- **상태**: ✅ 구현 완료

---

## 목차
1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [Micrometer Tracing 통합](#micrometer-tracing-통합)
4. [자동 컨텍스트 전파](#자동-컨텍스트-전파)
5. [Span 계층 구조](#span-계층-구조)
6. [커스텀 Span 생성](#커스텀-span-생성)
7. [샘플링 전략](#샘플링-전략)
8. [Zipkin 설정](#zipkin-설정)
9. [Zipkin UI 사용법](#zipkin-ui-사용법)
10. [로그 상관관계](#로그-상관관계)
11. [성능 영향](#성능-영향)
12. [모범 사례](#모범-사례)
13. [트러블슈팅](#트러블슈팅)

---

## 개요

### 분산 추적이란?
분산 추적(Distributed Tracing)은 마이크로서비스 아키텍처에서 요청이 여러 서비스를 거쳐 처리되는 과정을 추적하고 시각화하는 기술입니다. Sagaline은 현재 모놀리식 아키텍처이지만, 향후 마이크로서비스로의 전환을 대비하여 분산 추적 시스템을 구축했습니다.

### 핵심 개념

#### Trace
- 하나의 요청이 시스템을 통과하는 전체 여정
- 고유한 Trace ID로 식별
- 여러 Span들로 구성

#### Span
- Trace 내에서 수행되는 개별 작업 단위
- 고유한 Span ID로 식별
- 시작 시간, 종료 시간, 메타데이터 포함
- 부모-자식 관계를 통해 계층 구조 형성

#### Context Propagation
- Trace ID와 Span ID를 서비스 간 전달하는 메커니즘
- HTTP 헤더, Kafka 메시지 헤더를 통해 전파

### 도입 배경

**현재 (모놀리식)**:
- 단일 애플리케이션 내에서도 복잡한 호출 체인 존재
- HTTP → Service → Repository → Database 흐름 추적 필요
- Kafka 비동기 이벤트 처리 흐름 가시화

**미래 (마이크로서비스)**:
- 서비스 간 의존성 파악
- 병목 지점 식별
- 장애 전파 경로 분석
- 지연 시간 최적화

---

## 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Request                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ traceId, spanId 생성
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Spring Boot Application                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Micrometer Tracing (Brave)                  │  │
│  │  - Trace Context 관리                                  │  │
│  │  - Span 생성/종료                                      │  │
│  │  - Context Propagation                                │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────┴──────────────────┐                    │
│  │                                     │                    │
│  ▼                                     ▼                    │
│ HTTP Filter                      Kafka Interceptor          │
│ - 자동 Span 생성                  - Message Header 전파      │
│ - Header 전파                     - Consumer Span 생성      │
│                                                              │
│  Controller → Service → Repository → Database               │
│  │            │         │                                    │
│  └────────────┴─────────┴─ Automatic Span Creation          │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             Zipkin Reporter                           │  │
│  │  - Span 데이터를 JSON으로 변환                         │  │
│  │  - HTTP POST로 Zipkin 서버에 전송                      │  │
│  └───────────────────┬───────────────────────────────────┘  │
└────────────────────┬─┴───────────────────────────────────────┘
                     │
                     │ POST /api/v2/spans
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Zipkin Server                              │
│  - Span 데이터 수집 및 저장                                    │
│  - In-Memory Storage (개발) / Elasticsearch (프로덕션)        │
│  - Trace 재구성 및 인덱싱                                      │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Zipkin UI                            │  │
│  │  - Trace 검색 및 시각화                                │  │
│  │  - Span 타임라인 표시                                   │
│  │  - 서비스 의존성 그래프                                 │  │
│  │  - 지연 시간 분석                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 컴포넌트 역할

#### 1. Micrometer Tracing
- Spring Boot 3.x의 표준 추적 API
- 추상화 계층을 제공하여 다양한 Tracer 구현체 지원 (Brave, OpenTelemetry 등)

#### 2. Brave
- Zipkin의 공식 Java 트레이서
- Micrometer Tracing의 구현체로 사용
- 낮은 오버헤드, 높은 성능

#### 3. Zipkin Server
- 오픈소스 분산 추적 시스템
- Twitter에서 개발, 현재 OpenZipkin 프로젝트로 유지
- In-Memory, MySQL, Cassandra, Elasticsearch 백엔드 지원

---

## Micrometer Tracing 통합

### 의존성 설정

`pom.xml`:
```xml
<!-- Micrometer Tracing (Distributed Tracing) -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>

<!-- Zipkin Reporter (for distributed tracing) -->
<dependency>
    <groupId>io.zipkin.reporter2</groupId>
    <artifactId>zipkin-reporter-brave</artifactId>
</dependency>
```

**위치**: `/e-commerce/pom.xml:78-87`

### Spring Boot 자동 구성

Spring Boot 3.x는 Micrometer Tracing을 자동으로 구성합니다:

1. **TraceContext 생성**: 모든 요청에 대해 자동으로 Trace ID와 Span ID 생성
2. **HTTP 전파**: `B3` 헤더를 통한 자동 컨텍스트 전파
3. **MDC 통합**: SLF4J MDC에 traceId, spanId 자동 주입
4. **Actuator 통합**: `/actuator/traces` 엔드포인트 제공

### 자동 계측 범위

#### HTTP 요청
```java
// Spring MVC Controller - 자동으로 Span 생성
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(@RequestBody OrderRequest request) {
        // 자동으로 다음 정보가 Span에 기록됨:
        // - http.method: POST
        // - http.path: /api/orders
        // - http.status_code: 201
        // - http.url: http://localhost:8080/api/orders
        return orderService.createOrder(request);
    }
}
```

**자동 생성되는 Span 태그**:
- `http.method`: HTTP 메서드 (GET, POST, PUT, DELETE 등)
- `http.path`: 요청 경로
- `http.status_code`: 응답 상태 코드
- `http.url`: 전체 URL
- `mvc.controller.class`: 컨트롤러 클래스명
- `mvc.controller.method`: 컨트롤러 메서드명

#### 데이터베이스 쿼리
```java
// JPA Repository 호출 - 자동으로 Span 생성
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    // findById 호출 시 자동으로 "SELECT" Span 생성
    // - sql.query: SELECT * FROM orders WHERE id = ?
    // - db.system: postgresql
    // - db.connection_string: jdbc:postgresql://localhost:5432/sagaline
}
```

**자동 생성되는 Span 태그**:
- `sql.query`: 실행된 SQL 쿼리
- `db.system`: 데이터베이스 타입 (postgresql, mysql 등)
- `db.connection_string`: 연결 문자열
- `db.user`: 데이터베이스 사용자명

#### Kafka 메시징
```java
// Kafka Producer - 자동으로 Span 생성 및 Header 전파
@Service
public class EventPublisher {
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publish(String topic, BaseEvent event) {
        // 자동으로 Trace Context를 Kafka Message Header에 추가
        kafkaTemplate.send(topic, event.getEventId(), event);
        // Headers: X-B3-TraceId, X-B3-SpanId, X-B3-ParentSpanId
    }
}

// Kafka Consumer - 자동으로 Span 생성 및 Context 복원
@KafkaListener(topics = "order-events")
public void handleOrderEvent(@Payload Object event) {
    // Header에서 Trace Context 추출하여 Span 생성
    // Producer와 동일한 Trace ID로 연결됨
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/event/EventPublisher.java:33-37`

---

## 자동 컨텍스트 전파

### HTTP 헤더 전파 (B3 Propagation)

Brave는 **B3 Propagation** 표준을 사용하여 HTTP 헤더를 통해 Trace Context를 전달합니다.

#### Single Header 방식 (기본)
```http
B3: {traceId}-{spanId}-{samplingDecision}-{parentSpanId}

예시:
B3: 80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1-05e3ac9a4f6e3b90
```

#### Multi Header 방식 (호환성)
```http
X-B3-TraceId: 80f198ee56343ba864fe8b2a57d3eff7
X-B3-SpanId: e457b5a2e4d86bd1
X-B3-ParentSpanId: 05e3ac9a4f6e3b90
X-B3-Sampled: 1
```

### HTTP 클라이언트 예시

```java
// Spring RestTemplate - 자동으로 B3 헤더 추가
@Service
public class PaymentClient {

    private final RestTemplate restTemplate;

    public PaymentResponse processPayment(PaymentRequest request) {
        // RestTemplate이 자동으로 현재 Trace Context를 헤더에 추가
        ResponseEntity<PaymentResponse> response = restTemplate.postForEntity(
            "https://api.tosspayments.com/v1/payments",
            request,
            PaymentResponse.class
        );
        // 외부 API 호출도 동일한 Trace에 포함됨
        return response.getBody();
    }
}
```

### Kafka 메시지 헤더 전파

Spring Kafka는 Micrometer Tracing과 통합되어 자동으로 Trace Context를 메시지 헤더에 추가합니다.

#### Producer 측
```java
@Service
public class EventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publish(String topic, BaseEvent event) {
        // KafkaTemplate이 자동으로 B3 헤더를 메시지에 추가
        CompletableFuture<SendResult<String, Object>> future =
            kafkaTemplate.send(topic, event.getEventId(), event);

        // 메시지 헤더에 자동 추가되는 정보:
        // - b3: {traceId}-{spanId}-{samplingDecision}
        // 또는
        // - X-B3-TraceId: {traceId}
        // - X-B3-SpanId: {spanId}
        // - X-B3-Sampled: 1
    }
}
```

#### Consumer 측
```java
@KafkaListener(topics = KafkaConfig.ORDER_EVENTS_TOPIC)
public void handleOrderEvent(@Payload Object event,
                              @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
    // Spring Kafka가 자동으로 메시지 헤더에서 Trace Context 추출
    // 새로운 Span이 생성되며, Producer의 Span이 부모가 됨

    log.info("Processing order event: {}", event);
    // 로그에 traceId, spanId가 자동으로 포함됨

    // 비즈니스 로직 처리...
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/order/consumer/OrderEventConsumer.java:34-39`

### Context Propagation 흐름 예시

**주문 생성 요청의 전체 Trace 흐름**:

```
1. Client → API Gateway
   traceId: abc123
   spanId: span1

2. API Gateway → Order Service (HTTP)
   Header: B3: abc123-span2-1-span1

3. Order Service → Database
   traceId: abc123
   spanId: span3
   parentSpanId: span2

4. Order Service → Kafka Producer (order-events topic)
   Message Header: b3: abc123-span4-1-span2

5. Kafka Consumer → Notification Service
   traceId: abc123 (동일한 Trace ID!)
   spanId: span5
   parentSpanId: span4

6. Notification Service → SMS Gateway (HTTP)
   Header: B3: abc123-span6-1-span5
```

모든 단계가 **동일한 traceId (abc123)**로 연결되어 전체 요청 흐름을 추적할 수 있습니다.

---

## Span 계층 구조

### Span 타입

#### 1. Server Span
HTTP 요청을 받을 때 생성되는 Span:
```
Span: POST /api/orders
  - Kind: SERVER
  - Tags:
    - http.method: POST
    - http.path: /api/orders
    - http.status_code: 201
  - Duration: 145ms
```

#### 2. Client Span
외부 서비스를 호출할 때 생성되는 Span:
```
Span: POST https://api.tosspayments.com/v1/payments
  - Kind: CLIENT
  - Tags:
    - http.method: POST
    - http.url: https://api.tosspayments.com/v1/payments
    - peer.service: tosspayments
  - Duration: 350ms
```

#### 3. Database Span
데이터베이스 쿼리 실행 시 생성되는 Span:
```
Span: SELECT orders
  - Kind: CLIENT
  - Tags:
    - sql.query: SELECT * FROM orders WHERE id = ?
    - db.system: postgresql
    - db.statement: SELECT * FROM orders WHERE id = ?
  - Duration: 12ms
```

#### 4. Producer Span
Kafka 메시지 발행 시 생성되는 Span:
```
Span: send order-events
  - Kind: PRODUCER
  - Tags:
    - messaging.system: kafka
    - messaging.destination: order-events
    - messaging.operation: send
  - Duration: 5ms
```

#### 5. Consumer Span
Kafka 메시지 소비 시 생성되는 Span:
```
Span: receive order-events
  - Kind: CONSUMER
  - Tags:
    - messaging.system: kafka
    - messaging.destination: order-events
    - messaging.operation: receive
  - Duration: 89ms
```

### 실제 주문 생성 요청의 Span 계층 구조

```
Trace: 주문 생성 (traceId: 80f198ee56343ba864fe8b2a57d3eff7)
Duration: 487ms

└─ POST /api/orders [SERVER] (145ms)
   ├─ OrderService.createOrder [LOCAL] (140ms)
   │  ├─ UserRepository.findById [CLIENT - DB] (8ms)
   │  │  └─ SELECT * FROM users WHERE id = ? (8ms)
   │  │
   │  ├─ CartRepository.findByUserId [CLIENT - DB] (12ms)
   │  │  └─ SELECT * FROM carts WHERE user_id = ? (12ms)
   │  │
   │  ├─ OrderRepository.save [CLIENT - DB] (15ms)
   │  │  └─ INSERT INTO orders (...) VALUES (...) (15ms)
   │  │
   │  └─ EventPublisher.publish [PRODUCER] (5ms)
   │     └─ send order-events (5ms)
   │
   └─ Response (5ms)

└─ OrderEventConsumer.handleOrderEvent [CONSUMER] (89ms, async)
   └─ Notification 처리 (89ms)
      └─ SMS Gateway API [CLIENT] (82ms)
```

**주요 인사이트**:
- 전체 요청: 145ms
- 가장 느린 구간: Database 쿼리 (35ms 합계)
- 비동기 이벤트 처리: 89ms (별도 Trace로 추적 가능)

---

## 커스텀 Span 생성

현재 구현에서는 Spring Boot의 자동 계측만 사용하고 있지만, 향후 필요 시 커스텀 Span을 생성할 수 있습니다.

### 방법 1: @NewSpan 어노테이션

```java
import io.micrometer.observation.annotation.Observed;

@Service
public class InventoryService {

    @Observed(name = "inventory.reserve",
              contextualName = "reserve-inventory",
              lowCardinalityKeyValues = {"service", "inventory"})
    public void reserveInventory(Long productId, Integer quantity) {
        // 자동으로 "inventory.reserve" Span 생성
        // 복잡한 비즈니스 로직 추적 시 유용
    }
}
```

### 방법 2: Tracer API 직접 사용

```java
import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.Span;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final Tracer tracer;

    public PaymentResult processPayment(PaymentRequest request) {
        // 수동으로 Span 생성
        Span span = tracer.nextSpan().name("payment.validation").start();

        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            // Span 태그 추가
            span.tag("payment.method", "toss");
            span.tag("payment.amount", request.getAmount().toString());

            // 비즈니스 로직
            validatePayment(request);

            // Span 이벤트 추가
            span.event("validation.completed");

            return executePayment(request);

        } catch (Exception e) {
            // 에러 정보 기록
            span.error(e);
            throw e;
        } finally {
            // Span 종료
            span.end();
        }
    }
}
```

### 방법 3: ObservationRegistry 사용 (권장)

```java
import io.micrometer.observation.ObservationRegistry;
import io.micrometer.observation.Observation;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final ObservationRegistry observationRegistry;

    public SearchResult search(SearchRequest request) {
        return Observation
            .createNotStarted("search.elasticsearch", observationRegistry)
            .lowCardinalityKeyValue("search.type", "product")
            .highCardinalityKeyValue("search.query", request.getQuery())
            .observe(() -> {
                // 자동으로 Span 생성 및 종료
                return elasticsearchClient.search(request);
            });
    }
}
```

---

## 샘플링 전략

### 현재 설정 (개발 환경)

`application.yml`:
```yaml
management:
  tracing:
    sampling:
      probability: 1.0  # 100% 샘플링
```

**위치**: `/e-commerce/src/main/resources/application.yml:98-99`

- **100% 샘플링**: 모든 요청을 추적
- **개발 환경에 적합**: 모든 Trace 데이터 확인 가능
- **프로덕션 부적합**: 높은 오버헤드 및 스토리지 비용

### 프로덕션 권장 설정

```yaml
management:
  tracing:
    sampling:
      probability: 0.1  # 10% 샘플링
```

### 샘플링 결정 시점

1. **요청 시작 시**: Trace ID 생성 시 샘플링 여부 결정
2. **확률 기반**: `sampling.probability` 값에 따라 랜덤 선택
3. **전파**: 샘플링 결정이 모든 하위 Span에 상속됨

**샘플링 결정 흐름**:
```
요청 1: traceId=abc123, sampled=1 (선택됨, Zipkin에 전송)
  └─ 모든 하위 Span도 sampled=1

요청 2: traceId=def456, sampled=0 (선택 안됨, 전송 안함)
  └─ 모든 하위 Span도 sampled=0

요청 3: traceId=ghi789, sampled=1 (선택됨, Zipkin에 전송)
  └─ 모든 하위 Span도 sampled=1
```

### 고급 샘플링 전략 (향후 고려사항)

#### 1. Rate Limiting Sampler
```java
// 초당 최대 100개의 Trace만 샘플링
Sampler.create(RateLimitingSampler.create(100));
```

#### 2. Path-based Sampler
```java
// 특정 경로는 항상 샘플링
if (path.startsWith("/api/orders")) {
    return true;  // 100% 샘플링
} else {
    return Math.random() < 0.1;  // 10% 샘플링
}
```

#### 3. Error-based Sampler
```java
// 에러 발생 시 항상 샘플링
if (statusCode >= 400) {
    return true;  // 에러는 항상 추적
}
```

---

## Zipkin 설정

### Docker Compose 설정

`docker-compose.yml`:
```yaml
# Zipkin - Distributed Tracing
zipkin:
  image: openzipkin/zipkin:latest
  container_name: sagaline-zipkin
  ports:
    - "9411:9411"
  environment:
    - STORAGE_TYPE=mem  # 개발: In-Memory, 프로덕션: elasticsearch
  networks:
    - sagaline-network
```

**위치**: `/e-commerce/infrastructure/docker/docker-compose.yml:38-47`

### 스토리지 옵션

#### 1. In-Memory (개발 환경)
```yaml
environment:
  - STORAGE_TYPE=mem
```

**특징**:
- 가장 빠른 성능
- 재시작 시 데이터 손실
- 제한된 메모리 (기본 JVM 힙 크기)

#### 2. Elasticsearch (프로덕션 권장)
```yaml
environment:
  - STORAGE_TYPE=elasticsearch
  - ES_HOSTS=elasticsearch:9200
  - ES_INDEX=zipkin
  - ES_DATE_SEPARATOR=-
  - ES_INDEX_SHARDS=5
  - ES_INDEX_REPLICAS=1
```

**특징**:
- 대용량 데이터 저장
- 빠른 검색 성능
- 데이터 보존 정책 (Curator 사용)
- 클러스터링 지원

#### 3. MySQL
```yaml
environment:
  - STORAGE_TYPE=mysql
  - MYSQL_HOST=mysql
  - MYSQL_TCP_PORT=3306
  - MYSQL_DB=zipkin
  - MYSQL_USER=zipkin
  - MYSQL_PASS=zipkin
```

#### 4. Cassandra
```yaml
environment:
  - STORAGE_TYPE=cassandra3
  - CASSANDRA_CONTACT_POINTS=cassandra:9042
  - CASSANDRA_LOCAL_DC=datacenter1
```

### 애플리케이션 설정

`application.yml`:
```yaml
management:
  zipkin:
    tracing:
      endpoint: ${ZIPKIN_URL:http://localhost:9411/api/v2/spans}
  tracing:
    sampling:
      probability: 1.0
```

**위치**: `/e-commerce/src/main/resources/application.yml:100-102`

### 환경 변수를 통한 설정

**개발 환경**:
```bash
export ZIPKIN_URL=http://localhost:9411/api/v2/spans
export MANAGEMENT_TRACING_SAMPLING_PROBABILITY=1.0
```

**프로덕션 환경**:
```bash
export ZIPKIN_URL=http://zipkin.sagaline.internal:9411/api/v2/spans
export MANAGEMENT_TRACING_SAMPLING_PROBABILITY=0.1
```

---

## Zipkin UI 사용법

### 접속 정보
- **URL**: http://localhost:9411
- **인증**: 없음 (개발 환경)

### 주요 기능

#### 1. Trace 검색

**검색 옵션**:
```
1. serviceName: sagaline
2. spanName: POST /api/orders
3. minDuration: 100ms (100ms 이상 소요된 요청만)
4. maxDuration: 5000ms
5. limit: 10 (결과 개수)
6. lookback: 1h (최근 1시간)
```

**검색 예시**:
- 느린 요청 찾기: `minDuration=500ms`
- 특정 API 추적: `spanName=POST /api/orders`
- 에러 발생 요청: `tag=error`

#### 2. Trace 타임라인

Trace를 클릭하면 상세 타임라인 표시:

```
Trace: 80f198ee56343ba864fe8b2a57d3eff7
Duration: 487ms

Timeline:
0ms  ──────────────────────────────────── 487ms
     │                                   │
     ├─ POST /api/orders (145ms)         │
     │  ├─ SELECT users (8ms)            │
     │  ├─ SELECT carts (12ms)           │
     │  ├─ INSERT orders (15ms)          │
     │  └─ send kafka (5ms)              │
     │                                   │
     └─ receive kafka (89ms)             │
        └─ POST sms-gateway (82ms)       │
```

#### 3. Span 상세 정보

각 Span을 클릭하면 다음 정보 확인:

**Span Metadata**:
- Trace ID: `80f198ee56343ba864fe8b2a57d3eff7`
- Span ID: `e457b5a2e4d86bd1`
- Parent Span ID: `05e3ac9a4f6e3b90`
- Duration: `145ms`
- Start Time: `2025-11-23 10:15:30.123`

**Tags** (메타데이터):
```
http.method: POST
http.path: /api/orders
http.status_code: 201
mvc.controller.class: OrderController
mvc.controller.method: createOrder
user.id: 12345
order.id: 67890
```

**Annotations** (이벤트):
```
0ms: Server Receive (sr)
2ms: Order validation started
5ms: Order validation completed
143ms: Server Send (ss)
```

#### 4. 서비스 의존성 그래프

**Dependencies** 탭에서 서비스 간 의존성 시각화:

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 100 calls
       ▼
┌─────────────┐
│  sagaline   │
└──┬────┬─────┘
   │    │
   │    │ 100 calls
   │    ▼
   │  ┌─────────────┐
   │  │ postgresql  │
   │  └─────────────┘
   │
   │ 50 calls
   ▼
┌──────────────┐
│    kafka     │
└──────┬───────┘
       │ 50 calls
       ▼
┌─────────────────┐
│ notification-   │
│   service       │
└─────────────────┘
```

#### 5. 에러 추적

에러가 발생한 Span은 빨간색으로 표시:

```
Trace: abc123 (ERROR)
└─ POST /api/orders
   └─ PaymentService.processPayment ❌
      └─ POST https://api.tosspayments.com/v1/payments
         Error: Connection timeout after 5000ms
         Stack Trace:
           java.net.SocketTimeoutException: connect timed out
             at PaymentClient.processPayment(PaymentClient.java:45)
             ...
```

---

## 로그 상관관계

### MDC를 통한 자동 주입

Micrometer Tracing은 자동으로 SLF4J MDC(Mapped Diagnostic Context)에 Trace 정보를 주입합니다:

**MDC에 자동 추가되는 정보**:
- `traceId`: Trace ID (16자리 또는 32자리 hex)
- `spanId`: 현재 Span ID (16자리 hex)
- `parentId`: 부모 Span ID (16자리 hex)
- `spanExportable`: 샘플링 여부 (true/false)

### Logback 설정

`logback-spring.xml`:
```xml
<!-- Console Appender -->
<appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
        <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} [traceId=%X{traceId:-}] - %msg%n</pattern>
    </encoder>
</appender>

<!-- JSON Appender -->
<appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
    <encoder class="net.logstash.logback.encoder.LogstashEncoder">
        <!-- Trace ID를 JSON 필드로 포함 -->
        <includeMdcKeyName>traceId</includeMdcKeyName>
        <includeMdcKeyName>spanId</includeMdcKeyName>
    </encoder>
</appender>
```

**위치**: `/e-commerce/src/main/resources/logback-spring.xml:10,20-21`

### 로그 출력 예시

**Console 로그** (개발 환경):
```
2025-11-23 10:15:30.123 [http-nio-8080-exec-1] INFO  OrderService [traceId=80f198ee56343ba864fe8b2a57d3eff7] - Creating order for user: 12345
2025-11-23 10:15:30.135 [http-nio-8080-exec-1] DEBUG OrderRepository [traceId=80f198ee56343ba864fe8b2a57d3eff7] - Executing query: SELECT * FROM users WHERE id = ?
2025-11-23 10:15:30.150 [http-nio-8080-exec-1] INFO  OrderService [traceId=80f198ee56343ba864fe8b2a57d3eff7] - Order created successfully: orderId=67890
```

**JSON 로그** (프로덕션):
```json
{
  "timestamp": "2025-11-23T10:15:30.123Z",
  "level": "INFO",
  "traceId": "80f198ee56343ba864fe8b2a57d3eff7",
  "spanId": "e457b5a2e4d86bd1",
  "service": "sagaline",
  "logger": "com.sagaline.order.service.OrderService",
  "thread": "http-nio-8080-exec-1",
  "message": "Creating order for user: 12345",
  "userId": "12345"
}
```

### Trace ID를 통한 로그 검색

#### Kibana에서 검색
```
# 특정 Trace의 모든 로그 찾기
traceId: "80f198ee56343ba864fe8b2a57d3eff7"

# 결과: 해당 Trace에 포함된 모든 서비스, 모든 레벨의 로그
- OrderController: "Received order request"
- OrderService: "Creating order for user: 12345"
- OrderRepository: "Executing query: SELECT * FROM users..."
- EventPublisher: "Event published successfully: orderId=67890"
- OrderEventConsumer: "Received order event"
- NotificationService: "Sending SMS notification"
```

#### Grep을 통한 검색
```bash
# 로그 파일에서 특정 Trace 검색
grep "80f198ee56343ba864fe8b2a57d3eff7" logs/sagaline.log

# JSON 로그에서 jq를 사용한 검색
cat logs/sagaline-json.log | jq 'select(.traceId == "80f198ee56343ba864fe8b2a57d3eff7")'
```

### Metrics-Traces-Logs 상관관계

**통합 디버깅 워크플로우**:

1. **Grafana에서 이상 징후 발견**:
   ```
   Alert: HighLatency
   P99 latency: 2500ms (threshold: 200ms)
   Time: 2025-11-23 10:15:30
   ```

2. **Zipkin에서 느린 Trace 찾기**:
   ```
   검색: minDuration=2000ms, time=2025-11-23 10:15:30
   결과: Trace 80f198ee56343ba864fe8b2a57d3eff7 (2487ms)

   타임라인 분석:
   └─ POST /api/orders (2487ms)
      └─ PaymentService.processPayment (2350ms) ← 병목!
         └─ POST https://api.tosspayments.com/v1/payments (2300ms)
   ```

3. **Kibana에서 상세 로그 확인**:
   ```
   검색: traceId: "80f198ee56343ba864fe8b2a57d3eff7"

   로그:
   10:15:30.123 INFO  "Payment request sent"
   10:15:32.423 ERROR "Payment gateway timeout: Connection timeout after 2300ms"
   10:15:32.430 WARN  "Retrying payment with exponential backoff"
   ```

4. **근본 원인 파악**:
   - Payment Gateway의 타임아웃
   - 네트워크 지연 또는 외부 서비스 장애
   - 해결책: Timeout 증가 또는 Circuit Breaker 개선

---

## 성능 영향

### 오버헤드 측정

#### 요청당 오버헤드
- **Trace Context 생성**: ~0.1ms
- **Span 생성/종료**: ~0.5ms per Span
- **HTTP 헤더 추가**: ~0.1ms
- **Zipkin 전송** (비동기): ~0ms (차단 없음)
- **MDC 주입**: ~0.1ms
- **총 오버헤드**: ~1-5ms per request (Span 개수에 따라)

#### 메모리 사용량
- **Span 버퍼**: ~1KB per Span
- **100 req/sec, 5 Spans/req**: ~500KB/sec
- **Zipkin Reporter 버퍼**: 최대 10MB (기본값)

#### 네트워크 대역폭
- **Span 크기**: ~2-5KB (JSON 직렬화)
- **100 req/sec, 5 Spans/req**: ~2.5MB/sec
- **압축 사용 시**: ~500KB/sec

### 샘플링에 따른 성능 차이

| 샘플링 비율 | 요청당 오버헤드 | Zipkin 전송량 | 권장 환경 |
|------------|---------------|--------------|----------|
| 100% (1.0) | ~5ms | 100% | 개발 |
| 10% (0.1) | ~1ms | 10% | 스테이징 |
| 1% (0.01) | ~0.5ms | 1% | 프로덕션 (대용량) |

**샘플링되지 않은 요청도 Trace ID는 생성**되므로, 로그 상관관계는 유지됩니다.

### 비동기 전송

Zipkin Reporter는 **비동기 배치 전송**을 사용하여 애플리케이션 성능에 영향을 최소화합니다:

```java
// Span 완료 시
span.end();
  └─ Span을 in-memory buffer에 추가 (비동기, ~0.1ms)

// 백그라운드 스레드 (1초마다)
Reporter Thread:
  1. 버퍼에서 Span 수집
  2. JSON으로 직렬화
  3. HTTP POST로 Zipkin에 전송
  4. 성공/실패 로깅
```

**설정 옵션** (필요 시):
```yaml
zipkin:
  sender:
    type: web  # web, kafka, activemq, rabbit

  # HTTP Sender 설정
  baseUrl: http://localhost:9411

  # 성능 튜닝
  messageMaxBytes: 5242880  # 5MB
  messageTimeout: 1  # 1초
  closeTimeout: 1  # 1초
```

### 프로덕션 최적화 팁

#### 1. 샘플링 비율 조정
```yaml
# 높은 트래픽: 1% 샘플링
management.tracing.sampling.probability: 0.01

# 중간 트래픽: 10% 샘플링
management.tracing.sampling.probability: 0.1
```

#### 2. Span 태그 최소화
```java
// ❌ 나쁜 예: 고카디널리티 태그
span.tag("user.email", user.getEmail());  // 수백만 개의 고유 값

// ✅ 좋은 예: 저카디널리티 태그
span.tag("user.tier", user.getTier());  // "free", "premium", "enterprise"
```

#### 3. Kafka를 통한 전송 (높은 처리량)
```yaml
zipkin:
  sender:
    type: kafka
  kafka:
    bootstrap-servers: kafka:9092
    topic: zipkin
```

장점:
- 높은 처리량
- 백프레셔(backpressure) 처리
- Zipkin 장애 시에도 데이터 손실 없음

---

## 모범 사례

### 1. 의미 있는 Span 이름 사용

**❌ 나쁜 예**:
```java
span.name("doSomething");
span.name("process");
span.name("execute");
```

**✅ 좋은 예**:
```java
span.name("payment.validation");
span.name("inventory.reserve");
span.name("email.send");
```

### 2. 적절한 태그 추가

**비즈니스 컨텍스트 태그**:
```java
span.tag("user.id", userId.toString());
span.tag("order.id", orderId.toString());
span.tag("payment.method", "toss");
span.tag("product.category", "electronics");
```

**기술적 태그**:
```java
span.tag("cache.hit", "true");
span.tag("db.query.type", "SELECT");
span.tag("retry.attempt", "2");
```

### 3. 에러 정보 기록

```java
try {
    processPayment(request);
} catch (PaymentException e) {
    // 에러를 Span에 기록
    span.error(e);

    // 추가 컨텍스트
    span.tag("error.type", e.getClass().getSimpleName());
    span.tag("error.message", e.getMessage());
    span.tag("payment.status", "failed");

    throw e;
}
```

### 4. 중요한 이벤트 기록

```java
span.event("payment.validation.started");
span.event("payment.request.sent");
span.event("payment.response.received");
span.event("payment.validation.completed");
```

### 5. 고카디널리티 데이터 제외

**❌ 피해야 할 것**:
- 사용자 이메일, 전화번호 (개인정보)
- SQL 쿼리의 실제 값 (무한한 조합)
- 타임스탬프 (고유값)
- UUID (고유값)

**✅ 사용해야 할 것**:
- 사용자 티어 ("free", "premium")
- 상태 코드 (200, 404, 500)
- 쿼리 타입 ("SELECT", "INSERT")
- 카테고리 ("electronics", "fashion")

### 6. 비동기 작업 추적

```java
@Async
public CompletableFuture<Void> sendEmailAsync(String email) {
    // @Async 메서드도 자동으로 Trace Context 전파됨
    // 단, TaskExecutor에 Tracing 설정 필요

    log.info("Sending email to: {}", email);
    return CompletableFuture.completedFuture(null);
}

// TaskExecutor 설정
@Configuration
public class AsyncConfig {

    @Bean
    public Executor taskExecutor(ObservationRegistry registry) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        executor.initialize();

        // Tracing을 위한 TaskDecorator 설정
        executor.setTaskDecorator(new ObservationPropagatingTaskDecorator(registry));
        return executor;
    }
}
```

---

## 트러블슈팅

### 문제 1: Zipkin에 Trace가 표시되지 않음

**증상**:
- 애플리케이션이 정상 동작
- 로그에 traceId 출력됨
- Zipkin UI에 Trace 없음

**원인 및 해결**:

1. **Zipkin 서버 연결 확인**:
```bash
# Zipkin 헬스체크
curl http://localhost:9411/health

# 애플리케이션 로그 확인
grep "zipkin" logs/sagaline.log
```

2. **샘플링 설정 확인**:
```yaml
# application.yml
management:
  tracing:
    sampling:
      probability: 1.0  # 0.0이면 전송 안됨!
```

3. **의존성 확인**:
```xml
<dependency>
    <groupId>io.zipkin.reporter2</groupId>
    <artifactId>zipkin-reporter-brave</artifactId>
</dependency>
```

4. **네트워크 확인**:
```bash
# 애플리케이션에서 Zipkin 접근 가능한지 확인
telnet localhost 9411
```

### 문제 2: 로그에 traceId가 출력되지 않음

**증상**:
```
2025-11-23 10:15:30.123 [http-nio-8080-exec-1] INFO  OrderService [traceId=] - Creating order
```

**원인 및 해결**:

1. **Micrometer Tracing 의존성 확인**:
```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
```

2. **Logback 설정 확인**:
```xml
<pattern>... [traceId=%X{traceId:-}] ...</pattern>
```

3. **Spring Boot 버전 확인**:
- Micrometer Tracing은 Spring Boot 3.0+ 필요
- Spring Boot 2.x는 Spring Cloud Sleuth 사용

### 문제 3: Span이 너무 많이 생성됨

**증상**:
- 단순한 요청에 수십 개의 Span 생성
- Zipkin UI가 복잡함
- 성능 저하

**원인**:
- 자동 계측이 너무 세밀함 (모든 메서드 호출 추적)

**해결**:
```yaml
# application.yml
management:
  tracing:
    brave:
      # Span 생성 제외할 패턴
      skip-pattern: "/actuator.*|/health|/metrics"
```

### 문제 4: Kafka Consumer에서 Trace Context가 전파되지 않음

**증상**:
- Producer에서 Trace 생성됨
- Consumer에서 새로운 Trace ID 생성됨 (연결 안됨)

**원인**:
- Kafka Header에서 Trace Context 추출 실패

**해결**:

1. **Spring Kafka 버전 확인**:
- Spring Kafka 3.0+ 필요

2. **KafkaTemplate 설정 확인**:
```java
@Bean
public ProducerFactory<String, Object> producerFactory() {
    Map<String, Object> config = new HashMap<>();
    // ... 기본 설정
    return new DefaultKafkaProducerFactory<>(config);
}

@Bean
public KafkaTemplate<String, Object> kafkaTemplate(
        ProducerFactory<String, Object> producerFactory,
        ObservationRegistry observationRegistry) {

    KafkaTemplate<String, Object> template = new KafkaTemplate<>(producerFactory);
    // Observation 설정
    template.setObservationEnabled(true);
    return template;
}
```

3. **Consumer Factory 설정 확인**:
```java
@Bean
public ConsumerFactory<String, Object> consumerFactory() {
    Map<String, Object> config = new HashMap<>();
    // ... 기본 설정

    DefaultKafkaConsumerFactory<String, Object> factory =
        new DefaultKafkaConsumerFactory<>(config);

    // Observation 활성화
    factory.setObservationEnabled(true);
    return factory;
}
```

### 문제 5: 외부 API 호출이 추적되지 않음

**증상**:
- RestTemplate으로 외부 API 호출
- Span이 생성되지 않음

**해결**:

```java
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(
            RestTemplateBuilder builder,
            ObservationRegistry observationRegistry) {

        return builder
            // Observation 인터셉터 추가
            .observationRegistry(observationRegistry)
            .build();
    }
}
```

**또는 WebClient 사용** (권장):
```java
@Bean
public WebClient webClient(
        WebClient.Builder builder,
        ObservationRegistry observationRegistry) {

    return builder
        .observationRegistry(observationRegistry)
        .build();
}
```

---

## 참고 자료

### 내부 문서
- [메트릭 수집 (Prometheus)](./metrics-prometheus.md)
- [구조화된 로깅 (ELK)](./logging-elk.md)
- [시각화 (Grafana)](./visualization-grafana.md)
- [Stage 2 검증 리포트](../../docs/evidence/stage-2/validation-report.md)

### 외부 리소스
- [Zipkin 공식 문서](https://zipkin.io/)
- [Micrometer Tracing 문서](https://micrometer.io/docs/tracing)
- [Brave 문서](https://github.com/openzipkin/brave)
- [Spring Boot Observability](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html#actuator.micrometer-tracing)
- [B3 Propagation Specification](https://github.com/openzipkin/b3-propagation)

### 구현 파일 위치
- Micrometer Tracing 의존성: `/e-commerce/pom.xml:78-87`
- Zipkin 설정: `/e-commerce/src/main/resources/application.yml:100-102`
- Docker Compose: `/e-commerce/infrastructure/docker/docker-compose.yml:38-47`
- Logback 설정: `/e-commerce/src/main/resources/logback-spring.xml:10,20-21`
- Kafka Producer: `/e-commerce/src/main/java/com/sagaline/common/event/EventPublisher.java:33-37`
- Kafka Consumer: `/e-commerce/src/main/java/com/sagaline/order/consumer/OrderEventConsumer.java:34-39`

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-23
**작성자**: Claude (Design Documentation)
