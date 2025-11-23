import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export interface ProductDocument {
  id: number;
  name: string;
  description?: string;
  category: string;
  brand: string;
  price: number;
  status: string;
  created_at: Date;
}

export interface SearchProductsParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  size?: number;
}

export interface SearchResult<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client;
  private readonly indexName = 'products';
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('ELASTICSEARCH_ENABLED') === 'true';

    if (this.enabled) {
      const node = this.configService.get<string>('ELASTICSEARCH_NODE');
      this.client = new Client({ node });
    }
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Elasticsearch is disabled');
      return;
    }

    try {
      await this.createIndexIfNotExists();
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch', error);
    }
  }

  private async createIndexIfNotExists() {
    if (!this.enabled) return;

    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          mappings: {
            properties: {
              id: { type: 'integer' },
              name: { type: 'text' },
              description: { type: 'text' },
              category: { type: 'keyword' },
              brand: { type: 'keyword' },
              price: { type: 'float' },
              status: { type: 'keyword' },
              created_at: { type: 'date' },
            },
          },
        } as any);
        this.logger.log(`Index '${this.indexName}' created`);
      }
    } catch (error) {
      this.logger.error('Failed to create index', error);
      throw error;
    }
  }

  async indexProduct(product: ProductDocument): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Skipping indexing - Elasticsearch is disabled');
      return;
    }

    try {
      await this.client.index({
        index: this.indexName,
        id: product.id.toString(),
        document: product as any,
        refresh: 'true' as any,
      });
      this.logger.debug(`Product ${product.id} indexed`);
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}`, error);
      // Don't throw - indexing failure shouldn't break the main flow
    }
  }

  async updateProduct(product: ProductDocument): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Skipping update - Elasticsearch is disabled');
      return;
    }

    try {
      await this.client.update({
        index: this.indexName,
        id: product.id.toString(),
        doc: product as any,
        refresh: 'true' as any,
      } as any);
      this.logger.debug(`Product ${product.id} updated in index`);
    } catch (error) {
      this.logger.error(`Failed to update product ${product.id}`, error);
    }
  }

  async deleteProduct(productId: number): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Skipping delete - Elasticsearch is disabled');
      return;
    }

    try {
      await this.client.delete({
        index: this.indexName,
        id: productId.toString(),
        refresh: 'true' as any,
      });
      this.logger.debug(`Product ${productId} deleted from index`);
    } catch (error) {
      this.logger.error(`Failed to delete product ${productId}`, error);
    }
  }

  async searchProducts(
    params: SearchProductsParams,
  ): Promise<SearchResult<ProductDocument>> {
    if (!this.enabled) {
      this.logger.warn('Search called but Elasticsearch is disabled');
      return { data: [], total: 0, page: params.page || 1, size: params.size || 10 };
    }

    const { q, category, brand, minPrice, maxPrice, page = 1, size = 10 } = params;

    const must: any[] = [];
    const filter: any[] = [];

    // Text search on name and description
    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['name^2', 'description'],
        },
      });
    }

    // Filter by category
    if (category) {
      filter.push({ term: { category } });
    }

    // Filter by brand
    if (brand) {
      filter.push({ term: { brand } });
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      const rangeQuery: any = {};
      if (minPrice !== undefined) rangeQuery.gte = minPrice;
      if (maxPrice !== undefined) rangeQuery.lte = maxPrice;
      filter.push({ range: { price: rangeQuery } });
    }

    // Only show ACTIVE products by default
    filter.push({ term: { status: 'ACTIVE' } });

    const from = (page - 1) * size;

    try {
      const result = await this.client.search({
        index: this.indexName,
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter,
          },
        },
        from,
        size,
        sort: [{ created_at: { order: 'desc' } }],
      } as any);

      const hits = result.hits.hits;
      const total = typeof result.hits.total === 'number'
        ? result.hits.total
        : result.hits.total?.value || 0;

      return {
        data: hits.map((hit: any) => hit._source),
        total,
        page,
        size,
      };
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  async reindexAll(products: ProductDocument[]): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('Reindex called but Elasticsearch is disabled');
      return;
    }

    try {
      // Delete existing index
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (exists) {
        await this.client.indices.delete({
          index: this.indexName,
        });
        this.logger.log(`Index '${this.indexName}' deleted for reindexing`);
      }

      // Recreate index
      await this.createIndexIfNotExists();

      // Bulk index all products
      if (products.length === 0) {
        this.logger.log('No products to reindex');
        return;
      }

      const operations = products.flatMap((product) => [
        { index: { _index: this.indexName, _id: product.id.toString() } },
        product,
      ]);

      await this.client.bulk({ operations: operations as any, refresh: 'true' as any } as any);
      this.logger.log(`Reindexed ${products.length} products`);
    } catch (error) {
      this.logger.error('Reindexing failed', error);
      throw error;
    }
  }
}
