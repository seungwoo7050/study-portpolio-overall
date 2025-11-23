import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IssueStatus } from './create-issue.dto';

export class QueryIssuesDto {
  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  size?: number = 10;
}
