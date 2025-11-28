# Sagaline - 전자상거래 플랫폼

**상태**: ✅ Bootstrap 완료
**기술 스택**: Spring Boot 3.2 · Java 17 · PostgreSQL · Redis · Kafka · Elasticsearch

한국 시장을 위한 프로덕션 품질 전자상거래 백엔드, 모놀리스에서 클라우드 네이티브 마이크로서비스로 진화.

---

## 설계 문서

프로젝트의 **가장 정확하고 상세한 설계 정보**는 `design/` 폴더를 참조하세요:

**Checkpoint: Core (Stage 0-4)**:
- **[Stage 0](design/stage-0-bootstrap.md)**: Bootstrap - 프로젝트 기초 & CI/CD
- **[Stage 1](design/stage-1-monolith.md)**: 모놀리스 기반 - 핵심 도메인 구현
- **[Stage 2](design/stage-2-observability.md)**: 관측성 - Prometheus, Grafana, ELK
- **[Stage 3](design/stage-3-scale.md)**: 규모 확장 - 캐시, 검색, 비동기
- **[Stage 4](design/stage-4-reliability.md)**: 안정성 - 복원력, 장애 처리

**Checkpoint: Scale (Stage 5-9)** - 설계 진행 중

---

## 상태

- **단계**: Bootstrap 완료
- **프레임워크**: Spring Boot 3.2.0
- **언어**: Java 17
- **버전**: 0.1.0

## CI/CD

모든 푸시마다 자동 품질 검사:
- ✅ 빌드 & 컴파일
- ✅ 유닛 & 통합 테스트
- ✅ 코드 커버리지 (≥80%)
- ✅ 보안 스캔 (Trivy)
- ✅ 바이너리 파일 검사
- ✅ OpenAPI 검증

자세한 내용은 [CI/CD 설정](docs/CI-CD-SETUP.md) 참조.

## 프로젝트 개요

Sagaline은 로컬 결제 시스템(Toss Payments), 인증(Kakao OAuth), 규정 준수(PIPA)를 완벽하게 통합한 한국 시장을 위해 설계된 종합 전자상거래 플랫폼입니다.

### 세 가지 경력 체크포인트

- **Checkpoint: Core** (Stage 1-4, 18주) → 주니어 백엔드 엔지니어
- **Checkpoint: Scale** (+ Stage 5, 25주) → 미들 백엔드 엔지니어
- **Checkpoint: Cloud** (+ Stage 6-9, 36주) → 시니어 백엔드 엔지니어

## 기술 스택

**핵심**
- 프레임워크: Spring Boot 3.2.0
- 언어: Java 17
- 빌드 도구: Maven 3.9+
- 데이터베이스: PostgreSQL 15+
- 캐시: Redis 7+

**검색 & 메시징**
- 검색: Nori 토크나이저를 사용한 Elasticsearch 8.x (한글)
- 메시지 큐: Apache Kafka 3.x

**모니터링 & 관측성**
- 메트릭: Prometheus, Micrometer
- 시각화: Grafana
- 로깅: Logback, ELK Stack
- 추적: (Stage 2에서 추가 예정)

**컨테이너 & 클라우드**
- 컨테이너: Docker
- 오케스트레이션: Kubernetes (Phase 2)

**한국 시장**
- 인증: Kakao OAuth 2.0
- 결제: Toss Payments
- 규정 준수: PIPA (개인정보 보호법)

## 프로젝트 구조

```
sagaline/
├── src/
│   ├── main/
│   │   ├── java/com/sagaline/
│   │   │   ├── user/              # 사용자 도메인
│   │   │   ├── product/           # 상품 카탈로그
│   │   │   ├── order/             # 주문 관리
│   │   │   ├── payment/           # 결제 처리
│   │   │   ├── inventory/         # 재고 관리
│   │   │   └── common/            # 공통 컴포넌트
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/      # Flyway 마이그레이션
│   └── test/
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml     # 개발 인프라
│   ├── kubernetes/                # K8s 매니페스트 (Phase 2)
│   └── monitoring/
│       ├── prometheus/
│       └── grafana/
├── docs/
│   ├── api/                       # OpenAPI 스펙
│   ├── architecture/              # 아키텍처 문서
│   └── evidence/                  # 단계 완료 증거
├── .meta/
│   └── state.yml                  # 프로젝트 진행 추적
└── pom.xml
```

## 빠른 시작

### 필수 요구사항

- Java 17 이상
- Maven 3.9+
- Docker 및 Docker Compose

### 1. 인프라 시작

```bash
cd infrastructure/docker
docker-compose up -d
```

다음이 시작됩니다:
- PostgreSQL (포트 5432)
- Redis (포트 6379)
- Elasticsearch (포트 9200)
- Kafka + Zookeeper (포트 9092)
- Prometheus (포트 9090)
- Grafana (포트 3000)

서비스 실행 확인:
```bash
docker-compose ps
```

### 2. 애플리케이션 빌드 및 실행

```bash
# 빌드
mvn clean install

# 실행
mvn spring-boot:run
```

애플리케이션이 http://localhost:8080에서 시작됩니다

### 3. 애플리케이션 확인

```bash
# 헬스 체크
curl http://localhost:8080/api/health

# 예상 응답:
# {
#   "status": "UP",
#   "timestamp": "2025-11-15T13:49:03",
#   "service": "sagaline",
#   "version": "0.1.0"
# }

# Actuator 헬스
curl http://localhost:8080/actuator/health

# Prometheus 메트릭
curl http://localhost:8080/actuator/prometheus
```

### 4. 모니터링 접근

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Elasticsearch**: http://localhost:9200

## 개발

### 테스트 실행

```bash
# 모든 테스트 실행
mvn test

# 커버리지와 함께 실행
mvn clean verify

# 커버리지 리포트 보기
open target/site/jacoco/index.html
```

### 코드 커버리지 목표

- 최소: 80% 라인 커버리지 (Jacoco로 강제됨)
- 커버리지가 임계값 아래로 떨어지면 빌드 실패

### 데이터베이스 마이그레이션

데이터베이스 버전 관리를 위해 Flyway 사용:

```bash
# 마이그레이션 위치: src/main/resources/db/migration/
# 형식: V{version}__{description}.sql
# 예시: V1__create_users_table.sql

# 마이그레이션은 애플리케이션 시작 시 자동 실행
```

### 프로파일

- **dev**: 개발 (기본값)
  - SQL 로깅 활성화
  - 상세한 에러 메시지
  - DevTools 활성화

- **prod**: 프로덕션
  - 최적화된 로깅
  - 보안 강화
  - 성능 튜닝

- **test**: 테스트
  - 인메모리 또는 테스트 데이터베이스
  - 외부 서비스 Mock

```bash
# 특정 프로파일로 실행
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

## API 문서

OpenAPI 3.0 명세를 사용한 API 문서:
- 위치: `docs/api/openapi.yaml`
- (Stage 1에서 추가 예정)

## 아키텍처

### Phase 1: 모놀리스 (현재)

도메인 주도 설계를 사용한 단일 Spring Boot 애플리케이션:
- 도메인별 별도 패키지 (user, product, order, payment, inventory)
- 별도 스키마를 가진 공유 PostgreSQL 데이터베이스
- JWT 인증을 사용한 REST API

### Phase 2: 마이크로서비스 (미래)

독립적인 서비스로 분해:
- user-service, product-service, order-service, payment-service, inventory-service
- 서비스 디스커버리 및 API Gateway
- Kafka를 통한 이벤트 주도 통신

## 주요 성능 지표 (KPI)

모든 KPI는 달성되어야 합니다:

- API 지연 p99 ≤ 100ms (단순 쿼리)
- API 지연 p99 ≤ 200ms (복잡한 쿼리)
- 시스템 가용성 ≥ 99.9% (30일 기간)
- 에러율 ≤ 1% (4xx 제외)
- 테스트 커버리지 ≥ 80%
- 보안: 치명적/높은 취약점 없음

## 보안

- **인증**: JWT + OAuth 2.0 (Kakao)
- **인가**: 역할 기반 접근 제어 (RBAC)
- **데이터 보호**: 저장 시 PII 암호화 (AES-256)
- **전송**: TLS 1.3
- **규정 준수**: PIPA (한국 데이터 보호법)

## 현재 단계 진행

- [x] Bootstrap 완료
- [ ] Stage 1: 모놀리스 기반 (4주)
- [ ] Stage 2: 관측성 (3주)
- [ ] Stage 3: 규모 확장 (6주)
- [ ] Stage 4: 안정성 (4주)
- [ ] Stage 5: 마이크로서비스 (7주)

**Phase 1 목표**: 24주
**Phase 2 목표**: +12주 (총 36주)

## 기여

이것은 CLAUDE.md의 명세를 따르는 포트폴리오/학습 프로젝트입니다.

### 커밋 규칙

```
<type>: <subject>

<body>

<footer>
```

타입: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

예시:
```
feat: 사용자 등록 엔드포인트 추가

이메일 검증 및 BCrypt를 사용한 비밀번호 해싱을 포함한
POST /api/users/register 구현.

Closes #1
```

## 라이선스

이것은 학습/포트폴리오 프로젝트입니다.

## 연락처

- 프로젝트: Sagaline 전자상거래 플랫폼
- 목적: 백엔드 엔지니어 포트폴리오 (한국)
- 스택: Spring Boot 3.x + PostgreSQL + Redis + Kafka
