# 결제 & 재고 관리 시스템 설계 일지 (Payment & Inventory Domain)
> Toss Payments 통합 및 Resilience4j 기반 복원력 패턴 설계

## 1. 문제 정의 & 요구사항

### 1.1 목표

안정적인 결제 처리 및 재고 관리 시스템 구축:
- Toss Payments 한국 결제 시스템 통합
- Circuit Breaker 패턴으로 외부 서비스 장애 격리
- Retry 패턴으로 일시적 오류 대응
- 재고 수량 추적 및 예약 관리
- 결제 실패 시 Graceful Degradation

### 1.2 기능 요구사항

#### 1.2.1 결제 (Payment)
- Toss Payments API 통합
- 결제 상태 관리:
  - PENDING (대기)
  - SUCCESS (성공)
  - FAILED (실패)
  - REFUNDED (환불)
- 결제 내역 조회
- Provider Transaction ID 추적

#### 1.2.2 재고 (Inventory)
- 상품별 재고 수량 관리
- 예약 수량 관리 (주문 시 차감)
- 가용 재고 계산 (total - reserved)
- 재고 부족 감지
- Low Stock 알림 (향후)

#### 1.2.3 복원력 패턴
- **Circuit Breaker**: 외부 서비스 장애 시 빠른 실패
- **Retry**: 일시적 오류 재시도 (지수 백오프)
- **Timeout**: 응답 지연 방지
- **Fallback**: 대체 응답 제공

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 결제 API 응답: p99 < 5초 (외부 API 포함)
- Circuit Breaker 열림 시: 즉시 실패 (< 10ms)
- 재고 조회: p99 < 100ms

#### 1.3.2 신뢰성
- 결제 성공률: ≥ 99% (일시적 오류 제외)
- Circuit Breaker 오탐지율: < 1%
- 재고 일관성: 트랜잭션으로 보장

#### 1.3.3 가용성
- 결제 서비스 장애 시에도 주문 접수 가능
- Fallback으로 "결제 대기" 상태 유지

---

## 2. 도메인 모델 설계

### 2.1 엔티티 구조

#### 2.1.1 Payment 엔티티
```java
@Entity
@Table(name = "payments")
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, unique = true)
    private Long orderId;  // 1:1 관계

    @Column(nullable = false)
    private Long amount;

    @Column(length = 3)
    private String currency = "KRW";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status;

    @Column(name = "payment_method")
    private String paymentMethod;  // CARD, TRANSFER, etc.

    @Column(nullable = false)
    private String provider = "TOSS";

    @Column(name = "provider_transaction_id")
    private String providerTransactionId;  // Toss 거래 ID

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

**설계 결정:**
- `orderId`: 유니크 제약으로 1주문 = 1결제
- `providerTransactionId`: Toss 거래 추적용
- `currency`: KRW 고정 (향후 다중 통화 지원)

#### 2.1.2 Inventory 엔티티
```java
@Entity
@Table(name = "inventory")
public class Inventory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false, unique = true)
    private Long productId;  // 1:1 관계

    @Column(nullable = false)
    private Integer quantity;  // 총 재고

    @Column(name = "reserved_quantity", nullable = false)
    private Integer reservedQuantity = 0;  // 예약된 수량

    @Column(name = "low_stock_threshold")
    private Integer lowStockThreshold = 10;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 비즈니스 로직
    public Integer getAvailableQuantity() {
        return quantity - reservedQuantity;
    }

    public void reserve(Integer amount) {
        if (getAvailableQuantity() < amount) {
            throw new InsufficientStockException(
                "Not enough stock: available=" + getAvailableQuantity()
            );
        }
        this.reservedQuantity += amount;
    }

    public void release(Integer amount) {
        this.reservedQuantity -= amount;
        if (this.reservedQuantity < 0) {
            this.reservedQuantity = 0;
        }
    }

    public void deduct(Integer amount) {
        this.quantity -= amount;
        this.reservedQuantity -= amount;
    }

    public boolean isLowStock() {
        return getAvailableQuantity() <= lowStockThreshold;
    }
}
```

**재고 상태 예시:**
```
상품 A:
  quantity: 100 (총 재고)
  reservedQuantity: 30 (예약됨, 결제 대기 중)
  availableQuantity: 70 (구매 가능)
```

### 2.2 Enum

#### 2.2.1 PaymentStatus
```java
public enum PaymentStatus {
    PENDING,   // 결제 대기
    SUCCESS,   // 결제 성공
    FAILED,    // 결제 실패
    REFUNDED   // 환불 완료
}
```

### 2.3 데이터베이스 스키마

```sql
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id),
    amount BIGINT NOT NULL,
    currency VARCHAR(3) DEFAULT 'KRW',
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50),
    provider VARCHAR(50) NOT NULL DEFAULT 'TOSS',
    provider_transaction_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE REFERENCES products(id),
    quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantity >= 0),
    CHECK (reserved_quantity >= 0),
    CHECK (reserved_quantity <= quantity)
);

-- Indexes
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_low_stock ON inventory((quantity - reserved_quantity))
    WHERE (quantity - reserved_quantity) <= 10;
```

---

## 3. 결제 처리 흐름 설계

### 3.1 Toss Payments 통합 아키텍처

```
Frontend → Backend → TossPaymentClient → Toss API
                ↓
            Circuit Breaker
                ↓
              Retry
                ↓
             Timeout
```

### 3.2 결제 요청 흐름

```
Client: POST /api/payments
Authorization: Bearer <token>
{
  "orderId": 100,
  "amount": 2980000,
  "paymentMethod": "CARD"
}

↓

PaymentController.processPayment()
  ↓
PaymentService.processPayment(orderId, amount, method)
  @Transactional
  ├─ 1. Order 조회 및 검증
  ├─ 2. Payment 엔티티 생성 (status = PENDING)
  ├─ 3. DB 저장
  ├─ 4. TossPaymentClient.process() 호출
  │   └─ @CircuitBreaker + @Retry + @TimeLimiter
  ├─ 5. Toss API 응답 처리:
  │   ├─ 성공: status = SUCCESS, providerTransactionId 저장
  │   ├─ 실패: status = FAILED
  │   └─ Fallback: status = PENDING (재시도 대기)
  ├─ 6. 이벤트 발행 (PaymentCompletedEvent)
  ├─ 7. 메트릭 기록
  └─ 8. PaymentDTO 반환

↓

Response (성공):
{
  "id": 1,
  "orderId": 100,
  "amount": 2980000,
  "status": "SUCCESS",
  "provider": "TOSS",
  "providerTransactionId": "toss-tx-abc123"
}

Response (Fallback):
{
  "id": 1,
  "orderId": 100,
  "amount": 2980000,
  "status": "PENDING",
  "message": "Payment is being processed, please check later"
}
```

### 3.3 TossPaymentClient 구현

```java
@Component
@Slf4j
public class TossPaymentClient {
    private final RestTemplate restTemplate;
    private final String tossApiUrl;
    private final String tossApiKey;

    @CircuitBreaker(name = "paymentService", fallbackMethod = "processPaymentFallback")
    @Retry(name = "paymentService")
    @TimeLimiter(name = "paymentService")
    public CompletableFuture<PaymentResult> process(PaymentRequest request) {
        log.info("Processing payment via Toss: orderId={}, amount={}",
            request.getOrderId(), request.getAmount());

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + Base64.encode(tossApiKey));
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<PaymentRequest> entity = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<TossPaymentResponse> response = restTemplate.postForEntity(
                tossApiUrl + "/payments",
                entity,
                TossPaymentResponse.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                TossPaymentResponse tossResponse = response.getBody();
                return CompletableFuture.completedFuture(
                    PaymentResult.success(tossResponse.getTransactionId())
                );
            } else {
                return CompletableFuture.completedFuture(
                    PaymentResult.failed("Payment failed at provider")
                );
            }
        } catch (HttpClientErrorException e) {
            log.error("Payment failed: {}", e.getMessage());
            return CompletableFuture.completedFuture(
                PaymentResult.failed("Payment rejected: " + e.getMessage())
            );
        }
    }

    public CompletableFuture<PaymentResult> processPaymentFallback(
            PaymentRequest request, Exception e) {
        log.warn("Payment service unavailable, using fallback: {}", e.getMessage());

        return CompletableFuture.completedFuture(
            PaymentResult.pending("Payment processing delayed, please try again later")
        );
    }
}
```

---

## 4. Resilience4j 복원력 패턴

### 4.1 Circuit Breaker 설정

```yaml
resilience4j:
  circuitbreaker:
    instances:
      paymentService:
        registerHealthIndicator: true
        slidingWindowSize: 10            # 최근 10회 호출 추적
        minimumNumberOfCalls: 5          # 최소 5회 호출 후 판단
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: true
        waitDurationInOpenState: 60s     # OPEN 상태 60초 유지
        failureRateThreshold: 50         # 실패율 50% 이상 시 OPEN
        eventConsumerBufferSize: 10
```

**상태 전환:**
```
CLOSED (정상)
  ├─ 실패율 < 50%: CLOSED 유지
  └─ 실패율 ≥ 50%: → OPEN

OPEN (차단)
  ├─ 60초 대기
  └─ → HALF_OPEN

HALF_OPEN (테스트)
  ├─ 3회 시도 중 성공: → CLOSED
  └─ 3회 시도 중 실패: → OPEN
```

**Circuit Breaker 모니터링:**
```java
@RestController
@RequestMapping("/actuator")
public class CircuitBreakerController {
    @Autowired
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @GetMapping("/circuitbreakers/paymentService")
    public ResponseEntity<CircuitBreakerState> getState() {
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("paymentService");

        return ResponseEntity.ok(new CircuitBreakerState(
            cb.getState().toString(),
            cb.getMetrics().getFailureRate(),
            cb.getMetrics().getNumberOfSuccessfulCalls(),
            cb.getMetrics().getNumberOfFailedCalls()
        ));
    }
}
```

### 4.2 Retry 설정

```yaml
resilience4j:
  retry:
    instances:
      paymentService:
        maxAttempts: 2                     # 최대 2회 재시도
        waitDuration: 2000                 # 초기 대기 2초
        exponentialBackoffMultiplier: 1.5  # 지수 백오프 1.5배
        retryExceptions:
          - java.net.SocketTimeoutException
          - org.springframework.web.client.ResourceAccessException
        ignoreExceptions:
          - com.sagaline.payment.exception.PaymentRejectedException
```

**재시도 타임라인:**
```
1차 시도 → 실패 (SocketTimeoutException)
  ↓ 2초 대기
2차 시도 → 실패
  ↓ 3초 대기 (2 * 1.5)
3차 시도 → 성공 또는 최종 실패
```

### 4.3 Timeout 설정

```yaml
resilience4j:
  timelimiter:
    instances:
      paymentService:
        timeoutDuration: 5s  # 5초 타임아웃
```

**타임아웃 처리:**
```java
@TimeLimiter(name = "paymentService")
public CompletableFuture<PaymentResult> process(PaymentRequest request) {
    // 5초 내 완료되지 않으면 TimeoutException
}
```

---

## 5. 재고 관리 흐름

### 5.1 재고 예약 (주문 생성 시)

```
OrderService.createOrder()
  @Transactional
  ├─ 1. Cart 조회
  ├─ 2. 재고 예약 (inventoryService.reserveItems)
  │   └─ For each item:
  │       ├─ Inventory 조회 (PESSIMISTIC_WRITE lock)
  │       ├─ 가용 재고 확인 (quantity - reserved >= 필요량)
  │       ├─ reserved += 필요량
  │       └─ 저장
  ├─ 3. Order 생성
  └─ 4. Payment 처리

실패 시:
  ├─ Rollback (재고 예약 자동 취소)
  └─ 에러 반환
```

**재고 예약 로직:**
```java
@Service
public class InventoryService {
    @Transactional
    public void reserveItems(List<OrderItem> items) {
        for (OrderItem item : items) {
            Inventory inventory = inventoryRepository
                .findByProductIdWithLock(item.getProductId())
                .orElseThrow(() -> new NotFoundException("Inventory not found"));

            // 재고 예약
            inventory.reserve(item.getQuantity());

            inventoryRepository.save(inventory);

            // Low Stock 알림
            if (inventory.isLowStock()) {
                log.warn("Low stock: productId={}, available={}",
                    item.getProductId(), inventory.getAvailableQuantity());
            }
        }
    }

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.productId = :productId")
    Optional<Inventory> findByProductIdWithLock(@Param("productId") Long productId);
}
```

### 5.2 재고 차감 (결제 성공 시)

```
PaymentEventConsumer.handlePaymentCompleted(PaymentCompletedEvent)
  ├─ 1. Order 조회
  ├─ 2. 재고 차감 (inventoryService.deductItems)
  │   └─ For each item:
  │       ├─ Inventory 조회
  │       ├─ quantity -= 필요량
  │       ├─ reserved -= 필요량
  │       └─ 저장
  └─ 3. Order 상태 → CONFIRMED
```

**재고 차감 로직:**
```java
@Transactional
public void deductItems(List<OrderItem> items) {
    for (OrderItem item : items) {
        Inventory inventory = inventoryRepository
            .findByProductId(item.getProductId())
            .orElseThrow();

        inventory.deduct(item.getQuantity());
        inventoryRepository.save(inventory);

        log.info("Inventory deducted: productId={}, amount={}, remaining={}",
            item.getProductId(), item.getQuantity(), inventory.getQuantity());
    }
}
```

### 5.3 재고 해제 (주문 취소 시)

```
OrderService.cancelOrder(orderId)
  @Transactional
  ├─ 1. Order 조회
  ├─ 2. 재고 해제 (inventoryService.releaseItems)
  │   └─ For each item:
  │       ├─ reserved -= 필요량
  │       └─ 저장
  ├─ 3. Order 상태 → CANCELLED
  └─ 4. Payment 환불 처리
```

---

## 6. 메트릭 & 관찰성

### 6.1 결제 메트릭

```java
@Component
public class PaymentMetrics {
    private final Counter paymentsTotal;
    private final Counter paymentsSuccess;
    private final Counter paymentsFailed;
    private final Timer paymentDuration;

    public PaymentMetrics(MeterRegistry registry) {
        this.paymentsTotal = Counter.builder("payments.total")
            .description("Total payment attempts")
            .register(registry);

        this.paymentsSuccess = Counter.builder("payments.success")
            .description("Successful payments")
            .register(registry);

        this.paymentsFailed = Counter.builder("payments.failed")
            .description("Failed payments")
            .tag("reason", "unknown")
            .register(registry);

        this.paymentDuration = Timer.builder("payments.duration")
            .description("Payment processing time")
            .register(registry);
    }
}
```

### 6.2 Circuit Breaker 메트릭

**Prometheus 메트릭:**
```
resilience4j_circuitbreaker_state{name="paymentService"} 0  # CLOSED
resilience4j_circuitbreaker_failure_rate{name="paymentService"} 0.25
resilience4j_circuitbreaker_calls_total{name="paymentService",kind="successful"} 7
resilience4j_circuitbreaker_calls_total{name="paymentService",kind="failed"} 3
```

**Grafana 대시보드 쿼리:**
```promql
# Circuit Breaker 상태
resilience4j_circuitbreaker_state{name="paymentService"}

# 실패율
resilience4j_circuitbreaker_failure_rate{name="paymentService"}

# 성공/실패 호출 수
sum by (kind) (
  rate(resilience4j_circuitbreaker_calls_total{name="paymentService"}[5m])
)
```

---

## 7. 에러 처리 & Fallback 전략

### 7.1 에러 분류

**재시도 가능 (Retryable):**
- `SocketTimeoutException`: 네트워크 타임아웃
- `ConnectException`: 연결 실패
- `HttpServerErrorException`: 5xx 서버 오류

**재시도 불가 (Non-Retryable):**
- `PaymentRejectedException`: 카드 거부
- `InsufficientFundsException`: 잔액 부족
- `HttpClientErrorException`: 4xx 클라이언트 오류

### 7.2 Fallback 응답 전략

**시나리오 1: Circuit Breaker OPEN**
```
Client → Payment API
  ↓
Circuit Breaker: OPEN
  ↓
Fallback: {
  "status": "PENDING",
  "message": "Payment service is temporarily unavailable. Your order is saved and will be processed soon."
}
```

**시나리오 2: Timeout**
```
Client → Payment API → Toss API (5초 초과)
  ↓
TimeoutException
  ↓
Fallback: {
  "status": "PENDING",
  "message": "Payment is being processed. Please check your order status in a few minutes."
}
```

---

## 8. 테스트 전략

### 8.1 유닛 테스트

```java
@Test
void processPayment_Success() {
    // Given
    when(tossPaymentClient.process(any()))
        .thenReturn(CompletableFuture.completedFuture(
            PaymentResult.success("toss-tx-123")
        ));

    // When
    PaymentDTO result = paymentService.processPayment(orderId, amount, method);

    // Then
    assertThat(result.getStatus()).isEqualTo(PaymentStatus.SUCCESS);
    assertThat(result.getProviderTransactionId()).isEqualTo("toss-tx-123");
}

@Test
void processPayment_CircuitBreakerOpen_Fallback() {
    // Given
    CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("paymentService");
    cb.transitionToOpenState();

    // When
    PaymentDTO result = paymentService.processPayment(orderId, amount, method);

    // Then
    assertThat(result.getStatus()).isEqualTo(PaymentStatus.PENDING);
}
```

### 8.2 재고 동시성 테스트

```java
@Test
void reserveItems_ConcurrentAccess_NoOverselling() throws InterruptedException {
    // Given
    Inventory inventory = new Inventory();
    inventory.setProductId(1L);
    inventory.setQuantity(10);
    inventoryRepository.save(inventory);

    int threadCount = 20;
    CountDownLatch latch = new CountDownLatch(threadCount);
    AtomicInteger successCount = new AtomicInteger(0);

    // When: 20개 스레드가 동시에 5개씩 예약 시도
    for (int i = 0; i < threadCount; i++) {
        new Thread(() -> {
            try {
                inventoryService.reserveItems(List.of(
                    new OrderItem(1L, 5)
                ));
                successCount.incrementAndGet();
            } catch (InsufficientStockException e) {
                // 예상된 예외
            } finally {
                latch.countDown();
            }
        }).start();
    }

    latch.await();

    // Then: 최대 2개 스레드만 성공 (10 / 5 = 2)
    assertThat(successCount.get()).isEqualTo(2);
}
```

---

## 9. 검증 체크리스트

- [ ] Toss Payments API 통합 (Mock)
- [ ] 결제 성공 처리
- [ ] 결제 실패 처리
- [ ] Circuit Breaker OPEN 상태 확인
- [ ] Fallback 응답 확인
- [ ] Retry 동작 확인 (로그)
- [ ] Timeout 동작 확인
- [ ] 재고 예약 기능
- [ ] 재고 차감 기능
- [ ] 재고 해제 기능
- [ ] 재고 동시성 제어 (PESSIMISTIC_WRITE lock)
- [ ] Low Stock 알림 (로그)
- [ ] Circuit Breaker 메트릭 수집
- [ ] 결제 메트릭 수집
- [ ] Grafana 대시보드 확인
