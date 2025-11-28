새로 한 판 짜서 줄게.
아래 걸로 `roadmap.md` 통째로 갈아끼우면 된다. 

---

# 비디오 스택 학습·구현 로드맵 (정리본)

## 0. 전체 흐름 한눈에

**큰 단계만 먼저 보면 이렇게 간다:**

1. **전체 그림 파악**

   * video-stack-01 한 번 쭉 읽기

2. **Stage 1 준비 (서버/JS/React 기초)**

   * 서버 internals 4편
   * JS/TS 최소 문법
   * video-stack-02(앞부분), video-stack-03(앞부분)

3. **Stage 1 미니 실습 (/ping, /echo, /videos)**

   * video-stack-02 Node/Express 부분
   * 간단한 백엔드/프론트 실습

4. **v1.0 – basic infrastructure**

   * v1.0 설계 일지
   * video-stack-03 업로드 흐름
   * v1.0 구현

5. **v1.1·1.2·1.3 – FFmpeg CLI + 복잡한 상태**

   * JS/React 고급 패턴
   * FFmpeg CLI 기본, Node ↔ FFmpeg 파이프라인
   * v1.1~1.3 구현

6. **Stage 3 – C++ / FFmpeg C API / 네이티브 애드온**

   * C++ 보완
   * video-stack-04
   * v2.x(native addon) 구현

아래부터는 단계별로 “언제 / 무엇을 / 어떤 순서로”만 딱 정리한다.

---

## 1. 제일 처음 – 전체 지도 한 번 보기

### Step 1-1. video-stack-01-architecture-and-roadma.md

**언제:** 완전 맨 처음 1회.

**읽을 범위:**

* `## 1. 이 문서의 역할`
* `## 2. 최종 목표: 어떤 기능을 만들 것인가`
* `## 3. 전체 아키텍처 한 번에 보기`
* `## 4. Stage별 로드맵 개요`
* `## 5~7 Stage 1/2/3 개요`까지 그냥 쭉

**목적:**

* “이 프로젝트가 어디까지 갈 건지” 전체 지도만 머리에 넣기.
* 세부 내용 이해/암기까지는 신경 안 써도 됨.

---

## 2. Stage 1 준비 – 서버/JS/React 기초

이 단계에서 **“C 서버 dev → JS/React/Node 뇌 전환”**을 한다.

### Step 2-1. 서버 internals 정리

**언제:** video-stack-01 끝낸 직후.

**순서:**

1. `server-internals-01-process-vs-thread.md`

   * 프로세스 vs 스레드, 멀티프로세스/멀티스레드 구조 복습.

2. `server-internals-02-io-model-blocking-nonblocking.md.md`

   * 블로킹/논블로킹, 동기/비동기, select/poll/epoll 개념 정리.

3. `server-internals-03-tcp-socket-kernel-buffer.md.md`

   * TCP 연결, 소켓 FD, 커널 recv/send 버퍼, epoll까지 흐름.

4. `server-internals-04-http-flow-and-rest.md.md`

   * `accept → read → HTTP 파싱 → 라우팅 → 비즈니스 로직 → write → keep-alive`, REST 기본 패턴.

**이후 상태:**

* “Node가 내부적으로 뭘 감추고 있는지”를 감으로 이해하는 수준이면 충분.

---

### Step 2-2. JS/TS 기초 다지기

**언제:** 서버 internals 4편까지 보고나서.

1. `node-basic-01-js-syntax-and-async.md.md`

   * let/const, 함수, 객체/배열, 구조 분해, 스프레드
   * Promise, async/await, 기본 에러 핸들링

2. **video-stack-02-js-ts-node-basics-for-c-dev.md – 1차 읽기 (JS/TS 중심)**

   **이번에 읽는 부분:**

   * `## 0. 전제 / 목표`
   * `## 1. JavaScript vs C – 큰 틀 차이`
   * `## 2. JavaScript에서 조심해야 할 것들`
   * `## 3. 비동기 모델: 이벤트 루프, Promise, async/await`
   * `## 4. TypeScript 기초`
   * * 네가 추가한 **JS/TS 보완 섹션 전체**
       (구조 분해, 스프레드, map/filter/find, null/undefined, narrowing, class, `as`, 에러 타입 등)

   **이번 단계 목표:**

   * TS로 함수/인터페이스/유니온 정도는 작성 가능
   * `async/await + try/catch`를 자연스럽게 쓸 수 있는 수준

   **일단 미루는 부분(2차 읽기용):**

   * `## 5. Node.js 개요`
   * `## 6. Node + TypeScript 프로젝트 골격`
   * `## 7. Express로 REST API 만들기`
   * `## 8. 간단한 도메인 타입 + 인메모리 REST 예제`
   * `## 9. (미리 맛보기) React에서 API 호출 한 번만`
   * `## 10. Stage 1 체크리스트 (JS/TS + Node 관점)`

---

### Step 2-3. React 기초 맛보기

**언제:** video-stack-02 Step 2-2까지 끝난 직후, Node 건들기 전에.

**video-stack-03-react-frontend-backend-integration.md – 1차 읽기 (React 기초)**

**이번에 읽는 부분:**

* `## 0. 전제 / 목표`
* `## 1. 전체 구조 (프론트 기준)`
* `## 2. React 프로젝트 기본 (Vite 기준)`
* `## 3. 타입 정의 / API 모듈 분리`
* React 보완 섹션 중:

  * JSX 기본 / JSX vs HTML
  * `style` 객체
  * 조건부 렌더링(`if return`, `&&` 패턴)

**미루는 부분(2차 읽기용):**

* `## 4. 업로드 상태 관리 컴포넌트 설계`
* `## 5. 업로드 결과 표시 컴포넌트`
* `## 6. 전체 App 구성`
* `## 7. 선택: 업로드 이후 리스트 렌더링`
* `## 8. React에서 상태/렌더링 모델을 C 관점에서 정리`
* `## 9. Stage 1·2 프론트 측 체크리스트`
* 고급 보완 섹션:

  * `useRef`, `forwardRef`, `useImperativeHandle`
  * `useEffect` cleanup
  * `useCallback`
  * 이벤트 타입 등

---

## 3. Stage 1 미니 실습 – /ping, /echo, /videos

이 구간에서 **“JS/React 문법 → 실제 백엔드/프론트 코드”**로 연결한다.

### Step 3-1. video-stack-02 – 2차 읽기 (Node/Express)

**언제:** `/ping`, `/echo`, `/videos` 직접 만들기 직전.

**이번에 추가로 읽는 부분:**

* `## 5. Node.js 개요`
* `## 6. Node + TypeScript 프로젝트 골격`
* `## 7. Express로 REST API 만들기`
* `## 8. 간단한 도메인 타입 + 인메모리 REST 예제`
  (`9, 10`은 나중 Stage 1 끝날 때 체크용으로 둬도 됨)

### Step 3-2. 실습 내용

**백엔드**

* `GET /ping` – 고정 문자열 혹은 JSON
* `POST /echo` – 받은 JSON 그대로 돌려주기
* `GET /videos` – 인메모리 배열로 리스트 제공

**프론트**

* React 앱에서 `/ping` 한 번 호출해서 화면에 보여주기

이 시점까지는 **v1.0 설계 일지 안 봐도 됨**.

---

## 4. v1.0-basic-infrastructure – 첫 버전

### Step 4-1. v1.0 설계 일지

**파일:** `1.0-basic-infrastructure.md` (실제 파일 이름 기준)

**읽을 포인트:**

* “이번 버전에서 하는 것 / 안 하는 것”
* 백엔드 API 스펙
* 프론트 컴포넌트 구조

### Step 4-2. video-stack-03 – 2차 읽기 (업로드 흐름)

**언제:** v1.0 구현 시작 직전.

**video-stack-03-react-frontend-backend-integration.md에서 이번에 추가로 읽는 부분:**

* `## 4. 업로드 상태 관리 컴포넌트 설계`
* `## 5. 업로드 결과 표시 컴포넌트`
* `## 6. 전체 App 구성`
* React 보완 섹션 중:

  * 폼/이벤트 타입 (`ChangeEvent`, `FormEvent`) 부분

이 세 파트가 사실상 **v1.0 프론트의 설계도**라,
읽으면서 바로 구현해도 된다.

### Step 4-3. v1.0 구현

**백엔드**

* 이미 만들어 둔 `/ping`, `/videos`를 v1.0 요구사항에 맞게 정리/확장.

**프론트**

* video-stack-03 4~6장의 구조를 거의 그대로 따라가며
* 설계 일지에 맞게 컴포넌트/타입 이름만 맞춰서 구현.

---

## 5. v1.1 · v1.2 · v1.3 – FFmpeg CLI + 상태 복잡도 증가

여기부터 **“실제 비디오 처리 + 좀 더 복잡한 프론트 상태 관리”** 구간.

### Step 5-1. Stage 1 정리 및 구멍 체크

**video-stack-02-js-ts-node-basics-for-c-dev.md**

* `## 9. (미리 맛보기) React에서 API 호출 한 번만`
* `## 10. Stage 1 체크리스트 (JS/TS + Node 관점)`

체크리스트 보면서 Stage 1에서 비어 있는 부분 있나 확인.

### Step 5-2. React 고급 패턴

**video-stack-03-react-frontend-backend-integration.md + 보완 섹션**

**언제:** v1.2, v1.3에서 재생 제어나 타임라인 등 복잡한 UI 넣기 직전.

**읽을 부분:**

* 보완 섹션:

  * `useRef`
  * `forwardRef` + `useImperativeHandle`
  * `useEffect` cleanup 패턴
  * `useCallback`
  * (선택) 이벤트 타입
* 본문:

  * `## 7. 선택: 업로드 이후 리스트 렌더링` (필요하면)
  * `## 8. React에서 상태/렌더링 모델을 C 관점에서 정리`
  * `## 9. Stage 1·2 프론트 측 체크리스트`

이건 v1.2, v1.3 구현하면서 **필요할 때 펼쳐보는 레퍼런스** 느낌으로 쓰면 된다.

### Step 5-3. FFmpeg CLI + Node ↔ FFmpeg 파이프라인

v1.1~1.3 사이에서 **영상 처리 자체**를 다루게 되면, 아래 서브문서 사용:

1. `ffmpeg-basic-01-cli-usage-core-options.md.md`

   * ffmpeg CLI 기본 옵션/패턴 익히기
   * 단일 명령어로 실험: `-i`, `-t`, `-ss`, `-vf`, `-r` 등

2. `node-express-ffmpeg-01-http-to-cli-pipeline.md.md`

   * Node.js + Express에서 업로드 받은 파일을 FFmpeg CLI로 넘기는 HTTP → CLI 파이프라인
   * `child_process.spawn("ffmpeg", args)` 패턴을 실제 라우트까지 확장

이 두 개는 **video-stack-02/03로 만든 백엔드·프론트 위에, “CLI 기반 영상 처리”를 얹는 단계**라고 보면 된다.

---

## 6. Stage 3 – C++ / FFmpeg C API / 네이티브 애드온

CLI 기반으로 서비스가 돌아가는 상태(v1.3 이후)에서, **성능/유연성 때문에 네이티브로 내려가는 단계**다.

### Step 6-1. C++ 최소 보완

**파일:** `cpp-minimum-for-c-programmers-raii-and-std.md.md`

**내용 포인트:**

* RAII, 참조, 스마트 포인터
* `std::string`, `std::vector`
* (필요 시) `unique_ptr`, range-for, `auto` 등

목표는 **“C 수준으로만 C++ 쓸 거면 어디서 터지는지”**를 막는 정도.

### Step 6-2. video-stack-04-cpp-ffmpeg-api-native-addon.md 읽기

**언제:** v1.3까지 끝나고, FFmpeg CLI 기반 서비스가 돌아가는 상태에서.

**권장 한 번에 읽는 범위:**

* `## 0. 전제 / 목표`
* `## 1. FFmpeg C API를 C++에서 쓰기 위한 기본 셋업`
* `## 2. C vs 현대 C++ – 여기서 필요한 부분만 정리`
* `## 3. 예제 1 – C++에서 영상 메타데이터 읽기`
* `## 4. CLI 프로그램: video_info`
* `## 5. CMake 빌드 설정 예시`
* `## 6. Node에서 C++ CLI를 호출해서 쓰기`
* `## 7. 네이티브 애드온 (선택)`
* `## 8. 정리 / Stage 3 체크리스트`

- C++/CMake 보완 섹션 전체(있는 경우):

* 참조, RAII, `string`/`vector`, `unique_ptr`
* `auto`, range-for, `std::map`
* `using` 타입 별칭, `std::move`
* C++ 예외, N-API 에러 브리지
* CMake 기본
* (선택) FFmpeg 버전 분기, 벤치마크 패턴

### Step 6-3. v2.x 구현

**순서 예시:**

1. `v2.0-native-addon-setup`
2. `v2.1-thumbnail-extraction`
3. `v2.2-metadata-analysis`

이 시점부터는 **video-stack-04 + v2.x 설계 일지**가 메인이고,
video-stack-02/03은 레퍼런스로만 가끔 보면 된다.

---

## 7. 최종 타임라인 요약 (문서 기준)

**읽기/실습 순서를 딱 문서 기준으로만 다시 정리하면:**

1. video-stack-01-architecture-and-roadma.md – 전체 개요
2. server-internals-01~04 – 서버 동작/HTTP 복습
3. node-basic-01-js-syntax-and-async – JS 최소 문법
4. video-stack-02-js-ts-node-basics-for-c-dev.md – 0~4 + JS/TS 보완
5. video-stack-03-react-frontend-backend-integration.md – 0~3 + JSX/조건부 렌더링
6. video-stack-02-js-ts-node-basics-for-c-dev.md – 5~8
7. 미니 실습 – `/ping`, `/echo`, `/videos` + React `/ping`
8. 1.0-basic-infrastructure 설계 일지
9. video-stack-03-react-frontend-backend-integration.md – 4~6 + 폼/이벤트 타입
10. v1.0 구현
11. video-stack-02-js-ts-node-basics-for-c-dev.md – 9~10 체크리스트
12. video-stack-03-react-frontend-backend-integration.md – 7~9 + 고급 보완 섹션(useRef 등)
13. ffmpeg-basic-01-cli-usage-core-options
14. node-express-ffmpeg-01-http-to-cli-pipeline
15. v1.1, v1.2, v1.3 구현
16. cpp-minimum-for-c-programmers-raii-and-std
17. video-stack-04-cpp-ffmpeg-api-native-addon.md 전체 + C++/CMake 보완
18. v2.0, v2.1, v2.2 구현