import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { applyTestMigrations } from './utils/test-db';

describe('Issue Tracker E2E', () => {
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

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await applyTestMigrations(prisma);
    await prisma.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Issue Tracker Flow', () => {
    it('should register a user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'test@example.com',
          password: 'password123',
          nickname: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.nickname).toBe('Test User');
      expect(response.body).not.toHaveProperty('passwordHash');

      userId = response.body.id;
    });

    it('should login and get JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');

      authToken = response.body.accessToken;
    });

    it('should create a project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Test project description',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Project');
      expect(response.body.description).toBe('Test project description');

      projectId = response.body.id;
    });

    it('should get all projects', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].name).toBe('Test Project');
    });

    let issueId: number;

    it('should create an issue', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Issue',
          description: 'This is a test issue',
          assigneeId: userId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Issue');
      expect(response.body.status).toBe('OPEN');
      expect(response.body.reporterId).toBe(userId);
      expect(response.body.assigneeId).toBe(userId);

      issueId = response.body.id;
    });

    it('should get issues by project', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0].title).toBe('Test Issue');
    });

    it('should get a single issue', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(issueId);
      expect(response.body.title).toBe('Test Issue');
      expect(response.body).toHaveProperty('reporter');
      expect(response.body).toHaveProperty('assignee');
    });

    it('should update an issue', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Test Issue',
          status: 'IN_PROGRESS',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Test Issue');
      expect(response.body.status).toBe('IN_PROGRESS');
    });

    it('should add a comment to an issue', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/issues/${issueId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test comment',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('This is a test comment');
      expect(response.body.issueId).toBe(issueId);
      expect(response.body.authorId).toBe(userId);
    });

    it('should get comments for an issue', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/issues/${issueId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].content).toBe('This is a test comment');
      expect(response.body[0]).toHaveProperty('author');
    });

    it('should delete an issue', async () => {
      await request(app.getHttpServer())
        .delete(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify issue is deleted
      await request(app.getHttpServer())
        .get(`/api/issues/${issueId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when accessing protected route without token', async () => {
      await request(app.getHttpServer())
        .get('/api/projects')
        .expect(401);
    });

    it('should return validation error for invalid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'invalid-email',
          password: '123',
          nickname: '',
        })
        .expect(400);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
