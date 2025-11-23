# Stage 2: 시각화 (Visualization) - Grafana

## 문서 정보
- **작성일**: 2025-11-23
- **Stage**: 2 - Observability
- **구성 요소**: Grafana, Prometheus Datasource
- **상태**: ✅ 구현 완료

---

## 목차
1. [개요](#개요)
2. [Grafana 아키텍처](#grafana-아키텍처)
3. [대시보드 구조](#대시보드-구조)
4. [패널 상세 설명](#패널-상세-설명)
5. [PromQL 쿼리](#promql-쿼리)
6. [알림 설정](#알림-설정)
7. [대시보드 커스터마이징](#대시보드-커스터마이징)
8. [성능 최적화](#성능-최적화)
9. [모범 사례](#모범-사례)
10. [트러블슈팅](#트러블슈팅)

---

## 개요

### Grafana란?

Grafana는 오픈소스 메트릭 시각화 및 모니터링 플랫폼입니다. 다양한 데이터 소스(Prometheus, Elasticsearch, MySQL 등)에서 데이터를 가져와 시각적 대시보드로 표시합니다.

### 주요 기능

**시각화**:
- Time Series (시계열 그래프)
- Gauge (게이지)
- Bar Chart (막대 그래프)
- Pie Chart (파이 차트)
- Heatmap (히트맵)
- Table (테이블)

**데이터 소스**:
- Prometheus (메트릭)
- Elasticsearch (로그)
- MySQL/PostgreSQL (데이터베이스)
- Loki (로그)
- Jaeger/Zipkin (추적)

**알림**:
- 임계값 기반 알림
- Slack, Email, PagerDuty 통합
- 알림 채널 설정

### 도입 배경

**필요성**:
- Prometheus 메트릭의 시각적 표현
- 실시간 시스템 상태 모니터링
- 비즈니스 메트릭 추적 (매출, 주문, 사용자)
- 성능 병목 지점 식별

**Grafana 선택 이유**:
- 업계 표준 모니터링 도구
- Prometheus와 완벽한 통합
- 풍부한 시각화 옵션
- 강력한 템플릿 및 변수 기능
- 오픈소스 (무료)

---

## Grafana 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                    Spring Boot Application                  │
│  - Micrometer MeterRegistry                                  │
│  - /actuator/prometheus 엔드포인트                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP GET /actuator/prometheus
                     │ (15초마다)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prometheus Server                         │
│  - Scrape 메트릭 수집                                         │
│  - Time-series Database 저장                                 │
│  - Recording Rules 처리                                      │
│  - Alert Rules 평가                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ PromQL Query
                     │ HTTP GET /api/v1/query
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Grafana                                 │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Provisioning (자동 설정)                  │  │
│  │  - Datasources: prometheus.yml                        │  │
│  │  - Dashboards: default.yml                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Dashboard: Sagaline - Platform Overview       │  │
│  │  ┌─────────────┬─────────────┬─────────────────────┐  │  │
│  │  │ Panel 1     │ Panel 2     │ Panel 3 ...         │  │  │
│  │  │ (Time       │ (Gauge)     │ (Bar Chart)         │  │  │
│  │  │  Series)    │             │                     │  │  │
│  │  └─────────────┴─────────────┴─────────────────────┘  │  │
│  │                                                       │  │
│  │  각 Panel:                                            │  │
│  │  - PromQL 쿼리 실행                                   │  │
│  │  - 데이터 변환 및 시각화                              │  │
│  │  - 자동 갱신 (5초, 10초, 30초 등)                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Alerting                            │  │
│  │  - Alert Rules 평가                                   │  │
│  │  - Notification Channels (Slack, Email)               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ HTTP (User Access)
                     ▼
              ┌─────────────┐
              │   Browser   │
              │ (Dashboard  │
              │    UI)      │
              └─────────────┘
```

### Docker Compose 설정

```yaml
# Prometheus
prometheus:
  image: prom/prometheus:latest
  container_name: sagaline-prometheus
  ports:
    - "9090:9090"
  volumes:
    - ../monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - ../monitoring/prometheus/alerts.yml:/etc/prometheus/alerts.yml
    - prometheus-data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
    - '--storage.tsdb.retention.time=30d'
  networks:
    - sagaline-network

# Grafana
grafana:
  image: grafana/grafana:latest
  container_name: sagaline-grafana
  ports:
    - "3000:3000"
  environment:
    - GF_SECURITY_ADMIN_USER=admin
    - GF_SECURITY_ADMIN_PASSWORD=admin
    - GF_USERS_ALLOW_SIGN_UP=false
  volumes:
    - ../monitoring/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources
    - ../monitoring/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards
    - ../monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    - grafana-data:/var/lib/grafana
  networks:
    - sagaline-network
  depends_on:
    - prometheus
```

### Provisioning (자동 구성)

#### Datasource Provisioning

`prometheus.yml`:
```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: "15s"
```

**위치**: `/e-commerce/infrastructure/monitoring/grafana/provisioning/datasources/prometheus.yml`

**설명**:
- `access: proxy`: Grafana 서버가 Prometheus에 접근 (브라우저 X)
- `isDefault: true`: 기본 데이터 소스로 설정
- `timeInterval: "15s"`: Prometheus scrape interval과 동일

#### Dashboard Provisioning

`default.yml`:
```yaml
apiVersion: 1

providers:
  - name: 'Sagaline Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

**위치**: `/e-commerce/infrastructure/monitoring/grafana/provisioning/dashboards/default.yml`

**설명**:
- `type: file`: 파일 시스템에서 대시보드 로드
- `allowUiUpdates: true`: UI에서 대시보드 수정 허용
- `updateIntervalSeconds: 10`: 10초마다 파일 변경 확인

---

## 대시보드 구조

### Sagaline - Platform Overview

**대시보드 정보**:
- **이름**: Sagaline - Platform Overview
- **패널 수**: 14개
- **카테고리**: 8개
- **갱신 주기**: 5초, 10초, 30초 (패널별 설정)
- **시간 범위**: 기본 6시간, 조정 가능

### 8개 카테고리와 14개 패널

#### 1. System Overview (시스템 개요)

**Panel 1: Request Rate**
- **타입**: Time Series
- **설명**: 초당 요청 수 및 에러 수
- **쿼리**:
  ```promql
  sum(rate(http_requests_total[5m]))
  sum(rate(http_requests_total{status=~"5.."}[5m]))
  ```

**Panel 2: API Latency (P99)**
- **타입**: Gauge
- **설명**: 99번째 백분위수 응답 시간
- **임계값**:
  - Green: < 100ms
  - Yellow: 100-200ms
  - Red: > 200ms
- **쿼리**:
  ```promql
  histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
  ```

#### 2. Business Metrics (비즈니스 메트릭)

**Panel 3: Registrations & Orders**
- **타입**: Time Series
- **설명**: 시간별 사용자 등록 및 주문 생성 추이
- **쿼리**:
  ```promql
  rate(user_registrations_total[5m]) * 300  # 5분 합계
  rate(orders_created_total{status="created"}[5m]) * 300
  ```

**Panel 4: Revenue (KRW)**
- **타입**: Time Series
- **설명**: 누적 매출 추이 (한국 원화)
- **쿼리**:
  ```promql
  revenue_total{currency="KRW"}
  ```

#### 3. Database Performance (데이터베이스 성능)

**Panel 5: Query Duration**
- **타입**: Time Series
- **설명**: 데이터베이스 쿼리 평균 실행 시간
- **쿼리**:
  ```promql
  avg(database_query_duration_seconds) by (query_type)
  ```

**Panel 6: Connection Pool Usage**
- **타입**: Gauge
- **설명**: HikariCP 연결 풀 사용률
- **임계값**:
  - Green: < 50%
  - Yellow: 50-80%
  - Red: > 80%
- **쿼리**:
  ```promql
  hikaricp_connections_active / hikaricp_connections_max * 100
  ```

#### 4. User Journey (사용자 여정)

**Panel 7: Conversion Funnel**
- **타입**: Bar Chart (Horizontal)
- **설명**: 등록 → 주문 → 결제 → 확인 전환율
- **쿼리**:
  ```promql
  user_registrations_total
  orders_created_total{status="created"}
  payment_transactions_total{status="success"}
  orders_created_total{status="confirmed"}
  ```

#### 5. Error Tracking (에러 추적)

**Panel 8: HTTP Errors by Status**
- **타입**: Time Series (Stacked)
- **설명**: HTTP 상태 코드별 에러 발생 추이
- **쿼리**:
  ```promql
  sum(rate(http_requests_total{status=~"4.."}[5m])) by (status)
  sum(rate(http_requests_total{status=~"5.."}[5m])) by (status)
  ```

**Panel 9: Error Rate**
- **타입**: Gauge
- **설명**: 전체 요청 대비 에러율
- **임계값**:
  - Green: < 0.5%
  - Yellow: 0.5-1%
  - Red: > 1%
- **쿼리**:
  ```promql
  sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
  ```

#### 6. JVM Metrics (JVM 메트릭)

**Panel 10: Memory Usage**
- **타입**: Time Series
- **설명**: JVM 힙 메모리 사용량 (Used vs Max)
- **쿼리**:
  ```promql
  jvm_memory_used_bytes{area="heap"}
  jvm_memory_max_bytes{area="heap"}
  ```

**Panel 11: Thread Count**
- **타입**: Time Series
- **설명**: JVM 스레드 개수 (Live, Daemon)
- **쿼리**:
  ```promql
  jvm_threads_live_threads
  jvm_threads_daemon_threads
  ```

#### 7. API Endpoints (API 엔드포인트)

**Panel 12: Latency Heatmap by Endpoint**
- **타입**: Heatmap
- **설명**: 엔드포인트별 P99 레이턴시 히트맵
- **쿼리**:
  ```promql
  histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le))
  ```

#### 8. Infrastructure (인프라스트럭처)

**Panel 13: CPU Usage**
- **타입**: Time Series
- **설명**: 프로세스 및 시스템 CPU 사용률
- **쿼리**:
  ```promql
  process_cpu_usage
  system_cpu_usage
  ```

**Panel 14: Disk Usage**
- **타입**: Gauge
- **설명**: 디스크 사용률
- **임계값**:
  - Green: < 70%
  - Yellow: 70-85%
  - Red: > 85%
- **쿼리**:
  ```promql
  (disk_total_bytes - disk_free_bytes) / disk_total_bytes * 100
  ```

---

## 패널 상세 설명

### Time Series Panel

**특징**:
- 시간에 따른 메트릭 변화 추적
- 여러 시리즈 동시 표시
- 범례, 툴팁 지원

**설정 예시** (Request Rate):
```json
{
  "type": "timeseries",
  "title": "Request Rate",
  "targets": [
    {
      "expr": "sum(rate(http_requests_total[5m]))",
      "legendFormat": "Requests/sec"
    },
    {
      "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m]))",
      "legendFormat": "Errors/sec"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "reqps",
      "color": {
        "mode": "palette-classic"
      }
    }
  }
}
```

### Gauge Panel

**특징**:
- 현재 값을 게이지로 표시
- 임계값에 따라 색상 변경
- 한눈에 상태 파악 가능

**설정 예시** (API Latency):
```json
{
  "type": "gauge",
  "title": "API Latency (P99)",
  "targets": [
    {
      "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "s",
      "thresholds": {
        "mode": "absolute",
        "steps": [
          { "color": "green", "value": null },
          { "color": "yellow", "value": 0.1 },
          { "color": "red", "value": 0.2 }
        ]
      }
    }
  }
}
```

### Bar Chart Panel

**특징**:
- 카테고리별 비교
- 수평/수직 방향 지원
- 스택형 차트 가능

**설정 예시** (Conversion Funnel):
```json
{
  "type": "barchart",
  "title": "Conversion Funnel",
  "options": {
    "orientation": "horizontal"
  },
  "targets": [
    { "expr": "user_registrations_total", "legendFormat": "Registrations" },
    { "expr": "orders_created_total{status=\"created\"}", "legendFormat": "Orders" },
    { "expr": "payment_transactions_total{status=\"success\"}", "legendFormat": "Payments" },
    { "expr": "orders_created_total{status=\"confirmed\"}", "legendFormat": "Confirmed" }
  ]
}
```

### Heatmap Panel

**특징**:
- 2차원 데이터 시각화
- 색상으로 값의 크기 표현
- 패턴 및 이상치 발견에 유용

**설정 예시** (Latency Heatmap):
```json
{
  "type": "heatmap",
  "title": "Latency Heatmap by Endpoint",
  "targets": [
    {
      "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le))"
    }
  ],
  "dataFormat": "timeseries",
  "yAxis": {
    "format": "s"
  }
}
```

---

## PromQL 쿼리

### 기본 쿼리 패턴

#### 1. Rate (변화율)

**사용 시기**: Counter 메트릭의 초당 증가율
```promql
# 초당 요청 수
rate(http_requests_total[5m])

# 5분 동안의 평균 초당 증가율
# 결과: 10.5 (초당 10.5개 요청)
```

#### 2. Increase (증가량)

**사용 시기**: 특정 기간 동안의 총 증가량
```promql
# 5분 동안 생성된 주문 수
increase(orders_created_total[5m])

# 결과: 150 (5분 동안 150개 주문)
```

#### 3. Histogram Quantile (백분위수)

**사용 시기**: 레이턴시 P50, P95, P99 계산
```promql
# P99 레이턴시
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# P95 레이턴시
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# P50 (중앙값)
histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

#### 4. Sum (합계)

**사용 시기**: 여러 시리즈의 합계
```promql
# 모든 엔드포인트의 총 요청 수
sum(http_requests_total)

# 특정 라벨별 합계
sum(http_requests_total) by (endpoint)
```

#### 5. Avg (평균)

**사용 시기**: 평균값 계산
```promql
# 평균 쿼리 실행 시간
avg(database_query_duration_seconds)

# 쿼리 타입별 평균
avg(database_query_duration_seconds) by (query_type)
```

### 실전 쿼리 예시

#### 비즈니스 메트릭

**시간당 신규 사용자 수**:
```promql
rate(user_registrations_total[1h]) * 3600
```

**일일 매출**:
```promql
increase(revenue_total{currency="KRW"}[24h])
```

**주문 성공률**:
```promql
sum(orders_created_total{status="confirmed"}) / sum(orders_created_total) * 100
```

**결제 성공률**:
```promql
sum(payment_transactions_total{status="success"}) /
sum(payment_transactions_total) * 100
```

#### 성능 메트릭

**평균 응답 시간**:
```promql
rate(http_request_duration_seconds_sum[5m]) /
rate(http_request_duration_seconds_count[5m])
```

**엔드포인트별 P99 레이턴시**:
```promql
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le)
)
```

**에러율**:
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) /
sum(rate(http_requests_total[5m])) * 100
```

#### 시스템 메트릭

**JVM 힙 사용률**:
```promql
jvm_memory_used_bytes{area="heap"} /
jvm_memory_max_bytes{area="heap"} * 100
```

**데이터베이스 연결 풀 사용률**:
```promql
hikaricp_connections_active /
hikaricp_connections_max * 100
```

**GC 시간 비율**:
```promql
rate(jvm_gc_pause_seconds_sum[5m]) /
rate(jvm_gc_pause_seconds_count[5m])
```

---

## 알림 설정

### Grafana Alerting

Grafana 9.0+부터 새로운 Unified Alerting 시스템을 사용합니다.

#### Alert Rule 생성

**예시: High Error Rate Alert**

```yaml
# Alert Definition
name: HighErrorRate
condition: B > 1  # 1% 이상
evaluateInterval: 1m
for: 5m  # 5분 동안 지속 시 알림

# Query
expr: |
  sum(rate(http_requests_total{status=~"5.."}[5m])) /
  sum(rate(http_requests_total[5m])) * 100

# Notification
notificationChannels:
  - Slack - Critical Alerts
  - Email - Engineering Team
```

#### Notification Channels

**Slack 통합**:
```json
{
  "type": "slack",
  "settings": {
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "recipient": "#alerts",
    "username": "Grafana",
    "icon_emoji": ":warning:"
  }
}
```

**Email 통합**:
```json
{
  "type": "email",
  "settings": {
    "addresses": "team@sagaline.com",
    "singleEmail": true
  }
}
```

#### Alert 예시

**1. High Latency Alert**
```
Query: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
Condition: > 0.2 (200ms)
Duration: 5분
Severity: Warning
```

**2. Low Success Rate Alert**
```
Query: sum(orders_created_total{status="confirmed"}) / sum(orders_created_total) * 100
Condition: < 95
Duration: 10분
Severity: Critical
```

**3. Database Connection Pool Alert**
```
Query: hikaricp_connections_active / hikaricp_connections_max * 100
Condition: > 80
Duration: 5분
Severity: Warning
```

---

## 대시보드 커스터마이징

### Variables (변수)

**환경 변수**:
```
Name: environment
Type: Custom
Values: dev, staging, prod
Query: label_values(environment)
```

**엔드포인트 변수**:
```
Name: endpoint
Type: Query
Query: label_values(http_requests_total, endpoint)
Multi-value: true
Include All: true
```

**사용 예시**:
```promql
rate(http_requests_total{endpoint="$endpoint", environment="$environment"}[5m])
```

### Time Range Presets

**Quick Ranges**:
- Last 5 minutes
- Last 15 minutes
- Last 30 minutes
- Last 1 hour
- Last 6 hours (기본값)
- Last 24 hours
- Last 7 days

### Auto Refresh

**갱신 주기**:
- Off
- 5s (실시간 모니터링)
- 10s
- 30s
- 1m
- 5m

### Panel Links

**Zipkin 추적 링크**:
```
URL: http://zipkin:9411/zipkin/?traceId=${__field.traceId}
```

**Kibana 로그 링크**:
```
URL: http://kibana:5601/app/discover#/?_a=(query:(match:(traceId:'${__field.traceId}')))
```

---

## 성능 최적화

### 쿼리 최적화

#### 1. Recording Rules 사용

**문제점**: 복잡한 쿼리는 Grafana 로딩 시간 증가
```promql
# 복잡한 쿼리 (매번 계산)
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le))
```

**해결책**: Prometheus Recording Rule
```yaml
# prometheus.yml
groups:
  - name: sagaline_performance
    interval: 30s
    rules:
      - record: http:request_duration_seconds:p99
        expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (endpoint, le))
```

**Grafana에서 사용**:
```promql
# 간단한 쿼리 (pre-computed)
http:request_duration_seconds:p99
```

#### 2. 시간 범위 제한

**❌ 나쁜 예**:
```
Time Range: Last 30 days
Refresh: 5s
```
- 매우 느린 로딩
- Prometheus 부하 증가

**✅ 좋은 예**:
```
Time Range: Last 6 hours (기본값)
Refresh: 30s
```

#### 3. 데이터 포인트 제한

```promql
# Max data points: 1000 (Grafana 설정)
# 6시간 데이터: 6 * 60 * 60 / 15 = 1440 포인트
# → 다운샘플링 필요
```

### 대시보드 최적화

#### 1. 패널 수 제한
- 권장: 10-15개 패널 per 대시보드
- 현재: 14개 패널 ✅

#### 2. 쿼리 간격 조정
```
High-priority panels (에러율, 레이턴시): 5s refresh
Medium-priority (요청 수): 10s refresh
Low-priority (JVM 메모리): 30s refresh
```

#### 3. 캐싱 활용
```yaml
# Grafana 설정
[caching]
enabled = true
ttl = 60s
```

---

## 모범 사례

### 1. 의미 있는 패널 이름

**❌ 나쁜 예**:
- "Panel 1"
- "Chart"
- "Graph"

**✅ 좋은 예**:
- "1. System Overview - Request Rate"
- "5. Database Performance - Query Duration"
- "9. Error Tracking - Error Rate"

### 2. 일관된 색상 스킴

**Success/Normal**:
- Green: #73BF69

**Warning**:
- Yellow: #F2CC0C
- Orange: #FF9830

**Error/Critical**:
- Red: #E02F44

### 3. 적절한 단위 사용

```
Time: s (seconds), ms (milliseconds)
Bytes: bytes, KB, MB, GB
Percentage: percent (0-100)
Rate: reqps (requests per second)
Currency: KRW
```

### 4. 임계값 설정

**응답 시간**:
- Green: < 100ms (Good)
- Yellow: 100-200ms (Acceptable)
- Red: > 200ms (Poor)

**에러율**:
- Green: < 0.5% (Healthy)
- Yellow: 0.5-1% (Warning)
- Red: > 1% (Critical)

**리소스 사용률**:
- Green: < 70% (Normal)
- Yellow: 70-85% (High)
- Red: > 85% (Critical)

### 5. 대시보드 구성

**우선순위 배치**:
1. **최상단**: 가장 중요한 메트릭 (에러율, 레이턴시)
2. **중간**: 비즈니스 메트릭 (주문, 매출)
3. **하단**: 기술 메트릭 (JVM, 인프라)

**그리드 레이아웃**:
- 12열 그리드 사용
- 패널 크기: 6x8 (절반), 12x8 (전체)
- 일관된 높이 유지

---

## 트러블슈팅

### 문제 1: Grafana에 데이터가 표시되지 않음

**증상**:
```
No data
N/A
```

**원인 및 해결**:

1. **Prometheus 연결 확인**:
```bash
# Grafana에서 Prometheus 접근 가능한지 확인
docker exec sagaline-grafana curl http://prometheus:9090/api/v1/query?query=up
```

2. **Datasource 설정 확인**:
- Configuration → Data Sources → Prometheus → Test

3. **쿼리 확인**:
- Prometheus UI에서 직접 쿼리 실행
- http://localhost:9090/graph
- 쿼리 입력 후 결과 확인

4. **메트릭 존재 확인**:
```bash
curl http://localhost:8080/actuator/prometheus | grep http_requests_total
```

### 문제 2: 대시보드 로딩이 느림

**원인**:
- 너무 넓은 시간 범위
- 복잡한 쿼리
- 너무 많은 패널

**해결**:

1. **시간 범위 축소**:
```
Last 30 days → Last 6 hours
```

2. **Recording Rules 사용**:
```yaml
# prometheus.yml
groups:
  - name: precompute
    rules:
      - record: job:http_requests:rate5m
        expr: rate(http_requests_total[5m])
```

3. **패널 수 줄이기**:
- 별도 대시보드로 분리
- Row collapse 사용

### 문제 3: Alert가 발송되지 않음

**해결**:

1. **Alert Rule 상태 확인**:
- Alerting → Alert Rules
- State: Pending, Firing, Normal

2. **Notification Channel 테스트**:
- Alerting → Notification Channels
- Test 버튼 클릭

3. **Alertmanager 로그 확인**:
```bash
docker logs sagaline-alertmanager
```

### 문제 4: 그래프가 비어있음 (데이터는 있음)

**원인**: 시간 범위 불일치

**해결**:
1. **브라우저 시간 확인**: UTC vs Local time
2. **Grafana 시간대 설정**:
   - User → Preferences → Timezone → Browser Time

### 문제 5: Variable이 작동하지 않음

**해결**:

1. **Variable 쿼리 확인**:
```promql
# 잘못된 쿼리
label_values(endpoint)

# 올바른 쿼리
label_values(http_requests_total, endpoint)
```

2. **Variable 사용 확인**:
```promql
# 잘못된 사용
{endpoint="$endpoint"}

# 올바른 사용
{endpoint=~"$endpoint"}  # 정규식 매칭
```

---

## 참고 자료

### 내부 문서
- [메트릭 수집 (Prometheus)](./metrics-prometheus.md)
- [분산 추적 (Zipkin)](./tracing-zipkin.md)
- [알림 (Alerting)](./alerting.md)
- [Stage 2 검증 리포트](../../docs/evidence/stage-2/validation-report.md)

### 외부 리소스
- [Grafana 공식 문서](https://grafana.com/docs/grafana/latest/)
- [Prometheus Query 예시](https://prometheus.io/docs/prometheus/latest/querying/examples/)
- [PromQL 치트시트](https://promlabs.com/promql-cheat-sheet/)
- [Grafana 대시보드 라이브러리](https://grafana.com/grafana/dashboards/)

### 구현 파일 위치
- Datasource 설정: `/e-commerce/infrastructure/monitoring/grafana/provisioning/datasources/prometheus.yml`
- Dashboard 설정: `/e-commerce/infrastructure/monitoring/grafana/provisioning/dashboards/default.yml`
- Dashboard JSON: `/e-commerce/infrastructure/monitoring/grafana/dashboards/sagaline-overview.json`
- Docker Compose: `/e-commerce/infrastructure/docker/docker-compose.yml`

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-23
**작성자**: Claude (Design Documentation)
