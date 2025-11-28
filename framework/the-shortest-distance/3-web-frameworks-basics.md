# 문서 3. 웹 프레임워크 핵심 개념

## 1. 이 문서의 목적

**대상**: Python 기본 문법은 알지만, 웹 프레임워크는 처음인 개발자
**목표**: HTTP, 라우팅, 미들웨어, DI, 커넥션 풀 같은 **웹 프레임워크의 핵심 개념**을 이해

이 문서는 "Spring Boot/Django/FastAPI 사용법"이 아니다. **프레임워크가 내부적으로 어떻게 동작하는지**를 다룬다.

* 개념 설명만 하지 않고, **mini-spring 구현 코드**와 함께 제시
* C 서버 개발 경험을 바탕으로 "이미 알고 있는 것"과 연결
* Spring Boot와 비교하여 프레임워크의 본질 이해

---

## 2. HTTP 프로토콜 기초

### 2.1 HTTP는 텍스트 프로토콜이다

**HTTP Request 예시**:
```
GET /users/42 HTTP/1.1\r\n
Host: localhost:8080\r\n
User-Agent: curl/7.68.0\r\n
Accept: */*\r\n
\r\n
```

**HTTP Response 예시**:
```
HTTP/1.1 200 OK\r\n
Content-Type: application/json\r\n
Content-Length: 18\r\n
\r\n
{"user_id": "42"}
```

**핵심 포인트**:
1. 줄 구분자는 `\r\n` (CRLF)
2. Header와 Body는 빈 줄(`\r\n\r\n`)로 구분
3. Body 길이는 `Content-Length` 헤더로 지정

**C에서의 HTTP 파싱**:
```c
// C에서는 직접 파싱
char buffer[4096];
recv(socket, buffer, sizeof(buffer), 0);

// "GET /path HTTP/1.1" 추출
char *method = strtok(buffer, " ");
char *path = strtok(NULL, " ");
char *version = strtok(NULL, "\r\n");
```

**mini-spring에서의 HTTP 파싱**:
```python
# Python에서도 동일하게 직접 파싱
def from_socket(cls, conn: socket.socket) -> Optional["HttpRequest"]:
    buffer = conn.makefile("rb")

    # Request line: "GET /path HTTP/1.1\r\n"
    request_line = buffer.readline().decode("iso-8859-1").strip()
    parts = request_line.split()
    method, target, version = parts

    # Headers
    headers = {}
    while True:
        line = buffer.readline().decode("iso-8859-1")
        if line in ("\r\n", "\n", ""):
            break  # 빈 줄이면 헤더 끝
        name, value = line.split(":", 1)
        headers[name.strip().lower()] = value.strip()

    # Body (Content-Length 기반)
    content_length = headers.get("content-length")
    if content_length:
        body_bytes = buffer.read(int(content_length))
        body = body_bytes.decode("utf-8")

    return cls(method=method, path=path, headers=headers, body=body)
```

### 2.2 HTTP Methods

| Method | 용도 | Idempotent | Safe |
|--------|------|------------|------|
| GET | 조회 | ✅ | ✅ |
| POST | 생성 | ❌ | ❌ |
| PUT | 전체 수정 | ✅ | ❌ |
| PATCH | 부분 수정 | ❌ | ❌ |
| DELETE | 삭제 | ✅ | ❌ |

**Idempotent**: 같은 요청을 여러 번 해도 결과가 같음
**Safe**: 서버 상태를 변경하지 않음

### 2.3 Status Codes

| 범위 | 의미 | 예시 |
|------|------|------|
| 2xx | 성공 | 200 OK, 201 Created, 204 No Content |
| 3xx | 리다이렉션 | 301 Moved Permanently, 302 Found |
| 4xx | 클라이언트 에러 | 400 Bad Request, 401 Unauthorized, 404 Not Found |
| 5xx | 서버 에러 | 500 Internal Server Error, 503 Service Unavailable |

**mini-spring의 status code 매핑**:
```python
_STATUS_REASONS = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    404: "Not Found",
    500: "Internal Server Error",
}
```

---

## 3. 라우팅 (Routing)

### 3.1 라우팅이란?

**라우팅**: HTTP 요청의 (method, path)를 적절한 handler 함수로 매핑하는 것

**예시**:
```
GET /users        → get_users()
GET /users/42     → get_user(id="42")
POST /users       → create_user()
DELETE /users/42  → delete_user(id="42")
```

### 3.2 Path Parameter 추출

**Static Path** (정적 경로):
```
/health  → 정확히 "/health"만 매칭
```

**Dynamic Path** (동적 경로):
```
/users/{id}  → /users/42, /users/123 등 매칭
                id="42", id="123" 추출
```

**mini-spring의 path matching**:
```python
def matches(self, method: str, path: str) -> Optional[Dict[str, str]]:
    """Check if route matches request."""
    if method not in self.methods:
        return None

    # Segment 비교
    pattern_parts = self.path.strip("/").split("/")  # ["users", "{id}"]
    path_parts = path.strip("/").split("/")          # ["users", "42"]

    if len(pattern_parts) != len(path_parts):
        return None

    params = {}
    for pattern, value in zip(pattern_parts, path_parts):
        if pattern.startswith("{") and pattern.endswith("}"):
            # {id} → id="42"
            param_name = pattern[1:-1]
            params[param_name] = value
        elif pattern != value:
            return None  # 정적 부분이 다르면 매칭 실패

    return params
```

**Spring Boot와 비교**:
```python
# mini-spring
@app.route("/users/{id}", methods=["GET"])
def get_user(request, id):
    return {"user_id": id}
```

```java
// Spring Boot
@GetMapping("/users/{id}")
public Map<String, String> getUser(@PathVariable String id) {
    return Map.of("user_id", id);
}
```

### 3.3 라우팅 테이블

**Linear Search** (mini-spring):
```python
def resolve(self, method: str, path: str):
    for route in self._routes:  # O(n)
        params = route.matches(method, path)
        if params is not None:
            return route.handler, params
    raise RouteNotFound()
```

**Trie Structure** (Spring Boot):
- Spring Boot는 path를 trie로 구성하여 O(log n) 또는 O(1) 매칭
- 대규모 애플리케이션에서 성능 차이 발생

**Trade-off**:
- mini-spring: 간단한 구현, 소규모 앱에 충분
- Spring Boot: 복잡한 구현, 대규모 앱에 필수

---

## 4. 미들웨어 (Middleware)

### 4.1 미들웨어란?

**미들웨어**: 요청-응답 사이클의 **전처리/후처리**를 담당하는 함수

**전형적인 미들웨어 용도**:
- 로깅 (요청/응답 기록)
- 인증/인가 (토큰 검증)
- CORS 헤더 추가
- Rate limiting
- 에러 처리

### 4.2 미들웨어 파이프라인

**실행 순서**:
```
Request
  ↓
[Global Middleware 1: Logging]
  ↓
[Global Middleware 2: CORS]
  ↓
[Route Middleware: Auth]
  ↓
[Handler: get_user]
  ↓
← Response (역순으로 통과)
```

**mini-spring의 미들웨어 구조**:
```python
# Middleware 타입
Middleware = Callable[[Request, Callable], Any]

# 예시: logging middleware
def logging_middleware(request: Request, next_fn: Callable) -> Any:
    LOGGER.info("%s %s", request.method, request.path)

    response = next_fn(request)  # 다음 미들웨어/핸들러 호출

    LOGGER.info("→ %s", response.status)
    return response
```

### 4.3 Function Composition (함수 조합)

**미들웨어 체이닝**:
```python
def build_pipeline(route):
    # 1. Handler를 시작점으로
    pipeline = lambda req: route.handler(req)

    # 2. 미들웨어를 역순으로 감싸기
    for middleware in reversed([*global_mw, *route.middleware]):
        next_fn = pipeline
        pipeline = lambda req: middleware(req, next_fn)

    return pipeline

# 결과:
# pipeline = logging(req, lambda: cors(req, lambda: auth(req, lambda: handler(req))))
```

**실행 흐름**:
```python
# 1. logging middleware 진입
LOGGER.info("GET /admin")

# 2. next_fn() 호출 → cors middleware 진입
response = cors(request, next_fn)

# 3. next_fn() 호출 → auth middleware 진입
if not valid_token:
    return Response(status=401)  # 여기서 중단!

# 4. next_fn() 호출 → handler 실행
response = handler(request)

# 5. response 반환 (역순으로 통과)
LOGGER.info("→ 401")
```

### 4.4 Spring Boot와 비교

**mini-spring**:
```python
# Global middleware
app.use(logging_middleware)

# Route-specific
@app.route("/admin", middleware=[auth_middleware])
def admin(request):
    return {"message": "Admin"}
```

**Spring Boot**:
```java
// Global middleware (Filter)
@Component
public class LoggingFilter implements Filter {
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        LOGGER.info("{} {}", method, path);
        chain.doFilter(req, res);
        LOGGER.info("→ {}", status);
    }
}

// Route-specific (Interceptor)
@Component
public class AuthInterceptor implements HandlerInterceptor {
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        if (!validToken) {
            res.setStatus(401);
            return false;  // 중단
        }
        return true;  // 계속
    }
}
```

**차이점**:
- mini-spring: 하나의 미들웨어 타입 (간단)
- Spring Boot: Filter + Interceptor 2단계 (복잡하지만 유연)

---

## 5. Dependency Injection (의존성 주입)

### 5.1 DI란?

**Without DI** (의존성 직접 생성):
```python
def get_user(request, id):
    db = Database()  # 하드코딩된 의존성
    user = db.get_user(id)
    return {"user": user}
```

**문제점**:
- 테스트하기 어려움 (mock DB 주입 불가)
- 매번 새 DB 인스턴스 생성 (비효율)
- 설정 변경이 어려움

**With DI** (의존성 주입):
```python
def get_user(request, id):
    db = request.app.resolve("database")  # Container에서 주입
    user = db.get_user(id)
    return {"user": user}
```

**장점**:
- 테스트 시 mock DB 주입 가능
- Singleton으로 인스턴스 공유 가능
- 설정을 한 곳에서 관리

### 5.2 DI Container

**mini-spring의 DependencyContainer**:
```python
class DependencyContainer:
    def __init__(self):
        self._registrations = {}  # name → instance or factory
        self._singletons = {}     # name → cached instance
        self._lock = threading.RLock()

    def register_instance(self, name: str, instance: Any):
        """Register pre-created instance."""
        self._registrations[name] = instance

    def register_factory(self, name: str, factory: Callable, *, singleton=True):
        """Register factory function."""
        self._registrations[name] = (factory, singleton)

    def resolve(self, name: str) -> Any:
        """Resolve dependency."""
        entry = self._registrations[name]

        if not isinstance(entry, tuple):
            return entry  # Instance

        factory, singleton = entry

        if singleton and name in self._singletons:
            return self._singletons[name]  # Cached

        instance = factory(self)  # Create

        if singleton:
            self._singletons[name] = instance

        return instance
```

**사용 예시**:
```python
# 등록
app.register_instance("database", Database())

def create_pool(container):
    db = container.resolve("database")
    return ConnectionPool(db)

app.register_factory("pool", create_pool, singleton=True)

# 사용
db = app.resolve("database")  # 같은 인스턴스
pool = app.resolve("pool")    # 같은 인스턴스 (singleton)
```

### 5.3 Spring Boot와 비교

**mini-spring**:
```python
# 등록
app.register_instance("database", db)

# 해결 (수동)
db = request.app.resolve("database")
```

**Spring Boot**:
```java
// 등록 (자동)
@Repository
public class UserRepository {
    // ...
}

// 해결 (자동)
@Service
public class UserService {
    @Autowired  // 자동 주입!
    private UserRepository repository;
}
```

**차이점**:
- mini-spring: 이름 기반 (string), 수동 resolve
- Spring Boot: 타입 기반 (class), 자동 주입

---

## 6. Connection Pooling (커넥션 풀링)

### 6.1 왜 풀링이 필요한가?

**Without Pool**:
```python
def get_user(id):
    conn = db.create_connection()  # 매번 생성 (50ms)
    user = conn.query("SELECT ...")
    conn.close()
    return user
```

**문제점**:
- 커넥션 생성/해제 오버헤드 (50-100ms)
- DB 커넥션 수 제한 초과 (exhaustion)
- 리소스 낭비

**With Pool**:
```python
def get_user(id):
    with pool.acquire() as conn:  # 재사용 (0.5ms)
        user = conn.query("SELECT ...")
    # 자동 반환
    return user
```

**장점**:
- 빠른 획득 (미리 생성된 커넥션 재사용)
- 커넥션 수 제한 (max_connections)
- 리소스 효율

### 6.2 Pool 상태 관리

**Available Queue** (사용 가능한 커넥션):
```python
self._available: queue.Queue = queue.Queue()
# [conn1, conn2, conn3]
```

**In-Use Set** (사용 중인 커넥션):
```python
self._in_use: Set = set()
# {conn4, conn5}
```

**Total Count** (전체 커넥션 수):
```python
self._total_connections: int = 0
# available + in_use
```

### 6.3 Acquire 로직

```python
def acquire(self) -> PooledConnection:
    deadline = time.monotonic() + timeout

    while True:
        # 1. Available queue에서 가져오기 시도
        try:
            conn = self._available.get_nowait()
        except queue.Empty:
            # 2. Queue가 비었으면 새로 생성 (max 이하일 때)
            with self._lock:
                if self._total < self._max:
                    conn = self._create_connection()
                else:
                    conn = None

            # 3. Pool exhausted면 대기
            if conn is None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise PoolExhaustedError()
                conn = self._available.get(timeout=remaining)

        # 4. Health check
        if not self._is_healthy(conn):
            self._dispose(conn)
            continue  # 재시도

        # 5. In-use로 이동
        with self._lock:
            self._in_use.add(conn)

        return PooledConnection(conn, self)
```

### 6.4 Release 로직

```python
def release(self, conn):
    # 1. In-use에서 제거
    with self._lock:
        self._in_use.remove(conn)

    # 2. Health check
    if self._is_healthy(conn):
        # Healthy: Queue로 반환
        self._available.put(conn)
    else:
        # Unhealthy: 폐기
        self._dispose(conn)
```

### 6.5 Leak Detection

**문제**: 프로그래머가 release 잊어버림
```python
conn = pool.acquire()
user = conn.query("...")
# release 안 함! → 누수
```

**해결**: 획득 시간 기록
```python
class LeakDetector:
    def __init__(self, threshold=30.0):
        self._threshold = threshold
        self._acquisitions = {}  # conn → timestamp

    def record_acquisition(self, conn):
        self._acquisitions[conn] = time.monotonic()

    def check_leaks(self):
        now = time.monotonic()
        leaks = []
        for conn, acquired_at in self._acquisitions.items():
            if now - acquired_at > self._threshold:
                leaks.append(conn)
        return leaks
```

### 6.6 Context Manager (자동 release)

```python
class PooledConnection:
    def __enter__(self):
        return self._connection

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._pool.release(self._connection)
        return False

# 사용
with pool.acquire() as conn:
    conn.query("...")
# 자동으로 release
```

### 6.7 HikariCP와 비교

| 기능 | mini-spring | HikariCP |
|------|-------------|----------|
| 구현 | `queue.Queue` + `Lock` | `ConcurrentBag` (lock-free) |
| Acquire | ~0.5ms | ~0.05ms (10배 빠름) |
| Leak detection | 수동 check | 자동 logging |
| Health check | `is_valid()` protocol | JDBC4 `isValid()` + custom |
| Metrics | Basic counters | JMX + Micrometer |

---

## 7. Request/Response 추상화

### 7.1 왜 추상화가 필요한가?

**Raw HTTP**:
```python
# 파싱된 결과
method = "GET"
path = "/users/42"
headers = {"host": "localhost", "content-type": "application/json"}
body = '{"name": "Alice"}'
```

**문제점**:
- 매번 JSON 파싱 필요 (`json.loads(body)`)
- Path parameter 수동 추출
- 타입 안정성 없음

**추상화된 Request**:
```python
class Request:
    @property
    def method(self) -> str:
        return self.raw.method

    @property
    def path_params(self) -> Dict[str, str]:
        return self.raw.path_params

    def json(self) -> Any:
        return json.loads(self.raw.body)

# 사용
def create_user(request):
    data = request.json()  # 자동 파싱
    name = data["name"]
```

### 7.2 Response 자동 변환

**Handler 반환 타입**:
```python
# 1. Dict → JSON response
return {"user_id": 42}

# 2. String → Text response
return "Hello, World!"

# 3. Response → 명시적 제어
return Response(status=201, payload=b'...', headers={...})
```

**자동 변환 로직**:
```python
@classmethod
def from_result(cls, result: Any) -> Response:
    if isinstance(result, Response):
        return result

    if isinstance(result, dict):
        payload = json.dumps(result).encode("utf-8")
        return cls(
            status=200,
            payload=payload,
            headers={"Content-Type": "application/json"}
        )

    if isinstance(result, str):
        payload = result.encode("utf-8")
        return cls(
            status=200,
            payload=payload,
            headers={"Content-Type": "text/plain"}
        )

    raise TypeError(f"Unsupported type: {type(result)}")
```

---

## 8. 전체 흐름 종합

**HTTP Request → Response 전체 파이프라인**:

```
1. Socket accept()
   ↓
2. HTTP 파싱 (method, path, headers, body)
   ↓
3. Route matching (method, path → handler, params)
   ↓
4. Request 객체 생성 (raw + app)
   ↓
5. Middleware 파이프라인 구성
   [logging] → [cors] → [auth] → [handler]
   ↓
6. Handler 실행
   - DI container에서 의존성 해결
   - Connection pool에서 커넥션 획득
   - 비즈니스 로직 실행
   - 결과 반환 (dict/str/Response)
   ↓
7. Response 자동 변환 (dict → JSON)
   ↓
8. HTTP response 포맷팅
   "HTTP/1.1 200 OK\r\n..."
   ↓
9. Socket send()
   ↓
10. Socket close()
```

---

## 9. 체크리스트: 웹 프레임워크 개념 학습 완료

다음 항목에 "예"라고 말할 수 있으면 이 문서를 통과한 것으로 본다.

* [ ] HTTP 요청/응답 형식을 이해하고, 직접 파싱할 수 있다.
* [ ] 라우팅이 무엇인지 이해하고, path parameter 추출 로직을 설명할 수 있다.
* [ ] 미들웨어 파이프라인이 어떻게 동작하는지 이해하고, function composition을 설명할 수 있다.
* [ ] Dependency Injection의 장점을 이해하고, singleton vs factory 차이를 설명할 수 있다.
* [ ] Connection Pool이 왜 필요한지 이해하고, acquire/release 로직을 설명할 수 있다.
* [ ] Request/Response 추상화가 왜 필요한지 이해하고, 자동 JSON 변환 로직을 설명할 수 있다.
* [ ] mini-spring의 전체 요청-응답 파이프라인을 순서대로 설명할 수 있다.
* [ ] mini-spring과 Spring Boot의 차이점을 이해하고, 각각의 장단점을 설명할 수 있다.

---

**다음 단계**: 문서 4 (빠른 시작 가이드)로 넘어가서 각 Milestone을 직접 구현해보자.
