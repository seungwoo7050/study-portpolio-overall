# 문서 1. mini-spring 프레임워크 학습 로드맵

## 1. 이 문서의 역할

이 문서는 **mini-spring 프레임워크 프로젝트의 학습 지도**다.

* **대상**: C/C++로 서버 개발은 해봤지만, Python/웹 프레임워크는 처음인 개발자
* **목표**:
  * HTTP 서버, 라우팅, 미들웨어, DI, 커넥션 풀이 **어떻게 연결되는지** 한 눈에 이해
  * 어떤 순서(Milestone)로 학습하면 되는지 파악
  * 각 Milestone에서 **무엇을 만들고, 통과 기준이 뭔지** 명확히 정리

세부 문법, 코드, 설정은 각각:

* **문서 2**: C 개발자를 위한 Python 기본기 (타입, 문법, 모듈, 비동기)
* **문서 3**: 웹 프레임워크 핵심 개념 (HTTP, 라우팅, 미들웨어, DI, 풀링)
* **문서 4**: 각 Milestone별 빠른 시작 가이드

에서 다룬다. 이 문서는 그 위에 얹는 "지도"라고 생각하면 된다.

---

## 2. 최종 목표: 어떤 것을 만들 것인가

최종적으로 목표하는 것은 단순하다:

> **raw socket부터 시작해서 Spring Boot/Django/FastAPI 같은 프레임워크를 직접 구현해보고, 이를 Spring Boot와 비교하여 프레임워크 내부를 완전히 이해하는 것**

구체적으로:

1. **Milestone 1.1: HTTP Server (from scratch)**
   * raw TCP socket (`socket.socket()`)
   * HTTP/1.1 프로토콜 수동 파싱
   * Thread pool로 동시 접속 처리

2. **Milestone 1.2: Mini-Framework**
   * 데코레이터 기반 라우팅 (`@app.route()`)
   * 미들웨어 파이프라인 (로깅, 인증)
   * Dependency Injection 컨테이너

3. **Milestone 1.3: Connection Pool**
   * Thread-safe 리소스 풀링
   * 누수 감지 (leak detection)
   * Health checking

4. **Milestone 1.4: Integration**
   * 전체 통합된 REST API 샘플 앱
   * CRUD 엔드포인트
   * 우아한 종료 (graceful shutdown)

5. **Milestone 1.4.5: Spring Bridge**
   * Spring Boot로 동일 앱 재구현
   * 1:1 매핑 테이블
   * 성능/코드량 비교

**이 전체 플로우를 Milestone 1.1 → 1.2 → 1.3 → 1.4 → 1.4.5로 쌓아간다.**

---

## 3. 전체 아키텍처 한 번에 보기

### 3.1 논리적 구성도

```
[Layer 1: HTTP Server - Milestone 1.1]
  - socket.socket(AF_INET, SOCK_STREAM)
  - bind(port), listen(), accept()
  - ThreadPoolExecutor (100 workers)
  - HTTP request/response 수동 파싱
          │
          ▼
[Layer 2: Framework Core - Milestone 1.2]
  - @app.route() 데코레이터 라우팅
  - 미들웨어 파이프라인 (function composition)
  - DependencyContainer (manual DI)
  - Request/Response 추상화
          │
          ▼
[Layer 3: Data Access - Milestone 1.3]
  - ConnectionPool (queue.Queue + Lock)
  - Leak detection
  - Health checking
  - PooledConnection (context manager)
          │
          ▼
[Layer 4: Application - Milestone 1.4]
  - Controllers (route handlers)
  - Services (business logic)
  - InMemoryDatabase
  - Graceful shutdown
```

관점 정리:

* **HTTP Server**: C에서 만들던 socket 서버 그대로. Python으로 옮긴 것.
* **Framework**: Spring의 `@RestController`, Flask의 `@app.route()` 같은 것을 직접 구현.
* **Connection Pool**: HikariCP, c3p0 같은 것을 직접 구현.
* **Application**: 위 3개를 조합해서 실제 REST API 만드는 부분.

---

### 3.2 요청-응답 시퀀스 (대표 시나리오)

예시 시나리오: **HTTP GET /users/42 → DB에서 조회 → JSON 응답**

```
1. 클라이언트가 TCP connect → HTTP GET /users/42 전송
2. HttpServer가 accept() → ThreadPoolExecutor에 작업 제출
3. Worker thread가:
   (1) HTTP 요청 파싱 (method, path, headers, body)
   (2) Router.resolve("GET", "/users/42") → handler 함수 찾기
   (3) 미들웨어 파이프라인 실행
       - logging_middleware: 로그 출력
       - (route-specific) auth_middleware: 인증 체크
   (4) handler 실행:
       - DI container에서 connection_pool 꺼내기
       - pool.acquire() → connection 획득
       - connection.get_user("42") → DB 조회
       - pool.release(connection) → connection 반환
   (5) 결과를 Response로 변환
   (6) HTTP response 포맷팅 (status line, headers, body)
4. socket.sendall() → 클라이언트에 응답 전송
5. socket.close() → 연결 종료
```

이 "한 줄 시나리오"를 위해 필요한 지식들을 Milestone로 쪼갠 게 뒤에 나오는 로드맵이다.

---

## 4. Milestone별 로드맵 개요

Milestone은 "기술 이름" 기준이 아니라 **"검증 가능한 기능 단위"** 기준으로 나눈다.

* **Milestone 1.1**: HTTP 서버 기본 (socket + 파싱)
* **Milestone 1.2**: 프레임워크 핵심 (라우팅 + 미들웨어 + DI)
* **Milestone 1.3**: 리소스 관리 (커넥션 풀)
* **Milestone 1.4**: 통합 (완전한 REST API)
* **Milestone 1.4.5**: Spring Boot 비교

각 Milestone마다:

* 필요 기술
* 만들어야 할 최소 기능
* 통과 체크리스트

를 명확하게 정의한다.

---

## 5. Milestone 1.1 – HTTP Server from Raw Sockets

### 5.1 Milestone 1.1의 목표

* Python의 `socket` 모듈로 **TCP 서버**를 만들고,
* HTTP/1.1 프로토콜을 **수동으로 파싱**하며,
* **ThreadPoolExecutor**로 동시 접속을 처리할 수 있는 수준.

이 Milestone에서는 **프레임워크 개념은 아직 안 건드린다.**
목표는 "HTTP는 단순한 텍스트 프로토콜이다"를 체험하는 것.

### 5.2 다루는 기술

* **Python Socket Programming**
  * `socket.socket(AF_INET, SOCK_STREAM)`
  * `bind()`, `listen()`, `accept()`
  * `recv()`, `send()`, `sendall()`
  * `SO_REUSEADDR` 옵션
  * socket timeout, close

* **HTTP/1.1 Protocol**
  * Request line: `GET /path HTTP/1.1`
  * Headers: `Host: localhost`, `Content-Type: ...`
  * Body: `Content-Length` 기반 읽기
  * Response format: `HTTP/1.1 200 OK\r\n...`

* **Threading**
  * `concurrent.futures.ThreadPoolExecutor`
  * `threading.Lock`, `threading.RLock`
  * Thread-safe queue

* **Basic Routing**
  * path → handler 함수 매핑
  * path parameter 추출 (`/users/{id}`)

### 5.3 이 Milestone에서 완성해야 할 기능

최소 기능:

1. **HTTP Server**
   * port 8080에서 listen
   * 100+ 동시 접속 처리
   * HTTP GET, POST 지원

2. **Basic Routing**
   * `GET /health` → `{"status": "up"}`
   * `GET /users/{id}` → `{"user_id": "42"}`
   * `POST /users` → JSON body 파싱

3. **Error Handling**
   * 404 Not Found
   * 500 Internal Server Error
   * 400 Bad Request (malformed HTTP)

### 5.4 통과 체크리스트

아래 항목에 "예"라고 말할 수 있으면 Milestone 1.1 통과로 본다.

* [ ] Python `socket` 모듈로 TCP 서버를 만들고 클라이언트 연결을 받을 수 있다.
* [ ] HTTP 요청을 수동으로 파싱해서 method, path, headers, body를 추출할 수 있다.
* [ ] ThreadPoolExecutor를 사용해서 100개 이상의 동시 요청을 처리할 수 있다.
* [ ] curl 또는 브라우저로 `http://localhost:8080/health`를 요청하면 JSON 응답이 돌아온다.
* [ ] Apache Bench (ab)로 부하 테스트를 해서 요청/초를 측정할 수 있다.

Milestone 1.1이 끝나면 **"C로 만들던 TCP 서버를 Python으로 만들 수 있는 상태"**가 된다.

**C와의 비교**:
```c
// C에서는:
int server_fd = socket(AF_INET, SOCK_STREAM, 0);
bind(server_fd, ...);
listen(server_fd, backlog);

while (1) {
    int client_fd = accept(server_fd, ...);
    // thread 생성 또는 epoll로 처리
}
```

```python
# Python에서는:
server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server_socket.bind((host, port))
server_socket.listen()

with ThreadPoolExecutor(max_workers=100) as executor:
    while running:
        client_socket, address = server_socket.accept()
        executor.submit(handle_connection, client_socket)
```

---

## 6. Milestone 1.2 – Mini-Framework (Routing + Middleware + DI)

### 6.1 Milestone 1.2의 목표

* **데코레이터 기반 라우팅**을 만들어서 Spring의 `@GetMapping` 같은 경험을 하고,
* **미들웨어 파이프라인**으로 로깅, 인증 같은 횡단 관심사를 처리하며,
* **Dependency Injection 컨테이너**를 만들어서 싱글톤/팩토리 패턴을 경험하는 것.

이 Milestone까지가 "프레임워크의 핵심"이다.

### 6.2 다루는 기술

* **Python Decorators**
  * `@app.route("/path")` 문법
  * 함수를 감싸는 패턴
  * 데코레이터 체이닝

* **Middleware Pattern**
  * Chain of Responsibility
  * Function composition
  * `next()` 함수 패턴

* **Dependency Injection**
  * Container (registry)
  * Singleton vs Factory
  * Lazy initialization
  * Thread-safety (`RLock`)

* **Request/Response Abstraction**
  * Raw HTTP → high-level API
  * Auto JSON serialization
  * Type conversions

### 6.3 이 Milestone에서 완성해야 할 기능

대표 시나리오:

```python
from framework.app import App

app = App()

# DI 등록
app.register_instance("database", database)

# Global middleware
app.use(logging_middleware)

# Route with middleware
@app.route("/users/{id}", methods=["GET"])
def get_user(request, id):
    db = request.app.resolve("database")
    user = db.get_user(id)
    return {"user": user.to_dict()}

@app.route("/admin", middleware=[auth_middleware])
def admin_panel(request):
    return {"message": "Admin panel"}

app.listen(port=8080)
```

### 6.4 통과 체크리스트

* [ ] `@app.route()` 데코레이터로 라우트를 등록하고, path parameter를 추출할 수 있다.
* [ ] Global middleware와 route-specific middleware를 구분해서 실행할 수 있다.
* [ ] DI container에 instance와 factory를 등록하고, `resolve()`로 꺼낼 수 있다.
* [ ] handler가 dict를 반환하면 자동으로 JSON 응답이 되는 것을 확인했다.
* [ ] middleware에서 요청을 중단하고 401/403 같은 에러를 반환할 수 있다.

Milestone 1.2가 끝나면 **"Flask/FastAPI 스타일의 프레임워크를 직접 만들 수 있는 상태"**가 된다.

**Spring Boot와의 비교**:
```python
# mini-spring (Python)
@app.route("/users/{id}")
def get_user(request, id):
    db = request.app.resolve("database")
    return {"user_id": id}
```

```java
// Spring Boot (Java)
@RestController
@RequestMapping("/users")
public class UserController {
    @Autowired
    private Database database;

    @GetMapping("/{id}")
    public Map<String, String> getUser(@PathVariable String id) {
        return Map.of("user_id", id);
    }
}
```

---

## 7. Milestone 1.3 – Connection Pool

### 7.1 Milestone 1.3의 목표

* **Thread-safe 리소스 풀링**을 구현해서 HikariCP/c3p0 같은 것을 이해하고,
* **Leak detection**으로 리소스 누수를 감지하며,
* **Health checking**으로 깨진 커넥션을 자동으로 제거하는 것.

이 Milestone은 "동시성과 리소스 관리"의 정수다.

### 7.2 다루는 기술

* **Thread-safe Data Structures**
  * `queue.Queue` (FIFO, thread-safe)
  * `set` + `threading.Lock`
  * Atomic operations

* **Resource Pooling Pattern**
  * Pre-allocation (min connections)
  * Dynamic growth (up to max)
  * Timeout-based blocking
  * Health validation

* **Leak Detection**
  * Timestamp tracking
  * Threshold-based warnings
  * Stack trace capture (선택)

* **Context Manager**
  * `with pool.acquire() as conn:`
  * `__enter__`, `__exit__`
  * RAII pattern (Python style)

### 7.3 이 Milestone에서 완성해야 할 기능

```python
from pool.config import PoolConfig
from pool.connection_pool import ConnectionPool

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
    users = conn.query("SELECT * FROM users")
# connection automatically released
```

### 7.4 통과 체크리스트

* [ ] Pool이 min_connections만큼 미리 생성하고, 필요시 max까지 늘어나는 것을 확인했다.
* [ ] Pool이 exhausted 상태일 때 새 요청이 timeout으로 실패하는 것을 확인했다.
* [ ] Unhealthy connection이 자동으로 제거되고 새 connection이 생성되는 것을 확인했다.
* [ ] Context manager (`with pool.acquire()`)로 자동 release가 되는 것을 확인했다.
* [ ] 여러 thread에서 동시에 acquire/release를 해도 안전한 것을 확인했다.

Milestone 1.3이 끝나면 **"Production-grade 리소스 풀링을 직접 만들 수 있는 상태"**가 된다.

**C++와의 비교**:
```cpp
// C++에서는:
class ConnectionPool {
    std::queue<Connection*> available;
    std::set<Connection*> in_use;
    std::mutex lock;

public:
    Connection* acquire() {
        std::unique_lock<std::mutex> guard(lock);
        // ...
    }
};
```

```python
# Python에서는:
class ConnectionPool:
    def __init__(self, config):
        self._available = queue.Queue()  # Already thread-safe!
        self._in_use = set()
        self._lock = threading.Lock()

    def acquire(self):
        # queue.Queue handles locking internally
        conn = self._available.get(timeout=timeout)
        with self._lock:
            self._in_use.add(conn)
        return conn
```

---

## 8. Milestone 1.4 – Integration (Complete Application)

### 8.1 Milestone 1.4의 목표

* 위 3개 Milestone을 **통합**해서 완전한 REST API를 만들고,
* **Application Factory Pattern**으로 DI를 구성하며,
* **Graceful Shutdown**으로 우아하게 종료하는 것.

이 Milestone은 "모든 것을 하나로 묶는" 단계다.

### 8.2 다루는 기술

* **Application Factory**
  * `create_app()` 함수
  * DI container 구성
  * Middleware 등록
  * Route 등록

* **Signal Handling**
  * `signal.SIGINT`, `signal.SIGTERM`
  * Graceful shutdown handler
  * Connection pool cleanup

* **REST API Design**
  * CRUD operations
  * Status codes (200, 201, 404, 500)
  * Error responses

### 8.3 이 Milestone에서 완성해야 할 기능

```python
# application.py
def create_app(host="0.0.0.0", port=8080):
    app = App(host=host, port=port)

    # Create dependencies
    database = InMemoryDatabase()
    pool = create_connection_pool(database)

    # Register in DI container
    app.register_instance("database", database)
    app.register_instance("connection_pool", pool)

    # Register middleware
    app.use(logging_middleware)

    # Register routes
    register_controllers(app)

    return app

# main.py
def main():
    app = create_app(port=8080)

    signal.signal(signal.SIGINT, graceful_shutdown(app))
    signal.signal(signal.SIGTERM, graceful_shutdown(app))

    app.listen()
```

### 8.4 통과 체크리스트

* [ ] `GET /health`, `GET /users`, `GET /users/{id}`, `POST /users` 모두 동작한다.
* [ ] Connection pool이 제대로 통합되어 DB 조회가 성공한다.
* [ ] Middleware가 모든 요청에 대해 로그를 출력한다.
* [ ] Ctrl+C로 종료할 때 모든 리소스가 정리되고 깨끗하게 종료된다.
* [ ] 100+ 동시 요청 부하 테스트를 통과한다.

Milestone 1.4가 끝나면 **"완전한 웹 프레임워크와 REST API를 만들 수 있는 상태"**가 된다.

---

## 9. Milestone 1.4.5 – Spring Boot Bridge (Comparison)

### 9.1 Milestone 1.4.5의 목표

* **Spring Boot로 동일한 앱을 재구현**해서 차이를 직접 경험하고,
* **1:1 매핑 테이블**을 만들어서 개념 대응을 명확히 하며,
* **성능/코드량 비교**로 프레임워크의 가치를 이해하는 것.

이 Milestone은 "학습의 정점"이다.

### 9.2 다루는 기술

* **Spring Boot Basics**
  * `@SpringBootApplication`
  * `@RestController`, `@GetMapping`
  * `@Autowired`, `@Component`
  * `application.properties`

* **Embedded Tomcat**
  * Auto-configuration
  * Thread pool settings

* **HikariCP**
  * DataSource configuration
  * Connection pool metrics

### 9.3 이 Milestone에서 완성해야 할 기능

```java
// SpringBridgeApplication.java
@SpringBootApplication
public class SpringBridgeApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpringBridgeApplication.class, args);
    }
}

// UserController.java
@RestController
@RequestMapping("/users")
public class UserController {
    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, User>> getUser(@PathVariable String id) {
        return userService.getUserById(id)
            .map(user -> ResponseEntity.ok(Map.of("user", user)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
```

### 9.4 1:1 매핑 테이블

| mini-spring | Spring Boot | LOC 감소 |
|-------------|-------------|----------|
| `socket.socket()` + `ThreadPoolExecutor` | Embedded Tomcat | 98% (124 → 2) |
| `@app.route()` | `@GetMapping` | 76% (63 → 15) |
| `app.use(middleware)` | `Filter` + `HandlerInterceptor` | 33% (45 → 30) |
| `DependencyContainer` | `@Autowired` | 100% (75 → 0) |
| `ConnectionPool` | HikariCP | 95% (118 → 6) |
| **Total** | | **75% (580 → 143)** |

### 9.5 통과 체크리스트

* [ ] Spring Boot 앱이 mini-spring과 동일한 API를 제공한다.
* [ ] 매핑 테이블을 작성해서 각 개념의 대응을 명확히 했다.
* [ ] 성능 벤치마크 (req/sec, latency)를 비교했다.
* [ ] 코드량 감소 (LOC reduction)를 계산했다.
* [ ] Spring Boot의 auto-configuration이 무엇을 대신해주는지 이해했다.

Milestone 1.4.5가 끝나면 **"Spring Boot를 쓰되, 내부를 완전히 이해하는 상태"**가 된다.

---

## 10. 정리: 학습 순서 요약

추천 순서는 아래와 같다.

1. **문서 1 (지금 이 문서)**
   * 전체 구조/Milestone/목표 확인

2. **문서 2 – C 개발자를 위한 Python 기본기**
   * Python 문법, 타입, 모듈, 비동기
   * Milestone 1.1-1.4의 Python 지식 커버

3. **문서 3 – 웹 프레임워크 핵심 개념**
   * HTTP, 라우팅, 미들웨어, DI, 풀링
   * Milestone 1.1-1.4의 개념 설명

4. **문서 4 – 각 Milestone별 빠른 시작 가이드**
   * Milestone 1.1: HTTP 서버 시작하기
   * Milestone 1.2: 프레임워크 만들기
   * Milestone 1.3: 커넥션 풀 구현하기
   * Milestone 1.4: 통합 앱 완성하기
   * Milestone 1.4.5: Spring Boot 비교하기

5. **실제 코드 작성 (framework/src/ 참조)**
   * 각 Milestone 폴더의 실제 구현 보기
   * 코드 읽으면서 이해하기
   * 직접 수정해보기

6. **Design 문서 참조 (framework/design/ 참조)**
   * 각 Milestone의 상세 설계 문서
   * 왜 이렇게 만들었는지 이해하기
   * 성능 특성, 한계, trade-off 파악하기

이 문서는 여기까지.
다음 단계로는 **문서 2**에서 Python 기초를 빠르게 익히면 된다.

---

## 11. C 프로그래머를 위한 빠른 참고

### Python vs C 핵심 차이점

| 개념 | C | Python |
|------|---|--------|
| 타입 | 명시적 (`int x;`) | 동적 (`x = 5`) |
| 메모리 관리 | 수동 (`malloc`/`free`) | 자동 (GC) |
| 문자열 | `char*`, null-terminated | `str` 객체 (immutable) |
| 배열 | 고정 크기 | `list` (동적) |
| 함수 포인터 | `void (*fn)()` | First-class functions |
| 에러 처리 | Return code | Exceptions |
| 동시성 | `pthread` | `threading` (GIL 제약) |
| 모듈 | `#include` | `import` |

### 핵심 패턴 비교

**RAII vs Context Manager**:
```c
// C++
{
    std::unique_ptr<Connection> conn(pool.acquire());
    conn->query("SELECT ...");
}  // auto release
```

```python
# Python
with pool.acquire() as conn:
    conn.query("SELECT ...")
# auto release
```

**Thread Creation**:
```c
// C
pthread_t thread;
pthread_create(&thread, NULL, worker, arg);
pthread_join(thread, NULL);
```

```python
# Python
thread = threading.Thread(target=worker, args=(arg,))
thread.start()
thread.join()
```

**Socket Programming**:
```c
// C
int fd = socket(AF_INET, SOCK_STREAM, 0);
bind(fd, &addr, sizeof(addr));
listen(fd, backlog);
int client = accept(fd, ...);
```

```python
# Python
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind((host, port))
sock.listen(backlog)
client, addr = sock.accept()
```

---

**이 문서를 다 읽었다면, 문서 2로 넘어가서 Python 기초를 빠르게 익히자!**
