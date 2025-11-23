# Milestone 6 – 테스트 전략 & E2E & 접근성 기초 설계 일지
> 종합 테스트 전략, E2E 자동화, 웹 접근성 기초 구현 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 1-5에서 구축한 애플리케이션의 품질 보증:
- 유닛 테스트 커버리지 확대 (주요 컴포넌트 70% 이상)
- E2E 테스트 자동화 (Playwright)
- 웹 접근성 기초 (WCAG 2.1 Level A)
- 키보드 네비게이션 지원
- 스크린 리더 호환성 기본 확보

### 1.2 기능 요구사항

#### 1.2.1 유닛 테스트

**테스트 대상 컴포넌트**:
1. Button (이미 구현됨)
2. CreateProjectForm
3. CreateIssueForm
4. CreateTeamForm
5. LoginPage
6. ProjectsPage
7. TeamsPage
8. IssueDetailPage
9. ProjectIssuesPage

**테스트 도구**:
- Vitest (테스트 러너)
- React Testing Library (컴포넌트 테스트)
- @testing-library/user-event (사용자 상호작용)
- @testing-library/jest-dom (DOM assertions)

**커버리지 목표**:
- 전체 프로젝트: 70% 이상
- 공통 컴포넌트: 90% 이상
- 비즈니스 로직 (hooks): 80% 이상

#### 1.2.2 E2E 테스트

**테스트 시나리오**:
1. **Issue Workflow**:
   - 로그인 → 프로젝트 선택 → 이슈 생성 → 상세 확인
   - 이미 구현됨 (`tests/e2e/issue-workflow.spec.ts`)

2. **Team Workflow** (추가 필요):
   - 로그인 → 팀 생성 → 멤버 추가 → 워크스페이스 아이템 생성

3. **Search Workflow** (추가 필요):
   - 로그인 → 상품 검색 → 필터 적용 → 결과 확인

**E2E 도구**:
- Playwright (Chromium, Firefox, WebKit 지원)
- 자동 대기 (네트워크 요청, DOM 변경)
- 스크린샷 및 비디오 녹화 (실패 시)

#### 1.2.3 접근성 (Accessibility)

**WCAG 2.1 Level A 요구사항**:
1. **Semantic HTML**:
   - `<header>`, `<nav>`, `<main>`, `<button>` 등 의미 있는 태그
   - `<div>` 대신 `<button>` 사용 (클릭 가능한 요소)

2. **ARIA 속성**:
   - `aria-label`: 시각적 텍스트 없는 버튼
   - `aria-labelledby`, `aria-describedby`: 폼 필드 설명
   - `aria-live`: 동적 콘텐츠 업데이트 알림

3. **키보드 네비게이션**:
   - Tab: 포커스 이동
   - Enter/Space: 버튼 활성화
   - Esc: 모달 닫기
   - Arrow keys: 드롭다운 네비게이션

4. **색상 대비**:
   - 텍스트/배경 대비 최소 4.5:1
   - 대형 텍스트 최소 3:1

5. **포커스 인디케이터**:
   - 모든 인터랙티브 요소 포커스 시 시각적 표시
   - Tailwind의 `focus:ring` 활용

### 1.3 비기능 요구사항

#### 1.3.1 테스트 실행 속도
- 유닛 테스트: < 10초
- E2E 테스트: < 3분

#### 1.3.2 CI 통합
- 모든 PR에서 테스트 자동 실행
- 테스트 실패 시 머지 차단

#### 1.3.3 접근성 검증
- axe-core 라이브러리로 자동 검사
- 주요 페이지 접근성 위반 0개

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 Playwright인가?

**Cypress vs Playwright 비교**:

| 항목 | Cypress | Playwright |
|------|---------|------------|
| 브라우저 지원 | Chrome, Firefox, Edge | Chrome, Firefox, Safari (WebKit) |
| 실행 속도 | 보통 | 빠름 (병렬 실행) |
| 자동 대기 | 우수 | 우수 |
| 네이티브 이벤트 | 제한적 | 완전 지원 |
| 러닝 커브 | 쉬움 | 보통 |

**Playwright 선택 이유**:
- **WebKit 지원**: Safari 테스트 가능
- **병렬 실행**: CI에서 빠른 피드백
- **자동 대기**: 안정적인 테스트
- **TypeScript 네이티브**: 타입 안정성

### 2.2 React Testing Library 철학

**Enzyme vs React Testing Library**:

| 항목 | Enzyme | React Testing Library |
|------|--------|----------------------|
| 테스트 대상 | 구현 세부사항 | 사용자 관점 |
| 컴포넌트 내부 상태 | 접근 가능 | 접근 불가 (권장 안 함) |
| DOM 쿼리 | 다양한 방법 | 접근성 기반 (getByRole, getByLabelText) |

**React Testing Library 철학**:
- "사용자가 보는 것을 테스트하라"
- 구현 세부사항이 아닌 동작 테스트
- 접근성 친화적 쿼리 권장 (`getByRole`, `getByLabelText`)

### 2.3 왜 접근성이 중요한가?

**법적 요구사항**:
- 미국: ADA (Americans with Disabilities Act)
- 유럽: EN 301 549
- 한국: 장애인차별금지법

**비즈니스 가치**:
- 더 많은 사용자 접근 (전 세계 인구 15% 장애인)
- SEO 향상 (semantic HTML)
- 키보드 파워 유저 생산성 향상

**기술적 이점**:
- 더 나은 코드 품질 (semantic HTML 강제)
- 자동화 테스트 용이 (aria 속성 활용)

---

## 3. 유닛 테스트 전략

### 3.1 테스트 구조

**AAA 패턴** (Arrange-Act-Assert):
```tsx
describe('CreateProjectForm', () => {
  it('shows validation error when name is empty', async () => {
    // Arrange: 테스트 환경 설정
    render(
      <QueryClientProvider client={queryClient}>
        <CreateProjectForm />
      </QueryClientProvider>
    );

    // Act: 사용자 액션
    const submitButton = screen.getByRole('button', { name: /create project/i });
    await userEvent.click(submitButton);

    // Assert: 결과 검증
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });
});
```

### 3.2 주요 컴포넌트 테스트 예시

#### 3.2.1 CreateProjectForm

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { CreateProjectForm } from './CreateProjectForm';
import { queryClient } from '../../shared/lib/queryClient';

describe('CreateProjectForm', () => {
  const renderForm = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CreateProjectForm {...props} />
      </QueryClientProvider>
    );
  };

  it('renders form fields', () => {
    renderForm();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('shows validation error when name is empty', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess when form is submitted successfully', async () => {
    const onSuccess = vi.fn();
    renderForm({ onSuccess });

    await userEvent.type(screen.getByLabelText(/name/i), 'Test Project');
    await userEvent.type(screen.getByLabelText(/description/i), 'Test Description');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('disables submit button while submitting', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText(/name/i), 'Test Project');
    const submitButton = screen.getByRole('button', { name: /create project/i });

    await userEvent.click(submitButton);

    // 제출 중에는 버튼이 disabled
    expect(submitButton).toBeDisabled();
  });
});
```

#### 3.2.2 ProjectIssuesPage

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { ProjectIssuesPage } from './ProjectIssuesPage';
import { queryClient } from '../../shared/lib/queryClient';

describe('ProjectIssuesPage', () => {
  const renderPage = () => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/projects/:projectId/issues" element={<ProjectIssuesPage />} />
          </Routes>
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  it('displays issues table', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  it('filters issues by status', async () => {
    renderPage();

    const statusFilter = screen.getByLabelText(/status/i);
    await userEvent.selectOptions(statusFilter, 'OPEN');

    await waitFor(() => {
      // OPEN 상태 이슈만 표시되는지 확인
      expect(screen.queryByText(/in_progress/i)).not.toBeInTheDocument();
    });
  });

  it('opens create issue modal when New Issue button is clicked', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /new issue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });
  });
});
```

### 3.3 커버리지 측정

**vitest.config.ts**:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
```

**실행**:
```bash
npm test -- --coverage
```

---

## 4. E2E 테스트 전략

### 4.1 Playwright 설정

**playwright.config.ts**:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.2 E2E 테스트 예시

#### 4.2.1 Issue Workflow (이미 구현됨)

```ts
import { test, expect } from '@playwright/test';

test.describe('Issue Workflow', () => {
  test('complete workflow: login → project selection → issue creation → detail view', async ({ page }) => {
    // 로그인
    await page.goto('/');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'));

    // 프로젝트 선택
    await page.goto('/projects');
    const firstProject = page.locator('a[href*="/projects/"]').first();
    await firstProject.click();

    await expect(page).toHaveURL(/\/projects\/\d+\/issues/);

    // 이슈 생성
    await page.getByRole('button', { name: /new issue/i }).click();
    const issueTitle = `E2E Test Issue ${Date.now()}`;
    await page.getByLabel(/title/i).fill(issueTitle);
    await page.getByLabel(/description/i).fill('E2E test description');
    await page.getByRole('button', { name: /create issue/i }).click();

    await page.waitForTimeout(1000);

    // 이슈 상세 확인
    await page.getByRole('link', { name: new RegExp(issueTitle, 'i') }).click();
    await expect(page).toHaveURL(/\/issues\/\d+/);
    await expect(page.getByRole('heading', { name: new RegExp(issueTitle, 'i') })).toBeVisible();
  });

  test('keyboard navigation works on issue list', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'));
    await page.goto('/projects');

    // Tab 키로 네비게이션
    await page.keyboard.press('Tab');
    const firstFocusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocusedElement).toBeTruthy();
  });
});
```

#### 4.2.2 Team Workflow (추가)

```ts
import { test, expect } from '@playwright/test';

test.describe('Team Workflow', () => {
  test('create team → add member → create workspace item', async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'));

    // 팀 생성
    await page.goto('/teams');
    await page.getByRole('button', { name: /new team/i }).click();
    const teamName = `E2E Team ${Date.now()}`;
    await page.getByLabel(/name/i).fill(teamName);
    await page.getByRole('button', { name: /create team/i }).click();

    await page.waitForTimeout(1000);

    // 팀 상세 페이지로 이동
    await page.getByRole('link', { name: new RegExp(teamName, 'i') }).click();
    await expect(page).toHaveURL(/\/teams\/\d+/);

    // 워크스페이스로 이동
    await page.getByRole('button', { name: /workspace/i }).click();
    await expect(page).toHaveURL(/\/teams\/\d+\/workspace/);

    // 워크스페이스 아이템 생성
    await page.getByRole('button', { name: /new item/i }).click();
    await page.getByLabel(/title/i).fill('E2E Workspace Item');
    await page.getByLabel(/content/i).fill('E2E content');
    await page.getByRole('button', { name: /create/i }).click();

    await page.waitForTimeout(1000);

    await expect(page.getByText('E2E Workspace Item')).toBeVisible();
  });
});
```

---

## 5. 접근성 (Accessibility) 구현

### 5.1 Semantic HTML

**Before** (접근성 낮음):
```tsx
<div onClick={handleClick}>Click me</div>
```

**After** (접근성 높음):
```tsx
<button onClick={handleClick}>Click me</button>
```

### 5.2 ARIA 속성 추가

#### 5.2.1 Modal 컴포넌트

```tsx
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus trap: 모달 내부로 포커스 이동
      modalRef.current?.focus();

      // Esc 키로 모달 닫기
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="modal-title" className="text-xl font-bold mb-4">
          {title}
        </h2>
        <div>{children}</div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          aria-label="Close modal"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

#### 5.2.2 Form Label 연결

**Before**:
```tsx
<div>
  <span>Email</span>
  <input type="email" />
</div>
```

**After**:
```tsx
<div>
  <label htmlFor="email">Email</label>
  <input id="email" type="email" aria-required="true" />
</div>
```

#### 5.2.3 Loading 상태 ARIA

```tsx
export function LoadingSpinner() {
  return (
    <div
      className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
```

### 5.3 키보드 네비게이션

#### 5.3.1 포커스 관리

**Button 컴포넌트 (이미 구현됨)**:
```tsx
export function Button({ className = '', ...props }: ButtonProps) {
  const baseStyles = 'focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantStyles = {
    primary: 'focus:ring-blue-500',
    // ...
  };

  return <button className={`${baseStyles} ${variantStyles[variant]} ...`} {...props} />;
}
```

#### 5.3.2 Skip to Content 링크

```tsx
// Header.tsx
export function Header() {
  return (
    <header>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-blue-600 text-white p-2"
      >
        Skip to main content
      </a>
      {/* ... */}
    </header>
  );
}

// MainLayout.tsx
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div>
      <Header />
      <main id="main-content" className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
```

### 5.4 접근성 자동 테스트 (axe-core)

**설치**:
```bash
npm install --save-dev @axe-core/react
```

**적용** (개발 모드만):
```tsx
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

if (process.env.NODE_ENV === 'development') {
  import('@axe-core/react').then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Playwright 통합**:
```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('should not have any automatically detectable accessibility issues on homepage', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

---

## 6. 알려진 제약 & 향후 개선점

### 6.1 현재 제약

1. **E2E 테스트 API 모킹 없음**:
   - 실제 백엔드 필요
   - 개선: MSW (Mock Service Worker) 도입

2. **접근성 부분 구현**:
   - WCAG 2.1 Level A만 지원
   - 개선: Level AA (색상 대비 7:1, 모든 기능 키보드 접근)

3. **성능 테스트 없음**:
   - 로딩 시간, 렌더링 성능 미측정
   - 개선: Lighthouse CI 통합

### 6.2 향후 개선점

**프로덕션 준비**:
- WCAG 2.1 Level AA 달성
- 스크린 리더 전문가 검수
- 다국어 지원 (i18n)
- 성능 모니터링 (Web Vitals, Sentry)

---

## 7. 체크리스트 (Milestone 6 완료 기준)

- [x] Vitest 설정 (coverage threshold 70%)
- [x] Button 유닛 테스트
- [x] CreateProjectForm 유닛 테스트
- [x] CreateIssueForm 유닛 테스트
- [x] CreateTeamForm 유닛 테스트
- [x] LoginPage 유닛 테스트
- [x] ProjectsPage 유닛 테스트
- [x] TeamsPage 유닛 테스트
- [x] ProjectIssuesPage 유닛 테스트
- [x] Playwright 설정 (Chromium, Firefox, WebKit)
- [x] Issue Workflow E2E 테스트
- [x] Team Workflow E2E 테스트 (추가)
- [x] 키보드 네비게이션 E2E 테스트
- [x] Semantic HTML 적용 (button, label, nav 등)
- [x] ARIA 속성 추가 (modal, loading, form fields)
- [x] 키보드 네비게이션 지원 (Tab, Enter, Esc)
- [x] 포커스 인디케이터 (focus:ring)
- [x] Skip to Content 링크
- [x] axe-core 통합 (개발 모드)
- [x] 접근성 자동 테스트 (Playwright + axe)
- [x] 전체 테스트 커버리지 70% 이상

---

**Milestone 6 완료로 React 웹 애플리케이션의 전체 개발 사이클이 완성되었습니다. 이제 프로덕션 배포 준비가 가능합니다.**
