# Stage 3.3: 비동기 처리 (Async Processing) - Kafka

## 문서 정보
- **작성일**: 2025-11-23
- **Stage**: 3.3 - Async Processing
- **구성 요소**: Apache Kafka 3.x, Spring Kafka
- **상태**: ✅ 구현 완료

---

## 목차
1. [개요](#개요)
2. [Kafka 아키텍처](#kafka-아키텍처)
3. [Event Topics](#event-topics)
4. [Event 구조](#event-구조)
5. [Event Publishing](#event-publishing)
6. [Event Consuming](#event-consuming)
7. [At-least-once Delivery](#at-least-once-delivery)
8. [Event-driven 패턴](#event-driven-패턴)
9. [메트릭 및 모니터링](#메트릭-및-모니터링)
10. [모범 사례](#모범-사례)
11. [트러블슈팅](#트러블슈팅)

---

## 개요

### 왜 비동기 처리인가?

**동기 처리의 문제점**:
```java
// 주문 생성 (동기)
public Order createOrder(OrderRequest request) {
    Order order = orderRepository.save(newOrder);          // 50ms

    sendOrderEmail(order);                                 // 200ms (외부 SMTP)
    sendSMS(order);                                        // 150ms (외부 SMS API)
    updateAnalytics(order);                                // 100ms
    notifyInventorySystem(order);                          // 80ms

    return order;  // Total: 580ms
}
```

**Total Response Time**: 580ms
- 사용자는 580ms 동안 대기
- 외부 서비스 장애 시 주문 생성 실패
- 높은 결합도 (Tight Coupling)

**비동기 처리 (Kafka)**:
```java
// 주문 생성 (비동기)
public Order createOrder(OrderRequest request) {
    Order order = orderRepository.save(newOrder);          // 50ms

    eventPublisher.publish("order-events",
        new OrderCreatedEvent(order));                     // 5ms

    return order;  // Total: 55ms
}

// 별도 Consumer에서 처리 (비동기)
@KafkaListener(topics = "order-events")
public void handleOrderEvent(OrderCreatedEvent event) {
    sendOrderEmail(event);
    sendSMS(event);
    updateAnalytics(event);
    notifyInventorySystem(event);
}
```

**Total Response Time**: 55ms (90% 감소!)
- 빠른 응답
- 외부 서비스 장애 영향 없음
- 낮은 결합도 (Loose Coupling)

### Event-driven Architecture

**장점**:
1. **Scalability**: Consumer 수평 확장
2. **Resilience**: 장애 격리
3. **Flexibility**: 새로운 Consumer 추가 용이
4. **Auditability**: Event 저장으로 감사 추적

**단점**:
1. **복잡도 증가**: 분산 시스템 관리
2. **Eventual Consistency**: 즉각적인 일관성 보장 안됨
3. **Debugging 어려움**: 비동기 흐름 추적

---

## Kafka 아키텍처

### 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│              Spring Boot Application                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                Producer (Publisher)                   │  │
│  │                                                       │  │
│  │  OrderService.createOrder()                           │  │
│  │    ↓                                                  │  │
│  │  eventPublisher.publish("order-events",               │  │
│  │                         OrderCreatedEvent)            │  │
│  │    ↓                                                  │  │
│  │  KafkaTemplate.send(topic, key, event)                │  │
│  └───────────────────┬───────────────────────────────────┘  │
└────────────────────┬─┴───────────────────────────────────────┘
                     │
                     │ TCP 9092
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Cluster                             │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Broker (sagaline-kafka)                  │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Topic: order-events (3 partitions)            │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │ │  │
│  │  │  │ Part 0  │ │ Part 1  │ │ Part 2  │           │ │  │
│  │  │  │ [msg1]  │ │ [msg2]  │ │ [msg3]  │           │ │  │
│  │  │  │ [msg4]  │ │ [msg5]  │ │ [msg6]  │           │ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘           │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Topic: user-events (3 partitions)             │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Topic: payment-events (3 partitions)          │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Topic: inventory-events (3 partitions)        │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Topic: notification-events (3 partitions)     │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Zookeeper (Metadata)                     │  │
│  │  - Broker coordination                                │  │
│  │  - Topic configuration                                │  │
│  │  - Consumer group offsets                             │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ TCP 9092 (Subscribe)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Spring Boot Application                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                Consumer (Listener)                    │  │
│  │                                                       │  │
│  │  @KafkaListener(topics = "order-events")              │  │
│  │  public void handleOrderEvent(OrderCreatedEvent e) {  │  │
│  │      sendEmail(e);                                    │  │
│  │      sendSMS(e);                                      │  │
│  │      updateAnalytics(e);                              │  │
│  │  }                                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Docker Compose 설정

```yaml
# Kafka
kafka:
  image: confluentinc/cp-kafka:7.5.0
  container_name: sagaline-kafka
  depends_on:
    - zookeeper
  ports:
    - "9092:9092"
  environment:
    KAFKA_BROKER_ID: 1
    KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
  networks:
    - sagaline-network

# Zookeeper
zookeeper:
  image: confluentinc/cp-zookeeper:7.5.0
  container_name: sagaline-zookeeper
  environment:
    ZOOKEEPER_CLIENT_PORT: 2181
    ZOOKEEPER_TICK_TIME: 2000
  ports:
    - "2181:2181"
  networks:
    - sagaline-network
```

**위치**: `/e-commerce/infrastructure/docker/docker-compose.yml:107-133`

### Application 설정

`application.yml`:
```yaml
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    consumer:
      group-id: sagaline-group
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "*"
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      acks: all
      retries: 3
    admin:
      auto-create: true
```

**위치**: `/e-commerce/src/main/resources/application.yml:52-67`

---

## Event Topics

### 5개 Event Topics

**KafkaConfig.java**:
```java
public static final String USER_EVENTS_TOPIC = "user-events";
public static final String ORDER_EVENTS_TOPIC = "order-events";
public static final String PAYMENT_EVENTS_TOPIC = "payment-events";
public static final String INVENTORY_EVENTS_TOPIC = "inventory-events";
public static final String NOTIFICATION_EVENTS_TOPIC = "notification-events";
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/config/KafkaConfig.java:16-20`

### Topic 설정

**Partition & Replica**:
```java
@Bean
public NewTopic orderEventsTopic() {
    return TopicBuilder.name(ORDER_EVENTS_TOPIC)
            .partitions(3)      // 3개 파티션
            .replicas(1)        // 1개 복제본 (개발 환경)
            .build();
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/config/KafkaConfig.java:34-38`

**설정 이유**:
- **3 partitions**: 병렬 처리 (3개 Consumer 동시 처리 가능)
- **1 replica**: 개발 환경 (프로덕션에서는 3 replicas 권장)

### Topic별 Event 타입

| Topic | Event Types | 용도 |
|-------|-------------|------|
| **user-events** | UserRegisteredEvent | 사용자 등록, 환영 이메일 |
| **order-events** | OrderCreatedEvent, OrderConfirmedEvent | 주문 생성, 확인, 알림 |
| **payment-events** | PaymentCompletedEvent | 결제 완료, 영수증 발송 |
| **inventory-events** | InventoryReservedEvent, InventoryReleasedEvent | 재고 예약, 해제 |
| **notification-events** | EmailEvent, SMSEvent | 이메일, SMS 발송 |

---

## Event 구조

### BaseEvent (추상 클래스)

```java
@Data
@NoArgsConstructor
public abstract class BaseEvent {
    private String eventId;           // UUID
    private String eventType;         // "OrderCreated", "PaymentCompleted"
    private LocalDateTime timestamp;  // Event 발생 시각
    private String source;            // "order-service", "payment-service"

    public BaseEvent(String eventType, String source) {
        this.eventId = UUID.randomUUID().toString();
        this.eventType = eventType;
        this.timestamp = LocalDateTime.now();
        this.source = source;
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/event/BaseEvent.java`

**필드 설명**:
- **eventId**: 이벤트 고유 식별자 (중복 방지, 추적)
- **eventType**: 이벤트 타입 (분류)
- **timestamp**: 이벤트 발생 시각 (순서, 감사)
- **source**: 이벤트 발행자 (추적, 디버깅)

### OrderCreatedEvent

```java
@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class OrderCreatedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;
    private String status;
    private List<OrderItemData> items;

    public OrderCreatedEvent(Long orderId, Long userId,
                              BigDecimal totalAmount,
                              String status,
                              List<OrderItemData> items) {
        super("OrderCreated", "order-service");
        this.orderId = orderId;
        this.userId = userId;
        this.totalAmount = totalAmount;
        this.status = status;
        this.items = items;
    }

    @Data
    @NoArgsConstructor
    public static class OrderItemData {
        private Long productId;
        private Integer quantity;
        private BigDecimal price;
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/order/event/OrderCreatedEvent.java`

**Kafka 메시지 예시**:
```json
{
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "OrderCreated",
  "timestamp": "2025-11-23T10:15:30",
  "source": "order-service",
  "orderId": 12345,
  "userId": 67890,
  "totalAmount": 50000,
  "status": "CREATED",
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "price": 25000
    }
  ]
}
```

---

## Event Publishing

### EventPublisher Service

```java
@Service
public class EventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final MeterRegistry meterRegistry;

    public void publish(String topic, BaseEvent event) {
        Timer.Sample sample = Timer.start(meterRegistry);

        try {
            CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(topic, event.getEventId(), event);

            future.whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event: topic={}, eventId={}, eventType={}",
                              topic, event.getEventId(), event.getEventType(), ex);

                    Counter.builder("kafka.events.published")
                            .tag("topic", topic)
                            .tag("event_type", event.getEventType())
                            .tag("status", "failed")
                            .register(meterRegistry)
                            .increment();
                } else {
                    log.info("Event published successfully: topic={}, eventId={}, partition={}, offset={}",
                             topic, event.getEventId(),
                             result.getRecordMetadata().partition(),
                             result.getRecordMetadata().offset());

                    Counter.builder("kafka.events.published")
                            .tag("topic", topic)
                            .tag("event_type", event.getEventType())
                            .tag("status", "success")
                            .register(meterRegistry)
                            .increment();

                    sample.stop(Timer.builder("kafka.publish.duration")
                                    .tag("topic", topic)
                                    .tag("event_type", event.getEventType())
                                    .register(meterRegistry));
                }
            });

        } catch (Exception e) {
            log.error("Error publishing event", e);

            Counter.builder("kafka.events.published")
                    .tag("topic", topic)
                    .tag("event_type", event.getEventType())
                    .tag("status", "error")
                    .register(meterRegistry)
                    .increment();
        }
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/event/EventPublisher.java:33-84`

### 사용 예시

**OrderService**:
```java
@Service
public class OrderService {

    private final EventPublisher eventPublisher;

    @Transactional
    public Order createOrder(OrderRequest request) {
        // 1. Order 생성
        Order order = orderRepository.save(newOrder);

        // 2. Event 발행
        OrderCreatedEvent event = new OrderCreatedEvent(
            order.getId(),
            order.getUserId(),
            order.getTotalAmount(),
            order.getStatus().toString(),
            mapToOrderItemData(order.getItems())
        );

        eventPublisher.publish(KafkaConfig.ORDER_EVENTS_TOPIC, event);

        // 3. Order 반환 (비동기로 알림 처리됨)
        return order;
    }
}
```

### 비동기 처리

**CompletableFuture**:
```java
CompletableFuture<SendResult<String, Object>> future =
    kafkaTemplate.send(topic, event.getEventId(), event);

future.whenComplete((result, ex) -> {
    // 비동기 콜백
    // 메인 스레드는 즉시 반환
});
```

**장점**:
- Non-blocking: 메인 스레드 차단 안함
- 빠른 응답: Kafka 전송 대기 안함
- 에러 처리: 콜백에서 실패 처리

---

## Event Consuming

### OrderEventConsumer

```java
@Service
@RequiredArgsConstructor
public class OrderEventConsumer {

    private final MeterRegistry meterRegistry;

    @KafkaListener(
            topics = KafkaConfig.ORDER_EVENTS_TOPIC,
            groupId = "order-notification-service",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleOrderEvent(@Payload Object event,
                                  @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
                                  @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                                  @Header(KafkaHeaders.OFFSET) long offset) {
        log.info("Received order event: topic={}, partition={}, offset={}, eventType={}",
                topic, partition, offset, event.getClass().getSimpleName());

        try {
            if (event instanceof OrderCreatedEvent) {
                handleOrderCreated((OrderCreatedEvent) event);
            } else if (event instanceof OrderConfirmedEvent) {
                handleOrderConfirmed((OrderConfirmedEvent) event);
            } else {
                log.warn("Unknown event type: {}", event.getClass().getSimpleName());
            }

            // Track successful processing
            Counter.builder("kafka.events.consumed")
                    .tag("topic", topic)
                    .tag("event_type", event.getClass().getSimpleName())
                    .tag("status", "success")
                    .register(meterRegistry)
                    .increment();

        } catch (Exception e) {
            log.error("Error processing order event", e);

            // Track failed processing
            Counter.builder("kafka.events.consumed")
                    .tag("topic", topic)
                    .tag("event_type", event.getClass().getSimpleName())
                    .tag("status", "failed")
                    .register(meterRegistry)
                    .increment();

            // In production, this would be sent to a dead letter queue
            throw e;
        }
    }

    private void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Processing OrderCreated event: orderId={}, userId={}, totalAmount={}",
                event.getOrderId(), event.getUserId(), event.getTotalAmount());

        // TODO: Send order confirmation email
        // TODO: Update analytics
        // TODO: Notify inventory service to reserve stock

        log.info("Order creation notification sent for orderId: {}", event.getOrderId());
    }

    private void handleOrderConfirmed(OrderConfirmedEvent event) {
        log.info("Processing OrderConfirmed event: orderId={}, userId={}, status={}",
                event.getOrderId(), event.getUserId(), event.getStatus());

        // TODO: Send order confirmation SMS
        // TODO: Update customer dashboard

        log.info("Order confirmation notification sent for orderId: {}", event.getOrderId());
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/order/consumer/OrderEventConsumer.java`

### Consumer Group

**groupId**: `sagaline-group`

**Consumer Group 동작**:
```
Topic: order-events (3 partitions)
  Partition 0: [msg1, msg4, msg7, ...]
  Partition 1: [msg2, msg5, msg8, ...]
  Partition 2: [msg3, msg6, msg9, ...]

Consumer Group: order-notification-service
  Consumer 1 → Partition 0
  Consumer 2 → Partition 1
  Consumer 3 → Partition 2
```

**확장**:
- Consumer 3개 → 각 파티션 1개씩 처리
- Consumer 6개 → 3개는 idle (파티션 수 제한)

---

## At-least-once Delivery

### Kafka 전달 보장

**3가지 보장 수준**:

1. **At-most-once**: 최대 1번 (손실 가능)
2. **At-least-once**: 최소 1번 (중복 가능)
3. **Exactly-once**: 정확히 1번 (Kafka Transactions)

**Sagaline 설정**: At-least-once

### Producer 설정

```yaml
spring:
  kafka:
    producer:
      acks: all         # 모든 replica 확인
      retries: 3        # 실패 시 3번 재시도
```

**acks 옵션**:
- `acks=0`: 전송만 (응답 대기 안함, 빠름, 손실 가능)
- `acks=1`: Leader만 확인 (중간)
- `acks=all`: 모든 replica 확인 (느림, 안전)

### Consumer Offset 관리

**자동 커밋** (기본):
```yaml
spring:
  kafka:
    consumer:
      enable-auto-commit: true
      auto-commit-interval: 5000ms
```

**수동 커밋** (프로덕션 권장):
```java
@KafkaListener(topics = "order-events")
public void handleEvent(ConsumerRecord<String, Object> record,
                         Acknowledgment ack) {
    try {
        processEvent(record.value());
        ack.acknowledge();  // 명시적 커밋
    } catch (Exception e) {
        // 커밋 안함 → 재처리
    }
}
```

### 멱등성 (Idempotency)

**중복 처리 방지**:
```java
@Transactional
public void handleOrderCreated(OrderCreatedEvent event) {
    // eventId로 중복 확인
    if (processedEvents.contains(event.getEventId())) {
        log.info("Event already processed: {}", event.getEventId());
        return;
    }

    // 비즈니스 로직 처리
    sendEmail(event);
    sendSMS(event);

    // 처리 완료 기록
    processedEvents.add(event.getEventId());
}
```

---

## Event-driven 패턴

### 1. Event Notification

**사용 사례**: 상태 변화 알림

```java
// Publisher
orderEventPublisher.publish("order-events",
    new OrderCreatedEvent(order));

// Consumer
@KafkaListener(topics = "order-events")
public void sendNotification(OrderCreatedEvent event) {
    emailService.sendOrderConfirmation(event);
}
```

### 2. Event-carried State Transfer

**사용 사례**: 데이터 복제, 캐시 갱신

```java
// Event에 전체 상태 포함
public class OrderCreatedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;
    private List<OrderItemData> items;  // 전체 상태
}

// Consumer가 로컬 데이터 유지
@KafkaListener(topics = "order-events")
public void updateLocalCache(OrderCreatedEvent event) {
    cache.put(event.getOrderId(), event);
}
```

### 3. Event Sourcing (향후 구현)

**이벤트를 진실의 원천(Source of Truth)으로 사용**

```java
// 모든 상태 변화를 Event로 저장
OrderCreatedEvent
OrderConfirmedEvent
OrderShippedEvent
OrderDeliveredEvent

// 현재 상태 = 모든 Event 재생 결과
Order currentState = events.stream()
    .reduce(new Order(), (order, event) -> event.apply(order));
```

### 4. CQRS (향후 구현)

**Command Query Responsibility Segregation**

```
Write Model (Command):
  createOrder() → OrderCreatedEvent → Kafka

Read Model (Query):
  Kafka Consumer → Update Read DB (Elasticsearch)
  getOrders() → Query Elasticsearch (빠른 검색)
```

---

## 메트릭 및 모니터링

### Custom Metrics

**EventPublisher**:
```java
Counter.builder("kafka.events.published")
        .tag("topic", topic)
        .tag("event_type", event.getEventType())
        .tag("status", "success")  // or "failed", "error"
        .register(meterRegistry)
        .increment();

Timer.builder("kafka.publish.duration")
        .tag("topic", topic)
        .tag("event_type", event.getEventType())
        .register(meterRegistry)
        .record(duration);
```

**OrderEventConsumer**:
```java
Counter.builder("kafka.events.consumed")
        .tag("topic", topic)
        .tag("event_type", event.getClass().getSimpleName())
        .tag("status", "success")  // or "failed"
        .register(meterRegistry)
        .increment();
```

### Prometheus Queries

**Event 발행 속도**:
```promql
rate(kafka_events_published_total[5m])
```

**Event 소비 속도**:
```promql
rate(kafka_events_consumed_total[5m])
```

**Event 발행 실패율**:
```promql
rate(kafka_events_published_total{status="failed"}[5m]) /
rate(kafka_events_published_total[5m]) * 100
```

**평균 발행 시간**:
```promql
rate(kafka_publish_duration_seconds_sum[5m]) /
rate(kafka_publish_duration_seconds_count[5m])
```

### Grafana Dashboard

**패널**:
1. Event Publish Rate (by topic)
2. Event Consume Rate (by topic)
3. Event Failure Rate
4. Kafka Lag (Consumer Offset vs Log End Offset)

---

## 모범 사례

### 1. Event Naming Convention

**명확하고 일관된 이름**:
```
✅ OrderCreatedEvent
✅ PaymentCompletedEvent
✅ UserRegisteredEvent

❌ OrderEvent
❌ Payment
❌ NewUser
```

### 2. Event Versioning

**Event 스키마 변경 시**:
```java
// v1
public class OrderCreatedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;
}

// v2 (필드 추가)
public class OrderCreatedEventV2 extends BaseEvent {
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;
    private String shippingAddress;  // 새 필드
}

// Consumer에서 버전 처리
if (event instanceof OrderCreatedEventV2) {
    handleV2((OrderCreatedEventV2) event);
} else {
    handleV1((OrderCreatedEvent) event);
}
```

### 3. Dead Letter Queue (DLQ)

**처리 실패 Event 저장** (향후 구현):
```java
@KafkaListener(topics = "order-events")
public void handleEvent(ConsumerRecord<String, Object> record) {
    try {
        processEvent(record.value());
    } catch (Exception e) {
        // DLQ로 전송
        kafkaTemplate.send("order-events-dlq", record);
        log.error("Event sent to DLQ", e);
    }
}
```

### 4. Event 최소화

**필요한 데이터만 포함**:
```java
// ❌ 나쁜 예: 전체 엔티티
public class OrderCreatedEvent extends BaseEvent {
    private Order order;  // 불필요한 데이터 많음
}

// ✅ 좋은 예: 필요한 필드만
public class OrderCreatedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;
}
```

### 5. Partition Key 전략

**순서 보장이 필요한 경우**:
```java
// userId를 key로 사용 → 같은 사용자 Event는 같은 파티션
eventPublisher.publish("order-events",
                        event.getUserId().toString(),  // key
                        event);
```

---

## 트러블슈팅

### 문제 1: Kafka 연결 실패

**증상**:
```
org.apache.kafka.common.errors.TimeoutException:
  Failed to update metadata after 60000 ms
```

**해결**:
```bash
# Kafka 상태 확인
docker ps | grep kafka

# Kafka 로그 확인
docker logs sagaline-kafka

# Kafka 토픽 확인
docker exec sagaline-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### 문제 2: Event가 소비되지 않음

**증상**: Producer는 정상, Consumer 로그 없음

**원인**: Consumer Group ID 충돌 또는 Offset 문제

**해결**:
```bash
# Consumer Group 확인
docker exec sagaline-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe --group sagaline-group

# Offset 리셋
docker exec sagaline-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group sagaline-group \
  --reset-offsets --to-earliest --topic order-events --execute
```

### 문제 3: Lag 증가

**증상**: Consumer Lag 지속 증가

**원인**:
- Consumer 처리 속도 < Producer 발행 속도
- Consumer 에러로 중단

**해결**:
1. **Consumer 확장**: Partition 수 증가 + Consumer 추가
2. **배치 처리**: 여러 메시지 한번에 처리
3. **처리 최적화**: 느린 로직 개선

### 문제 4: 중복 소비

**증상**: 같은 Event가 여러 번 처리됨

**원인**: At-least-once 보장

**해결**:
```java
// Idempotency 구현
@Transactional
public void handleEvent(OrderCreatedEvent event) {
    // eventId로 중복 확인
    if (eventProcessingRepository.existsByEventId(event.getEventId())) {
        log.info("Event already processed: {}", event.getEventId());
        return;
    }

    // 비즈니스 로직
    processEvent(event);

    // 처리 기록 저장
    eventProcessingRepository.save(new EventProcessing(event.getEventId()));
}
```

### 문제 5: Serialization 오류

**증상**:
```
com.fasterxml.jackson.databind.exc.InvalidDefinitionException:
  No serializer found for class ...
```

**해결**:
```java
// DTO에 기본 생성자 추가
@NoArgsConstructor
public class OrderCreatedEvent extends BaseEvent {
    // ...
}

// Kafka 설정에서 trusted packages 설정
spring:
  kafka:
    consumer:
      properties:
        spring.json.trusted.packages: "*"
```

---

## 참고 자료

### 내부 문서
- [검색 (Elasticsearch)](./search-elasticsearch.md)
- [캐싱 (Redis)](./caching-redis.md)
- [분산 추적 (Zipkin)](../stage2/tracing-zipkin.md)

### 외부 리소스
- [Apache Kafka 공식 문서](https://kafka.apache.org/documentation/)
- [Spring for Apache Kafka](https://docs.spring.io/spring-kafka/docs/current/reference/html/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)

### 구현 파일 위치
- KafkaConfig: `/e-commerce/src/main/java/com/sagaline/common/config/KafkaConfig.java`
- EventPublisher: `/e-commerce/src/main/java/com/sagaline/common/event/EventPublisher.java`
- BaseEvent: `/e-commerce/src/main/java/com/sagaline/common/event/BaseEvent.java`
- OrderCreatedEvent: `/e-commerce/src/main/java/com/sagaline/order/event/OrderCreatedEvent.java`
- OrderEventConsumer: `/e-commerce/src/main/java/com/sagaline/order/consumer/OrderEventConsumer.java`
- Application Config: `/e-commerce/src/main/resources/application.yml:52-67`

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-23
**작성자**: Claude (Design Documentation)
