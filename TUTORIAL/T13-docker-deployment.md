# T13: Docker + 프로덕션 배포/모니터링

> **학습 목표**: Docker Compose로 멀티 컨테이너 프로덕션 환경 구축 및 모니터링/CI/CD 자동화

**연관 프로젝트**: video-editor v3.0 (Production Deployment)
**소요 시간**: 78–93 구간 (약 15 단계)
**전제 지식**: T1-T12 (모든 프로젝트 완성), Linux 기초, Git/GitHub

---

## 목차

1. [개요](#1-개요)
2. [왜 Docker인가?](#2-왜-docker인가)
3. [Docker 기초](#3-docker-기초)
4. [Part 1: Backend Dockerfile](#4-part-1-backend-dockerfile)
5. [Part 2: Frontend Dockerfile](#5-part-2-frontend-dockerfile)
6. [Part 3: Docker Compose 멀티 컨테이너](#6-part-3-docker-compose-멀티-컨테이너)
7. [Part 4: 환경 변수 및 Secrets 관리](#7-part-4-환경-변수-및-secrets-관리)
8. [Part 5: Prometheus + Grafana 모니터링](#8-part-5-prometheus--grafana-모니터링)
9. [Part 6: GitHub Actions CI/CD](#9-part-6-github-actions-cicd)
10. [Part 7: 프로덕션 배포 전략](#10-part-7-프로덕션-배포-전략)
11. [보안 및 최적화](#11-보안-및-최적화)
12. [트러블슈팅](#12-트러블슈팅)
13. [프로덕션 체크리스트](#13-프로덕션-체크리스트)

---

## 1. 개요

### 1.1 무엇을 만들까?

**Phase 1~2 vs. Phase 3 비교**:

```bash
# Phase 1~2: 로컬 개발
npm run dev  # 각 서비스 개별 실행
psql -h localhost -U admin vrewcraft
redis-cli

# 문제:
# - 팀원마다 다른 환경
# - PostgreSQL/Redis 수동 설치
# - 포트 충돌, 경로 문제
```

```bash
# Phase 3: Docker Compose
docker compose up -d  # 모든 서비스 한 번에!

# 장점:
# - 일관된 환경 (개발 = 프로덕션)
# - 의존성 격리
# - 한 명령어로 전체 스택 실행
```

**컨테이너 구성**:
- **Frontend**: React + Vite (5173)
- **Backend**: Node.js + FFmpeg + Native Addon (3001, 3002)
- **PostgreSQL**: 데이터베이스 (5432)
- **Redis**: 캐시/세션 (6379)
- **Prometheus**: 메트릭 수집 (9090)
- **Grafana**: 대시보드 (3000)

### 1.2 왜 필요한가?

**프로덕션 운영의 필수 요소**:

1. **일관성**: 개발/스테이징/프로덕션 동일 환경
2. **격리**: 컨테이너 간 의존성 충돌 방지
3. **스케일링**: `docker compose up --scale backend=3`
4. **모니터링**: Prometheus + Grafana로 실시간 관찰
5. **CI/CD**: GitHub Actions로 자동 배포

### 1.3 기술 스택 매칭

**취업 포지션 요구사항**:
- ✅ **DevOps 역량**: Docker, CI/CD, 모니터링
- ✅ **시스템 설계**: 멀티 컨테이너 아키텍처
- ✅ **프로덕션 운영**: 로깅, 백업, 보안
- ✅ **문제 해결**: 트러블슈팅, 성능 최적화

---

## 2. 왜 Docker인가?

### 2.1 전통적 배포의 문제점

**"내 컴퓨터에서는 잘 되는데..." 증후군**:

```bash
# 개발자 A (macOS)
brew install postgresql@15
brew install redis
npm install
npm run dev  # ✅ 작동!

# 개발자 B (Windows)
choco install postgresql  # 버전 14
# Redis 설치 실패 (Windows 미지원)
npm install  # node-gyp 에러 (Visual Studio 없음)
npm run dev  # ❌ 실패!
```

**의존성 지옥**:
- PostgreSQL 15 vs. 14 (SQL 문법 차이)
- FFmpeg 버전 차이 (코덱 지원)
- Node.js 18 vs. 20 (네이티브 모듈 ABI)

### 2.2 Docker의 해결책

**컨테이너 = 격리된 실행 환경**:

```dockerfile
# Dockerfile: 환경 정의
FROM node:20-alpine  # 정확한 버전
RUN apk add ffmpeg=6.1  # 정확한 버전
COPY . .
CMD ["npm", "start"]
```

```bash
# 누구나 동일한 환경
docker build -t myapp .
docker run myapp  # ✅ 어디서든 작동!
```

**Docker vs. VM**:

```
Virtual Machine                  Docker Container
┌──────────────────────┐        ┌──────────────────────┐
│   App A    │  App B  │        │   App A    │  App B  │
├────────────┴─────────┤        ├────────────┴─────────┤
│    Guest OS (2GB)    │        │   (No Guest OS)      │
├──────────────────────┤        ├──────────────────────┤
│     Hypervisor       │        │   Docker Engine      │
├──────────────────────┤        ├──────────────────────┤
│      Host OS         │        │      Host OS         │
└──────────────────────┘        └──────────────────────┘

무겁고 느림 (GB 단위)           가볍고 빠름 (MB 단위)
부팅 시간: 분 단위               시작 시간: 초 단위
```

### 2.3 Docker 핵심 개념

**1. 이미지 (Image)**: 읽기 전용 템플릿
```bash
docker images
# REPOSITORY    TAG       SIZE
# node          20-alpine 150MB
# postgres      15        350MB
```

**2. 컨테이너 (Container)**: 이미지의 실행 인스턴스
```bash
docker ps
# CONTAINER ID  IMAGE         STATUS
# abc123        node:20       Up 10 minutes
```

**3. 볼륨 (Volume)**: 데이터 영속성
```bash
docker volume create postgres_data
# 컨테이너 삭제해도 데이터 유지
```

**4. 네트워크 (Network)**: 컨테이너 간 통신
```bash
docker network create app_net
# backend ↔ postgres 내부 통신
```

---

## 3. Docker 기초

### 3.1 설치

**macOS**:
```bash
brew install --cask docker
open /Applications/Docker.app

# 확인
docker --version  # Docker version 24.0+
docker compose version  # v2.20+
```

**Linux (Ubuntu)**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose (플러그인)
sudo apt-get install docker-compose-plugin

# 사용자 권한
sudo usermod -aG docker $USER
newgrp docker
```

### 3.2 기본 명령어

```bash
# 이미지 관리
docker pull node:20-alpine    # 다운로드
docker images                  # 목록
docker rmi node:20-alpine      # 삭제

# 컨테이너 관리
docker run -d -p 3000:3000 myapp  # 실행 (-d: 백그라운드)
docker ps                      # 실행 중 목록
docker ps -a                   # 모든 컨테이너
docker stop abc123             # 중지
docker rm abc123               # 삭제

# 로그 및 디버깅
docker logs abc123             # 로그 확인
docker exec -it abc123 sh      # 컨테이너 내부 접속
docker inspect abc123          # 상세 정보

# 정리
docker system prune -a         # 미사용 리소스 삭제
```

### 3.3 Dockerfile 기초 문법

```dockerfile
# 베이스 이미지
FROM node:20-alpine

# 메타데이터
LABEL maintainer="you@example.com"

# 패키지 설치 (Alpine: apk, Ubuntu: apt-get)
RUN apk add --no-cache ffmpeg

# 작업 디렉토리 설정
WORKDIR /app

# 파일 복사
COPY package*.json ./
COPY . .

# 의존성 설치
RUN npm install

# 포트 노출 (문서화 목적)
EXPOSE 3001

# 환경 변수
ENV NODE_ENV=production

# 실행 명령어
CMD ["npm", "start"]
```

---

## 4. Part 1: Backend Dockerfile

### 4.1 요구사항 분석

**Backend 의존성**:
- Node.js 20
- FFmpeg (video processing)
- PostgreSQL 클라이언트
- Redis 클라이언트
- **Native Addon 빌드 도구** (python3, make, g++)

### 4.2 Dockerfile 작성

**backend/Dockerfile**:

```dockerfile
# Stage 1: Build stage (Native Addon 빌드)
FROM node:20-alpine AS builder

# Install build dependencies for native addon
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    linux-headers \
    ffmpeg-dev \
    pkgconfig

WORKDIR /app

# Copy native addon source
COPY native /app/native

# Build native addon
WORKDIR /app/native
RUN npm install && npm run build

# Copy backend dependencies
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY backend .

# Build TypeScript
RUN npm run build

# Stage 2: Runtime stage (프로덕션 최적화)
FROM node:20-alpine

# Install runtime dependencies only
RUN apk add --no-cache \
    ffmpeg \
    postgresql-client \
    curl \
    tini

# tini: PID 1 process manager (좀비 프로세스 방지)
ENTRYPOINT ["/sbin/tini", "--"]

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/native/build/Release ./native/build/Release
COPY --from=builder /app/dist ./dist
COPY backend/package.json ./

# Create directories
RUN mkdir -p /app/uploads /app/outputs && \
    chown -R node:node /app

# Switch to non-root user (보안)
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001 3002

CMD ["node", "dist/server.js"]
```

**주요 구현 포인트**:

1. **멀티 스테이지 빌드**: 빌드 도구 제외 → 이미지 크기 50% 감소
2. **tini**: PID 1 프로세스 매니저 (SIGTERM 처리)
3. **non-root user**: 보안 강화
4. **HEALTHCHECK**: 자동 헬스 체크

### 4.3 .dockerignore

**backend/.dockerignore**:

```
node_modules
dist
npm-debug.log
.env
.env.*
uploads/*
outputs/*
*.log
.git
.gitignore
README.md
```

### 4.4 빌드 및 테스트

```bash
# 빌드
docker build -t video-editor-backend:latest -f backend/Dockerfile .

# 크기 확인
docker images video-editor-backend
# REPOSITORY               TAG       SIZE
# video-editor-backend     latest    250MB  # 멀티 스테이지 덕분에 작음

# 단독 실행 (테스트)
docker run -d \
  -p 3001:3001 \
  -e DB_HOST=host.docker.internal \
  -e REDIS_HOST=host.docker.internal \
  --name backend-test \
  video-editor-backend:latest

# 로그 확인
docker logs -f backend-test

# 헬스 체크
curl http://localhost:3001/health
# {"status":"ok","database":"connected","redis":"connected"}

# 정리
docker stop backend-test && docker rm backend-test
```

---

## 5. Part 2: Frontend Dockerfile

### 5.1 개발 vs. 프로덕션

**개발 환경**: 핫 리로드
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

**프로덕션 환경**: 정적 빌드 + Nginx
```dockerfile
# 빌드 + Nginx 서빙
```

### 5.2 프로덕션 Dockerfile

**frontend/Dockerfile**:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Nginx serving
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 5.3 Nginx 설정

**frontend/nginx.conf**:

```nginx
events {
  worker_connections 1024;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;

  # Gzip compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
  gzip_min_length 1000;

  server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback (React Router)
    location / {
      try_files $uri $uri/ /index.html;
    }

    # API proxy (backend로 전달)
    location /api/ {
      proxy_pass http://backend:3001/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /ws/ {
      proxy_pass http://backend:3002/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "Upgrade";
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }
  }
}
```

### 5.4 빌드 및 테스트

```bash
docker build -t video-editor-frontend:latest -f frontend/Dockerfile .

docker run -d -p 8080:80 --name frontend-test video-editor-frontend:latest

# 확인
open http://localhost:8080

docker stop frontend-test && docker rm frontend-test
```

---

## 6. Part 3: Docker Compose 멀티 컨테이너

### 6.1 Docker Compose란?

**여러 컨테이너를 YAML로 정의**:

```yaml
services:
  frontend:
    # ...
  backend:
    # ...
  postgres:
    # ...
```

```bash
docker compose up -d  # 모든 서비스 시작
docker compose down   # 모든 서비스 중지 + 삭제
```

### 6.2 전체 스택 구성

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  # Frontend (React + Nginx)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - frontend_net

  # Backend (Node.js + FFmpeg + Native Addon)
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3001:3001"  # HTTP
      - "3002:3002"  # WebSocket
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/outputs:/app/outputs
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=vrewcraft
      - DB_USER=admin
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - frontend_net
      - backend_net
    restart: unless-stopped

  # PostgreSQL
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: vrewcraft
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend_net
    restart: unless-stopped

  # Redis
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - backend_net
    restart: unless-stopped

  # Prometheus (메트릭 수집)
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9090:9090"
    networks:
      - backend_net
    restart: unless-stopped

  # Grafana (대시보드)
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=http://localhost:3000
    depends_on:
      - prometheus
    networks:
      - backend_net
    restart: unless-stopped

# 네트워크 정의
networks:
  frontend_net:
    driver: bridge
  backend_net:
    driver: bridge
    internal: true  # 외부 접근 차단 (보안)

# 볼륨 정의
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
```

### 6.3 실행 및 관리

```bash
# 전체 스택 시작
docker compose up -d

# 상태 확인
docker compose ps
# NAME       IMAGE              STATUS       PORTS
# backend    backend:latest     Up 2 min     3001-3002->3001-3002/tcp
# postgres   postgres:15        Up 2 min     5432/tcp
# redis      redis:7            Up 2 min     6379/tcp
# ...

# 로그 확인
docker compose logs -f backend

# 특정 서비스만 재시작
docker compose restart backend

# 스케일링 (backend 3개 인스턴스)
docker compose up -d --scale backend=3

# 정리 (컨테이너 + 네트워크 삭제, 볼륨 유지)
docker compose down

# 완전 정리 (볼륨까지 삭제)
docker compose down -v
```

---

## 7. Part 4: 환경 변수 및 Secrets 관리

### 7.1 .env 파일

**.env** (gitignore에 추가!):

```bash
# Database
DB_PASSWORD=changeme_in_production_12345
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=vrewcraft
POSTGRES_USER=admin

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Backend
NODE_ENV=production
PORT=3001
UPLOAD_DIR=/app/uploads
OUTPUT_DIR=/app/outputs
JWT_SECRET=super_secret_key_change_me

# Grafana
GRAFANA_PASSWORD=admin_change_me

# Frontend
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
```

### 7.2 환경별 설정

**docker-compose.yml** (개발):
```yaml
services:
  backend:
    environment:
      - NODE_ENV=development
    volumes:
      - ./backend:/app  # 코드 마운트 (핫 리로드)
```

**docker-compose.prod.yml** (프로덕션):
```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
    # 볼륨 마운트 없음 (보안)
```

```bash
# 프로덕션 실행
docker compose -f docker-compose.prod.yml up -d
```

### 7.3 Docker Secrets (Swarm 모드)

```bash
# Secret 생성
echo "super_secret_password" | docker secret create db_password -

# docker-compose.yml
services:
  backend:
    secrets:
      - db_password
    environment:
      - DB_PASSWORD_FILE=/run/secrets/db_password

secrets:
  db_password:
    external: true
```

---

## 8. Part 5: Prometheus + Grafana 모니터링

### 8.1 Backend에 메트릭 노출

**backend/src/metrics.ts**:

```typescript
import promClient from 'prom-client';
import express from 'express';

// Register
const register = new promClient.Register();

// Default metrics (CPU, Memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const videoProcessingDuration = new promClient.Histogram({
  name: 'video_processing_duration_seconds',
  help: 'Duration of video processing operations',
  labelNames: ['operation'],
  buckets: [1, 5, 10, 30, 60],
  registers: [register],
});

export const activeWebSocketConnections = new promClient.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// Metrics endpoint
export function metricsHandler(req: express.Request, res: express.Response) {
  res.set('Content-Type', register.contentType);
  register.metrics().then(data => res.send(data));
}
```

**backend/src/server.ts**:

```typescript
import { metricsHandler, httpRequestDuration } from './metrics';

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Middleware to track request duration
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode,
      },
      duration
    );
  });

  next();
});
```

### 8.2 Prometheus 설정

**monitoring/prometheus/prometheus.yml**:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'vrewcraft-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### 8.3 Grafana 대시보드

**monitoring/grafana/provisioning/datasources/prometheus.yml**:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**monitoring/grafana/provisioning/dashboards/dashboard.yml**:

```yaml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

**monitoring/grafana/dashboards/vrewcraft.json** (일부):

```json
{
  "dashboard": {
    "title": "VrewCraft Overview",
    "panels": [
      {
        "title": "HTTP Request Duration (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Video Processing Duration",
        "targets": [
          {
            "expr": "rate(video_processing_duration_seconds_sum[5m]) / rate(video_processing_duration_seconds_count[5m])"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "active_websocket_connections"
          }
        ]
      }
    ]
  }
}
```

### 8.4 모니터링 확인

```bash
# 스택 시작
docker compose up -d

# Prometheus 확인
open http://localhost:9090
# Status → Targets → backend (UP 확인)

# Grafana 확인
open http://localhost:3000
# 로그인: admin / admin
# Dashboards → VrewCraft Overview
```

---

## 9. Part 6: GitHub Actions CI/CD

### 9.1 CI 파이프라인

**.github/workflows/ci.yml**:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: vrewcraft_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install FFmpeg
        run: |
          sudo apt-get update
          sudo apt-get install -y ffmpeg libavformat-dev libavcodec-dev

      - name: Install dependencies
        run: |
          cd backend
          npm ci

      - name: Build Native Addon
        run: |
          cd native
          npm ci
          npm run build

      - name: Run linter
        run: |
          cd backend
          npm run lint

      - name: Run tests
        run: |
          cd backend
          npm test
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: vrewcraft_test
          DB_USER: test
          DB_PASSWORD: test
          REDIS_HOST: localhost
          REDIS_PORT: 6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build backend image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: backend/Dockerfile
          push: false
          tags: video-editor-backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build frontend image
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          file: frontend/Dockerfile
          push: false
          tags: video-editor-frontend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 9.2 CD 파이프라인 (Docker Hub)

**.github/workflows/cd.yml**:

```yaml
name: CD

on:
  push:
    branches: [main]
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: yourusername/video-editor-backend
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push backend
        uses: docker/build-push-action@v4
        with:
          context: .
          file: backend/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push frontend
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          file: frontend/Dockerfile
          push: true
          tags: yourusername/video-editor-frontend:${{ steps.meta.outputs.tags }}

      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/video-editor
            docker compose pull
            docker compose up -d
            docker system prune -f
```

### 9.3 GitHub Secrets 설정

```bash
# GitHub Repository → Settings → Secrets and variables → Actions

# 필요한 Secrets:
# - DOCKERHUB_USERNAME
# - DOCKERHUB_TOKEN
# - PROD_HOST (배포 서버 IP)
# - PROD_USER (SSH 사용자)
# - PROD_SSH_KEY (SSH private key)
```

---

## 10. Part 7: 프로덕션 배포 전략

### 10.1 블루-그린 배포

```bash
# 현재: 블루 버전 실행 중
docker compose -p blue up -d

# 새 버전: 그린 배포
docker compose -p green -f docker-compose.prod.yml up -d

# 헬스 체크 후 트래픽 전환 (Nginx)
# 문제 없으면 블루 중지
docker compose -p blue down
```

### 10.2 롤링 업데이트

```bash
# Backend만 업데이트 (무중단)
docker compose pull backend
docker compose up -d --no-deps backend

# 단계적 재시작
for i in {1..3}; do
  docker compose restart backend-$i
  sleep 10  # 헬스 체크 대기
done
```

### 10.3 데이터 백업

**scripts/backup.sh**:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# PostgreSQL 백업
echo "Backing up PostgreSQL..."
docker compose exec -T postgres pg_dump -U admin vrewcraft > "$BACKUP_DIR/postgres.sql"
gzip "$BACKUP_DIR/postgres.sql"

# Redis 백업
echo "Backing up Redis..."
docker compose exec redis redis-cli SAVE
docker cp $(docker compose ps -q redis):/data/dump.rdb "$BACKUP_DIR/redis.rdb"

# Uploads 백업
echo "Backing up uploads..."
tar -czf "$BACKUP_DIR/uploads.tar.gz" ./backend/uploads

# 7일 이상 된 백업 삭제
find /backups -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR"
```

```bash
# Cron 설정 (매일 새벽 3시)
crontab -e
# 0 3 * * * /opt/video-editor/scripts/backup.sh
```

### 10.4 복구

```bash
# PostgreSQL 복구
gunzip -c backups/20251123_030000/postgres.sql.gz | \
  docker compose exec -T postgres psql -U admin vrewcraft

# Redis 복구
docker compose stop redis
docker cp backups/20251123_030000/redis.rdb $(docker compose ps -q redis):/data/dump.rdb
docker compose start redis

# Uploads 복구
tar -xzf backups/20251123_030000/uploads.tar.gz -C ./backend/
```

---

## 11. 보안 및 최적화

### 11.1 보안 체크리스트

- [ ] **Non-root user**: 모든 컨테이너 USER 지시자 사용
- [ ] **Secrets 관리**: 환경 변수 대신 Docker Secrets 사용
- [ ] **네트워크 격리**: backend_net은 internal: true
- [ ] **포트 최소화**: PostgreSQL/Redis 포트 외부 노출 제거
- [ ] **이미지 스캔**: `docker scan` 취약점 검사
- [ ] **SSL/TLS**: Nginx에서 Let's Encrypt 인증서
- [ ] **Rate limiting**: Nginx limit_req 설정
- [ ] **CORS**: backend에서 허용 도메인 제한

### 11.2 성능 최적화

**1. 빌드 캐시 최적화**:

```dockerfile
# ❌ Bad: 소스 변경 시 npm install 재실행
COPY . .
RUN npm install

# ✅ Good: package.json만 먼저 복사
COPY package*.json ./
RUN npm install
COPY . .
```

**2. Layer 크기 최소화**:

```dockerfile
# ❌ Bad: 여러 RUN 명령어
RUN apk add ffmpeg
RUN apk add postgresql-client
RUN rm -rf /tmp/*

# ✅ Good: 하나의 RUN으로 합치기
RUN apk add --no-cache ffmpeg postgresql-client && \
    rm -rf /tmp/*
```

**3. .dockerignore 최적화**:

```
# 불필요한 파일 제외 → 빌드 속도 향상
node_modules
.git
*.md
.env
coverage/
```

### 11.3 리소스 제한

**docker-compose.yml**:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## 12. 트러블슈팅

### 12.1 Native Addon 빌드 실패

```bash
# 증상
ERROR: Cannot find module '../build/Release/video_processor.node'

# 원인: FFmpeg 개발 라이브러리 미설치
# 해결:
docker compose exec backend sh
apk add --no-cache ffmpeg-dev
cd /app/native && npm run build
```

### 12.2 PostgreSQL 연결 실패

```bash
# 증상
Error: connect ECONNREFUSED 127.0.0.1:5432

# 원인: DB_HOST가 localhost (컨테이너 내부)
# 해결: docker-compose.yml에서 service 이름 사용
environment:
  - DB_HOST=postgres  # ✅ service 이름
  # - DB_HOST=localhost  # ❌ 안 됨
```

### 12.3 볼륨 권한 문제

```bash
# 증상
EACCES: permission denied, open '/app/uploads/video.mp4'

# 원인: 컨테이너 내부 user와 호스트 권한 불일치
# 해결:
chmod -R 777 ./backend/uploads  # 임시 방편
# 또는 Dockerfile에서
RUN chown -R node:node /app
USER node
```

### 12.4 메모리 부족

```bash
# 증상
docker: Error response from daemon: OCI runtime create failed

# 원인: Docker Desktop 메모리 제한
# 해결:
# Docker Desktop → Settings → Resources → Memory: 8GB
```

### 12.5 포트 충돌

```bash
# 증상
Error starting userland proxy: listen tcp 0.0.0.0:5432: bind: address already in use

# 원인: 로컬에서 PostgreSQL 이미 실행 중
# 해결:
sudo lsof -i :5432
kill <PID>
# 또는 docker-compose.yml에서 포트 변경
ports:
  - "15432:5432"
```

---

## 13. 프로덕션 체크리스트

### 13.1 Docker

- [x] **Dockerfile 최적화**
  - 멀티 스테이지 빌드
  - 레이어 캐싱 활용
  - .dockerignore 설정

- [x] **docker-compose.yml**
  - 모든 서비스 정의
  - 헬스 체크 설정
  - 리소스 제한
  - 재시작 정책

- [x] **보안**
  - Non-root user
  - 네트워크 격리
  - Secrets 관리
  - 포트 최소화

### 13.2 모니터링

- [x] **Prometheus**
  - 메트릭 수집 설정
  - Retention 30일
  - Alerting rules

- [x] **Grafana**
  - 대시보드 구성
  - 알림 채널 설정 (Slack, Email)
  - 주요 메트릭 시각화

### 13.3 CI/CD

- [x] **GitHub Actions**
  - CI 파이프라인 (test, lint, build)
  - CD 파이프라인 (Docker Hub push, 배포)
  - Secrets 설정

- [x] **배포 전략**
  - 블루-그린 또는 롤링 업데이트
  - 자동 롤백 메커니즘
  - 헬스 체크 통합

### 13.4 운영

- [x] **백업**
  - PostgreSQL 자동 백업 (일일)
  - Redis 스냅샷
  - 업로드 파일 백업
  - 복구 절차 문서화

- [x] **로깅**
  - 구조화된 로그 (JSON)
  - 로그 로테이션
  - 중앙집중식 로그 수집 (선택)

- [x] **문서화**
  - README.md (빠른 시작)
  - 배포 가이드
  - 트러블슈팅 가이드
  - 아키텍처 다이어그램

---

## 14. 핵심 요약

### 14.1 Docker 장점

| 측면 | Before Docker | With Docker | 개선 |
|------|---------------|-------------|------|
| **환경 일관성** | 개발자마다 다름 | 모두 동일 | 100% |
| **설정 시간** | 수 시간 (수동 설치) | 5분 (`docker compose up`) | 90% ↓ |
| **격리** | 포트 충돌, 버전 충돌 | 완전 격리 | ✅ |
| **배포** | 수동 배포, 의존성 문제 | 자동화, 재현 가능 | 80% ↓ |

### 14.2 모니터링 효과

- **가시성**: 모든 메트릭 실시간 시각화
- **알림**: 임계값 초과 시 자동 알림
- **디버깅**: 성능 병목 지점 즉시 파악
- **용량 계획**: 리소스 사용 추세 분석

### 14.3 CI/CD 효과

- **품질**: 모든 커밋 자동 테스트
- **속도**: main 브랜치 푸시 → 5분 내 배포
- **안정성**: 테스트 실패 시 배포 중단
- **추적**: 배포 이력 및 롤백 가능

### 14.4 취업 포트폴리오 가치

| 기술 | 증명 |
|------|------|
| **DevOps** | ✅ Docker, Docker Compose, CI/CD 파이프라인 |
| **모니터링** | ✅ Prometheus + Grafana 대시보드 |
| **시스템 설계** | ✅ 멀티 컨테이너 아키텍처, 네트워크 격리 |
| **프로덕션 운영** | ✅ 백업, 복구, 로깅, 보안 |
| **문제 해결** | ✅ 트러블슈팅 경험, 성능 최적화 |

---

## 다음 단계

**Phase 3 완료!** 🎉

이제 전체 프로젝트가 완성되었습니다:
- ✅ **Phase 1**: 기본 기능 (video-editor v1.0-1.3)
- ✅ **Phase 2**: 성능 최적화 (Native Addon, v2.0-2.3)
- ✅ **Phase 3**: 프로덕션 배포 (Docker, CI/CD, 모니터링)

**남은 작업**:
1. **문서화**: README.md, 아키텍처 다이어그램 작성
2. **데모 영상**: 주요 기능 시연 영상 촬영
3. **포트폴리오 정리**: GitHub 프로필 업데이트

**참고 문서**:
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
