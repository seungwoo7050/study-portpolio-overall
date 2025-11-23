import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { StatsScheduler } from './stats.scheduler';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  controllers: [StatsController],
  providers: [StatsService, StatsScheduler],
  exports: [StatsService],
})
export class StatsModule {}
