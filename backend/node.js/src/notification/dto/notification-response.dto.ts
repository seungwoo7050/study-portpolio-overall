import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class NotificationResponseDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  type: string;

  @Expose()
  message: string;

  @Expose()
  createdAt: Date;
}
