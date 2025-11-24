# T09: 테스트 & 접근성

> **목표**: 프로덕션 수준의 테스트 커버리지와 접근성 확보
> **예상 시간**: 12-18시간
> **난이도**: 🟠 고급
> **선행 요구사항**: [T06: React/Vite 기본](./T06-react-vite-basics.md), [T07: React Query + Forms](./T07-react-query-forms.md)
> **적용 프로젝트**: React Milestone M6, 전체 프로젝트

---

## 목차

1. [Vitest 단위 테스트](#1-vitest-단위-테스트)
2. [React Testing Library](#2-react-testing-library)
3. [Playwright E2E 테스트](#3-playwright-e2e-테스트)
4. [테스트 커버리지](#4-테스트-커버리지)
5. [웹 접근성 기초](#5-웹-접근성-기초)
6. [ARIA 속성](#6-aria-속성)
7. [키보드 네비게이션](#7-키보드-네비게이션)
8. [접근성 테스트](#8-접근성-테스트)
9. [트러블슈팅](#9-트러블슈팅)
10. [프로젝트 적용](#10-프로젝트-적용)

---

## 1. Vitest 단위 테스트

### 1.1 Vitest 설치

```bash
# Vitest 및 관련 패키지 설치
npm install --save-dev vitest @vitest/ui
npm install --save-dev @testing-library/jest-dom
```

**vite.config.ts** 설정:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
      ],
    },
  },
});
```

**src/test/setup.ts**:

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

**package.json** 스크립트:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### 1.2 함수 단위 테스트

**src/utils/format.ts**:

```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

**src/utils/format.test.ts**:

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, validateEmail } from './format';

describe('formatCurrency', () => {
  it('should format positive numbers correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should format zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should format negative numbers correctly', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00');
  });
});

describe('formatDate', () => {
  it('should format Date object correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });

  it('should format ISO string correctly', () => {
    expect(formatDate('2024-12-25')).toBe('Dec 25, 2024');
  });
});

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user @example.com')).toBe(false);
  });
});
```

### 1.3 비동기 함수 테스트

**src/api/users.ts**:

```typescript
export interface User {
  id: number;
  name: string;
  email: string;
}

export async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  return response.json();
}

export async function createUser(user: Omit<User, 'id'>): Promise<User> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!response.ok) {
    throw new Error('Failed to create user');
  }
  return response.json();
}
```

**src/api/users.test.ts**:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchUser, createUser } from './users';

// Mock fetch globally
global.fetch = vi.fn();

describe('fetchUser', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user successfully', async () => {
    const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    const user = await fetchUser(1);

    expect(user).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith('/api/users/1');
  });

  it('should throw error on failed request', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(fetchUser(999)).rejects.toThrow('Failed to fetch user: Not Found');
  });
});

describe('createUser', () => {
  it('should create user successfully', async () => {
    const newUser = { name: 'Bob', email: 'bob@example.com' };
    const createdUser = { id: 2, ...newUser };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => createdUser,
    });

    const user = await createUser(newUser);

    expect(user).toEqual(createdUser);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(newUser),
      })
    );
  });
});
```

---

## 2. React Testing Library

### 2.1 기본 컴포넌트 테스트

**src/components/Button.tsx**:

```tsx
import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
```

**src/components/Button.test.tsx**:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should apply variant class', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-danger');
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Loading...');
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button disabled onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

### 2.2 폼 컴포넌트 테스트

**src/components/LoginForm.tsx**:

```tsx
import { useState, FormEvent } from 'react';

interface LoginFormProps {
  onSubmit: (credentials: { email: string; password: string }) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Login form">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span id="email-error" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <span id="password-error" role="alert">
            {errors.password}
          </span>
        )}
      </div>

      <button type="submit">Log in</button>
    </form>
  );
}
```

**src/components/LoginForm.test.tsx**:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('should render form fields', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    render(<LoginForm onSubmit={handleSubmit} />);

    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should show error for short password', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    render(<LoginForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), '123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    render(<LoginForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    // Errors should be cleared
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
```

---

## 3. Playwright E2E 테스트

### 3.1 Playwright 설치

```bash
# Playwright 설치
npm install --save-dev @playwright/test

# 브라우저 설치
npx playwright install

# 설정 파일 생성
npx playwright init
```

**playwright.config.ts**:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**package.json** 스크립트:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  }
}
```

### 3.2 기본 E2E 테스트

**e2e/login.spec.ts**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  });

  test('should show validation errors', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should login successfully', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpass');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });
});
```

---

## 4. 테스트 커버리지

```bash
# Vitest 커버리지
npm install --save-dev @vitest/coverage-v8

# 커버리지 실행
npm run test:coverage
```

**출력 예시**:

```
-------------------------|---------|----------|---------|---------|-------------------
File                     | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------------|---------|----------|---------|---------|-------------------
All files                |   85.71 |    76.92 |      90 |   85.71 |
 components              |      88 |       80 |     100 |      88 |
  Button.tsx             |     100 |      100 |     100 |     100 |
  LoginForm.tsx          |      85 |       75 |     100 |      85 | 18-20
 utils                   |      90 |       85 |     100 |      90 |
  format.ts              |     100 |      100 |     100 |     100 |
  validation.ts          |      80 |       70 |     100 |      80 | 25-28
-------------------------|---------|----------|---------|---------|-------------------
```

---

## 5. 웹 접근성 기초

### 5.1 WCAG 원칙 (POUR)

1. **Perceivable (인식 가능)**: 이미지 alt 텍스트, 색상 대비
2. **Operable (작동 가능)**: 키보드 네비게이션, 포커스 가시성
3. **Understandable (이해 가능)**: 명확한 레이블, 일관된 네비게이션
4. **Robust (견고)**: 유효한 HTML, ARIA 사용

### 5.2 시맨틱 HTML

```tsx
// ❌ 나쁜 예시
<div onclick="handleClick()">Click me</div>

// ✅ 좋은 예시
<button onclick="handleClick()">Click me</button>
```

---

## 6. ARIA 속성

```tsx
// aria-label
<button aria-label="Close">×</button>

// aria-labelledby
<h2 id="title">Settings</h2>
<div role="dialog" aria-labelledby="title">...</div>

// aria-invalid
<input
  id="email"
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
/>
{error && <span id="email-error" role="alert">{error}</span>}
```

---

## 7. 키보드 네비게이션

```tsx
// 포커스 가능한 요소
<div
  tabIndex={0}
  role="button"
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Custom Button
</div>

// Skip Link
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
<main id="main-content" tabIndex={-1}>...</main>
```

---

## 8. 접근성 테스트

```bash
npm install --save-dev @axe-core/react @axe-core/playwright
```

**Playwright 접근성 테스트**:

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
```

---

## 9. 트러블슈팅

**문제**: `document is not defined`
**해결**: vite.config.ts에 `environment: 'jsdom'` 추가

**문제**: React Testing Library 쿼리 실패
**해결**: `screen.findByText()` (비동기) 사용

---

## 10. 프로젝트 적용

**CI/CD (.github/workflows/test.yml)**:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

---

## 면접 질문

### 1. 단위 테스트와 E2E 테스트의 차이는?
**답변**: 단위 테스트는 함수/컴포넌트 독립 테스트. E2E는 전체 애플리케이션 실제 시나리오 테스트.

### 2. WCAG AA와 AAA의 차이는?
**답변**: AA는 색상 대비 4.5:1 (법적 요구사항), AAA는 7:1 (더 엄격).

---

**마지막 업데이트**: 2025년 1월
**다음 튜토리얼**: [T12 - Node-API + FFmpeg →](./T12-node-api-ffmpeg.md)
