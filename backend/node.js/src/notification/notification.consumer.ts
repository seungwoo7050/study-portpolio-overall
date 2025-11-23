import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { NotificationService } from './notification.service';
import { KAFKA_TOPICS, OrderEvent } from '../kafka/kafka.types';

@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private isEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {
    this.isEnabled = this.configService.get<boolean>('kafka.enabled', false);

    if (this.isEnabled) {
      this.kafka = new Kafka({
        clientId: this.configService.get<string>('kafka.clientId'),
        brokers: this.configService.get<string[]>('kafka.brokers'),
      });

      this.consumer = this.kafka.consumer({
        groupId: this.configService.get<string>('kafka.groupId'),
      });
    }
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.warn('Kafka is disabled. Consumer will not start.');
      return;
    }

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: KAFKA_TOPICS.ORDER_EVENTS,
        fromBeginning: true,
      });

      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this),
      });

      this.logger.log('Notification consumer started successfully');
    } catch (error) {
      this.logger.error('Failed to start notification consumer', error);
    }
  }

  async onModuleDestroy() {
    if (this.isEnabled && this.consumer) {
      try {
        await this.consumer.disconnect();
        this.logger.log('Notification consumer disconnected');
      } catch (error) {
        this.logger.error('Error disconnecting consumer', error);
      }
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      const event: OrderEvent = JSON.parse(message.value.toString());
      this.logger.log(
        `Processing ${event.eventType} event for order ${event.orderId}`,
      );

      await this.notificationService.createNotificationFromOrderEvent(event);
    } catch (error) {
      this.logger.error(
        `Error processing message from ${topic}-${partition}`,
        error,
      );
      // In production, you might want to send this to a dead letter queue
    }
  }
}
