import { ClassSerializerInterceptor, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { HealthController } from './common/health/health.controller';
import { PrismaModule } from './common/prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { IssueModule } from './issue/issue.module';
import { CommentModule } from './comment/comment.module';
import { TeamModule } from './team/team.module';
import { StatsModule } from './stats/stats.module';
import { ExternalModule } from './external/external.module';
import { ProductModule } from './product/product.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { KafkaModule } from './kafka/kafka.module';
import { OrderModule } from './order/order.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? ['.env.test', '.env']
          : ['.env.local', '.env'],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger(AppModule.name);
        const host = configService.get<string>('REDIS_HOST');
        const port = Number(configService.get<string>('REDIS_PORT')) || 6379;

        if (!host) {
          logger.warn('REDIS_HOST not set. Falling back to in-memory cache store.');
          return {
            ttl: 300,
          };
        }

        return {
          store: await redisStore({
            socket: {
              host,
              port,
            },
          }),
          ttl: 300,
        };
      },
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    ProjectModule,
    IssueModule,
    CommentModule,
    TeamModule,
    StatsModule,
    ExternalModule,
    ElasticsearchModule,
    ProductModule,
    SearchModule,
    AdminModule,
    KafkaModule,
    OrderModule,
    NotificationModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule {}
