import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DailyStatsResponseDto } from './dto/daily-stats.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Aggregate daily statistics for a specific date
   * This is called by the batch scheduler
   */
  async aggregateDailyStats(date: string): Promise<void> {
    this.logger.log(`Aggregating stats for date: ${date}`);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Count issues created on this date
    const createdCount = await this.prisma.issue.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Count issues resolved/closed on this date
    const resolvedCount = await this.prisma.issue.count({
      where: {
        updatedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['RESOLVED', 'CLOSED'],
        },
      },
    });

    // Count comments created on this date
    const commentCount = await this.prisma.comment.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Upsert the statistics
    await this.prisma.dailyIssueStats.upsert({
      where: { date },
      update: {
        createdCount,
        resolvedCount,
        commentCount,
      },
      create: {
        date,
        createdCount,
        resolvedCount,
        commentCount,
      },
    });

    this.logger.log(
      `Stats aggregated for ${date}: created=${createdCount}, resolved=${resolvedCount}, comments=${commentCount}`,
    );
  }

  /**
   * Get daily statistics for a date range
   */
  async getDailyStats(from: string, to: string): Promise<DailyStatsResponseDto[]> {
    const stats = await this.prisma.dailyIssueStats.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return stats.map(
      (stat) =>
        new DailyStatsResponseDto({
          date: stat.date,
          createdCount: stat.createdCount,
          resolvedCount: stat.resolvedCount,
          commentCount: stat.commentCount,
        }),
    );
  }
}
