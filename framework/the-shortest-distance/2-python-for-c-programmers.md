# 문서 2. C 개발자를 위한 Python 기본기

## 1. 이 문서의 목적

**대상**: C/C++로 개발해본 사람
**목표**: mini-spring 프레임워크 코드를 읽고 수정할 수 있을 정도의 Python 지식

이 문서는 "Python 완전 정복"이 아니다. **mini-spring 프로젝트에 필요한 최소한의 Python**만 다룬다.

* Python 설치/환경 설정은 생략 (Python 3.11+ 설치되었다고 가정)
* 문법만 나열하지 않고, **C와 비교하면서** 설명
* 실제 mini-spring 코드 예시를 함께 제시

---

## 2. Python vs C: 근본적인 차이점

### 2.1 동적 타입 vs 정적 타입

**C**:
```c
int x = 5;          // 타입 명시 필수
x = "hello";        // 컴파일 에러!
```

**Python**:
```python
x = 5               # 타입 추론, int로 자동 결정
x = "hello"         # 같은 변수에 다른 타입 대입 가능 (동적 타입)
```

**Type Hints** (Python 3.5+):
```python
def add(a: int, b: int) -> int:  # 타입 힌트 (런타임에는 무시됨)
    return a + b

x: int = 5  # 변수 타입 힌트
```

**중요**: Type hints는 **문서화/IDE 지원**용이지, 강제가 아니다. `mypy` 같은 도구로 검사는 가능.

### 2.2 메모리 관리: 수동 vs 자동

**C**:
```c
char* str = (char*)malloc(100);
strcpy(str, "hello");
free(str);  // 수동 해제 필수!
```

**Python**:
```python
str = "hello"  # 자동 할당
# 사용 끝나면 garbage collector가 자동 해제
```

**중요**: Python은 **참조 카운팅 + GC**로 메모리를 자동 관리한다. `malloc`/`free` 불필요.

### 2.3 문자열: null-terminated vs 객체

**C**:
```c
char str[] = "hello";  // null-terminated array
str[0] = 'H';          // mutable
```

**Python**:
```python
str = "hello"  # immutable 객체
str[0] = 'H'   # 에러! 문자열은 immutable
str = "Hello"  # 새 객체 생성해서 재대입은 가능
```

**문자열 조작**:
```python
# C의 strcat, strcpy 같은 것들
s1 = "hello"
s2 = "world"
s3 = s1 + " " + s2  # "hello world" (새 객체)

# 문자열 메서드
s = "  hello  "
s.strip()    # "hello" (공백 제거)
s.upper()    # "  HELLO  "
s.split()    # ["hello"]

# 포맷팅
name = "Alice"
age = 30
msg = f"My name is {name}, age {age}"  # f-string (Python 3.6+)
```

---

## 3. Python 기본 문법 (C와 비교)

### 3.1 변수와 타입

**기본 타입**:
```python
# 정수
x = 5
y = 0xFF  # 16진수

# 실수
pi = 3.14

# 불린
is_valid = True  # C의 true/false와 다르게 대문자!
is_empty = False

# None (C의 NULL)
ptr = None

# 문자열
name = "Alice"
```

**타입 확인**:
```python
type(5)         # <class 'int'>
isinstance(5, int)  # True
```

### 3.2 컬렉션 (배열/맵)

**리스트** (C의 동적 배열):
```c
// C
int arr[5] = {1, 2, 3, 4, 5};  // 고정 크기
```

```python
# Python
arr = [1, 2, 3, 4, 5]  # 동적 크기
arr.append(6)          # [1, 2, 3, 4, 5, 6]
arr.pop()              # [1, 2, 3, 4, 5]
arr[0]                 # 1
arr[-1]                # 5 (마지막 원소)
arr[1:3]               # [2, 3] (슬라이싱)
len(arr)               # 5
```

**딕셔너리** (C++의 `std::map`):
```cpp
// C++
std::map<std::string, int> ages;
ages["Alice"] = 30;
```

```python
# Python
ages = {"Alice": 30, "Bob": 25}  # key: value
ages["Alice"]      # 30
ages["Charlie"] = 35
"Alice" in ages    # True
ages.get("Dave")   # None (키 없으면)
ages.get("Dave", 0)  # 0 (기본값)
```

**튜플** (immutable 리스트):
```python
point = (10, 20)  # tuple
point[0]          # 10
point[0] = 5      # 에러! immutable
```

**세트**:
```python
nums = {1, 2, 3}  # set (중복 없음)
nums.add(4)
nums.remove(2)
```

### 3.3 제어 구조

**if 문**:
```c
// C
if (x > 0) {
    printf("positive\n");
} else if (x < 0) {
    printf("negative\n");
} else {
    printf("zero\n");
}
```

```python
# Python (들여쓰기로 블록 구분!)
if x > 0:
    print("positive")
elif x < 0:
    print("negative")
else:
    print("zero")
```

**for 루프**:
```c
// C
for (int i = 0; i < 10; i++) {
    printf("%d\n", i);
}
```

```python
# Python
for i in range(10):  # 0~9
    print(i)

# 리스트 순회
for item in [1, 2, 3]:
    print(item)

# 딕셔너리 순회
for key, value in ages.items():
    print(f"{key}: {value}")
```

**while 루프**:
```python
i = 0
while i < 10:
    print(i)
    i += 1
```

### 3.4 함수

**기본 함수**:
```c
// C
int add(int a, int b) {
    return a + b;
}
```

```python
# Python
def add(a, b):
    return a + b

def add_typed(a: int, b: int) -> int:  # 타입 힌트
    return a + b
```

**기본 인자**:
```python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

greet("Alice")                 # "Hello, Alice!"
greet("Bob", "Hi")             # "Hi, Bob!"
greet("Charlie", greeting="Hey")  # "Hey, Charlie!" (키워드 인자)
```

**가변 인자**:
```python
def sum_all(*args):  # *args: 튜플로 받음
    return sum(args)

sum_all(1, 2, 3, 4)  # 10

def print_info(**kwargs):  # **kwargs: 딕셔너리로 받음
    for key, value in kwargs.items():
        print(f"{key}: {value}")

print_info(name="Alice", age=30)
# name: Alice
# age: 30
```

**람다 함수** (C++의 lambda):
```cpp
// C++
auto add = [](int a, int b) { return a + b; };
```

```python
# Python
add = lambda a, b: a + b
add(3, 5)  # 8

# 주로 sort의 key 함수로 사용
users = [("Alice", 30), ("Bob", 25)]
users.sort(key=lambda user: user[1])  # 나이순 정렬
```

### 3.5 클래스

**기본 클래스**:
```cpp
// C++
class Person {
private:
    std::string name;
    int age;

public:
    Person(std::string n, int a) : name(n), age(a) {}

    void greet() {
        std::cout << "Hello, " << name << std::endl;
    }
};
```

```python
# Python
class Person:
    def __init__(self, name, age):  # 생성자
        self.name = name  # 인스턴스 변수
        self.age = age

    def greet(self):  # 메서드 (첫 인자는 항상 self)
        print(f"Hello, {self.name}")

p = Person("Alice", 30)
p.greet()  # "Hello, Alice"
```

**프로퍼티** (getter/setter):
```python
class Rectangle:
    def __init__(self, width, height):
        self._width = width
        self._height = height

    @property
    def area(self):  # getter
        return self._width * self._height

    @area.setter
    def area(self, value):  # setter
        # area를 설정하면 width를 조정 (예시)
        self._width = value / self._height

rect = Rectangle(10, 5)
rect.area  # 50 (괄호 없이 호출)
rect.area = 100  # setter 호출
```

**dataclass** (Python 3.7+, C++의 struct처럼):
```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int
    email: str = ""  # 기본값

user = User(name="Alice", age=30)
user.name  # "Alice"
```

---

## 4. Python 모듈 시스템

### 4.1 import 기본

**C의 `#include`**:
```c
#include <stdio.h>
#include "my_header.h"
```

**Python의 `import`**:
```python
import socket  # 표준 라이브러리
import json

from socket import socket as Socket  # 특정 항목만
from dataclasses import dataclass

# 상대 import (같은 패키지 내)
from .http_parser import HttpRequest
from ..utils import logger
```

### 4.2 모듈 구조

```
project/
├── main.py
├── http_server.py
└── utils/
    ├── __init__.py  # utils를 패키지로 만듦
    └── logger.py
```

**http_server.py**:
```python
class HttpServer:
    def __init__(self, port):
        self.port = port

    def start(self):
        print(f"Server started on port {self.port}")
```

**main.py**:
```python
from http_server import HttpServer

server = HttpServer(8080)
server.start()
```

**utils/logger.py**:
```python
import logging

LOGGER = logging.getLogger(__name__)

def log_info(message):
    LOGGER.info(message)
```

**main.py에서 사용**:
```python
from utils.logger import log_info

log_info("Server starting...")
```

### 4.3 `if __name__ == "__main__"`

```python
# my_module.py
def add(a, b):
    return a + b

if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 실행
    print(add(3, 5))

# 다른 파일에서 import하면 if 블록은 실행 안 됨
```

---

## 5. 예외 처리

**C의 errno**:
```c
// C
int fd = open("file.txt", O_RDONLY);
if (fd == -1) {
    perror("open failed");
    return -1;
}
```

**Python의 예외**:
```python
# Python
try:
    file = open("file.txt", "r")
    content = file.read()
except FileNotFoundError:
    print("File not found")
except PermissionError:
    print("Permission denied")
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    file.close()  # 항상 실행 (C++의 destructor처럼)
```

**with 문** (RAII pattern):
```python
# with 사용 (권장)
with open("file.txt", "r") as file:
    content = file.read()
# 자동으로 file.close() 호출
```

**예외 발생**:
```python
def divide(a, b):
    if b == 0:
        raise ValueError("Division by zero")
    return a / b

try:
    result = divide(10, 0)
except ValueError as e:
    print(e)  # "Division by zero"
```

---

## 6. 비동기 프로그래밍 기초

### 6.1 동기 vs 비동기

**동기** (blocking):
```python
import time

def task1():
    print("Task 1 start")
    time.sleep(2)  # 2초 대기 (blocking)
    print("Task 1 done")

def task2():
    print("Task 2 start")
    time.sleep(1)
    print("Task 2 done")

task1()
task2()
# 총 3초 소요
```

**비동기** (non-blocking):
```python
import asyncio

async def task1():
    print("Task 1 start")
    await asyncio.sleep(2)  # 다른 task에게 제어권 양보
    print("Task 1 done")

async def task2():
    print("Task 2 start")
    await asyncio.sleep(1)
    print("Task 2 done")

async def main():
    await asyncio.gather(task1(), task2())  # 병렬 실행

asyncio.run(main())
# 총 2초 소요 (동시 실행)
```

### 6.2 async/await 기본

```python
async def fetch_data():
    await asyncio.sleep(1)  # 비동기 대기
    return "data"

async def main():
    result = await fetch_data()  # await 필수!
    print(result)

asyncio.run(main())
```

**중요**: mini-spring 프로젝트는 **threading 기반**이므로 async/await는 사용하지 않는다. 참고만 하면 됨.

---

## 7. 스레딩 (C의 pthread)

**C의 pthread**:
```c
pthread_t thread;
pthread_create(&thread, NULL, worker, arg);
pthread_join(thread, NULL);
```

**Python의 threading**:
```python
import threading

def worker(name):
    print(f"Worker {name} started")
    time.sleep(1)
    print(f"Worker {name} done")

thread = threading.Thread(target=worker, args=("A",))
thread.start()
thread.join()  # 종료 대기
```

**ThreadPoolExecutor** (mini-spring에서 사용):
```python
from concurrent.futures import ThreadPoolExecutor

def process(item):
    print(f"Processing {item}")
    return item * 2

with ThreadPoolExecutor(max_workers=10) as executor:
    results = executor.map(process, [1, 2, 3, 4, 5])
    print(list(results))  # [2, 4, 6, 8, 10]

# or submit 방식
with ThreadPoolExecutor(max_workers=10) as executor:
    future = executor.submit(process, 5)
    result = future.result()  # blocking until done
    print(result)  # 10
```

**Lock** (C의 mutex):
```c
// C
pthread_mutex_t lock;
pthread_mutex_lock(&lock);
// critical section
pthread_mutex_unlock(&lock);
```

```python
# Python
import threading

lock = threading.Lock()

with lock:  # 자동 acquire/release
    # critical section
    pass

# or manual
lock.acquire()
try:
    # critical section
finally:
    lock.release()
```

**Queue** (thread-safe):
```python
import queue

q = queue.Queue()  # thread-safe FIFO
q.put(item)
item = q.get()  # blocking until available
item = q.get_nowait()  # non-blocking (raises queue.Empty)
item = q.get(timeout=5)  # timeout
```

---

## 8. mini-spring에서 실제 사용되는 Python 패턴

### 8.1 Decorator Pattern

**mini-spring의 @app.route()**:
```python
def route(path):
    def decorator(function):
        # 라우트 등록
        routes.append((path, function))
        return function  # 원본 함수 반환
    return decorator

@route("/users/{id}")  # route("/users/{id}")(get_user)와 동일
def get_user(request, id):
    return {"user_id": id}
```

**여러 데코레이터 쌓기**:
```python
@app.route("/admin")
@app.middleware(auth_required)
def admin_panel(request):
    return {"message": "Admin"}

# 실행 순서:
# admin_panel = app.route("/admin")(app.middleware(auth_required)(admin_panel))
```

### 8.2 Context Manager (__enter__/__exit__)

**mini-spring의 PooledConnection**:
```python
class PooledConnection:
    def __init__(self, connection, pool):
        self._connection = connection
        self._pool = pool

    def __enter__(self):
        return self._connection

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._pool.release(self._connection)
        return False  # 예외 전파

# 사용
with pool.acquire() as conn:
    conn.query("SELECT ...")
# 자동으로 __exit__ 호출되어 release
```

### 8.3 Dataclass + Field

**mini-spring의 Route**:
```python
from dataclasses import dataclass, field
from typing import Dict

@dataclass
class Route:
    path: str
    methods: tuple[str, ...]
    handler: callable
    middleware: list = field(default_factory=list)  # 기본값으로 빈 리스트

route = Route(path="/users", methods=("GET",), handler=get_user)
```

### 8.4 Type Hints

**mini-spring의 타입 힌트**:
```python
from typing import Optional, Dict, List, Callable, Any

def resolve(self, name: str) -> Any:
    """Resolve dependency by name."""
    if name not in self._registrations:
        raise KeyError(f"Dependency not registered: {name}")
    return self._registrations[name]

def match_route(
    self,
    method: str,
    path: str
) -> tuple[Optional[Route], Dict[str, str]]:
    """Find matching route and extract path parameters."""
    for route in self._routes:
        params = route.matches(method, path)
        if params is not None:
            return route, params
    return None, {}
```

### 8.5 Property

**mini-spring의 Request**:
```python
class Request:
    def __init__(self, raw, app):
        self.raw = raw
        self.app = app

    @property
    def method(self) -> str:
        return self.raw.method

    @property
    def path(self) -> str:
        return self.raw.path

# 사용 (괄호 없이)
request.method  # "GET"
request.path    # "/users/42"
```

---

## 9. 실전 코드 읽기 연습

**mini-spring의 HttpServer.start() 일부**:
```python
def start(self) -> None:
    self._is_running = True

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind((self.host, self.port))
        server_socket.listen()
        server_socket.settimeout(1.0)

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            while self._is_running:
                try:
                    client_socket, address = server_socket.accept()
                except socket.timeout:
                    continue
                except OSError:
                    break
                executor.submit(self._handle_connection, client_socket, address)
```

**해석**:
1. `with socket.socket(...)`: Context manager로 소켓 자동 close
2. `setsockopt(SO_REUSEADDR, 1)`: C의 setsockopt와 동일
3. `bind((host, port))`: tuple로 주소 전달
4. `settimeout(1.0)`: 1초 timeout (accept()가 1초마다 깨어남)
5. `with ThreadPoolExecutor(...)`: Thread pool 자동 shutdown
6. `executor.submit(...)`: Thread pool에 작업 제출 (C++의 std::async와 유사)

**C와 비교**:
```c
// C 버전
int server_fd = socket(AF_INET, SOCK_STREAM, 0);
int reuse = 1;
setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

struct sockaddr_in addr;
addr.sin_family = AF_INET;
addr.sin_port = htons(port);
addr.sin_addr.s_addr = INADDR_ANY;

bind(server_fd, (struct sockaddr*)&addr, sizeof(addr));
listen(server_fd, backlog);

while (running) {
    int client_fd = accept(server_fd, NULL, NULL);
    // thread 생성 또는 epoll
}

close(server_fd);
```

---

## 10. 자주 쓰는 표준 라이브러리

### 10.1 socket (네트워크)

```python
import socket

# TCP 서버
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind(('0.0.0.0', 8080))
server.listen()
client, addr = server.accept()

# TCP 클라이언트
client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
client.connect(('localhost', 8080))
client.sendall(b"Hello")
data = client.recv(1024)
```

### 10.2 json (JSON 파싱)

```python
import json

# 파싱
data = json.loads('{"name": "Alice", "age": 30}')
data["name"]  # "Alice"

# 직렬화
json_str = json.dumps({"user_id": 42})  # '{"user_id": 42}'
```

### 10.3 logging

```python
import logging

# 기본 설정
logging.basicConfig(level=logging.INFO)

LOGGER = logging.getLogger(__name__)

LOGGER.info("Server started")
LOGGER.warning("Connection timeout")
LOGGER.error("Failed to connect")
```

### 10.4 time

```python
import time

time.sleep(1)  # 1초 대기
start = time.time()
# ...
elapsed = time.time() - start

# 고정밀 시간 (monotonic)
start = time.monotonic()
```

### 10.5 pathlib (파일 경로)

```python
from pathlib import Path

path = Path("/home/user/file.txt")
path.exists()  # True/False
path.is_file()
path.parent  # Path("/home/user")
path.name    # "file.txt"
```

---

## 11. 체크리스트: Python 기초 학습 완료

다음 항목에 "예"라고 말할 수 있으면 이 문서를 통과한 것으로 본다.

* [ ] Python의 동적 타입 시스템을 이해하고, type hints를 작성할 수 있다.
* [ ] list, dict, tuple, set의 차이를 이해하고 적절히 사용할 수 있다.
* [ ] 함수를 정의하고, 기본 인자/가변 인자를 사용할 수 있다.
* [ ] 클래스를 만들고, `__init__`, property, dataclass를 사용할 수 있다.
* [ ] `import`로 모듈을 불러오고, 상대/절대 import를 구분할 수 있다.
* [ ] `try`/`except`/`finally`로 예외를 처리할 수 있다.
* [ ] `with` 문으로 리소스를 안전하게 관리할 수 있다.
* [ ] `threading.Thread`와 `ThreadPoolExecutor`로 멀티스레딩을 할 수 있다.
* [ ] `threading.Lock`, `queue.Queue`로 thread-safe 코드를 작성할 수 있다.
* [ ] mini-spring 코드를 읽고 대략적인 흐름을 이해할 수 있다.

---

**다음 단계**: 문서 3 (웹 프레임워크 핵심 개념)으로 넘어가서 HTTP, 라우팅, 미들웨어 등의 개념을 이해하자.
