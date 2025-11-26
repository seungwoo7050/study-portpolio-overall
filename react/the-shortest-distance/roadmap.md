# React 프론트엔드 학습 로드맵

## 0. 제일 처음

### Step 0-1. 문서 1 (1.md)

* **언제:** 완전 맨 처음 1회.
* **어디까지:**

  * `## 1. 이 문서의 역할`
  * `## 2. 최종 목표: 어떤 애플리케이션을 만들 것인가`
  * `## 3. 전체 아키텍처 한 번에 보기`
  * `## 4. Milestone별 로드맵 개요`
  * `## 5~7 Milestone 1-2/3-4/5-6 개요`까지 그냥 쭉 읽기
* 목적: 전체 지도만 머리에 넣는 용도. 암기할 필요 없음.

---

## 1. Milestone 1-2 (React 기초)

### Step 1-1. 문서 2 읽기 (Bootstrap + CRUD)

**문서 2 (2.md)**

* **언제:** 첫 코딩 들어가기 전에.
* **전체 읽기:**

  * `## 1. M1: Bootstrap & Routing & CI`
  * `## 2. M2: Issue Tracker CRUD`
  * `## 3. M1-M2 체크리스트`

* 목적: Vite, React Router, Tailwind, React Hook Form 패턴 이해

---

### Step 1-2. M1 구현 (프로젝트 기반)

* **프로젝트 생성**:

  ```bash
  npm create vite@latest frontend -- --template react-ts
  cd frontend
  npm install
  ```

* **React Router 설정**:

  ```bash
  npm install react-router-dom
  ```

  - `App.tsx`에 라우팅 구조 구축
  - `MainLayout.tsx` 레이아웃 컴포넌트

* **Tailwind CSS 설정**:

  ```bash
  npm install -D tailwindcss postcss autoprefixer
  npx tailwindcss init -p
  ```

  - `tailwind.config.js` 설정
  - `index.css`에 Tailwind directives 추가

* **공통 컴포넌트**:

  - `Button`, `Card` 등 재사용 가능한 UI

* **CI 파이프라인**:

  - `.github/workflows/ci.yml` 작성

* **빌드 & 실행**:

  ```bash
  npm run dev
  # http://localhost:5173
  ```

---

### Step 1-3. M2 구현 (CRUD UI)

* **React Hook Form + Zod 설치**:

  ```bash
  npm install react-hook-form zod @hookform/resolvers
  ```

* **타입 정의**:

  - `src/features/issue/types.ts` - Issue, CreateIssueDto 등

* **API 클라이언트**:

  - `src/shared/lib/apiClient.ts` - fetch 래퍼

* **CRUD 페이지 구현**:

  - `IssueListPage.tsx` - 이슈 목록
  - `CreateIssuePage.tsx` - 이슈 생성 (React Hook Form)
  - `IssueDetailPage.tsx` - 이슈 상세

* **테스트**:

  ```bash
  npm run dev
  # 브라우저에서 CRUD 동작 확인
  ```

---

## 2. Milestone 3-4 (인증 & 상태관리)

### Step 2-1. 문서 3 읽기 (Auth + React Query)

**문서 3 (3.md)**

* **언제:** M1-M2 끝나고.
* **전체 읽기:**

  * `## 1. M3: 로그인/인증/인가 UX`
  * `## 2. M4: 통계/데이터 패칭 패턴`
  * `## 3. M3-M4 체크리스트`

* 목적: JWT 인증, AuthContext, React Query 패턴 이해

---

### Step 2-2. M3 구현 (인증)

* **AuthContext 구현**:

  - `src/features/auth/AuthContext.tsx`
  - `useAuth` hook

* **Login Page**:

  - `LoginPage.tsx` - React Hook Form + Zod
  - JWT 토큰을 localStorage에 저장

* **Protected Routes**:

  - `ProtectedRoute.tsx` - 인증 체크
  - `App.tsx`에 적용

* **테스트**:

  ```bash
  npm run dev
  # 로그인 없이 접근 → /login 리다이렉트 확인
  # 로그인 후 접근 → 정상 동작 확인
  ```

---

### Step 2-3. M4 구현 (React Query)

* **React Query 설치**:

  ```bash
  npm install @tanstack/react-query
  ```

* **Query Client 설정**:

  - `src/shared/lib/queryClient.ts`
  - `main.tsx`에 Provider 추가

* **useQuery 적용**:

  - `useIssues.ts` hook
  - `IssueListPage.tsx`에서 사용

* **useMutation 적용**:

  - `useCreateIssue.ts` hook
  - `CreateIssuePage.tsx`에서 사용

* **통계 대시보드**:

  ```bash
  npm install recharts
  ```

  - `DailyStatsChart.tsx` - Recharts
  - `StatsPage.tsx`

* **테스트**:

  ```bash
  npm run dev
  # 이슈 생성 → 자동 캐시 갱신 확인
  # 통계 페이지 → 차트 렌더링 확인
  ```

---

## 3. Milestone 5-6 (고급 패턴, 선택)

### Step 3-1. 문서 4 읽기 (Search + Testing)

**문서 4 (4.md)**

* **언제:** M1-M4 끝나고, 고급 패턴을 경험하고 싶을 때.
* **전체 읽기:**

  * `## 1. M5: 검색/필터 UI + 성능 기초`
  * `## 2. M6: 테스트 전략 & E2E & 접근성`
  * `## 3. M5-M6 체크리스트`

* 목적: 검색/성능/테스트/접근성 패턴 이해

---

### Step 3-2. M5 구현 (검색 & 성능)

* **검색 UI (디바운스)**:

  ```bash
  npm install lodash-es
  npm install --save-dev @types/lodash-es
  ```

  - `SearchPage.tsx` - debounce 적용

* **가상 스크롤**:

  ```bash
  npm install react-window
  npm install --save-dev @types/react-window
  ```

  - `VirtualizedIssueList.tsx`

* **코드 스플리팅**:

  - `React.lazy` + `Suspense`
  - `App.tsx`에 적용

---

### Step 3-3. M6 구현 (테스트 & 접근성)

* **Vitest + RTL 설치**:

  ```bash
  npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
  ```

  - `vitest.config.ts` 설정
  - `Button.test.tsx` 작성

* **E2E 테스트 (Cypress)**:

  ```bash
  npm install --save-dev cypress
  npx cypress open
  ```

  - `cypress/e2e/login.cy.ts` 작성

* **접근성**:

  - ARIA 레이블 추가
  - 키보드 네비게이션 구현
  - axe DevTools로 검증

---

## 최종 타임라인 요약

1. **시작 전**

   * 1.md 전체 1회

2. **Milestone 1-2 (React 기초)**

   * 2.md 읽기
   * M1 구현 (Bootstrap + Routing + CI)
   * M2 구현 (CRUD UI)

3. **Milestone 3-4 (인증 & 상태관리)**

   * 3.md 읽기
   * M3 구현 (JWT 인증 + Protected Routes)
   * M4 구현 (React Query + 통계 대시보드)

4. **Milestone 5-6 (고급 패턴, 선택)**

   * 4.md 읽기
   * M5 구현 (검색 + 성능 최적화)
   * M6 구현 (테스트 + 접근성)

---

## 학습 팁

1. **작은 단위로 빌드하기**

   * 한 번에 모든 기능을 만들려고 하지 말고
   * Milestone 단위로 나눠서 점진적으로 구현

2. **React DevTools 활용**

   * Components, Profiler 탭으로 성능 분석
   * React Query DevTools로 캐시 상태 확인

3. **TypeScript 타입 안전성**

   * API 응답 타입을 명확히 정의
   * `any` 사용 최소화

4. **에러 처리**

   * API 호출 실패 시 사용자에게 명확한 피드백
   * 에러 바운더리로 예상치 못한 에러 처리

5. **성능 최적화는 나중에**

   * 먼저 동작하는 코드를 만들고
   * 성능 문제가 실제로 발생하면 최적화
   * 조기 최적화는 피할 것

---

## 참고 자료

* [React 공식 문서](https://react.dev/)
* [Vite 공식 문서](https://vitejs.dev/)
* [React Router 공식 문서](https://reactrouter.com/)
* [TanStack Query 공식 문서](https://tanstack.com/query/latest)
* [Testing Library 공식 문서](https://testing-library.com/)
