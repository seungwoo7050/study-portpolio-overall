import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationConsumer } from './notification.consumer';
import { PrismaModule } from '../common/prisma/prisma.module';
import kafkaConfig from '../kafka/kafka.config';

@Module({
  imports: [PrismaModule, ConfigModule.forFeature(kafkaConfig)],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationConsumer],
  exports: [NotificationService],
})
export class NotificationModule {}
