import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExternalService, ExternalDataResponse } from './external.service';
import { Response } from 'express';

@Controller('external')
@UseGuards(JwtAuthGuard)
export class ExternalController {
  constructor(private readonly externalService: ExternalService) {}

  @Get('example')
  async getExampleData(): Promise<ExternalDataResponse[]> {
    return this.externalService.fetchExampleData();
  }

  @Get('posts/:id')
  @HttpCode(HttpStatus.OK)
  async getPostById(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const post = await this.externalService.fetchPostById(id);
    res.status(HttpStatus.OK).json(post);
  }
}
