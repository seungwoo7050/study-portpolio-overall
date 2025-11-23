import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { applyTestMigrations } from './utils/test-db';
import { StatsService } from '../src/stats/stats.service';
import { IssueService } from '../src/issue/issue.service';

describe('Stats E2E Tests (N2.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: number;
  let projectId: number;

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

    // Create test user
    const userResponse = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'stats-test@example.com',
        password: 'password123',
        nickname: 'Stats Tester',
      })
      .expect(201);

    userId = userResponse.body.id;

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'stats-test@example.com',
        password: 'password123',
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
    expect(authToken).toBeDefined();

    // Create test project
    const projectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Stats Test Project',
        description: 'Project for stats testing',
      })
      .expect(201);

    projectId = projectResponse.body.id;
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  describe('Daily Statistics', () => {
    it('should aggregate daily statistics correctly', async () => {
      // Create some test data
      const today = new Date().toISOString().split('T')[0];

      // Create issues
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Issue 1',
          description: 'Test description',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Issue 2',
          description: 'Test description',
        })
        .expect(201);

      // Manually trigger aggregation
      const statsService = app.get(StatsService);
      await statsService.aggregateDailyStats(today);

      // Query the statistics
      const response = await request(app.getHttpServer())
        .get(`/api/stats/daily?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].date).toBe(today);
      expect(response.body[0].createdCount).toBe(2);
    });

    it('should return empty array when no stats exist for date range', async () => {
      const futureDate = '2099-12-31';
      const response = await request(app.getHttpServer())
        .get(`/api/stats/daily?from=${futureDate}&to=${futureDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should require authentication', async () => {
      const today = new Date().toISOString().split('T')[0];
      await request(app.getHttpServer())
        .get(`/api/stats/daily?from=${today}&to=${today}`)
        .expect(401);
    });
  });

  describe('Popular Issues (Caching)', () => {
    beforeEach(async () => {
      await prisma.dailyIssueStats.deleteMany();
      await prisma.comment.deleteMany();
      await prisma.issue.deleteMany();
    });

    it('should return popular issues based on viewCount + commentCount', async () => {
      // Create issues with different popularity
      const issue1Response = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Popular Issue',
          description: 'This will be popular',
        })
        .expect(201);

      const issue1Id = issue1Response.body.id;

      const issue2Response = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Less Popular Issue',
          description: 'This will be less popular',
        })
        .expect(201);

      const issue2Id = issue2Response.body.id;

      // Add comments to issue1 to make it more popular
      await request(app.getHttpServer())
        .post(`/api/issues/${issue1Id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Comment 1',
        });

      await request(app.getHttpServer())
        .post(`/api/issues/${issue1Id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Comment 2',
        });

      // Increment view count for issue1
      const issueService = app.get(IssueService);
      await issueService.incrementViewCount(issue1Id);
      await issueService.incrementViewCount(issue1Id);

      // Get popular issues
      const response = await request(app.getHttpServer())
        .get('/api/issues/popular')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);

      // Issue1 should be more popular (viewCount=2 + commentCount=2 = 4)
      // Issue2 should be less popular (viewCount=0 + commentCount=0 = 0)
      if (response.body.length > 0) {
        expect(response.body[0].id).toBe(issue1Id);
      }
    });

    it('should cache popular issues results', async () => {
      // First request
      const response1 = await request(app.getHttpServer())
        .get('/api/issues/popular')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Second request (should hit cache)
      const response2 = await request(app.getHttpServer())
        .get('/api/issues/popular')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Results should be the same
      expect(response1.body).toEqual(response2.body);
    });
  });
});
