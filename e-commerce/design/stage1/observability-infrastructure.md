# 관찰성 & 인프라 시스템 설계 일지 (Observability & Infrastructure)
> Prometheus, Grafana, Zipkin 기반 종합 관찰성 및 Redis 캐싱, Kafka 이벤트 시스템 설계

## 1. 문제 정의 & 요구사항

### 1.1 목표

프로덕션급 관찰성 및 인프라 구축:
- Prometheus 메트릭 수집 (비즈니스 + 기술)
- Grafana 대시보드 시각화
- Zipkin 분산 추적
- 구조화된 JSON 로깅
- Redis 다층 캐싱
- Kafka 이벤트 기반 아키텍처
- Rate Limiting으로 서비스 보호

### 1.2 기능 요구사항

#### 1.2.1 메트릭 (Metrics)
- 비즈니스 메트릭:
  - 회원가입 수
  - 주문 생성/확인/취소 수
  - 결제 성공/실패 수
  - 총 매출
- 기술 메트릭:
  - HTTP 요청 수/응답 시간
  - DB 연결 풀 상태
  - 쿼리 실행 시간
  - 캐시 히트/미스율
  - Kafka 컨슈머 렉

#### 1.2.2 분산 추적 (Distributed Tracing)
- Trace ID 전파 (HTTP + Kafka)
- Span 계층 구조
- 서비스 간 호출 추적
- 지연 분석

#### 1.2.3 로깅 (Logging)
- 구조화된 JSON 형식
- Trace ID 포함
- 로그 레벨 관리
- ELK Stack 준비

#### 1.2.4 캐싱 (Redis)
- 6개 캐시 영역 (다른 TTL)
- Cache-aside 패턴
- 이벤트 기반 캐시 무효화
- 캐시 오류 격리 (Fail-open)

#### 1.2.5 이벤트 시스템 (Kafka)
- 5개 토픽
- At-Least-Once 전달
- 이벤트 발행/구독
- Dead Letter Queue (향후)

#### 1.2.6 Rate Limiting
- IP 기반 제한
- Redis Sliding Window
- 엔드포인트별 다른 제한

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 메트릭 수집 오버헤드: < 1ms
- 로깅 오버헤드: < 5ms
- 캐시 조회: < 10ms
- Rate Limit 검증: < 5ms

#### 1.3.2 가용성
- 관찰성 시스템 장애가 서비스 중단으로 이어지지 않음
- Fail-fast vs Fail-open 구분

---

## 2. 메트릭 시스템 설계

### 2.1 Prometheus + Micrometer 아키텍처

```
Application
  ↓ Micrometer
MeterRegistry
  ├─ Counter (단조 증가)
  ├─ Gauge (현재 값)
  ├─ Timer (실행 시간 + 히스토그램)
  └─ Summary (분포)
  ↓
Prometheus Endpoint (/actuator/prometheus)
  ↓
Prometheus Server (Scrape 15초마다)
  ↓
Grafana Dashboard
```

### 2.2 비즈니스 메트릭

#### 2.2.1 MetricsConfiguration
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
                .description("Total user registrations")
                .register(registry);

            this.ordersCreated = Counter.builder("orders.created.total")
                .description("Total orders created")
                .register(registry);

            this.ordersConfirmed = Counter.builder("orders.confirmed.total")
                .description("Total orders confirmed")
                .register(registry);

            this.ordersCancelled = Counter.builder("orders.cancelled.total")
                .description("Total orders cancelled")
                .register(registry);

            this.paymentsSuccess = Counter.builder("payments.success.total")
                .description("Successful payments")
                .register(registry);

            this.paymentsFailed = Counter.builder("payments.failed.total")
                .description("Failed payments")
                .register(registry);

            this.revenueTotal = Counter.builder("revenue.total")
                .description("Total revenue in KRW")
                .baseUnit("krw")
                .register(registry);
        }

        public void incrementUserRegistrations() {
            userRegistrations.increment();
        }

        public void incrementRevenue(Long amount) {
            revenueTotal.increment(amount);
        }

        // ... 나머지 메서드
    }
}
```

#### 2.2.2 사용 예시
```java
@Service
public class UserService {
    @Autowired
    private BusinessMetrics metrics;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // 회원가입 로직...

        metrics.incrementUserRegistrations();

        return response;
    }
}
```

### 2.3 HTTP 메트릭

#### 2.3.1 HttpMetricsInterceptor
```java
@Component
public class HttpMetricsInterceptor implements HandlerInterceptor {
    private final MeterRegistry registry;
    private final Timer.Builder requestTimerBuilder;

    public HttpMetricsInterceptor(MeterRegistry registry) {
        this.registry = registry;
        this.requestTimerBuilder = Timer.builder("http.server.requests")
            .description("HTTP request duration")
            .publishPercentileHistogram();
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        request.setAttribute("startTime", System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {
        long startTime = (Long) request.getAttribute("startTime");
        long duration = System.currentTimeMillis() - startTime;

        requestTimerBuilder
            .tag("method", request.getMethod())
            .tag("uri", getUri(request))
            .tag("status", String.valueOf(response.getStatus()))
            .register(registry)
            .record(duration, TimeUnit.MILLISECONDS);
    }

    private String getUri(HttpServletRequest request) {
        // /api/products/123 → /api/products/{id}
        String uri = request.getRequestURI();
        // 경로 파라미터 정규화 로직
        return uri.replaceAll("/\\d+", "/{id}");
    }
}
```

### 2.4 DB 메트릭

**HikariCP 자동 메트릭:**
```yaml
spring:
  datasource:
    hikari:
      metrics:
        enabled: true  # Micrometer 통합 활성화
```

**수집되는 메트릭:**
```
hikaricp_connections_active{pool="sagalineHikariCP"}
hikaricp_connections_idle{pool="sagalineHikariCP"}
hikaricp_connections_pending{pool="sagalineHikariCP"}
hikaricp_connections_timeout_total{pool="sagalineHikariCP"}
hikaricp_connections_acquire_seconds_max{pool="sagalineHikariCP"}
```

### 2.5 Prometheus Scrape 설정

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'sagaline-backend'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8080']
        labels:
          application: 'sagaline'
          environment: 'dev'
```

---

## 3. 분산 추적 시스템 (Zipkin)

### 3.1 아키텍처

```
Request (trace-id 생성)
  ↓
Service A
  ├─ span-1: HTTP Handler
  ├─ span-2: Service Method
  ├─ span-3: DB Query
  └─ span-4: Kafka Producer
  ↓
Zipkin Reporter → Zipkin Server
```

### 3.2 Spring Boot 설정

```yaml
management:
  tracing:
    sampling:
      probability: 1.0  # 100% 샘플링 (개발 환경)
  zipkin:
    tracing:
      endpoint: http://localhost:9411/api/v2/spans
```

**Trace Context 전파:**
```
HTTP Request Headers:
  X-B3-TraceId: abc123...
  X-B3-SpanId: def456...
  X-B3-ParentSpanId: ghi789...
  X-B3-Sampled: 1

Kafka Message Headers:
  traceparent: 00-abc123...-def456...-01
```

### 3.3 커스텀 Span

```java
@Service
public class OrderService {
    @Autowired
    private Tracer tracer;

    public OrderDTO createOrder(Long userId, CreateOrderRequest request) {
        Span span = tracer.nextSpan().name("order.create");

        try (Tracer.SpanInScope ws = tracer.withSpan(span.start())) {
            span.tag("user.id", userId.toString());
            span.tag("order.amount", request.getTotalAmount().toString());

            // 주문 로직...

            span.tag("order.id", order.getId().toString());
            span.event("order.created");

            return toDTO(order);
        } finally {
            span.end();
        }
    }
}
```

### 3.4 Zipkin UI

**Trace 조회:**
```
http://localhost:9411/zipkin

Search:
  serviceName: sagaline
  spanName: order.create
  tags: user.id=10

Trace Timeline:
POST /api/orders          [200ms]
  └─ order.create          [190ms]
      ├─ cart.find          [50ms]
      ├─ order.save         [80ms]
      └─ kafka.send         [40ms]
```

---

## 4. 로깅 시스템

### 4.1 구조화된 JSON 로깅

**logback-spring.xml:**
```xml
<configuration>
    <appender name="JSON_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/sagaline.json</file>
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeMdcKeyName>trace_id</includeMdcKeyName>
            <includeMdcKeyName>span_id</includeMdcKeyName>
            <customFields>{"service":"sagaline","environment":"dev"}</customFields>
        </encoder>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/sagaline.%d{yyyy-MM-dd}.json</fileNamePattern>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
    </appender>

    <root level="INFO">
        <appender-ref ref="JSON_FILE"/>
    </root>
</configuration>
```

**JSON 로그 예시:**
```json
{
  "timestamp": "2025-11-23T10:30:00.123Z",
  "level": "INFO",
  "thread": "http-nio-8080-exec-1",
  "logger": "com.sagaline.order.service.OrderService",
  "message": "Order created successfully",
  "trace_id": "abc123def456",
  "span_id": "789ghi",
  "service": "sagaline",
  "environment": "dev",
  "order_id": "100",
  "user_id": "10",
  "amount": "2980000"
}
```

### 4.2 MDC (Mapped Diagnostic Context)

```java
@Component
public class LoggingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        HttpServletRequest httpRequest = (HttpServletRequest) request;

        // Trace ID 추출
        String traceId = httpRequest.getHeader("X-B3-TraceId");
        if (traceId != null) {
            MDC.put("trace_id", traceId);
        }

        // User ID 추가 (인증 후)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long userId) {
            MDC.put("user_id", userId.toString());
        }

        try {
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
```

---

## 5. Redis 캐싱 시스템

### 5.1 캐시 구조

**6개 캐시 영역:**
```java
@Configuration
@EnableCaching
public class RedisConfig {
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        Map<String, RedisCacheConfiguration> cacheConfigurations = Map.of(
            "products", cacheConfig(3600),       // 1시간
            "categories", cacheConfig(86400),    // 1일
            "users", cacheConfig(1800),          // 30분
            "carts", cacheConfig(600),           // 10분
            "search", cacheConfig(600),          // 10분
            "inventory", cacheConfig(300)        // 5분
        );

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(cacheConfig(3600))
            .withInitialCacheConfigurations(cacheConfigurations)
            .build();
    }

    private RedisCacheConfiguration cacheConfig(long ttlSeconds) {
        return RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofSeconds(ttlSeconds))
            .serializeKeysWith(SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(SerializationPair.fromSerializer(
                new GenericJackson2JsonRedisSerializer()
            ))
            .disableCachingNullValues();
    }
}
```

### 5.2 Cache-aside 패턴

```java
@Service
public class ProductService {
    @Cacheable(value = "products", key = "#id")
    public ProductDTO getProductById(Long id) {
        // 1. Redis 조회 (자동, @Cacheable)
        // 2. Cache MISS → DB 조회
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Product not found"));

        // 3. DTO 변환 및 Redis 저장 (자동)
        return toDTO(product);
    }

    @CacheEvict(value = "products", key = "#id")
    public ProductDTO updateProduct(Long id, UpdateProductRequest request) {
        // 업데이트 로직...
        // 캐시 무효화 (자동, @CacheEvict)
        return toDTO(product);
    }

    @CacheEvict(value = "products", allEntries = true)
    public void clearAllProductCache() {
        // 모든 상품 캐시 무효화
    }
}
```

### 5.3 캐시 오류 처리 (Fail-open)

```java
@Configuration
public class CacheErrorHandler implements org.springframework.cache.interceptor.CacheErrorHandler {
    private static final Logger log = LoggerFactory.getLogger(CacheErrorHandler.class);

    @Override
    public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
        log.error("Cache GET error: cache={}, key={}", cache.getName(), key, exception);
        // Redis 장애 시에도 서비스 계속 (DB 조회)
    }

    @Override
    public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
        log.error("Cache PUT error: cache={}, key={}", cache.getName(), key, exception);
        // Redis 저장 실패 시 무시 (다음 조회 시 DB에서 가져옴)
    }

    @Override
    public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
        log.error("Cache EVICT error: cache={}, key={}", cache.getName(), key, exception);
        // 캐시 무효화 실패 시 무시 (TTL로 만료됨)
    }

    @Override
    public void handleCacheClearError(RuntimeException exception, Cache cache) {
        log.error("Cache CLEAR error: cache={}", cache.getName(), exception);
    }
}
```

### 5.4 캐시 메트릭

```java
@Component
public class CacheMetrics {
    public CacheMetrics(MeterRegistry registry, CacheManager cacheManager) {
        cacheManager.getCacheNames().forEach(cacheName -> {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache instanceof RedisCache redisCache) {
                // Hit/Miss 메트릭
                Gauge.builder("cache.size", redisCache, this::getCacheSize)
                    .tag("cache", cacheName)
                    .description("Cache size")
                    .register(registry);
            }
        });
    }

    private double getCacheSize(RedisCache cache) {
        // Redis에서 캐시 크기 조회
        return 0.0;  // 구현 필요
    }
}
```

---

## 6. Kafka 이벤트 시스템

### 6.1 토픽 설정

```java
@Configuration
public class KafkaConfig {
    @Bean
    public NewTopic userEventsTopic() {
        return TopicBuilder.name("user-events")
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic orderEventsTopic() {
        return TopicBuilder.name("order-events")
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic paymentEventsTopic() {
        return TopicBuilder.name("payment-events")
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic inventoryEventsTopic() {
        return TopicBuilder.name("inventory-events")
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public NewTopic notificationEventsTopic() {
        return TopicBuilder.name("notification-events")
            .partitions(3)
            .replicas(1)
            .build();
    }
}
```

### 6.2 이벤트 Base Class

```java
@Data
public abstract class BaseEvent {
    private UUID eventId = UUID.randomUUID();
    private String eventType;
    private String source = "sagaline";
    private LocalDateTime timestamp = LocalDateTime.now();

    public abstract String getEventType();
}
```

### 6.3 Event Publisher (메트릭 포함)

```java
@Component
@Slf4j
public class EventPublisher {
    private final KafkaTemplate<String, BaseEvent> kafkaTemplate;
    private final MeterRegistry registry;
    private final Counter eventsPublished;
    private final Counter eventsFailed;

    public EventPublisher(KafkaTemplate<String, BaseEvent> kafkaTemplate,
                          MeterRegistry registry) {
        this.kafkaTemplate = kafkaTemplate;
        this.registry = registry;
        this.eventsPublished = Counter.builder("events.published.total")
            .description("Total events published")
            .register(registry);
        this.eventsFailed = Counter.builder("events.failed.total")
            .description("Failed event publications")
            .register(registry);
    }

    public void publish(String topic, BaseEvent event) {
        String key = event.getEventId().toString();

        kafkaTemplate.send(topic, key, event)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event: topic={}, event={}",
                        topic, event, ex);
                    eventsFailed.increment();
                } else {
                    log.info("Event published: topic={}, eventType={}, eventId={}",
                        topic, event.getEventType(), event.getEventId());
                    eventsPublished.increment();
                }
            });
    }
}
```

### 6.4 Kafka 메트릭

**Producer 메트릭:**
```
kafka_producer_record_send_total{client_id="sagaline-producer"}
kafka_producer_record_send_rate{client_id="sagaline-producer"}
kafka_producer_record_error_total{client_id="sagaline-producer"}
```

**Consumer 메트릭:**
```
kafka_consumer_records_consumed_total{client_id="sagaline-consumer"}
kafka_consumer_records_lag{client_id="sagaline-consumer",topic="order-events",partition="0"}
kafka_consumer_commit_latency_avg{client_id="sagaline-consumer"}
```

---

## 7. Rate Limiting

### 7.1 RateLimitService

```java
@Service
@Slf4j
public class RateLimitService {
    private final RedisTemplate<String, String> redisTemplate;

    public boolean isAllowed(String key, int limit, int windowSeconds) {
        String redisKey = "rate_limit:" + key;
        long now = System.currentTimeMillis();
        long windowStart = now - (windowSeconds * 1000L);

        try {
            // Sliding Window 알고리즘
            redisTemplate.opsForZSet().removeRangeByScore(redisKey, 0, windowStart);
            Long count = redisTemplate.opsForZSet().zCard(redisKey);

            if (count != null && count >= limit) {
                log.warn("Rate limit exceeded: key={}, count={}, limit={}",
                    key, count, limit);
                return false;
            }

            redisTemplate.opsForZSet().add(redisKey, String.valueOf(now), now);
            redisTemplate.expire(redisKey, windowSeconds, TimeUnit.SECONDS);

            return true;
        } catch (Exception e) {
            log.error("Rate limit check failed: key={}", key, e);
            return true;  // Fail-open
        }
    }
}
```

### 7.2 RateLimitInterceptor

```java
@Component
public class RateLimitInterceptor implements HandlerInterceptor {
    private final RateLimitService rateLimitService;

    private static final Map<String, RateLimitConfig> RATE_LIMITS = Map.of(
        "/api/auth/login", new RateLimitConfig(5, 60),      // 5회/분
        "/api/auth/register", new RateLimitConfig(3, 60),   // 3회/분
        "/api/orders", new RateLimitConfig(10, 60),         // 10회/분
        "/api/products", new RateLimitConfig(100, 60)       // 100회/분
    );

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        String uri = request.getRequestURI();
        String ip = getClientIp(request);

        RateLimitConfig config = RATE_LIMITS.get(uri);
        if (config != null) {
            String key = ip + ":" + uri;

            if (!rateLimitService.isAllowed(key, config.limit, config.windowSeconds)) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.getWriter().write("{\"error\":\"Rate limit exceeded\"}");
                return false;
            }
        }

        return true;
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }

    @Data
    @AllArgsConstructor
    private static class RateLimitConfig {
        int limit;
        int windowSeconds;
    }
}
```

---

## 8. Health Checks

### 8.1 Custom Health Indicators

```java
@Component
public class CustomHealthIndicators {
    @Bean
    public HealthIndicator databaseHealthIndicator(DataSource dataSource) {
        return () -> {
            try (Connection conn = dataSource.getConnection()) {
                return Health.up()
                    .withDetail("database", "PostgreSQL")
                    .withDetail("connection", "Available")
                    .build();
            } catch (SQLException e) {
                return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
            }
        };
    }

    @Bean
    public HealthIndicator redisHealthIndicator(RedisConnectionFactory factory) {
        return () -> {
            try {
                factory.getConnection().ping();
                return Health.up()
                    .withDetail("redis", "Available")
                    .build();
            } catch (Exception e) {
                return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
            }
        };
    }
}
```

### 8.2 Health Endpoint

**Liveness Probe:**
```
GET /actuator/health/liveness

Response:
{
  "status": "UP"
}
```

**Readiness Probe:**
```
GET /actuator/health/readiness

Response:
{
  "status": "UP",
  "components": {
    "db": {"status": "UP"},
    "redis": {"status": "UP"},
    "diskSpace": {"status": "UP"}
  }
}
```

---

## 9. Grafana 대시보드

### 9.1 대시보드 패널

**Panel 1: System Overview**
```promql
# Requests per second
rate(http_server_requests_seconds_count[5m])

# Error rate
rate(http_server_requests_seconds_count{status=~"5.."}[5m]) /
rate(http_server_requests_seconds_count[5m])

# p99 Latency
histogram_quantile(0.99, http_server_requests_seconds_bucket)
```

**Panel 2: Business Metrics**
```promql
# 시간당 회원가입 수
rate(user_registrations_total[1h]) * 3600

# 시간당 주문 수
rate(orders_created_total[1h]) * 3600

# 총 매출
sum(revenue_total)
```

**Panel 3: Database Performance**
```promql
# Active connections
hikaricp_connections_active

# Connection pool usage
hikaricp_connections_active / hikaricp_connections_max * 100

# Query duration p99
histogram_quantile(0.99, database_query_duration_seconds_bucket)
```

**Panel 4: Cache Performance**
```promql
# Hit ratio
sum(cache_gets{result="hit"}) /
sum(cache_gets) * 100

# Hit/Miss rate
rate(cache_gets{result="hit"}[5m])
rate(cache_gets{result="miss"}[5m])
```

**Panel 5: Kafka Metrics**
```promql
# Consumer lag
kafka_consumer_records_lag_max

# Messages per second
rate(kafka_producer_record_send_total[5m])
```

---

## 10. 검증 체크리스트

- [ ] Prometheus 메트릭 수집 (/actuator/prometheus)
- [ ] 비즈니스 메트릭 기록 (회원가입, 주문, 매출)
- [ ] HTTP 메트릭 수집 (응답 시간, 상태 코드)
- [ ] DB 메트릭 수집 (연결 풀, 쿼리 시간)
- [ ] Grafana 대시보드 8개 패널 시각화
- [ ] Zipkin 분산 추적 동작 확인
- [ ] Trace ID 전파 (HTTP + Kafka)
- [ ] JSON 로깅 출력 확인
- [ ] MDC Trace ID 포함 확인
- [ ] Redis 캐싱 동작 (Hit/Miss)
- [ ] 캐시 무효화 동작 (@CacheEvict)
- [ ] Kafka 이벤트 발행/구독
- [ ] Rate Limiting 동작 (429 응답)
- [ ] Health Check 엔드포인트 (Liveness/Readiness)
- [ ] Circuit Breaker 메트릭 수집
- [ ] 캐시 오류 시 Fail-open 동작
