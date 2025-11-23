# Sagaline Architecture Overview

**Last Updated**: 2025-11-15
**Current Stage**: Bootstrap Complete
**Version**: 0.1.0

## Executive Summary

Sagaline is a production-quality e-commerce platform designed for the Korean market, evolving from a monolith to cloud-native microservices architecture over 36 weeks across 9 stages.

## Current Architecture

### Status: Bootstrap Phase

The project has been initialized with foundational infrastructure but no business logic has been implemented yet.

**Components**:
- Spring Boot 3.2.0 application shell
- PostgreSQL 15+ database (not yet connected)
- Redis 7+ cache (planned)
- Elasticsearch 8.x with Nori tokenizer (planned)
- Kafka 3.x message queue (planned)
- Prometheus + Grafana monitoring (configured)

**Architecture Pattern**: Not yet implemented

## Planned Evolution

Sagaline will evolve through 9 stages, divided into 2 phases:

### Phase 1: Core Platform (24 weeks)

#### Stage 1: Monolith Foundation (4 weeks)
**Target**: Working end-to-end e-commerce system

**Architecture**:
- Single Spring Boot application
- Single PostgreSQL database with domain schemas
- REST API with JWT authentication
- Layered architecture (API → Service → Repository)

**Domains**:
- User Management
- Product Catalog
- Shopping Cart
- Order Management
- Payment Processing (Toss Payments)
- Inventory Management

**Key Patterns**:
- Domain-Driven Design (DDD)
- Repository pattern
- Service layer pattern
- DTO pattern

#### Stage 2: Observability (3 weeks)
**Goal**: Production-grade monitoring and logging

**Additions**:
- Structured logging with correlation IDs
- Distributed tracing (Zipkin/Jaeger)
- Prometheus metrics collection
- Grafana dashboards (8+ panels)
- ELK Stack for log aggregation
- Alerting rules

**Metrics**:
- Business: registrations, orders, revenue
- Technical: latency, throughput, error rates
- Infrastructure: CPU, memory, DB connections

#### Stage 3: Scale (6 weeks)
**Goal**: Handle increased load efficiently

**Stage 3.1: Search** (2 weeks)
- Elasticsearch integration
- Korean text search (Nori tokenizer)
- Faceted search
- Autocomplete

**Stage 3.2: Caching** (2 weeks)
- Redis cache layer
- Cache-aside pattern
- TTL and event-based invalidation
- Session management
- Rate limiting

**Stage 3.3: Async Processing** (2 weeks)
- Kafka event streaming
- Event-driven architecture
- Asynchronous notifications
- Analytics pipeline

**Pattern**: CQRS (Command Query Responsibility Segregation) preparation

#### Stage 4: Reliability (4 weeks)
**Goal**: Production-grade security and resilience

**Stage 4.1: Security** (2 weeks)
- Kakao OAuth 2.0
- JWT token management
- PII encryption (AES-256)
- PIPA compliance
- Security hardening

**Stage 4.2: Resilience** (2 weeks)
- Circuit breaker pattern
- Retry with exponential backoff
- Bulkhead pattern
- Graceful degradation
- Health checks

#### Stage 5: Microservices Decomposition (7 weeks)
**Goal**: Independent, scalable services

**Services**:
1. user-service
2. product-service
3. order-service
4. payment-service
5. inventory-service

**Architecture**:
- API Gateway (Spring Cloud Gateway)
- Service discovery (Eureka/Consul)
- Database per service
- Inter-service communication (REST + Events)
- Saga pattern for distributed transactions

### Phase 2: Cloud-Native (12 weeks)

#### Stage 6: Containerization (3 weeks)
- Docker multi-stage builds
- Docker Compose for local dev
- Image optimization (<150MB)
- Security scanning (Trivy)

#### Stage 7: Kubernetes Basics (4 weeks)
- K8s deployments and services
- ConfigMaps and Secrets
- HorizontalPodAutoscaler
- Ingress controller
- Self-healing

#### Stage 8: Real-Time Notifications (3 weeks)
- WebSocket server
- Server-Sent Events (SSE)
- Reactive programming (Spring WebFlux)
- Redis Pub/Sub for scaling

#### Stage 9: Multi-Region (3 weeks)
- PostgreSQL streaming replication
- Read-write splitting
- Cross-region deployment
- Disaster recovery

## Technology Stack

### Backend
- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Build**: Maven 3.9+

### Data Layer
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Search**: Elasticsearch 8.x
- **Migration**: Flyway

### Messaging
- **Message Queue**: Apache Kafka 3.x
- **Protocol**: CloudEvents (planned)

### Observability
- **Metrics**: Prometheus, Micrometer
- **Visualization**: Grafana
- **Logging**: Logback, ELK Stack
- **Tracing**: Zipkin/Jaeger (planned)

### Security
- **Authentication**: JWT, OAuth 2.0 (Kakao)
- **Authorization**: Spring Security
- **Encryption**: AES-256 for PII

### Cloud & DevOps
- **Container**: Docker
- **Orchestration**: Kubernetes (Phase 2)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

### Korean Market Integration
- **Payment**: Toss Payments
- **Auth**: Kakao OAuth
- **Search**: Elasticsearch with Nori (Korean tokenizer)
- **Compliance**: PIPA (Personal Information Protection Act)

## Design Principles

### Clean Architecture
```
┌─────────────────────────────────────┐
│         API Layer (REST)            │
│  Controllers, DTOs, Request/Response│
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │
│  Business Logic, Use Cases          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Domain Layer                │
│  Entities, Value Objects, Aggregates│
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Infrastructure Layer           │
│  Repositories, External Services    │
└─────────────────────────────────────┘
```

### SOLID Principles
- **S**ingle Responsibility
- **O**pen/Closed
- **L**iskov Substitution
- **I**nterface Segregation
- **D**ependency Inversion

### 12-Factor App Methodology
- Codebase: Single repo, multiple deployments
- Dependencies: Explicitly declared (pom.xml)
- Config: Environment variables
- Backing services: Treated as attached resources
- Build, release, run: Strict separation
- Processes: Stateless
- Port binding: Self-contained
- Concurrency: Scale out via process model
- Disposability: Fast startup, graceful shutdown
- Dev/prod parity: Keep environments similar
- Logs: Treat as event streams
- Admin processes: Run as one-off processes

## Data Model (Planned)

### Phase 1 - Monolith
Single PostgreSQL database with separate schemas:
- `user_schema`: users, roles, permissions
- `product_schema`: products, categories
- `order_schema`: orders, order_items
- `payment_schema`: transactions, payment_methods
- `inventory_schema`: stock, reservations

### Phase 2 - Microservices
Separate databases per service:
- user-db
- product-db
- order-db
- payment-db
- inventory-db

**Data Consistency**: Saga pattern with event sourcing

## API Design

### RESTful Principles
- Resource-based URLs
- HTTP verbs (GET, POST, PUT, PATCH, DELETE)
- Stateless communication
- HATEOAS (Level 3 Richardson Maturity Model)

### Versioning
- URL versioning: `/api/v1/users`
- Header versioning (future): `Accept: application/vnd.sagaline.v1+json`

### Pagination
```
GET /api/products?page=0&size=20&sort=createdAt,desc
```

### Error Handling
Consistent error response format:
```json
{
  "code": "INVALID_REQUEST",
  "message": "User validation failed",
  "timestamp": "2025-11-15T13:49:03Z",
  "path": "/api/users/register"
}
```

## Security Architecture

### Authentication Flow
1. User registers/logs in
2. Server issues JWT access token (15 min) + refresh token (7 days)
3. Client includes token in Authorization header
4. Server validates token on each request

### OAuth 2.0 (Kakao)
1. User clicks "Login with Kakao"
2. Redirect to Kakao authorization
3. User approves
4. Kakao redirects with code
5. Backend exchanges code for token
6. Create user session with JWT

### Data Protection
- PII encrypted at rest (AES-256)
- TLS 1.3 in transit
- Password hashing (BCrypt)
- SQL injection prevention (JPA parameterized queries)
- XSS protection (input sanitization)
- CSRF tokens

## Performance Targets

### Key Performance Indicators (KPIs)

**ALL must be achieved**:
- API latency p99 ≤ 100ms (simple queries)
- API latency p99 ≤ 200ms (complex queries)
- System availability ≥ 99.9% (30-day period)
- Error rate ≤ 1% (excluding 4xx)
- Test coverage ≥ 80%
- Security: No critical/high vulnerabilities

### Scalability Targets
- **Stage 1-4**: 100 concurrent users
- **Stage 5**: 1,000 concurrent users
- **Stage 6-7**: 10,000 concurrent users
- **Stage 8-9**: 100,000 concurrent users

## Deployment Strategy

### Stage 1-4: Single Server
- Docker container
- Reverse proxy (Nginx)
- Single region (Seoul)

### Stage 5: Multi-Service
- Docker Compose orchestration
- API Gateway routing
- Service mesh preparation

### Stage 6-9: Kubernetes
- Multi-region deployment
- Auto-scaling (HPA)
- Blue-green deployments
- Canary releases

## Monitoring & Observability

### Metrics Collection
- Application metrics (Micrometer)
- Business metrics (custom)
- Infrastructure metrics (node exporters)

### Dashboards
- System overview
- Business KPIs
- Service health
- Error tracking

### Alerting
- Error rate > 1% for 5 minutes
- P99 latency > 200ms for 5 minutes
- Database connection pool > 80%
- Disk usage > 85%

## Disaster Recovery

### Backup Strategy
- Database: Daily full backup + continuous WAL archiving
- Configuration: Version controlled in Git
- State: Stored in external systems (S3/Cloud Storage)

### Recovery Objectives
- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 15 minutes

### Multi-Region (Stage 9)
- Primary: Seoul
- Replica: Tokyo
- Failover: Manual → Automatic (future)

## Future Roadmap (Post-Stage 9)

**Potential additions**:
- GraphQL API
- Mobile app (iOS/Android)
- Admin dashboard (React/Vue)
- Machine learning (recommendation engine)
- Analytics platform
- Global CDN
- Service mesh (Istio)
- Chaos engineering

## References

- [CLAUDE.md](../../CLAUDE.md) - Complete project specification
- [OpenAPI Specification](../api/openapi.yaml) - API contract
- [Evidence](../evidence/) - Stage completion evidence

---

**Note**: This document will be updated as the project progresses through each stage. Architecture diagrams will be added as we implement each stage.
