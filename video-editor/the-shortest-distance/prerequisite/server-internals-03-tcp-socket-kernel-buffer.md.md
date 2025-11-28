# 🔥 서버 동작 이해 3편 – TCP / 소켓 내부 구조

이번 편은 서버 코드에서 가장 오해가 많은 부분을 정리한다.
**TCP 연결이 실제로 어떻게 만들어지고**,
**read/write가 정확히 어디를 읽고 쓰는지**,
**블로킹/논블로킹 동작이 왜 커널 버퍼 상태에 따라 달라지는지**
이걸 명확히 이해하면 네트워크 서버 구조가 완전히 선명해진다.

군더더기 없이 필요한 것만 정리한다.

---

# 1. TCP 연결 과정 – 3-way handshake

TCP 연결은 소켓을 생성한다고 바로 생기지 않는다.
핵심은 서버와 클라이언트가 합의해서 **연결 상태**를 만들고,
커널 내부에 **소켓 객체(File Descriptor)**가 생성된다는 점이다.

흐름은 아래처럼 단순하다:

```
클라이언트 → SYN
서버      → SYN + ACK
클라이언트 → ACK
```

이걸 3-way handshake라고 한다.

핵심 포인트만 보면 된다:

* 서버는 `listen()` 이후 커널이 **대기열(backlog queue)** 을 만든다.
* 클라이언트가 SYN 보내면 그 연결이 backlog로 들어간다.
* handshake가 끝나면 **새로운 소켓 FD가 생성된다.**
* `accept()`는 backlog에서 “준비된 연결”을 하나 꺼내서
  **새 FD를 사용자 코드에 반환**한다.

즉:

* `listen()`한 소켓 FD = “대문”
* `accept()`로 나온 FD = “각 손님과의 개별 연결”

---

# 2. 소켓 내부의 커널 버퍼 구조

TCP read/write가 의미하는 건 **커널 내부 버퍼**와의 상호작용이다.
여기서 헷갈리면 read/write를 잘못 이해하게 된다.

## 2-1) recv buffer

클라이언트가 데이터를 보내면:

1. NIC(네트워크 카드) → 커널
2. 커널은 해당 연결의 **recv buffer**에 데이터 저장
3. `read()`는 이 recv buffer에서 데이터를 가져온다

즉:

```
read() = TCP 패킷 받는 게 아님  
read() = 커널 recv buffer에서 가져오는 것
```

recv buffer가 비어 있으면:

* 블로킹 모드 → read가 멈춘다
* 논블로킹 모드 → read가 EAGAIN으로 즉시 리턴한다

## 2-2) send buffer

`write()` 동작은 더 확실히 알아야 한다.

1. `write()`는 데이터를 **커널 send buffer에 복사**하는 것이다.
2. TCP가 실제로 전송하는 건 그 다음 단계다.
3. 네트워크가 느리면 send buffer에 여유가 없을 수 있다.

이때:

* send buffer 꽉 찼음 + 블로킹 → write()가 멈춘다
* send buffer 꽉 찼음 + 논블로킹 → write()가 EAGAIN 리턴

즉:

```
write() = 네트워크로 바로 보내는 함수가 아님  
write() = 커널 send buffer에 기록하는 함수
```

---

# 3. 블로킹 여부는 커널 버퍼 상태가 결정한다

이건 매우 중요하다.
“블로킹/논블로킹은 read/write 자체가 아니라 **커널 버퍼 상황**으로 결정한다.”

정확히 이렇게 된다:

### 블로킹 read()

* recv buffer 비어 있음 → read 멈춤
* recv buffer 데이터 있음 → 즉시 읽고 리턴

### 논블로킹 read()

* recv buffer 비어 있음 → EAGAIN
* recv buffer 데이터 있음 → 즉시 리턴

---

### 블로킹 write()

* send buffer 여유 있음 → 즉시 기록하고 리턴
* send buffer 가득 참 → write 멈춤

### 논블로킹 write()

* send buffer 여유 있음 → 기록 후 즉시 리턴
* send buffer 가득 참 → EAGAIN

---

이 동작은 모든 TCP 기반 서버의 근본이다.
그리고 멀티플렉싱(epoll)은 정확히 이걸 기반으로 한다.

---

# 4. epoll이 실제로 하는 일

epoll은 단순히 “소켓 감시”가 아니다.
정확히는:

> 커널이 recv/send buffer를 감시해
> “지금 read/write 가능한 소켓”만 사용자에게 알려주는 것.

### epoll_read 가능 이벤트

* recv buffer에 읽을 수 있는 데이터가 있음
  → EPOLLIN

### epoll_write 가능 이벤트

* send buffer에 여유 공간이 있음
  → EPOLLOUT

이걸 기반으로 이벤트 루프가 동작한다.

---

# 5. 소켓의 생명주기

부가적인 데도 실제 서버에서 제일 사고 많이 나는 부분.

### 5-1) 정상 종료 (FIN → FIN ACK)

클라이언트가 정상 종료하면:

* 커널은 recv buffer가 EOF 상태가 되었음을 표시한다.
* read()는 0을 리턴한다.
* 서버는 이 FD를 close해야 한다.

### 5-2) 비정상 종료 (RST)

네트워크 오류나 강제 종료 시:

* recv buffer가 ‘연결 끊김’ 상태가 됨
* read/write 호출 시 에러 발생
* 이벤트 루프는 FD를 즉시 제거해야 함

---

# 6. 전체 흐름 요약

핵심만 요약하면 아래로 정리된다.

1. **TCP 연결 시도** → handshake 완료 → 새 FD 생성
2. 클라이언트 패킷 도착 → 커널 recv buffer에 저장
3. read()는 recv buffer를 읽는 동작
4. write()는 send buffer에 쓰는 동작
5. 블로킹/논블로킹 동작은 **커널 버퍼 상태**로 결정
6. epoll은 버퍼 상태 기반으로 “준비된 FD만” 알려주는 역할

이걸 이해하면 Nginx, Node.js, Netty, Redis 같은 구조가 왜 그렇게 설계됐는지 자연스럽게 이해된다.

---

# 7. 다음 편 예고

4편에서는 **HTTP 요청 처리 흐름**을 다룬다.

* accept → read → 파싱 → 라우팅 → write의 실제 움직임
* keep-alive가 소켓 생명주기에 어떤 영향을 주는지
* REST에서 URL/메서드가 어떻게 매핑되는지

여기까지 이해하면 “서버가 실제로 어떻게 동작하는지” 전체 그림이 완성된다.
