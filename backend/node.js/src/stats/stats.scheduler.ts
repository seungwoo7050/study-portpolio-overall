import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StatsService } from './stats.service';

@Injectable()
export class StatsScheduler {
  private readonly logger = new Logger(StatsScheduler.name);

  constructor(private statsService: StatsService) {}

  /**
   * Run daily at 3 AM to aggregate yesterday's statistics
   * For development, you can change to a more frequent schedule
   * Example: Use CronExpression.EVERY_5_MINUTES for testing
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyStatsAggregation() {
    this.logger.log('Starting daily stats aggregation job');

    try {
      // Calculate yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0]; // Format: YYYY-MM-DD

      await this.statsService.aggregateDailyStats(dateStr);

      this.logger.log('Daily stats aggregation job completed successfully');
    } catch (error) {
      this.logger.error('Daily stats aggregation job failed', error.stack);
    }
  }

  /**
   * Manual trigger for testing purposes
   * This can be called from a controller or directly for testing
   */
  async triggerManualAggregation(date?: string): Promise<void> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    this.logger.log(`Manually triggering aggregation for date: ${targetDate}`);
    await this.statsService.aggregateDailyStats(targetDate);
  }
}
