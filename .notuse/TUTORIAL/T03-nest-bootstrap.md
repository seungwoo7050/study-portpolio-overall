# T03: NestJS 기본 뼈대

> **목표**: NestJS 프로젝트 구조와 핵심 개념 완전 정복
> **예상 시간**: 10-15시간 (주 5-7시간)
> **난이도**: 🟡 중급
> **선행 요구사항**: [T01: JS/TS 코어](./T01-js-ts-core.md)
> **적용 프로젝트**: backend/node.js N2.0
> **퀄리티 보장**: 구조화된 코드, DI 패턴, 테스트 가능
> **효율성 보장**: 모듈별 학습, 실습 프로젝트, CI/CD

---

## 목차

1. [NestJS 소개](#1-nestjs-소개)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [모듈/컨트롤러/서비스](#3-모듈컨트롤러서비스)
4. [Dependency Injection](#4-dependency-injection)
5. [환경 설정](#5-환경-설정)
6. [Prisma ORM](#6-prisma-orm)
7. [GitHub Actions CI](#7-github-actions-ci)
8. [트러블슈팅](#8-트러블슈팅)
9. [프로젝트 적용](#9-프로젝트-적용)
10. [공통 오류와 해결](#10-공통-오류와-해결)
11. [퀴즈 및 다음 단계](#11-퀴즈-및-다음-단계)
12. [추가 리소스](#12-추가-리소스)

---

## 1. NestJS 소개

### 1.1 왜 NestJS인가?

**Express의 문제점**:
- 구조가 자유로워 일관성 없음
- 의존성 주입(DI) 없음
- 타입스크립트 지원 미흡
- 대규모 프로젝트에서 유지보수 어려움

**NestJS의 장점**:
- Angular 스타일의 구조화된 아키텍처
- 강력한 타입스크립트 지원
- Dependency Injection 내장
- 데코레이터 기반의 선언적 코드
- 테스트 용이성

### 1.2 설치 및 프로젝트 생성

```bash
# NestJS CLI 설치
npm install -g @nestjs/cli

# 프로젝트 생성
nest new backend-node
cd backend-node

# 의존성 설치
npm install

# 개발 서버 실행
npm run start:dev
```

**생성된 구조**:
```
backend-node/
├── src/
│   ├── app.controller.ts
│   ├── app.controller.spec.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── test/
├── nest-cli.json
├── package.json
└── tsconfig.json
```

---

## 2. 프로젝트 구조

### 2.1 권장 디렉터리 구조

```
src/
├── common/              # 공통 유틸리티, 데코레이터, 필터
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/              # 설정 파일
│   └── configuration.ts
├── modules/             # 기능별 모듈
│   ├── users/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── posts/
│   └── auth/
├── prisma/              # Prisma 스키마 및 마이그레이션
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── app.module.ts
└── main.ts
```

### 2.2 main.ts (진입점)

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // DTO에 없는 속성 제거
      forbidNonWhitelisted: true, // DTO에 없는 속성 있으면 에러
      transform: true,       // 타입 자동 변환
    }),
  );

  // CORS 활성화
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // 전역 prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
```

---

## 3. 모듈/컨트롤러/서비스

### 3.1 모듈 (Module)

**개념**: 관련 기능을 그룹화하는 단위

```typescript
// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],        // 다른 모듈 가져오기
  controllers: [UsersController], // 이 모듈의 컨트롤러
  providers: [UsersService],      // 이 모듈의 서비스 (DI)
  exports: [UsersService],        // 다른 모듈에서 사용 가능하게 내보내기
})
export class UsersModule {}
```

**CLI로 모듈 생성**:
```bash
nest generate module modules/users
# 또는
nest g mo modules/users
```

---

### 3.2 컨트롤러 (Controller)

**개념**: HTTP 요청을 처리하는 레이어

```typescript
// src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users') // 라우트 prefix: /api/users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  async findAll(@Query('page', ParseIntPipe) page: number = 1) {
    return this.usersService.findAll(page);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

**CLI로 컨트롤러 생성**:
```bash
nest g controller modules/users
```

---

### 3.3 서비스 (Service)

**개념**: 비즈니스 로직을 처리하는 레이어

```typescript
// src/modules/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
      },
    });

    // 비밀번호 제외하고 반환
    const { password, ...result } = user;
    return result;
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id); // 존재 확인

    const data: any = { ...updateUserDto };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async remove(id: number) {
    await this.findOne(id); // 존재 확인

    await this.prisma.user.delete({
      where: { id },
    });
  }
}
```

**CLI로 서비스 생성**:
```bash
nest g service modules/users
```

---

### 3.4 DTO (Data Transfer Object)

```typescript
// src/modules/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}

// src/modules/users/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

**의존성 설치**:
```bash
npm install class-validator class-transformer
```

---

## 4. Dependency Injection

### 4.1 개념

**문제 (DI 없이)**:
```typescript
// ❌ 강한 결합, 테스트 어려움
class UsersService {
  private prisma = new PrismaClient(); // 직접 인스턴스 생성

  async findAll() {
    return this.prisma.user.findMany();
  }
}
```

**해결 (DI 사용)**:
```typescript
// ✅ 느슨한 결합, 테스트 용이
@Injectable()
class UsersService {
  constructor(private prisma: PrismaService) {} // 주입받음

  async findAll() {
    return this.prisma.user.findMany();
  }
}
```

### 4.2 Provider 등록

```typescript
// src/modules/users/users.module.ts
@Module({
  providers: [
    UsersService,              // 단축 문법

    // 또는 전체 문법
    {
      provide: UsersService,   // 토큰
      useClass: UsersService,  // 구현 클래스
    },

    // 값 주입
    {
      provide: 'CONFIG',
      useValue: { apiKey: 'xxx' },
    },

    // 팩토리 패턴
    {
      provide: 'DATABASE',
      useFactory: (config: ConfigService) => {
        return createConnection(config.get('DATABASE_URL'));
      },
      inject: [ConfigService],
    },
  ],
})
export class UsersModule {}
```

### 4.3 주입 방법

```typescript
// Constructor Injection (권장)
@Injectable()
class UsersService {
  constructor(private prisma: PrismaService) {}
}

// Property Injection
@Injectable()
class UsersService {
  @Inject(PrismaService)
  private prisma: PrismaService;
}

// 커스텀 토큰 주입
@Injectable()
class UsersService {
  constructor(
    @Inject('CONFIG') private config: any,
  ) {}
}
```

---

## 5. 환경 설정

### 5.1 @nestjs/config 설치

```bash
npm install @nestjs/config
```

### 5.2 설정 파일 구조

```typescript
// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
});
```

### 5.3 환경 변수 validation

```typescript
// src/config/env.validation.ts
import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
```

### 5.4 AppModule에 등록

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,                // 전역 모듈로 등록
      load: [configuration],         // 설정 로드
      validate,                      // validation 함수
      envFilePath: ['.env.local', '.env'], // 환경 파일 순서
    }),
    // 다른 모듈들...
  ],
})
export class AppModule {}
```

### 5.5 ConfigService 사용

```typescript
// 서비스에서 사용
@Injectable()
class SomeService {
  constructor(private configService: ConfigService) {}

  someMethod() {
    const port = this.configService.get<number>('port');
    const dbUrl = this.configService.get<string>('database.url');
    const jwtSecret = this.configService.get<string>('jwt.secret');
  }
}
```

### 5.6 .env 파일

```env
# .env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 6. Prisma ORM

### 6.1 Prisma 설치

```bash
npm install prisma @prisma/client
npx prisma init
```

### 6.2 Prisma 스키마

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String
  role      Role     @default(USER)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  posts     Post[]

  @@map("users")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int      @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@map("posts")
}

enum Role {
  USER
  ADMIN
}
```

### 6.3 마이그레이션

```bash
# 마이그레이션 생성 및 적용
npx prisma migrate dev --name init

# Prisma Client 재생성
npx prisma generate

# 데이터베이스 초기화
npx prisma migrate reset

# 프로덕션 마이그레이션
npx prisma migrate deploy
```

### 6.4 Prisma Service

```typescript
// src/modules/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Prisma disconnected');
  }

  // 트랜잭션 헬퍼
  async transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn);
  }
}

// src/modules/prisma/prisma.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 전역 모듈로 설정
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### 6.5 Seed 데이터

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 기존 데이터 삭제
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // 관리자 계정 생성
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  });

  // 일반 사용자 생성
  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      password: await bcrypt.hash('alice123', 10),
      posts: {
        create: [
          {
            title: 'First Post',
            content: 'Hello, World!',
            published: true,
          },
          {
            title: 'Draft Post',
            content: 'This is a draft',
            published: false,
          },
        ],
      },
    },
  });

  console.log({ admin, alice });
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

**package.json에 스크립트 추가**:
```json
{
  "scripts": {
    "prisma:seed": "ts-node prisma/seed.ts"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

**실행**:
```bash
npm run prisma:seed
```

---

## 7. GitHub Actions CI

### 7.1 CI 워크플로우

```.github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run build

      - name: Setup test database
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
        run: |
          npx prisma migrate deploy
          npx prisma db seed

      - name: Run tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          JWT_SECRET: test-secret
        run: npm run test:cov

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Archive build
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist
```

---

## 8. 트러블슈팅

### 8.1 Circular Dependency

**문제**: 모듈 간 순환 참조

```typescript
// ❌ UsersModule과 PostsModule이 서로 import
@Module({
  imports: [PostsModule],
  // ...
})
export class UsersModule {}

@Module({
  imports: [UsersModule],
  // ...
})
export class PostsModule {}
```

**해결**: `forwardRef` 사용

```typescript
// ✅
@Module({
  imports: [forwardRef(() => PostsModule)],
  // ...
})
export class UsersModule {}

@Module({
  imports: [forwardRef(() => UsersModule)],
  // ...
})
export class PostsModule {}
```

---

### 8.2 Prisma Client 타입 에러

**문제**: Prisma Client 타입이 인식되지 않음

**해결**:
```bash
npx prisma generate
npm run build
```

---

## 9. 프로젝트 적용

### backend/node.js N2.0 전체 구조

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';
import { AuthModule } from './modules/auth/auth.module';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    PrismaModule,
    UsersModule,
    PostsModule,
    AuthModule,
  ],
})
export class AppModule {}
```

---

## 면접 질문

1. **NestJS의 Dependency Injection은 어떻게 동작하나요?**
   - Provider 등록, 토큰 기반 주입, 생명주기 관리

2. **모듈의 역할은 무엇인가요?**
   - 관련 기능 그룹화, 캡슐화, 재사용성

3. **DTO와 Entity의 차이는?**
   - DTO: 데이터 전송 객체, validation, Entity: DB 모델

4. **Pipe의 역할은?**
   - 데이터 변환(transformation), 유효성 검사(validation)

5. **Guard와 Interceptor의 차이는?**
   - Guard: 요청 허용/거부, Interceptor: 요청/응답 변환

6. **NestJS에서 데코레이터의 역할은?**
   - 메타데이터 추가, 선언적 프로그래밍

7. **Prisma의 장점은 무엇인가요?**
   - 타입 안전성, 자동 생성 코드, 마이그레이션

8. **ConfigModule을 사용하는 이유는?**
   - 환경 변수 중앙 관리, 타입 안전성

9. **Jest로 테스트를 작성하는 이유는?**
   - 코드 품질 보장, 리팩토링 안정성

10. **GitHub Actions의 CI/CD 역할은?**
    - 자동화된 빌드, 테스트, 배포

---

## 다음 단계

- JWT 인증 → [T05: 고급 백엔드 패턴](./T05-advanced-backend.md)
- 프론트엔드 연동 → [T06: React/Vite 기본](./T06-react-vite-basics.md)

---

## 10. 공통 오류와 해결

- **모듈 등록 누락**: Unknown dependencies → app.module.ts 확인.
- **Prisma 연결**: DB 연결 실패 → 환경 변수 체크.
- **데코레이터 누락**: @Injectable → 서비스에 추가.
- **타입 불일치**: DTO validation → class-validator 사용.
- **CI 실패**: 스크립트 오류 → 로컬 테스트.

---

## 11. 퀴즈 및 다음 단계

**퀴즈**:
1. @Module? (메타데이터 데코레이터)
2. Dependency Injection? (토큰 기반 주입)
3. Prisma schema? (DB 모델 정의)
4. GitHub Actions? (CI/CD 파이프라인)
5. @Controller 데코레이터? (HTTP 요청 라우팅)
6. @Injectable의 역할? (DI 컨테이너 등록)
7. ValidationPipe? (DTO 검증)
8. Prisma migrate? (DB 스키마 변경)
9. Guard vs Interceptor? (요청 제어 vs 변환)
10. 환경 변수 관리? (ConfigModule)

**완료 조건**: API 실행, 테스트 통과.

**다음**: T05/T06 선택!

---

## 12. 추가 리소스

### NestJS
- [NestJS 공식 문서](https://docs.nestjs.com/): 가이드와 API.
- [NestJS CLI](https://docs.nestjs.com/cli/overview): 명령어 도구.
- [NestJS Awesome](https://github.com/juliandavidmr/awesome-nestjs): 리소스 모음.

### Prisma
- [Prisma Docs](https://www.prisma.io/docs/): ORM 가이드.
- [Prisma Studio](https://www.prisma.io/studio): DB GUI.
- [Prisma Cheat Sheet](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference): 스키마 레퍼런스.

### CI/CD
- [GitHub Actions](https://docs.github.com/actions): 워크플로우.
- [Jest Testing](https://jestjs.io/): 유닛 테스트.
- [Supertest](https://github.com/visionmedia/supertest): API 테스트.

### 튜토리얼
- [NestJS Course](https://www.youtube.com/playlist?list=PL4iRawYDaKtGKjL2v5w4tYqJm5GtmqX): YouTube 시리즈.
- [Prisma Guide](https://www.prisma.io/docs/getting-started): 시작 가이드.
- [NestJS Zero to Hero](https://www.udemy.com/course/nestjs-zero-to-hero/): Udemy 코스.

### 실습 플랫폼
- [NestJS Playground](https://docs.nestjs.com/first-steps): 온라인 실습.
- [TypeScript Playground](https://www.typescriptlang.org/play): TS 실험.

### 커뮤니티
- [NestJS Discord](https://discord.gg/nestjs): 커뮤니티 채팅.
- [Reddit r/Nestjs_framework](https://www.reddit.com/r/Nestjs_framework/): Q&A.

---

**완료 체크리스트**:
- [ ] NestJS 소개 이해
  - [ ] NestJS 장점 파악
  - [ ] 프로젝트 생성 및 구조 확인
- [ ] 프로젝트 구조
  - [ ] 권장 디렉터리 구조 적용
  - [ ] main.ts 설정
- [ ] 모듈/컨트롤러/서비스
  - [ ] 모듈 생성 및 구성
  - [ ] 컨트롤러 구현
  - [ ] 서비스 작성
- [ ] Dependency Injection
  - [ ] DI 개념 이해
  - [ ] 프로바이더 등록
  - [ ] 토큰 기반 주입
- [ ] 환경 설정
  - [ ] ConfigModule 사용
  - [ ] 환경 변수 관리
- [ ] Prisma ORM
  - [ ] 스키마 정의
  - [ ] 마이그레이션 실행
  - [ ] Seed 데이터 생성
- [ ] GitHub Actions CI
  - [ ] 워크플로우 작성
  - [ ] 테스트 자동화
- [ ] 트러블슈팅
  - [ ] 공통 오류 해결
- [ ] 프로젝트 적용
  - [ ] CRUD API 구현
- [ ] 퀴즈 80% 이상 정답

**학습 시간**: _____ 시간 소요
