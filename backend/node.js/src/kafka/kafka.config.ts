import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  clientId: process.env.KAFKA_CLIENT_ID || 'web-phase1-5-node',
  groupId: process.env.KAFKA_GROUP_ID || 'notification-consumer-group',
  enabled: process.env.KAFKA_ENABLED === 'true',
}));
