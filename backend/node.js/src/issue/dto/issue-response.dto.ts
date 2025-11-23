import { Exclude, Expose, Type } from 'class-transformer';
import { UserResponseDto } from '../../user/dto/user-response.dto';

@Exclude()
export class IssueResponseDto {
  @Expose()
  id: number;

  @Expose()
  projectId: number;

  @Expose()
  reporterId: number;

  @Expose()
  assigneeId: number | null;

  @Expose()
  title: string;

  @Expose()
  description: string | null;

  @Expose()
  status: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => UserResponseDto)
  reporter?: UserResponseDto;

  @Expose()
  @Type(() => UserResponseDto)
  assignee?: UserResponseDto;

  constructor(partial: Partial<IssueResponseDto>) {
    Object.assign(this, partial);
  }
}

export class PaginatedIssuesResponseDto {
  items: IssueResponseDto[];
  total: number;
  page: number;
  size: number;
  totalPages: number;

  constructor(items: IssueResponseDto[], total: number, page: number, size: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.size = size;
    this.totalPages = Math.ceil(total / size);
  }
}
