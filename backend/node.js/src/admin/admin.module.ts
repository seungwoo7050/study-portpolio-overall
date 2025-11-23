import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ProductModule } from '../product/product.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [ProductModule, ElasticsearchModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
