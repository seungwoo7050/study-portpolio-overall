import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderEventType } from '../kafka/kafka.types';

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotificationFromOrderEvent', () => {
    it('should create a notification for ORDER_CREATED event', async () => {
      const orderEvent = {
        eventId: 'test-event-id',
        eventType: OrderEventType.ORDER_CREATED,
        timestamp: new Date().toISOString(),
        orderId: 1,
        userId: 1,
        totalAmount: 100.0,
      };

      mockPrismaService.notification.create.mockResolvedValue({
        id: 1,
        userId: 1,
        type: OrderEventType.ORDER_CREATED,
        message: 'Your order #1 has been created. Total amount: $100.00',
        createdAt: new Date(),
      });

      await service.createNotificationFromOrderEvent(orderEvent);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          type: OrderEventType.ORDER_CREATED,
          message: expect.stringContaining('order #1 has been created'),
        },
      });
    });

    it('should create a notification for ORDER_PAID event', async () => {
      const orderEvent = {
        eventId: 'test-event-id',
        eventType: OrderEventType.ORDER_PAID,
        timestamp: new Date().toISOString(),
        orderId: 2,
        userId: 1,
        totalAmount: 200.0,
      };

      mockPrismaService.notification.create.mockResolvedValue({
        id: 2,
        userId: 1,
        type: OrderEventType.ORDER_PAID,
        message: 'Payment confirmed for order #2. Thank you for your purchase!',
        createdAt: new Date(),
      });

      await service.createNotificationFromOrderEvent(orderEvent);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          type: OrderEventType.ORDER_PAID,
          message: expect.stringContaining('Payment confirmed'),
        },
      });
    });

    it('should create a notification for ORDER_CANCELLED event', async () => {
      const orderEvent = {
        eventId: 'test-event-id',
        eventType: OrderEventType.ORDER_CANCELLED,
        timestamp: new Date().toISOString(),
        orderId: 3,
        userId: 1,
        totalAmount: 150.0,
      };

      mockPrismaService.notification.create.mockResolvedValue({
        id: 3,
        userId: 1,
        type: OrderEventType.ORDER_CANCELLED,
        message: 'Your order #3 has been cancelled.',
        createdAt: new Date(),
      });

      await service.createNotificationFromOrderEvent(orderEvent);

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          type: OrderEventType.ORDER_CANCELLED,
          message: expect.stringContaining('has been cancelled'),
        },
      });
    });
  });

  describe('findAllByUser', () => {
    it('should return all notifications for a user', async () => {
      const mockNotifications = [
        {
          id: 1,
          userId: 1,
          type: OrderEventType.ORDER_CREATED,
          message: 'Test notification',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.notification.findMany.mockResolvedValue(
        mockNotifications,
      );

      const result = await service.findAllByUser(1);

      expect(result).toEqual(mockNotifications);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
