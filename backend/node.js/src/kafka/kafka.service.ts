import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { OrderEvent, KAFKA_TOPICS } from './kafka.types';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;
  private isEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.isEnabled = this.configService.get<boolean>('kafka.enabled', false);

    if (this.isEnabled) {
      this.kafka = new Kafka({
        clientId: this.configService.get<string>('kafka.clientId'),
        brokers: this.configService.get<string[]>('kafka.brokers'),
        logLevel: logLevel.ERROR,
      });
      this.producer = this.kafka.producer();
    }
  }

  async onModuleInit() {
    if (!this.isEnabled) {
      this.logger.warn('Kafka is disabled. Events will not be published.');
      return;
    }

    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer', error);
    }
  }

  async onModuleDestroy() {
    if (this.isEnabled && this.producer) {
      try {
        await this.producer.disconnect();
        this.logger.log('Kafka producer disconnected');
      } catch (error) {
        this.logger.error('Error disconnecting Kafka producer', error);
      }
    }
  }

  async publishOrderEvent(event: OrderEvent): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug('Kafka disabled, skipping event publication', event);
      return;
    }

    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.ORDER_EVENTS,
        messages: [
          {
            key: event.orderId.toString(),
            value: JSON.stringify(event),
            headers: {
              eventType: event.eventType,
            },
          },
        ],
      });
      this.logger.log(`Published ${event.eventType} event for order ${event.orderId}`);
    } catch (error) {
      this.logger.error('Failed to publish order event', error);
      throw error;
    }
  }
}
