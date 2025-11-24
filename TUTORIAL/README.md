# Portfolio Tutorial Collection

> **목적**: 4개 포트폴리오 프로젝트 구현에 필요한 최소한의 핵심 지식
> **특징**: 별도 참조 없이 독립적으로 학습 가능한 고품질 튜토리얼
> **범위**: 실제 프로젝트에서 사용하는 기술만 엄선

---

## 📚 튜토리얼 구조

각 튜토리얼은 다음 구조를 따릅니다:

1. **개념 설명**: 왜 필요한지, 핵심 원리
2. **실전 예제**: 복사-붙여넣기 가능한 코드
3. **단계별 구현**: 0에서 동작하는 상태까지
4. **트러블슈팅**: 흔한 오류와 해결책
5. **프로젝트 연결**: 실제 포트폴리오에서의 활용

---

## 🗺️ 학습 경로

### 공통 기초 (모든 프로젝트)

| 튜토리얼 | 내용 | 예상 시간 | 적용 프로젝트 |
|---------|------|----------|------------|
| [T01](./T01-js-ts-core.md) | **JS/TS 코어** - ES6+, TypeScript 기본 | 8-12시간 | 전체 |

### Node.js / Backend 경로

| 튜토리얼 | 내용 | 예상 시간 | 적용 프로젝트 |
|---------|------|----------|------------|
| [T02](./T02-node-http-ffmpeg.md) | **Node HTTP + ffmpeg** - 파일 업로드, CLI 실행 | 6-8시간 | video-editor v1.x |
| [T03](./T03-nest-bootstrap.md) | **NestJS 기본** - 모듈/컨트롤러/서비스, Prisma | 10-15시간 | backend/node.js N2.0 |
| [T04](./T04-db-redis-websocket.md) | **DB + Redis + WebSocket** - PostgreSQL, 캐시, 실시간 | 15-20시간 | video-editor v1.3, N2.1-2.3 |
| [T05](./T05-advanced-backend.md) | **고급 백엔드** - Elasticsearch, Kafka, RBAC | 20-25시간 | backend/node.js N2.3-2.5 |

### React / Frontend 경로

| 튜토리얼 | 내용 | 예상 시간 | 적용 프로젝트 |
|---------|------|----------|------------|
| [T06](./T06-react-vite-basics.md) | **React/Vite 기본** - 컴포넌트, 라우팅, 레이아웃 | 8-12시간 | frontend/react M1 |
| [T07](./T07-react-query-forms.md) | **React Query + 폼** - 서버 상태, 검증 | 12-15시간 | frontend/react M2-M3 |
| [T08](./T08-stats-search-optimization.md) | **통계/검색/최적화** - 차트, API 통합, 성능 | 10-15시간 | frontend/react M4-M5 |
| [T09](./T09-testing-accessibility.md) | **테스트 + 접근성** - Vitest, Playwright, a11y | 12-18시간 | frontend/react M6 |

### C++ / Game Server / Native 경로

| 튜토리얼 | 내용 | 예상 시간 | 적용 프로젝트 |
|---------|------|----------|------------|
| [T10](./T10-cpp-raii-tcp.md) | **Modern C++17 + TCP** - RAII, 소켓, 스레드 | 15-20시간 | game-server lab1.1-1.2 |
| [T11](./T11-asio-websocket-gameloop.md) | **Asio + WebSocket + 게임 루프** - 비동기 IO, 틱 | 18-25시간 | game-server lab1.3-1.4 |
| [T11-2](./T11-2-udp-netcode.md) | **UDP 넷코드** - 신뢰성, 예측, 리컨실리에이션 | 25-35시간 | game-server lab1.5-1.6 |
| [T12](./T12-node-api-ffmpeg.md) | **Node-API + FFmpeg C API** - Native addon, 바인딩 | 20-30시간 | video-editor v2.x |

### DevOps / 배포 경로

| 튜토리얼 | 내용 | 예상 시간 | 적용 프로젝트 |
|---------|------|----------|------------|
| [T13](./T13-docker-deployment.md) | **Docker + 배포** - 컨테이너화, 모니터링, CI/CD | 12-18시간 | 전체 프로젝트 |

---

## 🎯 추천 학습 순서

### 1. 풀스택 개발자 (React + Node.js)
```
T01 → T02 → T06 → T03 → T04 → T07 → T05 → T08 → T13 → T09
```
**총 예상 시간**: 120-160시간

### 2. 백엔드 개발자 (Node.js)
```
T01 → T03 → T04 → T05 → T13
```
**총 예상 시간**: 70-95시간

### 3. 게임 서버 개발자 (C++)
```
T01 → T10 → T11 → T11-2 → T13
```
**총 예상 시간**: 80-110시간

### 4. 멀티미디어 개발자 (C++ + Node.js)
```
T01 → T02 → T10 → T12 → T13
```
**총 예상 시간**: 70-100시간

---

## 🔥 빠른 시작 가이드

### 프로젝트별 최소 필수 튜토리얼

#### video-editor
- **v1.x (ffmpeg CLI)**: T01, T02, T04 (일부)
- **v2.x (Native addon)**: 위 + T10, T12
- **v3.0 (프로덕션)**: 위 + T13

#### backend/node.js (NestJS)
- **N2.0-2.2 (CRUD + JWT)**: T01, T03, T04
- **N2.3-2.5 (고급 패턴)**: 위 + T05

#### frontend/react
- **M1-M3 (CRUD UI)**: T01, T06, T07
- **M4-M6 (고급 기능)**: 위 + T08, T09

#### game-server
- **lab1.1-1.4 (TCP/WS)**: T01, T10, T11
- **lab1.5-1.6 (UDP 넷코드)**: 위 + T11-2

---

## 💡 사용 팁

### 1. 순차적 vs 병렬 학습
- **순차적 권장**: T01 → T02/T03/T06/T10 중 하나 선택 → 깊이 우선 탐색
- **병렬 가능**: 프론트(T06-T09)와 백엔드(T03-T05) 동시 진행
- **비권장**: C++ (T10-T12)와 다른 트랙 병렬 (인지 부하 높음)

### 2. 예제 코드 활용
```bash
# 각 튜토리얼 디렉터리에 examples/ 폴더 포함
cd TUTORIAL/T03-nest-bootstrap/examples/
npm install
npm run dev
```

### 3. 트러블슈팅 우선 확인
- 에러 발생 시 각 튜토리얼의 "트러블슈팅" 섹션 먼저 확인
- 90% 이상의 흔한 오류와 해결책 포함

### 4. 프로젝트 연결
- 각 튜토리얼 끝에 "실제 프로젝트 적용" 섹션
- 예: T04 → video-editor v1.3 WebSocket 진행률 구현

---

## 📖 튜토리얼 상세 목차

### [T01: JavaScript/TypeScript 코어](./T01-js-ts-core.md)
- ES6+ 필수 문법 (const/let, arrow function, destructuring, spread/rest)
- Promise, async/await, 에러 핸들링
- TypeScript 타입 시스템 (기본 타입, 인터페이스, 제네릭)
- 타입 좁히기, 유니온/인터섹션
- 모듈 시스템 (import/export)

### [T02: Node.js HTTP + ffmpeg CLI](./T02-node-http-ffmpeg.md)
- Node.js 코어 모듈 (fs, path, child_process)
- Express/Fastify HTTP 서버 기본
- 파일 업로드 (multer/busboy)
- ffmpeg CLI 명령어 (trim, split, 속도 조절, 자막)
- 프로세스 관리 및 에러 핸들링

### [T03: NestJS 기본 뼈대](./T03-nest-bootstrap.md)
- NestJS 아키텍처 (모듈, 컨트롤러, 서비스)
- Dependency Injection
- @nestjs/config 환경 설정
- Prisma ORM + SQLite 연동
- 마이그레이션, Seed 데이터
- GitHub Actions CI 기본

### [T04: DB + Redis + WebSocket 패턴](./T04-db-redis-websocket.md)
- PostgreSQL 기본 SQL (SELECT, JOIN, INDEX)
- Prisma + PostgreSQL 연결
- Redis 기본 (key/value, TTL, 캐시 패턴)
- WebSocket 서버/클라이언트 (ws/socket.io)
- 실시간 진행률 업데이트 패턴
- 트랜잭션 및 롤백

### [T05: 고급 백엔드 패턴](./T05-advanced-backend.md)
- Elasticsearch 기본 (인덱스, 매핑, 검색 쿼리)
- Kafka (producer, consumer, at-least-once)
- @nestjs/schedule 스케줄러
- 배치 작업, 통계 집계
- RBAC (Role-Based Access Control)
- 외부 API 통합, retry 로직

### [T06: React/Vite 기본 + 라우팅/레이아웃](./T06-react-vite-basics.md)
- Vite 프로젝트 셋업
- React 컴포넌트 (함수형, JSX)
- React Router v6 (라우팅, 중첩 레이아웃)
- useState, useEffect 훅
- Props, 컴포넌트 합성
- CSS-in-JS (styled-components/Tailwind)

### [T07: React Query + Axios + 폼](./T07-react-query-forms.md)
- React Query 기본 (useQuery, useMutation, staleTime)
- Axios 인스턴스, 인터셉터
- react-hook-form + zod 검증
- 에러 핸들링, 로딩 상태
- 낙관적 업데이트 (optimistic update)

### [T08: 통계/검색 + URL 동기화 + 최적화](./T08-stats-search-optimization.md)
- 차트 라이브러리 (recharts/chart.js)
- React Query로 통계 API 소비
- useSearchParams, 커스텀 useQueryParams
- React.memo, useMemo, useCallback
- 렌더링 최적화, 프로파일링

### [T09: 테스트 + 접근성](./T09-testing-accessibility.md)
- Vitest + React Testing Library
- 컴포넌트 단위 테스트
- Playwright E2E 테스트
- WCAG 2.1 기본 원칙
- aria-* 속성, 키보드 내비게이션
- axe-core 자동화 도구

### [T10: Modern C++17 + RAII + TCP 소켓](./T10-cpp-raii-tcp.md)
- Modern C++17 문법 (auto, lambda, move)
- RAII 패턴, smart pointer (unique_ptr, shared_ptr)
- std::thread, mutex, lock_guard
- POSIX TCP 소켓 (bind, listen, accept, send/recv)
- 간단한 에코 서버 구현
- 패킷 직렬화/역직렬화 기초

### [T11: Boost.Asio + WebSocket + 게임 루프](./T11-asio-websocket-gameloop.md)
- boost.asio 기본 (io_context, async_accept)
- boost.beast WebSocket
- 세션/룸 관리 패턴
- 고정 타임스텝 게임 루프
- 브로드캐스트, 상태 동기화
- Pong 게임 서버 구현

### [T11-2: UDP 넷코드 + 권위 서버](./T11-2-udp-netcode.md)
- UDP 소켓 (bind, sendto/recvfrom)
- 신뢰성 계층 (seq, ack, ack_bits)
- 권위 서버 패턴
- 스냅샷/델타 동기화
- 클라이언트 예측 (Client-side Prediction)
- 서버 리컨실리에이션 (Server Reconciliation)
- 엔티티 보간 (Entity Interpolation)
- 60 TPS 안정화, 부하 테스트

### [T12: Node-API + FFmpeg C API](./T12-node-api-ffmpeg.md)
- Node-API (N-API) 기본 구조
- C++ 모듈 빌드 (node-gyp, CMake.js)
- JS <-> C++ 타입 변환
- FFmpeg C API (AVFormatContext, AVCodecContext)
- 메타데이터 추출, 썸네일 생성
- 메모리 관리, RAII 래퍼
- 에러 핸들링, 디버깅

### [T13: Docker + 배포 + 모니터링](./T13-docker-deployment.md)
- Dockerfile 작성 (multi-stage build)
- docker-compose (서비스 오케스트레이션)
- Nginx reverse proxy + SSL
- Prometheus 메트릭 수집
- Grafana 대시보드 구축
- GitHub Actions CI/CD
- 로그 구조화 (winston, pino)

---

## 🚀 프로젝트 실전 매핑

### video-editor 프로젝트
```
v1.0 (업로드/인프라) → T01, T02
v1.1 (Trim/Split)    → T02 심화
v1.2 (자막/배속)     → T02 심화
v1.3 (WebSocket)     → T04
v2.0 (Native addon)  → T10, T12
v2.3 (모니터링)      → T13
v3.0 (프로덕션)      → T13 심화
```

### backend/node.js 프로젝트
```
N2.0 (Bootstrap)    → T01, T03
N2.1 (CRUD + JWT)   → T03, T04
N2.2 (팀/RBAC)      → T04, T05
N2.3 (통계/캐시)    → T04, T05
N2.4 (검색)         → T05
N2.5 (Kafka 이벤트) → T05
```

### frontend/react 프로젝트
```
M1 (레이아웃/라우팅)  → T01, T06
M2 (Issue CRUD)     → T06, T07
M3 (로그인/팀)      → T07
M4 (통계 대시보드)   → T08
M5 (검색 UI)        → T08
M6 (테스트/a11y)    → T09
```

### game-server 프로젝트
```
lab1.1 (TCP 에코)       → T01, T10
lab1.2 (턴제 전투)      → T10
lab1.3 (WS 채팅)        → T11
lab1.4 (Pong 서버)      → T11
lab1.5 (UDP 신뢰성)     → T11-2
lab1.6 (넷코드 완성)    → T11-2 심화
```

---

## 📊 난이도 및 선행 요구사항

| 레벨 | 튜토리얼 | 선행 요구사항 |
|-----|---------|-------------|
| 🟢 **기초** | T01, T02, T06 | 프로그래밍 기본 지식 |
| 🟡 **중급** | T03, T04, T07, T13 | 기초 레벨 완료 |
| 🟠 **고급** | T05, T08, T09, T10, T11 | 중급 레벨 완료 |
| 🔴 **전문가** | T11-2, T12 | 고급 레벨 + 관련 도메인 지식 |

---

## 🛠️ 개발 환경 요구사항

### 공통
- **OS**: macOS, Linux (WSL2 for Windows)
- **Node.js**: 20.x LTS
- **Package Manager**: npm 10.x or pnpm 8.x
- **Git**: 2.30+
- **Editor**: VS Code (권장), WebStorm, Neovim

### Node.js / React 트랙
- **TypeScript**: 5.x
- **Database**: PostgreSQL 15+, Redis 7+
- **Docker**: 24.x
- **Tools**: curl, jq, httpie

### C++ 트랙
- **Compiler**: GCC 11+ or Clang 14+
- **Build**: CMake 3.20+
- **Libraries**: boost 1.80+, FFmpeg 6.x
- **Debugger**: gdb, lldb, valgrind
- **Tools**: clang-format, clang-tidy

---

## 📝 학습 로그 템플릿

각 튜토리얼을 완료할 때마다 기록하세요:

```markdown
## T01: JS/TS 코어
- **시작 날짜**: 2024-01-10
- **완료 날짜**: 2024-01-12
- **소요 시간**: 10시간
- **어려웠던 점**: 제네릭 타입 추론
- **해결 방법**: TypeScript 공식 문서 예제 반복 실습
- **다음 단계**: T02 Node HTTP + ffmpeg
```

---

## 🤝 기여 및 피드백

이 튜토리얼 시리즈는 실전 프로젝트 경험을 바탕으로 작성되었습니다.

- **오류 발견**: GitHub Issue 등록
- **개선 제안**: Pull Request 환영
- **질문**: Discussions 활용

---

## 📚 참고 자료 (최소화)

각 튜토리얼 내에서 자급자족 가능하도록 작성되었지만,
심화 학습이 필요한 경우를 위한 최소한의 참고 자료:

- **JavaScript**: MDN Web Docs
- **TypeScript**: Official TypeScript Handbook
- **Node.js**: Node.js Official Docs
- **React**: React Official Docs (Beta)
- **NestJS**: NestJS Official Docs
- **C++**: cppreference.com
- **Boost.Asio**: Boost Official Docs

---

## 🎓 인증 및 포트폴리오 연계

각 튜토리얼을 완료하면:

1. **실전 프로젝트 구현**: 학습한 내용을 바로 포트폴리오 프로젝트에 적용
2. **GitHub 커밋**: 학습 과정을 커밋 히스토리로 증명
3. **기술 블로그**: 각 튜토리얼을 블로그 포스트로 정리 (선택)
4. **면접 준비**: 각 튜토리얼의 "면접 질문" 섹션 활용

**목표**: 튜토리얼 완료 = 해당 기술 스택 면접 대응 가능

---

**Last Updated**: 2024-01-24
**Version**: 1.0.0
**License**: MIT
