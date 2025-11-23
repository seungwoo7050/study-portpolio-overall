import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { applyTestMigrations } from './utils/test-db';

describe('Team & RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let ownerUserId: number;
  let managerToken: string;
  let managerUserId: number;
  let memberToken: string;
  let memberUserId: number;
  let outsiderToken: string;
  let outsiderUserId: number;

  let teamId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

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

    // Create test users
    const ownerRes = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'owner@test.com',
        password: 'password123',
        nickname: 'Team Owner',
      });
    ownerUserId = ownerRes.body.id;

    const ownerLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'owner@test.com',
        password: 'password123',
      });
    ownerToken = ownerLoginRes.body.accessToken;

    const managerRes = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'manager@test.com',
        password: 'password123',
        nickname: 'Team Manager',
      });
    managerUserId = managerRes.body.id;

    const managerLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'manager@test.com',
        password: 'password123',
      });
    managerToken = managerLoginRes.body.accessToken;

    const memberRes = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'member@test.com',
        password: 'password123',
        nickname: 'Team Member',
      });
    memberUserId = memberRes.body.id;

    const memberLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'member@test.com',
        password: 'password123',
      });
    memberToken = memberLoginRes.body.accessToken;

    const outsiderRes = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'outsider@test.com',
        password: 'password123',
        nickname: 'Outsider',
      });
    outsiderUserId = outsiderRes.body.id;

    const outsiderLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'outsider@test.com',
        password: 'password123',
      });
    outsiderToken = outsiderLoginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Team Creation & Basic Access', () => {
    it('should create a team with owner as creator', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/teams')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Team',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Team');
      teamId = res.body.id;
    });

    it('should list teams for owner', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/teams')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].name).toBe('Test Team');
    });

    it('should get team details for member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.id).toBe(teamId);
      expect(res.body.name).toBe('Test Team');
      expect(res.body.members).toBeDefined();
      expect(res.body.members.length).toBeGreaterThan(0);
    });

    it('should deny team details for non-member', async () => {
      await request(app.getHttpServer())
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });
  });

  describe('Team Member Management - RBAC', () => {
    it('owner should add manager', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: managerUserId,
          role: 'MANAGER',
        })
        .expect(201);

      expect(res.body.userId).toBe(managerUserId);
      expect(res.body.role).toBe('MANAGER');
    });

    it('owner should add regular member', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: memberUserId,
          role: 'MEMBER',
        })
        .expect(201);

      expect(res.body.userId).toBe(memberUserId);
      expect(res.body.role).toBe('MEMBER');
    });

    it('regular member should NOT be able to add members', async () => {
      await request(app.getHttpServer())
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          userId: outsiderUserId,
          role: 'MEMBER',
        })
        .expect(403);
    });

    it('manager should be able to add members', async () => {
      // First, let's create another user to add
      const newUserRes = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'newmember@test.com',
          password: 'password123',
          nickname: 'New Member',
        });

      const res = await request(app.getHttpServer())
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          userId: newUserRes.body.id,
          role: 'MEMBER',
        })
        .expect(201);

      expect(res.body.userId).toBe(newUserRes.body.id);
      expect(res.body.role).toBe('MEMBER');
    });

    it('should list all team members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3); // owner, manager, member
    });
  });

  describe('Workspace Items - Team Access Control', () => {
    let workspaceItemId: number;

    it('team member should create workspace item', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/teams/${teamId}/items`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Test Item',
          content: 'Test Content',
        })
        .expect(201);

      expect(res.body.title).toBe('Test Item');
      expect(res.body.teamId).toBe(teamId);
      workspaceItemId = res.body.id;
    });

    it('team member should list workspace items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/teams/${teamId}/items`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('team member should get workspace item by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/items/${workspaceItemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body.id).toBe(workspaceItemId);
      expect(res.body.title).toBe('Test Item');
    });

    it('non-team member should NOT access workspace item', async () => {
      await request(app.getHttpServer())
        .get(`/api/items/${workspaceItemId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('team member should update workspace item', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/items/${workspaceItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Updated Title',
        })
        .expect(200);

      expect(res.body.title).toBe('Updated Title');
    });

    it('team member should delete workspace item', async () => {
      await request(app.getHttpServer())
        .delete(`/api/items/${workspaceItemId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('non-team member should NOT create workspace item', async () => {
      await request(app.getHttpServer())
        .post(`/api/teams/${teamId}/items`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          title: 'Unauthorized Item',
        })
        .expect(403);
    });
  });

  describe('401 vs 403 vs 404 Handling', () => {
    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/api/teams/${teamId}`)
        .expect(401);
    });

    it('should return 403 for authenticated but unauthorized request', async () => {
      await request(app.getHttpServer())
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent team', async () => {
      await request(app.getHttpServer())
        .get('/api/teams/99999')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});
