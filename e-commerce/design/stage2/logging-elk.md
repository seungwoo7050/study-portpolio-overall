# Stage 2: 구조화된 로깅 (Structured Logging) - ELK Stack

## 문서 정보
- **작성일**: 2025-11-23
- **Stage**: 2 - Observability
- **구성 요소**: Elasticsearch, Logstash, Kibana, Logback
- **상태**: ✅ 구현 완료

---

## 목차
1. [개요](#개요)
2. [ELK 스택 아키텍처](#elk-스택-아키텍처)
3. [구조화된 로깅](#구조화된-로깅)
4. [Logback 설정](#logback-설정)
5. [Logstash 파이프라인](#logstash-파이프라인)
6. [Elasticsearch 인덱싱](#elasticsearch-인덱싱)
7. [Kibana 시각화](#kibana-시각화)
8. [로그 검색 및 필터링](#로그-검색-및-필터링)
9. [Trace ID 상관관계](#trace-id-상관관계)
10. [로그 보존 정책](#로그-보존-정책)
11. [성능 최적화](#성능-최적화)
12. [모범 사례](#모범-사례)
13. [트러블슈팅](#트러블슈팅)

---

## 개요

### 구조화된 로깅이란?

전통적인 텍스트 로그:
```
2025-11-23 10:15:30 INFO OrderService - Order created for user 12345, orderId=67890, amount=50000
```

구조화된 JSON 로그:
```json
{
  "timestamp": "2025-11-23T10:15:30.123Z",
  "level": "INFO",
  "logger": "com.sagaline.order.service.OrderService",
  "message": "Order created",
  "traceId": "80f198ee56343ba864fe8b2a57d3eff7",
  "spanId": "e457b5a2e4d86bd1",
  "userId": "12345",
  "orderId": "67890",
  "amount": 50000,
  "service": "sagaline"
}
```

**장점**:
- 필드별 검색 가능 (`userId: "12345"`)
- 집계 및 통계 분석 용이
- 자동화된 알림 및 대시보드 생성
- 다양한 로그 처리 도구와 호환

### ELK 스택이란?

**E**lasticsearch: 분산 검색 및 분석 엔진
**L**ogstash: 로그 수집, 변환, 전송 파이프라인
**K**ibana: 데이터 시각화 및 탐색 UI

### 도입 배경

**현재 과제**:
- 매일 수백만 건의 로그 생성
- 텍스트 기반 로그는 검색 및 분석이 어려움
- 분산 시스템에서 요청 추적 필요
- 실시간 문제 감지 및 알림 필요

**ELK 스택 선택 이유**:
- 업계 표준 로그 스택
- 높은 확장성 (수평 확장 가능)
- 강력한 전문 검색 (Full-text search)
- 풍부한 시각화 기능
- 오픈소스 (무료)

---

## ELK 스택 아키텍처

### 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│               Spring Boot Application                       │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Logback Logger                       │  │
│  │  - SLF4J API 사용                                      │  │
│  │  - MDC로 traceId, spanId 자동 주입                    │  │
│  │  - 비동기 로깅 (성능 최적화)                           │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────┴──────────────────┐                    │
│  │                                     │                    │
│  ▼ Dev Profile                        ▼ Prod Profile       │
│ Console Appender                   JSON Appender           │
│ - 사람이 읽기 쉬운 형식              - Logstash Encoder      │
│ - 색상 및 포맷팅                    - JSON 구조화            │
│                                     - File + TCP/UDP       │
└────────────────────┬────────────────────┬──────────────────┘
                     │                    │
                     │                    │ TCP 5000
                     │                    │ File: logs/sagaline-json.log
                     │                    ▼
                     │      ┌──────────────────────────────┐
                     │      │       Logstash               │
                     │      │  - Input: TCP, UDP, File     │
                     │      │  - Filter: Parse, Transform  │
                     │      │  - Output: Elasticsearch     │
                     │      └──────────┬───────────────────┘
                     │                 │
                     │                 │ HTTP 9200
                     │                 ▼
                     │      ┌──────────────────────────────┐
                     │      │     Elasticsearch            │
                     │      │  - 인덱싱: sagaline-logs-*   │
                     │      │  - 전문 검색 (Full-text)      │
                     │      │  - 집계 (Aggregations)       │
                     │      │  - 샤딩 및 복제               │
                     │      └──────────┬───────────────────┘
                     │                 │
                     │                 │ HTTP 9200
                     │                 ▼
                     │      ┌──────────────────────────────┐
                     │      │         Kibana               │
                     │      │  - 로그 검색 UI               │
                     │      │  - 시각화 대시보드            │
                     │      │  - 알림 및 워치               │
                     │      │  - Discover, Visualize, ...  │
                     │      └──────────────────────────────┘
                     │
                     │ (개발자 직접 확인)
                     ▼
           Console 로그 출력
```

### 데이터 흐름

**1단계: 로그 생성**
```java
// Java Code
log.info("Order created successfully: orderId={}, amount={}", orderId, amount);
```

**2단계: Logback 처리**
```
Logback:
  1. SLF4J 로그 이벤트 수신
  2. MDC에서 traceId, spanId 추출
  3. LogstashEncoder로 JSON 변환
  4. Appender를 통해 전송
```

**3단계: Logstash 처리**
```
Logstash Pipeline:
  Input: JSON 로그 수신 (TCP 5000 or File)
    ↓
  Filter: 타임스탬프 파싱, GeoIP 추가, User-Agent 파싱
    ↓
  Output: Elasticsearch에 전송 (HTTP 9200)
```

**4단계: Elasticsearch 저장**
```
Elasticsearch:
  1. JSON 문서를 인덱스에 저장
  2. 인덱스: sagaline-logs-2025.11.23
  3. 필드별 인덱싱 (검색 최적화)
  4. 샤드 분배 (부하 분산)
```

**5단계: Kibana 시각화**
```
Kibana:
  1. Elasticsearch에 쿼리 전송
  2. 결과를 UI로 표시
  3. 실시간 로그 스트리밍
  4. 대시보드 및 차트 렌더링
```

---

## 구조화된 로깅

### JSON 로그 구조

**표준 필드** (모든 로그에 포함):
```json
{
  "timestamp": "2025-11-23T10:15:30.123Z",  // ISO 8601 형식
  "level": "INFO",                           // DEBUG, INFO, WARN, ERROR
  "logger": "com.sagaline.order.service.OrderService",
  "thread": "http-nio-8080-exec-1",
  "message": "Order created successfully",
  "service": "sagaline"                      // 서비스 이름 (멀티 서비스 환경)
}
```

**Trace 컨텍스트** (분산 추적):
```json
{
  "traceId": "80f198ee56343ba864fe8b2a57d3eff7",
  "spanId": "e457b5a2e4d86bd1"
}
```

**HTTP 요청 컨텍스트**:
```json
{
  "endpoint": "/api/orders",
  "method": "POST",
  "status": 201,
  "duration_ms": 145
}
```

**비즈니스 컨텍스트** (MDC를 통해 추가):
```json
{
  "userId": "12345",
  "orderId": "67890",
  "amount": 50000,
  "paymentMethod": "toss"
}
```

### 실제 로그 예시

#### 성공적인 주문 생성
```json
{
  "timestamp": "2025-11-23T10:15:30.123Z",
  "level": "INFO",
  "traceId": "80f198ee56343ba864fe8b2a57d3eff7",
  "spanId": "e457b5a2e4d86bd1",
  "service": "sagaline",
  "logger": "com.sagaline.order.service.OrderService",
  "thread": "http-nio-8080-exec-1",
  "message": "Order created successfully",
  "userId": "12345",
  "orderId": "67890",
  "totalAmount": 50000,
  "itemCount": 3,
  "endpoint": "/api/orders",
  "method": "POST",
  "status": 201,
  "duration_ms": 145
}
```

#### 에러 로그
```json
{
  "timestamp": "2025-11-23T10:16:45.678Z",
  "level": "ERROR",
  "traceId": "abc123def456",
  "spanId": "xyz789",
  "service": "sagaline",
  "logger": "com.sagaline.payment.service.PaymentService",
  "thread": "http-nio-8080-exec-2",
  "message": "Payment processing failed",
  "exception": {
    "class": "com.sagaline.payment.exception.PaymentGatewayException",
    "message": "Connection timeout after 5000ms",
    "stackTrace": [
      "com.sagaline.payment.client.TossPaymentClient.processPayment(TossPaymentClient.java:45)",
      "com.sagaline.payment.service.PaymentService.processPayment(PaymentService.java:78)",
      "..."
    ]
  },
  "userId": "12345",
  "orderId": "67890",
  "amount": 50000,
  "paymentMethod": "toss",
  "endpoint": "/api/payments",
  "method": "POST",
  "status": 500,
  "duration_ms": 5123
}
```

---

## Logback 설정

### 의존성

`pom.xml`:
```xml
<!-- Logstash Logback Encoder (for structured JSON logging) -->
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

**위치**: `/e-commerce/pom.xml:89-94`

### Logback 설정 파일

`logback-spring.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <include resource="org/springframework/boot/logging/logback/defaults.xml"/>

    <springProperty scope="context" name="application.name" source="spring.application.name"/>

    <!-- Console Appender for Development -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %clr(%-5level) %logger{36} [traceId=%X{traceId:-}] - %msg%n</pattern>
        </encoder>
    </appender>

    <!-- JSON Appender for Structured Logging (Production/ELK) -->
    <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <customFields>{"service":"${application.name:-sagaline}"}</customFields>

            <!-- Include standard fields -->
            <includeMdcKeyName>traceId</includeMdcKeyName>
            <includeMdcKeyName>spanId</includeMdcKeyName>
            <includeMdcKeyName>userId</includeMdcKeyName>
            <includeMdcKeyName>endpoint</includeMdcKeyName>
            <includeMdcKeyName>method</includeMdcKeyName>
            <includeMdcKeyName>status</includeMdcKeyName>
            <includeMdcKeyName>duration_ms</includeMdcKeyName>

            <!-- Field names mapping -->
            <fieldNames>
                <timestamp>timestamp</timestamp>
                <message>message</message>
                <logger>logger</logger>
                <thread>thread</thread>
                <level>level</level>
                <levelValue>[ignore]</levelValue>
            </fieldNames>
        </encoder>
    </appender>

    <!-- File Appender for JSON logs -->
    <appender name="JSON_FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/sagaline-json.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/sagaline-json.%d{yyyy-MM-dd}.log.gz</fileNamePattern>
            <maxHistory>30</maxHistory>
            <totalSizeCap>1GB</totalSizeCap>
        </rollingPolicy>
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <customFields>{"service":"${application.name:-sagaline}"}</customFields>
            <includeMdcKeyName>traceId</includeMdcKeyName>
            <includeMdcKeyName>spanId</includeMdcKeyName>
            <includeMdcKeyName>userId</includeMdcKeyName>
            <includeMdcKeyName>endpoint</includeMdcKeyName>
            <includeMdcKeyName>method</includeMdcKeyName>
            <includeMdcKeyName>status</includeMdcKeyName>
            <includeMdcKeyName>duration_ms</includeMdcKeyName>
        </encoder>
    </appender>

    <!-- Profile-specific configurations -->
    <springProfile name="dev">
        <root level="INFO">
            <appender-ref ref="CONSOLE"/>
        </root>
        <logger name="com.sagaline" level="DEBUG"/>
        <logger name="org.springframework.web" level="DEBUG"/>
    </springProfile>

    <springProfile name="prod">
        <root level="INFO">
            <appender-ref ref="JSON"/>
            <appender-ref ref="JSON_FILE"/>
        </root>
        <logger name="com.sagaline" level="INFO"/>
        <logger name="org.springframework.web" level="WARN"/>
    </springProfile>

    <!-- Default configuration -->
    <springProfile name="!dev &amp; !prod">
        <root level="INFO">
            <appender-ref ref="CONSOLE"/>
            <appender-ref ref="JSON_FILE"/>
        </root>
        <logger name="com.sagaline" level="INFO"/>
    </springProfile>
</configuration>
```

**위치**: `/e-commerce/src/main/resources/logback-spring.xml`

### 주요 설정 설명

#### 1. Console Appender (개발 환경)
```xml
<pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %clr(%-5level) %logger{36} [traceId=%X{traceId:-}] - %msg%n</pattern>
```

**출력 예시**:
```
2025-11-23 10:15:30.123 [http-nio-8080-exec-1] INFO  OrderService [traceId=80f198ee56343ba864fe8b2a57d3eff7] - Order created successfully
```

#### 2. JSON Appender (프로덕션)
```xml
<encoder class="net.logstash.logback.encoder.LogstashEncoder">
    <customFields>{"service":"sagaline"}</customFields>
</encoder>
```

**LogstashEncoder 특징**:
- 자동 JSON 직렬화
- Exception 스택 트레이스 포함
- 타임스탬프 ISO 8601 포맷
- MDC 자동 포함

#### 3. Rolling File Appender
```xml
<rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
    <fileNamePattern>logs/sagaline-json.%d{yyyy-MM-dd}.log.gz</fileNamePattern>
    <maxHistory>30</maxHistory>
    <totalSizeCap>1GB</totalSizeCap>
</rollingPolicy>
```

**특징**:
- 일별 로그 파일 생성 (`sagaline-json.2025-11-23.log`)
- 자동 압축 (`.gz`)
- 30일 보관 후 자동 삭제
- 전체 용량 1GB 제한

#### 4. MDC 필드 포함
```xml
<includeMdcKeyName>traceId</includeMdcKeyName>
<includeMdcKeyName>spanId</includeMdcKeyName>
<includeMdcKeyName>userId</includeMdcKeyName>
```

MDC(Mapped Diagnostic Context)에 저장된 값을 JSON 필드로 자동 추가합니다.

### 애플리케이션에서 MDC 사용

```java
import org.slf4j.MDC;

@Service
public class OrderService {

    public Order createOrder(OrderRequest request, Long userId) {
        // MDC에 비즈니스 컨텍스트 추가
        MDC.put("userId", userId.toString());
        MDC.put("itemCount", String.valueOf(request.getItems().size()));

        try {
            log.info("Creating order for user");

            Order order = processOrder(request);

            MDC.put("orderId", order.getId().toString());
            MDC.put("totalAmount", order.getTotalAmount().toString());

            log.info("Order created successfully");

            return order;

        } finally {
            // MDC 정리 (메모리 누수 방지)
            MDC.remove("userId");
            MDC.remove("orderId");
            MDC.remove("itemCount");
            MDC.remove("totalAmount");
        }
    }
}
```

**생성되는 로그**:
```json
{
  "timestamp": "2025-11-23T10:15:30.123Z",
  "level": "INFO",
  "message": "Order created successfully",
  "userId": "12345",
  "orderId": "67890",
  "itemCount": "3",
  "totalAmount": "50000"
}
```

---

## Logstash 파이프라인

### Logstash 설정

`logstash.conf`:
```ruby
input {
  tcp {
    port => 5000
    codec => json_lines
  }

  udp {
    port => 5000
    codec => json_lines
  }

  # File input for log files
  file {
    path => "/usr/share/logstash/logs/sagaline-json.log"
    start_position => "beginning"
    codec => json
  }
}

filter {
  # Parse timestamp
  date {
    match => ["timestamp", "ISO8601"]
    target => "@timestamp"
  }

  # Add geoip if needed
  if [clientIp] {
    geoip {
      source => "clientIp"
    }
  }

  # Parse user agent if available
  if [userAgent] {
    useragent {
      source => "userAgent"
      target => "user_agent"
    }
  }

  # Add environment tag
  mutate {
    add_field => { "environment" => "${ENVIRONMENT:dev}" }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "sagaline-logs-%{+YYYY.MM.dd}"
  }

  # Debug output (remove in production)
  stdout {
    codec => rubydebug
  }
}
```

**위치**: `/e-commerce/infrastructure/monitoring/logstash/logstash.conf`

### 파이프라인 단계 설명

#### 1. Input
```ruby
tcp {
  port => 5000
  codec => json_lines
}
```

**지원 입력**:
- **TCP**: 애플리케이션에서 직접 전송 (실시간)
- **UDP**: 빠른 전송, 손실 가능 (비권장)
- **File**: 로그 파일을 읽음 (재처리 가능)

#### 2. Filter

**날짜 파싱**:
```ruby
date {
  match => ["timestamp", "ISO8601"]
  target => "@timestamp"
}
```
- JSON의 `timestamp` 필드를 Elasticsearch의 `@timestamp`로 변환
- 타임존 자동 변환

**GeoIP 추가**:
```ruby
geoip {
  source => "clientIp"
}
```
- IP 주소를 지리적 위치로 변환
- 국가, 도시, 좌표 정보 추가

**User-Agent 파싱**:
```ruby
useragent {
  source => "userAgent"
  target => "user_agent"
}
```
- 브라우저, OS, 디바이스 정보 추출

**환경 태그 추가**:
```ruby
mutate {
  add_field => { "environment" => "${ENVIRONMENT:dev}" }
}
```

#### 3. Output

**Elasticsearch 저장**:
```ruby
elasticsearch {
  hosts => ["elasticsearch:9200"]
  index => "sagaline-logs-%{+YYYY.MM.dd}"
}
```

**인덱스 네이밍**:
- `sagaline-logs-2025.11.23`
- `sagaline-logs-2025.11.24`
- 일별 인덱스로 관리 용이

---

## Elasticsearch 인덱싱

### Docker Compose 설정

```yaml
# Elasticsearch
elasticsearch:
  build:
    context: .
    dockerfile: Dockerfile.elasticsearch
  container_name: sagaline-elasticsearch
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
  ports:
    - "9200:9200"
    - "9300:9300"
  volumes:
    - es-data:/usr/share/elasticsearch/data
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:9200 || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 5
  networks:
    - sagaline-network
```

**위치**: `/e-commerce/infrastructure/docker/docker-compose.yml:51-71`

### 인덱스 구조

**인덱스 패턴**: `sagaline-logs-*`

**매핑 (자동 생성)**:
```json
{
  "mappings": {
    "properties": {
      "@timestamp": { "type": "date" },
      "level": { "type": "keyword" },
      "logger": { "type": "keyword" },
      "message": { "type": "text" },
      "traceId": { "type": "keyword" },
      "spanId": { "type": "keyword" },
      "userId": { "type": "keyword" },
      "orderId": { "type": "keyword" },
      "amount": { "type": "long" },
      "duration_ms": { "type": "long" },
      "endpoint": { "type": "keyword" },
      "method": { "type": "keyword" },
      "status": { "type": "integer" },
      "exception": {
        "properties": {
          "class": { "type": "keyword" },
          "message": { "type": "text" },
          "stackTrace": { "type": "text" }
        }
      }
    }
  }
}
```

### 필드 타입 설명

**keyword**: 정확한 일치 검색, 집계, 정렬
- `level`, `logger`, `traceId`, `userId`, `endpoint`

**text**: 전문 검색 (Full-text search)
- `message`, `exception.message`

**long/integer**: 숫자 범위 검색, 집계
- `amount`, `duration_ms`, `status`

**date**: 시간 범위 검색, 시계열 분석
- `@timestamp`

### 샤딩 및 복제

**현재 설정** (개발):
```
Shards: 1
Replicas: 0
```

**프로덕션 권장**:
```json
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1
  }
}
```

**샤드 전략**:
- 1일 1GB 로그 생성 시: 5 shards
- 1일 10GB 로그 생성 시: 10 shards
- 각 샤드 크기: 20-40GB 권장

---

## Kibana 시각화

### Docker Compose 설정

```yaml
# Kibana - Log Visualization
kibana:
  image: docker.elastic.co/kibana/kibana:8.11.0
  container_name: sagaline-kibana
  ports:
    - "5601:5601"
  environment:
    - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
  networks:
    - sagaline-network
  depends_on:
    elasticsearch:
      condition: service_healthy
```

**위치**: `/e-commerce/infrastructure/docker/docker-compose.yml:92-104`

### 접속 정보
- **URL**: http://localhost:5601
- **인증**: 없음 (개발 환경)

### 초기 설정

#### 1. Index Pattern 생성

**단계**:
1. Kibana 접속
2. **Stack Management** → **Index Patterns** 클릭
3. **Create index pattern** 클릭
4. Pattern: `sagaline-logs-*` 입력
5. Time field: `@timestamp` 선택
6. **Create index pattern** 클릭

#### 2. Discover 페이지

**기능**:
- 실시간 로그 스트리밍
- 필드별 필터링
- 시간 범위 선택
- 로그 상세 보기

**화면 구성**:
```
┌─────────────────────────────────────────────────────────────┐
│ Time Range: [Last 15 minutes ▼]  [Refresh]   [Auto-refresh] │
├─────────────────────────────────────────────────────────────┤
│ Search: level:ERROR AND endpoint:/api/orders                │
├──────────────┬──────────────────────────────────────────────┤
│ Available    │ @timestamp  level  message  traceId  userId  │
│ Fields       │────────────────────────────────────────────  │
│              │ 10:15:30    ERROR  Payment failed  abc123... │
│ + traceId    │ 10:15:25    ERROR  DB timeout      def456... │
│ + userId     │ 10:15:20    ERROR  Invalid input   ghi789... │
│ + endpoint   │                                              │
│ + level      │                                              │
│ + message    │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

#### 3. 시각화 (Visualize)

**로그 레벨 파이 차트**:
```
Query: *
Aggregation: Terms on "level"
Type: Pie Chart
```

**시간별 로그 볼륨**:
```
Query: *
X-axis: Date Histogram on @timestamp (interval: 1 minute)
Y-axis: Count
Type: Line Chart
```

**Top 10 에러 엔드포인트**:
```
Query: level:ERROR
Aggregation: Terms on "endpoint" (size: 10)
Metrics: Count
Type: Bar Chart
```

#### 4. 대시보드 (Dashboard)

**로그 모니터링 대시보드 예시**:

```
┌───────────────────────────────────────────────────────────┐
│                   Sagaline - Logs Dashboard               │
├─────────────────┬─────────────────┬───────────────────────┤
│ Total Logs      │ Error Rate      │ Avg Response Time     │
│ 1,234,567       │ 0.3%            │ 145ms                 │
├─────────────────┴─────────────────┴───────────────────────┤
│                                                           │
│  Logs Over Time                                           │
│  [Line chart showing log volume per minute]               │
│                                                           │
├───────────────────────────────────────────────────────────┤
│                 │                                         │
│ Log Levels      │  Top 10 Errors                          │
│ [Pie chart]     │  [Table with error messages]            │
│                 │                                         │
├─────────────────┴─────────────────────────────────────────┤
│                                                           │
│  Top Endpoints by Request Count                          │
│  [Bar chart]                                              │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 로그 검색 및 필터링

### Kibana Query Language (KQL)

#### 기본 검색

**단순 텍스트 검색**:
```
Order created
```
- `message` 필드에서 "Order created" 포함하는 로그 검색

**필드 검색**:
```
level:ERROR
```
- ERROR 레벨 로그만 표시

**여러 조건 (AND)**:
```
level:ERROR AND endpoint:/api/orders
```
- ERROR이면서 `/api/orders` 엔드포인트

**여러 조건 (OR)**:
```
level:ERROR OR level:WARN
```
- ERROR 또는 WARN 레벨

**부정 (NOT)**:
```
NOT level:DEBUG
```
- DEBUG 로그 제외

#### 고급 검색

**범위 검색**:
```
duration_ms > 1000
```
- 1초 이상 소요된 요청

```
status >= 400 AND status < 500
```
- 4xx 에러

**와일드카드**:
```
endpoint:/api/order*
```
- `/api/order`로 시작하는 모든 엔드포인트

**존재 여부**:
```
userId:*
```
- `userId` 필드가 존재하는 로그

```
NOT userId:*
```
- `userId` 필드가 없는 로그

#### 실전 쿼리 예시

**특정 사용자의 모든 로그**:
```
userId:"12345"
```

**특정 Trace의 모든 로그**:
```
traceId:"80f198ee56343ba864fe8b2a57d3eff7"
```

**느린 요청 찾기**:
```
duration_ms > 1000 AND endpoint:/api/orders
```

**에러 발생 후 재시도 로그**:
```
message:"Retrying payment" AND level:WARN
```

**특정 시간대의 에러**:
```
level:ERROR AND @timestamp >= "2025-11-23T10:00:00" AND @timestamp <= "2025-11-23T11:00:00"
```

**결제 실패 로그**:
```
logger:*PaymentService* AND level:ERROR
```

### Lucene Query Syntax (고급)

KQL 대신 Lucene 문법도 사용 가능:

**정규식**:
```
endpoint:/api\/(orders|payments)/
```

**퍼지 검색**:
```
message:paymnet~  (typo: payment)
```

**근접 검색**:
```
message:"order created"~5
```
- "order"와 "created"가 5단어 이내

---

## Trace ID 상관관계

### Trace ID를 통한 전체 요청 추적

**시나리오**: 사용자가 "주문이 실패했다"고 신고

**1단계: 사용자 정보로 검색**
```
userId:"12345" AND level:ERROR AND @timestamp >= "now-1h"
```

**결과**:
```json
{
  "timestamp": "2025-11-23T10:16:45.678Z",
  "level": "ERROR",
  "traceId": "abc123def456",
  "message": "Payment processing failed",
  "userId": "12345",
  "orderId": "67890"
}
```

**2단계: Trace ID로 전체 로그 검색**
```
traceId:"abc123def456"
```

**결과** (시간순 정렬):
```
10:16:30.123  INFO   OrderController: Received order request
10:16:30.135  DEBUG  OrderService: Validating order items
10:16:30.150  DEBUG  CartRepository: Finding cart for user 12345
10:16:30.165  INFO   OrderService: Creating order for user 12345
10:16:30.180  DEBUG  OrderRepository: Saving order to database
10:16:30.200  INFO   OrderService: Order created: orderId=67890
10:16:30.215  INFO   EventPublisher: Publishing order-created event
10:16:30.230  INFO   PaymentService: Processing payment for order 67890
10:16:35.500  ERROR  PaymentService: Payment gateway timeout
10:16:35.520  WARN   PaymentService: Retrying payment (attempt 2/3)
10:16:40.800  ERROR  PaymentService: Payment retry failed
10:16:40.820  ERROR  OrderService: Payment processing failed
10:16:40.835  INFO   OrderService: Rolling back order 67890
```

**3단계: Zipkin에서 Trace 확인**
- Zipkin UI에서 동일한 Trace ID 검색
- 타임라인으로 병목 지점 확인

**4단계: Grafana에서 메트릭 확인**
- 동일 시간대의 Payment Gateway 메트릭 확인
- 에러율, 레이턴시 상승 여부 확인

### 로그 → Trace → 메트릭 통합 디버깅

```
Kibana (Logs)
  └─ traceId: abc123def456
       ↓
Zipkin (Traces)
  └─ Trace Timeline: Payment timeout (5000ms)
       ↓
Grafana (Metrics)
  └─ payment_transactions_total{status="failed"}: 증가
  └─ http_request_duration_seconds{endpoint="/api/payments"}: P99 spike
```

---

## 로그 보존 정책

### Index Lifecycle Management (ILM)

**현재 설정** (수동 삭제):
```
Retention: 30일 (Logback Rolling Policy)
```

**프로덕션 권장 (Elasticsearch ILM)**:

#### ILM 정책 정의
```json
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_age": "1d",
            "max_size": "50GB"
          }
        }
      },
      "warm": {
        "min_age": "3d",
        "actions": {
          "forcemerge": {
            "max_num_segments": 1
          },
          "shrink": {
            "number_of_shards": 1
          }
        }
      },
      "cold": {
        "min_age": "7d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

**단계별 설명**:

**Hot Phase** (0-3일):
- 빠른 검색 및 인덱싱
- SSD 사용
- 실시간 분석

**Warm Phase** (3-7일):
- 읽기 전용
- 샤드 병합 (forcemerge)
- 샤드 축소 (shrink)
- HDD 사용 가능

**Cold Phase** (7-30일):
- Freeze (거의 사용 안함)
- 최소 메모리 사용
- 검색 느림

**Delete Phase** (30일 이후):
- 인덱스 삭제

### 보존 기간 설정 가이드

| 로그 타입 | 보존 기간 | 이유 |
|----------|---------|------|
| Access Logs | 30일 | 트래픽 분석, 성능 최적화 |
| Error Logs | 90일 | 장기 패턴 분석, 규제 요구사항 |
| Audit Logs | 1년 | 보안 감사, 법적 요구사항 |
| Debug Logs | 7일 | 디버깅 용도, 빠르게 증가 |

---

## 성능 최적화

### 로깅 성능 영향

**동기 로깅**:
```java
log.info("Order created");  // 즉시 파일에 쓰기
```
- 오버헤드: ~5-10ms per log
- 요청 처리 시간 증가

**비동기 로깅** (권장):
```xml
<appender name="ASYNC" class="ch.qos.logback.classic.AsyncAppender">
    <appender-ref ref="JSON_FILE"/>
    <queueSize>512</queueSize>
    <discardingThreshold>0</discardingThreshold>
</appender>
```
- 오버헤드: ~0.1ms per log
- 백그라운드 스레드가 처리

### Elasticsearch 최적화

#### 1. 벌크 인덱싱
```ruby
# Logstash output
elasticsearch {
  hosts => ["elasticsearch:9200"]
  index => "sagaline-logs-%{+YYYY.MM.dd}"

  # 벌크 설정
  flush_size => 500
  idle_flush_time => 5
}
```

**효과**:
- 개별 요청: 1000 req/sec
- 벌크 요청: 10000 req/sec (10배 향상)

#### 2. 샤드 최적화
```
인덱스 크기 < 50GB: 1 shard
인덱스 크기 50-200GB: 5 shards
인덱스 크기 > 200GB: 10+ shards
```

#### 3. 복제본 제거 (개발 환경)
```json
{
  "settings": {
    "number_of_replicas": 0
  }
}
```

**효과**:
- 인덱싱 속도 2배 향상
- 스토리지 50% 절약

#### 4. 매핑 최적화
```json
{
  "mappings": {
    "properties": {
      "message": {
        "type": "text",
        "index": false,  // 전문 검색 불필요 시
        "store": true
      }
    }
  }
}
```

### 로그 볼륨 제어

#### 1. 로그 레벨 조정
```yaml
# application.yml
logging:
  level:
    root: INFO
    com.sagaline: INFO
    org.springframework: WARN
    org.hibernate: WARN
```

**효과**:
- DEBUG → INFO: 로그 80% 감소
- INFO → WARN: 로그 50% 감소

#### 2. 샘플링
```java
// 1% 샘플링
if (Math.random() < 0.01) {
    log.debug("Detailed debug info");
}
```

#### 3. 불필요한 로그 제거
```java
// ❌ 나쁜 예
log.debug("Processing item: {}", item);  // 루프 내에서 수백만 번 호출

// ✅ 좋은 예
log.info("Processing {} items", items.size());  // 한 번만 호출
```

---

## 모범 사례

### 1. 구조화된 메시지 작성

**❌ 나쁜 예**:
```java
log.info("User " + userId + " created order " + orderId + " with amount " + amount);
```

**✅ 좋은 예**:
```java
log.info("Order created: userId={}, orderId={}, amount={}", userId, orderId, amount);

// 또는 MDC 사용
MDC.put("userId", userId.toString());
MDC.put("orderId", orderId.toString());
MDC.put("amount", amount.toString());
log.info("Order created");
```

### 2. 적절한 로그 레벨 사용

**ERROR**: 즉시 조치 필요한 심각한 문제
```java
log.error("Payment gateway unreachable", exception);
```

**WARN**: 잠재적 문제, 주의 필요
```java
log.warn("Database connection pool 80% utilized");
```

**INFO**: 중요한 비즈니스 이벤트
```java
log.info("Order created: orderId={}", orderId);
```

**DEBUG**: 개발/디버깅 정보
```java
log.debug("Validating cart items: count={}", items.size());
```

**TRACE**: 매우 상세한 디버깅 정보
```java
log.trace("Processing item: {}", item);
```

### 3. 예외 로깅

**❌ 나쁜 예**:
```java
catch (Exception e) {
    log.error("Error: " + e.getMessage());  // 스택 트레이스 없음
}
```

**✅ 좋은 예**:
```java
catch (PaymentException e) {
    log.error("Payment processing failed: orderId={}, amount={}",
              orderId, amount, e);  // 마지막 인자로 Exception 전달
}
```

### 4. 민감 정보 제외

**❌ 나쁜 예**:
```java
log.info("User login: email={}, password={}", email, password);
log.debug("Credit card: {}", creditCardNumber);
```

**✅ 좋은 예**:
```java
log.info("User login: userId={}", userId);
log.debug("Payment method: {}", paymentMethod);  // "toss", not card number
```

### 5. 성능 고려

**❌ 나쁜 예**:
```java
log.debug("Large object: " + largeObject.toString());  // 항상 실행
```

**✅ 좋은 예**:
```java
if (log.isDebugEnabled()) {
    log.debug("Large object: {}", expensiveOperation());  // DEBUG일 때만 실행
}
```

---

## 트러블슈팅

### 문제 1: Elasticsearch에 로그가 저장되지 않음

**증상**:
- 애플리케이션 로그 파일에는 로그 기록됨
- Kibana에서 로그 검색 안됨

**해결**:

1. **Logstash 동작 확인**:
```bash
docker logs sagaline-logstash

# 정상 출력 예시:
# [INFO] Pipeline started successfully
```

2. **Logstash 파이프라인 테스트**:
```bash
# Logstash 컨테이너 접속
docker exec -it sagaline-logstash bash

# 설정 검증
/usr/share/logstash/bin/logstash -t -f /usr/share/logstash/pipeline/logstash.conf
```

3. **Elasticsearch 인덱스 확인**:
```bash
curl http://localhost:9200/_cat/indices?v

# sagaline-logs-* 인덱스가 있어야 함
```

### 문제 2: Kibana에서 Index Pattern을 찾을 수 없음

**증상**:
```
No index patterns found
```

**해결**:

1. **Elasticsearch에 데이터 있는지 확인**:
```bash
curl http://localhost:9200/sagaline-logs-*/_count
```

2. **로그 생성**:
```bash
# 애플리케이션에 요청 보내기
curl http://localhost:8080/api/health
```

3. **Index Pattern 재생성**:
- Stack Management → Index Patterns → Create
- Pattern: `sagaline-logs-*`

### 문제 3: 로그에 traceId가 없음

**해결**: [분산 추적 문서](./tracing-zipkin.md#트러블슈팅) 참조

### 문제 4: Elasticsearch 메모리 부족

**증상**:
```
Elasticsearch died: OutOfMemoryError
```

**해결**:

```yaml
# docker-compose.yml
elasticsearch:
  environment:
    - "ES_JAVA_OPTS=-Xms1g -Xmx1g"  # 512m → 1g로 증가
```

### 문제 5: 로그 검색이 느림

**원인**:
- 너무 많은 데이터
- 비효율적인 쿼리
- 샤드 과다

**해결**:

1. **시간 범위 좁히기**:
```
Last 15 minutes (instead of Last 7 days)
```

2. **인덱스 필터링**:
```
Index pattern: sagaline-logs-2025.11.23 (instead of sagaline-logs-*)
```

3. **샤드 축소**:
```bash
# Force merge old indices
curl -X POST "localhost:9200/sagaline-logs-2025.11.01/_forcemerge?max_num_segments=1"
```

---

## 참고 자료

### 내부 문서
- [분산 추적 (Zipkin)](./tracing-zipkin.md)
- [메트릭 수집 (Prometheus)](./metrics-prometheus.md)
- [시각화 (Grafana)](./visualization-grafana.md)
- [Stage 2 검증 리포트](../../docs/evidence/stage-2/validation-report.md)

### 외부 리소스
- [Logstash 공식 문서](https://www.elastic.co/guide/en/logstash/current/index.html)
- [Elasticsearch 공식 문서](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana 공식 문서](https://www.elastic.co/guide/en/kibana/current/index.html)
- [Logback 문서](http://logback.qos.ch/manual/)
- [Logstash Encoder](https://github.com/logfellow/logstash-logback-encoder)

### 구현 파일 위치
- Logback 설정: `/e-commerce/src/main/resources/logback-spring.xml`
- Logstash 파이프라인: `/e-commerce/infrastructure/monitoring/logstash/logstash.conf`
- Logstash 설정: `/e-commerce/infrastructure/monitoring/logstash/logstash.yml`
- Docker Compose: `/e-commerce/infrastructure/docker/docker-compose.yml:51-104`
- Logstash Encoder 의존성: `/e-commerce/pom.xml:89-94`

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-23
**작성자**: Claude (Design Documentation)
