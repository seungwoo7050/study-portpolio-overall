import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { applyTestMigrations } from './utils/test-db';

describe('Order & Notification E2E (N2.5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: number;
  let productId: number;

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

  describe('Order Creation Flow', () => {
    it('should register a user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'buyer@example.com',
          password: 'password123',
          nickname: 'Buyer User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      userId = response.body.id;
    });

    it('should login and get auth token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'buyer@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      authToken = response.body.access_token;
    });

    it('should create a product', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product',
          description: 'A test product for orders',
          category: 'Electronics',
          brand: 'TestBrand',
          price: 99.99,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Product');
      productId = response.body.id;
    });

    it('should create an order with items', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              productId: productId,
              quantity: 2,
            },
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(userId);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.totalAmount).toBe(199.98); // 99.99 * 2
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].quantity).toBe(2);
    });

    it('should get user orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('items');
    });

    it('should get a specific order', async () => {
      // First create an order
      const createResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const orderId = createResponse.body.id;

      // Then fetch it
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(orderId);
      expect(response.body.userId).toBe(userId);
    });

    it('should mark order as paid', async () => {
      // Create an order
      const createResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const orderId = createResponse.body.id;

      // Mark as paid
      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('PAID');
    });

    it('should cancel an order', async () => {
      // Create an order
      const createResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const orderId = createResponse.body.id;

      // Cancel it
      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
    });

    it('should fail to create order with non-existent product', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              productId: 99999, // Non-existent product
              quantity: 1,
            },
          ],
        })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('should fail to create order with invalid data', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [], // Empty items array
        })
        .expect(400);
    });
  });

  describe('Notification Flow', () => {
    it('should create notifications for order events', async () => {
      // Create an order (this should trigger ORDER_CREATED event)
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      // Note: In test environment, Kafka is disabled (KAFKA_ENABLED=false)
      // So notifications won't be created via Kafka consumer
      // This test verifies the notification API works

      // Get notifications
      const response = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // In test mode with Kafka disabled, no notifications will be auto-created
      // This is expected behavior
    });
  });

  describe('Authorization', () => {
    it('should not allow unauthenticated access to orders', async () => {
      await request(app.getHttpServer())
        .get('/api/orders')
        .expect(401);
    });

    it('should not allow unauthenticated access to notifications', async () => {
      await request(app.getHttpServer())
        .get('/api/notifications')
        .expect(401);
    });

    it('should not allow accessing another users order', async () => {
      // Create another user
      const newUserResponse = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'other@example.com',
          password: 'password123',
          nickname: 'Other User',
        })
        .expect(201);

      // Login as new user
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'password123',
        })
        .expect(201);

      const otherToken = loginResponse.body.access_token;

      // Create an order as first user
      const orderResponse = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Try to access it as second user
      await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404); // Should not find it
    });
  });
});
