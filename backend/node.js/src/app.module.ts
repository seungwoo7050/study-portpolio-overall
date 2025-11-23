import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
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
      envFilePath: ['.env.local', '.env'],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes in seconds
      max: 100, // Maximum number of items in cache
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
