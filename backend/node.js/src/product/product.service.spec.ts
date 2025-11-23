import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CreateProductDto, UpdateProductDto, ProductStatus } from './dto';

describe('ProductService', () => {
  let service: ProductService;
  let prismaService: PrismaService;
  let elasticsearchService: ElasticsearchService;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    description: 'Test Description',
    category: 'Electronics',
    brand: 'TestBrand',
    price: 99.99,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockElasticsearchService = {
    indexProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    prismaService = module.get<PrismaService>(PrismaService);
    elasticsearchService = module.get<ElasticsearchService>(ElasticsearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product and index it in Elasticsearch', async () => {
      const createDto: CreateProductDto = {
        name: 'Test Product',
        description: 'Test Description',
        category: 'Electronics',
        brand: 'TestBrand',
        price: 99.99,
        status: ProductStatus.ACTIVE,
      };

      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createDto);

      expect(prismaService.product.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          description: createDto.description,
          category: createDto.category,
          brand: createDto.brand,
          price: createDto.price,
          status: createDto.status || 'ACTIVE',
        },
      });
      expect(elasticsearchService.indexProduct).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe(mockProduct.id);
    });
  });

  describe('findAll', () => {
    it('should return an array of products', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAll();

      expect(prismaService.product.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProduct.id);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne(1);

      expect(prismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.id).toBe(mockProduct.id);
    });

    it('should throw NotFoundException when product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a product and reindex it in Elasticsearch', async () => {
      const updateDto: UpdateProductDto = {
        name: 'Updated Product',
        price: 149.99,
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue({
        ...mockProduct,
        ...updateDto,
      });

      const result = await service.update(1, updateDto);

      expect(prismaService.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateDto,
      });
      expect(elasticsearchService.indexProduct).toHaveBeenCalled();
      expect(result.name).toBe('Updated Product');
    });

    it('should throw NotFoundException when product to update not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a product and remove it from Elasticsearch', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      await service.remove(1);

      expect(prismaService.product.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(elasticsearchService.deleteProduct).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when product to delete not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
