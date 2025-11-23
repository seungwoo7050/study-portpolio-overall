import { IsDateString, IsOptional } from 'class-validator';

export class GetDailyStatsDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}

export class DailyStatsResponseDto {
  date: string;
  createdCount: number;
  resolvedCount: number;
  commentCount: number;

  constructor(partial: Partial<DailyStatsResponseDto>) {
    Object.assign(this, partial);
  }
}
