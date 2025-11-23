import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { plainToInstance } from 'class-transformer';
import { NotificationResponseDto } from './dto/notification-response.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async findAll(@Request() req) {
    const notifications = await this.notificationService.findAllByUser(
      req.user.userId,
    );
    return plainToInstance(NotificationResponseDto, notifications);
  }
}
