import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import kafkaConfig from './kafka.config';
import { KafkaProducerService } from './kafka.service';

@Module({
  imports: [ConfigModule.forFeature(kafkaConfig)],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
