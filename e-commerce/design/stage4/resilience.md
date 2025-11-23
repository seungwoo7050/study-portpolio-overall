# Stage 4.2: Resilience (복원력)

## 📋 목차
- [개요](#개요)
- [1. Circuit Breaker 패턴](#1-circuit-breaker-패턴)
- [2. Retry 패턴](#2-retry-패턴)
- [3. Timeout 관리](#3-timeout-관리)
- [4. Graceful Degradation](#4-graceful-degradation)
- [5. Health Checks](#5-health-checks)
- [메트릭 및 모니터링](#메트릭-및-모니터링)
- [트러블슈팅](#트러블슈팅)

---

## 개요

Stage 4.2에서는 **Resilience (복원력)** 기능을 구현하여 외부 시스템 장애 시에도 서비스가 안정적으로 동작하도록 합니다.

### 주요 기능
- **Circuit Breaker**: 장애 전파 방지 및 빠른 실패
- **Retry**: 일시적 장애 자동 복구
- **Timeout**: 무한 대기 방지
- **Graceful Degradation**: 기능 저하로 서비스 유지
- **Health Checks**: Kubernetes Liveness/Readiness 프로브

### 기술 스택
- **Resilience4j**: Circuit Breaker, Retry, TimeLimiter
- **Spring Boot Actuator**: Health Check 엔드포인트
- **Micrometer**: 메트릭 수집 및 모니터링

---

## 1. Circuit Breaker 패턴

### 1.1 개요
Circuit Breaker는 외부 시스템 장애 시 **빠른 실패(Fail Fast)**를 통해 리소스 낭비를 방지하고 장애 전파를 차단합니다.

### 1.2 Circuit Breaker 상태
```
[CLOSED] ──(실패율 50% 초과)──> [OPEN]
    ↑                              ↓
    └────────(성공)────────── [HALF_OPEN]
                                  ↓
                            (60초 대기)
```

**상태 설명**:
- **CLOSED**: 정상 상태, 모든 요청 통과
- **OPEN**: 장애 상태, 모든 요청 즉시 실패 (Fallback 실행)
- **HALF_OPEN**: 복구 테스트, 일부 요청만 허용하여 상태 확인

### 1.3 Payment Service Circuit Breaker 설정
```yaml
# application.yml:136
resilience4j:
  circuitbreaker:
    instances:
      paymentService:
        registerHealthIndicator: true
        slidingWindowSize: 10                    # 최근 10개 요청 기준
        minimumNumberOfCalls: 5                  # 최소 5개 요청 후 판단
        permittedNumberOfCallsInHalfOpenState: 3 # HALF_OPEN 상태에서 3개 테스트
        automaticTransitionFromOpenToHalfOpenEnabled: true
        waitDurationInOpenState: 60s             # OPEN 상태 60초 유지
        failureRateThreshold: 50                 # 실패율 50% 초과 시 OPEN
        eventConsumerBufferSize: 10
```

**주요 파라미터**:
| 파라미터 | 값 | 설명 |
|---------|---|------|
| `slidingWindowSize` | 10 | 최근 10개 요청의 성공/실패율 계산 |
| `minimumNumberOfCalls` | 5 | 최소 5개 요청 후 Circuit Breaker 동작 |
| `failureRateThreshold` | 50 | 실패율 50% 초과 시 OPEN 상태 전환 |
| `waitDurationInOpenState` | 60s | OPEN 상태 60초 후 HALF_OPEN으로 전환 |
| `permittedNumberOfCallsInHalfOpenState` | 3 | HALF_OPEN에서 3개 요청으로 복구 테스트 |

### 1.4 Inventory Service Circuit Breaker 설정
```yaml
# application.yml:147
resilience4j:
  circuitbreaker:
    instances:
      inventoryService:
        registerHealthIndicator: true
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        failureRateThreshold: 50
        waitDurationInOpenState: 30s  # Payment보다 짧은 대기 시간
```

### 1.5 Circuit Breaker 구현
```java
// TossPaymentClient.java:25
@CircuitBreaker(name = "paymentService", fallbackMethod = "processPaymentFallback")
@Retry(name = "paymentService")
public PaymentResult processPayment(PaymentRequest request) {
    log.info("Processing payment for order: {}, amount: {}",
            request.getOrderId(), request.getAmount());

    // 외부 결제 API 호출 (Toss Payments)
    // 실제로는 RestTemplate 또는 WebClient 사용
    // Example: restTemplate.postForObject(tossPaymentsUrl, request, PaymentResponse.class)

    String transactionId = "TOSS_" + UUID.randomUUID().toString();
    log.info("Payment processed successfully. Transaction ID: {}", transactionId);

    return PaymentResult.builder()
            .success(true)
            .transactionId(transactionId)
            .status("COMPLETED")
            .message("Payment processed successfully")
            .build();
}
```

### 1.6 Fallback 메서드
```java
// TossPaymentClient.java:54
private PaymentResult processPaymentFallback(PaymentRequest request, Exception e) {
    log.error("Payment service unavailable. Fallback triggered for order: {}. Error: {}",
            request.getOrderId(), e.getMessage());

    return PaymentResult.builder()
            .success(false)
            .transactionId(null)
            .status("PENDING")
            .message("Payment processing delayed. Your order is pending. Please try again later.")
            .build();
}
```

**Fallback 전략**:
- Circuit OPEN 시 즉시 Fallback 실행 (외부 API 호출 없음)
- 주문을 PENDING 상태로 전환
- 사용자에게 "나중에 다시 시도하라" 안내
- 백그라운드 작업으로 재처리 가능 (Kafka 이벤트 활용)

### 1.7 Circuit Breaker 동작 시나리오
```
시나리오: 결제 서비스 장애

[요청 1-4] → SUCCESS (Circuit CLOSED)
[요청 5] → FAILURE (Circuit CLOSED, 실패율 20%)
[요청 6-7] → FAILURE (Circuit CLOSED, 실패율 40%)
[요청 8-9] → FAILURE (Circuit CLOSED, 실패율 60%)
    ↓
[Circuit OPEN] → 실패율 50% 초과!
    ↓
[요청 10-20] → 즉시 Fallback 실행 (외부 API 호출 안 함)
    ↓
[60초 경과] → Circuit HALF_OPEN
    ↓
[요청 21-23] → SUCCESS (테스트 3개)
    ↓
[Circuit CLOSED] → 복구 완료!
```

---

## 2. Retry 패턴

### 2.1 개요
일시적인 네트워크 오류나 타임아웃을 **자동 재시도**로 복구합니다.

### 2.2 Inventory Service Retry 설정
```yaml
# application.yml:155
resilience4j:
  retry:
    instances:
      inventoryService:
        maxAttempts: 3                      # 최대 3회 시도
        waitDuration: 1000                  # 1초 대기
        exponentialBackoffMultiplier: 2     # 지수 백오프 (1s, 2s, 4s)
```

**Exponential Backoff 계산**:
```
1차 시도: 즉시
2차 시도: 1초 후 (1000ms)
3차 시도: 2초 후 (1000ms * 2 = 2000ms)
총 대기: 3초
```

### 2.3 Payment Service Retry 설정
```yaml
# application.yml:160
resilience4j:
  retry:
    instances:
      paymentService:
        maxAttempts: 2                      # 최대 2회 시도 (결제는 중복 방지)
        waitDuration: 2000                  # 2초 대기
        exponentialBackoffMultiplier: 1.5   # 지수 백오프 (2s, 3s)
```

**결제 서비스 Retry 전략**:
- **최대 2회**: 결제 중복 실행 방지
- **짧은 재시도**: 사용자 대기 시간 최소화
- **Idempotency Key 사용**: 중복 결제 방지 (별도 구현 필요)

### 2.4 Retry 구현
```java
// TossPaymentClient.java:25
@Retry(name = "paymentService")
public PaymentResult processPayment(PaymentRequest request) {
    // Retry 로직은 Resilience4j가 자동 처리
    // 실패 시 waitDuration만큼 대기 후 재시도
}
```

### 2.5 Retry 동작 시나리오
```
시나리오: 일시적 네트워크 오류

[1차 시도] → 네트워크 타임아웃 (500ms)
    ↓
[1초 대기] → Exponential Backoff
    ↓
[2차 시도] → 네트워크 타임아웃 (500ms)
    ↓
[2초 대기] → Exponential Backoff
    ↓
[3차 시도] → SUCCESS! ✅
```

### 2.6 Retry vs Circuit Breaker 조합
```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "processPaymentFallback")
@Retry(name = "paymentService")
public PaymentResult processPayment(PaymentRequest request) {
    // ...
}
```

**실행 순서**:
1. **Retry** 먼저 실행 (3회 재시도)
2. Retry 실패 시 **Circuit Breaker** 실패 카운트 증가
3. Circuit OPEN 시 **Fallback** 실행

---

## 3. Timeout 관리

### 3.1 개요
무한 대기를 방지하고 **제한 시간 내 응답**을 보장합니다.

### 3.2 TimeLimiter 설정
```yaml
# application.yml:166
resilience4j:
  timelimiter:
    instances:
      paymentService:
        timeoutDuration: 5s      # 결제는 5초 타임아웃
      inventoryService:
        timeoutDuration: 3s      # 재고는 3초 타임아웃
```

### 3.3 Timeout 동작
```java
// TimeLimiter는 CompletableFuture와 함께 사용
@TimeLimiter(name = "paymentService")
public CompletableFuture<PaymentResult> processPaymentAsync(PaymentRequest request) {
    return CompletableFuture.supplyAsync(() -> processPayment(request));
}
```

**Timeout 발생 시**:
- `TimeoutException` 발생
- Circuit Breaker 실패 카운트 증가
- Fallback 메서드 실행

### 3.4 Timeout 전략
| 서비스 | Timeout | 이유 |
|--------|---------|------|
| Payment | 5s | 외부 결제 API 호출 (Toss Payments) |
| Inventory | 3s | 내부 데이터베이스 조회 (빠름) |
| Search | 10s | Elasticsearch 복잡한 쿼리 허용 |

---

## 4. Graceful Degradation

### 4.1 개요
일부 기능 장애 시 **전체 서비스 중단 없이** 기능을 제한하여 서비스를 유지합니다.

### 4.2 Fail-Open 전략
```java
// RedisConfig.java (Stage 3.2)
@Override
public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
    log.error("Cache GET error. Proceeding without cache. Cache: {}, Key: {}",
            cache.getName(), key, exception);
    // 캐시 실패 시 DB에서 직접 조회 (성능 저하, 서비스 중단 없음)
}
```

**Fail-Open vs Fail-Closed**:
- **Fail-Open**: 장애 시 기능 제한하며 서비스 유지 (캐시, 검색 등)
- **Fail-Closed**: 장애 시 서비스 차단 (결제, 인증 등)

### 4.3 Redis 장애 시 Graceful Degradation
```
[정상 상태]
  캐시 조회 → 캐시 HIT → 즉시 반환 (10ms)
    ↓
[Redis 장애]
  캐시 조회 → 캐시 MISS (Redis 다운)
    ↓
  DB 조회 → 데이터 반환 (100ms)
    ↓
  사용자는 약간 느림을 느끼지만 서비스는 정상 동작 ✅
```

### 4.4 검색 기능 Graceful Degradation
```java
// Elasticsearch 장애 시
try {
    return productSearchService.search(query);
} catch (Exception e) {
    log.error("Elasticsearch unavailable. Falling back to DB search", e);
    return productService.searchByNameInDB(query);  // 덜 정확하지만 동작
}
```

### 4.5 Readiness Probe Graceful Degradation
```java
// CustomHealthIndicators.java:129
// Check Redis
try {
    redisConnectionFactory.getConnection().ping();
    builder.withDetail("redis", "ready");
} catch (Exception e) {
    // Redis는 필수가 아니므로 Readiness 실패로 처리하지 않음
    builder.withDetail("redis", "unavailable (degraded mode)");
}
```

**전략**:
- **필수 의존성**: DB 장애 시 Readiness FAIL → 트래픽 차단
- **선택적 의존성**: Redis 장애 시 Readiness UP → 기능 저하 모드

---

## 5. Health Checks

### 5.1 개요
Kubernetes가 Pod의 **생존 여부(Liveness)**와 **트래픽 수용 가능 여부(Readiness)**를 판단합니다.

### 5.2 Liveness Probe
```java
// CustomHealthIndicators.java:73
@Bean
public HealthIndicator livenessProbe(ApplicationAvailability availability) {
    return () -> {
        LivenessState livenessState = availability.getLivenessState();

        if (livenessState == LivenessState.CORRECT) {
            return Health.up()
                    .withDetail("state", livenessState.toString())
                    .withDetail("description", "Application is alive")
                    .build();
        }

        return Health.status(new Status("FATAL"))
                .withDetail("state", livenessState.toString())
                .withDetail("description", "Application is not alive")
                .build();
    };
}
```

**Liveness Probe 용도**:
- 애플리케이션이 **살아있는지** 확인
- 실패 시 Kubernetes가 **Pod 재시작**
- 데드락, OutOfMemoryError 등 복구 불가능한 상태 감지

**Kubernetes 설정**:
```yaml
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### 5.3 Readiness Probe
```java
// CustomHealthIndicators.java:97
@Bean
public HealthIndicator readinessProbe(ApplicationAvailability availability,
                                     DataSource dataSource,
                                     RedisConnectionFactory redisConnectionFactory) {
    return () -> {
        ReadinessState readinessState = availability.getReadinessState();

        // Check if application is ready
        if (readinessState != ReadinessState.ACCEPTING_TRAFFIC) {
            return Health.outOfService()
                    .withDetail("state", readinessState.toString())
                    .withDetail("description", "Application not ready to accept traffic")
                    .build();
        }

        // Check critical dependencies
        Health.Builder builder = Health.up();

        // Check database
        try (Connection connection = dataSource.getConnection()) {
            if (!connection.isValid(2)) {
                return Health.down()
                        .withDetail("database", "unavailable")
                        .build();
            }
            builder.withDetail("database", "ready");
        } catch (Exception e) {
            return Health.down()
                    .withDetail("database", "error: " + e.getMessage())
                    .build();
        }

        // Check Redis (optional)
        try {
            redisConnectionFactory.getConnection().ping();
            builder.withDetail("redis", "ready");
        } catch (Exception e) {
            // Redis is optional, don't fail readiness
            builder.withDetail("redis", "unavailable (degraded mode)");
        }

        return builder
                .withDetail("state", readinessState.toString())
                .withDetail("description", "Application ready to serve traffic")
                .build();
    };
}
```

**Readiness Probe 용도**:
- 애플리케이션이 **트래픽을 받을 준비**가 되었는지 확인
- 실패 시 Kubernetes가 **트래픽 차단** (Pod는 유지)
- DB 연결 실패, 초기화 진행 중 등 일시적 상태

**Kubernetes 설정**:
```yaml
readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

### 5.4 Database Health Indicator
```java
// CustomHealthIndicators.java:29
@Bean
public HealthIndicator dbHealthIndicator(DataSource dataSource) {
    return () -> {
        try (Connection connection = dataSource.getConnection()) {
            if (connection.isValid(2)) {
                return Health.up()
                        .withDetail("database", "PostgreSQL")
                        .withDetail("validationQuery", "Connection validated")
                        .build();
            }
        } catch (Exception e) {
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
        return Health.down().withDetail("error", "Connection invalid").build();
    };
}
```

### 5.5 Redis Health Indicator
```java
// CustomHealthIndicators.java:52
@Bean
public HealthIndicator redisHealthIndicator(RedisConnectionFactory redisConnectionFactory) {
    return () -> {
        try {
            redisConnectionFactory.getConnection().ping();
            return Health.up()
                    .withDetail("redis", "Connected")
                    .build();
        } catch (Exception e) {
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    };
}
```

### 5.6 Health Check 엔드포인트
```yaml
# application.yml:76
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus,info
      base-path: /actuator
  endpoint:
    health:
      show-details: when-authorized
```

**엔드포인트**:
- `/actuator/health`: 전체 Health 상태
- `/actuator/health/liveness`: Liveness Probe
- `/actuator/health/readiness`: Readiness Probe
- `/actuator/health/db`: Database Health
- `/actuator/health/redis`: Redis Health

### 5.7 Health Check 응답 예시
```json
// GET /actuator/health/readiness
{
  "status": "UP",
  "details": {
    "state": "ACCEPTING_TRAFFIC",
    "description": "Application ready to serve traffic",
    "database": "ready",
    "redis": "ready"
  }
}
```

---

## 메트릭 및 모니터링

### Circuit Breaker 메트릭
```java
// Resilience4j가 자동으로 메트릭 수집
meterRegistry.counter("resilience4j.circuitbreaker.calls",
    Tags.of("name", "paymentService", "kind", "successful")).increment();
meterRegistry.counter("resilience4j.circuitbreaker.calls",
    Tags.of("name", "paymentService", "kind", "failed")).increment();
meterRegistry.gauge("resilience4j.circuitbreaker.state",
    Tags.of("name", "paymentService"), circuitBreaker, cb -> cb.getState().getOrder());
```

### Grafana 대시보드 쿼리
```promql
# Circuit Breaker 상태
resilience4j_circuitbreaker_state{name="paymentService"}
# 0 = CLOSED, 1 = OPEN, 2 = HALF_OPEN

# Circuit Breaker 실패율
rate(resilience4j_circuitbreaker_calls_total{name="paymentService",kind="failed"}[5m]) /
rate(resilience4j_circuitbreaker_calls_total{name="paymentService"}[5m]) * 100

# Retry 성공률
rate(resilience4j_retry_calls_total{name="inventoryService",kind="successful_with_retry"}[5m])

# Timeout 발생 건수
increase(resilience4j_timelimiter_calls_total{name="paymentService",kind="timeout"}[1h])

# Readiness Probe 실패율
rate(http_server_requests_total{uri="/actuator/health/readiness",status="503"}[5m])
```

### Alerting 규칙
```yaml
# prometheus/alerts.yml
- alert: CircuitBreakerOpen
  expr: resilience4j_circuitbreaker_state{name="paymentService"} == 1
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Payment service circuit breaker is OPEN"
    description: "Circuit breaker for {{ $labels.name }} has been OPEN for 1 minute"

- alert: HighRetryRate
  expr: rate(resilience4j_retry_calls_total{kind="successful_with_retry"}[5m]) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High retry rate detected"
    description: "Retry rate is {{ $value }} per second"

- alert: ReadinessProbeFailure
  expr: up{job="sagaline"} == 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Readiness probe failing"
    description: "Pod {{ $labels.instance }} is not ready for 2 minutes"
```

---

## 트러블슈팅

### 문제 1: Circuit Breaker가 계속 OPEN 상태
**증상**:
```
resilience4j_circuitbreaker_state{name="paymentService"} == 1
```

**원인**:
- 외부 서비스(Toss Payments) 장애
- 네트워크 연결 문제

**해결**:
```bash
# 1. 외부 서비스 상태 확인
curl -v https://api.tosspayments.com/v1/health

# 2. Circuit Breaker 수동 초기화 (Emergency)
curl -X POST /actuator/circuitbreakers/paymentService/reset

# 3. Fallback이 정상 동작하는지 확인
# 로그에서 "Fallback triggered" 확인
```

### 문제 2: Retry 무한 반복
**증상**:
- 로그에 동일한 요청이 계속 재시도됨

**원인**:
- Retry 설정 오류
- Circuit Breaker 미설정

**해결**:
```yaml
# application.yml에서 maxAttempts 확인
resilience4j:
  retry:
    instances:
      paymentService:
        maxAttempts: 2  # 최대 2회로 제한
```

### 문제 3: Readiness Probe 실패로 트래픽 차단
**증상**:
```
Readiness probe failed: HTTP probe failed with statuscode: 503
```

**원인**:
- DB 연결 실패
- 애플리케이션 초기화 지연

**해결**:
```bash
# 1. DB 연결 확인
kubectl exec -it <pod-name> -- psql -h localhost -U postgres -d sagaline

# 2. Readiness Probe 설정 조정
# initialDelaySeconds 증가
livenessProbe:
  initialDelaySeconds: 60  # 30s → 60s

# 3. Health 엔드포인트 직접 확인
curl http://localhost:8080/actuator/health/readiness
```

### 문제 4: Liveness Probe 실패로 Pod 재시작 반복
**증상**:
```
Liveness probe failed: Get http://<pod-ip>:8080/actuator/health/liveness: dial tcp <pod-ip>:8080: connect: connection refused
Pod restarted 10 times
```

**원인**:
- 애플리케이션 시작 시간 부족
- OutOfMemoryError
- 데드락

**해결**:
```bash
# 1. Pod 로그 확인
kubectl logs <pod-name> --previous

# 2. Liveness Probe 설정 조정
livenessProbe:
  initialDelaySeconds: 60      # 시작 시간 충분히 확보
  periodSeconds: 30            # 체크 주기 길게
  timeoutSeconds: 10           # 타임아웃 길게
  failureThreshold: 5          # 실패 허용 횟수 증가

# 3. 메모리 리소스 증가
resources:
  limits:
    memory: 1Gi
  requests:
    memory: 512Mi
```

### 문제 5: Timeout 너무 짧아서 정상 요청도 실패
**증상**:
```
TimeoutException: paymentService did not respond within 5 seconds
```

**원인**:
- 외부 API 응답 시간 증가
- Timeout 설정이 너무 짧음

**해결**:
```yaml
# application.yml에서 timeoutDuration 증가
resilience4j:
  timelimiter:
    instances:
      paymentService:
        timeoutDuration: 10s  # 5s → 10s
```

### 문제 6: Fallback 메서드가 실행되지 않음
**증상**:
- Circuit OPEN 상태인데도 Exception 발생

**원인**:
- Fallback 메서드 시그니처 불일치
- Fallback 메서드 접근 제한자 오류

**해결**:
```java
// Fallback 메서드는 원본 메서드와 동일한 파라미터 + Exception
@CircuitBreaker(name = "paymentService", fallbackMethod = "processPaymentFallback")
public PaymentResult processPayment(PaymentRequest request) { ... }

// Fallback 메서드 시그니처 확인
private PaymentResult processPaymentFallback(PaymentRequest request, Exception e) { ... }
//      ↑ 반환 타입 일치
//                                            ↑ 파라미터 일치
//                                                           ↑ Exception 추가
```

---

## 정리

Stage 4.2에서는 다음과 같은 **Resilience (복원력)** 기능을 구현했습니다:

1. ✅ **Circuit Breaker**: 장애 전파 방지 (Payment/Inventory 서비스)
2. ✅ **Retry with Exponential Backoff**: 일시적 장애 자동 복구
3. ✅ **Timeout Management**: 무한 대기 방지 (5s/3s 타임아웃)
4. ✅ **Graceful Degradation**: Fail-Open 전략으로 서비스 유지
5. ✅ **Health Checks**: Liveness/Readiness 프로브로 Kubernetes 통합
6. ✅ **메트릭 수집**: Circuit Breaker 상태, Retry 성공률 모니터링

**전체 Stage 4 완료**: Security + Resilience로 **프로덕션 수준의 안정성** 확보!

다음 단계: **Stage 5 - Microservices** (모놀리스 → 마이크로서비스 전환)
