import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { applyTestMigrations } from '../utils/test-db';

describe('Product & Search API (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    await applyTestMigrations(prismaService);

    // Clean up database
    await prismaService.product.deleteMany();
    await prismaService.user.deleteMany();

    // Create a test user and get auth token
    const signupResponse = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'producttest@example.com',
        password: 'Password123!',
        nickname: 'ProductTester',
      })
      .expect(201);

    userId = signupResponse.body.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'producttest@example.com',
        password: 'Password123!',
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await prismaService.product.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('Product CRUD', () => {
    let productId: number;

    it('should create a new product', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'iPhone 15',
          description: 'Latest Apple smartphone',
          category: 'Electronics',
          brand: 'Apple',
          price: 999.99,
          status: 'ACTIVE',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('iPhone 15');
      expect(response.body.price).toBe(999.99);
      productId = response.body.id;
    });

    it('should get all products', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get a product by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(productId);
      expect(response.body.name).toBe('iPhone 15');
    });

    it('should update a product', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'iPhone 15 Pro',
          price: 1199.99,
        })
        .expect(200);

      expect(response.body.name).toBe('iPhone 15 Pro');
      expect(response.body.price).toBe(1199.99);
    });

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/api/products/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should delete a product', async () => {
      await request(app.getHttpServer())
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Search API', () => {
    beforeAll(async () => {
      // Create test products
      const products = [
        {
          name: 'MacBook Pro',
          description: 'Professional laptop',
          category: 'Computers',
          brand: 'Apple',
          price: 2499.99,
          status: 'ACTIVE',
        },
        {
          name: 'MacBook Air',
          description: 'Lightweight laptop',
          category: 'Computers',
          brand: 'Apple',
          price: 1299.99,
          status: 'ACTIVE',
        },
        {
          name: 'ThinkPad X1',
          description: 'Business laptop',
          category: 'Computers',
          brand: 'Lenovo',
          price: 1799.99,
          status: 'ACTIVE',
        },
      ];

      for (const product of products) {
        await request(app.getHttpServer())
          .post('/api/products')
          .set('Authorization', `Bearer ${authToken}`)
          .send(product);
      }

      // Wait a bit for indexing (if ES is enabled)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    it('should search products (ES disabled, returns empty)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/products')
        .query({ q: 'MacBook' })
        .expect(200);

      // Since ES is disabled in test, it should return empty result
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('size');
    });

    it('should search with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/products')
        .query({
          category: 'Computers',
          brand: 'Apple',
          minPrice: 1000,
          maxPrice: 2000,
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/search/products')
        .query({ page: 1, size: 10 })
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.size).toBe(10);
    });
  });

  describe('Admin Reindex', () => {
    it('should reindex all products', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/admin/reindex/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('count');
    });
  });
});
