import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { SearchProductsDto, SearchResultDto, ProductSearchResultDto } from './dto';

@Injectable()
export class SearchService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async searchProducts(
    searchDto: SearchProductsDto,
  ): Promise<SearchResultDto<ProductSearchResultDto>> {
    const result = await this.elasticsearchService.searchProducts({
      q: searchDto.q,
      category: searchDto.category,
      brand: searchDto.brand,
      minPrice: searchDto.minPrice,
      maxPrice: searchDto.maxPrice,
      page: searchDto.page || 1,
      size: searchDto.size || 10,
    });

    return new SearchResultDto(
      result.data,
      result.total,
      result.page,
      result.size,
    );
  }
}
