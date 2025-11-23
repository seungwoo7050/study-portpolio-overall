import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { NotFoundException } from '../common/exceptions/domain.exception';
import { UserResponseDto } from '../user/dto/user-response.dto';

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  async create(
    issueId: number,
    authorId: number,
    createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    // Verify issue exists
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException('Issue', issueId);
    }

    // Create comment
    const comment = await this.prisma.comment.create({
      data: {
        issueId,
        authorId,
        content: createCommentDto.content,
      },
      include: {
        author: true,
      },
    });

    return this.mapToResponse(comment);
  }

  async findByIssue(issueId: number): Promise<CommentResponseDto[]> {
    // Verify issue exists
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException('Issue', issueId);
    }

    const comments = await this.prisma.comment.findMany({
      where: { issueId },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map(comment => this.mapToResponse(comment));
  }

  private mapToResponse(comment: any): CommentResponseDto {
    return new CommentResponseDto({
      id: comment.id,
      issueId: comment.issueId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author ? new UserResponseDto(comment.author) : undefined,
    });
  }
}
