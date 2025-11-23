# CI/CD 파이프라인 설계 일지
> GitHub Actions 기반 자동화된 빌드, 테스트, 품질 검사 파이프라인 설계 기록

## 1. 개요

### 1.1 목표

지속적 통합(CI) 및 지속적 배포(CD) 자동화:
- 모든 커밋에서 자동 빌드 및 테스트
- 코드 품질 검증 (린트, 타입 체크)
- PR 머지 전 품질 게이트
- 빠른 피드백 (< 5분)

### 1.2 CI/CD 흐름

```text
┌──────────────┐
│ 코드 푸시     │
│ (main/claude/**) │
└───────┬──────┘
        │
        ▼
┌──────────────────────┐
│ GitHub Actions 트리거 │
└───────┬──────────────┘
        │
        ▼
┌──────────────────────┐
│ 1. Checkout 코드     │
└───────┬──────────────┘
        │
        ▼
┌──────────────────────┐
│ 2. Node.js 설정      │
│    (v20 + npm 캐시)  │
└───────┬──────────────┘
        │
        ▼
┌──────────────────────┐
│ 3. 의존성 설치        │
│    (npm ci)          │
└───────┬──────────────┘
        │
        ▼
┌──────────────────────┐
│ 4. 린트 검사          │
│    (npm run lint)    │
└───────┬──────────────┘
        │
        ▼
┌──────────────────────┐
│ 5. 테스트 실행        │
│    (npm test)        │
└───────┬──────────────┘
        │
        ▼
┌──────────────────────┐
│ 6. 빌드              │
│    (npm run build)   │
└───────┬──────────────┘
        │
        ▼
┌──────────────────────┐
│ 성공 ✅ / 실패 ❌    │
└──────────────────────┘
```

---

## 2. GitHub Actions 워크플로우

### 2.1 전체 설정 (.github/workflows/ci.yml)

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

### 2.2 단계별 설명

#### 2.2.1 Checkout Code

```yaml
- name: Checkout code
  uses: actions/checkout@v4
```

**동작**:
- 리포지토리 코드를 러너(Ubuntu VM)에 다운로드
- 모든 브랜치와 히스토리 포함

**버전 선택**: `@v4` (최신 안정 버전)

#### 2.2.2 Setup Node.js

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: frontend/package-lock.json
```

**동작**:
- Node.js v20 설치
- npm 캐시 활성화 (의존성 설치 시간 단축)
- `package-lock.json` 기반 캐시 키 생성

**캐싱 효과**:
- 첫 실행: ~60초 (의존성 다운로드)
- 캐시 히트: ~10초 (캐시에서 복원)

#### 2.2.3 Install Dependencies

```yaml
- name: Install dependencies
  run: npm ci
  working-directory: frontend
```

**`npm ci` vs `npm install`**:

| 항목 | npm ci | npm install |
|------|--------|-------------|
| 속도 | 빠름 | 느림 |
| package-lock.json | 엄격히 따름 | 업데이트 가능 |
| node_modules 삭제 | 항상 | 선택적 |
| CI 용도 | ✅ 최적 | ❌ |

**`npm ci` 장점**:
- 재현 가능한 빌드
- package-lock.json과 정확히 일치
- 더 빠른 설치 속도

#### 2.2.4 Run Linter

```yaml
- name: Run linter
  run: npm run lint
  working-directory: frontend
```

**package.json 스크립트**:
```json
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

**검사 대상**:
- TypeScript 타입 오류
- React 규칙 위반
- 코드 스타일 불일치

**실패 조건**: 경고 1개 이상

#### 2.2.5 Run Tests

```yaml
- name: Run tests
  run: npm test -- --run
  working-directory: frontend
```

**package.json 스크립트**:
```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

**`--run` 플래그**:
- watch 모드 비활성화
- 한 번만 실행 후 종료 (CI 적합)

**실패 조건**: 테스트 1개 이상 실패

#### 2.2.6 Build

```yaml
- name: Build
  run: npm run build
  working-directory: frontend
```

**package.json 스크립트**:
```json
{
  "scripts": {
    "build": "tsc -b && vite build"
  }
}
```

**단계**:
1. `tsc -b`: TypeScript 컴파일 (타입 체크)
2. `vite build`: Rollup 기반 프로덕션 빌드

**실패 조건**: 타입 에러 또는 빌드 에러

---

## 3. 품질 게이트

### 3.1 필수 통과 기준

| 단계 | 기준 | 실패 시 조치 |
|------|------|------------|
| Lint | 경고 0개 | PR 머지 차단 |
| Test | 통과율 100% | PR 머지 차단 |
| Build | 성공 (exit code 0) | PR 머지 차단 |
| 전체 실행 시간 | < 5분 | 최적화 검토 |

### 3.2 PR 보호 규칙

**GitHub Settings → Branches → Branch protection rules**:

```yaml
Branch name pattern: main

Protect matching branches:
  ✅ Require a pull request before merging
  ✅ Require status checks to pass before merging
    - CI / test
  ✅ Require branches to be up to date before merging
```

**효과**:
- CI 실패 시 PR 머지 불가
- main 브랜치 직접 푸시 차단

---

## 4. 로컬 개발 워크플로우

### 4.1 개발 시작

```bash
cd frontend
npm install
npm run dev
```

**`npm run dev`**:
- Vite 개발 서버 시작 (http://localhost:5173)
- HMR (Hot Module Replacement) 활성화
- 파일 변경 시 자동 리로드

### 4.2 코드 커밋 전 체크리스트

```bash
# 1. 린트 검사
npm run lint

# 2. 테스트 실행
npm test

# 3. 빌드 테스트
npm run build
```

**권장 Pre-commit Hook** (optional):
```bash
# .husky/pre-commit
#!/bin/sh
cd frontend
npm run lint || exit 1
npm test -- --run || exit 1
```

### 4.3 PR 생성 전 확인사항

1. ✅ 린트 경고 0개
2. ✅ 모든 테스트 통과
3. ✅ 빌드 성공
4. ✅ 커밋 메시지 명확
5. ✅ 불필요한 파일 제외 (.gitignore)

---

## 5. 성능 최적화

### 5.1 캐싱 전략

**npm 캐시**:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

**효과**:
- 의존성 설치 시간: ~60s → ~10s

**캐시 무효화 조건**:
- `package-lock.json` 변경 시

### 5.2 병렬 실행 (미래 확장)

**현재 (순차 실행)**:
```yaml
- run: npm run lint      # ~10s
- run: npm test          # ~5s
- run: npm run build     # ~30s
총 ~45s
```

**개선 (병렬 실행, 미구현)**:
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test

  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build

총 ~30s (가장 긴 작업 기준)
```

---

## 6. 모니터링 & 디버깅

### 6.1 GitHub Actions UI

**워크플로우 실행 확인**:
1. GitHub 리포지토리 → Actions 탭
2. 최근 워크플로우 실행 목록
3. 실행 클릭 → 각 단계 로그 확인

**로그 예시**:
```
Run npm run lint
> frontend@0.0.0 lint
> eslint .

✔ No ESLint warnings or errors
```

### 6.2 실패 시 디버깅

**린트 실패**:
```bash
# 로컬에서 동일한 명령 실행
npm run lint

# 자동 수정 시도
npm run lint -- --fix
```

**테스트 실패**:
```bash
# 로컬에서 테스트 실행
npm test

# 특정 테스트만 실행
npm test -- Button.test.tsx
```

**빌드 실패**:
```bash
# 로컬에서 빌드 실행
npm run build

# TypeScript 에러 확인
npx tsc --noEmit
```

### 6.3 성공/실패 알림

**GitHub UI**:
- PR 페이지에 ✅ 또는 ❌ 표시
- 커밋 옆에 상태 아이콘

**이메일 알림**:
- CI 실패 시 자동 이메일 (GitHub 설정)

---

## 7. CD (지속적 배포) 확장

### 7.1 자동 배포 (미래 확장)

**Vercel/Netlify 배포**:
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 7.2 환경별 배포

**환경 구분**:
- Development: PR 머지 시 자동 배포
- Staging: main 브랜치 푸시 시 자동 배포
- Production: 수동 승인 후 배포

---

## 8. 알려진 제약 & 향후 개선점

### 8.1 현재 제약

1. **E2E 테스트 미포함**:
   - 유닛 테스트만 CI에서 실행
   - 개선: Playwright E2E 테스트 추가

2. **커버리지 리포트 없음**:
   - 커버리지 추적 안 함
   - 개선: Codecov 통합

3. **성능 테스트 없음**:
   - 빌드 크기, 로딩 시간 미측정
   - 개선: Lighthouse CI

### 8.2 향후 개선점

**E2E 테스트 추가**:
```yaml
- name: Run E2E tests
  run: npm run test:e2e
```

**커버리지 업로드**:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

**번들 크기 분석**:
```yaml
- name: Analyze bundle size
  run: npx vite-bundle-visualizer
```

---

## 9. 체크리스트 (CI/CD 완료 기준)

- [x] GitHub Actions 워크플로우 파일 생성 (.github/workflows/ci.yml)
- [x] Node.js 설정 (v20 + npm 캐시)
- [x] 의존성 설치 (npm ci)
- [x] 린트 검사 (ESLint)
- [x] 테스트 실행 (Vitest)
- [x] 빌드 생성 (Vite)
- [x] PR 보호 규칙 설정 (권장)
- [x] 로컬 개발 워크플로우 문서화
- [x] 디버깅 가이드 작성
- [x] 실행 시간 < 5분

---

## 10. 핵심 학습 포인트

### 10.1 CI/CD의 가치

**자동화 이점**:
- 인간 실수 방지 (테스트 깜빡임)
- 빠른 피드백 (5분 이내)
- 일관된 품질 (모든 PR 동일 검증)

**비용**:
- GitHub Actions 무료 (퍼블릭 리포지토리)
- 프라이빗 리포지토리: 월 2,000분 무료

### 10.2 품질 게이트 철학

**원칙**:
- 린트/테스트 실패 → PR 머지 불가
- main 브랜치는 항상 배포 가능 상태

**효과**:
- 버그 조기 발견
- 리팩토링 자신감 ↑
- 코드 리뷰 효율 ↑

---

**CI/CD 파이프라인 완성으로 전문적인 소프트웨어 개발 프로세스가 확립되었습니다.**
