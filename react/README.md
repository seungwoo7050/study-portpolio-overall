# React 웹 패턴 훈련 프로젝트 – 단일 프론트 리포지토리 설계

## 1. 개요

**목적**

* 단일 React + TypeScript 프로젝트로

  * CRUD 화면
  * 인증/인가
  * 팀/역할(RBAC)
  * 통계/대시보드
  * 검색/필터
  * 테스트/E2E/기본 접근성
    을 연습한다.
* 백엔드는 “이 문서의 API 스펙을 만족하는 아무 구현"이면 된다.

  * 실제 백엔드가 없으면 json-server, MSW 등으로 mock 해도 된다.

---

## 2. 기술 스택 및 프로젝트 구조

### 2.1 기술 스택 (권장)

* React 18
* TypeScript
* Vite (React + TS 템플릿)
* React Router v6
* React Query (TanStack Query)
* react-hook-form + zod
* Tailwind CSS
* Jest + React Testing Library
* E2E: Cypress 또는 Playwright

### 2.2 프로젝트 구조(예시)

```text
frontend/
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    app/
      App.tsx
      routes/
      layouts/
    shared/
      components/
      hooks/
      lib/
        apiClient.ts
        queryClient.ts
    features/
      auth/
      user/
      issue/
      project/
      comment/
      team/
      workspace/
      stats/
      search/
  tests/
    e2e/
```

---

## 3. API 공통 스펙

백엔드는 다음 규칙을 따른다고 가정한다.

### 3.1 기본

* API Base URL: `/api`
* 모든 요청/응답은 `application/json`
* 시간/날짜:

  * `ISODateTime = string` (예: `"2025-01-30T10:15:30.123Z"`)
  * `ISODate = string` (예: `"2025-01-30"`)

### 3.2 인증

* 인증 방식: Bearer JWT

```http
Authorization: Bearer <access_token>
```

* 로그인 성공 시:

  * `accessToken` (JWT)
  * `user` 정보 반환
* 대부분의 API는 인증 필요. “(public)"이라고 명시된 것만 예외.

### 3.3 에러 응답 공통 포맷

모든 에러는 HTTP 상태코드 + 아래 JSON 포맷:

```json
{
  "code": "ISSUE_NOT_FOUND",
  "message": "Issue not found"
}
```

대표 코드 예시:

* 공통

  * `BAD_REQUEST`
  * `UNAUTHORIZED`
  * `FORBIDDEN`
  * `NOT_FOUND`
  * `CONFLICT`
  * `INTERNAL_SERVER_ERROR`
* 도메인별 예시

  * `ISSUE_NOT_FOUND`
  * `PROJECT_NOT_FOUND`
  * `TEAM_NOT_FOUND`
  * `TEAM_FORBIDDEN`
  * `PRODUCT_NOT_FOUND`
  * …

프론트에서는 `code`를 기준으로 분기.

### 3.4 페이지네이션 규칙

요청:

```http
?page=<number>&size=<number>
```

응답:

```json
{
  "items": [ /* ... */ ],
  "totalCount": 123
}
```

---

## 4. DTO 타입 정의 (프론트에서 사용하는 모델)

TypeScript 타입 관점 정의:

```ts
type ISODateTime = string;
type ISODate = string;

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

export interface TeamDto {
  id: number;
  name: string;
  createdAt: ISODateTime;
}

export type TeamRole = 'OWNER' | 'MANAGER' | 'MEMBER';

export interface TeamMemberDto {
  id: number;
  teamId: number;
  userId: number;
  role: TeamRole;
  joinedAt: ISODateTime;
  user: Pick<UserDto, 'id' | 'email' | 'nickname'>;
}

export interface WorkspaceItemDto {
  id: number;
  teamId: number;
  title: string;
  content: string;
  createdBy: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DailyIssueStatsDto {
  date: ISODate;
  createdCount: number;
  resolvedCount: number;
  commentCount: number;
  createdAt: ISODateTime;
}

export interface PopularIssueDto {
  issue: IssueDto;
  viewCount: number;
  commentCount: number;
  score: number; // 정렬 기준
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductDto {
  id: number;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  status: ProductStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

---

## 5. API 상세 스펙

### 5.1 인증 / 사용자

#### 5.1.1 회원가입

`POST /api/users` (public)

**Request**

```json
{
  "email": "user@example.com",
  "password": "plain-text-or-whatever-backend-정의",
  "nickname": "승우"
}
```

**Response 201**

```json
{
  "id": 1,
  "email": "user@example.com",
  "nickname": "승우",
  "createdAt": "2025-01-30T10:15:30.123Z"
}
```

에러:

* 400 `BAD_REQUEST` (중복 이메일, 형식 오류 등)
* 409 `CONFLICT` (이미 존재하는 이메일)

#### 5.1.2 로그인

`POST /api/auth/login` (public)

**Request**

```json
{
  "email": "user@example.com",
  "password": "..."
}
```

**Response 200**

```json
{
  "accessToken": "jwt-token-string",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "nickname": "승우",
    "createdAt": "2025-01-30T10:15:30.123Z"
  }
}
```

에러:

* 401 `UNAUTHORIZED` (잘못된 이메일/비밀번호)

#### 5.1.3 현재 사용자 조회

`GET /api/auth/me` (auth 필요)

**Response 200**

```json
{
  "id": 1,
  "email": "user@example.com",
  "nickname": "승우",
  "createdAt": "2025-01-30T10:15:30.123Z"
}
```

에러:

* 401 `UNAUTHORIZED`

---

### 5.2 프로젝트 / 이슈 / 댓글

#### 5.2.1 프로젝트 생성

`POST /api/projects` (auth 필요)

**Request**

```json
{
  "name": "My Project",
  "description": "Optional description"
}
```

**Response 201**

`ProjectDto`

#### 5.2.2 프로젝트 목록 조회

`GET /api/projects` (auth 필요)

쿼리:

* `page?: number`
* `size?: number`

**Response 200**

```json
{
  "items": [
    {
      "id": 1,
      "name": "My Project",
      "description": "Optional",
      "createdAt": "2025-01-30T10:15:30.123Z"
    }
  ],
  "totalCount": 1
}
```

---

#### 5.2.3 이슈 생성

`POST /api/projects/{projectId}/issues` (auth 필요)

**Request**

```json
{
  "title": "이슈 제목",
  "description": "이슈 설명",
  "assigneeId": 2
}
```

**Response 201**

`IssueDto`

에러:

* 404 `PROJECT_NOT_FOUND`

#### 5.2.4 프로젝트별 이슈 목록

`GET /api/projects/{projectId}/issues` (auth 필요)

쿼리:

* `status?: IssueStatus`
* `page?: number`
* `size?: number`

**Response 200**

```json
{
  "items": [ /* IssueDto */ ],
  "totalCount": 42
}
```

에러:

* 404 `PROJECT_NOT_FOUND`

#### 5.2.5 이슈 상세 조회

`GET /api/issues/{issueId}` (auth 필요)

**Response 200**

`IssueDto`

에러:

* 404 `ISSUE_NOT_FOUND`

#### 5.2.6 이슈 수정

`PUT /api/issues/{issueId}` (auth 필요)

**Request**

```json
{
  "title": "수정된 제목",
  "description": "수정된 설명",
  "status": "IN_PROGRESS",
  "assigneeId": 3
}
```

**Response 200**

`IssueDto`

에러:

* 404 `ISSUE_NOT_FOUND`

#### 5.2.7 이슈 삭제

`DELETE /api/issues/{issueId}` (auth 필요)

**Response 204**

에러:

* 404 `ISSUE_NOT_FOUND`

---

#### 5.2.8 댓글 생성

`POST /api/issues/{issueId}/comments` (auth 필요)

**Request**

```json
{
  "content": "댓글 내용"
}
```

**Response 201**

`CommentDto`

에러:

* 404 `ISSUE_NOT_FOUND`

#### 5.2.9 댓글 목록 조회

`GET /api/issues/{issueId}/comments` (auth 필요)

**Response 200**

```json
{
  "items": [ /* CommentDto */ ],
  "totalCount": 10
}
```

에러:

* 404 `ISSUE_NOT_FOUND`

---

### 5.3 팀 / 팀 멤버 / 워크스페이스

권한 규칙:

* 팀 생성: 로그인 유저가 OWNER로 등록
* 팀 멤버 추가/역할 변경/삭제: OWNER, MANAGER만
* 팀 리소스 접근: 해당 팀 멤버만

#### 5.3.1 팀 생성

`POST /api/teams` (auth 필요)

**Request**

```json
{
  "name": "Team A"
}
```

**Response 201**

`TeamDto`

생성 시 현재 유저가 OWNER로 TeamMember에 자동 추가.

#### 5.3.2 내 팀 목록

`GET /api/teams` (auth 필요)

**Response 200**

```json
{
  "items": [ /* TeamDto */ ],
  "totalCount": 3
}
```

#### 5.3.3 팀 상세 + 일부 멤버 정보

`GET /api/teams/{teamId}` (auth 필요)

**Response 200**

```json
{
  "team": { /* TeamDto */ },
  "members": [
    {
      "id": 1,
      "teamId": 1,
      "userId": 1,
      "role": "OWNER",
      "joinedAt": "2025-01-30T10:15:30.123Z",
      "user": {
        "id": 1,
        "email": "owner@example.com",
        "nickname": "팀장"
      }
    }
  ]
}
```

에러:

* 404 `TEAM_NOT_FOUND` (존재하지 않거나 접근 권한 없는 팀)

---

#### 5.3.4 팀 멤버 추가

`POST /api/teams/{teamId}/members` (auth 필요, OWNER/MANAGER만)

**Request**

```json
{
  "userId": 2,
  "role": "MEMBER"
}
```

**Response 201**

`TeamMemberDto`

에러:

* 403 `TEAM_FORBIDDEN` (권한 없음)

#### 5.3.5 팀 멤버 목록

`GET /api/teams/{teamId}/members` (auth 필요, 팀 멤버만)

**Response 200**

```json
{
  "items": [ /* TeamMemberDto */ ],
  "totalCount": 5
}
```

#### 5.3.6 팀 멤버 역할 변경

`PATCH /api/teams/{teamId}/members/{memberId}` (auth 필요, OWNER/MANAGER)

**Request**

```json
{
  "role": "MANAGER"
}
```

**Response 200**

`TeamMemberDto`

#### 5.3.7 팀 멤버 삭제

`DELETE /api/teams/{teamId}/members/{memberId}` (auth 필요, OWNER/MANAGER)

**Response 204**

---

#### 5.3.8 워크스페이스 아이템 생성

`POST /api/teams/{teamId}/items` (auth 필요, 팀 멤버만)

**Request**

```json
{
  "title": "문서 제목",
  "content": "내용..."
}
```

**Response 201**

`WorkspaceItemDto`

#### 5.3.9 팀별 워크스페이스 아이템 목록

`GET /api/teams/{teamId}/items` (auth 필요, 팀 멤버만)

쿼리: `page`, `size`

**Response 200**

```json
{
  "items": [ /* WorkspaceItemDto */ ],
  "totalCount": 12
}
```

#### 5.3.10 워크스페이스 아이템 상세/수정/삭제

* `GET /api/items/{itemId}` → `WorkspaceItemDto`

* `PUT /api/items/{itemId}`

  ```json
  {
    "title": "수정된 제목",
    "content": "수정된 내용"
  }
  ```

* `DELETE /api/items/{itemId}` → 204

권한: 해당 팀 멤버만.

---

### 5.4 통계 / 인기 이슈 / 외부 API

#### 5.4.1 일별 이슈 통계 조회

`GET /api/stats/daily` (auth 필요)

쿼리:

* `from: ISODate`
* `to: ISODate`

**Response 200**

```json
{
  "items": [ /* DailyIssueStatsDto */ ]
}
```

#### 5.4.2 인기 이슈 조회

`GET /api/issues/popular` (auth 필요)

쿼리:

* `days?: number` (기본 7)
* `limit?: number` (기본 10)

**Response 200**

```json
{
  "items": [ /* PopularIssueDto */ ]
}
```

#### 5.4.3 외부 API 예제

`GET /api/external/example` (auth 필요)

**Response 200 (예시)**

```json
{
  "source": "some-public-api",
  "data": {
    "value": 123,
    "label": "example"
  }
}
```

에러:

* 타임아웃/실패 시 502 또는 500 + 적절한 `code`.

---

### 5.5 상품 검색 (Elasticsearch 기반 검색 API 가정)

#### 5.5.1 상품 검색

`GET /api/search/products` (auth 필요)

쿼리:

* `q?: string` – name/description 검색
* `category?: string`
* `brand?: string`
* `minPrice?: number`
* `maxPrice?: number`
* `page?: number`
* `size?: number`

**Response 200**

```json
{
  "items": [ /* ProductDto */ ],
  "totalCount": 123
}
```

#### 5.5.2 단일 상품 조회

`GET /api/products/{productId}` (auth 필요)

**Response 200**

`ProductDto`

---

## 6. 프론트 마일스톤 (훈련 단계)

### Milestone 1 – 부트스트랩 & 라우팅 & CI

* Vite + React + TS 프로젝트 생성
* React Router로 기본 페이지(`/`, `/login`, `/projects`, `/issues`, `/teams`) 라우팅
* 공통 레이아웃(헤더/사이드바)
* Tailwind 세팅 + Button 등 기본 컴포넌트
* CI:

  * `npm ci`
  * `npm run lint`
  * `npm test` (간단 테스트 1개)
  * `npm run build`

### Milestone 2 – Issue Tracker CRUD 화면

* 대상 API:

  * `/api/projects` (목록/생성)
  * `/api/projects/{projectId}/issues` (목록/생성)
  * `/api/issues/{issueId}` (상세/수정/삭제)
  * `/api/issues/{issueId}/comments` (목록/생성)
* 구현:

  * 프로젝트 목록 페이지
  * 프로젝트별 이슈 목록(필터+페이지네이션)
  * 이슈 상세 + 댓글
  * 이슈 생성/수정 폼 (react-hook-form + zod)
* React Query로 데이터 패칭 / 캐시
* 컴포넌트 테스트 1~2개 추가

### Milestone 3 – 로그인/인증/인가 UX

* 대상 API:

  * `/api/auth/login`
  * `/api/auth/me`
  * 팀 관련 API (`/api/teams`, `/api/teams/{teamId}`, members, workspace 등)
* 구현:

  * 로그인 페이지 + JWT 저장 (localStorage)
  * `RequireAuth` 라우트 가드
  * 전역 auth store (Context or Zustand)
  * 팀 목록/상세/멤버/워크스페이스 기본 화면
  * ROLE에 따라 버튼/액션 제어 (OWNER/MANAGER/MEMBER)
  * 전역 에러 처리 (401/403/404/500)

### Milestone 4 – 통계/데이터 패칭 패턴

* 대상 API:

  * `/api/stats/daily`
  * `/api/issues/popular`
  * `/api/external/example`
* 구현:

  * 통계 대시보드 페이지 (기간 선택 + 차트)
  * 인기 이슈 페이지 (React Query staleTime 활용)
  * 외부 API 결과 화면
  * 로딩/에러/빈 상태 UI 공통 컴포넌트

### Milestone 5 – 검색/필터 UI + 성능 기초

* 대상 API:

  * `/api/search/products`
  * `/api/products/{productId}`
* 구현:

  * 상품 검색 페이지 (검색어/카테고리/브랜드/가격 필터 + 페이지네이션)
  * URL 쿼리스트링과 상태 동기화
  * 재사용 가능한 Table 컴포넌트
  * React.memo/useMemo/useCallback, 코드 스플리팅 적용

### Milestone 6 – 테스트 전략 & E2E & 접근성 기초

* Jest + React Testing Library로 주요 화면 테스트 보강
* Cypress/Playwright로 최소 E2E 시나리오:

  * 로그인 → 프로젝트 선택 → 이슈 생성 → 상세 확인
* 기본 접근성:

  * semantic 태그
  * 기본 aria 속성
  * 키보드 네비게이션 확인