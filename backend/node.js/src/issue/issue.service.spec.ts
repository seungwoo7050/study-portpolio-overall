import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IssueService } from './issue.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException } from '../common/exceptions/domain.exception';
import { IssueStatus } from './dto/create-issue.dto';

describe('IssueService', () => {
  let service: IssueService;
  let prisma: PrismaService;

  const mockPrismaService = {
    issue: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<IssueService>(IssueService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an issue successfully', async () => {
      const projectId = 1;
      const reporterId = 1;
      const createIssueDto = {
        title: 'Test Issue',
        description: 'Test Description',
        assigneeId: 2,
      };

      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 2 });
      mockPrismaService.issue.create.mockResolvedValue({
        id: 1,
        projectId,
        reporterId,
        assigneeId: 2,
        title: createIssueDto.title,
        description: createIssueDto.description,
        status: IssueStatus.OPEN,
        createdAt: new Date(),
        updatedAt: new Date(),
        reporter: { id: 1, email: 'reporter@test.com', nickname: 'Reporter' },
        assignee: { id: 2, email: 'assignee@test.com', nickname: 'Assignee' },
      });

      const result = await service.create(projectId, reporterId, createIssueDto);

      expect(result).toBeDefined();
      expect(result.title).toBe(createIssueDto.title);
      expect(mockPrismaService.issue.create).toHaveBeenCalledWith({
        data: {
          projectId,
          reporterId,
          title: createIssueDto.title,
          description: createIssueDto.description,
          assigneeId: createIssueDto.assigneeId,
        },
        include: {
          reporter: true,
          assignee: true,
        },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(999, 1, { title: 'Test', description: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return an issue when found', async () => {
      const issue = {
        id: 1,
        projectId: 1,
        reporterId: 1,
        assigneeId: null,
        title: 'Test Issue',
        description: 'Test Description',
        status: IssueStatus.OPEN,
        createdAt: new Date(),
        updatedAt: new Date(),
        reporter: { id: 1, email: 'test@test.com', nickname: 'Test' },
        assignee: null,
      };

      mockPrismaService.issue.findUnique.mockResolvedValue(issue);

      const result = await service.findById(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Issue');
    });

    it('should throw NotFoundException when issue does not exist', async () => {
      mockPrismaService.issue.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an issue successfully', async () => {
      const updateDto = {
        title: 'Updated Title',
        status: IssueStatus.IN_PROGRESS,
      };

      mockPrismaService.issue.findUnique.mockResolvedValue({
        id: 1,
        title: 'Original Title',
      });

      mockPrismaService.issue.update.mockResolvedValue({
        id: 1,
        projectId: 1,
        reporterId: 1,
        assigneeId: null,
        title: updateDto.title,
        description: 'Test',
        status: updateDto.status,
        createdAt: new Date(),
        updatedAt: new Date(),
        reporter: { id: 1, email: 'test@test.com', nickname: 'Test' },
        assignee: null,
      });

      const result = await service.update(1, updateDto);

      expect(result.title).toBe(updateDto.title);
      expect(result.status).toBe(updateDto.status);
    });
  });
});
