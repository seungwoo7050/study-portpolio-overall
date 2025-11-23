import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('StatsService', () => {
  let service: StatsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    issue: {
      count: jest.fn(),
    },
    comment: {
      count: jest.fn(),
    },
    dailyIssueStats: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('aggregateDailyStats', () => {
    it('should aggregate statistics for a given date', async () => {
      const date = '2025-01-30';
      mockPrismaService.issue.count
        .mockResolvedValueOnce(5) // created count
        .mockResolvedValueOnce(3); // resolved count
      mockPrismaService.comment.count.mockResolvedValue(10);
      mockPrismaService.dailyIssueStats.upsert.mockResolvedValue({
        id: 1,
        date,
        createdCount: 5,
        resolvedCount: 3,
        commentCount: 10,
        createdAt: new Date(),
      });

      await service.aggregateDailyStats(date);

      expect(mockPrismaService.issue.count).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.comment.count).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.dailyIssueStats.upsert).toHaveBeenCalledWith({
        where: { date },
        update: {
          createdCount: 5,
          resolvedCount: 3,
          commentCount: 10,
        },
        create: {
          date,
          createdCount: 5,
          resolvedCount: 3,
          commentCount: 10,
        },
      });
    });
  });

  describe('getDailyStats', () => {
    it('should return daily statistics for a date range', async () => {
      const from = '2025-01-01';
      const to = '2025-01-31';
      const mockStats = [
        {
          id: 1,
          date: '2025-01-01',
          createdCount: 5,
          resolvedCount: 3,
          commentCount: 10,
          createdAt: new Date(),
        },
        {
          id: 2,
          date: '2025-01-02',
          createdCount: 7,
          resolvedCount: 4,
          commentCount: 15,
          createdAt: new Date(),
        },
      ];
      mockPrismaService.dailyIssueStats.findMany.mockResolvedValue(mockStats);

      const result = await service.getDailyStats(from, to);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2025-01-01');
      expect(result[0].createdCount).toBe(5);
      expect(result[1].date).toBe('2025-01-02');
      expect(result[1].createdCount).toBe(7);
      expect(mockPrismaService.dailyIssueStats.findMany).toHaveBeenCalledWith({
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
    });
  });
});
