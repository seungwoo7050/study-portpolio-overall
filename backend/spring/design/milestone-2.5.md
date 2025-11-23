# Kafka 비동기 이벤트 처리 설계 일지 (Milestone 2.5)
> Kafka를 이용한 이벤트 기반 아키텍처와 비동기 처리 패턴을 구현한 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 2.4까지의 동기 처리 패턴 위에 **Kafka 기반 비동기 이벤트 처리**를 추가한다:
- 도메인 이벤트 발행 (Producer)
- 별도 Consumer에서 비동기 처리
- 이벤트 기반 느슨한 결합
- 백로그 처리 및 재시작 내성

간단한 주문/알림 도메인을 통해 **이벤트 스트리밍 패턴**을 학습한다.

### 1.2 기능 요구사항

#### 1.2.1 도메인 모델

**Order (주문)**
- `id`: Long (PK)
- `userId`: Long
- `totalAmount`: BigDecimal
- `status`: Enum (PENDING, PAID, CANCELLED)
- `createdAt`: LocalDateTime

**OrderItem (주문 항목)**
- `id`: Long (PK)
- `orderId`: Long (FK)
- `productId`: Long
- `quantity`: Integer
- `price`: BigDecimal

**Notification (알림)**
- `id`: Long (PK)
- `userId`: Long
- `type`: Enum (ORDER_CREATED, ORDER_PAID, ORDER_CANCELLED)
- `message`: String
- `createdAt`: LocalDateTime

#### 1.2.2 Kafka 이벤트

**토픽:** `order-events`
**파티션:** 3
**레플리카:** 1 (로컬 개발)

**이벤트 스키마:**
```json
{
  "eventId": "uuid",
  "eventType": "ORDER_CREATED",
  "timestamp": "2025-01-30T10:15:30.123Z",
  "orderId": 123,
  "userId": 45,
  "totalAmount": 50000.00
}
```

**이벤트 타입:**
- `ORDER_CREATED`: 주문 생성 시
- `ORDER_PAID`: 결제 완료 시 (선택)
- `ORDER_CANCELLED`: 주문 취소 시 (선택)

#### 1.2.3 API 엔드포인트

**주문 API (Producer):**
- `POST /api/orders` - 주문 생성 (DB 저장 + 이벤트 발행)
- `GET /api/orders/{id}` - 주문 조회
- `GET /api/orders` - 내 주문 목록

**알림 API:**
- `GET /api/notifications` - 내 알림 목록

### 1.3 비기능 요구사항

#### 1.3.1 비동기 특성
- 주문 API 응답은 이벤트 처리와 분리
  - 주문 생성 성공 → 즉시 201 반환
  - 알림은 약간 늦게 처리 (수백 ms ~ 수초)

#### 1.3.2 내결함성
- Consumer 중단/재시작 시 이벤트 백로그 처리
- 중복 이벤트 처리 (멱등성, 선택)
- 오류 발생 시 재시도 (Kafka 자동 재시도)

#### 1.3.3 확장성
- 토픽 파티션으로 병렬 처리 가능
- Consumer 인스턴스 추가로 처리량 확대

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 비동기 이벤트 처리인가?

**동기 처리의 한계:**
```java
// 동기 버전
@Transactional
public OrderResponse createOrder(...) {
    Order order = orderRepository.save(order);

    // 알림 전송 (이메일, SMS)
    notificationService.sendEmail(order.getUserId(), "주문 완료");

    return OrderResponse.from(order);
}
```

**문제:**
- 알림 전송 실패 시 주문 트랜잭션 롤백?
- 알림 전송이 느리면 API 응답 지연
- 주문과 알림의 **강한 결합**

**비동기 버전:**
```java
// Producer
@Transactional
public OrderResponse createOrder(...) {
    Order order = orderRepository.save(order);

    // 이벤트만 발행 (빠름)
    kafkaTemplate.send("order-events", OrderEvent.from(order));

    return OrderResponse.from(order);  // 즉시 반환
}

// Consumer (별도 스레드/프로세스)
@KafkaListener(topics = "order-events")
public void handleOrderCreated(OrderEvent event) {
    // 알림 처리 (느려도 괜찮음)
    notificationService.sendEmail(event.getUserId(), "주문 완료");
}
```

**장점:**
- 주문 API 응답 빠름 (이벤트 발행만)
- 알림 실패가 주문에 영향 없음
- **느슨한 결합**: 주문과 알림 독립적

### 2.2 왜 Kafka인가?

**대안 비교:**

| 방식 | 장점 | 단점 | 선택 이유 |
|------|------|------|-----------|
| Kafka | 고성능, 영속성, 재처리 가능 | 운영 복잡도 | **선택**: 표준 기술 |
| RabbitMQ | 설정 간단, 메시지 큐 패턴 | 영속성 약함 | 단순 메시징용 |
| Redis Pub/Sub | 매우 빠름, 가벼움 | 영속성 없음, 재처리 불가 | 실시간 알림용 |

**Kafka의 핵심 특징:**
- **영속성**: 디스크에 저장 → Consumer 재시작 후에도 처리 가능
- **파티션**: 병렬 처리
- **오프셋**: 처리 위치 추적 → 재처리 가능

### 2.3 이벤트 발행 시점

**선택지:**
1. **트랜잭션 내 발행**: DB 저장 후 즉시 발행
   - 문제: DB 롤백 시 이미 발행된 이벤트 처리됨
2. **트랜잭션 커밋 후 발행**: `@TransactionalEventListener`
   - 장점: DB 커밋 보장 후 발행
   - 단점: 발행 실패 시 처리 복잡

**우리의 선택: 트랜잭션 내 발행 (간단 버전)**
- 이유: 학습 목적, 단순성
- 트레이드오프: 롤백 시 이벤트 중복 처리 가능 (멱등성으로 해결)

---

## 3. Kafka 설정 및 인프라

### 3.1 Spring Boot 설정

**build.gradle (의존성 추가):**
```gradle
dependencies {
    implementation 'org.springframework.kafka:spring-kafka'
    testImplementation 'org.springframework.kafka:spring-kafka-test'
}
```

**application.yml:**
```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092

    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer

    consumer:
      group-id: notification-consumer-group
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "*"
```

**설계 포인트:**
- **JsonSerializer**: 객체를 JSON으로 직렬화
- **auto-offset-reset: earliest**: 처음부터 읽기 (백로그 처리)
- **trusted.packages**: 역직렬화 보안 설정

### 3.2 토픽 생성 (자동 또는 수동)

**자동 생성 설정:**
```java
@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic orderEventsTopic() {
        return TopicBuilder.name("order-events")
            .partitions(3)
            .replicas(1)
            .build();
    }
}
```

**수동 생성 (kafka-topics.sh):**
```bash
kafka-topics.sh --create \
  --topic order-events \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

---

## 4. 이벤트 모델 및 Producer 설계

### 4.1 OrderEvent

**파일:** `order/event/OrderEvent.java`

```java
public class OrderEvent {

    private String eventId;        // UUID
    private String eventType;      // ORDER_CREATED, ORDER_PAID 등
    private Instant timestamp;     // 이벤트 발생 시각
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;

    public OrderEvent() {
        this.eventId = UUID.randomUUID().toString();
        this.timestamp = Instant.now();
    }

    public OrderEvent(String eventType, Long orderId, Long userId, BigDecimal totalAmount) {
        this();
        this.eventType = eventType;
        this.orderId = orderId;
        this.userId = userId;
        this.totalAmount = totalAmount;
    }

    // Getters, Setters
}
```

**설계 포인트:**
- **eventId**: 중복 처리 방지용 고유 ID
- **timestamp**: 이벤트 순서 추적
- **eventType**: 다형성 (여러 이벤트 타입)

### 4.2 OrderService (Producer)

**파일:** `order/service/OrderService.java`

```java
@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private static final String ORDER_EVENTS_TOPIC = "order-events";

    private final OrderRepository orderRepository;
    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;

    public OrderService(OrderRepository orderRepository,
                        KafkaTemplate<String, OrderEvent> kafkaTemplate) {
        this.orderRepository = orderRepository;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Transactional
    public OrderResponse createOrder(Long userId, CreateOrderRequest request) {
        // 1. 주문 생성
        Order order = new Order();
        order.setUserId(userId);

        // 2. 주문 항목 추가
        for (OrderItemRequest itemRequest : request.getItems()) {
            OrderItem item = new OrderItem();
            item.setProductId(itemRequest.getProductId());
            item.setQuantity(itemRequest.getQuantity());
            item.setPrice(itemRequest.getPrice());
            order.addItem(item);
        }

        // 3. 총액 계산
        order.calculateTotalAmount();

        // 4. DB 저장
        Order savedOrder = orderRepository.save(order);

        // 5. 이벤트 발행
        publishOrderCreatedEvent(savedOrder);

        logger.info("Order created: orderId={}, userId={}, totalAmount={}",
                    savedOrder.getId(), savedOrder.getUserId(), savedOrder.getTotalAmount());

        return new OrderResponse(savedOrder);
    }

    private void publishOrderCreatedEvent(Order order) {
        try {
            OrderEvent event = new OrderEvent(
                "ORDER_CREATED",
                order.getId(),
                order.getUserId(),
                order.getTotalAmount()
            );

            // Kafka 발행 (key: orderId, value: event)
            kafkaTemplate.send(ORDER_EVENTS_TOPIC, String.valueOf(order.getId()), event);

            logger.info("Published ORDER_CREATED event: eventId={}, orderId={}",
                        event.getEventId(), order.getId());
        } catch (Exception e) {
            logger.error("Failed to publish ORDER_CREATED event for orderId={}", order.getId(), e);
            // 프로덕션: 재시도 큐 또는 Dead Letter Queue
        }
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return new OrderResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getUserOrders(Long userId) {
        List<Order> orders = orderRepository.findByUserId(userId);
        return orders.stream()
            .map(OrderResponse::new)
            .collect(Collectors.toList());
    }
}
```

**설계 포인트:**
- **@Transactional**: DB 저장과 이벤트 발행을 하나의 트랜잭션으로
- **KafkaTemplate.send()**: 키(orderId), 값(event) 전송
  - 키: 동일 주문 이벤트는 같은 파티션으로 (순서 보장)
- **예외 처리**: 발행 실패 시 로그, 프로덕션에서는 재시도 큐

---

## 5. Consumer 설계

### 5.1 OrderEventListener (Notification Consumer)

**파일:** `order/listener/OrderEventListener.java`

```java
@Component
public class OrderEventListener {

    private static final Logger logger = LoggerFactory.getLogger(OrderEventListener.class);

    private final NotificationService notificationService;

    public OrderEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @KafkaListener(
        topics = "order-events",
        groupId = "notification-consumer-group",
        containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleOrderEvent(OrderEvent event) {
        logger.info("Received event: eventId={}, eventType={}, orderId={}",
                    event.getEventId(), event.getEventType(), event.getOrderId());

        try {
            if ("ORDER_CREATED".equals(event.getEventType())) {
                handleOrderCreated(event);
            } else if ("ORDER_PAID".equals(event.getEventType())) {
                handleOrderPaid(event);
            }
            // 다른 이벤트 타입...

        } catch (Exception e) {
            logger.error("Error handling event: {}", event.getEventId(), e);
            // 예외 재발생 시 Kafka가 재시도
            throw e;
        }
    }

    private void handleOrderCreated(OrderEvent event) {
        logger.info("Processing ORDER_CREATED: orderId={}", event.getOrderId());

        // 알림 생성
        notificationService.createNotification(
            event.getUserId(),
            "ORDER_CREATED",
            String.format("주문이 생성되었습니다. 주문번호: %d, 금액: %s원",
                          event.getOrderId(), event.getTotalAmount())
        );

        // 이메일 발송 시뮬레이션
        logger.info("Email sent to userId={}: Order {} created", event.getUserId(), event.getOrderId());
    }

    private void handleOrderPaid(OrderEvent event) {
        // 결제 완료 알림
        logger.info("Processing ORDER_PAID: orderId={}", event.getOrderId());
        // ...
    }
}
```

**설계 포인트:**
- **@KafkaListener**: 토픽 구독
  - `topics`: 구독할 토픽
  - `groupId`: Consumer Group (여러 인스턴스 간 부하 분산)
- **멱등성**: 동일 eventId 중복 처리 방지 (선택적, eventId 저장)
- **예외 처리**: 예외 재발생 시 Kafka가 재시도

### 5.2 NotificationService

**파일:** `order/service/NotificationService.java`

```java
@Service
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void createNotification(Long userId, String type, String message) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setMessage(message);
        notificationRepository.save(notification);
    }

    public List<NotificationResponse> getUserNotifications(Long userId) {
        return notificationRepository.findByUserId(userId).stream()
            .map(NotificationResponse::from)
            .collect(Collectors.toList());
    }
}
```

---

## 6. Controller 계층

### 6.1 OrderController

```java
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        OrderResponse response = orderService.createOrder(userId, request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderResponse> getOrder(@PathVariable Long id) {
        OrderResponse order = orderService.getOrder(id);
        return ResponseEntity.ok(order);
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> getMyOrders(Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        List<OrderResponse> orders = orderService.getUserOrders(userId);
        return ResponseEntity.ok(orders);
    }
}
```

### 6.2 NotificationController

```java
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getMyNotifications(
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        List<NotificationResponse> notifications = notificationService.getUserNotifications(userId);

        return ResponseEntity.ok(notifications);
    }
}
```

---

## 7. 테스트 전략

### 7.1 Kafka 통합 테스트

**EmbeddedKafka 사용:**
```java
@SpringBootTest
@EmbeddedKafka(
    partitions = 1,
    topics = {"order-events"},
    brokerProperties = {"listeners=PLAINTEXT://localhost:9093", "port=9093"}
)
class OrderKafkaIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private KafkaTemplate<String, OrderEvent> kafkaTemplate;

    @Test
    void createOrder_이벤트발행_알림생성() throws Exception {
        // Given
        CreateOrderRequest request = new CreateOrderRequest();
        request.setItems(List.of(
            new OrderItemRequest(1L, 2, BigDecimal.valueOf(100))
        ));

        // When: 주문 생성 (이벤트 발행)
        OrderResponse order = orderService.createOrder(1L, request);

        // Then: 알림이 비동기로 생성됨 (최대 5초 대기)
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            List<Notification> notifications = notificationRepository.findByUserId(1L);
            assertThat(notifications).hasSize(1);
            assertThat(notifications.get(0).getType()).isEqualTo("ORDER_CREATED");
        });
    }

    @Test
    void orderEventListener_이벤트수신_알림생성() throws Exception {
        // Given: 이벤트 직접 발행
        OrderEvent event = new OrderEvent("ORDER_CREATED", 100L, 1L, BigDecimal.valueOf(50000));

        // When
        kafkaTemplate.send("order-events", String.valueOf(event.getOrderId()), event);

        // Then: Consumer가 처리
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            List<Notification> notifications = notificationRepository.findByUserId(1L);
            assertThat(notifications).isNotEmpty();
        });
    }
}
```

**설계 포인트:**
- **@EmbeddedKafka**: 테스트용 인메모리 Kafka
- **Awaitility**: 비동기 처리 대기 (polling)
- **untilAsserted()**: 조건 만족까지 반복 확인

### 7.2 Consumer 단위 테스트

**OrderEventListenerTest:**
```java
@SpringBootTest
@Transactional
class OrderEventListenerTest {

    @Autowired
    private OrderEventListener listener;

    @Autowired
    private NotificationRepository notificationRepository;

    @Test
    void handleOrderEvent_ORDER_CREATED_알림생성() {
        // Given
        OrderEvent event = new OrderEvent("ORDER_CREATED", 1L, 1L, BigDecimal.valueOf(100));

        // When
        listener.handleOrderEvent(event);

        // Then
        List<Notification> notifications = notificationRepository.findByUserId(1L);
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).getMessage()).contains("주문이 생성되었습니다");
    }
}
```

---

## 8. 완료 기준 및 검증

### 8.1 로컬 검증

**1. Kafka 시작:**
```bash
# docker-compose.yml로 Kafka 실행
docker-compose up -d kafka zookeeper
```

**2. 주문 생성:**
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 1, "quantity": 2, "price": 100.00}
    ]
  }'

# 응답: 즉시 201 Created
```

**3. 알림 확인 (비동기):**
```bash
# 1~2초 후
curl http://localhost:8080/api/notifications \
  -H "Authorization: Bearer <TOKEN>"

# 응답: [{"type":"ORDER_CREATED", "message":"주문이 생성되었습니다..."}]
```

**4. Kafka 메시지 확인:**
```bash
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic order-events \
  --from-beginning
```

### 8.2 완료 체크리스트

- [x] Order, OrderItem, Notification 엔티티
- [x] OrderEvent 모델
- [x] Kafka 토픽 설정 (order-events)
- [x] OrderService (Producer, 이벤트 발행)
- [x] OrderEventListener (Consumer, 알림 생성)
- [x] NotificationService
- [x] Kafka 통합 테스트 (EmbeddedKafka + Awaitility)
- [x] 비동기 처리 확인 (주문 → 알림 플로우)
- [x] Consumer 재시작 후 백로그 처리 확인
- [x] CI 파이프라인에서 테스트 통과

---

## 9. 설계 결정 사항 및 트레이드오프

### 9.1 트랜잭션 내 발행 vs TransactionalEventListener

| 방식 | 장점 | 단점 | 선택 이유 |
|------|------|------|-----------|
| 트랜잭션 내 | 간단 | 롤백 시 이벤트 중복 | **선택**: 학습 목적 |
| @TransactionalEventListener | DB 커밋 후 발행 | 발행 실패 처리 복잡 | 프로덕션 권장 |

### 9.2 동기 vs 비동기 Consumer

**선택: 동기 (기본 Kafka Listener)**
- 메시지 하나씩 순차 처리
- **대안**: `@Async` + 스레드풀로 병렬 처리

### 9.3 멱등성 처리

**현재: 미구현**
- 개선: eventId를 DB에 저장, 중복 체크

---

## 10. 알려진 제약 & 향후 개선점

### 10.1 현재 제약

1. **멱등성 보장 부족**
   - Consumer 재시도 시 알림 중복 생성 가능
   - 개선: eventId 기반 중복 체크

2. **Dead Letter Queue 없음**
   - Consumer 에러 시 무한 재시도
   - 개선: DLQ 토픽으로 실패 이벤트 이동

3. **순서 보장 제한적**
   - 동일 파티션 내에서만 순서 보장
   - 개선: 주문 ID 기반 키 파티셔닝

4. **모니터링 부족**
   - Consumer Lag 추적 없음
   - 개선: Prometheus + Grafana

### 10.2 향후 확장 방향

**이벤트 소싱:**
- 모든 상태 변경을 이벤트로 저장
- Event Store + CQRS 패턴

**Saga 패턴:**
- 분산 트랜잭션 (주문 → 결제 → 배송)
- Choreography vs Orchestration

**스트림 처리:**
- Kafka Streams로 실시간 집계
- 주문 금액 합산, 이상 탐지 등

---

## 11. 결론

Milestone 2.5에서 확립한 것:
- ✅ Kafka Producer/Consumer 패턴
- ✅ 이벤트 기반 비동기 처리
- ✅ 느슨한 결합 (주문 ↔ 알림)
- ✅ 백로그 처리 및 재시작 내성
- ✅ EmbeddedKafka 통합 테스트

**핵심 성과:**
- **이벤트 스트리밍 아키텍처** 기초 학습
- 동기 → 비동기 전환의 **설계 트레이드오프** 이해
- 이후 마이크로서비스, Event Sourcing 기반 마련

**전체 훈련 완료 (Milestone 2.0 ~ 2.5):**
- ✅ 2.0: Spring Boot 부트스트랩 & CI
- ✅ 2.1: 레이어드 CRUD & JWT 인증
- ✅ 2.2: 팀 & RBAC
- ✅ 2.3: 배치, 통계, 캐시, 외부 API
- ✅ 2.4: Elasticsearch 검색
- ✅ 2.5: Kafka 비동기 이벤트

**다음 단계 (Sagaline 이커머스):**
- 실제 프로덕트 규모 프로젝트
- 마이크로서비스 아키텍처
- 분산 트랜잭션, CQRS, Event Sourcing
- Kubernetes 배포, Observability
