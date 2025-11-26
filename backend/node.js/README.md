# Web Phase 1.5 - Node.js Pattern Training

This project implements Web Phase 1.5 milestones (N2.0-N2.6) for Node.js backend pattern training using NestJS.

## Current Status

**All Milestones Completed (N2.0 - N2.6)** ✅

**Milestone N2.0** - NestJS Bootstrap & CI Baseline ✅
- ✅ NestJS application setup
- ✅ Environment configuration
- ✅ Health check endpoint
- ✅ Basic e2e tests
- ✅ GitHub Actions CI pipeline

**Milestone N2.1** - Layered CRUD & Transaction Pattern ✅
- ✅ Issue tracker domain (User, Project, Issue, Comment)
- ✅ Controller/Service/Repository pattern with Prisma
- ✅ JWT authentication
- ✅ DTO validation with class-validator
- ✅ Transaction support

**Milestone N2.2** - Team & Role-Based Access Control ✅
- ✅ Team and TeamMember models
- ✅ RBAC with custom guards and decorators
- ✅ 401/403/404 status code handling
- ✅ Authorization tests

**Milestone N2.3** - Batch Jobs, Stats, Cache, External API ✅
- ✅ Daily statistics batch job (using @nestjs/schedule)
- ✅ Statistics API endpoints
- ✅ In-memory caching with @nestjs/cache-manager
- ✅ External API integration with retry logic

**Milestone N2.4** - Elasticsearch Search ✅
- ✅ Product catalog domain
- ✅ Elasticsearch integration
- ✅ Full-text search API
- ✅ Product sync with Elasticsearch

**Milestone N2.5** - Kafka Asynchronous Event Processing ✅
- ✅ Order and Notification domains
- ✅ Kafka producer for order events
- ✅ Kafka consumer for notifications
- ✅ Event-driven architecture
- ✅ Docker Compose setup for local development

**Milestone N2.6** - Production Ready (DB, Cache, Deployable) ✅
- ✅ SQLite-first schema for fast local/test runs (PostgreSQL optional via Docker)
- ✅ Redis-backed global caching for popular issues and external API results
- ✅ Dockerfile and expanded Docker Compose with Postgres, Redis, and app service
- ✅ Environment profiles for local/test/prod

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: NestJS 10.x
- **Database**: SQLite (default dev/test) or PostgreSQL via Docker Compose
- **ORM**: Prisma
- **Search**: Elasticsearch 8.x
- **Message Queue**: Kafka (via KafkaJS)
- **Authentication**: JWT (Passport)
- **Caching**: In-memory cache (@nestjs/cache-manager)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest, Supertest
- **Package Manager**: npm

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm
- Docker (for Postgres/Redis/Kafka/Elasticsearch services)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client (SQLite by default)
npm run prisma:generate

# Optional: start external infrastructure (Postgres + Redis). Add kafka/elasticsearch as needed
docker compose up -d db redis
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will be available at `http://localhost:3000`

#### Running with Docker Compose

```bash
# Build and start the core stack (app + Postgres + Redis)
docker compose up --build app db redis

# Optionally include Kafka/Elasticsearch by adding services
docker compose up --build app db redis kafka zookeeper kafka-ui elasticsearch
```

### API Endpoints

#### Health & Authentication
- `GET /api/health` - Health check endpoint
- `POST /api/users` - User registration
- `POST /api/auth/login` - User login (returns JWT)

#### Issue Tracker (N2.1)
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `POST /api/projects/:id/issues` - Create issue
- `GET /api/projects/:id/issues` - List issues
- `GET /api/issues/:id` - Get issue details
- `PUT /api/issues/:id` - Update issue
- `DELETE /api/issues/:id` - Delete issue
- `POST /api/issues/:id/comments` - Add comment
- `GET /api/issues/:id/comments` - List comments

#### Teams & RBAC (N2.2)
- `POST /api/teams` - Create team
- `GET /api/teams` - List user's teams
- `GET /api/teams/:id` - Get team details
- `POST /api/teams/:id/members` - Add team member
- `GET /api/teams/:id/members` - List team members
- `PATCH /api/teams/:id/members/:memberId` - Update member role
- `DELETE /api/teams/:id/members/:memberId` - Remove member
- `POST /api/teams/:teamId/items` - Create workspace item
- `GET /api/teams/:teamId/items` - List workspace items

#### Statistics (N2.3)
- `GET /api/stats/daily` - Get daily issue statistics
- `GET /api/issues/popular` - Get popular issues (cached)
- `GET /api/external/posts/:id` - External API example

#### Products & Search (N2.4)
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/search/products` - Search products (Elasticsearch)
- `POST /api/admin/reindex/products` - Reindex all products

#### Orders & Notifications (N2.5)
- `POST /api/orders` - Create order
- `GET /api/orders` - List user's orders
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id/pay` - Mark order as paid
- `PATCH /api/orders/:id/cancel` - Cancel order
- `GET /api/notifications` - List user's notifications

### Testing

e2e runs default to SQLite, so Docker services are optional. Start Postgres/Redis first (e.g., `docker compose up -d db redis`) only if you want to test external services.

```bash
# Unit tests
npm test

# e2e tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
# Application
PORT=3000
NODE_ENV=development

# Database (SQLite by default)
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=1d

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_ENABLED=false  # Set to true to enable Elasticsearch

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=web-phase1-5-node
KAFKA_GROUP_ID=notification-consumer-group
KAFKA_ENABLED=true  # Set to false to disable Kafka

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Project Structure

```
web-phase1-5-node/
  ├── prisma/
  │   ├── schema.prisma              # Database schema
  │   └── migrations/                # Database migrations
  ├── src/
  │   ├── common/
  │   │   ├── health/                # Health check module
  │   │   ├── prisma/                # Prisma service
  │   │   └── filters/               # Exception filters
  │   ├── auth/                      # Authentication (N2.1)
  │   ├── user/                      # User management (N2.1)
  │   ├── project/                   # Project module (N2.1)
  │   ├── issue/                     # Issue tracker (N2.1)
  │   ├── comment/                   # Comments (N2.1)
  │   ├── team/                      # Team & RBAC (N2.2)
  │   ├── stats/                     # Statistics & batch jobs (N2.3)
  │   ├── external/                  # External API integration (N2.3)
  │   ├── elasticsearch/             # Elasticsearch client (N2.4)
  │   ├── product/                   # Product catalog (N2.4)
  │   ├── search/                    # Search API (N2.4)
  │   ├── admin/                     # Admin endpoints (N2.4)
  │   ├── kafka/                     # Kafka producer service (N2.5)
  │   ├── order/                     # Order management (N2.5)
  │   ├── notification/              # Notification consumer (N2.5)
  │   ├── app.module.ts              # Root module
  │   └── main.ts                    # Application entry point
  ├── test/
  │   ├── app.e2e-spec.ts            # Basic e2e tests
  │   ├── issue.e2e-spec.ts          # Issue tracker e2e tests
  │   ├── team.e2e-spec.ts           # Team & RBAC e2e tests
  │   ├── stats.e2e-spec.ts          # Stats e2e tests
  │   ├── product/                   # Product e2e tests
  │   ├── order.e2e-spec.ts          # Order e2e tests (N2.5)
  │   └── utils/                     # Test utilities
  ├── docker-compose.yml             # Kafka & Elasticsearch setup
  └── .github/
      └── workflows/
          └── ci.yml                 # CI pipeline
```

## CI/CD

GitHub Actions workflow runs on:
- Push to `main`, `develop`, `feature/**` branches
- Pull requests to `main`, `develop`

The pipeline:
1. Checks out code
2. Sets up Node.js 20
3. Installs dependencies
4. Generates Prisma client
5. Runs unit tests
6. Runs e2e tests
7. Builds the application

## License

MIT
