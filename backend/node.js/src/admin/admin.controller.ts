import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('reindex/products')
  async reindexProducts(): Promise<{ message: string; count: number }> {
    return this.adminService.reindexProducts();
  }
}
