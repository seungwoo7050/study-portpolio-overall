import { Expose } from 'class-transformer';

export class WorkspaceItemResponseDto {
  @Expose()
  id: number;

  @Expose()
  teamId: number;

  @Expose()
  title: string;

  @Expose()
  content: string | null;

  @Expose()
  createdBy: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
