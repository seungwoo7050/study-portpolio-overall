# Learning Journal

## Milestone 1.1: HTTP Server
**Started**: 2025-10-28
**Completed**: 2025-10-31

### What I Learned
- HTTP protocol fundamentals, including the structure of request lines, headers, and bodies
- Socket lifecycle management from bind → listen → accept → read/write → close
- Applying thread pool concurrency patterns to handle many simultaneous clients
- Strategies to manually parse text-based protocols while guarding against malformed input

### Challenges
- Ensuring sockets were always closed on error; solved by wrapping network operations in context managers and `try/finally`
- Preventing worker starvation under load; solved by configuring a bounded queue and 100-thread executor to balance throughput and resource usage

### Key Code
```python
# src/milestone-1.1/http_server.py
with socket.create_server((self.host, self.port), reuse_port=True) as server_socket:
    server_socket.listen()
    while True:
        client_socket, address = server_socket.accept()
        self._thread_pool.submit(self._handle_client, client_socket, address)
```

### Resources Used
- HTTP Made Really Easy – https://www.jmarshall.com/easy/http/
- Python Socket Programming HOWTO – https://docs.python.org/3/howto/sockets.html

---

## Milestone 1.2: Mini-Framework
**Started**: 2025-10-31
**Completed**: 2025-10-31

### What I Learned
- Decorator pattern for routing DSL: converting `@app.route("/users/{id}")` into a routing table
- Middleware pipeline architecture: composing functions to create pre/post processing chains
- Dependency injection fundamentals: separating object creation from usage via a container
- Closure-based pipeline construction: building nested function calls to chain middleware
- Request/response abstraction: hiding HTTP details from business logic

### Challenges
- **Middleware ordering**: Had to reverse the middleware list when building the pipeline to ensure correct execution order (global → route-specific → handler)
- **Closure capture bug**: Initial implementation captured the same middleware reference in all iterations; solved using a factory function (`make_step`) to create proper closures
- **DI thread safety**: Container needed `RLock` instead of `Lock` because factory functions might recursively resolve dependencies
- **Path parameter extraction**: Balancing simplicity (O(n) route matching) with correctness (handling `/users/123` vs `/users/new`)

### Key Code
```python
# src/milestone-1.2/framework/app.py
def _build_pipeline(self, route: Route) -> Callable[[Request], Any]:
    """Build middleware pipeline by wrapping handler in reverse order."""
    def call_handler(req: Request) -> Any:
        kwargs = dict(req.path_params)
        return route.handler(req, **kwargs)

    pipeline = call_handler
    # Reverse to get correct execution order: global → route → handler
    for middleware in reversed([*self._global_middleware, *route.middleware]):
        next_fn = pipeline

        # Factory function to capture correct middleware reference
        def make_step(mw: Middleware, nxt: Callable[[Request], Any]) -> Callable[[Request], Any]:
            def step(req: Request) -> Any:
                return mw(req, nxt)
            return step

        pipeline = make_step(middleware, next_fn)
    return pipeline
```

### Resources Used
- Flask source code (routing and middleware patterns) – https://github.com/pallets/flask
- Django middleware documentation – https://docs.djangoproject.com/en/stable/topics/http/middleware/
- Martin Fowler's "Inversion of Control Containers" – https://martinfowler.com/articles/injection.html
- Python Closures and Decorators Guide – https://realpython.com/inner-functions-what-are-they-good-for/

---

## Milestone 1.3: Connection Pool
**Started**: 2025-10-31
**Completed**: 2025-10-31

### What I Learned
- Thread-safe resource pooling using `queue.Queue` for lock-free reads
- Bounded pool patterns: balancing min/max connections with acquisition timeouts
- Connection lifecycle: creation → validation → use → return → health check → disposal
- Leak detection: tracking acquisition timestamps with `time.monotonic()` for reliable timers
- Transaction isolation levels: READ_COMMITTED prevents dirty reads, REPEATABLE_READ uses snapshots (MVCC simulation)
- Why connection pooling matters: establishing DB connections is expensive (100-200ms), pooling reduces overhead to <1ms

### Challenges
- **Pool exhaustion deadlock**: Initial design could deadlock if all threads held connections and waited for more; solved with timeout-based blocking acquisition
- **Accurate connection counting**: Race condition between checking `_total_connections` and creating new connections; required `Lock` for atomic increment
- **Health check integration**: Connections might fail between return and next acquisition; added validation before returning from pool
- **Leak detection false positives**: Using `time.time()` caused issues with clock adjustments; switched to `time.monotonic()` for monotonic timestamps
- **Transaction isolation simulation**: Implementing MVCC-like snapshots without a real database; used versioned state with transaction-local views

### Key Code
```python
# src/milestone-1.3/pool/connection_pool.py
def acquire(self) -> PooledConnection:
    """Acquire connection with timeout and health checking."""
    deadline = time.monotonic() + self._config.acquisition_timeout
    while True:
        try:
            # Try non-blocking get first (lock-free fast path)
            connection = self._available.get_nowait()
            LOGGER.debug("Reusing connection %s from pool", connection)
        except queue.Empty:
            # Slow path: create new connection if under max limit
            with self._lock:
                if self._total_connections < self._config.max_connections:
                    connection = self._create_connection()
                else:
                    connection = None

            if connection is None:
                # Pool exhausted - block until timeout
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise PoolExhaustedError("Connection pool exhausted")
                connection = self._available.get(timeout=remaining)

        # Validate health before returning
        if not self._is_healthy(connection):
            LOGGER.warning("Discarding unhealthy connection %s", connection)
            self._dispose_connection(connection)
            continue  # Retry acquisition

        with self._lock:
            self._in_use.add(connection)
        self._leak_detector.record_acquisition(connection)
        return PooledConnection(connection, self)
```

### Resources Used
- HikariCP documentation (best practices) – https://github.com/brettwooldridge/HikariCP
- PostgreSQL transaction isolation levels – https://www.postgresql.org/docs/current/transaction-iso.html
- "Designing Data-Intensive Applications" by Martin Kleppmann (Chapter 7: Transactions)
- Python `queue.Queue` documentation – https://docs.python.org/3/library/queue.html

---

## Milestone 1.4: Integration
**Started**: 2025-10-31
**Completed**: 2025-10-31

### What I Learned
- Composing layered architecture: HTTP server → framework → connection pool → database
- Dependency injection across stack boundaries: registering shared components (pool, database) in DI container
- Middleware orchestration: global logging middleware + route-specific authentication
- Integration testing strategies: smoke tests that exercise full request/response cycle
- Graceful shutdown: stopping listener loop, draining thread pool, closing connections
- Module path management: handling both direct execution (`python main.py`) and package imports

### Challenges
- **Import path compatibility**: Code needed to work both as `python main.py` and as imported package; solved with `_compat.py` that dynamically adjusts `sys.path`
- **Middleware execution order**: Ensuring logging runs before authentication; required careful ordering in `app.use()` calls
- **Connection pool lifecycle**: Pool created during app startup must be accessible to all request handlers; solved with DI registration
- **Test automation**: Writing smoke tests that verify full integration without mocking; used real TCP connections via `socket.create_connection()`
- **Error propagation**: Ensuring exceptions in handlers/middleware propagate correctly through pipeline to return proper HTTP status codes

### Key Code
```python
# src/milestone-1.4/application.py
def create_app(*, host: str = "0.0.0.0", port: int = 8080) -> App:
    """Compose the HTTP server, framework, and connection pool."""
    app = App(host=host, port=port)

    # 1. Create shared database and connection pool
    database = InMemoryDatabase()
    pool = create_connection_pool(database)

    # 2. Register in DI container (accessible to all handlers)
    app.register_instance("database", database)
    app.register_instance("connection_pool", pool)

    # 3. Configure global middleware (executes for ALL requests)
    app.use(logging_middleware)

    # 4. Register route handlers with route-specific middleware
    register(app)  # Controllers add @app.route() with auth middleware

    return app
```

### Deliverables
- Complete REST API with CRUD operations (`/api/users`)
- Automated smoke tests (`smoke_tests.py`, `test_all.sh`)
- Build and run scripts (`build.sh`, `run_sample.sh`)
- Integration validation report with full test matrix
- Sample walkthrough demonstrating all features

### Portfolio Value
- **Demo-ready application**: Can run live during interviews to show working code
- **Full-stack understanding**: Demonstrates knowledge from TCP sockets to REST APIs
- **Interview talking points**:
  - "I built a web framework from scratch to understand Spring Boot internals"
  - "I can explain how middleware pipelines work because I implemented one"
  - "I know why connection pooling matters from building leak detection"
- **GitHub showcase**: Comprehensive README, evidence docs, runnable examples
- **Foundation for Phase 2**: Ready to transition to Spring Boot with deep understanding

---

## Milestone 1.4.5: Spring Bridge Spike
**Started**: 2025-11-14
**Completed**: 2025-11-14

### What I Learned
- Spring Boot auto-configuration: How `@SpringBootApplication` triggers component scanning and bean creation
- Servlet Filter vs HandlerInterceptor: Two-layer middleware architecture in Spring MVC
- Constructor injection: Spring's preferred DI approach vs field injection
- HikariCP integration: How Spring Boot auto-configures connection pooling via `spring-boot-starter-jdbc`
- Jackson integration: Automatic JSON serialization/deserialization via `@RestController` and `@RequestBody`
- Annotation-driven development: `@RestController`, `@GetMapping`, `@PathVariable`, `@Service`, `@Repository`
- Application properties: Externalizing configuration vs hardcoded values

### Challenges
- **Filter vs Interceptor confusion**: Understanding when to use each (Filter for servlet-level, Interceptor for Spring MVC)
- **Path pattern matching**: Spring's `addPathPatterns()` doesn't distinguish HTTP methods easily; need to check `request.getMethod()` in `preHandle()`
- **Auto-configuration "magic"**: Understanding what Spring Boot configures automatically (HikariCP, JdbcTemplate, Jackson) vs what requires explicit `@Bean`
- **Component scanning**: Ensuring all classes are in correct package hierarchy under `@SpringBootApplication` base package
- **Database initialization**: Using `spring.sql.init.mode=always` + `schema.sql` for H2 in-memory database setup

### Key Code
```java
// src/main/java/.../SpringBridgeApplication.java
@SpringBootApplication  // Enables component scanning, auto-configuration, configuration properties
public class SpringBridgeApplication {
    public static void main(String[] args) {
        // This single line replaces:
        // - HTTP server creation (Tomcat)
        // - Router initialization
        // - DI container setup
        // - Connection pool creation (HikariCP)
        // - Middleware registration
        SpringApplication.run(SpringBridgeApplication.class, args);
    }
}

// Filter (global middleware)
@Component
public class LoggingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) {
        LOGGER.info("{} {}", method, path);
        chain.doFilter(request, response);  // Continue filter chain
        LOGGER.info("→ {}", status);
    }
}

// Interceptor (route-specific middleware)
@Component
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(401);
            return false;  // Abort request (controller won't execute)
        }
        return true;  // Continue to controller
    }
}

// Interceptor registration
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
            .addPathPatterns("/api/users/{id}", "/api/users");
    }
}
```

### Resources Used
- Spring Boot Reference Documentation – https://docs.spring.io/spring-boot/docs/current/reference/html/
- Spring MVC Interceptors Guide – https://docs.spring.io/spring-framework/docs/current/reference/html/web.html#mvc-handlermapping-interceptor
- HikariCP GitHub (configuration guide) – https://github.com/brettwooldridge/HikariCP
- Baeldung Spring tutorials – https://www.baeldung.com/spring-boot

### Deliverables
- Complete Spring Boot application (`milestone-1.4.5/`) with Maven build
- 1:1 endpoint mapping (health, list users, get user, create user)
- Middleware implementation (LoggingFilter + AuthInterceptor)
- HikariCP configuration matching mini-spring's ConnectionPool settings
- Comprehensive mapping table (`MAPPING.md`)
- Validation report (`docs/evidence/m1.4.5/validation-report.md`)
- Performance comparison (`docs/evidence/m1.4.5/performance-comparison.md`)

### Portfolio Value
- **Spring Boot proficiency**: Demonstrates ability to use production framework after building internals
- **Comparative analysis**: Shows understanding of trade-offs (explicitness vs auto-configuration)
- **Interview talking points**:
  - "I can explain the difference between Filter and Interceptor in Spring MVC"
  - "I understand what Spring Boot auto-configures (HikariCP, Jackson, Tomcat) and why"
  - "I built the same API in custom framework and Spring Boot to compare approaches"
- **Phase 2 readiness**: Validated smooth transition from mini-spring to Spring Boot
- **Performance insights**: Spring Boot is 7-11x faster, but startup is 3x slower (quantified trade-offs)
