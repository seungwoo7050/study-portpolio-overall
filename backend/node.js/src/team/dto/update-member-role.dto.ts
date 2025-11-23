import { IsEnum } from 'class-validator';
import { TeamRole } from '../../common/enums/team-role.enum';

export class UpdateMemberRoleDto {
  @IsEnum(TeamRole)
  role: TeamRole;
}
