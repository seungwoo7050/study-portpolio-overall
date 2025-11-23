import { Exclude, Expose, Type } from 'class-transformer';

export class UserInfoDto {
  @Expose()
  id: number;

  @Expose()
  email: string;

  @Expose()
  nickname: string;
}

export class TeamMemberDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  role: string;

  @Expose()
  joinedAt: Date;

  @Expose()
  @Type(() => UserInfoDto)
  user?: UserInfoDto;
}

export class TeamResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => TeamMemberDto)
  members?: TeamMemberDto[];
}
