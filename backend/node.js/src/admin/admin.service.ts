import { Injectable, Logger } from '@nestjs/common';
import { ProductService } from '../product/product.service';
import { ElasticsearchService, ProductDocument } from '../elasticsearch/elasticsearch.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly productService: ProductService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async reindexProducts(): Promise<{ message: string; count: number }> {
    this.logger.log('Starting product reindexing...');

    // Get all products from database
    const products = await this.productService.getAllProducts();

    // Convert to Elasticsearch documents
    const documents: ProductDocument[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      price: product.price,
      status: product.status,
      created_at: product.createdAt,
    }));

    // Reindex all products
    await this.elasticsearchService.reindexAll(documents);

    this.logger.log(`Reindexed ${documents.length} products`);

    return {
      message: 'Products reindexed successfully',
      count: documents.length,
    };
  }
}
