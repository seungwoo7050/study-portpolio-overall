# Milestone 3 – 로그인/인증/인가 UX 설계 일지
> JWT 기반 인증 시스템, Context API 전역 상태 관리, RBAC 기반 팀 관리 기능 구현 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 2의 CRUD 기능에 인증/인가 레이어 추가:
- JWT (JSON Web Token) 기반 인증
- Context API 기반 전역 인증 상태 관리
- 라우트 가드 (RequireAuth)
- 팀 관리 및 RBAC (Role-Based Access Control)
- 전역 에러 처리 (401/403/404/500)

### 1.2 기능 요구사항

#### 1.2.1 대상 API

**인증 관련**:
- `POST /api/auth/login` (public) - 로그인
- `GET /api/auth/me` (auth 필요) - 현재 사용자 조회
- `POST /api/users` (public) - 회원가입

**팀 관련**:
- `POST /api/teams` - 팀 생성 (생성자가 OWNER)
- `GET /api/teams` - 내 팀 목록
- `GET /api/teams/{teamId}` - 팀 상세 + 멤버 정보
- `POST /api/teams/{teamId}/members` - 멤버 추가 (OWNER/MANAGER만)
- `GET /api/teams/{teamId}/members` - 멤버 목록
- `PATCH /api/teams/{teamId}/members/{memberId}` - 역할 변경 (OWNER/MANAGER)
- `DELETE /api/teams/{teamId}/members/{memberId}` - 멤버 삭제 (OWNER/MANAGER)

**워크스페이스 관련**:
- `POST /api/teams/{teamId}/items` - 워크스페이스 아이템 생성 (팀 멤버만)
- `GET /api/teams/{teamId}/items` - 아이템 목록 (팀 멤버만)
- `GET /api/items/{itemId}` - 아이템 상세
- `PUT /api/items/{itemId}` - 아이템 수정
- `DELETE /api/items/{itemId}` - 아이템 삭제

#### 1.2.2 구현 화면

1. **로그인 페이지** (`/login`):
   - 이메일/비밀번호 입력 폼
   - "Sign In" 버튼
   - 로그인 성공 시 이전 페이지로 리다이렉트
   - 에러 메시지 표시

2. **팀 목록 페이지** (`/teams`):
   - 내가 속한 팀 목록
   - "New Team" 버튼
   - 팀 카드 클릭 시 상세 페이지 이동

3. **팀 상세 페이지** (`/teams/:teamId`):
   - 팀 정보 (이름, 생성일)
   - 멤버 목록 (이메일, 닉네임, 역할, 가입일)
   - "Add Member" 버튼 (OWNER/MANAGER만 표시)
   - 역할 변경/삭제 버튼 (OWNER/MANAGER만)
   - "Workspace" 버튼 (워크스페이스 페이지로 이동)

4. **워크스페이스 페이지** (`/teams/:teamId/workspace`):
   - 워크스페이스 아이템 목록 (제목, 작성자, 생성일)
   - "New Item" 버튼 (팀 멤버만)
   - 아이템 클릭 시 상세 모달

#### 1.2.3 인증 플로우

**로그인 시퀀스**:
```text
1. 사용자가 로그인 폼 제출
2. POST /api/auth/login { email, password }
3. 서버 응답: { accessToken, user }
4. 토큰을 localStorage에 저장
5. AuthContext 상태 업데이트
6. 이전 페이지로 리다이렉트 (또는 홈으로)
```

**자동 로그인 (페이지 새로고침)**:
```text
1. 앱 시작 시 AuthProvider 마운트
2. GET /api/auth/me (localStorage의 토큰 사용)
3. 성공: 사용자 정보 저장, isAuthenticated = true
4. 실패 (401): 토큰 삭제, 로그인 페이지로 리다이렉트
```

**로그아웃 시퀀스**:
```text
1. 사용자가 "Logout" 버튼 클릭
2. localStorage에서 토큰 삭제
3. AuthContext 상태 초기화
4. /login 페이지로 리다이렉트
```

#### 1.2.4 역할 기반 접근 제어 (RBAC)

**팀 역할 정의**:
```ts
type TeamRole = 'OWNER' | 'MANAGER' | 'MEMBER';
```

**권한 매트릭스**:
| 작업 | OWNER | MANAGER | MEMBER |
|------|-------|---------|--------|
| 팀 상세 보기 | ✅ | ✅ | ✅ |
| 워크스페이스 아이템 생성 | ✅ | ✅ | ✅ |
| 멤버 추가 | ✅ | ✅ | ❌ |
| 멤버 역할 변경 | ✅ | ✅ | ❌ |
| 멤버 삭제 | ✅ | ✅ | ❌ |
| 팀 삭제 (미구현) | ✅ | ❌ | ❌ |

### 1.3 비기능 요구사항

#### 1.3.1 보안
- **토큰 저장**: localStorage (XSS 주의, httpOnly 쿠키가 더 안전하지만 간단함 우선)
- **자동 로그아웃**: 401 응답 시 즉시 토큰 삭제 및 리다이렉트
- **비밀번호 표시 안 함**: input type="password"

#### 1.3.2 사용자 경험
- **로딩 상태**: 인증 체크 중 "Loading..." 표시
- **리다이렉트 보존**: 로그인 성공 시 원래 요청한 페이지로 이동
- **에러 메시지**: 명확한 에러 안내 (잘못된 이메일/비밀번호 등)

#### 1.3.3 코드 품질
- **타입 안정성**: UserDto, TeamDto, TeamMemberDto 타입 정의
- **재사용성**: useAuth 훅, useTeamRole 훅
- **테스트**: LoginPage, TeamsPage 유닛 테스트

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 Context API인가?

**Redux vs Context API vs Zustand 비교**:

| 항목 | Redux | Context API | Zustand |
|------|-------|-------------|---------|
| 번들 크기 | ~20KB | 0KB (내장) | ~1KB |
| 보일러플레이트 | 많음 | 적음 | 매우 적음 |
| DevTools | ✅ | ❌ | ✅ |
| 러닝 커브 | 높음 | 낮음 | 낮음 |

**인증 상태 관리에 Context API 선택 이유**:
- **단순한 상태**: 사용자 정보 + 로그인/로그아웃 함수만 필요
- **전역 접근**: 모든 컴포넌트에서 `useAuth()` 호출
- **추가 의존성 불필요**: React 내장 기능
- **충분한 성능**: 인증 상태는 자주 변경되지 않음

**Context API의 재렌더링 최적화**:
- 인증 상태 변경 시 모든 소비자 재렌더링
- 하지만 인증 상태는 로그인/로그아웃 시만 변경 (빈도 낮음)
- 필요 시 `useMemo`로 최적화 가능

### 2.2 왜 JWT인가?

**세션 vs JWT 비교**:

| 항목 | 세션 (Server-side) | JWT (Client-side) |
|------|-------------------|-------------------|
| 저장 위치 | 서버 메모리/DB | 클라이언트 (localStorage/쿠키) |
| 서버 부하 | 세션 조회 필요 | 서버 상태 없음 (stateless) |
| 확장성 | 어려움 (세션 동기화) | 쉬움 (서버 간 공유 불필요) |
| 보안 | 서버에서 관리 | XSS/CSRF 주의 필요 |
| 토큰 폐기 | 즉시 가능 | 만료 시까지 유효 |

**JWT 선택 이유**:
- **RESTful 원칙**: 서버 상태 없음 (stateless)
- **마이크로서비스 친화적**: 토큰만으로 인증
- **간단한 구현**: Bearer 토큰만 헤더에 추가

**JWT 구조**:
```text
Header.Payload.Signature

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTYxNjIzOTAyMn0.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

Payload 예시:
```json
{
  "userId": 1,
  "email": "test@example.com",
  "iat": 1616239022,
  "exp": 1616325422
}
```

**보안 고려사항**:
- **XSS 방지**: 사용자 입력 sanitize (React는 기본 제공)
- **HTTPS 필수**: 토큰 탈취 방지
- **짧은 만료 시간**: 1시간 ~ 1일 (Refresh Token 미구현 시 적절히 조정)

### 2.3 왜 RBAC인가?

**ACL (Access Control List) vs RBAC 비교**:

**ACL**:
- 사용자별로 권한 부여 (User A는 리소스 X 읽기 가능)
- 관리 복잡도 높음 (사용자 수 × 리소스 수)

**RBAC**:
- 역할별로 권한 부여 (OWNER 역할은 모든 작업 가능)
- 확장성 우수 (새 사용자는 역할만 할당)
- 비즈니스 로직과 일치 (팀장, 매니저, 멤버)

**RBAC 구현 전략**:
- **서버 검증**: API에서 역할 체크 (신뢰할 수 있는 유일한 곳)
- **클라이언트 UI**: 역할에 따라 버튼 숨기기 (UX 향상, 보안 X)

---

## 3. 아키텍처 설계

### 3.1 인증 플로우 다이어그램

```text
┌──────────────────────────────────────────────────────────┐
│ App.tsx (최상위)                                          │
│  <AuthProvider>                                          │
│    <BrowserRouter>                                       │
│      <Routes>                                            │
└──────────────────┬───────────────────────────────────────┘
                   │
   ┌───────────────▼───────────────┐
   │ AuthProvider                  │
   │  - useCurrentUser()           │
   │  - useLogin(), useLogout()    │
   │  - Context 값 제공             │
   └───────────────┬───────────────┘
                   │
   ┌───────────────▼───────────────┐
   │ RequireAuth (라우트 가드)      │
   │  - useAuth() 호출              │
   │  - isAuthenticated 체크        │
   │  - false → /login 리다이렉트   │
   └───────────────┬───────────────┘
                   │
   ┌───────────────▼───────────────┐
   │ Protected Page (예: ProjectsPage) │
   │  - useAuth() 호출 (user 정보)  │
   │  - API 요청 (JWT 자동 포함)    │
   └───────────────────────────────┘
```

### 3.2 디렉토리 구조

```text
src/
├── features/
│   ├── auth/
│   │   ├── AuthContext.tsx      # Context Provider + useAuth 훅
│   │   ├── RequireAuth.tsx      # 라우트 가드 컴포넌트
│   │   ├── api.ts               # 인증 API 함수
│   │   ├── hooks.ts             # useCurrentUser, useLogin, useLogout
│   │   └── LoginPage.test.tsx   # 테스트
│   └── team/
│       ├── api.ts               # 팀 API 함수
│       ├── hooks.ts             # useTeams, useTeam, useCreateTeam 등
│       ├── useTeamRole.ts       # 역할 기반 권한 체크 훅
│       ├── CreateTeamForm.tsx
│       └── AddMemberForm.tsx
└── shared/
    └── types/
        └── api.ts               # UserDto, TeamDto, TeamMemberDto
```

---

## 4. 레이어별 상세 설계

### 4.1 인증 API 레이어 (features/auth/api.ts)

**책임**: 인증 관련 API 호출

```ts
import apiClient from '../../shared/lib/apiClient';
import type { UserDto } from '../../shared/types/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: UserDto;
}

export const authApi = {
  // 로그인
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  // 현재 사용자 조회
  me: async (): Promise<UserDto> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  // 회원가입 (옵션)
  register: async (data: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<UserDto> => {
    const response = await apiClient.post('/users', data);
    return response.data;
  },
};
```

### 4.2 인증 훅 (features/auth/hooks.ts)

**책임**: React Query 기반 인증 로직

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, LoginRequest } from './api';

// 현재 사용자 조회 (자동 로그인용)
export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,  // 401 시 재시도 안 함
    staleTime: Infinity,  // 로그아웃 전까지 캐시 유지
  });
};

// 로그인
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // 토큰 저장
      localStorage.setItem('accessToken', data.accessToken);

      // 사용자 정보 캐시에 저장
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });
};

// 로그아웃
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // 서버 로그아웃 API가 있다면 호출
      // await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      // 토큰 삭제
      localStorage.removeItem('accessToken');

      // 모든 쿼리 캐시 초기화
      queryClient.clear();

      // 로그인 페이지로 리다이렉트 (AuthContext에서 처리)
    },
  });
};
```

### 4.3 AuthContext (features/auth/AuthContext.tsx)

**책임**: 전역 인증 상태 제공

```tsx
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useCurrentUser, useLogin, useLogout } from './hooks';
import type { UserDto, LoginRequest } from '../../shared/types/api';

interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: user, isLoading, error } = useCurrentUser();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const login = async (data: LoginRequest) => {
    await loginMutation.mutateAsync(data);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const value: AuthContextValue = {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    error: error as Error | null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**핵심 로직**:
- `useCurrentUser()`: 마운트 시 자동으로 `/api/auth/me` 호출
- `isAuthenticated`: user가 있으면 true
- `isLoading`: useCurrentUser가 로딩 중이면 true (초기 인증 체크)
- `login()`: 로그인 mutation 실행, 성공 시 캐시 업데이트
- `logout()`: 토큰 삭제, 캐시 초기화

### 4.4 RequireAuth 컴포넌트 (features/auth/RequireAuth.tsx)

**책임**: 인증되지 않은 사용자 리다이렉트

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // 인증 체크 중
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // 로그인 페이지로 리다이렉트, 원래 위치 저장
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

**동작 시퀀스**:
1. 사용자가 `/projects` 접근
2. `RequireAuth` 마운트
3. `isLoading === true` → "Loading..." 표시
4. `useCurrentUser` 완료:
   - 성공: `isAuthenticated = true` → children 렌더링
   - 실패 (401): `isAuthenticated = false` → `/login`으로 리다이렉트

**location state 활용** (로그인 후 원래 페이지로):
```tsx
// LoginPage.tsx
const location = useLocation();
const from = location.state?.from?.pathname || '/';

const handleLogin = async () => {
  await login({ email, password });
  navigate(from, { replace: true });
};
```

### 4.5 LoginPage (app/routes/LoginPage.tsx)

**책임**: 로그인 폼 UI

```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from '../../shared/components/Button';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

### 4.6 팀 관리 레이어

#### 4.6.1 팀 API (features/team/api.ts)

```ts
import apiClient from '../../shared/lib/apiClient';
import type { TeamDto, TeamMemberDto, PaginatedResponse } from '../../shared/types/api';

export const teamApi = {
  // 팀 목록
  getTeams: async (): Promise<PaginatedResponse<TeamDto>> => {
    const response = await apiClient.get('/teams');
    return response.data;
  },

  // 팀 상세 + 멤버
  getTeam: async (teamId: number) => {
    const response = await apiClient.get(`/teams/${teamId}`);
    return response.data; // { team: TeamDto, members: TeamMemberDto[] }
  },

  // 팀 생성
  createTeam: async (data: { name: string }): Promise<TeamDto> => {
    const response = await apiClient.post('/teams', data);
    return response.data;
  },

  // 멤버 추가
  addMember: async (teamId: number, data: { userId: number; role: TeamRole }) => {
    const response = await apiClient.post(`/teams/${teamId}/members`, data);
    return response.data;
  },

  // 역할 변경
  updateMemberRole: async (teamId: number, memberId: number, role: TeamRole) => {
    const response = await apiClient.patch(`/teams/${teamId}/members/${memberId}`, { role });
    return response.data;
  },

  // 멤버 삭제
  removeMember: async (teamId: number, memberId: number): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}/members/${memberId}`);
  },
};
```

#### 4.6.2 useTeamRole 훅 (features/team/useTeamRole.ts)

**책임**: 현재 사용자의 팀 내 역할 및 권한 체크

```ts
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { TeamMemberDto, TeamRole } from '../../shared/types/api';

export function useTeamRole(members: TeamMemberDto[] | undefined) {
  const { user } = useAuth();

  const currentMember = useMemo(() => {
    if (!user || !members) return null;
    return members.find((member) => member.userId === user.id);
  }, [user, members]);

  const role: TeamRole | null = currentMember?.role || null;

  const canManageMembers = useMemo(() => {
    return role === 'OWNER' || role === 'MANAGER';
  }, [role]);

  const isOwner = useMemo(() => {
    return role === 'OWNER';
  }, [role]);

  return {
    currentMember,
    role,
    canManageMembers,
    isOwner,
  };
}
```

**사용 예시**:
```tsx
// TeamDetailPage.tsx
const { data } = useTeam(teamId);
const { canManageMembers } = useTeamRole(data?.members);

return (
  <div>
    {canManageMembers && (
      <Button onClick={() => setShowAddMemberModal(true)}>
        Add Member
      </Button>
    )}
  </div>
);
```

### 4.7 전역 에러 처리

#### 4.7.1 API Client 인터셉터 강화

**401 처리** (이미 구현됨):
```ts
if (error.response.status === 401) {
  localStorage.removeItem('accessToken');
  window.location.href = '/login';
}
```

**403 처리** (권한 없음):
```ts
if (error.response.status === 403) {
  // Toast 메시지 표시 (Milestone 4에서 추가)
  console.error('You do not have permission to perform this action');
}
```

**404 처리** (리소스 없음):
```ts
if (error.response.status === 404) {
  // 에러 페이지로 리다이렉트 또는 메시지 표시
  console.error('Resource not found');
}
```

**500 처리** (서버 에러):
```ts
if (error.response.status >= 500) {
  console.error('Server error. Please try again later.');
}
```

---

## 5. 테스트 전략

### 5.1 유닛 테스트

**LoginPage 테스트**:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '../../features/auth/AuthContext';
import { queryClient } from '../../shared/lib/queryClient';

describe('LoginPage', () => {
  const renderLoginPage = () => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  it('renders login form', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error message on invalid credentials', async () => {
    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/email/i), 'wrong@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
    });
  });
});
```

**TeamsPage 테스트**:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TeamsPage } from './TeamsPage';
import { AuthProvider } from '../../features/auth/AuthContext';
import { queryClient } from '../../shared/lib/queryClient';

describe('TeamsPage', () => {
  it('displays list of teams', async () => {
    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TeamsPage />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/teams/i)).toBeInTheDocument();
    });
  });

  it('opens create team modal when New Team button is clicked', async () => {
    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TeamsPage />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /new team/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });
  });
});
```

### 5.2 RBAC 테스트

**useTeamRole 훅 테스트**:
```tsx
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTeamRole } from './useTeamRole';
import { AuthProvider } from '../auth/AuthContext';

describe('useTeamRole', () => {
  it('returns canManageMembers=true for OWNER', () => {
    const mockMembers = [
      { id: 1, userId: 1, role: 'OWNER', user: { id: 1, email: 'owner@example.com', nickname: 'Owner' } },
    ];

    const { result } = renderHook(() => useTeamRole(mockMembers), {
      wrapper: AuthProvider,
    });

    expect(result.current.canManageMembers).toBe(true);
    expect(result.current.isOwner).toBe(true);
  });

  it('returns canManageMembers=false for MEMBER', () => {
    const mockMembers = [
      { id: 1, userId: 1, role: 'MEMBER', user: { id: 1, email: 'member@example.com', nickname: 'Member' } },
    ];

    const { result } = renderHook(() => useTeamRole(mockMembers), {
      wrapper: AuthProvider,
    });

    expect(result.current.canManageMembers).toBe(false);
    expect(result.current.isOwner).toBe(false);
  });
});
```

---

## 6. 알려진 제약 & 향후 개선점

### 6.1 현재 제약

1. **Refresh Token 미구현**:
   - Access Token 만료 시 재로그인 필요
   - 개선: Refresh Token 발급 및 자동 갱신

2. **localStorage 보안 이슈**:
   - XSS 공격에 취약
   - 개선: httpOnly 쿠키 사용 (서버 설정 필요)

3. **에러 메시지 개선 필요**:
   - 콘솔 로그만 출력
   - 개선: Toast 라이브러리 (Milestone 4)

4. **RBAC 서버 검증 가정**:
   - 클라이언트는 UI만 제어
   - 서버에서 반드시 권한 재확인 필요

### 6.2 향후 개선점

**Milestone 4**:
- Toast 메시지 라이브러리 추가 (react-hot-toast)
- 에러 처리 중앙화

**Milestone 6**:
- E2E 테스트 (로그인 → 팀 생성 → 멤버 추가)
- 접근성 강화 (ARIA 라벨, 키보드 네비게이션)

**보안 강화** (프로덕션 시):
- CSRF 토큰 추가
- Rate limiting (로그인 시도 제한)
- 비밀번호 규칙 강화

---

## 7. 체크리스트 (Milestone 3 완료 기준)

- [x] authApi 구현 (login, me)
- [x] useCurrentUser, useLogin, useLogout 훅
- [x] AuthContext + AuthProvider
- [x] useAuth 훅
- [x] RequireAuth 라우트 가드
- [x] LoginPage 구현
- [x] 로그인 후 원래 페이지로 리다이렉트
- [x] teamApi 구현 (CRUD + 멤버 관리)
- [x] useTeams, useTeam, useCreateTeam 훅
- [x] useTeamRole 훅 (RBAC)
- [x] TeamsPage 구현
- [x] TeamDetailPage 구현 (멤버 목록 + 역할 기반 UI)
- [x] CreateTeamForm 컴포넌트
- [x] AddMemberForm 컴포넌트
- [x] 워크스페이스 API 및 페이지 구현
- [x] 401 에러 시 자동 로그아웃 및 리다이렉트
- [x] 403/404/500 에러 처리 (기본)
- [x] LoginPage 유닛 테스트
- [x] TeamsPage 유닛 테스트
- [x] CreateTeamForm 유닛 테스트
- [x] useTeamRole 훅 테스트

---

**이 설계를 기반으로 Milestone 4에서 통계/데이터 패칭 패턴과 외부 API 연동을 구축합니다.**
