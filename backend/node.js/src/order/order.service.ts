import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderEventType } from '../kafka/kafka.types';
import { randomUUID } from 'crypto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private kafkaProducer: KafkaProducerService,
  ) {}

  async createOrder(userId: number, createOrderDto: CreateOrderDto) {
    this.logger.log(`Creating order for user ${userId}`);

    // Verify all products exist and get their prices
    const productIds = createOrderDto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: 'ACTIVE',
      },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found or inactive');
    }

    // Create a map of product prices
    const productPriceMap = new Map<number, number>(
      products.map((p) => [p.id, p.price]),
    );

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = createOrderDto.items.map((item) => {
      const price = productPriceMap.get(item.productId);
      if (price === undefined || price === null) {
        throw new NotFoundException(`Product ${item.productId} price not found`);
      }
      const itemTotal = price * item.quantity;
      totalAmount += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price,
      };
    });

    // Create order with items in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'PENDING',
          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
        },
      });

      return createdOrder;
    });

    this.logger.log(`Order ${order.id} created successfully`);

    // Publish ORDER_CREATED event to Kafka
    try {
      await this.kafkaProducer.publishOrderEvent({
        eventId: randomUUID(),
        eventType: OrderEventType.ORDER_CREATED,
        timestamp: new Date().toISOString(),
        orderId: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
      });
    } catch (error) {
      this.logger.error('Failed to publish ORDER_CREATED event', error);
      // Don't throw error - order is already created
    }

    return order;
  }

  async findOne(id: number, userId: number) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findAllByUser(userId: number) {
    return this.prisma.order.findMany({
      where: {
        userId,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateOrderStatus(
    orderId: number,
    userId: number,
    newStatus: 'PAID' | 'CANCELLED',
  ) {
    const order = await this.findOne(orderId, userId);

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: { items: true },
    });

    // Publish status change event
    try {
      const eventType =
        newStatus === 'PAID'
          ? OrderEventType.ORDER_PAID
          : OrderEventType.ORDER_CANCELLED;

      await this.kafkaProducer.publishOrderEvent({
        eventId: randomUUID(),
        eventType,
        timestamp: new Date().toISOString(),
        orderId: updatedOrder.id,
        userId: updatedOrder.userId,
        totalAmount: updatedOrder.totalAmount,
      });
    } catch (error) {
      this.logger.error(`Failed to publish ${newStatus} event`, error);
    }

    return updatedOrder;
  }
}
