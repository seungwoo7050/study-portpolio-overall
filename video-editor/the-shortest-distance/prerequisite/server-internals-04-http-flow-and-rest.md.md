# 🔥 서버 동작 이해 4편 – HTTP 처리 흐름 & REST 구조

마지막 편은 **실제 서버가 HTTP 요청을 어떻게 처리하는지**를 흐름 단위로 정리한다.
TCP 소켓까지 이해했으면 이제 전체 그림이 하나로 연결된다.

여기서는 **실제 서버 루프 수준에서 어떤 일이 일어나는지**를 그대로 설명한다.
추상화 없이, 필요한 만큼만 정확히 간다.

---

# 1. HTTP 요청 처리 흐름 전체 그림

HTTP 요청 하나 처리 흐름은 딱 이 순서다:

```
accept  →  read  →  HTTP 파싱  →  라우팅  →  비즈니스 처리  
        →  write →  keep-alive 유지 or 연결 종료
```

각 단계에서 실제로 어떤 일이 일어나는지 내부적으로 살펴본다.

---

# 2. accept – 새 TCP 연결 수락

이 단계는 단순함.

1. 클라이언트가 handshake 완료
2. 커널이 backlog에서 준비된 연결을 꺼냄
3. `accept()`가 새로운 FD를 반환

이 FD가 “이 클라이언트와의 HTTP 세션”을 담당한다.

---

# 3. read – 요청 데이터 읽기 (recv buffer)

HTTP 요청은 텍스트 기반 프로토콜이다.

클라이언트가 보낸 요청 패킷은:

1. TCP 계층 → 커널 recv buffer 저장
2. 서버가 `read(fd)`로 그 recv buffer에서 읽는다

### 읽을 때 고려할 점

* 요청이 한 번에 다 올 수도 있고
* 여러 패킷으로 나뉘어 도착할 수도 있다
* `read()`는 recv buffer가 가진 만큼만 준다
* 부족하면 다음 이벤트(EPOLLIN)에서 이어 읽어야 한다

즉:

```
HTTP 요청 파싱 = 스트림(stream) 파싱
```

정해진 경계가 없고, “읽히는 만큼” 처리해야 한다.

---

# 4. HTTP 파싱

읽은 텍스트를 아래 단계로 파싱한다:

## 4-1) Request Line 파싱

예:

```
GET /users/1 HTTP/1.1
```

여기서 세 가지를 추출한다:

* 메서드 (GET, POST, PUT…)
* URL (패스)
* 프로토콜 버전

## 4-2) 헤더 파싱

```
Host: example.com
Content-Length: 27
Connection: keep-alive
```

각 라인을 Key:Value로 저장.

**HTTP/1.1에서는 기본 keep-alive**,
따라서 커넥션을 자동으로 유지하는 동작이 기본이다.

## 4-3) 바디 파싱

POST/PUT 등에서 아래 조건이면 바디를 읽어야 한다:

* Content-Length가 있다
* chunked 인코딩이면 chunk 단위로 반복 파싱

---

# 5. 라우팅

파싱 결과를 기반으로 라우팅 테이블에서 핸들러 선택.

예:

```
GET /users → user_list_handler
GET /users/1 → user_detail_handler
POST /users → user_create_handler
```

핵심은 **“메서드 + URL 패턴”** 조합을 키로 사용한다는 것.

---

# 6. 비즈니스 처리

라우터가 선택한 핸들러 코드를 그대로 실행한다.

* DB 조회
* 캐시 접근
* 로직 실행
* Validation
* JSON 직렬화

스레드/프로세스/I/O 모델에 따라 작업 분배 방식은 달라질 수 있으나
핵심 개념은 동일하다.

---

# 7. write – 응답 쓰기 (send buffer)

응답은 문자열 조합으로 이루어진다.

예:

```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 19

{"result":"ok"}
```

`write()`는 네트워크로 바로 보내는 게 아니라:

→ **커널 send buffer에 저장**

send buffer가 꽉 차 있으면:

* 블로킹 소켓 → write가 멈춤
* 논블로킹 소켓 → EAGAIN

대규모 서버에서 반드시 고려해야 하는 포인트다.

---

# 8. keep-alive 처리

HTTP/1.1 기본 동작은 다음과 같다:

* `Connection: keep-alive` 헤더가 기본
* 한 번의 TCP 연결로 여러 요청/응답 처리 가능
* 요청과 응답이 끝나도 FD는 유지된다

동작 흐름은 아래와 같다:

```
응답 write 완료 → FD 유지  
→ 다음 HTTP 요청이 같은 FD에서 read로 들어옴 → 재사용
```

이 덕분에:

* handshake 비용 감소
* 네트워크 지연 줄어듦
* 성능 대폭 향상

하지만 특정 시간 동안 요청이 안 오면 서버는 타임아웃으로 FD를 닫는다.

---

# 9. 전체 요청 흐름 실제 형태로 정리

epoll 기반 서버 기준으로 실제 동작은 이렇게 된다:

```
1) epoll_wait로 이벤트 감시
2) 새 연결 → accept → epoll에 FD 등록
3) 기존 FD에서 EPOLLIN 발생 → read
4) 버퍼에 쌓이는 대로 HTTP 파싱
5) 요청 완성 → 라우팅 → 핸들러 실행
6) 응답 준비 → write
7) keep-alive면 FD 유지 → 다시 epoll_wait
8) 타임아웃 또는 Connection: close → close(fd)
```

이게 현대 웹 서버 구조의 기본 형태다.

---

# 10. REST 정리 (실용 관점)

REST는 간단히 말하면:

> URL = 리소스
> HTTP 메서드 = 행동

핵심 CRUD 매핑:

| 메서드    | 의미      |
| ------ | ------- |
| GET    | 조회      |
| POST   | 생성      |
| PUT    | 전체 업데이트 |
| DELETE | 삭제      |

예시:

```
GET /users        → 사용자 목록 조회
GET /users/10     → 특정 사용자 조회
POST /users       → 새 사용자 생성
PUT /users/10     → 사용자 전체 수정
DELETE /users/10  → 삭제
```

중요한 점:

* REST는 설계 규칙일 뿐, 강제 표준 아님
* 서버 내부 구조와는 직접 상관없지만
* URL/메서드를 기반으로 라우팅 테이블 구성하는 데 쓰임
* 대부분의 웹 프레임워크가 이 방식으로 라우팅을 제공

---

# 11. 전체 요약

HTTP 요청 처리는 이렇게 끝난다:

1. accept → 새 소켓 FD 생성
2. read → recv buffer에서 요청 읽기
3. HTTP 파싱 → 라우팅
4. 비즈니스 로직 처리
5. write → send buffer에 응답 저장
6. keep-alive → FD 유지
7. 새로운 요청 반복

TCP, 커널 버퍼, epoll 개념이 이미 잡혀 있으면
HTTP는 단순한 문자열 파싱 + 라우팅 작업일 뿐이다.

---

필요하면 이 4편 내용을 “실제 코드 흐름 예시(C/Python/Node.js)”로 재구성한 버전도 만들어 줄 수 있다.


Node.js 기반으로 **HTTP 요청 전체 처리 흐름이 실제 코드에서 어떻게 구현되는지**를 그대로 보여준다.
불필요한 포장 없이 핵심 구조만 작성한다.

---

# 1. Node.js 서버 기본 구조 (가장 단순한 형태)

```js
const http = require('http');

const server = http.createServer((req, res) => {
  // 요청 들어오면 이 콜백이 실행됨 (라우팅 + 처리)
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});

server.listen(3000);
```

이 코드 한 줄 한 줄이 내부적으로는 4편에서 설명한 흐름 그대로 동작한다.

---

# 2. Node.js 내부 동작을 실제 단계로 보면

아래처럼 매핑된다:

```
1) accept → 내부적으로 libuv + 커널이 처리
2) read → 요청 데이터가 들어오면 req 객체로 전달
3) HTTP 파싱 → Node.js C++ 레이어에서 파싱 후 JS로 넘김
4) 라우팅 → createServer 콜백에서 분기
5) 비즈니스 로직 실행
6) write → res.write, res.end
7) keep-alive → Node.js가 자동 처리
```

Node.js가 이벤트 루프 기반이기 때문에
“JS 코드에서는 read/write를 직접 호출하지 않는다.”
커널 이벤트(epoll) → libuv → Node.js → JS 콜백
이 흐름으로 들어오는 것뿐이다.

---

# 3. 요청 읽기(read) – 실전 예시

Node.js에서 body를 직접 읽는 코드는 스트림 기반으로 이루어진다:

```js
const http = require('http');

http.createServer((req, res) => {
  let body = '';

  req.on('data', chunk => {
    body += chunk;               // recv buffer → chunk by chunk
  });

  req.on('end', () => {
    console.log('body:', body);
    res.end('done');
  });
}).listen(3000);
```

여기서 중요한 점:

* `req.on('data')`는 **EPOLLIN 이벤트 기반 콜백**
* TCP 패킷이 여러 번 나눠 도착해도 chunk로 계속 들어옴
* 완전히 읽히면 `end` 이벤트 발생 → 바디 완성

이게 “HTTP 파싱 + 바디 파싱” 단계이다.

---

# 4. 라우팅 – 실제 서버 구조

아주 단순한 라우팅 예:

```js
const http = require('http');

http.createServer((req, res) => {
  const { method, url } = req;

  if (method === 'GET' && url === '/ping') {
    res.end('pong');
    return;
  }

  if (method === 'POST' && url === '/users') {
    // body 읽기 후 처리
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      // 생성 로직
      res.end('created');
    });
    return;
  }

  res.statusCode = 404;
  res.end('not found');
}).listen(3000);
```

Node.js는 프레임워크 없이도 라우팅을 직접 구현할 수 있다.
프레임워크(Express, Fastify)는 이 과정을 자동화해주는 것뿐이다.

---

# 5. 응답(write) – send buffer에 쓰는 동작

Node.js에서 응답은 다음 API로 작성된다:

```js
res.writeHead(200, { 'Content-Type': 'application/json' });
res.write(JSON.stringify({ ok: true }));
res.end();
```

내부적으로는 아래와 동일하다:

```
write() = 커널 send buffer에 데이터 복사
end()   = 마지막 chunk 전송
```

send buffer가 꽉 차면
Node.js는 libuv 레벨에서 **백프레셔(backpressure)** 로 처리한다.

예: 스트림 대량 전송 시 drain 이벤트 기다림.

---

# 6. keep-alive – Node.js 기본 지원

HTTP/1.1 기본 keep-alive 유지.

직접 컨트롤하려면 이렇게 설정한다:

```js
server.keepAliveTimeout = 5000; // 5초 동안 요청 없으면 close
```

동작 흐름:

1. 첫 요청 끝나도 소켓 FD는 닫지 않음
2. 같은 FD로 다음 요청 다시 read
3. 일정 시간동안 요청 없으면 서버가 close()

4편에서 설명한 keep-alive 원리가 그대로 Node.js에도 동일하게 적용된다.

---

# 7. 실제 Node.js 서버 흐름을 한 줄로 요약하면

```
(epoll) → libuv → HTTP 파서 → createServer 콜백 → write() → keep-alive
```

JS 코드에서 우리가 구현하는 건
**“파서가 넘겨주는 이벤트 기반 콜백 처리 + 비즈니스 로직"** 이 전부다.

나머지
(epoll, 소켓, recv buffer, send buffer, backlog, handshake)
전부 Node.js C++ 레이어 + libuv + 커널이 처리한다.

---

# 8. 고성능 Node.js 서버에서 추가로 고려할 점

필요한 것만 정리한다.

### 1) CPU 작업 offload

Node.js는 단일 스레드라 CPU-heavy 작업은 이벤트 루프를 막는다.

* worker_threads
* child_process
* cluster 모드

이런 기능을 이용해 분산하는 구조가 필요하다.

### 2) 대용량 파일 전송

스트리밍 사용:

```js
fs.createReadStream('./bigfile').pipe(res);
```

파편 없이 send buffer + backpressure 자동 처리됨.

### 3) 로깅 / DB I/O는 반드시 async

동기 파일 I/O는 이벤트 루프 막는다 → 금지.

---

# 9. Node.js 전체 흐름 요약(진짜 핵심 3줄)

```
1) 요청이 오면 libuv가 이벤트 루프로 감지하고 JS 콜백을 실행한다.
2) req/res는 스트림이며 read/write는 커널 버퍼와 직접 연결된다.
3) keep-alive 기반으로 FD 재사용하며 요청을 반복 처리한다.
```

이걸 이해하면 Node.js 내부 동작은 완전히 명확해진다.

---

원하면 이걸 **Express, Fastify, NestJS** 버전으로도 구조를 확장해서 만들어 줄 수 있다.
