# mini-spring → Spring Boot Mapping Table

## Overview

This document provides a 1:1 mapping between mini-spring framework features (Milestones 1.1-1.4) and their Spring Boot equivalents.

## Core Concepts Mapping

| mini-spring Concept | Spring Boot Equivalent | Notes |
|---------------------|------------------------|-------|
| HTTP Server (M1.1) | Embedded Tomcat | Spring Boot auto-configures web server with thread pool |
| Router (M1.2) | `@RestController` + `@RequestMapping` | Component scanning finds controllers automatically |
| Middleware (M1.2) | `Filter` + `HandlerInterceptor` | Two layers: Servlet filters and Spring MVC interceptors |
| DI Container (M1.2) | Spring IoC Container | `@Component`, `@Service`, `@Repository` for auto-registration |
| Connection Pool (M1.3) | HikariCP (via `spring-boot-starter-jdbc`) | Auto-configured with sensible defaults |
| Request/Response | `HttpServletRequest`/`ResponseEntity` | Plus Jackson for automatic JSON serialization |

---

## Detailed Feature Mapping

### 1. HTTP Server (Milestone 1.1)

#### mini-spring
```python
# src/milestone-1.1/http_server.py
class HttpServer:
    def __init__(self, host="0.0.0.0", port=8080, max_workers=100):
        self.host = host
        self.port = port
        self.max_workers = max_workers

    def start(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
            server_socket.bind((self.host, self.port))
            server_socket.listen()
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                while True:
                    client_socket, address = server_socket.accept()
                    executor.submit(self._handle_connection, client_socket, address)
```

#### Spring Boot
```properties
# src/main/resources/application.properties
server.port=8080
server.tomcat.threads.max=100
server.tomcat.threads.min-spare=10
```

**Key Differences:**
- **mini-spring**: Manual socket programming, thread pool management, HTTP parsing
- **Spring Boot**: Embedded Tomcat handles sockets, threads, and HTTP protocol
- **LOC**: ~124 lines → ~2 configuration lines
- **What's abstracted**: TCP/IP details, thread lifecycle, HTTP protocol parsing

---

### 2. Routing (Milestone 1.2)

#### mini-spring
```python
# src/milestone-1.2/framework/app.py
@app.route("/api/users/{id}", methods=["GET"])
def get_user(request, id):
    pool = request.app.resolve("connection_pool")
    with pool.acquire() as conn:
        user = conn.get_user(id)
    return {"user": user.to_dict()}
```

#### Spring Boot
```java
// src/main/java/.../controller/UserController.java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable String id) {
        return userService.getUserById(id)
            .map(user -> ResponseEntity.ok(Map.of("user", user)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
```

**Key Differences:**
| Aspect | mini-spring | Spring Boot |
|--------|-------------|-------------|
| Registration | `@app.route()` decorator | `@GetMapping` annotation |
| Path params | `{id}` in route + function arg | `@PathVariable` annotation |
| Discovery | Explicit registration | Classpath scanning (`@ComponentScan`) |
| Matching | Linear search O(n) | Optimized trie structure |

---

### 3. Middleware (Milestone 1.2)

#### mini-spring
```python
# Global middleware
app.use(logging_middleware)

# Route-specific middleware
@app.route("/api/users/{id}", methods=["GET"])
@app.middleware(auth_required)
def get_user(request, id):
    ...

# Middleware implementation
def logging_middleware(request: Request, next_fn: Callable) -> Any:
    LOGGER.info("%s %s", request.method, request.path)
    response = next_fn(request)
    LOGGER.info("→ %s", response.status)
    return response
```

#### Spring Boot
```java
// Global middleware (Filter)
@Component
public class LoggingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        LOGGER.info("{} {}", method, path);
        chain.doFilter(request, response);
        LOGGER.info("→ {}", status);
    }
}

// Route-specific middleware (Interceptor)
@Component
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (authHeader == null) {
            response.setStatus(401);
            return false; // Abort request
        }
        return true; // Continue
    }
}

// Registration
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
            .addPathPatterns("/api/users/{id}");
    }
}
```

**Key Differences:**
| Aspect | mini-spring | Spring Boot |
|--------|-------------|-------------|
| Global middleware | `app.use(middleware)` | `@Component` on `Filter` |
| Route-specific | `@app.middleware(fn)` decorator | `HandlerInterceptor` + path patterns |
| Execution order | Decorator stacking (reversed) | Filter → Interceptor → Controller |
| Aborting request | Return error Response | Return `false` from `preHandle()` |

**Execution Pipeline:**

mini-spring:
```
Request → Global Middleware → Route Middleware → Handler → Response
```

Spring Boot:
```
Request → Filter (global) → DispatcherServlet → Interceptor (route) → Controller → Response
```

---

### 4. Dependency Injection (Milestone 1.2)

#### mini-spring
```python
# DI Container
class DependencyContainer:
    def register_instance(self, name: str, instance: Any):
        self._registrations[name] = instance

    def register_factory(self, name: str, factory: Callable, singleton=True):
        self._registrations[name] = (factory, singleton)

    def resolve(self, name: str) -> Any:
        return self._registrations[name]

# Registration
app.register_instance("connection_pool", pool)

# Resolution in controller
pool = request.app.resolve("connection_pool")
```

#### Spring Boot
```java
// Bean registration (auto via @Component/@Service/@Repository)
@Repository
public class UserRepository {
    private final JdbcTemplate jdbcTemplate;

    // Constructor injection (preferred)
    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }
}

// Or explicit @Bean
@Configuration
public class AppConfig {
    @Bean
    public UserService userService(UserRepository repo) {
        return new UserService(repo);
    }
}

// Resolution (automatic via constructor injection)
@Service
public class UserService {
    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }
}
```

**Key Differences:**
| Aspect | mini-spring | Spring Boot |
|--------|-------------|-------------|
| Registration | Manual `register_instance/factory()` | Auto via `@Component` or explicit `@Bean` |
| Resolution | Manual `resolve("name")` | Auto via constructor injection |
| Scope | Singleton/factory flag | `@Scope` annotation (singleton, prototype, request, session) |
| Lookup | Name-based (string) | Type-based (class) + optional qualifiers |
| Thread safety | Manual `RLock` | Framework-managed |

---

### 5. Connection Pool (Milestone 1.3)

#### mini-spring
```python
# Configuration
config = PoolConfig(
    min_connections=2,
    max_connections=8,
    acquisition_timeout=2.0,
    leak_detection_threshold=30.0,
    connection_factory=database.create_connection
)
pool = ConnectionPool(config)

# Usage
with pool.acquire() as conn:
    user = conn.get_user(id)
```

#### Spring Boot
```properties
# application.properties
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.maximum-pool-size=8
spring.datasource.hikari.connection-timeout=2000
spring.datasource.hikari.leak-detection-threshold=30000
```

```java
// Usage (automatic via JdbcTemplate)
@Repository
public class UserRepository {
    private final JdbcTemplate jdbcTemplate;

    public Optional<User> findById(String id) {
        // HikariCP automatically manages connections
        return jdbcTemplate.query(
            "SELECT * FROM users WHERE id = ?",
            userRowMapper,
            id
        ).stream().findFirst();
    }
}
```

**Key Differences:**
| Feature | mini-spring ConnectionPool | Spring Boot HikariCP |
|---------|----------------------------|----------------------|
| Implementation | Manual `queue.Queue` + `Lock` | Highly optimized Java (ConcurrentBag) |
| Configuration | Python dataclass | Properties file or `@ConfigurationProperties` |
| Health checks | Custom `is_valid()` protocol | JDBC4 `Connection.isValid()` + custom query |
| Leak detection | Manual monotonic clock tracking | Built-in with stack trace logging |
| Metrics | Manual counters | JMX + Spring Boot Actuator metrics |
| Performance | ~4.1s (educational) | Production-grade (<1ms overhead) |

**HikariCP Additional Features (not in mini-spring):**
- Connection validation on borrow/return
- Prepared statement caching
- Transaction isolation level setting
- Auto-commit control
- Read-only connection hints
- Connection lifetime management (maxLifetime)
- Idle connection eviction

---

### 6. Request/Response Handling

#### mini-spring
```python
# Manual JSON parsing
@app.route("/api/users", methods=["POST"])
def create_user(request):
    data = request.json()  # Manual JSON.loads()
    name = data.get("name")
    email = data.get("email")

    user = create_user_logic(name, email)

    return Response(
        status=201,
        payload=json.dumps({"user": user.to_dict()}),
        headers={"Content-Type": "application/json"}
    )
```

#### Spring Boot
```java
// Automatic JSON serialization/deserialization via Jackson
@PostMapping
public ResponseEntity<Map<String, User>> createUser(@RequestBody Map<String, String> payload) {
    String name = payload.get("name");
    String email = payload.get("email");

    User user = userService.createUser(name, email);

    // Jackson automatically serializes Map to JSON
    return ResponseEntity
        .status(HttpStatus.CREATED)
        .body(Map.of("user", user));
}
```

**Key Differences:**
| Aspect | mini-spring | Spring Boot |
|--------|-------------|-------------|
| JSON parsing | Manual `json.loads()` | Jackson `@RequestBody` auto-binding |
| JSON serialization | Manual `json.dumps()` | Jackson `@ResponseBody` (implicit in `@RestController`) |
| Content negotiation | Manual `Content-Type` header | Automatic based on `Accept` header |
| Validation | Manual null checks | `@Valid` + Bean Validation (JSR-380) |
| Error handling | Manual `try/except` | `@ControllerAdvice` + `@ExceptionHandler` |

---

## Configuration Comparison

### Startup Configuration

#### mini-spring
```python
# src/milestone-1.4/application.py
def create_app(host="0.0.0.0", port=8080) -> App:
    app = App(host=host, port=port)
    database = InMemoryDatabase()
    pool = create_connection_pool(database)

    app.register_instance("database", database)
    app.register_instance("connection_pool", pool)
    app.use(logging_middleware)

    register_controllers(app)
    return app

# main.py
app = create_app(port=8080)
app.listen()
```

**Lines of Code**: ~70 lines (excluding controllers)

#### Spring Boot
```java
// SpringBridgeApplication.java
@SpringBootApplication
public class SpringBridgeApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpringBridgeApplication.class, args);
    }
}
```

**Lines of Code**: ~10 lines

**What Spring Boot Auto-Configures:**
1. Embedded Tomcat web server
2. HikariCP connection pool (if `spring-boot-starter-jdbc` present)
3. JdbcTemplate (if DataSource present)
4. Jackson JSON processor
5. Exception handling
6. Logging infrastructure
7. Actuator endpoints
8. Graceful shutdown

---

## Performance Comparison

| Metric | mini-spring | Spring Boot (HikariCP) |
|--------|-------------|------------------------|
| Pool creation | ~1ms | ~5ms (more initialization) |
| Connection acquisition | ~0.5ms | ~0.05ms (optimized) |
| Request handling | 1,826 req/sec | 15,000+ req/sec (Tomcat NIO) |
| Memory footprint | ~50 MB | ~150 MB (framework overhead) |
| Startup time | <1s | ~2-3s (classpath scanning) |

**Note**: These are approximate values. Spring Boot's higher throughput comes from:
- Optimized Tomcat NIO connector
- HikariCP's ConcurrentBag (lock-free)
- JVM JIT compilation optimizations
- Production-grade connection pooling

---

## Lines of Code Comparison

| Component | mini-spring | Spring Boot | Reduction |
|-----------|-------------|-------------|-----------|
| HTTP Server | 124 lines | 2 lines (config) | 98% |
| Routing | 63 lines | ~15 lines (annotations) | 76% |
| Middleware | 45 lines | ~30 lines (Filter + Interceptor) | 33% |
| DI Container | 75 lines | 0 lines (framework) | 100% |
| Connection Pool | 118 lines | 6 lines (config) | 95% |
| **Total Framework** | **~425 lines** | **~53 lines** | **87%** |

**Note**: Spring Boot's reduction comes at the cost of:
- Implicit behavior ("magic")
- Larger dependency graph
- Steeper learning curve
- Less control over internals

---

## Key Takeaways

### When to Use mini-spring Approach
- Educational purposes (learning internals)
- Extreme minimalism requirements
- Full control over behavior
- Embedded systems with size constraints

### When to Use Spring Boot
- Production applications
- Enterprise requirements (security, monitoring, scalability)
- Rapid development
- Integration with Spring ecosystem (Security, Data, Cloud)

### Learning Value
Building mini-spring teaches you:
1. **How HTTP works**: Request parsing, response formatting, status codes
2. **How routing works**: Pattern matching, path parameter extraction
3. **How middleware works**: Function composition, pipeline execution
4. **How DI works**: Object lifecycle, dependency graphs, scopes
5. **How connection pooling works**: Resource management, thread safety, leak detection

This knowledge makes you better at:
- Debugging Spring Boot issues
- Optimizing performance
- Understanding framework limitations
- Making architectural decisions
