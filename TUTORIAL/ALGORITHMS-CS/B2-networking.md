# B2: 네트워크 기초

> **목표**: 네트워크 핵심 개념을 프로젝트 기준으로 설명 가능
> **예상 시간**: 15-20시간
> **난이도**: 🟢 기초
> **선행 요구사항**: 프로그래밍 기본 지식
> **완료 기준**: 본인 프로젝트의 네트워크 구조를 그림으로 설명 가능

---

## 목차

1. [TCP vs UDP](#1-tcp-vs-udp)
2. [TCP 3-way Handshake](#2-tcp-3-way-handshake)
3. [HTTP/HTTPS](#3-httphttps)
4. [WebSocket](#4-websocket)
5. [DNS & 요청 흐름](#5-dns--요청-흐름)
6. [넷코드 프로토콜 설계](#6-넷코드-프로토콜-설계)
7. [프로젝트 연계](#7-프로젝트-연계)

---

## 1. TCP vs UDP

### 비교

| 특징 | TCP | UDP |
|-----|-----|-----|
| **연결** | 연결 지향 (Connection-oriented) | 비연결 (Connectionless) |
| **신뢰성** | 보장 (순서, 재전송) | 보장 안 함 |
| **속도** | 느림 (오버헤드) | 빠름 |
| **헤더 크기** | 20-60 바이트 | 8 바이트 |
| **흐름 제어** | ✅ | ❌ |
| **혼잡 제어** | ✅ | ❌ |
| **사용 예** | HTTP, FTP, SMTP | DNS, 게임, 실시간 스트리밍 |

### TCP 특징

**신뢰성 보장**:
1. **순서 보장**: Sequence Number로 패킷 순서 관리
2. **재전송**: ACK 없으면 재전송
3. **흐름 제어**: Sliding Window로 수신자 버퍼 고려
4. **혼잡 제어**: 네트워크 상황에 따라 전송 속도 조절

```cpp
// TCP 소켓 생성 (POSIX)
int sock = socket(AF_INET, SOCK_STREAM, 0);  // SOCK_STREAM = TCP

// 연결
connect(sock, (struct sockaddr*)&addr, sizeof(addr));

// 데이터 전송
send(sock, data, len, 0);

// 데이터 수신
recv(sock, buffer, sizeof(buffer), 0);

// 연결 종료
close(sock);
```

### UDP 특징

**비연결, 빠른 전송**:
- 연결 설정 없음 (3-way handshake 불필요)
- 패킷 손실 가능 (재전송 없음)
- 순서 보장 안 함
- 오버헤드 최소

```cpp
// UDP 소켓 생성
int sock = socket(AF_INET, SOCK_DGRAM, 0);  // SOCK_DGRAM = UDP

// 데이터 전송 (연결 없이)
sendto(sock, data, len, 0, (struct sockaddr*)&addr, sizeof(addr));

// 데이터 수신
recvfrom(sock, buffer, sizeof(buffer), 0, (struct sockaddr*)&addr, &addr_len);
```

### 언제 UDP를 쓰나?

**게임 서버에서 UDP를 선택하는 이유**:
1. **실시간성**: 낮은 레이턴시가 중요
2. **패킷 손실 허용**: 오래된 위치 정보는 버려도 됨
3. **대역폭 효율**: 헤더 오버헤드 최소화
4. **직접 제어**: 신뢰성 계층을 직접 구현하여 게임에 최적화

**프로젝트 예**:
- **netcode-core**: UDP 위에 신뢰성 계층 직접 구현
- **WebSocket Pong**: 실시간 게임이지만 TCP (WebSocket) 사용 (신뢰성 필요)

---

## 2. TCP 3-way Handshake

### 연결 설정 과정

```
Client                          Server
  |                               |
  |  1. SYN (seq=100)            |
  |----------------------------->|
  |                               |
  |  2. SYN-ACK (seq=200, ack=101)|
  |<-----------------------------|
  |                               |
  |  3. ACK (ack=201)            |
  |----------------------------->|
  |                               |
  |   [연결 established]          |
```

**과정**:
1. **SYN**: 클라이언트가 연결 요청 (Sequence Number 전송)
2. **SYN-ACK**: 서버가 수락 (자신의 Seq + 클라이언트 Seq+1 ACK)
3. **ACK**: 클라이언트가 확인 (서버 Seq+1 ACK)

### 연결 종료 (4-way Handshake)

```
Client                          Server
  |  1. FIN                      |
  |----------------------------->|
  |  2. ACK                      |
  |<-----------------------------|
  |  3. FIN                      |
  |<-----------------------------|
  |  4. ACK                      |
  |----------------------------->|
```

### Keep-Alive

**문제**: 연결이 유휴 상태로 오래 유지되면 방화벽/라우터가 끊을 수 있음

**해결**:
```cpp
// TCP Keep-Alive 설정
int optval = 1;
setsockopt(sock, SOL_SOCKET, SO_KEEPALIVE, &optval, sizeof(optval));
```

---

## 3. HTTP/HTTPS

### HTTP 기본

**요청/응답 구조**:
```
[요청]
GET /api/users/1 HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0
Accept: application/json

[응답]
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 42

{"id": 1, "name": "Alice"}
```

### HTTP 메서드

| 메서드 | 의미 | Idempotent | Safe |
|--------|------|-----------|------|
| **GET** | 조회 | ✅ | ✅ |
| **POST** | 생성 | ❌ | ❌ |
| **PUT** | 전체 수정 | ✅ | ❌ |
| **PATCH** | 부분 수정 | ❌ | ❌ |
| **DELETE** | 삭제 | ✅ | ❌ |

**Idempotent**: 여러 번 호출해도 결과 동일
**Safe**: 서버 상태 변경 없음

### HTTP 상태 코드

- **2xx**: 성공
  - 200 OK
  - 201 Created
  - 204 No Content
- **3xx**: 리다이렉션
  - 301 Moved Permanently
  - 302 Found (Temporary Redirect)
- **4xx**: 클라이언트 오류
  - 400 Bad Request
  - 401 Unauthorized
  - 403 Forbidden
  - 404 Not Found
- **5xx**: 서버 오류
  - 500 Internal Server Error
  - 503 Service Unavailable

### HTTPS

**개념**: HTTP + TLS/SSL (암호화)

**과정**:
1. 클라이언트가 HTTPS 요청
2. 서버가 인증서 전송 (공개키 포함)
3. 클라이언트가 인증서 검증
4. 대칭키 교환 (비대칭키로 암호화)
5. 대칭키로 데이터 암호화 통신

---

## 4. WebSocket

### 개념

**WebSocket**: HTTP 업그레이드로 시작되는 양방향 실시간 통신

**HTTP vs WebSocket**:
```
[HTTP]
Client ----request----> Server
Client <---response---- Server
(연결 종료)

[WebSocket]
Client ----upgrade----> Server
Client <===message====> Server
Client <===message====> Server
(연결 유지)
```

### Upgrade 과정

```
[요청]
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
Sec-WebSocket-Version: 13

[응답]
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=
```

### 사용 예

```javascript
// JavaScript 클라이언트
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected');
  ws.send('Hello Server');
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};

ws.onerror = (error) => {
  console.error('Error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

### Ping/Pong (Heartbeat)

**목적**: 연결 유지 확인

```cpp
// C++ 서버 (boost.beast)
void send_ping() {
    ws_.ping({});  // Ping 전송
}

// Pong 자동 응답 (boost.beast가 자동 처리)
```

---

## 5. DNS & 요청 흐름

### DNS (Domain Name System)

**역할**: 도메인 이름 → IP 주소 변환

**과정**:
```
1. 브라우저 캐시 확인
2. OS 캐시 확인
3. 로컬 DNS 서버 (ISP)
4. 루트 DNS 서버
5. TLD DNS 서버 (.com)
6. Authoritative DNS 서버 (example.com)
```

### 브라우저에서 서버까지

**"https://example.com/api/users" 입력 시**:
```
1. DNS 조회: example.com → 93.184.216.34
2. TCP 3-way handshake (93.184.216.34:443)
3. TLS Handshake (HTTPS)
4. HTTP GET 요청
5. 서버 응답
6. HTML 파싱/렌더링
7. 추가 리소스 로딩 (CSS, JS, 이미지)
```

---

## 6. 넷코드 프로토콜 설계

### 패킷 구조

```
[헤더] (16바이트)
+-------------------+
| seq (4B)          |  Sequence Number
+-------------------+
| ack (4B)          |  Acknowledgement
+-------------------+
| ack_bits (4B)     |  32-frame window
+-------------------+
| payload_size (4B) |  페이로드 크기
+-------------------+
[페이로드] (가변)
+-------------------+
| player_input      |  입력 데이터
| timestamp         |  타임스탬프
| ...               |
+-------------------+
```

### 신뢰성 계층

**Sequence Number**:
- 패킷마다 증가하는 번호
- 순서 보장 및 중복 제거

**ACK + ACK Bits**:
- ACK: 받은 최신 패킷 번호
- ACK Bits: 최근 32개 패킷 수신 여부 (비트마스크)

```cpp
// 예: seq=100 수신 시
// ack=100, ack_bits=0b11111111111111111111111111111110
// → 99, 98, ..., 70, 68 받음 (69 손실)

bool isAcked(uint32_t seq, uint32_t ack, uint32_t ack_bits) {
    if (seq == ack) return true;
    if (seq > ack) return false;

    uint32_t diff = ack - seq;
    if (diff > 32) return false;

    return (ack_bits & (1 << (diff - 1))) != 0;
}
```

### 대역폭 최적화

**스냅샷/델타**:
- **키프레임 (Snapshot)**: 10프레임마다 전체 상태 전송
- **델타 (Delta)**: 이전 프레임 대비 변경된 부분만 전송
- 대역폭 50% 절감

```cpp
// 델타 인코딩
struct PlayerState {
    Vec2 position;
    Vec2 velocity;
    uint8_t health;
};

void encodeDelta(const PlayerState& prev, const PlayerState& curr, Buffer& out) {
    if (prev.position != curr.position) {
        out.writeBit(1);
        out.writeVec2(curr.position);
    } else {
        out.writeBit(0);
    }

    if (prev.health != curr.health) {
        out.writeBit(1);
        out.writeByte(curr.health);
    } else {
        out.writeBit(0);
    }
}
```

---

## 7. 프로젝트 연계

### video-editor

**HTTP 파일 업로드**:
```typescript
// Express + multer
app.post('/upload', upload.single('video'), (req, res) => {
  const file = req.file;
  // 파일 처리...
});
```

**WebSocket 진행률**:
```typescript
// v1.3: WebSocket으로 ffmpeg 진행률 실시간 전송
wss.on('connection', (ws) => {
  ffmpegProcess.on('progress', (progress) => {
    ws.send(JSON.stringify({ type: 'progress', value: progress }));
  });
});
```

### gameserver-fundamentals

**TCP 에코 서버** (lab1.1):
```cpp
// TCP로 간단한 에코 서버
int clientSocket = accept(serverSocket, ...);
char buffer[1024];
int n = recv(clientSocket, buffer, sizeof(buffer), 0);
send(clientSocket, buffer, n, 0);
```

**WebSocket Pong** (lab1.4):
```cpp
// WebSocket으로 실시간 게임
// 60 TPS 게임 루프로 위치 브로드캐스트
```

### netcode-core

**UDP 신뢰성**:
```cpp
// UDP 위에 신뢰성 계층 구현
// seq, ack, ack_bits로 패킷 손실 탐지 및 재전송
```

**클라이언트 예측 + 서버 리컨실리에이션**:
- 클라이언트는 입력 즉시 로컬 시뮬레이션
- 서버 응답 수신 시 상태 비교 및 보정
- 네트워크 지연 100ms에도 부드러운 UX

---

## 면접 질문

### 1. TCP와 UDP의 차이는?
**답변**: TCP는 연결 지향, 신뢰성 보장 (순서, 재전송)하지만 오버헤드가 큽니다. UDP는 비연결, 빠르지만 신뢰성이 없습니다. 게임 서버에서는 실시간성이 중요하고 패킷 손실을 허용할 수 있어 UDP를 선택했으며, 필요한 신뢰성 계층은 직접 구현했습니다.

### 2. WebSocket과 HTTP의 차이는?
**답변**: HTTP는 요청/응답 모델로 단방향 통신이며 연결이 종료됩니다. WebSocket은 HTTP 업그레이드로 시작되지만 양방향 실시간 통신이 가능하고 연결이 유지됩니다. video-editor 프로젝트에서 ffmpeg 진행률을 실시간으로 전송하기 위해 WebSocket을 사용했습니다.

### 3. 게임 서버에서 UDP를 쓰는 이유는?
**답변**: (1) 실시간성: 낮은 레이턴시가 중요, (2) 패킷 손실 허용: 오래된 위치 정보는 버려도 됨, (3) 대역폭 효율: 헤더 오버헤드 최소화. netcode-core 프로젝트에서 UDP 위에 ack/seq로 신뢰성 계층을 직접 구현하여 게임에 최적화했습니다.

---

## 다음 단계

✅ **B2 완료 후**:
- [B3: DB 기초](./B3-database.md)

**체크리스트**:
- [ ] TCP/UDP 차이 설명 가능
- [ ] HTTP 메서드/상태 코드 숙지
- [ ] WebSocket 동작 원리 이해
- [ ] 본인 프로젝트 네트워크 구조 그림으로 설명 가능

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
