import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ProjectResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  description: string | null;

  @Expose()
  createdAt: Date;

  constructor(partial: Partial<ProjectResponseDto>) {
    Object.assign(this, partial);
  }
}
