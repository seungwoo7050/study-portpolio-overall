import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { applyTestMigrations } from './utils/test-db';

describe('External API E2E Tests (N2.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    await applyTestMigrations(prisma);
    await prisma.cleanDatabase();

    // Clean up database
    await prisma.user.deleteMany();

    // Create test user
    const userResponse = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'external-test@example.com',
        password: 'password123',
        nickname: 'External Tester',
      })
      .expect(201);

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'external-test@example.com',
        password: 'password123',
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('GET /api/external/example', () => {
    it('should fetch data from external API', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/external/example')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);

      // Should return at most 10 items or fallback data
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.length).toBeLessThanOrEqual(10);

      // Each item should have expected structure
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('body');
        expect(item).toHaveProperty('userId');
      });
    }, 15000); // Increase timeout for external API call

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/external/example').expect(401);
    });
  });

  describe('GET /api/external/posts/:id', () => {
    it('should fetch a single post by ID', async () => {
      const postId = 1;
      const response = await request(app.getHttpServer())
        .get(`/api/external/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body !== null) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('body');
        expect(response.body).toHaveProperty('userId');
      }
    }, 15000);

    it('should handle non-existent post gracefully', async () => {
      const postId = 999999;
      const response = await request(app.getHttpServer())
        .get(`/api/external/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return null for non-existent post
      expect(response.body).toBeNull();
    }, 15000);
  });
});
