import { Module } from '@nestjs/common';
import { TeamController, WorkspaceItemController } from './team.controller';
import { TeamService } from './team.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TeamController, WorkspaceItemController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
