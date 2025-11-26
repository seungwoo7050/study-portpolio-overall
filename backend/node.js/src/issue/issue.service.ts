import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';
import { IssueResponseDto, PaginatedIssuesResponseDto } from './dto/issue-response.dto';
import { NotFoundException } from '../common/exceptions/domain.exception';
import { UserResponseDto } from '../user/dto/user-response.dto';

@Injectable()
export class IssueService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(
    projectId: number,
    reporterId: number,
    createIssueDto: CreateIssueDto,
  ): Promise<IssueResponseDto> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project', projectId);
    }

    // Verify assignee exists if provided
    if (createIssueDto.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: createIssueDto.assigneeId },
      });

      if (!assignee) {
        throw new NotFoundException('User', createIssueDto.assigneeId);
      }
    }

    // Create issue with transaction
    const issue = await this.prisma.issue.create({
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

    return this.mapToResponse(issue);
  }

  async findByProject(
    projectId: number,
    query: QueryIssuesDto,
  ): Promise<PaginatedIssuesResponseDto> {
    const { status, page = 1, size = 10 } = query;
    const skip = (page - 1) * size;

    const where = {
      projectId,
      ...(status && { status }),
    };

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        include: {
          reporter: true,
          assignee: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.issue.count({ where }),
    ]);

    const items = issues.map(issue => this.mapToResponse(issue));
    return new PaginatedIssuesResponseDto(items, total, page, size);
  }

  async findById(id: number): Promise<IssueResponseDto> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        reporter: true,
        assignee: true,
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue', id);
    }

    return this.mapToResponse(issue);
  }

  async update(id: number, updateIssueDto: UpdateIssueDto): Promise<IssueResponseDto> {
    // Verify issue exists
    const existingIssue = await this.prisma.issue.findUnique({
      where: { id },
    });

    if (!existingIssue) {
      throw new NotFoundException('Issue', id);
    }

    // Verify assignee exists if provided
    if (updateIssueDto.assigneeId !== undefined && updateIssueDto.assigneeId !== null) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: updateIssueDto.assigneeId },
      });

      if (!assignee) {
        throw new NotFoundException('User', updateIssueDto.assigneeId);
      }
    }

    // Update issue
    const issue = await this.prisma.issue.update({
      where: { id },
      data: updateIssueDto,
      include: {
        reporter: true,
        assignee: true,
      },
    });

    return this.mapToResponse(issue);
  }

  async delete(id: number): Promise<void> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
    });

    if (!issue) {
      throw new NotFoundException('Issue', id);
    }

    await this.prisma.issue.delete({
      where: { id },
    });
  }

  /**
   * N2.3: Get popular issues with caching
   * Popular = highest (viewCount + commentCount) in last 7 days
   */
  async findPopular(): Promise<IssueResponseDto[]> {
    const cacheKey = 'popular_issues:v1';

    // Try to get from cache
    const cached = await this.cacheManager.get<IssueResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch popular issues from database
    // Since we need viewCount + commentCount, we'll do it in application layer
    const recentIssues = await this.prisma.issue.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      include: {
        reporter: true,
        assignee: true,
        comments: true,
      },
    });

    // Calculate popularity score and sort
    const issuesWithScore = recentIssues.map((issue) => ({
      issue,
      score: issue.viewCount + issue.comments.length,
    }));

    issuesWithScore.sort((a, b) => b.score - a.score);

    // Take top 10
    const popularIssues = issuesWithScore
      .slice(0, 10)
      .map((item) => this.mapToResponse(item.issue));

    // Cache for 5 minutes (300 seconds, already configured globally)
    await this.cacheManager.set(cacheKey, popularIssues, 300);

    return popularIssues;
  }

  /**
   * N2.3: Increment view count when issue is viewed
   */
  async incrementViewCount(id: number): Promise<void> {
    await this.prisma.issue.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  }

  private mapToResponse(issue: any): IssueResponseDto {
    return new IssueResponseDto({
      id: issue.id,
      projectId: issue.projectId,
      reporterId: issue.reporterId,
      assigneeId: issue.assigneeId,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      reporter: issue.reporter ? new UserResponseDto(issue.reporter) : undefined,
      assignee: issue.assignee ? new UserResponseDto(issue.assignee) : undefined,
    });
  }
}
