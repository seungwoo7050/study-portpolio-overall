import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { plainToInstance } from 'class-transformer';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    const order = await this.orderService.createOrder(
      req.user.userId,
      createOrderDto,
    );
    return plainToInstance(OrderResponseDto, order);
  }

  @Get()
  async findAll(@Request() req) {
    const orders = await this.orderService.findAllByUser(req.user.userId);
    return plainToInstance(OrderResponseDto, orders);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService.findOne(id, req.user.userId);
    return plainToInstance(OrderResponseDto, order);
  }

  @Patch(':id/pay')
  async markAsPaid(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService.updateOrderStatus(
      id,
      req.user.userId,
      'PAID',
    );
    return plainToInstance(OrderResponseDto, order);
  }

  @Patch(':id/cancel')
  async cancel(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService.updateOrderStatus(
      id,
      req.user.userId,
      'CANCELLED',
    );
    return plainToInstance(OrderResponseDto, order);
  }
}
