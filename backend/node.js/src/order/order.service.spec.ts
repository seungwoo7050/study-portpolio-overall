import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka.service';
import { NotFoundException } from '@nestjs/common';

describe('OrderService', () => {
  let service: OrderService;
  let prismaService: PrismaService;
  let kafkaProducer: KafkaProducerService;

  const mockPrismaService = {
    product: {
      findMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockKafkaProducer = {
    publishOrderEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: KafkaProducerService,
          useValue: mockKafkaProducer,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prismaService = module.get<PrismaService>(PrismaService);
    kafkaProducer = module.get<KafkaProducerService>(KafkaProducerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const userId = 1;
      const createOrderDto = {
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
      };

      const mockProducts = [
        { id: 1, price: 10.0, status: 'ACTIVE' },
        { id: 2, price: 20.0, status: 'ACTIVE' },
      ];

      const mockOrder = {
        id: 1,
        userId,
        totalAmount: 40.0,
        status: 'PENDING',
        createdAt: new Date(),
        items: [
          { id: 1, orderId: 1, productId: 1, quantity: 2, price: 10.0 },
          { id: 2, orderId: 1, productId: 2, quantity: 1, price: 20.0 },
        ],
      };

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.order.create.mockResolvedValue(mockOrder);
      mockKafkaProducer.publishOrderEvent.mockResolvedValue(undefined);

      const result = await service.createOrder(userId, createOrderDto);

      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] }, status: 'ACTIVE' },
      });
      expect(mockPrismaService.order.create).toHaveBeenCalled();
      expect(mockKafkaProducer.publishOrderEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when product not found', async () => {
      const userId = 1;
      const createOrderDto = {
        items: [{ productId: 999, quantity: 1 }],
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return an order when found', async () => {
      const mockOrder = {
        id: 1,
        userId: 1,
        totalAmount: 100.0,
        status: 'PENDING',
        createdAt: new Date(),
        items: [],
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne(1, 1);

      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
        include: { items: true },
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByUser', () => {
    it('should return all orders for a user', async () => {
      const mockOrders = [
        {
          id: 1,
          userId: 1,
          totalAmount: 100.0,
          status: 'PENDING',
          createdAt: new Date(),
          items: [],
        },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.findAllByUser(1);

      expect(result).toEqual(mockOrders);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status to PAID', async () => {
      const mockOrder = {
        id: 1,
        userId: 1,
        totalAmount: 100.0,
        status: 'PENDING',
        createdAt: new Date(),
        items: [],
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'PAID',
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder);
      mockKafkaProducer.publishOrderEvent.mockResolvedValue(undefined);

      const result = await service.updateOrderStatus(1, 1, 'PAID');

      expect(result.status).toBe('PAID');
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'PAID' },
        include: { items: true },
      });
      expect(mockKafkaProducer.publishOrderEvent).toHaveBeenCalled();
    });

    it('should update order status to CANCELLED', async () => {
      const mockOrder = {
        id: 1,
        userId: 1,
        totalAmount: 100.0,
        status: 'PENDING',
        createdAt: new Date(),
        items: [],
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'CANCELLED',
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder);
      mockKafkaProducer.publishOrderEvent.mockResolvedValue(undefined);

      const result = await service.updateOrderStatus(1, 1, 'CANCELLED');

      expect(result.status).toBe('CANCELLED');
      expect(mockKafkaProducer.publishOrderEvent).toHaveBeenCalled();
    });
  });
});
