# T05: 고급 백엔드 패턴

**난이도**: 🔴 고급
**예상 소요 시간**: 20~25시간
**선수 과목**: T03 (NestJS 기초), T04 (DB + Redis + WebSocket)

---

## 개요

프로덕션 환경의 대규모 백엔드 시스템에서 사용되는 고급 패턴과 기술을 학습합니다. Elasticsearch, Kafka, RBAC, 서킷 브레이커, 레이트 리미팅, 마이크로서비스 아키텍처 등을 다룹니다.

**학습 목표**:
- Elasticsearch로 전문 검색 및 로그 분석 구현
- Kafka로 이벤트 기반 아키텍처 구축
- RBAC로 세밀한 권한 관리 시스템 설계
- 서킷 브레이커, 레이트 리미팅 등 안정성 패턴 적용
- API Gateway 및 마이크로서비스 패턴 이해

**프로젝트 연관성**:
- **backend/node.js**: N2.3 (Elasticsearch 검색), N2.4 (Kafka 이벤트), N2.5 (RBAC)
- **e-commerce**: 상품 검색, 주문 이벤트 처리, 권한 관리

---

## 1. Elasticsearch 전문 검색

### 1.1 Elasticsearch 기초

Elasticsearch는 분산형 RESTful 검색 엔진으로, 실시간 전문 검색 및 분석에 사용됩니다.

**핵심 개념**:
- **Index**: 데이터베이스의 "테이블"에 해당
- **Document**: 데이터의 최소 단위 (JSON 형식)
- **Mapping**: 스키마 정의
- **Analyzer**: 텍스트 분석기 (토큰화, 정규화)

**Docker로 Elasticsearch 실행**:

```bash
# docker-compose.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - es_data:/usr/share/elasticsearch/data

volumes:
  es_data:
```

### 1.2 NestJS Elasticsearch 통합

```bash
npm install @nestjs/elasticsearch @elastic/elasticsearch
```

```typescript
// src/config/elasticsearch.config.ts
import { ConfigService } from '@nestjs/config';
import { ElasticsearchModuleOptions } from '@nestjs/elasticsearch';

export const getElasticsearchConfig = (
  configService: ConfigService
): ElasticsearchModuleOptions => ({
  node: configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200'),
  maxRetries: 10,
  requestTimeout: 60000,
  sniffOnStart: true,
});
```

```typescript
// src/search/search.module.ts
import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getElasticsearchConfig } from '../config/elasticsearch.config';
import { SearchService } from './search.service';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getElasticsearchConfig,
      inject: [ConfigService],
    }),
  ],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
```

### 1.3 인덱스 생성 및 매핑

```typescript
// src/search/search.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

export interface ProductDocument {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  tags: string[];
  createdAt: Date;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly indexName = 'products';

  constructor(private readonly esService: ElasticsearchService) {}

  async onModuleInit() {
    await this.createIndex();
  }

  async createIndex() {
    const indexExists = await this.esService.indices.exists({
      index: this.indexName,
    });

    if (!indexExists) {
      await this.esService.indices.create({
        index: this.indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            analysis: {
              analyzer: {
                korean_analyzer: {
                  type: 'custom',
                  tokenizer: 'nori_tokenizer',
                  filter: ['lowercase', 'nori_readingform'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'integer' },
              name: {
                type: 'text',
                analyzer: 'korean_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: {
                type: 'text',
                analyzer: 'korean_analyzer',
              },
              category: { type: 'keyword' },
              price: { type: 'float' },
              tags: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
    }
  }

  async indexProduct(product: ProductDocument) {
    return await this.esService.index({
      index: this.indexName,
      id: product.id.toString(),
      document: product,
    });
  }

  async bulkIndexProducts(products: ProductDocument[]) {
    const body = products.flatMap(doc => [
      { index: { _index: this.indexName, _id: doc.id.toString() } },
      doc,
    ]);

    return await this.esService.bulk({ refresh: true, body });
  }

  async deleteProduct(id: number) {
    return await this.esService.delete({
      index: this.indexName,
      id: id.toString(),
    });
  }
}
```

### 1.4 전문 검색 쿼리

```typescript
// src/search/dto/search-product.dto.ts
export class SearchProductDto {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'price' | 'date';
  sortOrder?: 'asc' | 'desc';
}

// src/search/search.service.ts (계속)
export interface SearchResult<T> {
  total: number;
  hits: T[];
  aggregations?: Record<string, any>;
}

async searchProducts(
  dto: SearchProductDto
): Promise<SearchResult<ProductDocument>> {
  const {
    query,
    category,
    minPrice,
    maxPrice,
    tags,
    page = 1,
    limit = 20,
    sortBy = 'relevance',
    sortOrder = 'desc',
  } = dto;

  const must: any[] = [];
  const filter: any[] = [];

  // 전문 검색 쿼리
  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['name^3', 'description'], // name에 3배 가중치
        type: 'best_fields',
        fuzziness: 'AUTO', // 오타 허용
      },
    });
  }

  // 필터 조건
  if (category) {
    filter.push({ term: { category } });
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.push({
      range: {
        price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      },
    });
  }

  if (tags && tags.length > 0) {
    filter.push({ terms: { tags } });
  }

  // 정렬
  const sort: any[] = [];
  if (sortBy === 'price') {
    sort.push({ price: { order: sortOrder } });
  } else if (sortBy === 'date') {
    sort.push({ createdAt: { order: sortOrder } });
  } else {
    sort.push('_score'); // 관련성 순
  }

  const response = await this.esService.search({
    index: this.indexName,
    body: {
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort,
      from: (page - 1) * limit,
      size: limit,
      highlight: {
        fields: {
          name: {},
          description: {},
        },
      },
      aggs: {
        categories: {
          terms: { field: 'category', size: 10 },
        },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { to: 10000 },
              { from: 10000, to: 50000 },
              { from: 50000, to: 100000 },
              { from: 100000 },
            ],
          },
        },
      },
    },
  });

  return {
    total: response.hits.total.value,
    hits: response.hits.hits.map((hit: any) => ({
      ...hit._source,
      _highlight: hit.highlight,
    })),
    aggregations: response.aggregations,
  };
}

// 자동완성 제안
async suggest(prefix: string) {
  const response = await this.esService.search({
    index: this.indexName,
    body: {
      suggest: {
        product_suggest: {
          prefix,
          completion: {
            field: 'name.suggest',
            skip_duplicates: true,
            size: 10,
          },
        },
      },
    },
  });

  return response.suggest.product_suggest[0].options.map(
    (option: any) => option.text
  );
}
```

### 1.5 데이터 동기화

```typescript
// src/products/products.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService
  ) {}

  async createProduct(data: CreateProductDto) {
    const product = await this.prisma.product.create({ data });

    // Elasticsearch에 동기화
    await this.searchService.indexProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      tags: product.tags,
      createdAt: product.createdAt,
    });

    return product;
  }

  async updateProduct(id: number, data: UpdateProductDto) {
    const product = await this.prisma.product.update({ where: { id }, data });

    // Elasticsearch 업데이트
    await this.searchService.indexProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      tags: product.tags,
      createdAt: product.createdAt,
    });

    return product;
  }

  async deleteProduct(id: number) {
    await this.prisma.product.delete({ where: { id } });
    await this.searchService.deleteProduct(id);
  }

  // 전체 재색인 (초기 동기화)
  async reindexAll() {
    const products = await this.prisma.product.findMany();
    const documents = products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      tags: p.tags,
      createdAt: p.createdAt,
    }));

    await this.searchService.bulkIndexProducts(documents);
    return { indexed: documents.length };
  }
}
```

---

## 2. Kafka 이벤트 기반 아키텍처

### 2.1 Kafka 기초

**핵심 개념**:
- **Topic**: 메시지 카테고리 (이벤트 스트림)
- **Partition**: Topic의 병렬 처리 단위
- **Producer**: 메시지 발행자
- **Consumer**: 메시지 구독자
- **Consumer Group**: 병렬 처리를 위한 소비자 그룹

**Docker로 Kafka 실행**:

```yaml
# docker-compose.yml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
```

### 2.2 NestJS Kafka 통합

```bash
npm install @nestjs/microservices kafkajs
```

```typescript
// src/config/kafka.config.ts
import { KafkaOptions, Transport } from '@nestjs/microservices';

export const kafkaConfig: KafkaOptions = {
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: 'backend-service',
      brokers: ['localhost:9092'],
    },
    consumer: {
      groupId: 'backend-consumer-group',
    },
  },
};
```

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { kafkaConfig } from './config/kafka.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kafka 마이크로서비스 연결
  app.connectMicroservice(kafkaConfig);

  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
```

### 2.3 이벤트 발행 (Producer)

```typescript
// src/events/events.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, Client } from '@nestjs/microservices';
import { kafkaConfig } from '../config/kafka.config';

export interface OrderCreatedEvent {
  orderId: number;
  userId: number;
  totalAmount: number;
  items: Array<{ productId: number; quantity: number }>;
  createdAt: Date;
}

@Injectable()
export class EventsService implements OnModuleInit {
  @Client(kafkaConfig)
  private readonly kafkaClient: ClientKafka;

  async onModuleInit() {
    // 필요한 토픽 구독 (응답 대기용)
    this.kafkaClient.subscribeToResponseOf('order.created');
    await this.kafkaClient.connect();
  }

  async publishOrderCreated(event: OrderCreatedEvent) {
    return this.kafkaClient.emit('order.created', {
      key: event.orderId.toString(),
      value: JSON.stringify(event),
      headers: {
        source: 'order-service',
        timestamp: new Date().toISOString(),
      },
    });
  }

  async publishOrderCancelled(orderId: number, reason: string) {
    return this.kafkaClient.emit('order.cancelled', {
      key: orderId.toString(),
      value: JSON.stringify({ orderId, reason, cancelledAt: new Date() }),
    });
  }

  async publishProductUpdated(productId: number, changes: any) {
    return this.kafkaClient.emit('product.updated', {
      key: productId.toString(),
      value: JSON.stringify({ productId, changes, updatedAt: new Date() }),
    });
  }
}
```

### 2.4 이벤트 소비 (Consumer)

```typescript
// src/events/events.controller.ts
import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { OrdersService } from '../orders/orders.service';
import { NotificationService } from '../notifications/notification.service';

@Controller()
export class EventsController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly notificationService: NotificationService
  ) {}

  @EventPattern('order.created')
  async handleOrderCreated(
    @Payload() data: any,
    @Ctx() context: KafkaContext
  ) {
    const event = JSON.parse(data.value);
    const { topic, partition, offset } = context.getMessage();

    console.log(`Processing order.created: ${event.orderId}`);
    console.log(`Topic: ${topic}, Partition: ${partition}, Offset: ${offset}`);

    try {
      // 재고 차감
      await this.ordersService.reserveStock(event.items);

      // 알림 발송
      await this.notificationService.sendOrderConfirmation(
        event.userId,
        event.orderId
      );

      // 수동 커밋 (기본적으로 자동 커밋됨)
      // await context.getConsumer().commitOffsets([
      //   { topic, partition, offset: (Number(offset) + 1).toString() }
      // ]);
    } catch (error) {
      console.error('Failed to process order.created:', error);
      // 에러 처리: DLQ(Dead Letter Queue)로 전송 또는 재시도
    }
  }

  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() data: any) {
    const event = JSON.parse(data.value);
    console.log(`Processing order.cancelled: ${event.orderId}`);

    // 재고 복구
    await this.ordersService.releaseStock(event.orderId);
  }

  @EventPattern('product.updated')
  async handleProductUpdated(@Payload() data: any) {
    const event = JSON.parse(data.value);
    console.log(`Processing product.updated: ${event.productId}`);

    // Elasticsearch 업데이트
    // 캐시 무효화
  }
}
```

### 2.5 Saga 패턴 (분산 트랜잭션)

```typescript
// src/orders/order-saga.service.ts
import { Injectable } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderSagaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService
  ) {}

  async createOrder(userId: number, items: any[]) {
    // 1. 주문 생성
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        items: {
          create: items,
        },
      },
      include: { items: true },
    });

    try {
      // 2. 재고 확인 및 예약 (동기 호출 또는 이벤트)
      await this.reserveInventory(items);

      // 3. 결제 처리 (동기 호출 또는 이벤트)
      await this.processPayment(order.id, order.totalAmount);

      // 4. 주문 확정
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'CONFIRMED' },
      });

      // 5. 주문 생성 이벤트 발행
      await this.eventsService.publishOrderCreated({
        orderId: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        createdAt: order.createdAt,
      });

      return order;
    } catch (error) {
      // Saga 보상 트랜잭션 (Rollback)
      await this.compensateOrder(order.id);
      throw error;
    }
  }

  private async reserveInventory(items: any[]) {
    // 재고 서비스 호출
    // 실패 시 에러 발생
  }

  private async processPayment(orderId: number, amount: number) {
    // 결제 서비스 호출
    // 실패 시 에러 발생
  }

  private async compensateOrder(orderId: number) {
    // 주문 취소
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    // 재고 복구 이벤트 발행
    await this.eventsService.publishOrderCancelled(
      orderId,
      'Payment or inventory reservation failed'
    );
  }
}
```

---

## 3. RBAC (Role-Based Access Control)

### 3.1 RBAC 모델 설계

```prisma
// prisma/schema.prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  roles     Role[]
  createdAt DateTime @default(now())
}

model Role {
  id          Int          @id @default(autoincrement())
  name        String       @unique // "admin", "editor", "viewer"
  description String?
  users       User[]
  permissions Permission[]
  createdAt   DateTime     @default(now())
}

model Permission {
  id          Int      @id @default(autoincrement())
  resource    String   // "users", "products", "orders"
  action      String   // "create", "read", "update", "delete"
  roles       Role[]
  createdAt   DateTime @default(now())

  @@unique([resource, action])
}
```

### 3.2 RBAC Guard 구현

```typescript
// src/auth/guards/rbac.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  resource: string;
  action: string;
}

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions) {
      return true; // 권한 체크 불필요
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // JWT Guard에서 주입된 사용자

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // 사용자의 모든 권한 조회 (캐싱 권장)
    const userWithPermissions = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    const userPermissions = userWithPermissions.roles.flatMap(role =>
      role.permissions.map(p => ({ resource: p.resource, action: p.action }))
    );

    // 필요한 모든 권한을 확인
    const hasAllPermissions = requiredPermissions.every(required =>
      userPermissions.some(
        p => p.resource === required.resource && p.action === required.action
      )
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Missing required permissions: ${JSON.stringify(requiredPermissions)}`
      );
    }

    return true;
  }
}
```

### 3.3 Permission Decorator

```typescript
// src/auth/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY, RequiredPermission } from '../guards/rbac.guard';

export const Permissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

### 3.4 사용 예제

```typescript
// src/products/products.controller.ts
import { Controller, Get, Post, Put, Delete, UseGuards, Param, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../auth/guards/rbac.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RBACGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions({ resource: 'products', action: 'read' })
  async findAll() {
    return this.productsService.findAll();
  }

  @Post()
  @Permissions({ resource: 'products', action: 'create' })
  async create(@Body() data: CreateProductDto) {
    return this.productsService.create(data);
  }

  @Put(':id')
  @Permissions({ resource: 'products', action: 'update' })
  async update(@Param('id') id: number, @Body() data: UpdateProductDto) {
    return this.productsService.update(id, data);
  }

  @Delete(':id')
  @Permissions({ resource: 'products', action: 'delete' })
  async remove(@Param('id') id: number) {
    return this.productsService.remove(id);
  }
}
```

### 3.5 역할 및 권한 초기화

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 권한 생성
  const permissions = await Promise.all([
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'read' } },
      update: {},
      create: { resource: 'products', action: 'read' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'create' } },
      update: {},
      create: { resource: 'products', action: 'create' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'update' } },
      update: {},
      create: { resource: 'products', action: 'update' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'products', action: 'delete' } },
      update: {},
      create: { resource: 'products', action: 'delete' },
    }),
  ]);

  // 역할 생성
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full access',
      permissions: {
        connect: permissions.map(p => ({ id: p.id })),
      },
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Read-only access',
      permissions: {
        connect: [{ id: permissions[0].id }], // read only
      },
    },
  });

  // 관리자 사용자 생성
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      roles: {
        connect: [{ id: adminRole.id }],
      },
    },
  });

  console.log('Seeded RBAC data');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 4. 서킷 브레이커 (Circuit Breaker)

외부 서비스 장애가 시스템 전체로 전파되는 것을 방지합니다.

```bash
npm install opossum
```

```typescript
// src/common/circuit-breaker.service.ts
import { Injectable } from '@nestjs/common';
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();

  createBreaker<T>(
    name: string,
    asyncFunction: (...args: any[]) => Promise<T>,
    options?: CircuitBreaker.Options
  ): CircuitBreaker<any[], T> {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }

    const breaker = new CircuitBreaker(asyncFunction, {
      timeout: 3000, // 3초 타임아웃
      errorThresholdPercentage: 50, // 50% 실패 시 회로 차단
      resetTimeout: 30000, // 30초 후 재시도
      ...options,
    });

    breaker.on('open', () => {
      console.log(`Circuit breaker [${name}] opened`);
    });

    breaker.on('halfOpen', () => {
      console.log(`Circuit breaker [${name}] half-open, testing...`);
    });

    breaker.on('close', () => {
      console.log(`Circuit breaker [${name}] closed`);
    });

    breaker.fallback(() => {
      console.log(`Circuit breaker [${name}] fallback triggered`);
      return null; // 또는 기본값 반환
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
}
```

**사용 예제**:

```typescript
// src/payment/payment.service.ts
import { Injectable } from '@nestjs/common';
import { CircuitBreakerService } from '../common/circuit-breaker.service';
import axios from 'axios';

@Injectable()
export class PaymentService {
  private paymentBreaker;

  constructor(private circuitBreakerService: CircuitBreakerService) {
    this.paymentBreaker = this.circuitBreakerService.createBreaker(
      'payment-api',
      async (orderId: number, amount: number) => {
        const response = await axios.post('https://payment-api.example.com/charge', {
          orderId,
          amount,
        });
        return response.data;
      },
      {
        timeout: 5000,
        errorThresholdPercentage: 60,
      }
    );
  }

  async processPayment(orderId: number, amount: number) {
    try {
      const result = await this.paymentBreaker.fire(orderId, amount);
      return result;
    } catch (error) {
      console.error('Payment failed:', error);
      throw new Error('Payment service unavailable');
    }
  }
}
```

---

## 5. 레이트 리미팅 (Rate Limiting)

API 남용을 방지하고 시스템을 보호합니다.

```bash
npm install @nestjs/throttler
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60초
        limit: 10, // 최대 10회 요청
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

**커스텀 레이트 리미팅**:

```typescript
// src/auth/decorators/throttle.decorator.ts
import { Throttle } from '@nestjs/throttler';

// 특정 엔드포인트에 다른 제한 적용
@Throttle({ default: { limit: 3, ttl: 60000 } }) // 60초당 3회
@Post('login')
async login(@Body() credentials: LoginDto) {
  return this.authService.login(credentials);
}
```

**Redis 기반 레이트 리미팅** (분산 환경):

```typescript
// src/config/throttler.config.ts
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import Redis from 'ioredis';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: 60000,
      limit: 10,
    },
  ],
  storage: new ThrottlerStorageRedisService(
    new Redis({
      host: 'localhost',
      port: 6379,
    })
  ),
};
```

---

## 6. API Gateway 패턴

### 6.1 개념

단일 진입점을 통해 여러 마이크로서비스를 통합합니다.

**기능**:
- 라우팅 및 로드 밸런싱
- 인증/인가 중앙화
- 요청/응답 변환
- 레이트 리미팅
- 로깅 및 모니터링

### 6.2 간단한 API Gateway 구현

```typescript
// src/gateway/gateway.controller.ts
import { Controller, All, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';

@Controller('api')
export class GatewayController {
  private services = {
    users: 'http://localhost:3001',
    products: 'http://localhost:3002',
    orders: 'http://localhost:3003',
  };

  @All('*')
  async proxyRequest(@Req() req: Request, @Res() res: Response) {
    const path = req.path.replace('/api/', '');
    const [service] = path.split('/');

    const targetUrl = this.services[service];
    if (!targetUrl) {
      return res.status(404).json({ error: 'Service not found' });
    }

    try {
      const response = await axios({
        method: req.method,
        url: `${targetUrl}/${path}`,
        data: req.body,
        headers: {
          ...req.headers,
          host: undefined, // 원본 host 제거
        },
        params: req.query,
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json({
        error: error.message,
      });
    }
  }
}
```

---

## 7. 로깅 및 모니터링

### 7.1 구조화된 로깅

```bash
npm install winston nest-winston
```

```typescript
// src/config/logger.config.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const loggerConfig = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          return `${timestamp} [${context}] ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta) : ''
          }`;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  ],
});
```

### 7.2 Prometheus 메트릭

```bash
npm install @willsoto/nestjs-prometheus prom-client
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

**커스텀 메트릭**:

```typescript
// src/metrics/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    public requestsCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    public requestDuration: Histogram<string>
  ) {}

  recordRequest(method: string, route: string, statusCode: number, duration: number) {
    this.requestsCounter.inc({ method, route, status: statusCode.toString() });
    this.requestDuration.observe({ method, route }, duration / 1000);
  }
}
```

---

## 8. 트러블슈팅

### 8.1 Elasticsearch 성능 최적화

**문제**: 검색 속도 느림

**해결**:
- **bulk indexing** 사용 (대량 색인 시)
- **캐싱**: 자주 사용하는 쿼리 결과 캐싱
- **샤드 수 조정**: 데이터 크기에 맞는 샤드 개수 설정
- **필터 활용**: filter context는 캐싱되므로 must보다 빠름

```typescript
// filter context (캐싱됨)
{ bool: { filter: [{ term: { category: 'electronics' } }] } }

// must context (스코어 계산)
{ bool: { must: [{ term: { category: 'electronics' } }] } }
```

### 8.2 Kafka Consumer Lag

**문제**: Consumer가 메시지 처리 속도를 따라가지 못함

**해결**:
- **Consumer 수 증가**: Partition 수만큼 병렬 처리 가능
- **배치 처리**: 여러 메시지를 한 번에 처리
- **비동기 처리**: 무거운 작업은 별도 워커로 위임

### 8.3 RBAC 성능 이슈

**문제**: 권한 확인이 매 요청마다 DB 쿼리 발생

**해결**:
- **Redis 캐싱**: 사용자 권한 정보 캐싱
- **JWT에 역할 포함**: 간단한 권한은 JWT payload에 포함
- **캐시 무효화 전략**: 역할 변경 시 캐시 삭제

---

## 9. 면접 대비 질문

### Q1: Elasticsearch와 PostgreSQL의 차이는?

**답변**:
- **PostgreSQL**: 관계형 DB, ACID 보장, 정확한 트랜잭션
- **Elasticsearch**: 검색 엔진, 전문 검색, 분산 처리, 실시간 분석

**사용 사례**:
- PostgreSQL: 주 데이터 저장소
- Elasticsearch: 검색, 로그 분석, 집계

### Q2: Kafka와 Redis Pub/Sub의 차이는?

**답변**:
- **Kafka**: 메시지 영속성, 재처리 가능, 높은 처리량, 분산 처리
- **Redis Pub/Sub**: 메시지 휘발성, 실시간 전달, 간단한 구조

**선택 기준**:
- Kafka: 이벤트 소싱, 감사 로그, 대용량 데이터
- Redis: 실시간 알림, 간단한 이벤트

### Q3: RBAC vs ABAC?

**답변**:
- **RBAC**: 역할 기반, 간단하고 관리 쉬움
- **ABAC**: 속성 기반, 세밀한 제어 가능 (시간, 위치 등 조건 추가)

**예시**:
- RBAC: "관리자는 모든 상품을 삭제할 수 있다"
- ABAC: "작성자는 본인이 작성한 상품을 업무 시간 내에만 삭제할 수 있다"

### Q4: 서킷 브레이커의 세 가지 상태는?

**답변**:
1. **Closed**: 정상 동작, 요청 통과
2. **Open**: 실패율 임계값 초과, 모든 요청 차단
3. **Half-Open**: 일정 시간 후 일부 요청 허용하여 테스트

### Q5: API Gateway의 장단점?

**답변**:
**장점**:
- 단일 진입점
- 인증/인가 중앙화
- 로드 밸런싱

**단점**:
- SPOF (Single Point of Failure) 가능성
- 추가 네트워크 홉
- 복잡도 증가

---

## 10. 다음 단계

### T05 완료 후:
1. **실전 프로젝트**: backend/node.js N2.3-N2.5 구현
2. **성능 테스트**: 부하 테스트, 병목 지점 파악
3. **모니터링**: Grafana, Prometheus 대시보드 구축

---

**마지막 업데이트**: 2025년 1월
**다음 튜토리얼**: [T07 - React Query + Forms →](./T07-react-query-forms.md)
