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

## 2. Stage 1 - gameserver-fundamentals (Lab 1.1-1.4)

### Step 2-1. 문서 2 2차 읽기 (멀티스레딩, 예외 처리)

**문서 2 (2.md)**

* **언제:** Lab 1.1 TCP 에코 서버 구현 직전.
* **이번에 추가로 읽을 부분:**

  * `## 5. 멀티스레딩 기초`
  * `## 6. 예외 처리`
  * `## 7. Stage 1 체크리스트`

### Step 2-2. 문서 3 1차 읽기 (Lab 1.1-1.4 개요)

**문서 3 (3.md)**

* **언제:** Lab 1.1 시작 전에.
* **어디까지 읽냐 (1차):**

  * `## 0. 전제 / 목표`
  * `## 1. Lab 구성 개요`
  * `## 2. Lab 1.1: TCP 에코 서버`
  * `## 3. Lab 1.2: 턴제 전투 서버 (10 TPS)`

**아직 안 읽는 부분 (2차로 미룸):**

* `## 4. Lab 1.3: WebSocket 채팅 서버`
* `## 5. Lab 1.4: WebSocket Pong 서버 (60 TPS)`
* `## 6. Stage 1 체크리스트`

Lab 1.1, 1.2를 먼저 끝내고 나서 1.3, 1.4로 넘어간다.

---

### Step 2-3. Lab 1.1 구현 (TCP 에코 서버)

* design/gameserver-fundamentals/lab1.1.md 읽기
* 구현:

  * Socket 클래스 (RAII)
  * EchoServer (멀티스레드)
  * 명령어 처리 (exit, shutdown)
* 빌드 & 실행:

  ```bash
  cd gameserver-fundamentals/build
  cmake ..
  make
  ./lab1.1-tcp-echo/echo_server.out 8080
  ```

* 테스트:

  ```bash
  telnet localhost 8080
  # 메시지 입력 → 에코 확인
  # exit 입력 → 연결 종료
  # shutdown 입력 → 서버 종료
  ```

---

### Step 2-4. Lab 1.2 구현 (턴제 전투 서버)

* design/gameserver-fundamentals/lab1.2.md 읽기
* 구현:

  * GameSession 클래스 (10 TPS 타이머)
  * 플레이어 상태 관리
  * 전투 로직 (체력, 공격, 회복)
* 빌드 & 실행

* 테스트: 2개 클라이언트 동시 접속 후 턴제 전투 확인

---

### Step 2-5. 문서 3 2차 읽기 (Lab 1.3-1.4)

**문서 3 (3.md)**

* **언제:** Lab 1.2 끝나고, WebSocket 서버 들어가기 전에.
* **이번에 추가로 읽을 부분:**

  * `## 4. Lab 1.3: WebSocket 채팅 서버`
  * `## 5. Lab 1.4: WebSocket Pong 서버 (60 TPS)`
  * `## 6. Stage 1 체크리스트`

---

### Step 2-6. Lab 1.3 구현 (WebSocket 채팅 서버)

* design/gameserver-fundamentals/lab1.3.md 읽기
* 구현:

  * WebSocket 핸드셰이크
  * 프레임 파싱/인코딩
  * 브로드캐스트 메시지
* 빌드 & 실행

* 테스트: 웹 브라우저로 접속 후 채팅 확인

---

### Step 2-7. Lab 1.4 구현 (WebSocket Pong 서버)

* design/gameserver-fundamentals/lab1.4.md 읽기
* 구현:

  * 60 TPS 게임 루프
  * 공/패들 물리
  * JSON 메시지 직렬화
* 빌드 & 실행

* 테스트: 웹 브라우저로 Pong 게임 플레이

---

## 3. Stage 2 - netcode-core (v1.0-1.3)

### Step 3-1. 문서 4 1차 읽기 (netcode-core 개요)

**문서 4 (4.md)**

* **언제:** Lab 1.4까지 끝나고, UDP 권위 서버로 들어가기 전에.
* **어디까지 읽냐 (1차):**

  * `## 0. 전제 / 목표`
  * `## 1. netcode-core 프로젝트 구조`
  * `## 2. v1.0: UDP 권위 서버 & 신뢰성 레이어`
  * `## 3. v1.1: 스냅샷 & 델타 압축`

**아직 안 읽는 부분 (2차로 미룸):**

* `## 4. v1.2: 메트릭 & 모니터링`
* `## 5. v1.3: 매치메이킹 & 방 분리`
* `## 6. Stage 2 체크리스트`

v1.0, v1.1을 먼저 구현하고 나서 v1.2, v1.3으로 넘어간다.

---

### Step 3-2. v1.0 구현 (UDP 권위 서버)

* design/netcode-core/1.0-udp-authority-core.md 읽기
* 구현:

  * UdpTransport 클래스
  * 시퀀스 번호, ACK 비트마스크
  * 재전송 큐
  * 패킷 필터링 (중복, 오래된 패킷)
* 빌드 & 실행:

  ```bash
  cd netcode-core/build
  cmake ..
  make
  ./apps/pong_udp/bin/pong_server 9000
  ```

* 테스트: 패킷 손실 시뮬레이션 환경에서 안정성 확인

---

### Step 3-3. v1.1 구현 (스냅샷 & 델타 압축)

* design/netcode-core/1.1-snapshot-delta.md 읽기
* 구현:

  * Protobuf 메시지 정의
  * 델타 인코딩
  * 클라이언트측 예측/보간
* 빌드 & 테스트

---

### Step 3-4. 문서 4 2차 읽기 (v1.2-1.3)

**문서 4 (4.md)**

* **언제:** v1.1 끝나고, 메트릭/매칭 시스템 들어가기 전에.
* **이번에 추가로 읽을 부분:**

  * `## 4. v1.2: 메트릭 & 모니터링`
  * `## 5. v1.3: 매치메이킹 & 방 분리`
  * `## 6. Stage 2 체크리스트`

---

### Step 3-5. v1.2 구현 (메트릭 & 모니터링)

* design/netcode-core/1.2-observability.md 읽기
* 구현:

  * Prometheus 메트릭 수집
  * 커스텀 카운터/히스토그램
  * `/metrics` 엔드포인트
* 빌드 & 테스트

* Grafana 대시보드 설정

---

### Step 3-6. v1.3 구현 (매치메이킹 & 방 분리)

* design/netcode-core/1.3-match-room-split.md 읽기
* 구현:

  * 매치 서버 (별도 프로세스)
  * Redis 기반 방 관리
  * PostgreSQL 매치 히스토리
* 빌드 & 실행:

  ```bash
  ./apps/matcher/bin/matcher_server 8080
  ./apps/pong_udp/bin/pong_server 9000
  ```

* 테스트: 여러 클라이언트 매칭 후 게임 진행

---

## 최종 타임라인 요약 (문서 기준만)

1. **시작 전**

   * 1.md 전체 1회

2. **Stage 0 준비**

   * 2.md: `0~4` (C++ 기본기)
   * design/bootstrap.md: 전체

3. **Stage 1 - gameserver-fundamentals**

   * 2.md: `5~7` 추가 (멀티스레딩, 예외)
   * 3.md: `0~3` (Lab 1.1-1.2)
   * Lab 1.1, 1.2 구현
   * 3.md: `4~6` (Lab 1.3-1.4)
   * Lab 1.3, 1.4 구현

4. **Stage 2 - netcode-core**

   * 4.md: `0~3` (v1.0-1.1)
   * v1.0, v1.1 구현
   * 4.md: `4~6` (v1.2-1.3)
   * v1.2, v1.3 구현
