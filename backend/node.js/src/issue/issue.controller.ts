import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';
import { IssueResponseDto, PaginatedIssuesResponseDto } from './dto/issue-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class IssueController {
  constructor(private readonly issueService: IssueService) {}

  @Post('projects/:projectId/issues')
  async create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() createIssueDto: CreateIssueDto,
  ): Promise<IssueResponseDto> {
    return this.issueService.create(projectId, user.userId, createIssueDto);
  }

  @Get('projects/:projectId/issues')
  async findByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: QueryIssuesDto,
  ): Promise<PaginatedIssuesResponseDto> {
    return this.issueService.findByProject(projectId, query);
  }

  @Get('issues/popular')
  async findPopular(): Promise<IssueResponseDto[]> {
    return this.issueService.findPopular();
  }

  @Get('issues/:id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<IssueResponseDto> {
    return this.issueService.findById(id);
  }

  @Put('issues/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateIssueDto: UpdateIssueDto,
  ): Promise<IssueResponseDto> {
    return this.issueService.update(id, updateIssueDto);
  }

  @Delete('issues/:id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.issueService.delete(id);
    return { message: 'Issue deleted successfully' };
  }

}
