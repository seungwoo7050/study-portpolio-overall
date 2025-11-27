# mini-spring Framework - Overall Design

> Educational web framework built from scratch to understand Spring Boot, Django, and FastAPI internals

## Project Overview

**Duration**: 6 weeks (October-November 2025)
**Language**: Python 3.11+
**Goal**: Understand web framework fundamentals before building production systems

### Why This Project Matters

Most developers use Spring Boot/Django/FastAPI without understanding internals. This project builds:
- Deep understanding of HTTP protocol and socket programming
- Knowledge of dependency injection mechanisms
- Expertise in resource management and concurrency
- Ability to debug framework issues

**Portfolio Value**: "I built a web framework from scratch" → demonstrates exceptional depth

---

## Architecture Progression

### Phase Progression

```
Milestone 1.1: HTTP Server
    ↓
Milestone 1.2: Mini-Framework (Routing + Middleware + DI)
    ↓
Milestone 1.3: Connection Pool
    ↓
Milestone 1.4: Integration
    ↓
Milestone 1.4.5: Spring Bridge
```

### Milestone Summary

| Milestone | Focus | LOC | Duration | Status |
|-----------|-------|-----|----------|--------|
| 1.1 | HTTP/1.1 Server | ~200 | 1 week | ✅ Complete |
| 1.2 | Framework Core | ~350 | 2 weeks | ✅ Complete |
| 1.3 | Connection Pool | ~250 | 2 weeks | ✅ Complete |
| 1.4 | Integration | ~150 | 1 week | ✅ Complete |
| 1.4.5 | Spring Bridge | ~200 (Java) | 3 days | ✅ Complete |
| **Total** | | **~1,150** | **6 weeks** | ✅ |

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    mini-spring v1.4                      │
└─────────────────────────────────────────────────────────┘

┌──────────────────┐
│  HTTP Request    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 1: HTTP Server (Milestone 1.1)                     │
│ - Raw socket programming (AF_INET, SOCK_STREAM)          │
│ - HTTP/1.1 protocol parsing                              │
│ - Thread pool for concurrent connections                 │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 2: Framework Core (Milestone 1.2)                  │
│ - Routing (pattern matching, path params)                │
│ - Middleware pipeline (pre/post processing)              │
│ - Dependency Injection Container                         │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 3: Data Access (Milestone 1.3)                     │
│ - Thread-safe connection pooling                         │
│ - Leak detection                                         │
│ - Health checking                                        │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ Layer 4: Application (Milestone 1.4)                     │
│ - Controllers (route handlers)                           │
│ - Services (business logic)                              │
│ - Database abstraction                                   │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| HTTP Server | Raw Python sockets | Learn TCP/IP fundamentals |
| Threading | `concurrent.futures.ThreadPoolExecutor` | Safe thread management |
| Routing | Pattern matching (manual) | Understand routing internals |
| Middleware | Function composition | Learn pipeline pattern |
| DI | Manual container with reflection | Understand IoC principles |
| Pooling | `queue.Queue` + `threading.Lock` | Learn resource management |
| Serialization | `json` module | Keep it simple |

---

## Design Decisions

### 1. Why Python?

**Pros**:
- Clean syntax for educational code
- Rich standard library (`socket`, `threading`, `json`)
- Fast prototyping
- Easy to read for demonstrations

**Cons** (accepted for educational purpose):
- GIL limits true parallelism
- Slower than Java/Go

**Decision**: Python's clarity outweighs performance for learning

### 2. Why Thread-per-Connection?

**Alternatives**:
1. ✅ Thread-per-connection (chosen)
2. ❌ select/poll event loop
3. ❌ async/await

**Reasoning**:
- Most intuitive model for beginners
- Direct mapping to real frameworks (Tomcat uses threads)
- Sufficient for 100+ concurrent connections
- Easy to reason about state

### 3. Why Manual Socket Programming?

**Alternative**: Use `http.server` module

**Decision**: Raw sockets teach:
- TCP handshake and connection lifecycle
- HTTP as text protocol over TCP
- Socket options (`SO_REUSEADDR`)
- Buffer management
- Graceful shutdown

### 4. Why Manual DI Container?

**Alternative**: Use existing library (e.g., `dependency-injector`)

**Decision**: Building DI teaches:
- Object lifecycle management
- Singleton vs factory patterns
- Dependency graphs
- Circular dependency detection

---

## Key Technical Concepts

### 1. HTTP Protocol (Milestone 1.1)

**What You Learn**:
```
GET /api/users HTTP/1.1        ← Request line
Host: localhost:8080            ← Headers
Content-Type: application/json
                                ← Empty line
{"query": "..."}                ← Body (optional)
```

**Implementation**: Manual string parsing with `socket.recv()`

### 2. Routing (Milestone 1.2)

**Pattern Matching**:
```python
Route: /api/users/{id}
Request: /api/users/42
→ Matches with params = {"id": "42"}
```

**Implementation**: Segment-by-segment comparison

### 3. Middleware Pipeline (Milestone 1.2)

**Execution Flow**:
```
Request → Global MW → Route MW → Handler → Response
            ↓             ↓          ↓
         logging       auth      business
```

**Implementation**: Function composition (nested closures)

### 4. Dependency Injection (Milestone 1.2)

**Container Registration**:
```python
# Register singleton
app.register_instance("db", database)

# Register factory
app.register_factory("pool", create_pool, singleton=True)

# Resolve
pool = app.resolve("pool")
```

**Implementation**: Dict-based registry with lazy initialization

### 5. Connection Pooling (Milestone 1.3)

**Pool Lifecycle**:
```
┌─────────────────────────────────────────────────┐
│ Available Queue: [conn1, conn2, conn3]          │
└─────────────────────────────────────────────────┘
         acquire() ↓              ↑ release()
┌─────────────────────────────────────────────────┐
│ In-Use Set: {conn4, conn5}                      │
└─────────────────────────────────────────────────┘
```

**Implementation**: `queue.Queue` (thread-safe FIFO) + `set` (in-use tracking)

---

## Performance Characteristics

### Milestone 1.1: HTTP Server

| Metric | Value | Notes |
|--------|-------|-------|
| Requests/sec | ~1,826 | Single machine, 100 threads |
| Latency (p99) | ~5ms | Local network |
| Concurrent connections | 100+ | ThreadPoolExecutor limit |
| Memory per connection | ~1MB | Python thread overhead |

### Milestone 1.3: Connection Pool

| Operation | Time | Notes |
|-----------|------|-------|
| Pool creation | ~1ms | Pre-allocate min connections |
| Acquire (available) | ~0.5ms | Queue.get_nowait() |
| Acquire (pool full) | ~2s | Blocks until timeout |
| Release | ~0.3ms | Queue.put() |
| Health check | ~0.1ms | Custom is_valid() |

### Comparison: mini-spring vs Spring Boot

| Metric | mini-spring | Spring Boot | Notes |
|--------|-------------|-------------|-------|
| Startup time | <1s | ~2-3s | Classpath scanning overhead |
| Requests/sec | ~1,826 | ~15,000+ | Tomcat NIO optimizations |
| Memory | ~50MB | ~150MB | Framework overhead |
| LOC (framework) | ~950 | ~100,000+ | Simplicity vs features |
| Learning curve | Low | High | You built it! |

---

## Testing Strategy

### Milestone 1.1: HTTP Server

**Manual Testing**:
```bash
# Start server
python -m milestone-1.1.main

# Test basic routing
curl http://localhost:8080/health

# Load test
ab -n 1000 -c 100 http://localhost:8080/api/test
```

**Validation Evidence**: `docs/evidence/m1.1/`

### Milestone 1.2: Framework

**Manual Testing**:
```bash
# Test routing
curl http://localhost:8080/api/users
curl http://localhost:8080/api/users/42

# Test middleware
curl -H "Authorization: Bearer token" http://localhost:8080/api/protected
```

**Validation Evidence**: `docs/evidence/m1.2/`

### Milestone 1.3: Connection Pool

**Automated Tests**:
```python
# Pool exhaustion
def test_exhaustion():
    pool = ConnectionPool(max=10)
    # Acquire 11 connections → 11th should timeout

# Leak detection
def test_leak():
    pool = ConnectionPool(leak_threshold=5.0)
    conn = pool.acquire()
    # Don't release → warning after 5 seconds
```

**Validation Evidence**: `docs/evidence/m1.3/`

### Milestone 1.4: Integration

**End-to-End Testing**:
```bash
# Start integrated app
./run_sample.sh

# Test full stack
curl -H "Authorization: Bearer secrettoken" \
  http://localhost:8080/api/users
```

**Validation Evidence**: `docs/evidence/m1.4/`

---

## Learning Outcomes

### Technical Skills

1. **Network Programming**
   - TCP socket lifecycle (bind, listen, accept, recv, send)
   - HTTP protocol parsing
   - Connection management

2. **Concurrency**
   - Thread pools
   - Thread-safe data structures (`Queue`, `Lock`)
   - Resource lifecycle management

3. **Design Patterns**
   - Middleware pipeline (Chain of Responsibility)
   - Dependency injection (Inversion of Control)
   - Object pooling (Resource management)

4. **System Design**
   - Layered architecture
   - Separation of concerns
   - Graceful degradation

### Interview Advantages

**Before**: "I use Spring Boot for REST APIs"
**After**: "I built a web framework from scratch, including HTTP server, routing, middleware, and DI. Here's how Spring Boot's `@Autowired` works internally..."

**Talking Points**:
- "I understand the difference between `Filter` and `HandlerInterceptor` because I implemented both"
- "I know why connection pooling matters because I built leak detection"
- "I can debug framework issues because I know how routing matches paths"

---

## Transition to Production (Spring Boot)

### What mini-spring Taught Us

| Concept | mini-spring Implementation | Spring Boot Equivalent |
|---------|---------------------------|------------------------|
| HTTP Server | `socket.socket()` + `ThreadPoolExecutor` | Embedded Tomcat |
| Routing | `@app.route()` decorator | `@GetMapping` annotation |
| Middleware | Function composition | `Filter` + `HandlerInterceptor` |
| DI | Manual container | `@Autowired` + `@Component` |
| Pooling | `queue.Queue` + `Lock` | HikariCP |

### Milestone 1.4.5: Spring Bridge

**Purpose**: Demonstrate 1:1 mapping between mini-spring and Spring Boot

**Deliverable**: Java Spring Boot app with:
- Same endpoints as mini-spring
- Mapping table showing equivalences
- Performance comparison

**Key Insight**: Spring Boot eliminates ~500 lines of boilerplate in exchange for "magic" configuration

---

## Project Structure

```
framework/
├── src/
│   ├── milestone-1.1/          # HTTP Server
│   │   ├── http_server.py      # Socket + ThreadPool
│   │   ├── http_parser.py      # Request parsing
│   │   ├── router.py           # Basic routing
│   │   └── main.py             # Entry point
│   │
│   ├── milestone-1.2/          # Mini-Framework
│   │   ├── framework/
│   │   │   ├── app.py          # Core App class
│   │   │   ├── container.py    # DI container
│   │   │   ├── decorators.py   # Middleware types
│   │   │   ├── request.py      # Request abstraction
│   │   │   └── response.py     # Response builder
│   │   └── example/            # Demo controllers
│   │
│   ├── milestone-1.3/          # Connection Pool
│   │   ├── pool/
│   │   │   ├── connection_pool.py  # Pool implementation
│   │   │   ├── pooled_connection.py # Context manager
│   │   │   ├── leak_detector.py    # Leak detection
│   │   │   └── config.py           # Pool config
│   │   └── tests/              # Pool tests
│   │
│   ├── milestone-1.4/          # Integration
│   │   ├── application.py      # App factory
│   │   ├── controllers.py      # Route handlers
│   │   ├── database.py         # In-memory DB
│   │   ├── middleware.py       # Custom middleware
│   │   └── main.py             # Entry point
│   │
│   └── milestone-1.4.5/        # Spring Bridge
│       ├── src/main/java/com/minispring/bridge/
│       │   ├── SpringBridgeApplication.java
│       │   ├── controller/     # @RestController
│       │   ├── service/        # @Service
│       │   ├── repository/     # @Repository
│       │   ├── filter/         # Filter
│       │   └── interceptor/    # HandlerInterceptor
│       └── MAPPING.md          # Comparison table
│
├── docs/
│   ├── evidence/               # Validation reports
│   │   ├── m1.1/
│   │   ├── m1.2/
│   │   ├── m1.3/
│   │   ├── m1.4/
│   │   └── m1.4.5/
│   ├── framework-guide.md      # Usage guide
│   └── learning-journal.md     # Learnings
│
├── design/                     # Design documents
│   ├── ci.md                   # This file
│   ├── 1.1-http-server.md
│   ├── 1.2-mini-framework.md
│   ├── 1.3-connection-pool.md
│   ├── 1.4-integration.md
│   └── 1.4.5-spring-bridge.md
│
└── README.md                   # Project overview
```

---

## References

### External Resources

1. **HTTP/1.1 Specification**: RFC 7230-7235
2. **Python Socket Programming**: [docs.python.org/3/library/socket.html](https://docs.python.org/3/library/socket.html)
3. **Spring Boot Documentation**: [spring.io/projects/spring-boot](https://spring.io/projects/spring-boot)
4. **HikariCP**: [github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)

### Design Documents

- [1.1: HTTP Server](./1.1-http-server.md) - Raw socket programming
- [1.2: Mini-Framework](./1.2-mini-framework.md) - Routing, middleware, DI
- [1.3: Connection Pool](./1.3-connection-pool.md) - Resource management
- [1.4: Integration](./1.4-integration.md) - Complete application
- [1.4.5: Spring Bridge](./1.4.5-spring-bridge.md) - Spring Boot mapping

---

## Completion Status

- [x] Milestone 1.1: HTTP Server (2025-10-15)
- [x] Milestone 1.2: Mini-Framework (2025-10-25)
- [x] Milestone 1.3: Connection Pool (2025-11-10)
- [x] Milestone 1.4: Integration (2025-11-20)
- [x] Milestone 1.4.5: Spring Bridge (2025-11-25)
- [x] Documentation (2025-11-30)
- [x] **Phase 1 Complete** (2025-11-30)

**Next**: Phase 2 - Use Spring Boot for production e-commerce platform (sagaline)
