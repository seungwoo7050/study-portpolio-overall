# mini-spring – Framework from Scratch

## Project Overview

Educational project to understand web framework fundamentals before building production systems (Phase 2: sagaline).

**Duration**: 6 weeks  
**Deliverables**: Independent milestones demonstrating progressive learning  
**Result**: Foundation for Phase 2 production development

## Why Phase 1 Matters

Most candidates use Spring Boot/Django without understanding internals. This phase builds:
- Deep understanding of HTTP protocol and socket programming
- Knowledge of dependency injection mechanisms
- Expertise in resource management and concurrency
- Ability to debug framework issues

**Interview advantage**: Explain how frameworks actually work, not just use them.

## Tech Stack

**Language**: Java 17+ or Python 3.11+ or Go 1.21+ (choose one)  
**Constraints**: No frameworks, raw sockets only  
**Build**: Maven/Gradle (Java), pip (Python), Go modules (Go)  
**Testing**: Manual testing, no automated test requirement  
**Platform**: Linux/macOS/Windows

## Project Structure

```
mini-spring/
├── src/
│   ├── milestone-1.1/     # HTTP Server from sockets
│   ├── milestone-1.2/     # Mini-framework
│   ├── milestone-1.3/     # Connection pool
│   ├── milestone-1.4/     # Integration
│   ├── milestone-1.4.5/   # Spring Bridge Spike
│   ├── milestone-1.5/     # Async/Concurrency & Caching
│   └── milestone-1.6/     # Message Queue & Background Jobs
│
├── docs/
│   ├── learning-journal.md
│   ├── concepts/
│   └── evidence/
│       ├── m1.1/
│       ├── m1.2/
│       ├── m1.3/
│       ├── m1.4/
│       ├── m1.4.5/
│       ├── m1.5/
│       └── m1.6/
├── build.gradle / pom.xml / go.mod
└── README.md
```

## Milestones

### Milestone 1.1: HTTP Server (1 week)

**Goal**: Multi-threaded HTTP/1.1 server without libraries

**Learn**:
- TCP socket programming (bind, listen, accept)
- HTTP protocol parsing (request line, headers, body)
- Thread management (thread pool for connections)
- Resource cleanup (socket lifecycle)

**Build**:
```java
// Java example
class HttpServer {
    private ServerSocket serverSocket;
    private ExecutorService threadPool;
    
    public void start(int port) throws IOException {
        serverSocket = new ServerSocket(port);
        threadPool = Executors.newFixedThreadPool(100);
        
        while (true) {
            Socket client = serverSocket.accept();
            threadPool.submit(() -> handleClient(client));
        }
    }
    
    private void handleClient(Socket socket) {
        // Parse HTTP request manually
        // Route to handler
        // Format HTTP response
    }
}
```

**Capabilities Required**:
- Accept TCP connections on configurable port
- Parse HTTP/1.1 requests (GET, POST, headers, body)
- Route requests to handler functions
- Format HTTP responses (status code, headers, body)
- Handle concurrent connections (100+)

**Validation**:
```bash
# Start server
./mini-http-server --port=8080

# Test basic routing
curl http://localhost:8080/health
# Expected: 200 OK {"status":"up"}

# Test concurrent load
ab -n 1000 -c 100 http://localhost:8080/api/test
# Expected: No connection errors, requests/sec measured

# Test HTTP parsing
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'
# Expected: Parse body correctly
```

**Evidence**:
- Source code with detailed comments
- Performance test results (requests/sec, latency)
- README explaining HTTP implementation

---

### Milestone 1.2: Mini-Framework (2 weeks)

**Goal**: Framework with routing, middleware, and dependency injection

**Learn**:
- Routing decorator/annotation system
- Middleware pipeline pattern
- Dependency injection container
- Request/response abstraction
- Exception handling

**Build**:
```python
# Python example
from mini_framework import App, inject

app = App()

@app.route("/users/{id}")
@app.middleware(auth_required)
def get_user(request, id, db=inject(Database)):
    user = db.query("SELECT * FROM users WHERE id = ?", id)
    return {"user": user}

app.run(port=8080)
```

```java
// Java example
@Controller
@Route("/users")
public class UserController {
    @Inject
    private Database db;
    
    @Get("/{id}")
    @Middleware(AuthRequired.class)
    public Response getUser(@PathParam("id") String id) {
        User user = db.query("SELECT * FROM users WHERE id = ?", id);
        return Response.ok(user);
    }
}
```

**Capabilities Required**:
- Route registration and pattern matching
- Middleware pipeline (pre/post processing)
- Dependency injection container (singleton, request-scoped)
- Request/response object abstraction
- Exception handling with error responses

**Validation**:
- Route matching works with path parameters
- Middleware executes in correct order
- Dependency injection resolves correctly
- Compare complexity: your framework vs Spring Boot/Django

**Evidence**:
- Framework source code
- Comparison document: mini-spring vs Spring Boot/FastAPI
- Example application using your framework

---

### Milestone 1.3: Connection Pool (2 weeks)

**Goal**: Thread-safe database connection pooling from scratch

**Learn**:
- Thread-safe resource pooling
- Queue-based acquisition
- Connection health checking
- Leak detection
- Transaction isolation levels

**Build**:
```java
public class ConnectionPool {
    private final int minConnections;
    private final int maxConnections;
    private final Queue<Connection> available;
    private final Set<Connection> inUse;
    private final Lock lock;
    
    public Connection acquire(Duration timeout) {
        // Thread-safe acquisition
        // Block if pool exhausted
        // Return connection or timeout
    }
    
    public void release(Connection conn) {
        // Health check
        // Return to pool
        // Warn if leaks detected
    }
}
```

**Technical Requirements**:
- Implement from scratch (no HikariCP/psycopg2 pooling)
- Thread-safe without synchronized on everything
- Configurable pool parameters (min/max, timeout)
- Leak detection (warn if connection not returned)

**Validation**:
```bash
# Pool exhaustion test
# Start with max=10 connections
# Acquire 11 connections concurrently
# Expected: 11th request blocks or times out

# Leak detection test
# Acquire connection, don't return it
# Expected: Warning logged after timeout

# Isolation test
# Demonstrate dirty read prevention (READ_COMMITTED)
# Demonstrate phantom read with REPEATABLE_READ
```

**Evidence**:
- Connection pool implementation
- Isolation level test results with explanations
- Performance comparison: your pool vs HikariCP

---

### Milestone 1.4: Integration & Documentation (1 week)

**Goal**: Complete mini-spring framework with documentation

**Deliverables**:
- Complete mini-spring framework
- Sample REST API application
- Comprehensive README:
  - What frameworks do
  - How you implemented each feature
  - Trade-offs of manual vs framework approach
- Blog post or video walkthrough (optional)

**Portfolio Value**:
- Separate GitHub repository
- Pin to profile
- Resume: "Implemented web framework from scratch"

**Validation**:
- Sample application runs successfully
- All previous milestones integrated
- Documentation complete
- Coroution

### Milestone 1.4.5 — Spring Bridge Spike (2–3 days)

**Goal**: Validate a smooth transition from the mini framework to Spring Boot by reproducing a tiny subset of features and writing a 1:1 mapping table.

**Scope**:
- Re-implement 2–3 existing endpoints (e.g., `/api/users`, `/api/products/{id}`).
- Show how routing, DI, middleware, exception mapping, and the connection pool translate to Spring Boot.

**What to Build**:
- A minimal Spring Boot app with:
  - `@RestController` routes matching Phase 1 endpoints
  - DI via `@Component/@Configuration/@Bean`, field/ctor injection
  - Request filters (`Filter` or `HandlerInterceptor`) for logging/rate-limit stub
  - Global exception handling with `@ControllerAdvice`
  - HikariCP settings (`spring.datasource.*`) as the pool baseline
- Short load run (wrk/hey/JMeter) to compare behavior with mini-spring.

**Deliverables**:
- `spring-bridge/` code (standalone)
- **Mapping Table** (mini-spring → Spring Boot)
- **Observations** (what Spring auto-config replaces, defaults, pitfalls)
- **Evidence**: screenshots, configs, quick latency numbers

**Acceptance**:
- Endpoints respond identically (status/body) to the mini framework
- Filter/interceptor order is documented
- HikariCP pool behavior verified under light load
- `mapping.md` completed

**Mapping Table (starter)**

| mini-spring concept      | Spring Boot analogue                         |
|--------------------------|----------------------------------------------|
| Router/handler map       | `@RestController` + `@RequestMapping`        |
| Middleware               | `Filter` / `HandlerInterceptor`              |
| DI container             | `@Component`, `@Configuration`, `@Bean`      |
| Exception mapping        | `@ControllerAdvice` + `@ExceptionHandler`    |
| Connection pool          | HikariCP via `spring.datasource.*`           |
| Rate limiting (stub)     | Filter + Bucket4j/Resilience4j RateLimiter   |
| Background jobs (stub)   | `@Async` / `@Scheduled`                      |

**Why now?**
Sits between Integration (1.4) and Optional Enhancements (1.5/1.6), maximizing reuse for Phase 2 (Spring Boot). 

### Milestone 1.5: Async/Concurrency & Caching (1 week)

**Goal**: Add async request handling and Caching

**Learn**:
- Async I/O (asyncio/CompletableFuture/goroutines)
- Caching strategies (in-memory, LRU, TTL)
- Rate limiting
- Concurrency patterns

**Build**:
```python
# Async route example
@app.route("/async/users/{id}")
async def get_user_async(id):
    user = await db.fetch_async("SELECT * FROM users WHERE id = ?", id)
    return {"user": user}

# Caching example
@app.cache(ttl=60)
@app.route("/cached/stats")
def get_stats():
    return expensive_computation()

# Rate Limiter
@app.rate_limit(requests=100, window=60)
@app.route("/api/resource")
def resource():
    return {"data": "..."}
```

**Capabilities Required**:
- Async request handling
- In-memory caching with TTL
- Rate limiting per IP/user

**Validation**:
- Async routes handle concurrent requests efficiently
- Cached responses served correctly within TTL
- Rate limiting enforced under load

**Evidence**:
- Async and caching implementation
- Performance metrics for async handling
- Rate limiting test results

### Milestone 1.6: Message Queue & Background Jobs (1 week)

**Goal**: Implement message queue and background job processing

**Learn**:
- Message queue basics (publish/subscribe)
- Background job processing (Celery/RQ style)
- Job retry & dead-letter queues
- Task scheduling

**Build**:
```python
# Message Queue example
queue = MessageQueue()

@app.route("/orders", method="POST")
def create_order(order_data):
    queue.publish("order.created", order_data)
    return {"status": "queued"}

@queue.subscribe("order.created")
def process_order(message):
    send_email(message['user_email'])
    update_inventory(message['items'])

# Background Job
@app.background_job(retry=3, delay=5)
def send_email(to, subject, body):
    pass
```

**Capabilities Required**:
- Simple message queue implementation
- Background job processing with retries
- Task scheduling (delayed jobs)

**Validation**:
- Publish/subscribe works correctly
- Background jobs execute with retries
- Scheduled tasks run after delay

**Evidence**:
- Message queue and job processing code
- Test results for job retries and scheduling

---

## Development Guidelines

### Code Quality

**Must have**:
- Resource management (RAII pattern in Java/Go, context managers in Python)
- Error handling (explicit exceptions)
- Concurrency safety (locks, synchronized, channels)
- Code comments explaining key concepts

**Example**:
```java
// Good: Resource management with try-with-resources
try (Socket socket = serverSocket.accept()) {
    handleClient(socket);
} // Socket automatically closed

// Good: Explicit error handling
public Connection acquire() throws PoolExhaustedException {
    Connection conn = tryAcquire();
    if (conn == null) {
        throw new PoolExhaustedException("Pool exhausted, max=" + maxConnections);
    }
    return conn;
}
```

### Testing Strategy

**Per milestone**:
- Manual testing script
- Performance measurement
- Evidence documentation

**No automated tests required** (learning project), but document:
- Test scenarios executed
- Results observed
- Performance metrics

### Documentation

**Required per milestone**:
```
docs/evidence/m{X.Y}/
├── validation-report.md    # What was tested
├── performance-metrics.txt # Measurements
└── code-examples/         # Key code snippets
```

**Learning journal**: Document learnings, challenges, solutions

---

## Milestone Progression

Execute in order:
1. **M1.1** → Learn HTTP and sockets → HTTP server working
2. **M1.2** → Learn framework patterns → Mini-framework working
3. **M1.3** → Learn resource management → Connection pool working
4. **M1.4** → Integration → Complete framework
5. **M1.4.5** → Spring Bridge Spike
6. **M1.5** → Async & Caching
7. **M1.6** → Message Queue & Background Jobs

**Gate**: Each milestone must be complete before next.

---

## Phase 1 Completion Criteria

- [ ] All milestones complete
- [ ] Learning journal filled
- [ ] Evidence for each milestone
- [ ] Sample application works
- [ ] README with portfolio description
- [ ] Framework comparison document


**Output**: GitHub repository ready for portfolio, foundation for Phase 2.

---

## Transition to Phase 2

After Phase 1:
- You understand how frameworks work internally
- Ready to build production systems with Spring Boot/Django
- Start Phase 2 (sagaline) with confidence

**Phase 2**: Use Spring Boot/Django to build production e-commerce platform.