# 문서 4. 각 Milestone별 빠른 시작 가이드

## 1. 이 문서의 목적

**대상**: Python 기초와 웹 프레임워크 개념을 이해한 개발자
**목표**: 각 Milestone을 **실제로 구현**하면서 hands-on 학습

이 문서는 "코드를 베껴 쓰는 튜토리얼"이 아니다. **직접 생각하면서 구현할 수 있도록 가이드**를 제공한다.

* 각 Milestone의 핵심 구현 포인트
* 막힐 때 참고할 수 있는 힌트
* 테스트 방법 및 검증 체크리스트
* 실제 코드는 `framework/src/` 폴더 참조

---

## 2. 환경 설정

### 2.1 Python 설치

```bash
# Python 3.11+ 확인
python3 --version  # Python 3.11.0 이상

# 가상환경 생성 (권장)
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows
```

### 2.2 프로젝트 구조 생성

```bash
mkdir mini-spring
cd mini-spring

mkdir -p src/milestone-1.1
mkdir -p src/milestone-1.2/framework
mkdir -p src/milestone-1.3/pool
mkdir -p src/milestone-1.4
```

---

## 3. Milestone 1.1: HTTP Server from Raw Sockets

### 3.1 목표

raw socket으로 HTTP/1.1 서버를 만들고, 기본 라우팅을 구현한다.

### 3.2 필수 구현 항목

1. **HttpServer 클래스**
   - `__init__(host, port, router, max_workers)`
   - `start()`: socket listen + accept loop
   - `_handle_connection(client_socket)`: HTTP 파싱 + 라우팅

2. **HttpRequest 클래스**
   - `from_socket(socket)`: HTTP 요청 파싱
   - 속성: `method`, `path`, `headers`, `body`

3. **HttpResponse 클래스**
   - `to_bytes()`: HTTP 응답 포맷팅
   - Helper: `ok()`, `not_found()`, `server_error()`

4. **Router 클래스**
   - `register(method, path, handler)`: 라우트 등록
   - `resolve(method, path)`: handler 찾기 + path params 추출

### 3.3 구현 힌트

**HTTP 파싱 핵심**:
```python
def from_socket(cls, conn):
    buffer = conn.makefile("rb")

    # 1. Request line: "GET /path HTTP/1.1\r\n"
    request_line = buffer.readline().decode("iso-8859-1").strip()
    method, path, version = request_line.split()

    # 2. Headers (빈 줄까지)
    headers = {}
    while True:
        line = buffer.readline().decode("iso-8859-1")
        if line in ("\r\n", "\n", ""):
            break
        name, value = line.split(":", 1)
        headers[name.strip().lower()] = value.strip()

    # 3. Body (Content-Length 기반)
    body = ""
    if "content-length" in headers:
        length = int(headers["content-length"])
        body = buffer.read(length).decode("utf-8")

    return cls(method, path, version, headers, body)
```

**Path parameter 추출**:
```python
def match_path(pattern, path):
    pattern_parts = pattern.strip("/").split("/")  # ["users", "{id}"]
    path_parts = path.strip("/").split("/")        # ["users", "42"]

    if len(pattern_parts) != len(path_parts):
        return None

    params = {}
    for pattern_part, path_part in zip(pattern_parts, path_parts):
        if pattern_part.startswith("{") and pattern_part.endswith("}"):
            param_name = pattern_part[1:-1]  # "id"
            params[param_name] = path_part    # "42"
        elif pattern_part != path_part:
            return None

    return params
```

**ThreadPoolExecutor 사용**:
```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=100) as executor:
    while self._is_running:
        try:
            client_socket, address = server_socket.accept()
        except socket.timeout:
            continue
        executor.submit(self._handle_connection, client_socket, address)
```

### 3.4 테스트

**서버 시작**:
```bash
python -m src.milestone-1.1.main
```

**테스트 명령**:
```bash
# 기본 요청
curl http://localhost:8080/health
# 응답: {"status": "up"}

# Path parameter
curl http://localhost:8080/users/42
# 응답: {"user_id": "42"}

# POST 요청
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'

# 404 테스트
curl http://localhost:8080/nonexistent
# 응답: 404 Not Found

# 부하 테스트
ab -n 1000 -c 100 http://localhost:8080/health
```

### 3.5 체크리스트

* [ ] 서버가 port 8080에서 시작된다
* [ ] `GET /health` 요청에 JSON 응답이 돌아온다
* [ ] `GET /users/{id}`에서 id가 올바르게 추출된다
* [ ] POST body를 올바르게 파싱한다
* [ ] 100개 이상의 동시 요청을 처리한다
* [ ] 404/500 에러를 올바르게 반환한다

### 3.6 참고 코드

실제 구현: `framework/src/milestone-1.1/`

---

## 4. Milestone 1.2: Mini-Framework (Routing + Middleware + DI)

### 4.1 목표

데코레이터 기반 라우팅, 미들웨어 파이프라인, DI 컨테이너를 구현한다.

### 4.2 필수 구현 항목

1. **App 클래스**
   - `route(path, methods, middleware)`: 데코레이터
   - `use(middleware)`: global middleware 등록
   - `listen(port)`: HTTP 서버 시작
   - `register_instance/factory()`: DI 등록
   - `resolve(name)`: DI 해결

2. **Route 클래스**
   - `matches(method, path)`: 라우트 매칭
   - 속성: `path`, `methods`, `handler`, `middleware`

3. **Request/Response 추상화**
   - `Request.json()`: JSON 파싱
   - `Response.from_result()`: dict/str → Response

4. **DependencyContainer 클래스**
   - `register_instance(name, instance)`
   - `register_factory(name, factory, singleton=True)`
   - `resolve(name)`: 의존성 해결

### 4.3 구현 힌트

**Decorator 구현**:
```python
def route(self, path, *, methods=None, middleware=None):
    methods_tuple = tuple(m.upper() for m in (methods or ("GET",)))
    middleware_seq = tuple(middleware or ())

    def decorator(function):
        route = Route(
            path=path,
            methods=methods_tuple,
            handler=function,
            middleware=middleware_seq
        )
        self._routes.append(route)
        return function  # 원본 함수 반환

    return decorator
```

**Middleware Pipeline 구성**:
```python
def _build_pipeline(self, route):
    # 1. Handler를 시작점으로
    def call_handler(req):
        return route.handler(req, **req.path_params)

    pipeline = call_handler

    # 2. 미들웨어를 역순으로 감싸기
    for middleware in reversed([*self._global_middleware, *route.middleware]):
        next_fn = pipeline

        # Closure로 middleware와 next_fn 캡처
        def make_step(mw, nxt):
            def step(req):
                return mw(req, nxt)
            return step

        pipeline = make_step(middleware, next_fn)

    return pipeline
```

**DI Container**:
```python
class DependencyContainer:
    def __init__(self):
        self._registrations = {}
        self._singletons = {}
        self._lock = threading.RLock()

    def register_instance(self, name, instance):
        with self._lock:
            self._registrations[name] = instance

    def register_factory(self, name, factory, *, singleton=True):
        with self._lock:
            self._registrations[name] = (factory, singleton)

    def resolve(self, name):
        with self._lock:
            entry = self._registrations[name]

            if not isinstance(entry, tuple):
                return entry  # Instance

            factory, singleton = entry

            if singleton and name in self._singletons:
                return self._singletons[name]

            instance = factory(self)

            if singleton:
                self._singletons[name] = instance

            return instance
```

### 4.4 테스트

**사용 예시**:
```python
from framework.app import App

app = App()

# DI 등록
database = InMemoryDatabase()
app.register_instance("database", database)

# Global middleware
def logging_middleware(request, next_fn):
    print(f"{request.method} {request.path}")
    response = next_fn(request)
    print(f"→ {response.status}")
    return response

app.use(logging_middleware)

# Route
@app.route("/users/{id}")
def get_user(request, id):
    db = request.app.resolve("database")
    user = db.get_user(id)
    return {"user": user.to_dict()}

# Start
app.listen(port=8080)
```

**테스트 명령**:
```bash
# Decorator routing
curl http://localhost:8080/users/42

# Middleware logging
# 콘솔에 "GET /users/42" 출력 확인

# DI
curl http://localhost:8080/users
# database에서 데이터 조회 확인
```

### 4.5 체크리스트

* [ ] `@app.route()` 데코레이터로 라우트를 등록한다
* [ ] Global middleware가 모든 요청에 실행된다
* [ ] Route-specific middleware가 해당 라우트에만 실행된다
* [ ] DI container에서 의존성을 resolve한다
* [ ] handler가 dict를 반환하면 자동으로 JSON 응답이 된다

### 4.6 참고 코드

실제 구현: `framework/src/milestone-1.2/`

---

## 5. Milestone 1.3: Connection Pool

### 5.1 목표

Thread-safe 커넥션 풀, leak detection, health checking을 구현한다.

### 5.2 필수 구현 항목

1. **PoolConfig 클래스**
   - 속성: `min_connections`, `max_connections`, `acquisition_timeout`, `leak_detection_threshold`, `connection_factory`

2. **ConnectionPool 클래스**
   - `acquire()`: 커넥션 획득 (blocking with timeout)
   - `release(connection)`: 커넥션 반환
   - `_is_healthy(connection)`: Health check
   - `total_connections()`, `in_use()`, `available()`: 메트릭

3. **PooledConnection 클래스**
   - `__enter__()`, `__exit__()`: Context manager

4. **LeakDetector 클래스**
   - `record_acquisition(connection)`
   - `record_release(connection)`
   - `check_leaks()`: 누수 감지

### 5.3 구현 힌트

**Acquire 로직**:
```python
def acquire(self):
    deadline = time.monotonic() + self._config.acquisition_timeout

    while True:
        # 1. Available queue에서 시도
        try:
            conn = self._available.get_nowait()
        except queue.Empty:
            # 2. 새로 생성 (max 이하일 때)
            with self._lock:
                if self._total_connections < self._config.max_connections:
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
            self._dispose_connection(conn)
            continue

        # 5. In-use로 이동
        with self._lock:
            self._in_use.add(conn)

        self._leak_detector.record_acquisition(conn)
        return PooledConnection(conn, self)
```

**Context Manager**:
```python
class PooledConnection:
    def __init__(self, connection, pool):
        self._connection = connection
        self._pool = pool
        self._released = False

    def __enter__(self):
        return self._connection

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not self._released:
            self._pool.release(self._connection)
            self._released = True
        return False
```

**Leak Detection**:
```python
class LeakDetector:
    def __init__(self, threshold):
        self._threshold = threshold
        self._acquisitions = {}  # conn → timestamp
        self._lock = threading.Lock()

    def record_acquisition(self, conn):
        with self._lock:
            self._acquisitions[conn] = time.monotonic()

    def check_leaks(self):
        now = time.monotonic()
        with self._lock:
            leaks = [
                conn for conn, acquired_at in self._acquisitions.items()
                if now - acquired_at > self._threshold
            ]
        return leaks
```

### 5.4 테스트

**Exhaustion 테스트**:
```python
config = PoolConfig(min_connections=0, max_connections=3, acquisition_timeout=1.0)
pool = ConnectionPool(config)

# 3개 획득 (성공)
conn1 = pool.acquire()
conn2 = pool.acquire()
conn3 = pool.acquire()

# 4번째는 timeout
try:
    conn4 = pool.acquire()
    assert False, "Should timeout"
except PoolExhaustedError:
    print("✓ Timeout works")

# Release 후 다시 획득 가능
pool.release(conn1._connection)
conn4 = pool.acquire()
print("✓ Acquire after release works")
```

**Leak 테스트**:
```python
config = PoolConfig(leak_detection_threshold=2.0)
pool = ConnectionPool(config)

conn = pool.acquire()
time.sleep(2.5)

leaks = pool.leak_detector().check_leaks()
assert len(leaks) == 1
print("✓ Leak detection works")
```

### 5.5 체크리스트

* [ ] Pool이 min_connections를 미리 생성한다
* [ ] Pool exhausted 시 timeout으로 실패한다
* [ ] Unhealthy connection이 자동으로 제거된다
* [ ] Context manager로 자동 release가 된다
* [ ] 여러 thread에서 동시 acquire/release가 안전하다
* [ ] Leak detector가 오래된 커넥션을 감지한다

### 5.6 참고 코드

실제 구현: `framework/src/milestone-1.3/`

---

## 6. Milestone 1.4: Integration (Complete Application)

### 6.1 목표

전체 컴포넌트를 통합하여 완전한 REST API를 만든다.

### 6.2 필수 구현 항목

1. **Application Factory**
   - `create_app()`: DI 구성 + 미들웨어/라우트 등록
   - `create_connection_pool()`: Pool 생성

2. **Controllers**
   - `register(app)`: 모든 라우트 등록
   - `GET /health`, `GET /users`, `GET /users/{id}`, `POST /users`

3. **Middleware**
   - `logging_middleware`: 요청/응답 로깅
   - `auth_middleware`: 인증 체크 (선택)

4. **Database**
   - `InMemoryDatabase`: 간단한 in-memory storage
   - `Connection`: DB connection with `is_valid()`

5. **Main Entry Point**
   - Signal handling (SIGINT, SIGTERM)
   - Graceful shutdown

### 6.3 구현 힌트

**Application Factory**:
```python
def create_app(host="0.0.0.0", port=8080):
    app = App(host=host, port=port)

    # Create dependencies
    database = InMemoryDatabase()
    pool = create_connection_pool(database)

    # Register in DI
    app.register_instance("database", database)
    app.register_instance("connection_pool", pool)

    # Register middleware
    app.use(logging_middleware)

    # Register routes
    register_controllers(app)

    return app
```

**Signal Handling**:
```python
import signal

def graceful_shutdown(app):
    def handler(signum, frame):
        LOGGER.info("Shutting down...")
        app.stop()
    return handler

def main():
    app = create_app(port=8080)

    signal.signal(signal.SIGINT, graceful_shutdown(app))
    signal.signal(signal.SIGTERM, graceful_shutdown(app))

    app.listen()
```

### 6.4 테스트

**전체 시나리오**:
```bash
# 1. 서버 시작
python -m src.milestone-1.4.main

# 2. Health check
curl http://localhost:8080/health
# {"status": "up", "pool": {"total": 2, "in_use": 0, "available": 2}}

# 3. 사용자 목록
curl http://localhost:8080/users
# {"users": [{"id": "1", "name": "Alice", ...}, ...]}

# 4. 사용자 조회
curl http://localhost:8080/users/1
# {"user": {"id": "1", "name": "Alice", ...}}

# 5. 사용자 생성
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Charlie", "email": "charlie@example.com"}'
# {"user_id": "..."}

# 6. Graceful shutdown (Ctrl+C)
# 로그에 "Shutting down..." 출력 확인
```

### 6.5 체크리스트

* [ ] 모든 엔드포인트가 정상 동작한다
* [ ] Connection pool이 올바르게 통합되어 있다
* [ ] Middleware가 모든 요청에 실행된다
* [ ] Ctrl+C로 우아하게 종료된다
* [ ] 100+ 동시 요청을 처리한다

### 6.6 참고 코드

실제 구현: `framework/src/milestone-1.4/`

---

## 7. Milestone 1.4.5: Spring Boot Bridge

### 7.1 목표

Spring Boot로 동일한 앱을 재구현하고 비교한다.

### 7.2 필수 구현 항목

1. **SpringBridgeApplication**
   - `@SpringBootApplication`
   - `main()` 메서드

2. **UserController**
   - `@RestController`
   - `@GetMapping`, `@PostMapping`

3. **UserService**
   - `@Service`
   - 비즈니스 로직

4. **UserRepository**
   - `@Repository`
   - DB 접근

5. **Middleware**
   - `LoggingFilter` (Filter)
   - `AuthInterceptor` (HandlerInterceptor)

6. **application.properties**
   - Server port, thread pool, HikariCP 설정

### 7.3 구현 힌트

**최소 구조**:
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

### 7.4 비교 포인트

**1:1 매핑**:
- `@app.route()` ↔ `@GetMapping`
- `app.use(middleware)` ↔ `Filter`
- `app.resolve()` ↔ `@Autowired`
- `ConnectionPool` ↔ HikariCP

**성능 비교**:
```bash
# mini-spring
ab -n 10000 -c 100 http://localhost:8080/health
# Requests per second: ~1,800

# Spring Boot
ab -n 10000 -c 100 http://localhost:8080/health
# Requests per second: ~18,000
```

**코드량 비교**:
- mini-spring: ~950 LOC
- Spring Boot: ~150 LOC (75% 감소)

### 7.5 체크리스트

* [ ] Spring Boot 앱이 동일한 API를 제공한다
* [ ] 매핑 테이블을 작성했다
* [ ] 성능 벤치마크를 수행했다
* [ ] 코드량 감소를 계산했다
* [ ] Auto-configuration이 무엇을 대신하는지 이해했다

### 7.6 참고 코드

실제 구현: `framework/src/milestone-1.4.5/`
매핑 테이블: `framework/src/milestone-1.4.5/MAPPING.md`

---

## 8. 전체 학습 경로

**권장 순서**:

1. **문서 1 (overview)**: 전체 지도 파악
2. **문서 2 (Python basics)**: Python 문법 학습
3. **문서 3 (web concepts)**: 웹 프레임워크 개념 학습
4. **문서 4 (이 문서)**: 실제 구현

**실습 순서**:

1. **Milestone 1.1**: HTTP 서버 만들기 (1주)
   - 목표: "HTTP는 텍스트다" 체감
   - 난이도: ⭐⭐☆☆☆

2. **Milestone 1.2**: 프레임워크 만들기 (2주)
   - 목표: 라우팅/미들웨어/DI 이해
   - 난이도: ⭐⭐⭐⭐☆

3. **Milestone 1.3**: 커넥션 풀 만들기 (2주)
   - 목표: 동시성/리소스 관리 이해
   - 난이도: ⭐⭐⭐⭐⭐

4. **Milestone 1.4**: 통합하기 (1주)
   - 목표: 완전한 앱 완성
   - 난이도: ⭐⭐⭐☆☆

5. **Milestone 1.4.5**: Spring Boot 비교 (3일)
   - 목표: 프레임워크의 가치 이해
   - 난이도: ⭐⭐☆☆☆

**총 소요 시간**: 약 6주

---

## 9. 막힐 때 참고할 자료

### 9.1 공식 문서

* Python: https://docs.python.org/3/
* Python socket: https://docs.python.org/3/library/socket.html
* Python threading: https://docs.python.org/3/library/threading.html
* Spring Boot: https://spring.io/projects/spring-boot

### 9.2 프로젝트 내 자료

* Design 문서: `framework/design/`
  - 각 Milestone의 상세 설계 문서
  - 왜 이렇게 만들었는지 설명

* 실제 구현: `framework/src/`
  - 각 Milestone의 완성된 코드
  - 주석으로 설명 포함

* Evidence: `framework/docs/evidence/`
  - 각 Milestone의 검증 결과
  - 성능 측정, 테스트 결과

### 9.3 디버깅 팁

**서버가 시작 안 됨**:
```bash
# 포트가 이미 사용 중인지 확인
lsof -i :8080

# 프로세스 종료
kill -9 <PID>
```

**요청이 안 됨**:
```bash
# 서버 로그 확인
# HTTP 파싱 에러가 있는지 확인

# curl verbose 모드
curl -v http://localhost:8080/health
```

**Thread 문제**:
```python
# 디버깅 로그 추가
import logging
logging.basicConfig(level=logging.DEBUG)

# Thread 정보 출력
import threading
print(f"Active threads: {threading.active_count()}")
```

---

## 10. 최종 체크리스트: 전체 학습 완료

다음 항목에 "예"라고 말할 수 있으면 mini-spring 프로젝트를 완수한 것이다.

* [ ] Milestone 1.1: HTTP 서버를 raw socket으로 만들었다
* [ ] Milestone 1.2: 데코레이터 기반 프레임워크를 만들었다
* [ ] Milestone 1.3: Thread-safe 커넥션 풀을 만들었다
* [ ] Milestone 1.4: 완전한 REST API를 만들었다
* [ ] Milestone 1.4.5: Spring Boot로 재구현하고 비교했다
* [ ] HTTP 프로토콜을 설명할 수 있다
* [ ] 라우팅/미들웨어/DI를 설명할 수 있다
* [ ] 커넥션 풀링의 필요성을 설명할 수 있다
* [ ] mini-spring과 Spring Boot의 차이를 설명할 수 있다
* [ ] 프레임워크 내부를 이해하고 디버깅할 수 있다

---

**축하합니다! mini-spring 프로젝트를 완료했습니다. 이제 Spring Boot/Django/FastAPI를 쓰되, 내부를 완전히 이해하는 개발자가 되었습니다.**
