# Sagaline - E-commerce Platform

Production-quality e-commerce backend for Korean market, evolving from monolith to cloud-native microservices.

## Status

- **Stage**: Bootstrap complete
- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Version**: 0.1.0

## CI/CD

Automated quality checks on every push:
- ✅ Build & Compilation
- ✅ Unit & Integration Tests
- ✅ Code Coverage (≥80%)
- ✅ Security Scanning (Trivy)
- ✅ Binary Files Check
- ✅ OpenAPI Validation

See [CI/CD Setup](docs/CI-CD-SETUP.md) for details.

## Project Overview

Sagaline is a comprehensive e-commerce platform designed for the Korean market with full integration of local payment systems (Toss Payments), authentication (Kakao OAuth), and compliance (PIPA).

### Three Career Checkpoints

- **Checkpoint: Core** (Stage 1-4, 18 weeks) → Entry-level Backend Engineer
- **Checkpoint: Scale** (+ Stage 5, 25 weeks) → Mid-level Backend Engineer
- **Checkpoint: Cloud** (+ Stage 6-9, 36 weeks) → Senior Backend Engineer

## Tech Stack

**Core**
- Framework: Spring Boot 3.2.0
- Language: Java 17
- Build Tool: Maven 3.9+
- Database: PostgreSQL 15+
- Cache: Redis 7+

**Search & Messaging**
- Search: Elasticsearch 8.x with Nori tokenizer (Korean)
- Message Queue: Apache Kafka 3.x

**Monitoring & Observability**
- Metrics: Prometheus, Micrometer
- Visualization: Grafana
- Logging: Logback, ELK Stack
- Tracing: (To be added in Stage 2)

**Container & Cloud**
- Container: Docker
- Orchestration: Kubernetes (Phase 2)

**Korean Market**
- Authentication: Kakao OAuth 2.0
- Payment: Toss Payments
- Compliance: PIPA (Personal Information Protection Act)

## Project Structure

```
sagaline/
├── src/
│   ├── main/
│   │   ├── java/com/sagaline/
│   │   │   ├── user/              # User domain
│   │   │   ├── product/           # Product catalog
│   │   │   ├── order/             # Order management
│   │   │   ├── payment/           # Payment processing
│   │   │   ├── inventory/         # Inventory management
│   │   │   └── common/            # Shared components
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/      # Flyway migrations
│   └── test/
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml     # Dev infrastructure
│   ├── kubernetes/                # K8s manifests (Phase 2)
│   └── monitoring/
│       ├── prometheus/
│       └── grafana/
├── docs/
│   ├── api/                       # OpenAPI specs
│   ├── architecture/              # Architecture docs
│   └── evidence/                  # Stage completion evidence
├── .meta/
│   └── state.yml                  # Project progress tracking
└── pom.xml
```

## Quick Start

### Prerequisites

- Java 17 or higher
- Maven 3.9+
- Docker and Docker Compose

### 1. Start Infrastructure

```bash
cd infrastructure/docker
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Elasticsearch (port 9200)
- Kafka + Zookeeper (port 9092)
- Prometheus (port 9090)
- Grafana (port 3000)

Verify services are running:
```bash
docker-compose ps
```

### 2. Build and Run Application

```bash
# Build
mvn clean install

# Run
mvn spring-boot:run
```

The application will start on http://localhost:8080

### 3. Verify Application

```bash
# Health check
curl http://localhost:8080/api/health

# Expected response:
# {
#   "status": "UP",
#   "timestamp": "2025-11-15T13:49:03",
#   "service": "sagaline",
#   "version": "0.1.0"
# }

# Actuator health
curl http://localhost:8080/actuator/health

# Prometheus metrics
curl http://localhost:8080/actuator/prometheus
```

### 4. Access Monitoring

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Elasticsearch**: http://localhost:9200

## Development

### Running Tests

```bash
# Run all tests
mvn test

# Run with coverage
mvn clean verify

# View coverage report
open target/site/jacoco/index.html
```

### Code Coverage Target

- Minimum: 80% line coverage (enforced by Jacoco)
- Builds will fail if coverage drops below threshold

### Database Migrations

Using Flyway for database version control:

```bash
# Migrations are in: src/main/resources/db/migration/
# Format: V{version}__{description}.sql
# Example: V1__create_users_table.sql

# Migrations run automatically on application startup
```

### Profiles

- **dev**: Development (default)
  - SQL logging enabled
  - Detailed error messages
  - DevTools enabled

- **prod**: Production
  - Optimized logging
  - Security hardened
  - Performance tuned

- **test**: Testing
  - In-memory or test database
  - Mock external services

```bash
# Run with specific profile
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

## API Documentation

API documentation will be available using OpenAPI 3.0 specification:
- Location: `docs/api/openapi.yaml`
- (To be added in Stage 1)

## Architecture

### Phase 1: Monolith (Current)

Single Spring Boot application with domain-driven design:
- Separate packages per domain (user, product, order, payment, inventory)
- Shared PostgreSQL database with separate schemas
- REST API with JWT authentication

### Phase 2: Microservices (Future)

Decomposition into independent services:
- user-service, product-service, order-service, payment-service, inventory-service
- Service discovery and API Gateway
- Event-driven communication via Kafka

## Key Performance Indicators (KPIs)

All KPIs must be achieved:

- API latency p99 ≤ 100ms (simple queries)
- API latency p99 ≤ 200ms (complex queries)
- System availability ≥ 99.9% (30-day period)
- Error rate ≤ 1% (excluding 4xx)
- Test coverage ≥ 80%
- Security: No critical/high vulnerabilities

## Security

- **Authentication**: JWT + OAuth 2.0 (Kakao)
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: PII encryption at rest (AES-256)
- **Transport**: TLS 1.3
- **Compliance**: PIPA (Korean data protection law)

## Current Stage Progress

- [x] Bootstrap complete
- [ ] Stage 1: Monolith Foundation (4 weeks)
- [ ] Stage 2: Observability (3 weeks)
- [ ] Stage 3: Scale (6 weeks)
- [ ] Stage 4: Reliability (4 weeks)
- [ ] Stage 5: Microservices (7 weeks)

**Phase 1 Target**: 24 weeks
**Phase 2 Target**: +12 weeks (36 total)

## Contributing

This is a portfolio/learning project following the specifications in CLAUDE.md.

### Commit Convention

```
<type>: <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

Example:
```
feat: add user registration endpoint

Implement POST /api/users/register with email validation
and password hashing using BCrypt.

Closes #1
```

## License

This is a learning/portfolio project.

## Contact

- Project: Sagaline E-commerce Platform
- Purpose: Backend Engineer Portfolio (Korea)
- Stack: Spring Boot 3.x + PostgreSQL + Redis + Kafka
