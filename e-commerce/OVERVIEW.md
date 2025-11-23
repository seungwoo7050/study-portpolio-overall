# Sagaline – E-commerce Platform

## Project Overview

Production-quality e-commerce backend for Korean market, evolving from monolith to cloud-native microservices.

**Prerequisites**: Phase 1 (mini-spring) complete  
**Duration**: 36 weeks (phase 1: 24 weeks, phase 2: 12 weeks)  
**Deliverables**: 3 checkpoints representing career progression

## Three Checkpoints (Career Stages)

**Checkpoint: Core** (Stage 1-4 complete, 18 weeks) → Entry-level backend engineer  
**Checkpoint: Scale** (+ Stage 5, 25 weeks) → Mid-level backend engineer  
**Checkpoint: Cloud** (+ Stage 6-9, 36 weeks) → Senior backend engineer

## Tech Stack

**Framework**: Spring Boot 3.x (Java 17+) or Django 4.x (Python 3.11+)  
**Database**: PostgreSQL 15+  
**Cache**: Redis 7+  
**Search**: Elasticsearch 8.x with Nori tokenizer  
**Message Queue**: Apache Kafka 3.x  
**Monitoring**: Prometheus, Grafana, ELK Stack  
**Container**: Docker, Kubernetes  
**Korean Market**: Kakao OAuth, Toss Payments, PIPA compliance

## Project Structure

```
sagaline/
├── services/                    # phase 2: Microservices
│   ├── user-service/
│   ├── product-service/
│   ├── order-service/
│   ├── payment-service/
│   └── inventory-service/
├── src/                         # phase 1: Monolith
│   ├── main/
│   │   ├── java/ or python/
│   │   │   └── com.sagaline/
│   │   │       ├── user/
│   │   │       ├── product/
│   │   │       ├── order/
│   │   │       ├── payment/
│   │   │       └── inventory/
│   │   └── resources/
│   └── test/
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   ├── monitoring/
│   │   ├── prometheus/
│   │   └── grafana/
│   └── kafka/
├── docs/
│   ├── api/
│   │   ├── openapi.yaml
│   │   └── asyncapi.yaml
│   ├── architecture/
│   └── evidence/
│       ├── stage-1/
│       ├── stage-2/
│       └── ...
├── .meta/
│   └── state.yml                # Version tracking
└── README.md
```

## Key Performance Indicators (KPIs)

**Must achieve ALL**:
- API latency p99 ≤ 100ms (simple queries)
- API latency p99 ≤ 200ms (complex queries)
- System availability ≥ 99.9% (30-day period)
- Error rate ≤ 1% (excluding 4xx)
- Test coverage ≥ 80%
- Security scan: no critical/high vulnerabilities

## Stage-Based Evolution

**Key Principle**: Each stage is complete, working system that can be deployed and demoed.

---

## phase 1: Core Platform (24 weeks)

### Stage 1: Monolith Foundation (4 weeks)

**Goal**: Working end-to-end e-commerce system

**Domains**:
- User Management (auth, profiles, roles)
- Product Catalog (CRUD, categories, search prep)
- Shopping Cart (session-based)
- Order Management (creation, tracking, status)
- Payment Processing (Toss Payments integration)
- Inventory Management (stock tracking, reservations)

**Architecture**:
- Single Spring Boot application (or Django)
- Single PostgreSQL database (separate schemas per domain)
- JPA/ORM for data access
- RESTful API
- JWT authentication

**Key Capabilities**:
- User registration and login
- Browse products by category
- Add items to cart
- Checkout and create order
- Process payment (test mode)
- Track order status
- Admin: manage products and orders

**Korean Market Integration**:
- Kakao OAuth 2.0 login
- Toss Payments sandbox integration
- Korean address format support
- PIPA compliance ready (PII encryption)

**Technology**:
```java
// Spring Boot example
@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired
    private UserService userService;
    
    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(@RequestBody RegisterRequest request) {
        User user = userService.register(request);
        return ResponseEntity.ok(toDTO(user));
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        return ResponseEntity.ok(toDTO(user));
    }
}
```

**Database Schema**:
- users, user_profiles, user_roles
- products, categories, product_categories
- carts, cart_items
- orders, order_items, order_status_history
- payments, payment_transactions
- inventory, inventory_reservations

**Validation**:
```bash
# Complete user journey
curl -X POST http://localhost:8080/api/users/register \
  -d '{"email":"user@example.com","password":"pass123"}'
  
curl -X POST http://localhost:8080/api/auth/login \
  -d '{"email":"user@example.com","password":"pass123"}'
# Returns JWT token

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/products

curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/cart/items \
  -d '{"productId":1,"quantity":2}'

curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/orders \
  -d '{"paymentMethod":"toss"}'
  
# All operations succeed, order created
```

**Evidence**:
- OpenAPI documentation
- Postman collection with test scenarios
- Database schema diagram
- Docker Compose setup for local development

---

### Stage 2: Observability (3 weeks)

**Goal**: "You can't improve what you can't measure"

**Capabilities**:
- Metrics collection (Prometheus)
- Visualization (Grafana dashboards)
- Structured logging (ELK Stack)
- Distributed tracing
- Alerting

**Technical Implementation**:
- Spring Boot Actuator + Micrometer (or Django Prometheus)
- Prometheus metrics endpoint
- Grafana dashboards (8+ panels)
- Logback/ELK for log aggregation
- Zipkin or Jaeger for tracing

**Required Metrics**:
```
# Business metrics
http_requests_total{endpoint, method, status}
user_registrations_total
orders_created_total{status}
payment_transactions_total{status, method}
revenue_total{currency}

# Technical metrics
http_request_duration_seconds{endpoint, method}
database_connection_pool_active
database_connection_pool_idle
database_query_duration_seconds{query_type}
cache_hit_ratio{cache_name}
jvm_memory_used_bytes{area} # or python_gc_collections_total
```

**Grafana Dashboards** (minimum 8 panels):
1. System Overview: requests/sec, error rate, latency p50/p95/p99
2. Business Metrics: registrations, orders, revenue over time
3. Database Performance: query time, connection pool, slow queries
4. User Journey: registration → purchase funnel conversion
5. Error Tracking: error rates by endpoint and type
6. JVM/Python Metrics: heap usage, GC time, thread count
7. API Endpoints: latency heatmap by endpoint
8. Infrastructure: CPU, memory, disk usage

**Structured Logging**:
```json
{
  "timestamp": "2025-01-30T10:15:30.123Z",
  "level": "INFO",
  "trace_id": "abc123",
  "span_id": "def456",
  "service": "sagaline-monolith",
  "user_id": "12345",
  "endpoint": "/api/orders",
  "method": "POST",
  "status": 201,
  "duration_ms": 45,
  "message": "Order created successfully"
}
```

**Distributed Tracing**:
- Trace ID in all logs
- Span hierarchy: request → service → database
- Trace visualization in Zipkin/Jaeger

**Alerting**:
- Error rate > 1% for 5 minutes
- P99 latency > 200ms for 5 minutes
- Database connection pool > 80% for 5 minutes
- Disk usage > 85%

**Validation**:
- All metrics visible in Prometheus
- Dashboards auto-refresh in Grafana
- Logs searchable in Kibana with correlation IDs
- Traces viewable with complete span hierarchy

**Evidence**:
- Grafana dashboard JSON exports
- Sample Prometheus queries
- Log examples with trace IDs
- Distributed trace screenshots
- Alert rule configurations

---

### Stage 3: Scale (6 weeks)

**Goal**: Handle increased load efficiently

#### Stage 3.1: Search (2 weeks)

**Capabilities**:
- Full-text product search (Korean support)
- Faceted search (category, price range, brand)
- Autocomplete
- Search analytics

**Technical Implementation**:
- Elasticsearch 8.x
- Nori tokenizer for Korean
- Product index with mappings
- Synchronization: dual-write or CDC

**Index Mapping**:
```json
{
  "mappings": {
    "properties": {
      "id": {"type": "long"},
      "name": {
        "type": "text",
        "analyzer": "nori"
      },
      "description": {
        "type": "text",
        "analyzer": "nori"
      },
      "category": {"type": "keyword"},
      "price": {"type": "long"},
      "brand": {"type": "keyword"},
      "created_at": {"type": "date"}
    }
  }
}
```

**Search API**:
```bash
GET /api/search?q=노트북&category=electronics&min_price=500000&max_price=2000000
# Returns: filtered and ranked products
```

**Validation**:
- Korean search works correctly ("노트북" finds laptops)
- Faceted filtering returns correct results
- Autocomplete responds < 100ms
- Search latency p99 < 200ms

**Evidence**:
- Elasticsearch index mappings
- Search query examples
- Korean tokenization test results
- Performance benchmarks

---

#### Stage 3.2: Caching (2 weeks)

**Capabilities**:
- Database query result caching
- Session management
- Rate limiting
- Cache invalidation strategies

**Technical Implementation**:
- Redis 7+ as cache layer
- Spring Cache abstraction (or Django cache)
- TTL-based and event-based invalidation
- Cache-aside pattern

**Caching Strategy**:
```java
@Cacheable(value = "products", key = "#id")
public Product getProduct(Long id) {
    return productRepository.findById(id)
        .orElseThrow(() -> new NotFoundException("Product not found"));
}

@CacheEvict(value = "products", key = "#product.id")
public Product updateProduct(Product product) {
    return productRepository.save(product);
}
```

**Use Cases**:
- Product details (high read, low write)
- Category lists (rarely change)
- User sessions (JWT + refresh tokens)
- Rate limiting (API throttling)

**Cache Invalidation**:
- TTL: 1 hour for product details
- Event-based: invalidate on update
- Write-through: update cache on write

**Validation**:
```bash
# Cold cache
curl http://localhost:8080/api/products/1
# Duration: ~50ms (database query)

# Warm cache
curl http://localhost:8080/api/products/1
# Duration: ~5ms (Redis hit)

# Monitor cache hit ratio
curl http://localhost:8080/actuator/metrics/cache.gets?tag=result:hit
curl http://localhost:8080/actuator/metrics/cache.gets?tag=result:miss
# Target: Hit ratio ≥ 80%
```

**Evidence**:
- Cache hit ratio metrics
- Performance comparison (with/without cache)
- Cache invalidation test scenarios

---

#### Stage 3.3: Async Processing (2 weeks)

**Capabilities**:
- Asynchronous order processing
- Event-driven architecture
- Email notifications
- Analytics event streaming

**Technical Implementation**:
- Apache Kafka 3.x
- Event producers and consumers
- Dead letter queues
- At-least-once delivery

**Event Types**:
```
UserRegistered
OrderCreated
OrderConfirmed
PaymentCompleted
PaymentFailed
InventoryReserved
InventoryReleased
```

**Event Schema**:
```json
{
  "event_id": "uuid",
  "event_type": "OrderCreated",
  "timestamp": "2025-01-30T10:15:30.123Z",
  "user_id": "12345",
  "order_id": "67890",
  "payload": {
    "total_amount": 50000,
    "items": [
      {"product_id": "1", "quantity": 2, "price": 25000}
    ]
  }
}
```

**Kafka Topics**:
- user-events
- order-events
- payment-events
- inventory-events
- notifications

**Consumer Example**:
```java
@KafkaListener(topics = "order-events", groupId = "notification-service")
public void handleOrderEvent(OrderEvent event) {
    if (event.getType() == OrderEventType.CREATED) {
        emailService.sendOrderConfirmation(event.getUserId(), event.getOrderId());
    }
}
```

**Validation**:
- Events published to Kafka successfully
- Consumers process events (check logs)
- Throughput ≥ 10,000 msg/sec
- Dead letter queue handles failures

**Evidence**:
- Kafka topic configurations
- Event schema definitions (AsyncAPI)
- Consumer processing logs
- Throughput benchmarks

---

### Stage 4: Reliability (4 weeks)

#### Stage 4.1: Security (2 weeks)

**Capabilities**:
- OAuth 2.0 with Kakao
- JWT token management
- Password encryption (bcrypt)
- PII encryption at rest
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting

**Technical Implementation**:
- Spring Security (or Django Security)
- Kakao OAuth 2.0 SDK
- JWT with refresh tokens
- AES-256 for PII encryption
- Parameterized queries (JPA/ORM)
- Content Security Policy headers

**OAuth Flow**:
```
1. User clicks "Login with Kakao"
2. Redirect to Kakao OAuth
3. User authorizes
4. Kakao redirects with code
5. Exchange code for token
6. Create user session with JWT
```

**PII Encryption**:
```java
@Entity
public class User {
    @Id
    private Long id;
    
    @Convert(converter = EncryptedStringConverter.class)
    private String phoneNumber;  // Encrypted at rest
    
    @Convert(converter = EncryptedStringConverter.class)
    private String address;      // Encrypted at rest
}
```

**Security Scanning**:
- OWASP Dependency Check
- Trivy container scanning
- Snyk code analysis
- Target: No critical/high vulnerabilities

**Validation**:
```bash
# SQL injection attempt
curl http://localhost:8080/api/products?category=' OR 1=1--
# Expected: Properly escaped, no injection

# XSS attempt
curl -X POST http://localhost:8080/api/reviews \
  -d '{"text":"<script>alert(1)</script>"}'
# Expected: Script tags sanitized

# Rate limiting
for i in {1..100}; do
  curl http://localhost:8080/api/products
done
# Expected: Rate limit after N requests

# OAuth login
curl http://localhost:8080/oauth2/authorization/kakao
# Expected: Redirect to Kakao
```

**Evidence**:
- Security scan reports (no critical/high)
- OAuth integration test results
- PII encryption verification
- Penetration test scenarios

---

#### Stage 4.2: Resilience (2 weeks)

**Capabilities**:
- Circuit breaker for external services
- Retry with exponential backoff
- Graceful degradation
- Database failover
- Health checks

**Technical Implementation**:
- Resilience4j (Spring) or tenacity (Python)
- Circuit breaker for Toss Payments
- Retry for transient failures
- Fallback responses
- Liveness and readiness probes

**Circuit Breaker**:
```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
public PaymentResult processPayment(PaymentRequest request) {
    return tossPaymentClient.process(request);
}

public PaymentResult paymentFallback(PaymentRequest request, Exception e) {
    // Log error
    logger.error("Payment service unavailable", e);
    
    // Return fallback
    return PaymentResult.pending("Payment processing delayed, please try again");
}
```

**Retry Strategy**:
```java
@Retry(name = "inventoryService", maxAttempts = 3)
public void reserveInventory(Long productId, int quantity) {
    inventoryClient.reserve(productId, quantity);
}
```

**Health Checks**:
```bash
# Liveness probe
GET /actuator/health/liveness
# Returns 200 if application is running

# Readiness probe
GET /actuator/health/readiness
# Returns 200 if ready to accept traffic
# Checks: database connection, Redis connection
```

**Validation**:
```bash
# Circuit breaker test
# Stop Toss Payments mock service
curl -X POST http://localhost:8080/api/orders \
  -d '{"paymentMethod":"toss",...}'
# Expected: Fallback response, circuit opens after threshold

# Retry test
# Start service that fails twice then succeeds
curl http://localhost:8080/api/inventory/reserve
# Expected: Success after 2 retries (check logs)

# Health check test
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP", "components":{...}}
```

**Evidence**:
- Circuit breaker state transitions
- Retry logs showing exponential backoff
- Graceful degradation scenarios
- Health check endpoint responses

---

### Checkpoint: Core (Stage 1-4 Complete)

**Timeline**: 18 weeks  
**Target Level**: Entry-level Backend Engineer

**Deliverables**:
- Working e-commerce monolith
- Full observability stack
- Search and caching implemented
- Async processing with Kafka
- Security and resilience patterns
- Complete documentation
- Evidence packs for all stages

**Portfolio Value**:
- "Built production e-commerce platform"
- "Implemented observability with Prometheus/Grafana"
- "Korean market integration (Kakao, Toss)"
- "Event-driven architecture with Kafka"

---

## phase 1 Continued: Microservices (7 weeks)

### Stage 5: Microservices Decomposition

**Goal**: Extract domains into independent services

**Microservices**:
1. **user-service**: Authentication, authorization, profiles
2. **product-service**: Catalog, categories, search
3. **order-service**: Order creation, tracking, status
4. **payment-service**: Payment processing, transactions
5. **inventory-service**: Stock management, reservations

**Architecture**:
- Each service: separate codebase, database, deployment
- API Gateway (Spring Cloud Gateway or Kong)
- Service discovery (Eureka or Consul)
- Inter-service: REST + Kafka events
- Database per service pattern

**Service Structure**:
```
user-service/
├── src/
│   ├── main/
│   │   ├── java/com/sagaline/user/
│   │   │   ├── api/          # REST controllers
│   │   │   ├── domain/       # Business logic
│   │   │   ├── repository/   # Data access
│   │   │   └── event/        # Kafka producers/consumers
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/ # Flyway migrations
│   └── test/
├── Dockerfile
└── pom.xml / requirements.txt
```

**API Gateway**:
```yaml
# Gateway routes
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
        - id: product-service
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
```

**Inter-Service Communication**:
```java
// REST call via Feign Client
@FeignClient(name = "product-service")
public interface ProductClient {
    @GetMapping("/api/products/{id}")
    ProductDTO getProduct(@PathVariable Long id);
}

// Event publishing
@Autowired
private KafkaTemplate<String, OrderEvent> kafkaTemplate;

public void createOrder(Order order) {
    orderRepository.save(order);
    
    // Publish event
    OrderEvent event = new OrderEvent(order);
    kafkaTemplate.send("order-events", event);
}

// Event consuming
@KafkaListener(topics = "order-events")
public void handleOrderCreated(OrderEvent event) {
    // Reserve inventory
    inventoryService.reserve(event.getProductId(), event.getQuantity());
}
```

**Data Decomposition**:
- Users DB: user tables only
- Products DB: product tables only
- Orders DB: order tables only
- Payments DB: payment tables only
- Inventory DB: inventory tables only

**Saga Pattern** (distributed transactions):
```
Order Creation Saga:
1. Order service: Create order (status: PENDING)
2. Inventory service: Reserve stock
3. Payment service: Process payment
4. If all succeed: Order status → CONFIRMED
5. If any fails: Compensating transactions (rollback)
```

**Validation**:
```bash
# Create order via API Gateway
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"items":[{"productId":1,"quantity":2}]}'
# Expected: Order created, events published, saga completes

# Check service independence
# Stop product-service
curl http://localhost:8080/api/orders
# Expected: Orders still work (service isolation)

# Check event flow
# Monitor Kafka topics
kafka-console-consumer --topic order-events --from-beginning
# Expected: Events from multiple services
```

**Evidence**:
- Microservices architecture diagram
- API Gateway configuration
- Service dependency map
- Saga flow documentation
- Performance comparison (monolith vs microservices)

---

### Checkpoint: Scale (Stage 1-5 Complete)

**Timeline**: 25 weeks  
**Target Level**: Mid-level Backend Engineer

**Additional Deliverables**:
- Microservices architecture (5 services)
- API Gateway
- Service discovery
- Distributed tracing across services
- Saga pattern for transactions

**Portfolio Value**:
- "Decomposed monolith into microservices"
- "Implemented distributed transactions with Saga"
- "Built API Gateway with routing and auth"

---

## phase 2: Cloud Scale (12 weeks)

### Stage 6: Containerization (3 weeks)

**Goal**: Package all services as containers

**Capabilities**:
- Multi-stage Docker builds
- Image optimization
- Container orchestration (Docker Compose)
- Health checks in containers
- Environment-based configuration

**Dockerfile Example**:
```dockerfile
# Multi-stage build
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Docker Compose** (development):
```yaml
version: '3.8'
services:
  user-service:
    build: ./user-service
    ports:
      - "8081:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - DATABASE_URL=jdbc:postgresql://postgres:5432/users
    depends_on:
      - postgres
      - kafka

  product-service:
    build: ./product-service
    ports:
      - "8082:8080"
    # ... similar config

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    # ... Kafka config

volumes:
  postgres-data:
```

**Image Optimization**:
- Multi-stage builds (separate build and runtime)
- Alpine base images (smaller size)
- Layer caching (reuse dependencies)
- Target: Image size < 150MB per service

**Validation**:
```bash
# Build all images
docker-compose build

# Check image sizes
docker images | grep sagaline
# Expected: All < 150MB

# Run full stack
docker-compose up -d

# Health checks
curl http://localhost:8081/actuator/health
curl http://localhost:8082/actuator/health

# Security scan
trivy image sagaline/user-service:latest
# Expected: No critical/high vulnerabilities
```

**Evidence**:
- Dockerfiles for all services
- Docker Compose configuration
- Image size comparison
- Security scan results

---

### Stage 7: Kubernetes Basics (4 weeks)

**Goal**: Deploy to Kubernetes cluster

**Capabilities**:
- Kubernetes deployments
- Service discovery and load balancing
- ConfigMaps and Secrets
- HorizontalPodAutoscaler
- Ingress controller

**Deployment Example**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: sagaline
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: sagaline/user-service:1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: sagaline
spec:
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

**HorizontalPodAutoscaler**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
  namespace: sagaline
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Ingress** (API Gateway):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sagaline-ingress
  namespace: sagaline
spec:
  rules:
  - host: api.sagaline.com
    http:
      paths:
      - path: /api/users
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 80
      - path: /api/products
        pathType: Prefix
        backend:
          service:
            name: product-service
            port:
              number: 80
```

**Validation**:
```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Verify pods running
kubectl get pods -n sagaline
# Expected: All Running

# Test service discovery
kubectl exec -n sagaline -it user-service-xxx -- curl http://product-service/actuator/health
# Expected: 200 OK

# Scale test (increase load)
kubectl run load-test --image=busybox --restart=Never -- /bin/sh -c "while true; do wget -q -O- http://user-service; done"

# Watch HPA scale pods
kubectl get hpa -n sagaline -w
# Expected: Replicas increase from 2 → 10

# Self-healing test
kubectl delete pod user-service-xxx -n sagaline
# Expected: New pod created within 30 seconds
```

**Evidence**:
- Kubernetes manifests
- HPA scaling logs
- Resource usage dashboards
- Service mesh diagram

---

### Stage 8: Real-Time Notifications (3 weeks)

**Goal**: WebSocket for real-time updates

**Capabilities**:
- WebSocket server
- Server-Sent Events (SSE) fallback
- Real-time order status updates
- Notification history
- Backpressure handling

**Technical Implementation**:
- Spring WebFlux (reactive) or Django Channels
- R2DBC for non-blocking database access
- WebSocket with JWT authentication
- Redis pub/sub for multi-instance scaling

**WebSocket Handler**:
```java
@Configuration
public class WebSocketConfig implements WebSocketConfigurer {
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(notificationHandler(), "/ws/notifications")
                .setAllowedOrigins("*")
                .addInterceptors(new JwtHandshakeInterceptor());
    }
}

@Component
public class NotificationHandler extends TextWebSocketHandler {
    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Handle incoming messages
    }
    
    public void sendNotification(String userId, Notification notification) {
        // Send to specific user's session
        sessions.get(userId).sendMessage(new TextMessage(toJson(notification)));
    }
}
```

**Event → Notification Flow**:
```java
@KafkaListener(topics = "order-events")
public void handleOrderEvent(OrderEvent event) {
    if (event.getType() == OrderEventType.STATUS_CHANGED) {
        Notification notification = new Notification(
            event.getUserId(),
            "Order " + event.getOrderId() + " is now " + event.getStatus()
        );
        
        // Send via WebSocket
        notificationService.send(notification);
        
        // Store in database
        notificationRepository.save(notification);
    }
}
```

**Client Example**:
```javascript
const ws = new WebSocket('ws://api.sagaline.com/ws/notifications');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', token: jwtToken }));
};

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('Order update:', notification);
};
```

**Validation**:
```bash
# Connect 1,000 WebSocket clients
for i in {1..1000}; do
  wscat -c ws://localhost:8080/ws/notifications &
done

# Create order (triggers notification)
curl -X POST http://localhost:8080/api/orders \
  -d '{"items":[...]}'

# Expected: All connected clients receive notification
# Latency: < 100ms from event to delivery

# Check backpressure handling
# Simulate slow client (doesn't read messages)
# Expected: Server handles gracefully, doesn't block others
```

**Evidence**:
- WebSocket load test results
- Reactive vs blocking performance comparison
- Real-time notification flow diagram

---

### Stage 9: Multi-Region (3 weeks)

**Goal**: Database replication across regions

**Capabilities**:
- PostgreSQL streaming replication
- Read-write splitting
- Disaster recovery
- Regional failover

**Architecture**:
- Primary region (Seoul): Read-write
- Replica regions (Tokyo, Virginia): Read-only
- Replication lag monitoring
- Manual failover process

**Replication Setup**:
```bash
# Primary (Seoul)
# Enable replication in postgresql.conf
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB

# Replica (Tokyo)
# Create replication slot on primary
SELECT * FROM pg_create_physical_replication_slot('tokyo_replica');

# Start replica with recovery.conf
primary_conninfo = 'host=primary-seoul port=5432 user=replicator'
primary_slot_name = 'tokyo_replica'
```

**Read-Write Splitting**:
```java
@Configuration
public class DatabaseConfig {
    @Bean
    public DataSource routingDataSource() {
        RoutingDataSource routing = new RoutingDataSource();
        
        routing.setTargetDataSources(Map.of(
            "write", primaryDataSource(),
            "read", replicaDataSource()
        ));
        
        routing.setDefaultTargetDataSource(primaryDataSource());
        return routing;
    }
}

// Use @Transactional(readOnly = true) for reads
@Transactional(readOnly = true)
public List<Product> getAllProducts() {
    return productRepository.findAll(); // Goes to replica
}

@Transactional
public Product createProduct(Product product) {
    return productRepository.save(product); // Goes to primary
}
```

**WAL Archiving** (point-in-time recovery):
```bash
# Configure WAL archiving
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'

# Restore to specific point in time
pg_basebackup -h primary -D /var/lib/postgresql/data -P -U replicator
# Apply WAL files up to specific timestamp
```

**Validation**:
```bash
# Check replication lag
SELECT now() - pg_last_xact_replay_timestamp() AS lag;
# Expected: < 100ms

# Verify read queries use replica
# Check logs with replica identifier
tail -f /var/log/postgresql/replica-tokyo.log
# Expected: Read queries logged on replica

# Write queries use primary
tail -f /var/log/postgresql/primary-seoul.log
# Expected: Write queries logged on primary

# Failover test (manual)
# 1. Stop primary
systemctl stop postgresql

# 2. Promote replica
pg_ctl promote -D /var/lib/postgresql/data

# 3. Verify application switches to new primary
curl http://localhost:8080/api/products
# Expected: Still working (using promoted replica)
```

**Evidence**:
- Multi-region architecture diagram
- Replication lag metrics over 7 days
- DR runbook with manual failover steps
- DR drill report

---

### Checkpoint: Cloud (Stage 1-9 Complete)

**Timeline**: 36 weeks  
**Target Level**: Senior Backend Engineer

**Additional Deliverables**:
- Kubernetes deployment (3 regions)
- Real-time WebSocket notifications
- Multi-region database replication
- Complete DR procedures
- Full observability across all services
- Production-ready documentation

**Portfolio Value**:
- "Deployed microservices to Kubernetes"
- "Implemented real-time notifications (WebSocket)"
- "Multi-region architecture with DR"
- "Full production e-commerce platform"

---

## Development Guidelines

### Code Style

**Naming**:
- Classes: `PascalCase` (UserService, OrderController)
- Methods: `camelCase` (createOrder, findUserById)
- Variables: `camelCase` (userId, orderTotal)
- Constants: `UPPER_SNAKE_CASE` (MAX_RETRY_ATTEMPTS, DEFAULT_TIMEOUT)
- Packages: lowercase (com.sagaline.user.domain)

**Architecture**:
- Clean Architecture layers (API → Domain → Infrastructure)
- SOLID principles
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple)

### Testing

**Required per Stage**:
- Unit tests (≥ 70% coverage)
- Integration tests (API, database)
- Contract tests (microservices)
- End-to-end tests (critical flows)

**Test Pyramid**:
```
         _____
        /     \
       /  E2E  \      (few, slow, high confidence)
      /---------\
     /Integration\  (some, moderate speed)
    /-------------\
   /   Unit Tests  \  (many, fast, granular)
  /-----------------\
```

### Git Workflow

**Branches**:
- `main`: Production-ready
- `develop`: Integration
- `feature/stage-X`: Stage development
- `hotfix/*`: Emergency fixes

**Commits**:
```
<type>: <subject>

<body>

<footer>
```

**Types**: feat, fix, docs, test, refactor, perf, chore

### Quality Gates (CI Pipeline)

**All must pass**:
1. Build succeeds (no warnings)
2. Unit tests pass (≥ 80% coverage)
3. Integration tests pass
4. Security scan (no critical/high)
5. API contract validation (OpenAPI)
6. Performance tests (if applicable)
7. No binary files in repository

## Monitoring (Production)

### Prometheus Metrics (expanded)

```
# Business
http_requests_total{service, endpoint, method, status}
user_registrations_total
orders_created_total{status}
payment_transactions_total{status, method}
revenue_total{currency}

# Technical
http_request_duration_seconds{service, endpoint}
database_connection_pool{service, status}
database_query_duration_seconds{service, query}
cache_operations_total{service, operation, result}
kafka_consumer_lag{service, topic, partition}

# Infrastructure
pod_cpu_usage{namespace, pod}
pod_memory_usage{namespace, pod}
node_disk_usage{node}
```

### Grafana Dashboards (18+ panels for Cloud)

**phase 1 (8 panels)**: System, Business, Database, User Journey, Errors, JVM, API, Infrastructure

**phase 2 additions (10+ panels)**:
- Service mesh traffic
- Kafka lag and throughput
- WebSocket connections
- Multi-region replication lag
- Kubernetes pod autoscaling
- Container resource usage
- Inter-service latency
- Circuit breaker states
- Cache hit ratios per service
- Geographic request distribution

## Security

**Implementation**:
- Input validation (all client data)
- Authentication (JWT + OAuth)
- Authorization (role-based)
- Encryption at rest (PII)
- Encryption in transit (TLS)
- SQL injection prevention (ORM)
- XSS protection (sanitization)
- CSRF tokens
- Rate limiting
- Security headers
