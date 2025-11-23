import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const teamIdRaw = this.extractTeamId(request);
    const teamId = teamIdRaw ? Number(teamIdRaw) : NaN;

    if (!teamIdRaw || Number.isNaN(teamId)) {
      // If no valid teamId in request, cannot verify role
      throw new ForbiddenException('Team ID required for this operation');
    }

    // Find team membership
    const membership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    // Check if user's role is in the required roles
    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    // Store membership in request for later use
    request.teamMembership = membership;

    return true;
  }

  private extractTeamId(request: any): string | null {
    // Try to get teamId from params, query, or body
    return request.params?.teamId || request.params?.id || request.body?.teamId || null;
  }
}
