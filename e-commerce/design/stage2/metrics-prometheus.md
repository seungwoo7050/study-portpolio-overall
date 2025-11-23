# Prometheus 메트릭 시스템 설계 일지 (Stage 2 - Observability)
> Prometheus + Micrometer 기반 비즈니스 & 기술 메트릭 수집 아키텍처

## 1. 문제 정의 & 요구사항

### 1.1 목표

프로덕션급 메트릭 수집 및 모니터링 시스템 구축:
- **비즈니스 메트릭**: 회원가입, 주문, 결제, 매출 추적
- **기술 메트릭**: HTTP 성능, DB 연결, JVM 상태
- **인프라 메트릭**: CPU, 메모리, 디스크
- **커스텀 메트릭**: 도메인별 핵심 지표

"측정할 수 없으면 개선할 수 없다" - 모든 중요한 지표를 측정 가능하게 만들기

### 1.2 기능 요구사항

#### 1.2.1 메트릭 카테고리
**비즈니스 메트릭 (6개):**
- `user.registrations.total` - 총 회원가입 수
- `orders.created.total` - 주문 생성 수
- `orders.confirmed.total` - 주문 확인 수
- `orders.cancelled.total` - 주문 취소 수
- `payments.success.total` - 결제 성공 수
- `revenue.total` - 총 매출 (KRW)

**HTTP 성능 메트릭:**
- `http.requests.total` - HTTP 요청 수 (메서드, 엔드포인트, 상태별)
- `http.request.duration.seconds` - 요청 응답 시간 (히스토그램)

**데이터베이스 메트릭 (HikariCP):**
- `hikaricp.connections.active` - 활성 연결 수
- `hikaricp.connections.idle` - 유휴 연결 수
- `hikaricp.connections.max` - 최대 연결 수
- `hikaricp.connections.acquire.seconds` - 연결 획득 시간

**JVM 메트릭:**
- `jvm.memory.used.bytes` - 메모리 사용량 (heap, non-heap)
- `jvm.gc.pause.seconds` - GC 일시정지 시간
- `jvm.threads.live.threads` - 활성 스레드 수

**시스템 메트릭:**
- `process.cpu.usage` - 프로세스 CPU 사용률
- `system.cpu.usage` - 시스템 CPU 사용률
- `disk.total.bytes` / `disk.free.bytes` - 디스크 사용량

#### 1.2.2 메트릭 타입
- **Counter**: 단조 증가 (예: 요청 수, 회원가입 수)
- **Gauge**: 현재 값 (예: 활성 연결 수, 메모리 사용량)
- **Timer**: 실행 시간 + 히스토그램 (예: HTTP 응답 시간)
- **Summary**: 분포 통계 (예: 요청 크기)

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 메트릭 수집 오버헤드: < 1% CPU
- 메트릭 조회 응답: < 100ms
- Scrape interval: 15초 (Prometheus 표준)

#### 1.3.2 정확성
- Counter 정확도: 100% (누락 없음)
- 히스토그램 정확도: P99 ±5ms

#### 1.3.3 확장성
- 메트릭 카디널리티: < 10,000 시계열
- Retention: 15일 (Prometheus 로컬)
- 장기 저장: Thanos/Cortex (향후)

---

## 2. 아키텍처 설계

### 2.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Spring Boot Application                   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Application Code                           │ │
│  │  @Service, @Controller, @Repository                    │ │
│  │  ├─ UserService.register()                             │ │
│  │  │   └─ businessMetrics.incrementUserRegistrations()  │ │
│  │  ├─ OrderService.createOrder()                         │ │
│  │  │   └─ businessMetrics.incrementRevenue(amount)      │ │
│  │  └─ PaymentClient.process()                           │ │
│  │      └─ @Timed("payment.process")                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Micrometer MeterRegistry                      │ │
│  │  ├─ Counter                                            │ │
│  │  ├─ Gauge                                              │ │
│  │  ├─ Timer                                              │ │
│  │  └─ DistributionSummary                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │      PrometheusMeterRegistry                           │ │
│  │      (메트릭 → Prometheus 형식 변환)                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │      /actuator/prometheus Endpoint                     │ │
│  │      (HTTP GET 요청 시 메트릭 노출)                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP Scrape (15초마다)
┌─────────────────────────────────────────────────────────────┐
│               Prometheus Server                              │
│  ├─ Time Series Database (TSDB)                            │
│  ├─ PromQL Query Engine                                    │
│  ├─ Alert Manager Integration                              │
│  └─ Service Discovery                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓ PromQL Query
┌─────────────────────────────────────────────────────────────┐
│                  Grafana Dashboard                           │
│  ├─ 14 Panels across 8 Categories                          │
│  ├─ Real-time Visualization                                │
│  └─ Alert Annotations                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Micrometer 통합

**Spring Boot Auto-Configuration:**
```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus,info
      base-path: /actuator
  metrics:
    export:
      prometheus:
        enabled: true
    distribution:
      percentiles-histogram:
        http.server.requests: true  # P50, P95, P99 계산
    tags:
      application: ${spring.application.name}
      environment: ${ENV:dev}
```

**자동 수집되는 메트릭:**
- JVM 메모리 (heap, non-heap, 각 영역별)
- JVM GC (pause time, count)
- JVM 스레드 (live, daemon, peak)
- Tomcat (threads, sessions)
- HikariCP (연결 풀)
- Logback (로깅 이벤트)

---

## 3. 비즈니스 메트릭 설계

### 3.1 MetricsConfiguration

```java
@Configuration
public class MetricsConfiguration {
    @Bean
    public BusinessMetrics businessMetrics(MeterRegistry registry) {
        return new BusinessMetrics(registry);
    }

    @Component
    public static class BusinessMetrics {
        private final Counter userRegistrations;
        private final Counter ordersCreated;
        private final Counter ordersConfirmed;
        private final Counter ordersCancelled;
        private final Counter paymentsSuccess;
        private final Counter paymentsFailed;
        private final Counter revenueTotal;

        public BusinessMetrics(MeterRegistry registry) {
            this.userRegistrations = Counter.builder("user.registrations.total")
                .description("Total number of user registrations")
                .tag("type", "business")
                .register(registry);

            this.ordersCreated = Counter.builder("orders.created.total")
                .description("Total orders created")
                .tag("type", "business")
                .tag("status", "created")
                .register(registry);

            this.ordersConfirmed = Counter.builder("orders.confirmed.total")
                .description("Total orders confirmed")
                .tag("type", "business")
                .tag("status", "confirmed")
                .register(registry);

            this.ordersCancelled = Counter.builder("orders.cancelled.total")
                .description("Total orders cancelled")
                .tag("type", "business")
                .tag("status", "cancelled")
                .register(registry);

            this.paymentsSuccess = Counter.builder("payments.success.total")
                .description("Total successful payments")
                .tag("type", "business")
                .tag("status", "success")
                .register(registry);

            this.paymentsFailed = Counter.builder("payments.failed.total")
                .description("Total failed payments")
                .tag("type", "business")
                .tag("status", "failed")
                .register(registry);

            this.revenueTotal = Counter.builder("revenue.total")
                .description("Total revenue in KRW")
                .baseUnit("krw")
                .tag("type", "business")
                .tag("currency", "KRW")
                .register(registry);
        }

        public void incrementUserRegistrations() {
            userRegistrations.increment();
        }

        public void incrementOrdersCreated() {
            ordersCreated.increment();
        }

        public void incrementOrdersConfirmed() {
            ordersConfirmed.increment();
        }

        public void incrementOrdersCancelled() {
            ordersCancelled.increment();
        }

        public void incrementPaymentsSuccess() {
            paymentsSuccess.increment();
        }

        public void incrementPaymentsFailed() {
            paymentsFailed.increment();
        }

        public void incrementRevenue(Long amount) {
            revenueTotal.increment(amount.doubleValue());
        }
    }
}
```

### 3.2 비즈니스 메트릭 사용

**UserService:**
```java
@Service
public class UserService {
    @Autowired
    private BusinessMetrics metrics;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // 회원가입 로직...
        User user = userRepository.save(newUser);

        // 메트릭 기록
        metrics.incrementUserRegistrations();

        log.info("User registered: userId={}", user.getId());
        return toAuthResponse(user);
    }
}
```

**OrderService:**
```java
@Service
public class OrderService {
    @Autowired
    private BusinessMetrics metrics;

    @Transactional
    public OrderDTO createOrder(Long userId, CreateOrderRequest request) {
        // 주문 생성 로직...
        Order order = orderRepository.save(newOrder);

        // 메트릭 기록
        metrics.incrementOrdersCreated();
        metrics.incrementRevenue(order.getTotalAmount());

        log.info("Order created: orderId={}, amount={}", order.getId(), order.getTotalAmount());
        return toDTO(order);
    }

    @Transactional
    public void updateOrderStatus(Long orderId, OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.setStatus(newStatus);
        orderRepository.save(order);

        // 상태별 메트릭
        switch (newStatus) {
            case CONFIRMED -> metrics.incrementOrdersConfirmed();
            case CANCELLED -> metrics.incrementOrdersCancelled();
        }
    }
}
```

---

## 4. HTTP 메트릭 설계

### 4.1 HttpMetricsInterceptor

```java
@Component
public class HttpMetricsInterceptor implements HandlerInterceptor {
    private final MeterRegistry registry;
    private final Timer.Builder requestTimerBuilder;

    public HttpMetricsInterceptor(MeterRegistry registry) {
        this.registry = registry;
        this.requestTimerBuilder = Timer.builder("http.request.duration.seconds")
            .description("HTTP request duration in seconds")
            .publishPercentileHistogram()  // P50, P95, P99
            .publishPercentiles(0.5, 0.95, 0.99);
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        request.setAttribute("startTime", System.nanoTime());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {
        long startTime = (Long) request.getAttribute("startTime");
        long duration = System.nanoTime() - startTime;

        String uri = normalizeUri(request.getRequestURI());
        String method = request.getMethod();
        int status = response.getStatus();

        requestTimerBuilder
            .tag("method", method)
            .tag("endpoint", uri)
            .tag("status", String.valueOf(status))
            .tag("status_class", getStatusClass(status))
            .register(registry)
            .record(duration, TimeUnit.NANOSECONDS);

        log.debug("HTTP metrics: method={}, endpoint={}, status={}, duration={}ms",
            method, uri, status, duration / 1_000_000);
    }

    private String normalizeUri(String uri) {
        // /api/products/123 → /api/products/{id}
        return uri.replaceAll("/\\d+", "/{id}")
                  .replaceAll("/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}", "/{uuid}");
    }

    private String getStatusClass(int status) {
        return status / 100 + "xx";
    }
}
```

**WebMvcConfiguration 등록:**
```java
@Configuration
public class WebMvcConfiguration implements WebMvcConfigurer {
    @Autowired
    private HttpMetricsInterceptor httpMetricsInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(httpMetricsInterceptor);
    }
}
```

### 4.2 수집되는 HTTP 메트릭

**Prometheus 형식:**
```
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",endpoint="/api/products",status="200",status_class="2xx",le="0.001"} 45
http_request_duration_seconds_bucket{method="GET",endpoint="/api/products",status="200",status_class="2xx",le="0.005"} 123
http_request_duration_seconds_bucket{method="GET",endpoint="/api/products",status="200",status_class="2xx",le="0.01"} 156
...
http_request_duration_seconds_count{method="GET",endpoint="/api/products",status="200",status_class="2xx"} 200
http_request_duration_seconds_sum{method="GET",endpoint="/api/products",status="200",status_class="2xx"} 0.876
```

---

## 5. 데이터베이스 메트릭

### 5.1 HikariCP 자동 메트릭

**application.yml 설정:**
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      connection-timeout: 30000
      metrics:
        enabled: true  # Micrometer 통합
```

**수집되는 메트릭:**
```
hikaricp_connections_active{pool="sagalineHikariCP"} 3
hikaricp_connections_idle{pool="sagalineHikariCP"} 2
hikaricp_connections_max{pool="sagalineHikariCP"} 10
hikaricp_connections_min{pool="sagalineHikariCP"} 5
hikaricp_connections_pending{pool="sagalineHikariCP"} 0
hikaricp_connections_timeout_total{pool="sagalineHikariCP"} 0
hikaricp_connections_acquire_seconds_max{pool="sagalineHikariCP"} 0.012
hikaricp_connections_usage_seconds_max{pool="sagalineHikariCP"} 0.234
hikaricp_connections_creation_seconds_max{pool="sagalineHikariCP"} 0.045
```

### 5.2 PromQL 쿼리 예시

**연결 풀 사용률:**
```promql
(hikaricp_connections_active / hikaricp_connections_max) * 100
```

**연결 획득 지연 P99:**
```promql
histogram_quantile(0.99,
  sum(rate(hikaricp_connections_acquire_seconds_bucket[5m])) by (le)
)
```

---

## 6. JVM 메트릭

### 6.1 자동 수집 메트릭

**메모리:**
```
jvm_memory_used_bytes{area="heap",id="G1 Old Gen"} 157286400
jvm_memory_used_bytes{area="heap",id="G1 Eden Space"} 52428800
jvm_memory_used_bytes{area="nonheap",id="Metaspace"} 78643200
jvm_memory_max_bytes{area="heap"} 1073741824
jvm_memory_committed_bytes{area="heap"} 268435456
```

**GC (Garbage Collection):**
```
jvm_gc_pause_seconds_count{action="end of minor GC",cause="G1 Evacuation Pause"} 12
jvm_gc_pause_seconds_sum{action="end of minor GC",cause="G1 Evacuation Pause"} 0.234
jvm_gc_pause_seconds_count{action="end of major GC",cause="G1 Humongous Allocation"} 2
jvm_gc_pause_seconds_sum{action="end of major GC",cause="G1 Humongous Allocation"} 1.456
```

**스레드:**
```
jvm_threads_live_threads 45
jvm_threads_daemon_threads 32
jvm_threads_peak_threads 50
jvm_threads_states_threads{state="runnable"} 8
jvm_threads_states_threads{state="blocked"} 0
jvm_threads_states_threads{state="waiting"} 12
jvm_threads_states_threads{state="timed-waiting"} 25
```

### 6.2 중요 PromQL 쿼리

**Heap 사용률:**
```promql
(
  sum(jvm_memory_used_bytes{area="heap"}) /
  sum(jvm_memory_max_bytes{area="heap"})
) * 100
```

**GC 빈도 (분당 GC 횟수):**
```promql
rate(jvm_gc_pause_seconds_count[5m]) * 60
```

**평균 GC 일시정지 시간:**
```promql
rate(jvm_gc_pause_seconds_sum[5m]) /
rate(jvm_gc_pause_seconds_count[5m])
```

---

## 7. Prometheus 설정

### 7.1 prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'sagaline-dev'
    environment: 'development'

# Scrape configurations
scrape_configs:
  - job_name: 'sagaline-app'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['host.docker.internal:8080']
        labels:
          application: 'sagaline'
          service: 'backend'
    scrape_interval: 10s
    scrape_timeout: 5s

# Alerting
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Alert rules
rule_files:
  - 'alerts.yml'
```

### 7.2 Recording Rules (성능 최적화)

```yaml
# recording_rules.yml
groups:
  - name: sagaline_recording_rules
    interval: 30s
    rules:
      # Request rate
      - record: job:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m]))

      # Error rate
      - record: job:http_errors:rate5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m]))

      # P99 latency
      - record: job:http_request_duration:p99
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          )

      # Connection pool usage
      - record: job:db_connection_pool:usage
        expr: hikaricp_connections_active / hikaricp_connections_max

      # Heap usage
      - record: job:jvm_heap:usage
        expr: |
          sum(jvm_memory_used_bytes{area="heap"}) /
          sum(jvm_memory_max_bytes{area="heap"})
```

---

## 8. 핵심 PromQL 쿼리

### 8.1 비즈니스 메트릭 쿼리

**시간당 회원가입 수:**
```promql
increase(user_registrations_total[1h])
```

**주문 전환율 (주문 확인 / 주문 생성):**
```promql
(
  rate(orders_confirmed_total[5m]) /
  rate(orders_created_total[5m])
) * 100
```

**평균 주문 금액 (AOV):**
```promql
revenue_total / orders_confirmed_total
```

**시간당 매출:**
```promql
increase(revenue_total{currency="KRW"}[1h])
```

### 8.2 HTTP 성능 쿼리

**초당 요청 수 (RPS):**
```promql
sum(rate(http_requests_total[5m]))
```

**엔드포인트별 RPS:**
```promql
sum(rate(http_requests_total[5m])) by (endpoint)
```

**오류율:**
```promql
(
  sum(rate(http_requests_total{status=~"5.."}[5m])) /
  sum(rate(http_requests_total[5m]))
) * 100
```

**P99 지연시간:**
```promql
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

**가장 느린 5개 엔드포인트:**
```promql
topk(5,
  histogram_quantile(0.99,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
  )
)
```

### 8.3 DB 메트릭 쿼리

**연결 풀 사용률:**
```promql
(hikaricp_connections_active / hikaricp_connections_max) * 100
```

**연결 획득 P99 지연:**
```promql
histogram_quantile(0.99,
  sum(rate(hikaricp_connections_acquire_seconds_bucket[5m])) by (le)
)
```

### 8.4 JVM 메트릭 쿼리

**Heap 메모리 사용률:**
```promql
(
  sum(jvm_memory_used_bytes{area="heap"}) /
  sum(jvm_memory_max_bytes{area="heap"})
) * 100
```

**분당 GC 횟수:**
```promql
rate(jvm_gc_pause_seconds_count[5m]) * 60
```

**평균 GC 일시정지:**
```promql
rate(jvm_gc_pause_seconds_sum[5m]) /
rate(jvm_gc_pause_seconds_count[5m])
```

---

## 9. 메트릭 카디널리티 관리

### 9.1 카디널리티 폭발 방지

**나쁜 예 (높은 카디널리티):**
```java
// ❌ 사용자 ID를 태그로 사용 (카디널리티 = 사용자 수)
Counter.builder("user.actions")
    .tag("userId", userId.toString())  // 1,000,000명 = 1,000,000 시계열
    .register(registry);
```

**좋은 예 (낮은 카디널리티):**
```java
// ✅ 집계된 메트릭 + 상세 정보는 로그/추적에
Counter.builder("user.actions.total")
    .tag("action_type", "login")  // 카디널리티 = 액션 타입 수
    .register(registry);

log.info("User action: userId={}, action={}", userId, "login");
```

### 9.2 태그 설계 원칙

**허용 가능한 태그 (카디널리티 < 100):**
- `environment`: dev, staging, prod
- `status`: 2xx, 3xx, 4xx, 5xx
- `method`: GET, POST, PUT, DELETE
- `endpoint`: /api/users, /api/products, ...

**피해야 할 태그 (카디널리티 > 1000):**
- `user_id`, `session_id`, `request_id`
- `timestamp`, `ip_address`
- 동적 경로 파라미터 (정규화 필요)

---

## 10. 성능 최적화

### 10.1 메트릭 수집 오버헤드 최소화

**Lazy Registration (필요 시에만 생성):**
```java
private final ConcurrentHashMap<String, Counter> counters = new ConcurrentHashMap<>();

public void recordEvent(String eventType) {
    counters.computeIfAbsent(eventType, type ->
        Counter.builder("events.total")
            .tag("type", type)
            .register(registry)
    ).increment();
}
```

**Batch Update (일괄 업데이트):**
```java
// 100개 요청마다 한 번만 메트릭 업데이트
private final AtomicLong requestCount = new AtomicLong(0);

public void onRequest() {
    long count = requestCount.incrementAndGet();
    if (count % 100 == 0) {
        requestCounter.increment(100);
    }
}
```

### 10.2 Histogram vs Summary

**Histogram 사용 (권장):**
- Prometheus 서버에서 Quantile 계산
- 여러 Quantile 동시 쿼리 가능
- Aggregation 가능

```java
Timer.builder("http.request.duration")
    .publishPercentileHistogram()  // Histogram 방식
    .register(registry);
```

**Summary 사용 (비권장):**
- 클라이언트에서 Quantile 계산 (CPU 부하)
- Aggregation 불가능

---

## 11. 검증 & 디버깅

### 11.1 메트릭 검증

**1. Actuator Endpoint 확인:**
```bash
curl http://localhost:8080/actuator/prometheus | grep "user_registrations"

# 출력:
# user_registrations_total{type="business"} 12.0
```

**2. Prometheus Target 확인:**
```
http://localhost:9090/targets

Status: UP
Last Scrape: 3.2s ago
```

**3. Prometheus Query 테스트:**
```
http://localhost:9090/graph

Query: rate(http_requests_total[5m])
```

### 11.2 메트릭 누락 디버깅

**문제: 메트릭이 안 보임**
```bash
# 1. Actuator endpoint 확인
curl http://localhost:8080/actuator/prometheus | grep "my_metric"

# 2. Micrometer Registry 확인
curl http://localhost:8080/actuator/metrics/my.metric.name

# 3. 애플리케이션 로그 확인
grep "Registering metric" application.log
```

**문제: 히스토그램 Quantile이 이상함**
```promql
# 버킷 분포 확인
sum(http_request_duration_seconds_bucket) by (le)

# 해결: 버킷 범위 조정
Timer.builder("http.request.duration")
    .publishPercentileHistogram()
    .minimumExpectedValue(Duration.ofMillis(1))
    .maximumExpectedValue(Duration.ofSeconds(10))
    .register(registry);
```

---

## 12. 검증 체크리스트

- [ ] 비즈니스 메트릭 6개 수집 확인
- [ ] HTTP 메트릭 수집 (요청 수, 응답 시간, 상태 코드)
- [ ] HikariCP 메트릭 노출 확인
- [ ] JVM 메모리 메트릭 수집
- [ ] GC 메트릭 수집
- [ ] Prometheus Target UP 상태
- [ ] Prometheus Scrape 성공 (15초 주기)
- [ ] Recording Rules 동작 확인
- [ ] P99 지연시간 히스토그램 정확도
- [ ] 메트릭 카디널리티 < 10,000
- [ ] Actuator Endpoint 응답 < 100ms
- [ ] 메트릭 수집 CPU 오버헤드 < 1%
- [ ] PromQL 쿼리 응답 < 500ms
- [ ] Grafana 대시보드 연동 확인
