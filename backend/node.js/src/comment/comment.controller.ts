import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('issues/:issueId/comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  async create(
    @Param('issueId', ParseIntPipe) issueId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentService.create(issueId, user.userId, createCommentDto);
  }

  @Get()
  async findByIssue(
    @Param('issueId', ParseIntPipe) issueId: number,
  ): Promise<CommentResponseDto[]> {
    return this.commentService.findByIssue(issueId);
  }
}
