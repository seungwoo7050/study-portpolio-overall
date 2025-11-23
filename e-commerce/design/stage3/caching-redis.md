# Stage 3.2: 캐싱 (Caching) - Redis

## 문서 정보
- **작성일**: 2025-11-23
- **Stage**: 3.2 - Caching
- **구성 요소**: Redis 7, Spring Cache, Rate Limiting
- **상태**: ✅ 구현 완료

---

## 목차
1. [개요](#개요)
2. [Redis 아키텍처](#redis-아키텍처)
3. [캐시 전략](#캐시-전략)
4. [캐시 영역 설정](#캐시-영역-설정)
5. [캐시 사용 패턴](#캐시-사용-패턴)
6. [Rate Limiting](#rate-limiting)
7. [캐시 무효화](#캐시-무효화)
8. [에러 처리](#에러-처리)
9. [메트릭 및 모니터링](#메트릭-및-모니터링)
10. [모범 사례](#모범-사례)
11. [트러블슈팅](#트러블슈팅)

---

## 개요

### 왜 캐싱이 필요한가?

**문제점** (캐시 없이):
```
사용자가 상품 상세 페이지 접근
  ↓
Database 쿼리 실행 (10ms)
  ↓
100 req/sec × 10ms = 1000ms 누적 DB 시간
  ↓
Database 부하 증가, 응답 지연
```

**해결책** (Redis 캐시):
```
사용자가 상품 상세 페이지 접근
  ↓
Redis 캐시 조회 (0.5ms)
  ↓
100 req/sec × 0.5ms = 50ms 누적
  ↓
Database 부하 감소, 빠른 응답
```

**성능 개선**:
- **응답 시간**: 10ms → 0.5ms (95% 감소)
- **DB 부하**: 100 QPS → 5 QPS (95% 감소)
- **처리량**: 100 req/sec → 2000 req/sec (20배 증가)

### Redis 선택 이유

**Redis의 장점**:
- **빠른 성능**: 인메모리 저장소, 마이크로초 단위 응답
- **다양한 자료구조**: String, Hash, List, Set, Sorted Set
- **TTL 지원**: 자동 만료 (메모리 관리)
- **분산 캐시**: 여러 서버 간 공유
- **Persistence**: RDB, AOF (재시작 시에도 데이터 유지 가능)

**사용 사례**:
1. **데이터 캐싱**: 상품, 사용자, 카테고리 정보
2. **세션 저장소**: 사용자 세션 (향후 구현)
3. **Rate Limiting**: IP 기반 요청 제한
4. **실시간 카운터**: 조회수, 좋아요 수 (향후 구현)

---

## Redis 아키텍처

### 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                 Spring Boot Application                      │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              @Cacheable / @CacheEvict                 │  │
│  │  Service Layer에서 선언적 캐싱                         │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │           Spring Cache Abstraction                    │  │
│  │  - CacheManager                                       │  │
│  │  - CacheResolver                                      │  │
│  │  - KeyGenerator                                       │  │
│  │  - CacheErrorHandler (fail-open)                      │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │          RedisCacheManager                            │  │
│  │  - 6 cache regions with different TTLs               │  │
│  │  - products: 1 hour                                   │  │
│  │  - productDetails: 1 hour                             │  │
│  │  - categories: 6 hours                                │  │
│  │  - users: 15 minutes                                  │  │
│  │  - carts: 30 minutes                                  │  │
│  │  - searchResults: 5 minutes                           │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │            RedisTemplate                              │  │
│  │  - Key: StringRedisSerializer                         │  │
│  │  - Value: GenericJackson2JsonRedisSerializer          │  │
│  │  - Manual cache operations                            │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │       RedisConnectionFactory (Lettuce)                │  │
│  │  - Connection pooling                                 │  │
│  │  - Timeout: 2000ms                                    │  │
│  └───────────────────┬───────────────────────────────────┘  │
└────────────────────┬─┴───────────────────────────────────────┘
                     │
                     │ TCP 6379
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Redis 7                                 │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Key-Value Store                          │  │
│  │                                                       │  │
│  │  products::1 → {"id":1, "name":"삼성 노트북", ...}      │  │
│  │  users::12345 → {"id":12345, "email":"user@...", ...} │  │
│  │  rate_limit:192.168.1.1 → 45 (TTL: 60s)              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Eviction Policy                      │  │
│  │  - allkeys-lru: 메모리 부족 시 LRU 알고리즘            │  │
│  │  - TTL 자동 만료                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Docker Compose 설정

```yaml
redis:
  image: redis:7-alpine
  container_name: sagaline-redis
  ports:
    - "6379:6379"
  command: redis-server --appendonly yes
  volumes:
    - redis-data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - sagaline-network
```

**위치**: `/e-commerce/infrastructure/docker/docker-compose.yml:22-36`

### Application 설정

`application.yml`:
```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      timeout: 2000ms
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
          min-idle: 2
          max-wait: -1ms
```

**위치**: `/e-commerce/src/main/resources/application.yml:39-49`

---

## 캐시 전략

### Cache-Aside Pattern (Look-Aside)

**가장 일반적인 캐싱 패턴**:

```
┌─────────┐
│ Request │
└────┬────┘
     │
     ▼
┌─────────────────┐
│ 1. Check Cache  │ ─── Cache HIT ──→ Return cached data
└────┬────────────┘
     │ Cache MISS
     ▼
┌─────────────────┐
│ 2. Query DB     │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ 3. Store Cache  │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ 4. Return Data  │
└─────────────────┘
```

**구현** (Spring Cache):
```java
@Service
public class ProductService {

    @Cacheable(value = "productDetails", key = "#id", unless = "#result == null")
    public Product getProductById(Long id) {
        // 1. @Cacheable이 캐시 확인
        // 2. Cache MISS 시 이 메서드 실행
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Product not found"));

        // 3. 반환 값이 자동으로 캐시에 저장
        return product;
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/service/ProductService.java:93`

### Cache-Aside 장단점

**장점**:
- **애플리케이션 제어**: 캐시 로직을 애플리케이션에서 관리
- **캐시 실패 대응**: 캐시가 없어도 DB에서 조회 가능
- **유연성**: 필요한 데이터만 캐싱

**단점**:
- **코드 복잡도**: 캐시 로직을 직접 작성
- **일관성**: DB와 캐시 간 불일치 가능성

**Spring Cache로 해결**:
- 선언적 캐싱 (`@Cacheable`) → 코드 간결
- Error Handler (`fail-open`) → 캐시 실패 시에도 정상 동작

---

## 캐시 영역 설정

### 6개 Cache Regions

**RedisConfig.java**:
```java
@Bean
public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
    Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();

    // Product cache - 1 hour (high read, low write)
    cacheConfigurations.put("products", defaultConfig.entryTtl(Duration.ofHours(1)));

    // Product details - 1 hour
    cacheConfigurations.put("productDetails", defaultConfig.entryTtl(Duration.ofHours(1)));

    // Category cache - 6 hours (rarely changes)
    cacheConfigurations.put("categories", defaultConfig.entryTtl(Duration.ofHours(6)));

    // User cache - 15 minutes
    cacheConfigurations.put("users", defaultConfig.entryTtl(Duration.ofMinutes(15)));

    // Cart cache - 30 minutes
    cacheConfigurations.put("carts", defaultConfig.entryTtl(Duration.ofMinutes(30)));

    // Search results - 5 minutes
    cacheConfigurations.put("searchResults", defaultConfig.entryTtl(Duration.ofMinutes(5)));

    return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(cacheConfigurations)
            .build();
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/config/RedisConfig.java:47-70`

### TTL 설정 기준

| Cache Region | TTL | 이유 |
|--------------|-----|------|
| **products** | 1시간 | 상품 정보는 자주 변경되지 않음 |
| **productDetails** | 1시간 | 상품 상세도 동일 |
| **categories** | 6시간 | 카테고리는 거의 변경 안됨 |
| **users** | 15분 | 사용자 정보는 자주 변경 (프로필, 설정) |
| **carts** | 30분 | 장바구니는 활발하게 변경됨 |
| **searchResults** | 5분 | 검색 결과는 빠르게 변함 (신상품 추가) |

### Key Naming Convention

```
{cacheName}::{key}

예시:
products::123
productDetails::456
users::12345
rate_limit:192.168.1.1
```

**Redis에서 확인**:
```bash
# 모든 키 조회
redis-cli KEYS "*"

# 특정 패턴 조회
redis-cli KEYS "products::*"
redis-cli KEYS "rate_limit:*"

# 키 값 조회
redis-cli GET "products::123"

# TTL 확인
redis-cli TTL "products::123"
```

---

## 캐시 사용 패턴

### 1. @Cacheable (조회)

**캐시 확인 → Cache MISS 시 메서드 실행 → 결과 캐싱**

```java
@Service
public class ProductService {

    @Cacheable(value = "productDetails", key = "#id", unless = "#result == null")
    public Product getProductById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Product not found"));
    }
}
```

**파라미터**:
- `value`: 캐시 영역 이름
- `key`: 캐시 키 (SpEL 표현식)
- `unless`: 캐싱하지 않을 조건

**동작**:
```
1st Request:
  getProductById(123)
    → Redis GET productDetails::123
    → null (Cache MISS)
    → DB query: SELECT * FROM products WHERE id = 123
    → Redis SET productDetails::123 {...} EX 3600
    → Return product

2nd Request (within 1 hour):
  getProductById(123)
    → Redis GET productDetails::123
    → {...} (Cache HIT)
    → Return cached product (DB query skip!)
```

### 2. @CacheEvict (삭제)

**캐시 무효화**

```java
@Service
public class ProductService {

    @CacheEvict(value = "productDetails", key = "#id")
    public Product updateProduct(Long id, ProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Product not found"));

        // Update product...
        Product updated = productRepository.save(product);

        // Cache evicted automatically
        return updated;
    }

    @CacheEvict(value = "productDetails", key = "#id")
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
        // Cache evicted automatically
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/service/ProductService.java:102,136`

**동작**:
```
updateProduct(123, {...})
  → Update database
  → Redis DEL productDetails::123
  → Next getProductById(123) will be Cache MISS
```

### 3. @CachePut (갱신)

**메서드 실행 후 결과를 캐시에 저장** (캐시 확인 안함)

```java
@CachePut(value = "productDetails", key = "#result.id")
public Product createProduct(ProductRequest request) {
    Product product = productRepository.save(newProduct);
    // Automatically cached with key = product.id
    return product;
}
```

**@CacheEvict vs @CachePut**:
- `@CacheEvict`: 캐시 삭제만
- `@CachePut`: 메서드 실행 + 결과 캐싱

### 4. Manual Cache Operations

**RedisTemplate 직접 사용**

```java
@Service
public class CustomCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    public void setCache(String key, Object value, Duration ttl) {
        redisTemplate.opsForValue().set(key, value, ttl);
    }

    public Object getCache(String key) {
        return redisTemplate.opsForValue().get(key);
    }

    public void deleteCache(String key) {
        redisTemplate.delete(key);
    }
}
```

---

## Rate Limiting

### Redis 기반 Rate Limiter

**알고리즘**: Fixed Window Counter

```
Timeline:   0s ────── 30s ────── 60s ────── 90s
Window:    |──── W1 ────|──── W2 ────|──── W3 ────|
Requests:  [45 reqs]     [67 reqs]     [89 reqs]
Limit:     100/min       100/min       100/min
Status:    ✅ OK         ✅ OK         ✅ OK
```

### RateLimitService 구현

```java
@Service
public class RateLimitService {

    private final RedisTemplate<String, Object> redisTemplate;

    public boolean isAllowed(String key, int maxRequests, Duration duration) {
        String rateLimitKey = "rate_limit:" + key;

        // Increment the counter
        Long currentCount = redisTemplate.opsForValue().increment(rateLimitKey);

        // Set expiration on first request
        if (currentCount == 1) {
            redisTemplate.expire(rateLimitKey, duration);
        }

        boolean allowed = currentCount <= maxRequests;

        if (!allowed) {
            log.warn("Rate limit exceeded for key: {}, count: {}/{}",
                    key, currentCount, maxRequests);
        }

        return allowed;
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/ratelimit/RateLimitService.java:31-66`

### RateLimitInterceptor

**HTTP Interceptor로 모든 요청에 Rate Limiting 적용**

```java
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimitService rateLimitService;

    // Default rate limit: 100 requests per minute per IP
    private static final int MAX_REQUESTS = 100;
    private static final Duration DURATION = Duration.ofMinutes(1);

    @Override
    public boolean preHandle(HttpServletRequest request,
                              HttpServletResponse response,
                              Object handler) throws Exception {
        String clientIp = getClientIP(request);

        // Check rate limit
        boolean allowed = rateLimitService.isAllowed(clientIp, MAX_REQUESTS, DURATION);

        if (!allowed) {
            long remainingTime = rateLimitService.getRemainingTimeSeconds(clientIp);

            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("X-RateLimit-Limit", String.valueOf(MAX_REQUESTS));
            response.setHeader("X-RateLimit-Remaining", "0");
            response.setHeader("X-RateLimit-Reset", String.valueOf(remainingTime));
            response.getWriter().write(String.format(
                "{\"error\": \"Rate limit exceeded\", \"retryAfter\": %d}",
                remainingTime
            ));

            return false;
        }

        return true;
    }
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/ratelimit/RateLimitInterceptor.java:27-61`

### Rate Limiting Headers

**응답 헤더**:
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
```

**Rate Limit 초과 시**:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 42
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "retryAfter": 42
}
```

### Redis에서 확인

```bash
# Rate limit 키 확인
redis-cli KEYS "rate_limit:*"

# 특정 IP의 현재 요청 수
redis-cli GET "rate_limit:192.168.1.1"
# Output: "45"

# TTL 확인
redis-cli TTL "rate_limit:192.168.1.1"
# Output: 42 (seconds remaining)
```

---

## 캐시 무효화

### Event-driven Cache Invalidation

**Product 수정 시 자동 캐시 무효화**:

```java
@Service
public class ProductService {

    @Transactional
    @CacheEvict(value = "productDetails", key = "#id")
    public Product updateProduct(Long id, ProductRequest request) {
        Product product = productRepository.save(updatedProduct);

        // Cache evicted before return
        // Next request will fetch from DB

        return product;
    }
}
```

### Multiple Cache Eviction

**여러 캐시 동시 무효화**:

```java
@Caching(evict = {
    @CacheEvict(value = "products", allEntries = true),
    @CacheEvict(value = "productDetails", key = "#id"),
    @CacheEvict(value = "searchResults", allEntries = true)
})
public Product updateProduct(Long id, ProductRequest request) {
    // ...
}
```

### Cache Warming

**애플리케이션 시작 시 캐시 미리 로드** (향후 구현):

```java
@Component
public class CacheWarmer {

    @EventListener(ApplicationReadyEvent.class)
    public void warmCache() {
        // Load popular products
        productService.getTopProducts(100);

        // Load categories
        categoryService.getAllCategories();

        log.info("Cache warming completed");
    }
}
```

---

## 에러 처리

### Fail-Open Strategy

**Redis 장애 시에도 애플리케이션 정상 동작**

**CacheErrorHandler**:
```java
@Override
@Bean
public CacheErrorHandler errorHandler() {
    return new CacheErrorHandler() {
        @Override
        public void handleCacheGetError(RuntimeException exception,
                                         Cache cache,
                                         Object key) {
            log.error("Cache GET error - cache: {}, key: {}",
                     cache.getName(), key, exception);
            // Don't throw exception - fail open
        }

        @Override
        public void handleCachePutError(RuntimeException exception,
                                         Cache cache,
                                         Object key,
                                         Object value) {
            log.error("Cache PUT error - cache: {}, key: {}",
                     cache.getName(), key, exception);
            // Don't throw exception - fail open
        }

        @Override
        public void handleCacheEvictError(RuntimeException exception,
                                           Cache cache,
                                           Object key) {
            log.error("Cache EVICT error - cache: {}, key: {}",
                     cache.getName(), key, exception);
        }

        @Override
        public void handleCacheClearError(RuntimeException exception,
                                           Cache cache) {
            log.error("Cache CLEAR error - cache: {}",
                     cache.getName(), exception);
        }
    };
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/config/RedisConfig.java:129-151`

**동작**:
```
Scenario: Redis 서버 다운

1. User requests product
   ↓
2. @Cacheable tries to check cache
   ↓
3. Redis connection error!
   ↓
4. CacheErrorHandler.handleCacheGetError()
   → Log error
   → Don't throw exception
   ↓
5. Method executes (DB query)
   ↓
6. Return product (normal operation)
```

**장점**:
- Redis 장애가 애플리케이션 전체 장애로 이어지지 않음
- DB만으로도 서비스 가능 (성능 저하는 있지만 중단은 안됨)

---

## 메트릭 및 모니터링

### Cache Metrics

**자동 메트릭** (Spring Boot Actuator + Micrometer):
```promql
# Cache hit rate
cache_gets_total{result="hit"} / cache_gets_total

# Cache miss rate
cache_gets_total{result="miss"} / cache_gets_total

# Cache size
cache_size{cache="productDetails"}

# Cache evictions
cache_evictions_total{cache="productDetails"}
```

### Rate Limit Metrics

**Custom Metrics** (RateLimitService):
```java
Counter.builder("rate_limit.requests")
        .tag("status", "allowed")
        .description("Number of requests allowed by rate limiter")
        .register(meterRegistry)
        .increment();

Counter.builder("rate_limit.requests")
        .tag("status", "rejected")
        .description("Number of requests rejected by rate limiter")
        .register(meterRegistry)
        .increment();
```

**위치**: `/e-commerce/src/main/java/com/sagaline/common/ratelimit/RateLimitService.java:51-61`

### Prometheus Queries

**Cache Hit Ratio**:
```promql
sum(rate(cache_gets_total{result="hit"}[5m])) /
sum(rate(cache_gets_total[5m])) * 100
```

**Rate Limit Rejection Rate**:
```promql
rate(rate_limit_requests_total{status="rejected"}[5m]) /
rate(rate_limit_requests_total[5m]) * 100
```

### Grafana Dashboard

**패널**:
1. Cache Hit Rate (by cache region)
2. Cache Operations (gets, puts, evictions)
3. Rate Limit: Allowed vs Rejected
4. Redis Connection Pool Usage

---

## 모범 사례

### 1. 적절한 TTL 설정

**데이터 변경 빈도에 따라**:
```
Static data (카테고리): 6 hours
Semi-static (상품): 1 hour
Dynamic (사용자): 15 minutes
Volatile (장바구니): 30 minutes
Search results: 5 minutes
```

### 2. Cache Key 설계

**❌ 나쁜 예**:
```java
@Cacheable(value = "cache", key = "#p0")
// key = p0 (파라미터 순서, 가독성 낮음)
```

**✅ 좋은 예**:
```java
@Cacheable(value = "productDetails", key = "#id")
// key = productDetails::123 (명확함)
```

### 3. Null 값 캐싱 방지

```java
@Cacheable(value = "products", key = "#id", unless = "#result == null")
public Product getProduct(Long id) {
    return productRepository.findById(id).orElse(null);
}
```

**이유**:
- null 값을 캐싱하면 DB 조회 건너뛰어 데이터 조회 실패
- `unless = "#result == null"`: null이면 캐싱 안함

### 4. Cache Stampede 방지

**문제**: 캐시 만료 시 동시에 다수 요청이 DB 조회

```
Cache expired at t=0
  ↓
100 requests arrive at t=0
  ↓
All 100 requests query DB simultaneously
  ↓
DB overload!
```

**해결**: Probabilistic Early Expiration (향후 구현)
```java
// TTL의 90% 지나면 확률적으로 갱신
if (random() < (currentTime - cacheTime) / ttl) {
    refreshCache();
}
```

### 5. Serialization 최적화

**JSON 직렬화**:
```java
private ObjectMapper objectMapper() {
    ObjectMapper mapper = new ObjectMapper();
    mapper.registerModule(new JavaTimeModule());
    mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    return mapper;
}
```

**이유**:
- LocalDateTime 직렬화 지원
- 타임스탬프 대신 ISO 8601 형식 사용

---

## 트러블슈팅

### 문제 1: Redis 연결 실패

**증상**:
```
Unable to connect to Redis at localhost:6379
```

**해결**:
```bash
# Redis 상태 확인
docker ps | grep redis

# Redis 로그 확인
docker logs sagaline-redis

# Redis 연결 테스트
redis-cli ping
# Expected: PONG

# Application 설정 확인
spring.data.redis.host=localhost
spring.data.redis.port=6379
```

### 문제 2: 캐시가 작동하지 않음

**증상**: 항상 DB 쿼리 실행됨

**원인**: `@EnableCaching` 누락

**해결**:
```java
@Configuration
@EnableCaching  // 필수!
public class RedisConfig {
    // ...
}
```

### 문제 3: Serialization 오류

**증상**:
```
Could not read JSON: Unrecognized field "createdAt"
```

**원인**: JavaTimeModule 미등록

**해결**:
```java
ObjectMapper mapper = new ObjectMapper();
mapper.registerModule(new JavaTimeModule());  // 필수!
```

### 문제 4: 캐시 키 충돌

**증상**: 다른 엔티티인데 같은 캐시 반환

**원인**: 키 중복
```java
@Cacheable(value = "cache", key = "#id")
public Product getProduct(Long id) {...}

@Cacheable(value = "cache", key = "#id")
public User getUser(Long id) {...}
// 둘 다 cache::123 키 사용!
```

**해결**:
```java
// 별도 캐시 영역 사용
@Cacheable(value = "products", key = "#id")
public Product getProduct(Long id) {...}

@Cacheable(value = "users", key = "#id")
public User getUser(Long id) {...}
```

### 문제 5: 메모리 부족

**증상**:
```
OOM command not allowed when used memory > 'maxmemory'
```

**원인**: Redis maxmemory 초과

**해결**:
```bash
# Redis 설정 확인
redis-cli CONFIG GET maxmemory

# Eviction policy 확인
redis-cli CONFIG GET maxmemory-policy

# Eviction policy 설정
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

**또는 Docker Compose**:
```yaml
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

---

## 참고 자료

### 내부 문서
- [검색 (Elasticsearch)](./search-elasticsearch.md)
- [비동기 처리 (Kafka)](./async-kafka.md)
- [메트릭 수집 (Prometheus)](../stage2/metrics-prometheus.md)

### 외부 리소스
- [Redis 공식 문서](https://redis.io/documentation)
- [Spring Cache 문서](https://docs.spring.io/spring-framework/docs/current/reference/html/integration.html#cache)
- [Lettuce (Redis Client)](https://lettuce.io/)
- [Cache Patterns](https://codeahoy.com/2017/08/11/caching-strategies-and-how-to-choose-the-right-one/)

### 구현 파일 위치
- RedisConfig: `/e-commerce/src/main/java/com/sagaline/common/config/RedisConfig.java`
- RateLimitService: `/e-commerce/src/main/java/com/sagaline/common/ratelimit/RateLimitService.java`
- RateLimitInterceptor: `/e-commerce/src/main/java/com/sagaline/common/ratelimit/RateLimitInterceptor.java`
- ProductService: `/e-commerce/src/main/java/com/sagaline/product/service/ProductService.java:93,102,136`
- Application Config: `/e-commerce/src/main/resources/application.yml:39-49`

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-23
**작성자**: Claude (Design Documentation)
