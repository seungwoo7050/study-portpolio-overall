# Stage 2: 알림 (Alerting) - Prometheus & Alertmanager

## 문서 정보
- **작성일**: 2025-11-23
- **Stage**: 2 - Observability
- **구성 요소**: Prometheus Alert Rules, Alertmanager
- **상태**: ✅ 구현 완료

---

## 목차
1. [개요](#개요)
2. [Alerting 아키텍처](#alerting-아키텍처)
3. [Alert Rules](#alert-rules)
4. [Alertmanager 설정](#alertmanager-설정)
5. [Routing 및 Grouping](#routing-및-grouping)
6. [Notification Channels](#notification-channels)
7. [Inhibition Rules](#inhibition-rules)
8. [Silencing](#silencing)
9. [프로덕션 설정](#프로덕션-설정)
10. [모범 사례](#모범-사례)
11. [트러블슈팅](#트러블슈팅)

---

## 개요

### Alerting이란?

알림(Alerting)은 시스템 메트릭이 정의된 임계값을 초과하거나 비정상 상태가 감지될 때 운영팀에게 자동으로 통지하는 메커니즘입니다.

### 핵심 개념

**Alert Rule**: 알림 조건을 정의하는 규칙
```yaml
alert: HighErrorRate
expr: error_rate > 0.01  # 에러율 1% 초과
for: 5m                   # 5분 동안 지속
```

**Alert State**:
- **Inactive**: 조건 미충족
- **Pending**: 조건 충족, `for` 기간 대기 중
- **Firing**: `for` 기간 경과, 알림 발송

**Severity (심각도)**:
- **critical**: 즉시 조치 필요 (서비스 다운, 높은 에러율)
- **warning**: 주의 필요 (높은 리소스 사용률)
- **info**: 정보성 알림 (트래픽 없음)

### Prometheus vs Alertmanager

**Prometheus**:
- Alert Rule 평가
- Alert 상태 관리 (Inactive/Pending/Firing)
- Alertmanager에 Alert 전송

**Alertmanager**:
- Alert 그룹화 (Grouping)
- Alert 라우팅 (Routing)
- Alert 중복 제거 (Deduplication)
- Alert 억제 (Inhibition)
- 알림 채널로 전송 (Email, Slack, PagerDuty 등)

---

## Alerting 아키텍처

### 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│               Spring Boot Application                       │
│  - /actuator/prometheus (메트릭 노출)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Scrape (15초마다)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Prometheus Server                           │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Alert Rules (alerts.yml)                 │  │
│  │                                                       │  │
│  │  1. HighErrorRate           (critical)                │  │
│  │  2. HighLatency             (warning)                 │  │
│  │  3. DatabaseConnectionPoolHigh (warning)              │  │
│  │  4. HighDiskUsage           (warning)                 │  │
│  │  5. ServiceDown             (critical)                │  │
│  │  6. HighMemoryUsage         (warning)                 │  │
│  │  7. NoRequestsReceived      (info)                    │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│                      │ 30초마다 평가                          │
│                      ▼                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Alert State Machine                         │  │
│  │                                                       │  │
│  │  Inactive ──▶ Pending ──▶ Firing                      │  │
│  │     ▲            │           │                         │  │
│  │     └────────────┴───────────┘                         │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│                      │ Alert가 Firing 상태일 때               │
│                      │ HTTP POST /api/v1/alerts              │
│                      ▼                                       │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ Firing Alerts
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Alertmanager                              │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Grouping                            │  │
│  │  동일한 alertname + severity의 Alert를 그룹화           │  │
│  │  예: HighLatency (endpoint=A, B, C) → 1개 알림          │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │                   Routing                             │  │
│  │  severity에 따라 다른 receiver로 전달                   │  │
│  │  - critical → critical-alerts                         │  │
│  │  - warning  → warning-alerts                          │  │
│  │  - info     → info-alerts                             │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │                 Inhibition                            │  │
│  │  critical Alert가 있으면 동일 component의 warning 억제  │  │
│  │  예: ServiceDown (critical) → HighLatency (warning) 억제│  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │              Notification                             │  │
│  │  - critical-alerts → Slack, PagerDuty                 │  │
│  │  - warning-alerts  → Email, Slack                     │  │
│  │  - info-alerts     → Email                            │  │
│  └───────────────────┬───────────────────────────────────┘  │
└────────────────────┬─┴───────────────────────────────────────┘
                     │
                     ├─ HTTP POST → Slack Webhook
                     ├─ SMTP → Email
                     └─ API → PagerDuty
```

### 데이터 흐름 예시

**시나리오**: 에러율이 1%를 초과하여 5분 동안 지속

```
1. Prometheus Scrape (t=0)
   http_requests_total{status="500"}: 100
   http_requests_total: 10000
   → 에러율: 1%

2. Alert Rule 평가 (t=0)
   expr: (http_requests_total{status=~"5.."} / http_requests_total) > 0.01
   result: true
   state: Inactive → Pending
   pending_since: t=0

3. Alert Rule 평가 (t=30s, t=1m, t=2m, ...)
   result: true (계속 조건 충족)
   state: Pending
   pending_since: t=0

4. Alert Rule 평가 (t=5m)
   result: true
   for: 5m 경과!
   state: Pending → Firing
   → Alertmanager에 Alert 전송

5. Alertmanager 처리 (t=5m)
   Alert: HighErrorRate
   severity: critical
   component: application

   5.1. Grouping
       group_by: [alertname, severity]
       → "HighErrorRate-critical" 그룹

   5.2. Routing
       severity: critical
       → receiver: critical-alerts

   5.3. Inhibition 체크
       (해당 없음)

   5.4. Notification 전송
       → Slack: #alerts-critical
       → PagerDuty: On-call engineer

6. Alert Resolution (t=10m)
   에러율이 0.5%로 감소
   result: false
   state: Firing → Inactive
   → Alertmanager에 resolved 전송

7. Alertmanager 처리 (t=10m)
   → Slack: "✅ Resolved: HighErrorRate"
   → PagerDuty: Incident auto-resolved
```

---

## Alert Rules

### 7개 Alert Rules

**위치**: `/e-commerce/infrastructure/monitoring/prometheus/alerts.yml`

#### 1. HighErrorRate (높은 에러율)

```yaml
- alert: HighErrorRate
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[5m])) /
      sum(rate(http_requests_total[5m]))
    ) > 0.01
  for: 5m
  labels:
    severity: critical
    component: application
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"
```

**설명**:
- **조건**: 5xx 에러율이 1% 초과
- **지속 시간**: 5분
- **심각도**: critical
- **영향**: 사용자 경험 저하, 서비스 안정성 위협

**대응**:
1. Grafana에서 에러 스파이크 확인
2. Kibana에서 에러 로그 검색
3. Zipkin에서 느린 Trace 분석
4. 최근 배포 확인 및 롤백 고려

#### 2. HighLatency (높은 응답 시간)

```yaml
- alert: HighLatency
  expr: |
    histogram_quantile(0.99,
      sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
    ) > 0.2
  for: 5m
  labels:
    severity: warning
    component: application
  annotations:
    summary: "High API latency detected"
    description: "P99 latency is {{ $value }}s for endpoint {{ $labels.endpoint }} (threshold: 200ms)"
```

**설명**:
- **조건**: P99 응답 시간이 200ms 초과
- **지속 시간**: 5분
- **심각도**: warning
- **영향**: 사용자 경험 저하

**대응**:
1. Zipkin에서 느린 엔드포인트 분석
2. 데이터베이스 쿼리 최적화
3. 캐시 히트율 확인
4. 외부 API 호출 시간 확인

#### 3. DatabaseConnectionPoolHigh (DB 연결 풀 높음)

```yaml
- alert: DatabaseConnectionPoolHigh
  expr: |
    (
      hikaricp_connections_active /
      hikaricp_connections_max
    ) > 0.8
  for: 5m
  labels:
    severity: warning
    component: database
  annotations:
    summary: "Database connection pool usage is high"
    description: "Connection pool usage is {{ $value | humanizePercentage }} (threshold: 80%)"
```

**설명**:
- **조건**: DB 연결 풀 사용률이 80% 초과
- **지속 시간**: 5분
- **심각도**: warning
- **영향**: DB 연결 부족으로 인한 요청 실패 가능성

**대응**:
1. 연결 풀 크기 증가 (`hikaricp.maximum-pool-size`)
2. 느린 쿼리 최적화
3. N+1 쿼리 문제 해결
4. 연결 누수(leak) 확인

#### 4. HighDiskUsage (높은 디스크 사용률)

```yaml
- alert: HighDiskUsage
  expr: |
    (
      (node_filesystem_size_bytes - node_filesystem_free_bytes) /
      node_filesystem_size_bytes
    ) > 0.85
  for: 5m
  labels:
    severity: warning
    component: infrastructure
  annotations:
    summary: "High disk usage detected"
    description: "Disk usage is {{ $value | humanizePercentage }} (threshold: 85%)"
```

**설명**:
- **조건**: 디스크 사용률이 85% 초과
- **지속 시간**: 5분
- **심각도**: warning
- **영향**: 로그 작성 실패, 애플리케이션 중단 가능성

**대응**:
1. 오래된 로그 파일 삭제
2. 로그 보존 기간 단축
3. 디스크 용량 증가
4. 로그 압축 활성화

#### 5. ServiceDown (서비스 다운)

```yaml
- alert: ServiceDown
  expr: up{job="sagaline-app"} == 0
  for: 1m
  labels:
    severity: critical
    component: application
  annotations:
    summary: "Sagaline service is down"
    description: "The Sagaline application has been down for more than 1 minute"
```

**설명**:
- **조건**: Prometheus가 애플리케이션에 접근 불가
- **지속 시간**: 1분
- **심각도**: critical
- **영향**: 서비스 완전 중단

**대응**:
1. 애플리케이션 로그 확인
2. Docker/Kubernetes 상태 확인
3. 애플리케이션 재시작
4. Health check 엔드포인트 확인
5. 인시던트 보고서 작성

#### 6. HighMemoryUsage (높은 메모리 사용률)

```yaml
- alert: HighMemoryUsage
  expr: |
    (
      jvm_memory_used_bytes{area="heap"} /
      jvm_memory_max_bytes{area="heap"}
    ) > 0.85
  for: 5m
  labels:
    severity: warning
    component: application
  annotations:
    summary: "High JVM memory usage"
    description: "JVM heap usage is {{ $value | humanizePercentage }} (threshold: 85%)"
```

**설명**:
- **조건**: JVM 힙 메모리 사용률이 85% 초과
- **지속 시간**: 5분
- **심각도**: warning
- **영향**: OutOfMemoryError 가능성, GC 증가로 인한 성능 저하

**대응**:
1. 메모리 누수 확인 (Heap Dump 분석)
2. 힙 크기 증가 (`-Xmx`)
3. 불필요한 객체 제거
4. 캐시 크기 조정

#### 7. NoRequestsReceived (요청 없음)

```yaml
- alert: NoRequestsReceived
  expr: |
    rate(http_requests_total[5m]) == 0
  for: 10m
  labels:
    severity: info
    component: application
  annotations:
    summary: "No HTTP requests received"
    description: "The application has not received any requests in the last 10 minutes"
```

**설명**:
- **조건**: 10분 동안 HTTP 요청 없음
- **지속 시간**: 10분
- **심각도**: info
- **영향**: 트래픽 이상 가능성 (로드밸런서 문제, 네트워크 문제 등)

**대응**:
1. 로드밸런서 상태 확인
2. DNS 설정 확인
3. 방화벽 규칙 확인
4. 예상된 다운타임인지 확인

---

## Alertmanager 설정

### 설정 파일

**위치**: `/e-commerce/infrastructure/monitoring/prometheus/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default-receiver'

  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true

    - match:
        severity: warning
      receiver: 'warning-alerts'

    - match:
        severity: info
      receiver: 'info-alerts'

receivers:
  - name: 'default-receiver'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'
        send_resolved: true

  - name: 'critical-alerts'
    webhook_configs:
      - url: 'http://localhost:5001/webhook/critical'
        send_resolved: true

  - name: 'warning-alerts'
    webhook_configs:
      - url: 'http://localhost:5001/webhook/warning'
        send_resolved: true

  - name: 'info-alerts'
    webhook_configs:
      - url: 'http://localhost:5001/webhook/info'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'component']
```

### 주요 설정 설명

#### Global 설정
```yaml
global:
  resolve_timeout: 5m
```
- **resolve_timeout**: Alert가 resolved 상태로 표시되지 않으면 5분 후 자동 해결

#### Route 설정
```yaml
route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
```

- **group_by**: Alert를 그룹화하는 라벨
  - `alertname`, `severity` 기준으로 그룹화
  - 예: `HighLatency-warning` 그룹에 모든 HighLatency warning Alert 포함

- **group_wait**: 첫 Alert 수신 후 알림 전송 전 대기 시간
  - 10초 대기하여 동시에 발생하는 Alert를 그룹화

- **group_interval**: 동일 그룹에 새로운 Alert 추가 시 대기 시간
  - 10초마다 그룹 업데이트

- **repeat_interval**: 동일한 Alert 재전송 간격
  - 12시간마다 재전송 (Alert가 계속 Firing 상태일 경우)

---

## Routing 및 Grouping

### Routing Tree

```
Root Route (default-receiver)
  ├─ severity: critical → critical-alerts (continue: true)
  ├─ severity: warning  → warning-alerts
  └─ severity: info     → info-alerts
```

**continue: true** 설명:
- `continue: true`: 하위 route 계속 평가
- 예: `severity: critical` Alert는 `critical-alerts`와 `default-receiver` 모두 수신

### Grouping 예시

**시나리오**: 3개의 엔드포인트에서 동시에 HighLatency 발생

```
Alert 1:
  alertname: HighLatency
  severity: warning
  endpoint: /api/orders

Alert 2:
  alertname: HighLatency
  severity: warning
  endpoint: /api/users

Alert 3:
  alertname: HighLatency
  severity: warning
  endpoint: /api/products
```

**Without Grouping** (나쁜 예):
```
Notification 1: "HighLatency for /api/orders"
Notification 2: "HighLatency for /api/users"
Notification 3: "HighLatency for /api/products"
→ 3개의 알림 (스팸)
```

**With Grouping** (group_by: [alertname, severity]):
```
Notification 1: "HighLatency (3 alerts)
  - /api/orders: 350ms
  - /api/users: 420ms
  - /api/products: 380ms
→ 1개의 알림 (간결)
```

---

## Notification Channels

### 현재 설정 (Webhook)

개발 환경에서는 Webhook을 사용하여 알림을 테스트합니다.

```yaml
receivers:
  - name: 'critical-alerts'
    webhook_configs:
      - url: 'http://localhost:5001/webhook/critical'
        send_resolved: true
```

### 프로덕션 설정

#### 1. Slack

```yaml
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts-critical'
        title: '🚨 Critical Alert'
        text: |
          *Alert:* {{ .GroupLabels.alertname }}
          *Severity:* {{ .CommonLabels.severity }}
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}
        send_resolved: true
```

**Slack 메시지 예시**:
```
🚨 Critical Alert

Alert: HighErrorRate
Severity: critical
Summary: High error rate detected
Description: Error rate is 2.5% (threshold: 1%)

[View in Grafana] [View in Prometheus]
```

#### 2. Email

```yaml
receivers:
  - name: 'warning-alerts'
    email_configs:
      - to: 'engineering@sagaline.com'
        from: 'alerts@sagaline.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@sagaline.com'
        auth_password: 'password'
        headers:
          Subject: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
        html: |
          <h2>{{ .GroupLabels.alertname }}</h2>
          <p><strong>Severity:</strong> {{ .CommonLabels.severity }}</p>
          <p><strong>Description:</strong> {{ .CommonAnnotations.description }}</p>
        send_resolved: true
```

#### 3. PagerDuty

```yaml
receivers:
  - name: 'critical-alerts'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        description: |
          {{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}
        details:
          severity: '{{ .CommonLabels.severity }}'
          description: '{{ .CommonAnnotations.description }}'
        send_resolved: true
```

#### 4. Webhook (Custom Integration)

```yaml
receivers:
  - name: 'custom-alerts'
    webhook_configs:
      - url: 'https://api.sagaline.com/alerts/webhook'
        send_resolved: true
        http_config:
          bearer_token: 'YOUR_SECRET_TOKEN'
```

**Webhook Payload 예시**:
```json
{
  "receiver": "custom-alerts",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighErrorRate",
        "severity": "critical",
        "component": "application"
      },
      "annotations": {
        "summary": "High error rate detected",
        "description": "Error rate is 2.5% (threshold: 1%)"
      },
      "startsAt": "2025-11-23T10:15:00Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "http://prometheus:9090/graph?..."
    }
  ],
  "groupLabels": {
    "alertname": "HighErrorRate",
    "severity": "critical"
  },
  "commonLabels": {
    "alertname": "HighErrorRate",
    "severity": "critical",
    "component": "application"
  },
  "commonAnnotations": {
    "summary": "High error rate detected",
    "description": "Error rate is 2.5% (threshold: 1%)"
  },
  "externalURL": "http://alertmanager:9093"
}
```

---

## Inhibition Rules

### 개념

Inhibition(억제)은 특정 Alert가 발생했을 때 관련된 다른 Alert의 알림을 억제하는 기능입니다.

### 설정

```yaml
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'component']
```

**설명**:
- **source_match**: critical severity Alert가 발생하면
- **target_match**: 동일한 alertname과 component의 warning severity Alert를 억제
- **equal**: alertname과 component가 동일해야 억제

### 예시 시나리오

**Alert 발생**:
```
1. ServiceDown (critical, component=application)
2. HighLatency (warning, component=application)
3. HighMemoryUsage (warning, component=application)
```

**Inhibition 처리**:
- `ServiceDown`(critical)이 발생
- 동일한 component의 warning Alert 억제:
  - ~~HighLatency~~ (억제됨)
  - ~~HighMemoryUsage~~ (억제됨)
- **결과**: `ServiceDown` 알림만 전송

**이유**:
- 서비스가 다운되면 당연히 레이턴시가 높고 메모리 사용률도 비정상
- 중복 알림 방지로 노이즈 감소

---

## Silencing

### 개념

Silencing(침묵)은 특정 Alert의 알림을 일시적으로 비활성화하는 기능입니다.

### 사용 시기

**예정된 유지보수**:
```
2025-11-23 14:00 ~ 16:00
데이터베이스 마이그레이션 작업
→ DatabaseConnectionPoolHigh Alert 침묵
```

**알려진 이슈**:
```
외부 결제 게이트웨이 장애 (진행 중)
→ PaymentGatewayTimeout Alert 침묵
```

### Alertmanager UI에서 설정

1. **Alertmanager UI 접속**: http://localhost:9093
2. **Silences** 탭 클릭
3. **New Silence** 클릭
4. **설정**:
   ```
   Matchers:
     alertname = HighLatency
     endpoint = /api/orders

   Start: 2025-11-23 14:00
   End: 2025-11-23 16:00

   Creator: ops-team
   Comment: Scheduled database migration
   ```
5. **Create** 클릭

### amtool을 통한 설정

```bash
# Silence 생성
amtool silence add alertname=HighLatency endpoint=/api/orders \
  --start='2025-11-23T14:00:00+09:00' \
  --end='2025-11-23T16:00:00+09:00' \
  --comment='Scheduled database migration' \
  --author='ops-team'

# Silence 목록 확인
amtool silence query

# Silence 제거
amtool silence expire <silence-id>
```

---

## 프로덕션 설정

### 권장 Notification 채널

**Severity별 채널**:

| Severity | Channels | Response Time |
|----------|----------|---------------|
| critical | Slack (#alerts-critical), PagerDuty (on-call engineer) | 즉시 (5분 이내) |
| warning  | Slack (#alerts-warning), Email (engineering@sagaline.com) | 1시간 이내 |
| info     | Email (ops@sagaline.com) | 다음 영업일 |

### Multi-channel 설정

```yaml
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts-critical'
        send_resolved: true

    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        send_resolved: true

    email_configs:
      - to: 'engineering@sagaline.com'
        send_resolved: true
```

### Alert 라벨 확장

```yaml
- alert: HighErrorRate
  expr: ...
  labels:
    severity: critical
    component: application
    team: backend
    service: sagaline
    environment: production
    runbook: https://wiki.sagaline.com/runbooks/high-error-rate
```

**runbook** 라벨:
- 대응 절차(Runbook) 문서 링크
- 온콜 엔지니어가 즉시 참조 가능

### Alert 템플릿

```yaml
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - api_url: '...'
        title: |
          [{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}
        text: |
          *Severity:* {{ .CommonLabels.severity }}
          *Component:* {{ .CommonLabels.component }}
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}

          *Started At:* {{ .StartsAt }}
          *Runbook:* {{ .CommonLabels.runbook }}

          <{{ .GeneratorURL }}|View in Prometheus>
          <http://grafana:3000|View in Grafana>
```

---

## 모범 사례

### 1. Alert Fatigue 방지

**문제**: 너무 많은 알림으로 인한 피로도 증가
```
10분에 50개 알림
→ 엔지니어가 무시하기 시작
→ 실제 중요한 알림 놓침
```

**해결책**:
1. **임계값 조정**: 너무 낮은 임계값 상향 조정
2. **for 기간 증가**: 일시적 스파이크 무시
3. **Grouping 활용**: 유사한 Alert 그룹화
4. **Inhibition 사용**: 중복 Alert 억제

### 2. Actionable Alerts

**❌ 나쁜 예**:
```yaml
annotations:
  summary: "High latency"
  description: "Latency is high"
```
- 모호한 설명
- 조치 방법 불명확

**✅ 좋은 예**:
```yaml
annotations:
  summary: "High API latency detected"
  description: |
    P99 latency is {{ $value }}s for endpoint {{ $labels.endpoint }} (threshold: 200ms)

    Possible causes:
    1. Database slow queries
    2. External API timeout
    3. High traffic

    Runbook: https://wiki.sagaline.com/runbooks/high-latency
```

### 3. Alert Rule 네이밍

**명확하고 일관된 이름**:
```
HighErrorRate (not ErrorProblem)
DatabaseConnectionPoolHigh (not DBIssue)
ServiceDown (not AppNotWorking)
```

### 4. Severity 기준

**critical**:
- 서비스 완전 중단
- 데이터 손실
- 보안 침해
- 즉시 조치 필요

**warning**:
- 성능 저하
- 리소스 부족 임박
- 1시간 이내 조치 필요

**info**:
- 정보성 알림
- 추세 분석
- 업무 시간 내 확인

### 5. On-Call Rotation

**PagerDuty 설정**:
```yaml
pagerduty_configs:
  - service_key: 'production-oncall'
    severity: '{{ .CommonLabels.severity }}'

    # Escalation Policy
    escalation_policy: 'production-escalation'
    # L1: Primary on-call (5분)
    # L2: Secondary on-call (15분)
    # L3: Engineering manager (30분)
```

---

## 트러블슈팅

### 문제 1: Alert가 발송되지 않음

**증상**: Prometheus에서 Alert는 Firing 상태이지만 알림이 오지 않음

**해결**:

1. **Prometheus → Alertmanager 연결 확인**:
```bash
# Prometheus 설정 확인
curl http://localhost:9090/api/v1/status/config | jq .data.yaml | grep alertmanagers

# Alertmanager 상태 확인
curl http://localhost:9090/api/v1/alertmanagers
```

2. **Alertmanager에서 Alert 수신 확인**:
```bash
# Alertmanager UI
http://localhost:9093/#/alerts

# API
curl http://localhost:9093/api/v2/alerts
```

3. **Receiver 설정 확인**:
```yaml
# Alertmanager 로그 확인
docker logs sagaline-alertmanager

# Webhook 응답 확인
curl -X POST http://localhost:5001/webhook/critical
```

### 문제 2: Alert가 너무 자주 발송됨

**증상**: 동일한 Alert가 5분마다 재전송됨

**원인**: `repeat_interval` 설정이 너무 짧음
```yaml
route:
  repeat_interval: 5m  # 너무 짧음!
```

**해결**:
```yaml
route:
  repeat_interval: 12h  # 12시간으로 증가
```

### 문제 3: Alert가 즉시 발송됨 (Pending 건너뜀)

**증상**: `for: 5m` 설정했지만 즉시 알림 발송

**원인**: Alert Rule 문법 오류
```yaml
# ❌ 잘못된 설정
- alert: HighErrorRate
  for: 5m  # expr 위에 있으면 무시됨!
  expr: error_rate > 0.01

# ✅ 올바른 설정
- alert: HighErrorRate
  expr: error_rate > 0.01
  for: 5m  # expr 아래에 위치
```

### 문제 4: Grouping이 작동하지 않음

**증상**: 동일한 Alert가 개별적으로 전송됨

**원인**: `group_by` 라벨 불일치
```yaml
# Alert Rule
labels:
  severity: critical  # 소문자

# Alertmanager Route
group_by: ['Severity']  # 대문자 (불일치!)
```

**해결**:
```yaml
# 라벨명은 대소문자 구분
group_by: ['severity']  # 소문자로 통일
```

### 문제 5: Inhibition이 작동하지 않음

**증상**: critical Alert 발생 시에도 warning Alert가 계속 전송됨

**원인**: `equal` 라벨 불일치
```yaml
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['component']  # 'component' 라벨 필요

# Alert에 'component' 라벨이 없음!
```

**해결**:
```yaml
# 모든 Alert Rule에 component 라벨 추가
labels:
  severity: warning
  component: application  # 추가!
```

---

## 참고 자료

### 내부 문서
- [메트릭 수집 (Prometheus)](./metrics-prometheus.md)
- [시각화 (Grafana)](./visualization-grafana.md)
- [Stage 2 검증 리포트](../../docs/evidence/stage-2/validation-report.md)

### 외부 리소스
- [Prometheus Alerting 문서](https://prometheus.io/docs/alerting/latest/overview/)
- [Alertmanager 문서](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Alert Rule 예시](https://awesome-prometheus-alerts.grep.to/)
- [Runbook 예시](https://github.com/kubernetes-monitoring/kubernetes-mixin/tree/master/runbook.md)

### 구현 파일 위치
- Alert Rules: `/e-commerce/infrastructure/monitoring/prometheus/alerts.yml`
- Alertmanager 설정: `/e-commerce/infrastructure/monitoring/prometheus/alertmanager.yml`
- Prometheus 설정: `/e-commerce/infrastructure/monitoring/prometheus/prometheus.yml`
- Docker Compose: `/e-commerce/infrastructure/docker/docker-compose.yml`

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-23
**작성자**: Claude (Design Documentation)
