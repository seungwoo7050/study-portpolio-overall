import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderEvent, OrderEventType } from '../kafka/kafka.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async createNotificationFromOrderEvent(event: OrderEvent): Promise<void> {
    const message = this.generateNotificationMessage(event);

    await this.prisma.notification.create({
      data: {
        userId: event.userId,
        type: event.eventType,
        message,
      },
    });

    this.logger.log(
      `Created notification for user ${event.userId}: ${event.eventType}`,
    );
  }

  private generateNotificationMessage(event: OrderEvent): string {
    switch (event.eventType) {
      case OrderEventType.ORDER_CREATED:
        return `Your order #${event.orderId} has been created. Total amount: $${event.totalAmount.toFixed(2)}`;
      case OrderEventType.ORDER_PAID:
        return `Payment confirmed for order #${event.orderId}. Thank you for your purchase!`;
      case OrderEventType.ORDER_CANCELLED:
        return `Your order #${event.orderId} has been cancelled.`;
      default:
        return `Order #${event.orderId} update: ${event.eventType}`;
    }
  }

  async findAllByUser(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
