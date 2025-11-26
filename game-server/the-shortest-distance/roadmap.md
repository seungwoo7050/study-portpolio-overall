## 0. 제일 처음

### Step 0-1. 문서 1 (1.md)

* **언제:** 완전 맨 처음 1회.
* **어디까지:**

  * `## 1. 이 문서의 역할`
  * `## 2. 최종 목표: 어떤 서버를 만들 것인가`
  * `## 3. 전체 아키텍처 한 번에 보기`
  * `## 4. Stage별 로드맵 개요`
  * `## 5~7 Stage 0/1/2 개요`까지 그냥 쭉 읽기
* 목적: 전체 지도만 머리에 넣는 용도. 암기할 필요 없음.

---

## 1. Stage 0 준비 (프로젝트 부트스트랩)

### Step 1-1. 문서 2 1차 읽기 (C++ 기본기)

**문서 2 (2.md)**

* **언제:** 첫 코딩 들어가기 전에.

* **어디까지 읽냐:**
  1차는 여기까지만:

  * `## 0. 전제 / 목표`
  * `## 1. C vs C++ – 큰 틀 차이`
  * `## 2. C++에서 꼭 필요한 문법 정리`
  * `## 3. CMake 기초`
  * `## 4. 네트워크 프로그래밍 기본 (소켓 API)`

* 이 단계 목표:

  * C++ 참조자/RAII/스마트 포인터 이해
  * CMake로 프로젝트 빌드 가능
  * 소켓 API(socket, bind, listen, accept) 개념 파악

**아직 안 읽는 부분 (2차로 미룸):**

* `## 5. 멀티스레딩 기초`
* `## 6. 예외 처리`
* `## 7. Stage 1 체크리스트`

이 부분은 **Lab 실습할 때 참고**할 거라, 그 타이밍에 읽는 게 더 잘 박힌다.

---

### Step 1-2. design/bootstrap.md 읽기

**design/bootstrap.md**

* **언제:** 문서 2 Step 1-1 끝나고, 프로젝트 빌드 전에.
* **어디까지 읽냐:**

  * `## 1. 프로젝트 구조`
  * `## 2. CMake 빌드 시스템`
  * `## 3. C++ 설정 및 컴파일러 옵션`
  * `## 4. 의존성 관리`
  * `## 5. 빌드 및 실행`

* 이 단계 목표:

  * gameserver-fundamentals와 netcode-core 프로젝트 구조 이해
  * CMakeLists.txt 구조 파악
  * 빌드 명령어 실행 가능

---

## 2. Stage 1 - TCP 기초 (Lab 1.1-1.2)

### Step 2-1. 문서 2 2차 읽기 (멀티스레딩, 예외 처리)

**문서 2 (2.md)**

* **언제:** Lab 1.1 TCP 에코 서버 구현 직전.
* **이번에 추가로 읽을 부분:**

  * `## 5. 멀티스레딩 기초`
  * `## 6. 예외 처리`
  * `## 7. Stage 1 체크리스트`

### Step 2-2. 문서 3 읽기 (TCP 기초)

**문서 3 (3.md) - TCP 기초**

* **언제:** 문서 2 Step 2-1 끝나고.
* **전체 읽기:**

  * `## 1. Lab 1.1: TCP 에코 서버`
  * `## 2. Lab 1.2: 턴제 전투 서버 (10 TPS)`

* 목적: 멀티스레드 TCP 서버 구현, 타이머 기반 게임 루프 익히기

---

### Step 2-3. Lab 1.1-1.2 구현

* design/gameserver-fundamentals/lab1.1.md 읽기
* **Lab 1.1 구현**: Socket 클래스 (RAII), EchoServer (멀티스레드)
* design/gameserver-fundamentals/lab1.2.md 읽기
* **Lab 1.2 구현**: GameSession 클래스 (10 TPS), 전투 로직

* 빌드 & 실행:

  ```bash
  cd gameserver-fundamentals/build
  cmake ..
  make
  ./lab1.1-tcp-echo/echo_server.out 8080
  ./lab1.2-turn-combat/game_server.out 8081
  ```

---

## 3. Stage 1 - WebSocket (Lab 1.3-1.4)

### Step 3-1. 문서 4 읽기 (WebSocket)

**문서 4 (4.md) - WebSocket**

* **언제:** Lab 1.2 끝나고.
* **전체 읽기:**

  * `## 1. WebSocket 프로토콜 기본`
  * `## 2. Lab 1.3: WebSocket 채팅 서버`
  * `## 3. Lab 1.4: WebSocket Pong 서버 (60 TPS)`

* 목적: WebSocket 핸드셰이크/프레임 파싱, 60 TPS 게임 루프 구현

---

### Step 3-2. Lab 1.3-1.4 구현

* design/gameserver-fundamentals/lab1.3.md 읽기
* **Lab 1.3 구현**: WebSocket 클래스, 브로드캐스트 메시지
* design/gameserver-fundamentals/lab1.4.md 읽기
* **Lab 1.4 구현**: PongServer (60 TPS), 물리 시뮬레이션

* 빌드 & 실행:

  ```bash
  ./lab1.3-ws-chat/chat_server.out 8082
  ./lab1.4-ws-pong/pong_server.out 8083
  ```

---

## 4. Stage 2 - UDP 코어 (v1.0-1.1)

### Step 4-1. 문서 5 읽기 (UDP 코어)

**문서 5 (5.md) - UDP 코어**

* **언제:** Lab 1.4까지 끝나고, UDP 권위 서버로 들어가기 전에.
* **전체 읽기:**

  * `## 1. 왜 UDP인가?`
  * `## 2. v1.0: UDP 권위 서버 & 신뢰성 레이어`
  * `## 3. v1.1: 스냅샷 & 델타 압축`

* 목적: UDP 신뢰성 메커니즘 이해, Protobuf 메시지 직렬화

---

### Step 4-2. v1.0-1.1 구현

* design/netcode-core/1.0-udp-authority-core.md 읽기
* **v1.0 구현**: UdpTransport, 시퀀스 번호/ACK/재전송
* design/netcode-core/1.1-snapshot-delta.md 읽기
* **v1.1 구현**: Protobuf 메시지, 델타 인코딩, 예측/보간

* 빌드 & 실행:

  ```bash
  cd netcode-core/build
  cmake ..
  make
  ./apps/pong_udp/bin/pong_server 9000
  ```

---

## 5. Stage 2 - 프로덕션 (v1.2-1.3)

### Step 5-1. 문서 6 읽기 (프로덕션)

**문서 6 (6.md) - 프로덕션**

* **언제:** v1.1 끝나고.
* **전체 읽기:**

  * `## 1. v1.2: 메트릭 & 모니터링`
  * `## 2. v1.3: 매치메이킹 & 방 분리`

* 목적: Prometheus 메트릭, Grafana 대시보드, PostgreSQL/Redis 매칭 시스템

---

### Step 5-2. v1.2-1.3 구현

* design/netcode-core/1.2-observability.md 읽기
* **v1.2 구현**: Prometheus 메트릭, `/metrics` 엔드포인트
* design/netcode-core/1.3-match-room-split.md 읽기
* **v1.3 구현**: 매치 서버, PostgreSQL/Redis 연동

* 빌드 & 실행:

  ```bash
  ./apps/matcher/bin/matcher_server 8080
  ./apps/pong_udp/bin/pong_server 9000
  ```

---

## 최종 타임라인 요약

1. **시작 전**
   * 1.md 전체 1회

2. **Stage 0 준비**
   * 2.md: `0~4` (C++ 기본기)
   * design/bootstrap.md: 전체

3. **Stage 1 - TCP 기초**
   * 2.md: `5~7` 추가 (멀티스레딩, 예외)
   * **3.md: TCP 기초 (Lab 1.1-1.2)**
   * Lab 1.1, 1.2 구현

4. **Stage 1 - WebSocket**
   * **4.md: WebSocket (Lab 1.3-1.4)**
   * Lab 1.3, 1.4 구현

5. **Stage 2 - UDP 코어**
   * **5.md: UDP 코어 (v1.0-1.1)**
   * v1.0, v1.1 구현

6. **Stage 2 - 프로덕션**
   * **6.md: 프로덕션 (v1.2-1.3)**
   * v1.2, v1.3 구현
