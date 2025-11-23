# Milestone 1 – 부트스트랩 & 라우팅 & CI 설계 일지
> React 웹 애플리케이션의 기반 구조를 구축하고, 기본 라우팅과 CI/CD 파이프라인을 확립한 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

단일 React + TypeScript 프로젝트로 다음을 구축:
- Vite 기반 모던 빌드 환경 구성
- React Router v6를 활용한 클라이언트 사이드 라우팅
- Tailwind CSS 기반 스타일링 시스템
- 공통 레이아웃 컴포넌트 (Header, Sidebar)
- 재사용 가능한 기본 UI 컴포넌트
- GitHub Actions 기반 CI/CD 파이프라인

### 1.2 기능 요구사항

#### 1.2.1 프로젝트 부트스트랩
1. **빌드 도구**: Vite 7.x 사용
   - React 19 + TypeScript 5.9 지원
   - Hot Module Replacement (HMR) 지원
   - 빠른 빌드 속도 (< 5초 for dev, < 30초 for production)

2. **패키지 관리**: npm
   - `package.json`에 스크립트 정의:
     - `dev`: 개발 서버 실행
     - `build`: 프로덕션 빌드
     - `lint`: ESLint 검사
     - `test`: Vitest 실행
     - `preview`: 빌드 결과 미리보기

3. **TypeScript 설정**:
   - Strict mode 활성화
   - Path alias 지원 (`@/` → `src/`)
   - React JSX 지원 (automatic runtime)

#### 1.2.2 라우팅 구조
React Router v6 기반 다음 경로 지원:
- `/` - 홈 페이지 (인증 필요)
- `/login` - 로그인 페이지 (public)
- `/projects` - 프로젝트 목록
- `/projects/:projectId/issues` - 프로젝트별 이슈 목록
- `/issues/:issueId` - 이슈 상세
- `/issues` - 전체 이슈 목록
- `/teams` - 팀 목록
- `/teams/:teamId` - 팀 상세
- `/teams/:teamId/workspace` - 팀 워크스페이스
- `/stats` - 통계 대시보드
- `/popular` - 인기 이슈
- `/external` - 외부 API 페이지
- `/products` - 상품 검색 (lazy loaded)

#### 1.2.3 레이아웃 시스템
1. **MainLayout** 컴포넌트:
   - Header (상단 내비게이션)
   - Sidebar (왼쪽 메뉴)
   - Main content area (중앙 컨텐츠)
   - 반응형 레이아웃 (Flexbox)

2. **Header** 컴포넌트:
   - 애플리케이션 제목
   - 사용자 정보 표시
   - 로그아웃 버튼

3. **Sidebar** 컴포넌트:
   - 주요 페이지로의 네비게이션 링크
   - 현재 경로 하이라이트
   - 아이콘 + 텍스트 레이블

#### 1.2.4 기본 UI 컴포넌트
1. **Button** 컴포넌트:
   - 4가지 variant: `primary`, `secondary`, `outline`, `danger`
   - 3가지 size: `sm`, `md`, `lg`
   - disabled 상태 지원
   - 접근성: focus ring, 키보드 네비게이션

2. **LoadingSpinner** 컴포넌트:
   - 데이터 로딩 시 표시
   - 중앙 정렬 옵션

3. **ErrorBoundary** 컴포넌트:
   - 최상위 에러 캐치
   - 사용자 친화적 에러 메시지 표시

#### 1.2.5 스타일링
- Tailwind CSS 3.4 사용
- Utility-first 접근
- 커스텀 테마 설정 가능
- PostCSS 기반 처리

### 1.3 비기능 요구사항

#### 1.3.1 코드 품질
- **ESLint**: TypeScript + React 규칙 적용
  - `@typescript-eslint/recommended`
  - `react-hooks/recommended`
  - `react-refresh/only-export-components`
- **타입 안정성**: `tsc --noEmit` 통과
- **린트 경고 0개**: 모든 PR은 린트 통과 필수

#### 1.3.2 테스트
- **유닛 테스트**: Vitest + React Testing Library
- **최소 커버리지**: 1개 이상의 컴포넌트 테스트
  - Button 컴포넌트 기본 테스트
- **테스트 실행 시간**: < 5초

#### 1.3.3 성능
- **개발 서버 시작**: < 3초
- **프로덕션 빌드**: < 30초
- **빌드 결과물 크기**: < 500KB (gzipped)

#### 1.3.4 CI/CD
- **자동화 파이프라인** (GitHub Actions):
  1. 의존성 설치 (`npm ci`)
  2. 린트 검사 (`npm run lint`)
  3. 테스트 실행 (`npm test`)
  4. 빌드 생성 (`npm run build`)
- **트리거**: `main` 브랜치 및 `claude/**` 브랜치 push, PR
- **실행 시간**: < 5분

---

## 2. 기술 스택 & 아키텍처 결정

### 2.1 왜 Vite인가?

**기존 CRA (Create React App)의 한계:**
- 느린 빌드 속도 (Webpack 기반)
- 복잡한 설정 오버헤드
- 개발 서버 시작 시간 지연

**Vite의 장점:**
- **ESBuild 기반**: Go 언어로 작성, 10-100배 빠른 빌드
- **네이티브 ESM**: 브라우저 native ES modules 활용
- **HMR 성능**: 파일 변경 시 즉각적인 업데이트
- **간단한 설정**: `vite.config.ts` 몇 줄로 완성

**트레이드오프:**
- 일부 레거시 패키지 호환성 이슈 가능 (거의 없음)
- 프로덕션은 여전히 Rollup 사용 (품질 보장)

### 2.2 왜 React Router v6인가?

**v5에서 개선된 점:**
- **중첩 라우팅**: `<Outlet />` 기반 레이아웃 구조
- **상대 경로**: 더 직관적인 라우트 정의
- **타입 안정성**: TypeScript 지원 향상
- **번들 크기 감소**: v5 대비 ~50% 작은 크기

**주요 API:**
- `BrowserRouter`: HTML5 History API 기반
- `Routes` + `Route`: 라우트 정의
- `useNavigate`: 프로그래매틱 네비게이션
- `useParams`, `useSearchParams`: 경로 데이터 접근

### 2.3 왜 Tailwind CSS인가?

**전통적 CSS의 문제점:**
- 클래스명 고민 (BEM, OOCSS 등)
- 사용하지 않는 스타일 누적
- 일관성 유지 어려움

**Tailwind의 장점:**
- **Utility-first**: HTML에서 직접 스타일링
- **PurgeCSS 내장**: 사용하지 않는 스타일 자동 제거
- **디자인 시스템**: spacing, color 등 일관된 토큰
- **빠른 프로토타이핑**: 별도 CSS 파일 불필요

**사용 예시:**
```tsx
<button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
  Click me
</button>
```

---

## 3. 프로젝트 구조 설계

### 3.1 디렉토리 레이아웃

```text
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── app/                    # 애플리케이션 레벨
│   │   ├── layouts/           # 레이아웃 컴포넌트
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   └── routes/            # 페이지 컴포넌트
│   │       ├── HomePage.tsx
│   │       ├── LoginPage.tsx
│   │       └── ...
│   ├── features/              # 기능별 모듈 (Milestone 2+)
│   ├── shared/                # 공유 리소스
│   │   ├── components/       # 재사용 컴포넌트
│   │   │   ├── Button.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── hooks/            # 커스텀 훅
│   │   ├── lib/              # 유틸리티
│   │   │   ├── apiClient.ts  # Axios 인스턴스 (Milestone 2)
│   │   │   └── queryClient.ts # React Query 설정 (Milestone 2)
│   │   └── types/            # 공통 타입 정의
│   ├── App.tsx               # 루트 컴포넌트
│   ├── main.tsx              # 엔트리포인트
│   └── index.css             # Tailwind CSS imports
├── tests/                     # 테스트 파일
│   └── e2e/                  # E2E 테스트 (Milestone 6)
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── eslint.config.js
```

### 3.2 설계 원칙

1. **Feature-based 구조**: 도메인별 격리 (`features/`)
2. **공통 리소스 분리**: 재사용 컴포넌트는 `shared/`
3. **타입 안정성**: 모든 컴포넌트 Props 타입 정의
4. **단일 책임**: 각 컴포넌트는 하나의 역할만

---

## 4. 레이어 설계

### 4.1 엔트리포인트 레이어 (main.tsx)

**책임**: 애플리케이션 초기화, 최상위 Provider 설정

**핵심 구조**:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './shared/lib/queryClient'
import { ErrorBoundary } from './shared/components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
```

**동작 포인트**:
- `StrictMode`: React 개발 모드 경고 활성화
- `ErrorBoundary`: 최상위 에러 처리
- `QueryClientProvider`: React Query 전역 설정 (Milestone 2에서 활용)
- `App`: 라우팅 및 인증 Provider 포함

### 4.2 라우팅 레이어 (App.tsx)

**책임**: 라우트 정의, 인증 가드, 레이아웃 적용

**핵심 구조**:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './features/auth/AuthContext';
import { RequireAuth } from './features/auth/RequireAuth';
import { MainLayout } from './app/layouts/MainLayout';

// Code splitting for product search feature
const ProductSearchPage = lazy(() =>
  import('./app/routes/ProductSearchPage').then((module) => ({
    default: module.ProductSearchPage,
  }))
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <MainLayout>
                  <HomePage />
                </MainLayout>
              </RequireAuth>
            }
          />
          {/* ... 다른 라우트들 ... */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

**동작 포인트**:
- `AuthProvider`: 전역 인증 상태 관리 (Milestone 3)
- `BrowserRouter`: HTML5 History API 기반 라우팅
- `RequireAuth`: 인증 가드 컴포넌트
- `MainLayout`: 공통 레이아웃 적용
- `Suspense` + `lazy`: 코드 스플리팅 (Milestone 5)

### 4.3 레이아웃 레이어

#### 4.3.1 MainLayout 컴포넌트

**책임**: 전체 페이지 구조 제공 (Header + Sidebar + Content)

**구현**:
```tsx
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

**레이아웃 구조**:
```text
┌────────────────────────────────────────┐
│           Header (고정)                 │
├──────────┬─────────────────────────────┤
│          │                             │
│ Sidebar  │   Main Content Area         │
│ (고정)    │   (children)                │
│          │                             │
│          │                             │
└──────────┴─────────────────────────────┘
```

#### 4.3.2 Header 컴포넌트

**책임**: 상단 내비게이션, 사용자 정보, 로그아웃

**핵심 요소**:
- 애플리케이션 타이틀
- 현재 로그인 사용자 표시
- 로그아웃 버튼 (Milestone 3에서 활성화)

#### 4.3.3 Sidebar 컴포넌트

**책임**: 메인 네비게이션 메뉴

**링크 목록**:
- Home (/)
- Projects (/projects)
- Issues (/issues)
- Teams (/teams)
- Stats (/stats)
- Popular Issues (/popular)
- External API (/external)
- Product Search (/products)

**현재 경로 하이라이트**: `useLocation()` 훅 사용

### 4.4 공유 컴포넌트 레이어

#### 4.4.1 Button 컴포넌트

**책임**: 일관된 버튼 UI 제공

**Props 인터페이스**:
```tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}
```

**스타일 시스템**:
- **variant별 색상**:
  - `primary`: 파란색 배경
  - `secondary`: 회색 배경
  - `outline`: 테두리만
  - `danger`: 빨간색 배경
- **size별 패딩**:
  - `sm`: `px-3 py-1.5 text-sm`
  - `md`: `px-4 py-2 text-base`
  - `lg`: `px-6 py-3 text-lg`
- **상태 스타일**:
  - hover: 색상 진하게
  - focus: ring 표시
  - disabled: 투명도 50%, cursor not-allowed

**접근성**:
- focus ring 지원
- 키보드 네비게이션 (Tab, Enter)
- 의미 있는 aria 속성

#### 4.4.2 LoadingSpinner 컴포넌트

**책임**: 로딩 상태 시각화

**구현**: Tailwind 애니메이션 활용
```tsx
export function LoadingSpinner() {
  return (
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent">
      <span className="sr-only">Loading...</span>
    </div>
  );
}
```

#### 4.4.3 ErrorBoundary 컴포넌트

**책임**: React 에러 경계, 전역 에러 처리

**핵심 메서드**:
- `static getDerivedStateFromError(error)`: 에러 캐치
- `componentDidCatch(error, errorInfo)`: 에러 로깅

**사용자 경험**:
- 에러 발생 시 앱 크래시 방지
- 사용자 친화적 메시지 표시
- 새로고침 버튼 제공

---

## 5. CI/CD 파이프라인 설계

### 5.1 GitHub Actions Workflow

**파일**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [ main, claude/** ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json

    - name: Install dependencies
      run: npm ci
      working-directory: frontend

    - name: Run linter
      run: npm run lint
      working-directory: frontend

    - name: Run tests
      run: npm test -- --run
      working-directory: frontend

    - name: Build
      run: npm run build
      working-directory: frontend
```

### 5.2 파이프라인 단계

1. **코드 체크아웃**: `actions/checkout@v4`
2. **Node.js 설정**: v20, npm 캐시 활성화
3. **의존성 설치**: `npm ci` (빠르고 재현 가능)
4. **린트 검사**: ESLint 실행, 0 경고 필수
5. **테스트 실행**: Vitest 실행, 모든 테스트 통과
6. **빌드 생성**: 프로덕션 빌드, 성공 확인

### 5.3 품질 게이트

| 항목 | 기준 |
|------|------|
| 린트 | 경고 0개 |
| 테스트 | 통과율 100% |
| 빌드 | 성공 (exit code 0) |
| 실행 시간 | < 5분 |

### 5.4 로컬 개발 워크플로우

**개발 시작**:
```bash
cd frontend
npm install
npm run dev
```

**코드 푸시 전 체크**:
```bash
npm run lint       # ESLint 검사
npm test          # 테스트 실행
npm run build     # 빌드 테스트
```

---

## 6. 테스트 전략

### 6.1 유닛 테스트

**도구**: Vitest + React Testing Library

**테스트 대상**: Button 컴포넌트

**테스트 케이스**:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-600');
  });

  it('applies danger variant when specified', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

### 6.2 테스트 커버리지 목표

**Milestone 1 기준**:
- Button 컴포넌트: 100% 커버리지
- 전체 프로젝트: 최소 1개 테스트 통과

**향후 확장** (Milestone 6):
- 주요 컴포넌트: 70% 이상
- 비즈니스 로직: 80% 이상

---

## 7. 성능 최적화

### 7.1 빌드 최적화

**Vite 설정**:
```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
```

**청크 분할 전략**:
- `react-vendor`: React 관련 라이브러리
- 각 페이지: 자동 코드 스플리팅 (Milestone 5)

### 7.2 Tailwind 최적화

**PurgeCSS 설정**:
```js
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // 사용하지 않는 스타일 자동 제거
}
```

**결과**:
- 개발: 전체 CSS (~3MB)
- 프로덕션: 사용된 클래스만 (~10KB)

---

## 8. 알려진 제약 & 향후 개선점

### 8.1 현재 제약

1. **인증 로직 미완성**:
   - `RequireAuth` 컴포넌트는 구조만 정의
   - Milestone 3에서 완전 구현 예정

2. **API 통합 없음**:
   - 페이지 컴포넌트는 더미 UI만 표시
   - Milestone 2에서 React Query 연동 예정

3. **접근성 부분 구현**:
   - 기본 semantic HTML만 사용
   - Milestone 6에서 ARIA 속성, 키보드 네비게이션 강화

### 8.2 향후 개선점

**Milestone 2**:
- React Query 통합
- API 클라이언트 (Axios) 설정
- 실제 데이터 패칭

**Milestone 3**:
- JWT 기반 인증 구현
- 전역 에러 처리 강화
- RBAC (팀 역할 기반 접근 제어)

**Milestone 5**:
- 코드 스플리팅 확대
- React.memo, useMemo 최적화
- 번들 크기 분석 및 최적화

**Milestone 6**:
- E2E 테스트 (Playwright)
- 접근성 감사 (axe-core)
- 성능 모니터링 (Web Vitals)

---

## 9. 체크리스트 (Milestone 1 완료 기준)

- [x] Vite 프로젝트 생성 및 설정 완료
- [x] React 19 + TypeScript 5.9 설정
- [x] Tailwind CSS 설정 및 PostCSS 연동
- [x] ESLint 설정 (TypeScript + React 규칙)
- [x] React Router v6 라우팅 정의 (13개 경로)
- [x] MainLayout 컴포넌트 구현 (Header + Sidebar)
- [x] Header 컴포넌트 구현
- [x] Sidebar 컴포넌트 구현 (네비게이션 링크)
- [x] Button 컴포넌트 구현 (4 variants, 3 sizes)
- [x] LoadingSpinner 컴포넌트 구현
- [x] ErrorBoundary 컴포넌트 구현
- [x] Button 컴포넌트 유닛 테스트 작성
- [x] GitHub Actions CI 파이프라인 설정
- [x] CI 통과 (lint, test, build)
- [x] 프로덕션 빌드 크기 < 500KB (gzipped)
- [x] 개발 서버 시작 시간 < 3초
- [x] 빌드 시간 < 30초

---

## 10. 핵심 학습 포인트

### 10.1 기술 선택의 이유 이해

**Vite의 가치**:
- ESBuild의 속도 (Go 언어 기반)
- Native ESM 활용으로 개발 경험 향상
- 설정 복잡도 감소

**Tailwind의 철학**:
- Utility-first로 빠른 프로토타이핑
- 디자인 시스템 일관성
- PurgeCSS로 프로덕션 최적화

### 10.2 아키텍처 패턴

**레이아웃 분리**:
- 레이아웃은 `app/layouts/`
- 페이지는 `app/routes/`
- 재사용 컴포넌트는 `shared/components/`

**타입 안정성**:
- 모든 Props 인터페이스 정의
- `tsc --noEmit`로 타입 체크

**테스트 우선**:
- 공통 컴포넌트는 테스트 필수
- CI에서 자동 검증

### 10.3 개발 워크플로우

1. 로컬에서 기능 개발
2. 린트, 테스트 통과 확인
3. 커밋 및 푸시
4. GitHub Actions 자동 검증
5. PR 리뷰 및 머지

---

**이 설계를 기반으로 Milestone 2에서 실제 데이터 패칭과 CRUD 기능을 구축합니다.**
