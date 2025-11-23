import { IsInt, IsEnum } from 'class-validator';
import { TeamRole } from '../../common/enums/team-role.enum';

export class AddMemberDto {
  @IsInt()
  userId: number;

  @IsEnum(TeamRole)
  role: TeamRole;
}
