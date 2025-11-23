아래는 요청 기준으로 **루트 README.md** 수준으로 재구성한 전체 문서다.

* 프로젝트명 변경
* `gameserver-fundamentals`(Lab 1.1–1.4) / `netcode-core`(v1.0+)로 재배치
* CI/CD는 **netcode-core v1.0 베이스라인**으로 명시
* 기존 내용은 최대한 유지하되 설명 과잉은 줄이고 개요 위주로 정리

---

# gameserver-fundamentals & netcode-core

실시간 게임 서버와 넷코드를 **기초 → 프로덕션**까지 단계적으로 구현하는 모노레포.

* **Track A – gameserver-fundamentals**: TCP/WS 기반 기초 게임 서버 실습 (Lab 1.1–1.4)
* **Track B – netcode-core**: UDP 권위 서버 + 스냅샷/델타 + 예측/리컨실리에이션 + 관측/배포 (v1.0+)

최종 산출물:

* **C++17/boost.asio 기반 60 TPS UDP 권위 서버**
* **스냅샷–델타 동기화 + 클라이언트 예측/리컨실리에이션**
* **Prometheus/Grafana 관측 + 재현 가능한 부하 테스트**
* **Redis 매치/룸 분리, JWT 인증, PostgreSQL 리더보드**
* **AWS EC2/RDS/CloudWatch 프로덕션 배포(선택)**

---

## 리포지토리 구조

```text
.
├── README.md
├── design/
│   ├── gameserver-fundamentals/
│   ├── netcode-core/
├── gameserver-fundamentals/     # Lab 1.1–1.4
│   ├── lab1.1-tcp-echo/
│   ├── lab1.2-turn-combat/
│   ├── lab1.3-ws-chat/
│   └── lab1.4-ws-pong/
└── netcode-core/                # v1.0+ UDP 권위 서버 & 프로덕션 스택
    ├── core/                    # 게임 루프, 월드, 물리 (lab1.4에서 추출)
    ├── net/
    │   ├── ws/                  # WebSocket 전송 (WS 데모용)
    │   └── udp/                 # UDP + 최소 신뢰성 레이어
    ├── sync/                    # 스냅샷/델타 + 예측/리컨실리에이션
    ├── metrics/                 # Prometheus exporter
    ├── match/                   # 매치메이커 + 룸 라우팅
    ├── auth/                    # JWT 검증
    ├── db/                      # PostgreSQL 래퍼
    ├── apps/
    │   ├── pong_ws/             # (core + net/ws) – WS 데모
    │   ├── pong_udp/            # (core + net/udp + sync)
    │   ├── loadgen/             # synthetic clients
    │   ├── matcher/             # matchmaker 서비스
    │   └── auth_api/            # 인증 HTTP API
    ├── proto/                   # protobuf 스키마
    ├── migrations/              # SQL 마이그레이션 (users, elo, match_history)
    ├── deployments/
    │   ├── docker/              # 로컬 dev (Prometheus, Grafana, Redis 등)
    │   └── aws/                 # EC2/RDS/CloudWatch용 compose & 설정
    ├── scripts/                 # netem, pcap, quality-gate, runbook
    └── docs/
        ├── architecture.md      # I/O 모델, 틱 파이프라인, 패킷 라이프사이클
        ├── operations.md        # 대시보드, 메트릭, 장애 대응 runbook
        └── evidence/            # 버전별 검증 리포트 / 그래프 / pcap / 영상
```

---

## 공통 기술 스택

* **언어/런타임**: C++17, POSIX 소켓, boost.asio 1.82+, boost.beast 1.82+
* **프로토콜**: UDP + 커스텀 헤더(`seq`, `ack`, `ack_bits`), **Protocol Buffers 3.21+**
* **빌드**: CMake 3.20+, GCC 11+/Clang 14+
* **테스트/분석**: Google Test, ASan/UBSan, valgrind, perf
* **관측**: Prometheus, Grafana
* **데이터/인프라**: Redis 7+, PostgreSQL 16+, Docker, docker-compose
* **인증**: JWT(HS256), bcrypt
* **클라우드(선택)**: AWS EC2, RDS, CloudWatch
* **실험 도구**: `tc/netem`, `tcpdump/pcap`
* **플랫폼**: Linux/macOS, AWS Ubuntu 24.04

---

## Track A – gameserver-fundamentals

> 기존 Milestone 1.1–1.4 → **Lab 1.1–1.4**로 정리.
> 목적: 프레임워크 없이 C++/소켓/게임 루프/WS 기본기를 몸으로 익히는 실습.

### Lab 1.1 – C++ & TCP Socket Basics

**경로**: `gameserver-fundamentals/lab1.1-tcp-echo/`
**목표**: 라이브러리 없이 멀티스레드 TCP 에코 서버 구현

* 학습

  * C++ 메모리 관리 (포인터, 참조, RAII, 스마트 포인터)
  * POSIX 소켓 `socket/bind/listen/accept/read/write`
  * 파일 디스크립터 생명주기 관리
  * `std::thread` 기반 멀티스레딩
* 산출물

  * 100+ 동시 연결 처리 가능한 TCP 에코 서버
  * valgrind 기준 메모리 릭 0
  * 정상적인 종료 시그널 처리 및 graceful shutdown

---

### Lab 1.2 – Fixed Timestep Game Loop (Turn-based)

**경로**: `gameserver-fundamentals/lab1.2-turn-combat/`
**목표**: 고정 타임스텝(10 TPS)을 가진 2인 턴제 전투 게임

* 학습

  * 고정 타임스텝 게임 루프 (`std::chrono`)
  * 게임 상태(State)와 입력 처리 구조
  * 간단한 네트워크 동기화(턴 교환)
* 게임

  * 플레이어 2명, 번갈아 10 데미지 공격, 각 100 체력
  * 한쪽 체력이 0 이하가 되면 패배
* 산출물

  * 10 TPS 안정 유지
  * 2 클라이언트가 접속해 정상적으로 게임 종료까지 진행

---

### Lab 1.3 – WebSocket Chat (브라우저 호환)

**경로**: `gameserver-fundamentals/lab1.3-ws-chat/`
**목표**: boost.asio + boost.beast 기반 멀티룸 WebSocket 채팅 서버

* 학습

  * boost.asio 비동기 I/O 패턴 (`async_accept`, `async_read`, handler 구조)
  * WebSocket 핸드셰이크·프레임 처리 (boost.beast)
  * 세션 관리, 룸 매핑, 브로드캐스트 구조
* 기능

  * 여러 채팅방 지원, 입장/퇴장
  * 룸 단위 브로드캐스트
  * `clients/web/`의 브라우저 WebSocket 클라이언트 지원
* 산출물

  * 100+ 동시 연결
  * 방별 메시지 전달 정확성 확인 (간단한 테스트 스크립트 + 데모 영상)

---

### Lab 1.4 – Real-time Pong over WebSocket (60 TPS)

**경로**: `gameserver-fundamentals/lab1.4-ws-pong/`
**목표**: 60 TPS로 동작하는 실시간 Pong (WebSocket/TCP, 브라우저 클라이언트)

* 학습

  * 60 TPS 고정 루프 (16.67ms 틱)
  * 키 입력 처리 (WASD/방향키), 기본 물리(속도, 충돌)
  * JSON 기반 상태 동기화(서버 → 클라이언트)
* 기능

  * 2인 Pong, 점수 집계, 벽/패들 충돌
  * 브라우저 렌더링 (60 FPS로 상태 반영)
* 산출물

  * 60 TPS ±1 유지, 입력 지연 < 50ms
  * “멈춤/티어링 없이 게임 플레이 가능한” 데모 영상
  * 이후 `netcode-core/core/`로 추출되는 게임 루프/월드/물리 코드

---

## Track B – netcode-core (v1.0+)

> 기존 Milestone 1.5–1.13 → **netcode-core v1.0+**로 재배치.
> 기준은 “프로덕션에 견딜 수 있는 UDP 넷코어”이며, **v1.0에서 CI/CD + 품질 게이트를 명시적 베이스라인으로 선언**하고 이후 모든 버전에 적용.

### 공통 프로토콜 (netcode-core)

* 전송: **UDP**
* 헤더: `seq`, `ack`, `ack_bits` (32 프레임 윈도우의 selective ACK)
* protobuf 메시지:

  * `Input`: `client_seq`, `timestamp_ns`, `dx`, `dy`, `fire`
  * `World`: tick, 공 좌표/속도, 패들 위치, 점수, 역할(Role)
  * `Snapshot`: `tick`, `is_keyframe`, `state`(키프레임 or 델타 blob), `base_tick`(델타 기준), 클라이언트별 `role`
  * `ServerAck`: 서버 기준 마지막 클라이언트 입력 seq, 서버 tick

---

### netcode-core v1.0 – UDP Authority Core & CI/CD Baseline

**경로**: `netcode-core/` (핵심: `net/core`, `net/udp`, `.github/workflows/ci.yml`, `scripts/quality-gate.sh`)
**목표**: WS/TCP에서 **UDP 권위 서버**로 전환 + 최소 신뢰성 레이어 + CI/CD & 품질 게이트 확립

* 기능

  * UDP 헤더: `seq/ack/ack_bits`
  * 최소 신뢰성 구현:

    * 윈도우 크기 32 프레임
    * 중복 패킷 필터링
    * 제한된 재전송 큐 및 timeout
  * `ITransport` 인터페이스

    * `start/stop/send/update`
    * `Counters`(재전송, timeout, dropped_* 메트릭)
  * CI/CD 파이프라인

    * GitHub Actions: Debug/Release 빌드, 테스트, ASan/UBSan
    * `scripts/quality-gate.sh`로 로컬에서도 동일 기준 검증
* 품질 게이트 (v1.0 이후 모든 버전에 공통)

  * 테스트 커버리지 ≥ 70% (유닛 + 통합)
  * 성능: 60 TPS ±1, 서버 처리 p99 < 15ms
  * lint: clang-format + clang-tidy 통과
  * 메모리: ASan/valgrind 기준 릭 0
* 검증

  * 3% 패킷 손실 환경에서도 세션 안정, 상태 불일치 0
  * pcap 기반 재전송/손실 비율 캡처

---

### netcode-core v1.1 – Snapshot/Delta + Prediction/Reconciliation

**경로**: `netcode-core/sync/`, `netcode-core/apps/pong_udp/`
**목표**: 프로덕션 스타일의 상태 동기화와 클라이언트 예측/리컨실리에이션

* 기능

  * N 틱마다 키프레임, 사이 틱은 델타
  * 이전 상태 대비 델타 생성, 선택적 압축
  * 클라이언트 입력 예측 + 서버 튕김(server echo)에 따른 리컨실리에이션
  * 회귀(resim) 깊이 ≤ 2 틱 유지
* 성능 목표

  * RTT 20/60/120ms, 손실 0/3% 조합에서도 조작감 허용 범위 내
  * 델타 vs 키프레임 기준 **전송 바이트 ≥ 50% 절감**
* 시간/틱 예산 (60 TPS, 16.67ms/tick)

  * 입력 처리 ~0.4ms
  * 게임 업데이트 ~6ms
  * 스냅샷/델타 생성 ~2ms
  * 직렬화/인코딩 ~1.5ms
  * 송신 큐 ~0.3ms
  * 헤드룸 ~6.5ms

---

### netcode-core v1.2 – Observability & Reproducible Load

**경로**: `netcode-core/metrics/`, `apps/loadgen/`, `deployments/docker/`
**목표**: 메트릭/대시보드/부하 테스트를 통해 동작을 수치화하고 재현 가능하게 만들기

* 메트릭 예시

  * `game_tick_rate` (게이지)
  * `game_tick_duration_seconds` (히스토그램, 0.5/0.9/0.99)
  * `rtt_ms_p50`, `rtt_ms_p99`
  * `dropped_packets_total{reason}` (dup, late, window)
  * `retransmit_total`
  * `rooms_active`, `players_active`
  * `resimulations_total`, `resim_depth_bucket`
* SLO

  * p99 `game_tick_duration_seconds` < 0.015
  * 전체 프레임의 99%가 리시뮬 깊이 2 틱 이하
* 부하 실험

  * `apps/loadgen`: N개 봇, RTT/손실 파라미터, CSV 출력
  * 200 클라이언트, RTT 60ms, 손실 1% Soak 테스트 (2–4시간)
  * 조건: RSS 증가 2% 이하, FD 카운트 안정, p99 틱 15ms 이하 유지

---

### netcode-core v1.3 – Match/Room Split & Redis Session/Recovery

**경로**: `netcode-core/match/`, `apps/matcher/`, Redis 연동
**목표**: match 서비스와 room 서버를 분리하고, Redis 기반 세션/재접속 구현

* 아키텍처

  ```text
  matcher  <->  Redis (session, room_map, queue)  <->  pong_udp (rooms N)
  ```

* 최소 Redis 키

  * `session:{token}` → `{"player_id": "...", "expires": ...}`
  * `room_map:{player_id}` → `{"room_id": 123, "addr":"127.0.0.1:7777"}`
  * `room:{id}:checkpoint` → 최신 스냅샷 blob (TTL ~30s)
  * `match:queue` (ZSET) → score = MMR, member = player_id

* 목표

  * 50 동시 룸에서 60 TPS 유지
  * 재접속 ≤ 3초, 세션 손실 0
  * matcher 장애 시 503 + 백오프 동작, 복구 시 자연스러운 회복

---

### netcode-core v1.4 (optional) – Lightweight Security & Cheat Resistance

**경로**: `netcode-core/security/` (또는 관련 모듈 내부)
**목표**: 레이트 리밋, 입력 검증, 간단한 치트 방지 추가

* 기능

  * 토큰 버킷 기반 rate limiting (client_id 당 max req/s)
  * 입력 검증: 방향값 범위, username 형식, payload 크기 제한
  * 재전송/리플레이 공격 방지 (nonce/timestamp)
  * 보안 관련 메트릭 export
* 테스트

  * 1000 req/s 공격 시 rate limiter가 차단
  * oversized / malformed / replay input에 대한 거부 테스트

---

### netcode-core v1.5 – User Authentication & DB Foundation

**경로**: `netcode-core/auth/`, `netcode-core/db/`, `apps/auth_api/`, `migrations/001_initial_schema.sql`
**목표**: JWT 기반 인증과 PostgreSQL 영속성

* DB 스키마

  * `users` 테이블

    * `user_id`(UUID), `username`(unique), `password_hash`(bcrypt), `created_at`
* 기능

  * `auth_api` HTTP 서버

    * 회원가입: username + password → bcrypt hash 저장
    * 로그인: password 검증 후 JWT 발급 (HS256)
    * 토큰 검증 API
  * 게임 서버

    * 접속 시 JWT 검증 후 플레이 허용
* 검증

  * 만료/변조 토큰 거부
  * 비밀번호 평문 저장 없음
  * 간단한 web login 페이지 + curl 기반 검증

---

### netcode-core v1.6 – Game Statistics & Leaderboard

**경로**: `migrations/002_add_elo.sql`, `003_match_history.sql`, `db/`
**목표**: 매치 히스토리, ELO 레이팅, 리더보드 API

* DB

  * `users`에 `elo_rating`, `wins` 컬럼, `elo_rating DESC` 인덱스
  * `match_history` 테이블: left/right 유저, 점수, winner, elo_before/after, 종료시간
* 기능

  * ELO 계산기(K=32)
  * 매치 종료 시:

    * 승패 기록, 각 유저 elo 업데이트
    * 리더보드 캐시(예: Redis) 갱신
  * 리더보드/개인 통계 REST 엔드포인트
* 목표

  * DB 리더보드 쿼리 p99 < 50ms
  * 캐시 경유 리더보드 p99 < 5ms
  * 20+ 유저, 100+ 매치 데이터로 동작 검증

---

### netcode-core v1.7 – AWS Production Deployment

**경로**: `deployments/aws/`, CloudWatch 설정
**목표**: EC2/RDS 기반 프로덕션 배포 + 모니터링

* 인프라

  * EC2에 Docker 기반 서버(pong_udp, auth_api 등) 구동
  * RDS(PostgreSQL) 연동
  * 보안 그룹, IAM 최소 권한
* 기능

  * HTTPS (Let’s Encrypt)
  * CloudWatch 로그/메트릭 + 알람 (CPU, 에러율 등)
* 검증

  * 인터넷에서 실제 게임/HTTP 엔드포인트 접근 가능
  * `curl http(s)://<EC2 or domain>/health` 200 OK
  * 200 동시 사용자 부하 테스트 통과
  * 월 비용 < $60 수준으로 제어

---

### netcode-core v1.8 (optional) – Advanced Features

**경로**: `netcode-core/admin/`, `netcode-core/replay/`, `netcode-core/anticheat/` 등
**목표**: 포트폴리오 차별화를 위한 고급 기능

* 기능 예시

  * Admin API: 유저 밴, 서버 통계 조회
  * Match Replay: 입력 시퀀스 + 초기 상태 저장, 결정론적 재생
  * Anti-cheat: 비정상 입력 레이트, 비현실적 반응 속도 탐지
  * 분석: DAU/Retention/Churn 등 집계 및 대시보드 표시
* 검증

  * Admin 패널에서 밴 시 즉시 접속 종료
  * 리플레이 재생 결과가 원본과 동일
  * 특정 cheat 패턴 시 알림/로그 남김

---

## 빌드 & 실행 – Quick Start

### 1) 공통 빌드

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

### 2) gameserver-fundamentals

```bash
# Lab 1.4 – WebSocket Pong 데모
./build/gameserver-fundamentals/lab1.4-ws-pong/pong_ws
# 또는 netcode-core/apps/pong_ws/ 위치에서 실행하도록 CMake 구성 가능

# Web 클라이언트
cd clients/web
npm i && npm run dev
# http://localhost:5173 접속 후 WS 서버에 연결
```

### 3) netcode-core – UDP Authority 서버

```bash
# UDP 기반 Pong 서버
./build/netcode-core/apps/pong_udp/pong_udp
```

### 4) 로컬 인프라 (metrics/redis 등)

```bash
cd netcode-core
docker compose -f deployments/docker/docker-compose.yml up -d
```

### 5) 부하 테스트 & 네트워크 실험

```bash
# 부하 발생기
./build/netcode-core/apps/loadgen/loadgen --clients 200 --rtt 60 --loss 0.03

# netem으로 지연/손실 주입
sudo ./netcode-core/scripts/netem.sh --delay 60ms --loss 3%
```

---

이 구조를 기준으로 실제 코드/디렉터리 이름만 맞춰서 정리하면 된다.
추가로 세부적인 API/코드 샘플이 필요하면 각 트랙/버전별로 별도 문서(`docs/architecture.md`, `docs/operations.md`)에서 풀어 쓰면 되고, 루트 README는 여기 수준으로 유지하면 된다.
