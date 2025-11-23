import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ElasticsearchService, ProductDocument } from '../elasticsearch/elasticsearch.service';
import { CreateProductDto, UpdateProductDto, ProductResponseDto } from './dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.prisma.product.create({
      data: {
        name: createProductDto.name,
        description: createProductDto.description,
        category: createProductDto.category,
        brand: createProductDto.brand,
        price: createProductDto.price,
        status: createProductDto.status || 'ACTIVE',
      },
    });

    // Index product in Elasticsearch
    await this.indexProduct(product);

    return new ProductResponseDto(product);
  }

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product) => new ProductResponseDto(product));
  }

  async findOne(id: number): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return new ProductResponseDto(product);
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    // Check if product exists
    await this.findOne(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });

    // Update product in Elasticsearch
    await this.indexProduct(product);

    return new ProductResponseDto(product);
  }

  async remove(id: number): Promise<void> {
    // Check if product exists
    await this.findOne(id);

    await this.prisma.product.delete({
      where: { id },
    });

    // Delete product from Elasticsearch
    await this.elasticsearchService.deleteProduct(id);
  }

  private async indexProduct(product: any): Promise<void> {
    const document: ProductDocument = {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      price: product.price,
      status: product.status,
      created_at: product.createdAt,
    };

    await this.elasticsearchService.indexProduct(document);
  }

  async getAllProducts(): Promise<any[]> {
    return this.prisma.product.findMany();
  }
}
