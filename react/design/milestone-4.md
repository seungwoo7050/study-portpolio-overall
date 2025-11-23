# Milestone 4 – 통계/데이터 패칭 패턴 설계 일지
> 다양한 데이터 패칭 패턴, 통계 대시보드, 외부 API 연동, React Query 고급 기능 활용 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 3까지 구축한 기반 위에 다양한 데이터 패칭 시나리오 구현:
- 일별 이슈 통계 대시보드 (기간 선택 + 차트)
- 인기 이슈 조회 (staleTime 활용)
- 외부 API 연동 및 에러 처리
- 로딩/에러/빈 상태 UI 패턴 표준화
- React Query 고급 기능 (polling, 의존성 쿼리, 병렬 쿼리)

### 1.2 기능 요구사항

#### 1.2.1 대상 API

**통계 API**:
- `GET /api/stats/daily?from={date}&to={date}` - 일별 이슈 통계
  - 응답: `{ items: DailyIssueStatsDto[] }`
  - `DailyIssueStatsDto`: `{ date, createdCount, resolvedCount, commentCount, createdAt }`

**인기 이슈 API**:
- `GET /api/issues/popular?days={number}&limit={number}` - 인기 이슈 목록
  - 응답: `{ items: PopularIssueDto[] }`
  - `PopularIssueDto`: `{ issue, viewCount, commentCount, score }`

**외부 API**:
- `GET /api/external/example` - 외부 API 프록시
  - 응답: `{ source, data }`
  - 타임아웃/실패 시 502 또는 500

#### 1.2.2 구현 화면

1. **통계 대시보드** (`/stats`):
   - 기간 선택 (from, to 날짜 입력)
   - 일별 이슈 통계 차트 (막대 그래프)
   - 범례: Created (파란색), Resolved (녹색), Comments (보라색)
   - 로딩/에러 상태 처리

2. **인기 이슈 페이지** (`/popular`):
   - 기간 선택 (최근 7일, 30일, 90일)
   - 인기 이슈 테이블 (제목, 조회수, 댓글수, 점수)
   - staleTime 5분 설정 (빈번한 리페칭 방지)

3. **외부 API 페이지** (`/external`):
   - 외부 API 데이터 표시
   - 타임아웃 처리 (30초)
   - 재시도 버튼
   - 에러 메시지 상세 표시

#### 1.2.3 차트 컴포넌트

**DailyStatsChart**:
- Props: `data: DailyIssueStatsDto[]`
- 3개 막대 (created, resolved, comments)
- 반응형 레이아웃
- 날짜 포맷: "Jan 30"
- 호버 시 정확한 값 표시 (title 속성)

### 1.3 비기능 요구사항

#### 1.3.1 성능
- **staleTime 전략**: 용도별 차등 적용
  - 통계: 1분 (자주 변경)
  - 인기 이슈: 5분 (상대적으로 안정적)
  - 외부 API: 10분 (외부 API 부하 감소)
- **폴링**: 실시간성 필요 시 10초 간격
- **병렬 쿼리**: 독립적인 데이터는 동시 요청

#### 1.3.2 사용자 경험
- **로딩 스켈레톤**: 차트는 스켈레톤 UI (빈 회색 박스)
- **에러 복구**: "Retry" 버튼 제공
- **빈 상태**: "No data available for selected period"

#### 1.3.3 코드 품질
- **공통 컴포넌트**: QueryStateHandler 재사용
- **커스텀 훅**: useQueryParams (URL 쿼리스트링 동기화)
- **타입 안정성**: API 응답 DTO 타입 정의

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 staleTime을 다르게 설정하는가?

**staleTime의 의미**:
- "이 데이터가 얼마나 오래 fresh 상태로 유지되는가?"
- fresh 상태: 캐시에서 즉시 반환, 백그라운드 리페칭 안 함
- stale 상태: 캐시에서 반환하지만, 백그라운드 리페칭 시작

**용도별 staleTime 전략**:

| 데이터 유형 | staleTime | 이유 |
|-------------|-----------|------|
| 통계 (일별) | 1분 | 자주 업데이트됨, 최신 데이터 중요 |
| 인기 이슈 | 5분 | 상대적으로 안정적, 서버 부하 감소 |
| 외부 API | 10분 | 외부 API 호출 비용, 느린 응답 |
| 사용자 프로필 | Infinity | 로그아웃 전까지 변경 없음 |
| 실시간 알림 | 10초 | 실시간성 중요, 폴링 필요 |

**트레이드오프**:
- staleTime 짧음: 최신 데이터, 서버 부하 ↑
- staleTime 긺: 서버 부하 ↓, 오래된 데이터 가능

### 2.2 차트 라이브러리 선택

**후보**:
1. **Chart.js**: 가장 인기 있는 차트 라이브러리
2. **Recharts**: React 전용, 선언적 API
3. **D3.js**: 매우 유연, 러닝 커브 높음
4. **직접 구현 (CSS + SVG)**: 간단한 막대 그래프는 가능

**Milestone 4 선택: 직접 구현**
- **이유**:
  - 간단한 막대 그래프만 필요
  - 번들 크기 증가 없음
  - Tailwind CSS로 스타일링
  - 학습 목적 (차트 원리 이해)

**구현 방식**:
```tsx
<div className="flex items-end gap-4 h-64">
  {data.map((item) => (
    <div className="flex flex-col items-center">
      <div
        className="w-full bg-blue-500 rounded-t"
        style={{ height: `${(item.createdCount / maxValue) * 100}%` }}
      />
      <span className="text-xs">{item.date}</span>
    </div>
  ))}
</div>
```

### 2.3 외부 API 연동 패턴

**프록시 vs 직접 호출**:

| 방식 | 장점 | 단점 |
|------|------|------|
| Backend 프록시 | CORS 해결, 인증 숨김 | 서버 부하 |
| 직접 호출 | 서버 부하 없음 | CORS, 인증 노출 |

**Milestone 4 선택: Backend 프록시**
- API 경로: `/api/external/example`
- Backend에서 외부 API 호출 후 결과 반환
- 타임아웃/재시도 로직 서버 구현

---

## 3. 레이어별 상세 설계

### 3.1 통계 API 레이어 (features/stats/api.ts)

```ts
import apiClient from '../../shared/lib/apiClient';
import type { DailyIssueStatsDto } from '../../shared/types/api';

export const statsApi = {
  // 일별 이슈 통계
  getDailyStats: async (from: string, to: string): Promise<{ items: DailyIssueStatsDto[] }> => {
    const response = await apiClient.get('/stats/daily', {
      params: { from, to },
    });
    return response.data;
  },
};
```

### 3.2 통계 훅 (features/stats/hooks.ts)

```ts
import { useQuery } from '@tanstack/react-query';
import { statsApi } from './api';

export const useDailyStats = (from: string, to: string) => {
  return useQuery({
    queryKey: ['stats', 'daily', { from, to }],
    queryFn: () => statsApi.getDailyStats(from, to),
    staleTime: 1 * 60 * 1000, // 1분
    enabled: !!from && !!to, // from, to가 있을 때만 실행
  });
};
```

**enabled 옵션**:
- 날짜가 선택되지 않으면 쿼리 실행 안 함
- 사용자가 날짜 선택 완료 후 자동 요청

### 3.3 DailyStatsChart 컴포넌트

```tsx
import type { DailyIssueStatsDto } from '../../shared/types/api';

interface DailyStatsChartProps {
  data: DailyIssueStatsDto[];
}

export const DailyStatsChart = ({ data }: DailyStatsChartProps) => {
  if (data.length === 0) {
    return null;
  }

  const maxValue = Math.max(
    ...data.flatMap((item) => [item.createdCount, item.resolvedCount, item.commentCount])
  );

  const getBarHeight = (value: number) => {
    if (maxValue === 0) return '0%';
    return `${(value / maxValue) * 100}%`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="flex items-end gap-4 h-64 p-4 bg-gray-50 rounded-lg">
          {data.map((item) => (
            <div key={item.date} className="flex flex-col items-center flex-1 min-w-[120px]">
              <div className="flex items-end justify-center gap-1 h-48 w-full">
                {/* Created */}
                <div
                  className="w-full bg-blue-500 rounded-t transition-all"
                  style={{ height: getBarHeight(item.createdCount) }}
                  title={`Created: ${item.createdCount}`}
                />
                {/* Resolved */}
                <div
                  className="w-full bg-green-500 rounded-t transition-all"
                  style={{ height: getBarHeight(item.resolvedCount) }}
                  title={`Resolved: ${item.resolvedCount}`}
                />
                {/* Comments */}
                <div
                  className="w-full bg-purple-500 rounded-t transition-all"
                  style={{ height: getBarHeight(item.commentCount) }}
                  title={`Comments: ${item.commentCount}`}
                />
              </div>
              <div className="text-xs text-gray-600 mt-2 text-center">
                {new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span className="text-sm text-gray-700">Created</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-sm text-gray-700">Resolved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded" />
            <span className="text-sm text-gray-700">Comments</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 3.4 StatsDashboardPage

```tsx
import { useState } from 'react';
import { useDailyStats } from '../../features/stats/hooks';
import { DailyStatsChart } from '../../features/stats/DailyStatsChart';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';

export function StatsDashboardPage() {
  const [from, setFrom] = useState('2025-01-01');
  const [to, setTo] = useState('2025-01-31');

  const { data, isLoading, isError, error, refetch } = useDailyStats(from, to);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Statistics Dashboard</h1>

      {/* 기간 선택 */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="from" className="block text-sm font-medium text-gray-700 mb-1">
              From
            </label>
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            />
          </div>
          <div>
            <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
              To
            </label>
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => refetch()} variant="outline">
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="bg-white shadow rounded-lg p-6">
        <QueryStateHandler
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          isEmpty={(data) => data.items.length === 0}
          emptyMessage="No data available for selected period"
        >
          {(stats) => <DailyStatsChart data={stats.items} />}
        </QueryStateHandler>
      </div>
    </div>
  );
}
```

### 3.5 인기 이슈 패턴

#### 3.5.1 API 및 훅

```ts
// features/issue/api.ts
export const issueApi = {
  // 기존 함수들...

  getPopularIssues: async (days = 7, limit = 10): Promise<{ items: PopularIssueDto[] }> => {
    const response = await apiClient.get('/issues/popular', {
      params: { days, limit },
    });
    return response.data;
  },
};

// features/issue/hooks.ts
export const usePopularIssues = (days = 7, limit = 10) => {
  return useQuery({
    queryKey: ['issues', 'popular', { days, limit }],
    queryFn: () => issueApi.getPopularIssues(days, limit),
    staleTime: 5 * 60 * 1000, // 5분
  });
};
```

#### 3.5.2 PopularIssuesPage

```tsx
import { useState } from 'react';
import { usePopularIssues } from '../../features/issue/hooks';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';

export function PopularIssuesPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, error } = usePopularIssues(days, 10);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Popular Issues</h1>

      {/* 기간 선택 */}
      <div className="mb-6">
        <div className="flex gap-2">
          <Button
            variant={days === 7 ? 'primary' : 'outline'}
            onClick={() => setDays(7)}
          >
            Last 7 days
          </Button>
          <Button
            variant={days === 30 ? 'primary' : 'outline'}
            onClick={() => setDays(30)}
          >
            Last 30 days
          </Button>
          <Button
            variant={days === 90 ? 'primary' : 'outline'}
            onClick={() => setDays(90)}
          >
            Last 90 days
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <QueryStateHandler
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          isEmpty={(data) => data.items.length === 0}
        >
          {(popular) => (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {popular.items.map((item) => (
                  <tr key={item.issue.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a href={`/issues/${item.issue.id}`} className="text-blue-600 hover:underline">
                        {item.issue.title}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.viewCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.commentCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QueryStateHandler>
      </div>
    </div>
  );
}
```

### 3.6 외부 API 연동

#### 3.6.1 API 및 훅

```ts
// features/external/api.ts
import apiClient from '../../shared/lib/apiClient';

export const externalApi = {
  getExample: async (): Promise<{ source: string; data: any }> => {
    const response = await apiClient.get('/external/example', {
      timeout: 30000, // 30초 타임아웃
    });
    return response.data;
  },
};

// features/external/hooks.ts
export const useExternalExample = () => {
  return useQuery({
    queryKey: ['external', 'example'],
    queryFn: externalApi.getExample,
    staleTime: 10 * 60 * 1000, // 10분
    retry: 2, // 2회 재시도
  });
};
```

#### 3.6.2 ExternalApiPage

```tsx
import { useExternalExample } from '../../features/external/hooks';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';

export function ExternalApiPage() {
  const { data, isLoading, isError, error, refetch } = useExternalExample();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">External API</h1>
        <Button onClick={() => refetch()} variant="outline">
          Refresh
        </Button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <QueryStateHandler
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
        >
          {(result) => (
            <div>
              <h2 className="text-xl font-semibold mb-4">Source: {result.source}</h2>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </QueryStateHandler>
      </div>
    </div>
  );
}
```

---

## 4. React Query 고급 패턴

### 4.1 의존성 쿼리 (Dependent Queries)

**시나리오**: 사용자 정보 로드 후 → 사용자의 프로젝트 로드

```tsx
const { data: user } = useCurrentUser();

const { data: projects } = useQuery({
  queryKey: ['users', user?.id, 'projects'],
  queryFn: () => projectApi.getUserProjects(user!.id),
  enabled: !!user, // user가 로드된 후에만 실행
});
```

### 4.2 병렬 쿼리 (Parallel Queries)

**시나리오**: 팀 상세 페이지에서 팀 정보 + 멤버 목록 동시 로드

```tsx
const { data: team } = useQuery({
  queryKey: ['teams', teamId],
  queryFn: () => teamApi.getTeam(teamId),
});

const { data: members } = useQuery({
  queryKey: ['teams', teamId, 'members'],
  queryFn: () => teamApi.getTeamMembers(teamId),
});

// 두 쿼리가 병렬로 실행됨
```

### 4.3 폴링 (Polling)

**시나리오**: 실시간 알림 (10초마다 업데이트)

```tsx
const { data: notifications } = useQuery({
  queryKey: ['notifications'],
  queryFn: notificationApi.getNotifications,
  refetchInterval: 10 * 1000, // 10초마다 리페칭
  refetchIntervalInBackground: false, // 탭이 백그라운드일 때는 멈춤
});
```

### 4.4 수동 리페칭

**시나리오**: "Refresh" 버튼 클릭 시

```tsx
const { data, refetch } = useQuery({
  queryKey: ['stats', 'daily'],
  queryFn: statsApi.getDailyStats,
});

<Button onClick={() => refetch()}>Refresh</Button>
```

---

## 5. 에러 처리 패턴

### 5.1 전역 에러 처리 (apiClient)

**이미 구현된 인터셉터**:
```ts
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const apiError: ApiError = error.response.data;

      if (error.response.status === 401) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }

      return Promise.reject(apiError);
    }

    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error occurred',
    } as ApiError);
  }
);
```

### 5.2 컴포넌트 레벨 에러 처리

**QueryStateHandler 재사용**:
```tsx
<QueryStateHandler
  isLoading={isLoading}
  isError={isError}
  error={error}
  data={data}
>
  {(data) => <div>{/* 정상 UI */}</div>}
</QueryStateHandler>
```

**커스텀 에러 메시지**:
```tsx
if (isError) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 className="text-red-800 font-semibold">Error</h3>
      <p className="text-red-600">{error?.message}</p>
      <Button onClick={() => refetch()} variant="outline" className="mt-2">
        Try Again
      </Button>
    </div>
  );
}
```

---

## 6. 알려진 제약 & 향후 개선점

### 6.1 현재 제약

1. **차트 라이브러리 미사용**:
   - 직접 구현으로 기능 제한적
   - 개선: Recharts 도입 (복잡한 차트 필요 시)

2. **폴링 미구현**:
   - 실시간 업데이트 없음
   - 개선: WebSocket 또는 Server-Sent Events

3. **에러 메시지 UX**:
   - 에러 코드별 다른 메시지 미구현
   - 개선: `switch (error.code)` 분기

### 6.2 향후 개선점

**Milestone 5**:
- 성능 최적화 (React.memo, useMemo)

**Milestone 6**:
- 통합 테스트 (차트 렌더링, 에러 처리)

---

## 7. 체크리스트 (Milestone 4 완료 기준)

- [x] statsApi 구현 (getDailyStats)
- [x] useDailyStats 훅 (staleTime 1분)
- [x] DailyStatsChart 컴포넌트 (3색 막대 그래프)
- [x] StatsDashboardPage (기간 선택 + 차트)
- [x] usePopularIssues 훅 (staleTime 5분)
- [x] PopularIssuesPage (기간 버튼 + 테이블)
- [x] externalApi 구현 (타임아웃 30초)
- [x] useExternalExample 훅 (staleTime 10분, retry 2)
- [x] ExternalApiPage (JSON 표시 + Refresh 버튼)
- [x] QueryStateHandler 공통 컴포넌트 활용
- [x] 의존성 쿼리 패턴 문서화
- [x] 병렬 쿼리 패턴 문서화
- [x] 에러 처리 표준화

---

**이 설계를 기반으로 Milestone 5에서 검색/필터 UI 및 성능 최적화를 구축합니다.**
