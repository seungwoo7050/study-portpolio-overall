import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsService } from './stats.service';
import { GetDailyStatsDto, DailyStatsResponseDto } from './dto/daily-stats.dto';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('daily')
  async getDailyStats(
    @Query() query: GetDailyStatsDto,
  ): Promise<DailyStatsResponseDto[]> {
    return this.statsService.getDailyStats(query.from, query.to);
  }
}
