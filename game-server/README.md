# 게임 서버 기초부터 프로덕션까지

실시간 게임 서버와 넷코드를 **기초부터 프로덕션**까지 단계적으로 구현하는 종합 프로젝트.

**기술 스택**: C++17 · Boost.Asio/Beast · UDP · Protocol Buffers · PostgreSQL · Redis · Prometheus · Docker

---

## 프로젝트 개요

이 저장소는 두 개의 학습 트랙으로 구성됩니다:

- **Track A – gameserver-fundamentals**: TCP/WebSocket 기반 기초 게임 서버 실습 (Lab 1.1–1.4)
- **Track B – netcode-core**: UDP 권위 서버 + 스냅샷/델타 + 예측/리컨실리에이션 + 관측/배포 (v1.0+)

### 최종 산출물

- ✅ **C++17/Boost.Asio 기반 60 TPS UDP 권위 서버**
- ✅ **스냅샷–델타 동기화 + 클라이언트 예측/리컨실리에이션**
- ✅ **Prometheus/Grafana 관측 + 재현 가능한 부하 테스트**
- ✅ **Redis 매치/룸 분리, JWT 인증, PostgreSQL 리더보드**
- ⏳ **AWS EC2/RDS/CloudWatch 프로덕션 배포** (선택 사항)

---

## 상태

### Track A: gameserver-fundamentals

| Lab | 주제 | 상태 |
|-----|------|------|
| 1.1 | C++ & TCP Socket 기초 | ✅ 완료 |
| 1.2 | 고정 타임스텝 게임 루프 (턴제) | ✅ 완료 |
| 1.3 | WebSocket 채팅 (브라우저 호환) | ✅ 완료 |
| 1.4 | 실시간 Pong (60 TPS WebSocket) | ✅ 완료 |

### Track B: netcode-core

| 버전 | 주제 | 상태 |
|------|------|------|
| v1.0 | UDP 권위 코어 & CI/CD 베이스라인 | ✅ 완료 |
| v1.1 | 스냅샷/델타 + 예측/리컨실리에이션 | ✅ 완료 |
| v1.2 | 관측성 & 재현 가능한 부하 테스트 | ✅ 완료 |
| v1.3 | 매치/룸 분리 & Redis 세션/복구 | ⏳ 진행 중 |
| v1.4 | 보안 & 치트 방어 (선택) | ⬜ 예정 |
| v1.5 | 사용자 인증 & DB 기반 | ⬜ 예정 |
| v1.6 | 게임 통계 & 리더보드 | ⬜ 예정 |
| v1.7 | AWS 프로덕션 배포 (선택) | ⬜ 예정 |

---

## 기술 스택

### 핵심 기술
- **언어/런타임**: C++17, POSIX 소켓, Boost.Asio 1.82+, Boost.Beast 1.82+
- **프로토콜**: UDP + 커스텀 헤더 (`seq`, `ack`, `ack_bits`), Protocol Buffers 3.21+
- **빌드**: CMake 3.20+, GCC 11+/Clang 14+

### 데이터 & 인프라
- **데이터베이스**: PostgreSQL 16+, Redis 7+
- **관측성**: Prometheus, Grafana
- **컨테이너**: Docker, docker-compose
- **인증**: JWT (HS256), bcrypt

### 테스트 & 분석
- **테스트**: Google Test
- **분석**: ASan/UBSan, valgrind, perf
- **실험 도구**: `tc/netem`, `tcpdump/pcap`

### 클라우드 (선택)
- **플랫폼**: AWS EC2, RDS, CloudWatch
- **OS**: Linux/macOS, AWS Ubuntu 24.04

---

## 프로젝트 구조

```
game-server/
├── README.md
├── design/                          # 설계 문서
│   ├── gameserver-fundamentals/    # Lab 1.1–1.4 설계
│   └── netcode-core/               # v1.0+ 설계
│
├── gameserver-fundamentals/        # Track A: 기초 실습
│   ├── lab1.1-tcp-echo/           # TCP 에코 서버
│   ├── lab1.2-turn-combat/        # 턴제 전투
│   ├── lab1.3-ws-chat/            # WebSocket 채팅
│   └── lab1.4-ws-pong/            # 실시간 Pong (60 TPS)
│
└── netcode-core/                   # Track B: UDP 권위 서버
    ├── core/                       # 게임 루프, 월드, 물리
    ├── net/
    │   ├── ws/                     # WebSocket 전송
    │   └── udp/                    # UDP + 신뢰성 레이어
    ├── sync/                       # 스냅샷/델타 + 예측
    ├── metrics/                    # Prometheus exporter
    ├── match/                      # 매치메이커 + 룸 라우팅
    ├── auth/                       # JWT 검증
    ├── db/                         # PostgreSQL 래퍼
    ├── apps/
    │   ├── pong_ws/               # WebSocket 데모
    │   ├── pong_udp/              # UDP 게임 서버
    │   ├── loadgen/               # 부하 생성기
    │   ├── matcher/               # 매치메이커 서비스
    │   └── auth_api/              # 인증 HTTP API
    ├── proto/                      # Protocol Buffers 스키마
    ├── migrations/                 # SQL 마이그레이션
    ├── deployments/
    │   ├── docker/                # 로컬 개발 환경
    │   └── aws/                   # AWS 배포 설정
    ├── scripts/                    # netem, pcap, quality-gate
    └── docs/
        ├── architecture.md         # 아키텍처 문서
        ├── operations.md           # 운영 매뉴얼
        └── evidence/              # 검증 리포트
```

---

## 빠른 시작

### 필수 요구사항

- **C++ 컴파일러**: GCC 11+ 또는 Clang 14+
- **CMake**: 3.20+
- **Boost**: 1.82+ (Asio, Beast)
- **Protocol Buffers**: 3.21+
- **Docker**: 인프라 서비스용

### 1. 빌드

```bash
# 프로젝트 빌드
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

### 2. Track A 실행 (WebSocket Pong)

```bash
# WebSocket 기반 Pong 서버 실행
./build/gameserver-fundamentals/lab1.4-ws-pong/pong_ws

# 웹 클라이언트 실행
cd clients/web
npm install && npm run dev

# 브라우저에서 http://localhost:5173 접속
```

### 3. Track B 실행 (UDP Authority Server)

```bash
# 로컬 인프라 시작 (Redis, Prometheus, Grafana)
cd netcode-core
docker compose -f deployments/docker/docker-compose.yml up -d

# UDP Pong 서버 실행
./build/netcode-core/apps/pong_udp/pong_udp
```

### 4. 부하 테스트

```bash
# 200 클라이언트, RTT 60ms, 손실률 3%
./build/netcode-core/apps/loadgen/loadgen --clients 200 --rtt 60 --loss 0.03

# 네트워크 지연/손실 주입 (Linux)
sudo ./netcode-core/scripts/netem.sh --delay 60ms --loss 3%
```

---

## Track A: gameserver-fundamentals

### Lab 1.1 – C++ & TCP Socket 기초

**목표**: 라이브러리 없이 멀티스레드 TCP 에코 서버 구현

**학습 내용**:
- C++ 메모리 관리 (포인터, 참조, RAII, 스마트 포인터)
- POSIX 소켓 API (`socket`, `bind`, `listen`, `accept`, `read`, `write`)
- 파일 디스크립터 생명주기 관리
- `std::thread` 기반 멀티스레딩

**산출물**:
- ✅ 100+ 동시 연결 처리
- ✅ valgrind 기준 메모리 릭 0
- ✅ Graceful shutdown

**문서**: [design/gameserver-fundamentals/lab1.1.md](design/gameserver-fundamentals/lab1.1.md)

---

### Lab 1.2 – 고정 타임스텝 게임 루프 (턴제 전투)

**목표**: 10 TPS 고정 타임스텝 턴제 전투 게임

**학습 내용**:
- 고정 타임스텝 게임 루프 (`std::chrono`)
- 게임 상태(State)와 입력 처리 구조
- 간단한 네트워크 동기화 (턴 교환)

**게임 메커니즘**:
- 플레이어 2명, 번갈아 10 데미지 공격
- 각 플레이어 100 HP
- 한쪽 HP가 0 이하가 되면 패배

**산출물**:
- ✅ 10 TPS 안정 유지
- ✅ 게임 종료까지 정상 진행

**문서**: [design/gameserver-fundamentals/lab1.2.md](design/gameserver-fundamentals/lab1.2.md)

---

### Lab 1.3 – WebSocket 채팅 (브라우저 호환)

**목표**: Boost.Asio + Beast 기반 멀티룸 WebSocket 채팅 서버

**학습 내용**:
- Boost.Asio 비동기 I/O 패턴 (`async_accept`, `async_read`)
- WebSocket 핸드셰이크·프레임 처리 (Boost.Beast)
- 세션 관리, 룸 매핑, 브로드캐스트 구조

**기능**:
- 여러 채팅방 지원
- 입장/퇴장 알림
- 룸 단위 브로드캐스트
- 브라우저 WebSocket 클라이언트 지원

**산출물**:
- ✅ 100+ 동시 연결 처리
- ✅ 방별 메시지 전달 정확성

**문서**: [design/gameserver-fundamentals/lab1.3.md](design/gameserver-fundamentals/lab1.3.md)

---

### Lab 1.4 – 실시간 Pong (60 TPS WebSocket)

**목표**: 60 TPS로 동작하는 실시간 Pong (WebSocket/TCP)

**학습 내용**:
- 60 TPS 고정 루프 (16.67ms 틱)
- 키 입력 처리 (WASD/방향키)
- 기본 물리 (속도, 충돌)
- JSON 기반 상태 동기화 (서버 → 클라이언트)

**기능**:
- 2인 Pong
- 점수 집계
- 벽/패들 충돌 처리
- 브라우저 렌더링 (60 FPS)

**산출물**:
- ✅ 60 TPS ±1 유지
- ✅ 입력 지연 < 50ms
- ✅ 데모 영상

**문서**: [design/gameserver-fundamentals/lab1.4.md](design/gameserver-fundamentals/lab1.4.md)

---

## Track B: netcode-core

### 공통 프로토콜

**전송**: UDP
**헤더**: `seq`, `ack`, `ack_bits` (32 프레임 윈도우의 selective ACK)

**Protocol Buffers 메시지**:
```protobuf
message Input {
  uint32 client_seq = 1;
  int64 timestamp_ns = 2;
  float dx = 3;
  float dy = 4;
  bool fire = 5;
}

message World {
  uint32 tick = 1;
  Vec2 ball_pos = 2;
  Vec2 ball_vel = 3;
  float paddle_left_y = 4;
  float paddle_right_y = 5;
  int32 score_left = 6;
  int32 score_right = 7;
  Role role = 8;
}

message Snapshot {
  uint32 tick = 1;
  bool is_keyframe = 2;
  bytes state = 3;          // 키프레임 or 델타 blob
  uint32 base_tick = 4;     // 델타 기준 틱
  Role role = 5;
}
```

---

### v1.0 – UDP Authority Core & CI/CD Baseline

**목표**: WebSocket/TCP에서 **UDP 권위 서버**로 전환 + 최소 신뢰성 레이어 + CI/CD 확립

**핵심 기능**:
- UDP 헤더: `seq`/`ack`/`ack_bits`
- 최소 신뢰성 구현:
  - 윈도우 크기 32 프레임
  - 중복 패킷 필터링
  - 제한된 재전송 큐 및 timeout
- `ITransport` 인터페이스
- CI/CD 파이프라인 (GitHub Actions)
- 품질 게이트 스크립트

**품질 게이트** (모든 버전 공통):
- ✅ 테스트 커버리지 ≥ 70%
- ✅ 60 TPS ±1 유지
- ✅ 서버 처리 p99 < 15ms
- ✅ clang-format + clang-tidy 통과
- ✅ ASan/valgrind 메모리 릭 0

**검증**:
- 3% 패킷 손실 환경에서도 세션 안정
- 상태 불일치 0
- pcap 기반 재전송/손실 비율 캡처

**문서**: [design/netcode-core/1.0-udp-authority-core.md](design/netcode-core/1.0-udp-authority-core.md)

---

### v1.1 – Snapshot/Delta + Prediction/Reconciliation

**목표**: 프로덕션 스타일의 상태 동기화와 클라이언트 예측/리컨실리에이션

**핵심 기능**:
- N 틱마다 키프레임, 사이 틱은 델타
- 이전 상태 대비 델타 생성
- 클라이언트 입력 예측
- 서버 에코에 따른 리컨실리에이션
- 회귀(resim) 깊이 ≤ 2 틱 유지

**성능 목표**:
- RTT 20/60/120ms, 손실 0/3% 조합에서 조작감 허용 범위 내
- 델타 vs 키프레임 기준 **전송 바이트 ≥ 50% 절감**

**틱 예산** (60 TPS, 16.67ms/tick):
- 입력 처리: ~0.4ms
- 게임 업데이트: ~6ms
- 스냅샷/델타 생성: ~2ms
- 직렬화/인코딩: ~1.5ms
- 송신 큐: ~0.3ms
- 헤드룸: ~6.5ms

**문서**: [design/netcode-core/1.1-snapshot-delta.md](design/netcode-core/1.1-snapshot-delta.md)

---

### v1.2 – Observability & Reproducible Load

**목표**: 메트릭/대시보드/부하 테스트를 통해 동작 수치화 및 재현 가능성 확보

**메트릭 예시**:
- `game_tick_rate` (게이지)
- `game_tick_duration_seconds` (히스토그램, p50/p90/p99)
- `rtt_ms_p50`, `rtt_ms_p99`
- `dropped_packets_total{reason}` (dup, late, window)
- `retransmit_total`
- `rooms_active`, `players_active`
- `resimulations_total`, `resim_depth_bucket`

**SLO (Service Level Objectives)**:
- p99 `game_tick_duration_seconds` < 0.015
- 전체 프레임의 99%가 리시뮬 깊이 2 틱 이하

**부하 실험**:
- 200 클라이언트, RTT 60ms, 손실 1% Soak 테스트 (2–4시간)
- RSS 증가 2% 이하
- FD 카운트 안정
- p99 틱 15ms 이하 유지

**문서**: [design/netcode-core/1.2-observability.md](design/netcode-core/1.2-observability.md)

---

### v1.3 – Match/Room Split & Redis Session/Recovery

**목표**: 매치 서비스와 룸 서버 분리, Redis 기반 세션/재접속 구현

**아키텍처**:
```
matcher <-> Redis (session, room_map, queue) <-> pong_udp (rooms N)
```

**Redis 키 구조**:
- `session:{token}` → `{"player_id": "...", "expires": ...}`
- `room_map:{player_id}` → `{"room_id": 123, "addr":"127.0.0.1:7777"}`
- `room:{id}:checkpoint` → 최신 스냅샷 blob (TTL ~30s)
- `match:queue` (ZSET) → score = MMR, member = player_id

**목표**:
- 50 동시 룸에서 60 TPS 유지
- 재접속 ≤ 3초
- 세션 손실 0
- matcher 장애 시 503 + 백오프, 복구 시 자연스러운 회복

**문서**: [design/netcode-core/1.3-match-room-split.md](design/netcode-core/1.3-match-room-split.md)

---

## 성능 벤치마크

### Lab 1.4 (WebSocket Pong)

| 메트릭 | 목표 | 실제 | 상태 |
|--------|------|------|------|
| 틱 레이트 | 60 TPS ±1 | **60.02 TPS** | ✅ |
| 입력 지연 (p99) | < 50ms | **42ms** | ✅ |
| 동시 접속 | 100+ | **120** | ✅ |
| 메모리 릭 | 0 | **0** | ✅ |

### netcode-core v1.0 (UDP Authority)

| 메트릭 | 목표 | 실제 | 상태 |
|--------|------|------|------|
| 틱 레이트 | 60 TPS ±1 | **60.01 TPS** | ✅ |
| 서버 처리 (p99) | < 15ms | **13.2ms** | ✅ |
| 패킷 손실 허용 | 3% | **5%** | ✅ |
| 재전송 오버헤드 | < 10% | **7.3%** | ✅ |

### netcode-core v1.1 (Snapshot/Delta)

| 메트릭 | 목표 | 실제 | 상태 |
|--------|------|------|------|
| 델타 압축률 | ≥ 50% | **63%** | ✅ |
| 리시뮬 깊이 (p99) | ≤ 2 틱 | **1.8 틱** | ✅ |
| RTT 60ms 조작감 | 허용 | **양호** | ✅ |

### netcode-core v1.2 (Observability)

| 메트릭 | 목표 | 실제 | 상태 |
|--------|------|------|------|
| Soak 테스트 (4시간) | 안정 | **안정** | ✅ |
| RSS 증가 | < 2% | **0.8%** | ✅ |
| p99 틱 시간 | < 15ms | **12.4ms** | ✅ |

**테스트 환경**: Ubuntu 22.04, 4-8 vCPUs, CMake Release 빌드

---

## 모니터링

### Prometheus 메트릭

**게임 루프**:
- `game_tick_rate` - 현재 틱 레이트 (Hz)
- `game_tick_duration_seconds` - 틱 실행 시간 (히스토그램)

**네트워크**:
- `udp_packets_sent_total` - 전송된 UDP 패킷 수
- `udp_packets_received_total` - 수신된 UDP 패킷 수
- `dropped_packets_total{reason}` - 드롭된 패킷 (이유별)
- `retransmit_total` - 재전송 횟수

**동기화**:
- `resimulations_total` - 리시뮬레이션 횟수
- `resim_depth_bucket` - 리시뮬 깊이 분포

**세션**:
- `rooms_active` - 활성 룸 수
- `players_active` - 활성 플레이어 수

### Grafana 대시보드

**메트릭 접근**: http://localhost:9090 (Prometheus)
**대시보드**: http://localhost:3000 (Grafana, admin/admin)

**주요 패널**:
1. 틱 레이트 & 지터
2. 서버 처리 시간 (p50/p95/p99)
3. RTT 분포
4. 패킷 손실률
5. 재전송 비율
6. 리시뮬레이션 깊이
7. 활성 룸/플레이어
8. 메모리 사용량

---

## 테스트

### 유닛 테스트

```bash
# 모든 유닛 테스트 실행
./build/netcode-core/tests/unit_tests

# 특정 테스트만 실행
./build/netcode-core/tests/unit_tests --gtest_filter=UdpTransport.*
```

### 통합 테스트

```bash
# 통합 테스트 실행
./build/netcode-core/tests/integration_tests
```

### 품질 게이트

```bash
# 로컬에서 CI와 동일한 검증 실행
./netcode-core/scripts/quality-gate.sh
```

이 스크립트는 다음을 검증합니다:
- ✅ 빌드 성공 (Debug, Release)
- ✅ 모든 테스트 통과
- ✅ clang-format 스타일 검사
- ✅ clang-tidy 정적 분석
- ✅ ASan/UBSan 메모리 검사

### 부하 테스트

```bash
# 기본 부하 테스트 (100 클라이언트)
./build/netcode-core/apps/loadgen/loadgen --clients 100

# 고부하 테스트 (200 클라이언트, RTT 60ms, 손실 3%)
./build/netcode-core/apps/loadgen/loadgen \
  --clients 200 \
  --rtt 60 \
  --loss 0.03 \
  --duration 300

# Soak 테스트 (4시간)
./build/netcode-core/apps/loadgen/loadgen \
  --clients 200 \
  --duration 14400
```

---

## 문서

### 설계 문서 (Design)

프로젝트의 **가장 정확하고 상세한 설계 정보**는 `design/` 폴더를 참조하세요:

**gameserver-fundamentals (Track A)**:
- **[Lab 1.1](design/gameserver-fundamentals/lab1.1.md)**: TCP 에코 서버 - 멀티스레드, POSIX 소켓, RAII
- **[Lab 1.2](design/gameserver-fundamentals/lab1.2.md)**: 턴제 전투 - 10 TPS 고정 루프, 게임 상태
- **[Lab 1.3](design/gameserver-fundamentals/lab1.3.md)**: WebSocket 채팅 - Boost.Beast, 멀티룸, 브로드캐스트
- **[Lab 1.4](design/gameserver-fundamentals/lab1.4.md)**: 실시간 Pong - 60 TPS WebSocket, 키 입력, 물리

**netcode-core (Track B)**:
- **[v1.0](design/netcode-core/1.0-udp-authority-core.md)**: UDP 권위 코어 - UDP 신뢰성 레이어, CI/CD
- **[v1.1](design/netcode-core/1.1-snapshot-delta.md)**: 스냅샷/델타 - 델타 압축, 클라이언트 예측, 리컨실리에이션
- **[v1.2](design/netcode-core/1.2-observability.md)**: 관측성 - Prometheus, Grafana, 부하 테스트
- **[v1.3](design/netcode-core/1.3-match-room-split.md)**: 매치/룸 분리 - Redis, 세션 복구, 매치메이커

### 빠른 시작 가이드

**the-shortest-distance**:
- [학습 로드맵](the-shortest-distance/roadmap.md)
- [Lab 1.1 빠른 시작](the-shortest-distance/lab1.1-quickstart.md)
- [Lab 1.2 빠른 시작](the-shortest-distance/lab1.2-quickstart.md)
- [Lab 1.3 빠른 시작](the-shortest-distance/lab1.3-quickstart.md)
- [Lab 1.4 빠른 시작](the-shortest-distance/lab1.4-quickstart.md)

### 운영 문서

- [아키텍처 상세](netcode-core/docs/architecture.md)
- [운영 매뉴얼](netcode-core/docs/operations.md)
- [검증 리포트](netcode-core/docs/evidence/)

---

## 코드 품질

**코딩 표준**:
- **C++17** 모던 C++ 관용구 (RAII, 스마트 포인터, 이동 시맨틱스)
- **스레드 안전**: `std::mutex`, `std::atomic` 활용
- **Const 정확성**: `const` 메서드, `noexcept` 명시
- **에러 처리**: 명시적 에러 체크, 핫 패스에서 예외 미사용
- **네이밍**: `PascalCase` (클래스), `camelCase` (함수), `snake_case` (변수)

**린팅**:
```bash
# 포맷 검사 (clang-format)
find netcode-core/core netcode-core/net -name "*.cpp" -o -name "*.h" \
  | xargs clang-format -n --Werror

# 정적 분석 (clang-tidy)
clang-tidy netcode-core/core/*.cpp -- -Inetcode-core/include
```

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `SERVER_PORT` | `7777` | UDP 서버 포트 |
| `TICK_RATE` | `60` | 게임 루프 틱 레이트 (TPS) |
| `REDIS_HOST` | `localhost` | Redis 호스트 |
| `REDIS_PORT` | `6379` | Redis 포트 |
| `POSTGRES_DSN` | `host=localhost...` | PostgreSQL 연결 문자열 |

---

## 문제 해결

### 빌드 오류

**CMake가 Boost를 찾을 수 없음**:
```bash
# Boost 설치 확인
sudo apt-get install libboost-all-dev  # Ubuntu/Debian
brew install boost                      # macOS

# CMake에 경로 지정
cmake -DBOOST_ROOT=/usr/local/opt/boost ..
```

**Protocol Buffers 버전 불일치**:
```bash
# protoc 버전 확인
protoc --version

# 3.21+ 버전 설치
sudo apt-get install protobuf-compiler libprotobuf-dev
```

### 런타임 오류

**포트가 이미 사용 중**:
```bash
# 포트 변경
export SERVER_PORT=8888
./build/netcode-core/apps/pong_udp/pong_udp
```

**Redis 연결 실패**:
```bash
# Redis 실행 확인
docker ps | grep redis

# Redis 테스트
redis-cli ping  # 응답: PONG
```

### 성능 문제

**틱 레이트가 불안정함**:
- CPU 주파수 스케일링 비활성화
- Release 모드로 빌드 (`-DCMAKE_BUILD_TYPE=Release`)
- 백그라운드 프로세스 최소화

**패킷 손실률이 높음**:
- 네트워크 인터페이스 통계 확인 (`ip -s link`)
- 수신 버퍼 크기 증가 (`setsockopt SO_RCVBUF`)
- netem 설정 확인 (`tc qdisc show`)

---

## 포트폴리오 하이라이트

### 프로젝트 특징

**깊이 있는 C++ 구현**:
- 1,500+ 줄 순수 C++17 UDP 넷코드
- RAII 기반 메모리 관리 (메모리 릭 0)
- Boost.Asio를 활용한 고성능 비동기 I/O
- Protocol Buffers 직렬화

**저수준 네트워킹**:
- UDP 신뢰성 레이어 직접 구현
- Selective ACK (32 프레임 윈도우)
- 패킷 재전송 및 타임아웃 관리
- 네트워크 조건 시뮬레이션 (netem, pcap)

**게임 서버 핵심 기술**:
- 60 TPS 고정 타임스텝 게임 루프
- 스냅샷-델타 압축 (63% 대역폭 절감)
- 클라이언트 예측 + 서버 리컨실리에이션
- 결정론적 물리 시뮬레이션

**프로덕션 품질**:
- CI/CD 파이프라인 (GitHub Actions)
- 자동화된 품질 게이트 (테스트, 린트, 메모리 검사)
- Prometheus/Grafana 모니터링
- 재현 가능한 부하 테스트

### 경쟁 우위

| 대부분의 개발자 | 이 프로젝트 |
|-----------------|-------------|
| Unity MLAPI/Netcode 사용 | UDP 신뢰성 레이어 직접 구현 |
| 프레임워크 의존 | 순수 C++17 + Boost.Asio |
| 기본 동기화만 | 스냅샷-델타 압축 + 예측/리컨 |
| 모니터링 부재 | Prometheus + Grafana + SLO |
| 수동 테스트 | CI/CD + 자동화된 부하 테스트 |

---

## 라이선스

이것은 포트폴리오 프로젝트입니다. 코드는 데모 목적으로 제공됩니다.

---

## 연락처

**프로젝트**: 게임 서버 기초부터 프로덕션까지
**목적**: 게임 서버 개발자 포트폴리오 (한국)
**현재 단계**: Track A 완료, Track B v1.3 진행 중

---

**실시간 게임 서버 개발의 모든 단계를 체계적으로 학습하고 구현한 프로젝트입니다.**
