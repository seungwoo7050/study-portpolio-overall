# Milestone 2 – Issue Tracker CRUD 설계 일지
> Issue Tracker의 핵심 CRUD 기능을 구현하고, React Query 기반 데이터 패칭 패턴을 확립한 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 1의 기반 위에 실제 데이터를 다루는 CRUD 기능 구축:
- React Query를 활용한 서버 상태 관리
- Axios 기반 API 클라이언트
- Project / Issue / Comment 도메인 구현
- react-hook-form + zod 기반 폼 검증
- 페이지네이션 및 필터링

### 1.2 기능 요구사항

#### 1.2.1 대상 API

**프로젝트 관리**:
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects?page=&size=` - 프로젝트 목록 (페이지네이션)

**이슈 관리**:
- `POST /api/projects/{projectId}/issues` - 이슈 생성
- `GET /api/projects/{projectId}/issues?status=&page=&size=` - 프로젝트별 이슈 목록
- `GET /api/issues/{issueId}` - 이슈 상세 조회
- `PUT /api/issues/{issueId}` - 이슈 수정
- `DELETE /api/issues/{issueId}` - 이슈 삭제

**댓글 관리**:
- `POST /api/issues/{issueId}/comments` - 댓글 생성
- `GET /api/issues/{issueId}/comments` - 댓글 목록

#### 1.2.2 구현 화면

1. **프로젝트 목록 페이지** (`/projects`):
   - 프로젝트 카드 그리드 레이아웃
   - "New Project" 버튼
   - 페이지네이션 컨트롤
   - 로딩/에러/빈 상태 처리

2. **프로젝트별 이슈 목록** (`/projects/:projectId/issues`):
   - 이슈 테이블 (제목, 상태, 담당자, 생성일)
   - 상태별 필터 (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
   - "New Issue" 버튼
   - 페이지네이션

3. **이슈 상세 페이지** (`/issues/:issueId`):
   - 이슈 정보 (제목, 설명, 상태, 담당자)
   - 수정/삭제 버튼
   - 댓글 목록
   - 댓글 작성 폼

4. **폼 컴포넌트**:
   - `CreateProjectForm`: 프로젝트 생성
   - `CreateIssueForm`: 이슈 생성
   - `EditIssueForm`: 이슈 수정

#### 1.2.3 폼 검증

**react-hook-form + zod 스키마**:

```ts
// 프로젝트 생성
const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
});

// 이슈 생성
const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  assigneeId: z.string().optional(),
});

// 이슈 수정
const editIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  assigneeId: z.string().optional(),
});
```

### 1.3 비기능 요구사항

#### 1.3.1 성능
- **데이터 캐싱**: React Query로 5분간 캐시
- **중복 요청 방지**: 같은 쿼리 자동 중복 제거
- **낙관적 업데이트**: 삭제/수정 시 즉시 UI 반영

#### 1.3.2 사용자 경험
- **로딩 상태**: 데이터 패칭 중 스피너 표시
- **에러 처리**: 사용자 친화적 에러 메시지
- **빈 상태**: "No data" 안내 메시지
- **폼 검증**: 실시간 검증 메시지

#### 1.3.3 코드 품질
- **타입 안정성**: DTO 타입 정의 (`shared/types/api.ts`)
- **API 레이어 분리**: 각 feature별 `api.ts`, `hooks.ts`
- **테스트**: 폼 컴포넌트 유닛 테스트 추가

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 React Query인가?

**전통적 상태 관리의 문제점 (Redux, Zustand 등)**:
- **서버 상태 vs 클라이언트 상태 혼재**: Redux에 API 응답 저장하면 캐시 관리 복잡
- **보일러플레이트 과다**: actions, reducers, sagas 등
- **캐싱 전략 수동 구현**: stale 데이터 판단, 자동 리페칭 어려움

**React Query의 장점**:
- **서버 상태 전문**: 데이터 패칭, 캐싱, 동기화에 최적화
- **자동 리페칭**: 윈도우 포커스, 네트워크 재연결 시 자동 갱신
- **중복 제거**: 같은 쿼리 키는 한 번만 요청
- **낙관적 업데이트**: mutation 후 즉시 UI 반영
- **DevTools**: 쿼리 상태 디버깅 편리

**핵심 개념**:
- `useQuery`: 데이터 읽기 (GET)
- `useMutation`: 데이터 변경 (POST, PUT, DELETE)
- `queryClient`: 캐시 관리 (invalidation, 수동 업데이트)

### 2.2 왜 react-hook-form + zod인가?

**기존 폼 라이브러리 문제점 (Formik 등)**:
- **재렌더링 과다**: 입력마다 전체 폼 리렌더링
- **타입 안정성 부족**: 런타임 검증만 지원

**react-hook-form의 장점**:
- **비제어 컴포넌트**: ref 기반, 성능 우수
- **작은 번들 크기**: ~9KB (gzipped)
- **TypeScript 친화적**: 타입 추론 강력

**zod의 장점**:
- **스키마 우선**: 타입과 검증 로직 동시 정의
- **TypeScript 네이티브**: `z.infer<typeof schema>`로 타입 추출
- **체이닝 API**: `.min().max().email()` 같은 직관적 검증

**조합 예시**:
```tsx
const schema = z.object({
  email: z.string().email('Invalid email'),
  age: z.number().min(18, 'Must be 18+'),
});

type FormData = z.infer<typeof schema>; // { email: string; age: number }

const { register, handleSubmit } = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

### 2.3 왜 Axios인가?

**Fetch API의 한계**:
- 에러 처리 불편 (HTTP 에러도 resolve)
- 요청/응답 인터셉터 없음
- 타임아웃 설정 복잡

**Axios의 장점**:
- **인터셉터**: 인증 토큰 자동 추가, 에러 처리 중앙화
- **자동 JSON 변환**: `response.data` 즉시 사용
- **타임아웃**: `timeout: 5000` 설정 간편
- **에러 타입**: `AxiosError`로 일관된 처리

---

## 3. 아키텍처 설계

### 3.1 데이터 플로우

```text
┌─────────────────────────────────────────────────────┐
│ Component (ProjectsPage)                           │
│  - useProjects() 호출                               │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ Custom Hook (hooks.ts)                              │
│  - useQuery({ queryKey, queryFn })                  │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ API Layer (api.ts)                                  │
│  - projectApi.getProjects()                         │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ API Client (apiClient.ts)                           │
│  - axios.get('/api/projects')                       │
│  - Request Interceptor: JWT 토큰 추가                │
│  - Response Interceptor: 에러 처리                   │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ Backend API                                         │
└─────────────────────────────────────────────────────┘
```

**역방향 플로우 (응답)**:
1. Backend → 200 OK + JSON
2. Axios → `response.data` 파싱
3. API Layer → DTO 타입 반환
4. React Query → 캐시 저장, 상태 업데이트
5. Component → 리렌더링, UI 반영

### 3.2 디렉토리 구조

```text
src/
├── features/
│   ├── project/
│   │   ├── api.ts              # API 함수 (projectApi.*)
│   │   ├── hooks.ts            # React Query 훅
│   │   └── CreateProjectForm.tsx
│   ├── issue/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── CreateIssueForm.tsx
│   │   └── EditIssueForm.tsx
│   └── comment/
│       ├── api.ts
│       └── hooks.ts
├── shared/
│   ├── lib/
│   │   ├── apiClient.ts        # Axios 인스턴스
│   │   └── queryClient.ts      # React Query 설정
│   ├── types/
│   │   └── api.ts              # 공통 DTO 타입
│   └── components/
│       ├── QueryStateHandler.tsx  # 공통 로딩/에러 처리
│       └── EmptyState.tsx
└── app/
    └── routes/
        ├── ProjectsPage.tsx
        ├── ProjectIssuesPage.tsx
        └── IssueDetailPage.tsx
```

---

## 4. 레이어별 상세 설계

### 4.1 API Client 레이어 (apiClient.ts)

**책임**: Axios 인스턴스 생성, 인터셉터 설정

**구현**:
```ts
import axios from 'axios';
import type { ApiError } from '../types/api';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request 인터셉터: JWT 토큰 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response 인터셉터: 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const apiError: ApiError = error.response.data;

      // 401 Unauthorized: 자동 로그아웃
      if (error.response.status === 401) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }

      return Promise.reject(apiError);
    }

    // 네트워크 에러
    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error occurred',
    } as ApiError);
  }
);

export default apiClient;
```

**동작 포인트**:
- **baseURL**: 모든 요청에 `/api` prefix
- **인증 토큰**: localStorage에서 읽어 Header에 추가
- **401 처리**: 토큰 만료 시 자동 로그인 페이지 이동
- **에러 포맷**: Backend와 일관된 `ApiError` 구조

### 4.2 React Query 설정 (queryClient.ts)

**책임**: QueryClient 전역 설정

**구현**:
```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                        // 실패 시 1회 재시도
      refetchOnWindowFocus: false,     // 윈도우 포커스 시 리페칭 비활성화
      staleTime: 5 * 60 * 1000,        // 5분간 fresh 상태 유지
    },
    mutations: {
      retry: 0,                        // mutation은 재시도 안 함
    },
  },
});
```

**설정 의도**:
- `retry: 1`: 일시적 네트워크 오류 대응, 무한 재시도 방지
- `refetchOnWindowFocus: false`: 개발 중 불필요한 리페칭 방지 (프로덕션에서는 true 권장)
- `staleTime: 5분`: API 부하 감소, 사용자 경험 향상
- `mutations.retry: 0`: 중복 생성 방지

### 4.3 DTO 타입 정의 (shared/types/api.ts)

**책임**: Backend API 스펙과 일치하는 TypeScript 타입

**핵심 타입**:
```ts
export type ISODateTime = string;
export type ISODate = string;

export interface UserDto {
  id: number;
  email: string;
  nickname: string;
  createdAt: ISODateTime;
}

export interface ProjectDto {
  id: number;
  name: string;
  description: string | null;
  createdAt: ISODateTime;
}

export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface IssueDto {
  id: number;
  projectId: number;
  reporterId: number;
  assigneeId: number | null;
  title: string;
  description: string;
  status: IssueStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CommentDto {
  id: number;
  issueId: number;
  authorId: number;
  content: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
}

export interface ApiError {
  code: string;
  message: string;
}
```

**타입 활용**:
- API 함수 반환 타입
- React Query 제네릭 타입
- 컴포넌트 Props 타입

### 4.4 Feature: Project

#### 4.4.1 API 레이어 (features/project/api.ts)

**책임**: Project 관련 API 호출 함수

```ts
import apiClient from '../../shared/lib/apiClient';
import type { ProjectDto, PaginatedResponse } from '../../shared/types/api';

export const projectApi = {
  // 프로젝트 목록 조회
  getProjects: async (page = 1, size = 10): Promise<PaginatedResponse<ProjectDto>> => {
    const response = await apiClient.get('/projects', {
      params: { page, size },
    });
    return response.data;
  },

  // 프로젝트 생성
  createProject: async (data: { name: string; description?: string }): Promise<ProjectDto> => {
    const response = await apiClient.post('/projects', data);
    return response.data;
  },
};
```

#### 4.4.2 React Query 훅 (features/project/hooks.ts)

**책임**: 컴포넌트에서 사용할 React Query 훅

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from './api';

// 프로젝트 목록 조회
export const useProjects = (page = 1, size = 10) => {
  return useQuery({
    queryKey: ['projects', { page, size }],
    queryFn: () => projectApi.getProjects(page, size),
  });
};

// 프로젝트 생성
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectApi.createProject,
    onSuccess: () => {
      // 생성 성공 시 프로젝트 목록 캐시 무효화 (자동 리페칭)
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
```

**쿼리 키 전략**:
- `['projects', { page, size }]`: 페이지별 별도 캐시
- `invalidateQueries({ queryKey: ['projects'] })`: 모든 페이지 캐시 무효화

#### 4.4.3 폼 컴포넌트 (CreateProjectForm.tsx)

**책임**: 프로젝트 생성 폼 UI 및 검증

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../shared/components/Button';
import { useCreateProject } from './hooks';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().optional(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

interface CreateProjectFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateProjectForm({ onSuccess, onCancel }: CreateProjectFormProps) {
  const createProject = useCreateProject();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
  });

  const onSubmit = async (data: CreateProjectFormData) => {
    try {
      await createProject.mutateAsync(data);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name *
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
          placeholder="Enter project name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description (Optional)
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
          placeholder="Enter project description"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
```

**동작 플로우**:
1. 사용자 입력 → `register()` 바인딩
2. Submit → `zodResolver`가 검증
3. 검증 통과 → `onSubmit` 호출
4. `createProject.mutateAsync()` → API 요청
5. 성공 → `onSuccess()` 콜백 (예: 모달 닫기)
6. 실패 → 콘솔 에러 로그 (향후 toast 메시지 예정)

### 4.5 Feature: Issue

#### 4.5.1 API 레이어 (features/issue/api.ts)

```ts
import apiClient from '../../shared/lib/apiClient';
import type { IssueDto, PaginatedResponse, IssueStatus } from '../../shared/types/api';

export const issueApi = {
  // 프로젝트별 이슈 목록
  getProjectIssues: async (
    projectId: number,
    params: { status?: IssueStatus; page?: number; size?: number }
  ): Promise<PaginatedResponse<IssueDto>> => {
    const response = await apiClient.get(`/projects/${projectId}/issues`, { params });
    return response.data;
  },

  // 이슈 상세 조회
  getIssue: async (issueId: number): Promise<IssueDto> => {
    const response = await apiClient.get(`/issues/${issueId}`);
    return response.data;
  },

  // 이슈 생성
  createIssue: async (
    projectId: number,
    data: { title: string; description: string; assigneeId?: number }
  ): Promise<IssueDto> => {
    const response = await apiClient.post(`/projects/${projectId}/issues`, data);
    return response.data;
  },

  // 이슈 수정
  updateIssue: async (
    issueId: number,
    data: { title: string; description: string; status: IssueStatus; assigneeId?: number }
  ): Promise<IssueDto> => {
    const response = await apiClient.put(`/issues/${issueId}`, data);
    return response.data;
  },

  // 이슈 삭제
  deleteIssue: async (issueId: number): Promise<void> => {
    await apiClient.delete(`/issues/${issueId}`);
  },
};
```

#### 4.5.2 React Query 훅 (features/issue/hooks.ts)

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issueApi } from './api';
import type { IssueStatus } from '../../shared/types/api';

// 프로젝트별 이슈 목록
export const useProjectIssues = (
  projectId: number,
  status?: IssueStatus,
  page = 1,
  size = 20
) => {
  return useQuery({
    queryKey: ['projects', projectId, 'issues', { status, page, size }],
    queryFn: () => issueApi.getProjectIssues(projectId, { status, page, size }),
    enabled: !!projectId,
  });
};

// 이슈 상세
export const useIssue = (issueId: number) => {
  return useQuery({
    queryKey: ['issues', issueId],
    queryFn: () => issueApi.getIssue(issueId),
    enabled: !!issueId,
  });
};

// 이슈 생성
export const useCreateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: any }) =>
      issueApi.createIssue(projectId, data),
    onSuccess: (_, variables) => {
      // 해당 프로젝트의 이슈 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ['projects', variables.projectId, 'issues'],
      });
    },
  });
};

// 이슈 수정
export const useUpdateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ issueId, data }: { issueId: number; data: any }) =>
      issueApi.updateIssue(issueId, data),
    onSuccess: (updatedIssue) => {
      // 상세 캐시 업데이트
      queryClient.setQueryData(['issues', updatedIssue.id], updatedIssue);
      // 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ['projects', updatedIssue.projectId, 'issues'],
      });
    },
  });
};

// 이슈 삭제
export const useDeleteIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: issueApi.deleteIssue,
    onSuccess: (_, issueId) => {
      // 모든 이슈 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
```

**쿼리 키 전략 (계층 구조)**:
```ts
['projects', projectId, 'issues', { status, page, size }]
['issues', issueId]
```

**캐시 무효화 전략**:
- 생성: 특정 프로젝트의 이슈 목록만 무효화
- 수정: 상세는 직접 업데이트 (`setQueryData`), 목록은 무효화
- 삭제: 모든 이슈 관련 쿼리 무효화

### 4.6 공통 컴포넌트

#### 4.6.1 QueryStateHandler

**책임**: React Query 상태에 따라 로딩/에러/빈 상태 처리

```tsx
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { EmptyState } from './EmptyState';

interface QueryStateHandlerProps<T> {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
  emptyMessage?: string;
}

export function QueryStateHandler<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty,
  children,
  emptyMessage = 'No data available',
}: QueryStateHandlerProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return <ErrorMessage message={error?.message || 'An error occurred'} />;
  }

  if (!data || (isEmpty && isEmpty(data))) {
    return <EmptyState message={emptyMessage} />;
  }

  return <>{children(data)}</>;
}
```

**사용 예시**:
```tsx
<QueryStateHandler
  isLoading={isLoading}
  isError={isError}
  error={error}
  data={data}
  isEmpty={(data) => data.items.length === 0}
  emptyMessage="No projects found"
>
  {(projects) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.items.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )}
</QueryStateHandler>
```

---

## 5. 페이지 구현

### 5.1 ProjectsPage

**책임**: 프로젝트 목록 표시, 생성 폼 모달

**핵심 로직**:
```tsx
import { useState } from 'react';
import { useProjects } from '../../features/project/hooks';
import { CreateProjectForm } from '../../features/project/CreateProjectForm';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';

export function ProjectsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useProjects(page, 10);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>New Project</Button>
      </div>

      <QueryStateHandler
        isLoading={isLoading}
        isError={isError}
        error={error}
        data={data}
        isEmpty={(data) => data.items.length === 0}
      >
        {(projects) => (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.items.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            {/* 페이지네이션 */}
            <div className="flex justify-center gap-2 mt-6">
              <Button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                variant="outline"
              >
                Previous
              </Button>
              <span className="px-4 py-2">Page {page}</span>
              <Button
                disabled={projects.items.length < 10}
                onClick={() => setPage(page + 1)}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </>
        )}
      </QueryStateHandler>

      {/* 생성 모달 */}
      {isCreateModalOpen && (
        <Modal onClose={() => setIsCreateModalOpen(false)}>
          <CreateProjectForm
            onSuccess={() => setIsCreateModalOpen(false)}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
```

### 5.2 IssueDetailPage

**책임**: 이슈 상세, 수정/삭제, 댓글 목록

**핵심 로직**:
```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useIssue, useDeleteIssue } from '../../features/issue/hooks';
import { EditIssueForm } from '../../features/issue/EditIssueForm';
import { CommentList } from '../../features/comment/CommentList';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';

export function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const { data: issue, isLoading, isError, error } = useIssue(Number(issueId));
  const deleteIssue = useDeleteIssue();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this issue?')) return;

    try {
      await deleteIssue.mutateAsync(Number(issueId));
      navigate('/issues');
    } catch (error) {
      console.error('Failed to delete issue:', error);
    }
  };

  return (
    <QueryStateHandler
      isLoading={isLoading}
      isError={isError}
      error={error}
      data={issue}
    >
      {(issue) => (
        <div>
          {isEditing ? (
            <EditIssueForm
              issue={issue}
              onSuccess={() => setIsEditing(false)}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                  <h1 className="text-3xl font-bold">{issue.title}</h1>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsEditing(true)} variant="outline">
                      Edit
                    </Button>
                    <Button onClick={handleDelete} variant="danger">
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p><strong>Status:</strong> {issue.status}</p>
                  <p><strong>Description:</strong> {issue.description}</p>
                </div>
              </div>

              <CommentList issueId={issue.id} />
            </>
          )}
        </div>
      )}
    </QueryStateHandler>
  );
}
```

---

## 6. 테스트 전략

### 6.1 유닛 테스트

**테스트 대상**: CreateProjectForm

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { CreateProjectForm } from './CreateProjectForm';
import { queryClient } from '../../shared/lib/queryClient';

describe('CreateProjectForm', () => {
  it('shows validation error when name is empty', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CreateProjectForm />
      </QueryClientProvider>
    );

    const submitButton = screen.getByRole('button', { name: /create project/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess when form is submitted successfully', async () => {
    const onSuccess = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CreateProjectForm onSuccess={onSuccess} />
      </QueryClientProvider>
    );

    await userEvent.type(screen.getByLabelText(/name/i), 'Test Project');
    await userEvent.type(screen.getByLabelText(/description/i), 'Test Description');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
```

### 6.2 통합 테스트

**시나리오**: ProjectsPage에서 프로젝트 생성

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ProjectsPage } from './ProjectsPage';
import { queryClient } from '../../shared/lib/queryClient';

describe('ProjectsPage Integration', () => {
  it('creates a new project and displays it in the list', async () => {
    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ProjectsPage />
        </QueryClientProvider>
      </BrowserRouter>
    );

    // "New Project" 버튼 클릭
    await userEvent.click(screen.getByRole('button', { name: /new project/i }));

    // 폼 입력
    await userEvent.type(screen.getByLabelText(/name/i), 'Integration Test Project');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    // 생성된 프로젝트가 목록에 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText('Integration Test Project')).toBeInTheDocument();
    });
  });
});
```

---

## 7. 알려진 제약 & 향후 개선점

### 7.1 현재 제약

1. **낙관적 업데이트 미구현**:
   - 현재는 mutation 후 서버 응답 대기
   - 개선: `onMutate`에서 즉시 캐시 업데이트

2. **에러 처리 단순**:
   - 콘솔 로그만 출력
   - 개선: Toast 메시지 라이브러리 (react-hot-toast)

3. **페이지네이션 UX**:
   - 총 페이지 수 미표시
   - 개선: `totalCount` 기반 페이지 번호 표시

4. **모달 컴포넌트 미완성**:
   - 기본 구조만 구현
   - 개선: 접근성 강화 (focus trap, ESC 키)

### 7.2 향후 개선점

**Milestone 3**:
- 인증 기반 API 호출 테스트
- 401/403 에러 처리 강화

**Milestone 4**:
- React Query DevTools 활용
- 캐시 전략 최적화

**Milestone 6**:
- E2E 테스트 (Issue 생성 → 수정 → 삭제)
- API 모킹 (MSW)

---

## 8. 체크리스트 (Milestone 2 완료 기준)

- [x] Axios 인스턴스 설정 (apiClient.ts)
- [x] React Query 전역 설정 (queryClient.ts)
- [x] DTO 타입 정의 (ProjectDto, IssueDto, CommentDto)
- [x] Project API 레이어 구현
- [x] Issue API 레이어 구현
- [x] Comment API 레이어 구현
- [x] useProjects, useCreateProject 훅 구현
- [x] useProjectIssues, useIssue, useCreateIssue, useUpdateIssue, useDeleteIssue 훅 구현
- [x] CreateProjectForm 컴포넌트 (react-hook-form + zod)
- [x] CreateIssueForm 컴포넌트
- [x] EditIssueForm 컴포넌트
- [x] ProjectsPage 구현 (목록 + 페이지네이션)
- [x] ProjectIssuesPage 구현 (필터링 + 페이지네이션)
- [x] IssueDetailPage 구현 (상세 + 수정 + 삭제 + 댓글)
- [x] QueryStateHandler 공통 컴포넌트
- [x] EmptyState, ErrorMessage 컴포넌트
- [x] CreateProjectForm 유닛 테스트
- [x] CreateIssueForm 유닛 테스트
- [x] ProjectIssuesPage 통합 테스트

---

**이 설계를 기반으로 Milestone 3에서 인증/인가 시스템과 팀 관리 기능을 구축합니다.**
