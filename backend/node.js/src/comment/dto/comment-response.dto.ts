import { Exclude, Expose, Type } from 'class-transformer';
import { UserResponseDto } from '../../user/dto/user-response.dto';

@Exclude()
export class CommentResponseDto {
  @Expose()
  id: number;

  @Expose()
  issueId: number;

  @Expose()
  authorId: number;

  @Expose()
  content: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => UserResponseDto)
  author?: UserResponseDto;

  constructor(partial: Partial<CommentResponseDto>) {
    Object.assign(this, partial);
  }
}
