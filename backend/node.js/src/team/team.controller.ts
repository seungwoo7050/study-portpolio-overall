import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateWorkspaceItemDto } from './dto/create-workspace-item.dto';
import { UpdateWorkspaceItemDto } from './dto/update-workspace-item.dto';
import { TeamResponseDto, TeamMemberDto } from './dto/team-response.dto';
import { WorkspaceItemResponseDto } from './dto/workspace-item-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TeamRole } from '../common/enums/team-role.enum';
import { plainToInstance } from 'class-transformer';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  async createTeam(@CurrentUser() user: any, @Body() createTeamDto: CreateTeamDto) {
    const team = await this.teamService.createTeam(Number(user.userId), createTeamDto);
    return plainToInstance(TeamResponseDto, team, { excludeExtraneousValues: true });
  }

  @Get()
  async getMyTeams(@CurrentUser() user: any) {
    const teams = await this.teamService.getMyTeams(Number(user.userId));
    return teams.map((team) =>
      plainToInstance(TeamResponseDto, team, { excludeExtraneousValues: true }),
    );
  }

  @Get(':id')
  async getTeamById(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    const team = await this.teamService.getTeamById(id, Number(user.userId));
    return plainToInstance(TeamResponseDto, team, { excludeExtraneousValues: true });
  }

  @Get(':id/members')
  async getTeamMembers(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    const members = await this.teamService.getTeamMembers(id, Number(user.userId));
    return members.map((member) =>
      plainToInstance(TeamMemberDto, member, { excludeExtraneousValues: true }),
    );
  }

  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles(TeamRole.OWNER, TeamRole.MANAGER)
  async addMember(@Param('id', ParseIntPipe) id: number, @Body() addMemberDto: AddMemberDto) {
    const member = await this.teamService.addMember(id, addMemberDto);
    return plainToInstance(TeamMemberDto, member, { excludeExtraneousValues: true });
  }

  @Patch(':teamId/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles(TeamRole.OWNER, TeamRole.MANAGER)
  async updateMemberRole(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() updateRoleDto: UpdateMemberRoleDto,
  ) {
    const member = await this.teamService.updateMemberRole(teamId, memberId, updateRoleDto);
    return plainToInstance(TeamMemberDto, member, { excludeExtraneousValues: true });
  }

  @Delete(':teamId/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles(TeamRole.OWNER, TeamRole.MANAGER)
  async removeMember(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.teamService.removeMember(teamId, memberId);
  }

  @Post(':teamId/items')
  async createWorkspaceItem(
    @Param('teamId', ParseIntPipe) teamId: number,
    @CurrentUser() user: any,
    @Body() createItemDto: CreateWorkspaceItemDto,
  ) {
    const item = await this.teamService.createWorkspaceItem(teamId, Number(user.userId), createItemDto);
    return plainToInstance(WorkspaceItemResponseDto, item, { excludeExtraneousValues: true });
  }

  @Get(':teamId/items')
  async getWorkspaceItems(@Param('teamId', ParseIntPipe) teamId: number, @CurrentUser() user: any) {
    const items = await this.teamService.getWorkspaceItems(teamId, Number(user.userId));
    return items.map((item) =>
      plainToInstance(WorkspaceItemResponseDto, item, { excludeExtraneousValues: true }),
    );
  }
}

@Controller('items')
@UseGuards(JwtAuthGuard)
export class WorkspaceItemController {
  constructor(private readonly teamService: TeamService) {}

  @Get(':id')
  async getWorkspaceItemById(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    const item = await this.teamService.getWorkspaceItemById(id, Number(user.userId));
    return plainToInstance(WorkspaceItemResponseDto, item, { excludeExtraneousValues: true });
  }

  @Put(':id')
  async updateWorkspaceItem(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() updateItemDto: UpdateWorkspaceItemDto,
  ) {
    const item = await this.teamService.updateWorkspaceItem(id, Number(user.userId), updateItemDto);
    return plainToInstance(WorkspaceItemResponseDto, item, { excludeExtraneousValues: true });
  }

  @Delete(':id')
  async deleteWorkspaceItem(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.teamService.deleteWorkspaceItem(id, Number(user.userId));
  }
}
