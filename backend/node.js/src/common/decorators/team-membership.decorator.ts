import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TeamMembership = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.teamMembership;
  },
);
