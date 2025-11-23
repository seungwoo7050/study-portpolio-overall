import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateWorkspaceItemDto } from './dto/create-workspace-item.dto';
import { UpdateWorkspaceItemDto } from './dto/update-workspace-item.dto';
import { TeamRole } from '../common/enums/team-role.enum';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  async createTeam(userId: number, createTeamDto: CreateTeamDto) {
    // Create team and add creator as OWNER in a transaction
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: createTeamDto.name,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: userId,
          role: TeamRole.OWNER,
        },
      });

      return team;
    });
  }

  async getMyTeams(userId: number) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return memberships.map((m) => m.team);
  }

  async getTeamById(teamId: number, userId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user is a member
    const isMember = team.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this team');
    }

    return team;
  }

  async getTeamMembers(teamId: number, userId: number) {
    // Verify user is a member of the team
    await this.verifyTeamMember(teamId, userId);

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return members;
  }

  async addMember(teamId: number, addMemberDto: AddMemberDto) {
    // Check if team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: addMemberDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is already a member
    const existingMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: addMemberDto.userId,
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this team');
    }

    // Add member
    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: addMemberDto.userId,
        role: addMemberDto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });
  }

  async updateMemberRole(teamId: number, memberId: number, updateRoleDto: UpdateMemberRoleDto) {
    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.teamId !== teamId) {
      throw new NotFoundException('Team member not found');
    }

    // Prevent changing the last OWNER's role
    if (member.role === TeamRole.OWNER && updateRoleDto.role !== TeamRole.OWNER) {
      const ownerCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: TeamRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot change the role of the last owner');
      }
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: {
        role: updateRoleDto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });
  }

  async removeMember(teamId: number, memberId: number) {
    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.teamId !== teamId) {
      throw new NotFoundException('Team member not found');
    }

    // Prevent removing the last OWNER
    if (member.role === TeamRole.OWNER) {
      const ownerCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: TeamRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    await this.prisma.teamMember.delete({
      where: { id: memberId },
    });

    return { message: 'Member removed successfully' };
  }

  async createWorkspaceItem(teamId: number, userId: number, createItemDto: CreateWorkspaceItemDto) {
    // Verify user is a member
    await this.verifyTeamMember(teamId, userId);

    return this.prisma.workspaceItem.create({
      data: {
        teamId,
        title: createItemDto.title,
        content: createItemDto.content,
        createdBy: userId,
      },
    });
  }

  async getWorkspaceItems(teamId: number, userId: number) {
    // Verify user is a member
    await this.verifyTeamMember(teamId, userId);

    return this.prisma.workspaceItem.findMany({
      where: { teamId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getWorkspaceItemById(itemId: number, userId: number) {
    const item = await this.prisma.workspaceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Workspace item not found');
    }

    // Verify user is a member of the team
    await this.verifyTeamMember(item.teamId, userId);

    return item;
  }

  async updateWorkspaceItem(itemId: number, userId: number, updateItemDto: UpdateWorkspaceItemDto) {
    const item = await this.prisma.workspaceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Workspace item not found');
    }

    // Verify user is a member of the team
    await this.verifyTeamMember(item.teamId, userId);

    return this.prisma.workspaceItem.update({
      where: { id: itemId },
      data: updateItemDto,
    });
  }

  async deleteWorkspaceItem(itemId: number, userId: number) {
    const item = await this.prisma.workspaceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Workspace item not found');
    }

    // Verify user is a member of the team
    await this.verifyTeamMember(item.teamId, userId);

    await this.prisma.workspaceItem.delete({
      where: { id: itemId },
    });

    return { message: 'Workspace item deleted successfully' };
  }

  private async verifyTeamMember(teamId: number, userId: number) {
    const member = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }

    return member;
  }
}
