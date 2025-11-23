# 장바구니 & 주문 관리 시스템 설계 일지 (Cart & Order Domain)
> 이벤트 기반 주문 처리 및 상태 관리 시스템 설계

## 1. 문제 정의 & 요구사항

### 1.1 목표

안정적인 장바구니 및 주문 처리 시스템 구축:
- 사용자별 장바구니 관리
- 장바구니에서 주문으로 전환
- 주문 상태 라이프사이클 관리
- Kafka 기반 이벤트 기반 아키텍처
- 주문 추적 및 내역 조회

### 1.2 기능 요구사항

#### 1.2.1 장바구니 (Cart)
- 상품 추가/삭제/수량 변경
- 장바구니 조회 (사용자별)
- 장바구니 총액 계산
- 장바구니 초기화
- 주문 후 자동 초기화

#### 1.2.2 주문 (Order)
- 장바구니에서 주문 생성
- 주문 상태 관리:
  - PENDING (대기)
  - CONFIRMED (확인)
  - SHIPPED (배송 중)
  - DELIVERED (배송 완료)
  - CANCELLED (취소)
- 주문 내역 조회 (사용자별)
- 주문 상세 조회
- 배송 주소 입력

#### 1.2.3 이벤트 기반 처리
- `OrderCreatedEvent`: 주문 생성 시
- `OrderConfirmedEvent`: 주문 확인 시
- 이벤트 소비자: 알림, 분석, 재고 관리 (향후)

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 장바구니 조회: p99 < 100ms
- 주문 생성: p99 < 500ms
- 주문 조회: p99 < 200ms

#### 1.3.2 일관성
- 주문 생성은 트랜잭션으로 원자성 보장
- 장바구니 초기화는 주문 성공 시에만
- 이벤트 발행 실패 시 재시도

#### 1.3.3 가용성
- 이벤트 처리 실패 시에도 주문 유지
- 비동기 처리로 응답 시간 단축

---

## 2. 도메인 모델 설계

### 2.1 엔티티 구조

#### 2.1.1 Cart 엔티티
```java
@Entity
@Table(name = "carts")
public class Cart {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;  // 1:1 관계

    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CartItem> items = new ArrayList<>();

    @Column(name = "total_amount")
    private Long totalAmount = 0L;

    @Column(name = "total_items")
    private Integer totalItems = 0;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 비즈니스 로직
    public void addItem(CartItem item) {
        items.add(item);
        item.setCart(this);
        recalculateTotals();
    }

    public void removeItem(CartItem item) {
        items.remove(item);
        item.setCart(null);
        recalculateTotals();
    }

    public void clear() {
        items.clear();
        totalAmount = 0L;
        totalItems = 0;
    }

    private void recalculateTotals() {
        totalAmount = items.stream()
            .mapToLong(item -> item.getPrice() * item.getQuantity())
            .sum();
        totalItems = items.stream()
            .mapToInt(CartItem::getQuantity)
            .sum();
    }
}
```

**설계 결정:**
- `userId`: 유니크 제약으로 사용자당 1개 장바구니
- `items`: Cascade ALL + orphanRemoval로 자동 관리
- `totalAmount`, `totalItems`: 계산된 값을 캐싱 (성능 최적화)
- `recalculateTotals()`: 도메인 로직 (금액 계산)

#### 2.1.2 CartItem 엔티티
```java
@Entity
@Table(name = "cart_items")
public class CartItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;

    @Column(name = "product_id", nullable = false)
    private Long productId;  // FK 대신 ID만 저장

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Long price;  // 주문 시점 가격 저장

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

**설계 결정:**
- `productId`: 외래키 대신 ID만 저장 (느슨한 결합)
- `price`: 주문 시점 가격을 저장 (가격 변동 대응)

#### 2.1.3 Order 엔티티
```java
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private List<OrderItem> items = new ArrayList<>();

    @Column(name = "total_amount", nullable = false)
    private Long totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Column(name = "shipping_address", columnDefinition = "TEXT")
    private String shippingAddress;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 팩토리 메서드
    public static Order fromCart(Cart cart, Long userId, String shippingAddress) {
        Order order = new Order();
        order.setUserId(userId);
        order.setTotalAmount(cart.getTotalAmount());
        order.setStatus(OrderStatus.PENDING);
        order.setShippingAddress(shippingAddress);

        // CartItem → OrderItem 변환
        for (CartItem cartItem : cart.getItems()) {
            OrderItem orderItem = OrderItem.builder()
                .order(order)
                .productId(cartItem.getProductId())
                .quantity(cartItem.getQuantity())
                .price(cartItem.getPrice())
                .build();
            order.items.add(orderItem);
        }

        return order;
    }

    public void updateStatus(OrderStatus newStatus) {
        this.status = newStatus;
        this.updatedAt = LocalDateTime.now();
    }
}
```

#### 2.1.4 OrderItem 엔티티
```java
@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Long price;  // 주문 시점 가격 (불변)

    private LocalDateTime createdAt;
}
```

#### 2.1.5 OrderStatus Enum
```java
public enum OrderStatus {
    PENDING,      // 주문 생성 (결제 대기)
    CONFIRMED,    // 주문 확인 (결제 완료)
    SHIPPED,      // 배송 시작
    DELIVERED,    // 배송 완료
    CANCELLED     // 주문 취소
}
```

### 2.2 데이터베이스 스키마

```sql
CREATE TABLE carts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
    total_amount BIGINT DEFAULT 0,
    total_items INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    price BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    total_amount BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    shipping_address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    price BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

---

## 3. 장바구니 흐름 설계

### 3.1 상품 추가

```
Client: POST /api/cart/items
Authorization: Bearer <token>
{
  "productId": 1,
  "quantity": 2
}

↓

CartController.addItem(@AuthenticationPrincipal Long userId)
  ↓
CartService.addItem(userId, productId, quantity)
  ├─ 1. Cart 조회 또는 생성 (findByUserId)
  ├─ 2. Product 조회 및 가격 확인
  ├─ 3. CartItem 생성 또는 기존 수량 업데이트
  ├─ 4. Cart.addItem() 호출 (총액 재계산)
  ├─ 5. 저장 (cascade로 CartItem 자동 저장)
  └─ 6. CartDTO 반환

↓

Response:
{
  "id": 1,
  "userId": 10,
  "items": [
    {
      "id": 1,
      "productId": 1,
      "productName": "삼성 노트북",
      "quantity": 2,
      "price": 1490000,
      "subtotal": 2980000
    }
  ],
  "totalAmount": 2980000,
  "totalItems": 2
}
```

**핵심 로직:**
```java
@Service
public class CartService {
    @Transactional
    public CartDTO addItem(Long userId, Long productId, Integer quantity) {
        // Cart 조회 또는 생성
        Cart cart = cartRepository.findByUserId(userId)
            .orElseGet(() -> createCart(userId));

        // Product 조회
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new NotFoundException("Product not found"));

        // 기존 아이템 확인
        Optional<CartItem> existingItem = cart.getItems().stream()
            .filter(item -> item.getProductId().equals(productId))
            .findFirst();

        if (existingItem.isPresent()) {
            // 기존 아이템 수량 업데이트
            CartItem item = existingItem.get();
            item.setQuantity(item.getQuantity() + quantity);
        } else {
            // 새 아이템 추가
            CartItem newItem = CartItem.builder()
                .productId(productId)
                .quantity(quantity)
                .price(product.getPrice())
                .build();
            cart.addItem(newItem);  // 총액 자동 재계산
        }

        cart = cartRepository.save(cart);
        return toDTO(cart);
    }
}
```

### 3.2 장바구니 조회

```
Client: GET /api/cart
Authorization: Bearer <token>

↓

CartService.getCart(userId)
  ├─ 1. Cart 조회 (findByUserId)
  ├─ 2. Product 정보 조회 (productIds)
  └─ 3. CartDTO 변환 (상품명 포함)

↓

Response: (위와 동일)
```

### 3.3 장바구니 초기화

```
CartService.clearCart(userId)
  ├─ 1. Cart 조회
  ├─ 2. cart.clear() 호출
  │   ├─ items.clear()
  │   ├─ totalAmount = 0
  │   └─ totalItems = 0
  └─ 3. 저장 (orphanRemoval로 CartItem 자동 삭제)
```

---

## 4. 주문 처리 흐름 설계

### 4.1 주문 생성 (E2E 플로우)

```
Client: POST /api/orders
Authorization: Bearer <token>
{
  "shippingAddress": "서울시 강남구 테헤란로 123"
}

↓

OrderController.createOrder(@AuthenticationPrincipal Long userId)
  ↓
OrderService.createOrder(userId, request)
  @Transactional
  ├─ 1. Cart 조회 (필수)
  ├─ 2. Cart가 비어있는지 확인
  ├─ 3. Order 생성 (Order.fromCart)
  │   ├─ CartItem → OrderItem 변환
  │   └─ status = PENDING
  ├─ 4. Order 저장
  ├─ 5. Cart 초기화 (cartService.clearCart)
  ├─ 6. 이벤트 발행 (OrderCreatedEvent)
  │   └─ Kafka [order-events] 토픽
  ├─ 7. 메트릭 기록
  │   ├─ orders_created_total++
  │   └─ revenue_total += totalAmount
  └─ 8. OrderDTO 반환

↓

Response:
{
  "id": 100,
  "userId": 10,
  "items": [
    {
      "productId": 1,
      "productName": "삼성 노트북",
      "quantity": 2,
      "price": 1490000
    }
  ],
  "totalAmount": 2980000,
  "status": "PENDING",
  "shippingAddress": "서울시 강남구 테헤란로 123",
  "createdAt": "2025-11-23T10:00:00"
}
```

**핵심 로직:**
```java
@Service
public class OrderService {
    @Transactional
    public OrderDTO createOrder(Long userId, CreateOrderRequest request) {
        // 1. 장바구니 조회
        Cart cart = cartRepository.findByUserId(userId)
            .orElseThrow(() -> new IllegalStateException("Cart is empty"));

        if (cart.getItems().isEmpty()) {
            throw new IllegalStateException("Cart is empty");
        }

        // 2. 주문 생성
        Order order = Order.fromCart(cart, userId, request.getShippingAddress());
        order = orderRepository.save(order);

        // 3. 장바구니 초기화
        cartService.clearCart(userId);

        // 4. 이벤트 발행
        publishOrderCreatedEvent(order);

        // 5. 메트릭 기록
        businessMetrics.incrementOrdersCreated();
        businessMetrics.incrementRevenue(order.getTotalAmount());

        log.info("Order created: orderId={}, userId={}, amount={}",
            order.getId(), userId, order.getTotalAmount());

        return toDTO(order);
    }

    private void publishOrderCreatedEvent(Order order) {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
            .orderId(order.getId())
            .userId(order.getUserId())
            .totalAmount(order.getTotalAmount())
            .items(order.getItems().stream()
                .map(this::toEventItem)
                .collect(Collectors.toList()))
            .timestamp(LocalDateTime.now())
            .build();

        eventPublisher.publish("order-events", event);
    }
}
```

### 4.2 주문 상태 업데이트

```
Admin: PUT /api/orders/{orderId}/status
Authorization: Bearer <admin-token>
{
  "status": "CONFIRMED"
}

↓

OrderService.updateOrderStatus(orderId, newStatus)
  @Transactional
  ├─ 1. Order 조회
  ├─ 2. 상태 전환 검증 (상태 머신)
  ├─ 3. order.updateStatus(newStatus)
  ├─ 4. 저장
  ├─ 5. 이벤트 발행 (OrderConfirmedEvent)
  ├─ 6. 메트릭 기록
  └─ 7. OrderDTO 반환

↓

상태 전환 규칙:
PENDING → CONFIRMED (결제 완료)
CONFIRMED → SHIPPED (배송 시작)
SHIPPED → DELIVERED (배송 완료)
PENDING/CONFIRMED → CANCELLED (취소)
```

**상태 전환 검증:**
```java
private void validateStatusTransition(OrderStatus current, OrderStatus target) {
    Map<OrderStatus, Set<OrderStatus>> transitions = Map.of(
        OrderStatus.PENDING, Set.of(OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
        OrderStatus.CONFIRMED, Set.of(OrderStatus.SHIPPED, OrderStatus.CANCELLED),
        OrderStatus.SHIPPED, Set.of(OrderStatus.DELIVERED),
        OrderStatus.DELIVERED, Set.of(),
        OrderStatus.CANCELLED, Set.of()
    );

    if (!transitions.get(current).contains(target)) {
        throw new IllegalStateException(
            String.format("Invalid transition: %s → %s", current, target)
        );
    }
}
```

### 4.3 주문 조회

```
Client: GET /api/orders
Authorization: Bearer <token>

↓

OrderService.findByUserId(userId, pageable)
  ├─ 1. DB 조회 (user_id 인덱스 활용)
  ├─ 2. OrderItem 조회 (Fetch Join)
  ├─ 3. Product 정보 조회
  └─ 4. Page<OrderDTO> 반환

↓

Response:
{
  "content": [
    {
      "id": 100,
      "totalAmount": 2980000,
      "status": "CONFIRMED",
      "createdAt": "2025-11-23T10:00:00"
    }
  ],
  "totalElements": 5,
  "page": 0,
  "size": 20
}
```

---

## 5. 이벤트 기반 아키텍처

### 5.1 이벤트 모델

#### 5.1.1 OrderCreatedEvent
```java
@Data
@Builder
public class OrderCreatedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private Long totalAmount;
    private List<OrderItemDTO> items;
    private LocalDateTime timestamp;

    @Override
    public String getEventType() {
        return "OrderCreated";
    }
}
```

#### 5.1.2 OrderConfirmedEvent
```java
@Data
@Builder
public class OrderConfirmedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private OrderStatus status;
    private LocalDateTime timestamp;

    @Override
    public String getEventType() {
        return "OrderConfirmed";
    }
}
```

### 5.2 이벤트 발행 (Producer)

```java
@Component
public class EventPublisher {
    private final KafkaTemplate<String, BaseEvent> kafkaTemplate;

    public void publish(String topic, BaseEvent event) {
        String key = event.getEventId().toString();

        kafkaTemplate.send(topic, key, event)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event: {}", event, ex);
                    // 재시도 로직 (향후)
                } else {
                    log.info("Event published: topic={}, key={}, event={}",
                        topic, key, event.getEventType());
                }
            });
    }
}
```

### 5.3 이벤트 소비 (Consumer)

```java
@Component
@Slf4j
public class OrderEventConsumer {
    @KafkaListener(topics = "order-events", groupId = "notification-service")
    public void handleOrderEvent(BaseEvent event) {
        log.info("Received event: type={}, id={}",
            event.getEventType(), event.getEventId());

        if (event instanceof OrderCreatedEvent created) {
            handleOrderCreated(created);
        } else if (event instanceof OrderConfirmedEvent confirmed) {
            handleOrderConfirmed(confirmed);
        }
    }

    private void handleOrderCreated(OrderCreatedEvent event) {
        // 주문 확인 이메일 발송 (비동기)
        log.info("Sending order confirmation email to user: {}", event.getUserId());
        // emailService.sendOrderConfirmation(event);

        // 분석 데이터 저장
        // analyticsService.trackOrderCreated(event);
    }

    private void handleOrderConfirmed(OrderConfirmedEvent event) {
        // 결제 완료 알림 발송
        log.info("Sending payment confirmation to user: {}", event.getUserId());
        // notificationService.sendPaymentConfirmation(event);
    }
}
```

### 5.4 At-Least-Once 전달 보장

**Producer 설정:**
```yaml
spring:
  kafka:
    producer:
      acks: all  # 모든 replica 확인
      retries: 3  # 실패 시 재시도
```

**Consumer 설정:**
```yaml
spring:
  kafka:
    consumer:
      enable-auto-commit: false  # 수동 커밋
      auto-offset-reset: earliest
```

**수동 커밋:**
```java
@KafkaListener(topics = "order-events")
public void handleEvent(BaseEvent event, Acknowledgment ack) {
    try {
        processEvent(event);
        ack.acknowledge();  // 성공 시에만 커밋
    } catch (Exception e) {
        log.error("Event processing failed, will retry", e);
        // 실패 시 커밋하지 않음 → 재시도
    }
}
```

---

## 6. 메트릭 & 관찰성

### 6.1 비즈니스 메트릭

```java
@Component
public class BusinessMetrics {
    private final Counter ordersCreatedCounter;
    private final Counter ordersConfirmedCounter;
    private final Counter ordersCancelledCounter;
    private final Counter revenueCounter;

    public BusinessMetrics(MeterRegistry registry) {
        this.ordersCreatedCounter = Counter.builder("orders.created")
            .description("Total orders created")
            .register(registry);

        this.ordersConfirmedCounter = Counter.builder("orders.confirmed")
            .description("Total orders confirmed")
            .register(registry);

        this.ordersCancelledCounter = Counter.builder("orders.cancelled")
            .description("Total orders cancelled")
            .register(registry);

        this.revenueCounter = Counter.builder("revenue.total")
            .description("Total revenue in KRW")
            .baseUnit("krw")
            .register(registry);
    }

    public void incrementOrdersCreated() {
        ordersCreatedCounter.increment();
    }

    public void incrementRevenue(Long amount) {
        revenueCounter.increment(amount);
    }
}
```

**Prometheus 쿼리:**
```promql
# 시간당 주문 수
rate(orders_created_total[1h])

# 총 매출
sum(revenue_total)

# 주문 상태별 분포
sum by (status) (orders_total)
```

### 6.2 분산 추적

```java
@Service
public class OrderService {
    @NewSpan("order.create")
    public OrderDTO createOrder(Long userId, CreateOrderRequest request) {
        Span span = Tracer.currentSpan();
        span.tag("user.id", userId.toString());
        span.tag("order.amount", request.getTotalAmount().toString());

        // 주문 로직...
    }
}
```

**Zipkin Trace:**
```
POST /api/orders
  trace-id: abc123
  ├─ OrderService.createOrder (span-1)
  │   ├─ CartRepository.findByUserId (span-2)
  │   ├─ OrderRepository.save (span-3)
  │   └─ EventPublisher.publish (span-4)
  └─ Kafka Producer → order-events (span-5)
```

---

## 7. 테스트 전략

### 7.1 유닛 테스트

```java
@Test
void createOrder_Success() {
    // Given
    when(cartRepository.findByUserId(userId)).thenReturn(Optional.of(cart));
    when(orderRepository.save(any())).thenReturn(order);

    // When
    OrderDTO result = orderService.createOrder(userId, request);

    // Then
    assertThat(result.getStatus()).isEqualTo(OrderStatus.PENDING);
    verify(cartService).clearCart(userId);
    verify(eventPublisher).publish(eq("order-events"), any(OrderCreatedEvent.class));
}

@Test
void createOrder_EmptyCart_ThrowsException() {
    when(cartRepository.findByUserId(userId))
        .thenReturn(Optional.of(emptyCart));

    assertThatThrownBy(() -> orderService.createOrder(userId, request))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("Cart is empty");
}
```

### 7.2 통합 테스트

```java
@SpringBootTest
@AutoConfigureMockMvc
class OrderIntegrationTest {
    @Test
    void createOrder_E2E_Success() {
        // 1. 장바구니에 상품 추가
        mockMvc.perform(post("/api/cart/items")
            .header("Authorization", "Bearer " + token)
            .content(addItemJson))
            .andExpect(status().isOk());

        // 2. 주문 생성
        mockMvc.perform(post("/api/orders")
            .header("Authorization", "Bearer " + token)
            .content(orderJson))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("PENDING"));

        // 3. 장바구니 비어있는지 확인
        mockMvc.perform(get("/api/cart")
            .header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.items").isEmpty());
    }
}
```

### 7.3 Kafka 이벤트 테스트

```java
@SpringBootTest
@EmbeddedKafka(topics = {"order-events"})
class OrderEventTest {
    @Autowired
    private EmbeddedKafkaBroker embeddedKafka;

    @Test
    void orderCreated_PublishesEvent() throws InterruptedException {
        // Given
        CountDownLatch latch = new CountDownLatch(1);
        Map<String, Object> consumerProps = KafkaTestUtils
            .consumerProps("test-group", "true", embeddedKafka);

        try (Consumer<String, OrderCreatedEvent> consumer =
                new DefaultKafkaConsumerFactory<>(consumerProps).createConsumer()) {

            consumer.subscribe(Collections.singleton("order-events"));

            // When
            orderService.createOrder(userId, request);

            // Then
            ConsumerRecords<String, OrderCreatedEvent> records =
                KafkaTestUtils.getRecords(consumer, Duration.ofSeconds(5));

            assertThat(records).hasSize(1);
            OrderCreatedEvent event = records.iterator().next().value();
            assertThat(event.getOrderId()).isNotNull();
        }
    }
}
```

---

## 8. 검증 체크리스트

- [ ] 장바구니 상품 추가/삭제/수량 변경
- [ ] 장바구니 총액 자동 계산
- [ ] 장바구니에서 주문 생성
- [ ] 주문 생성 후 장바구니 자동 초기화
- [ ] 빈 장바구니로 주문 생성 차단
- [ ] 주문 상태 전환 (PENDING → CONFIRMED → SHIPPED → DELIVERED)
- [ ] 잘못된 상태 전환 차단
- [ ] 주문 내역 조회 (페이징)
- [ ] OrderCreatedEvent Kafka 발행 확인
- [ ] OrderConfirmedEvent Kafka 발행 확인
- [ ] 이벤트 소비자 동작 확인 (로그)
- [ ] 비즈니스 메트릭 기록 (orders_created, revenue)
- [ ] 분산 추적 (Zipkin)
- [ ] 주문 생성 트랜잭션 원자성
- [ ] 응답 시간 p99 < 500ms
