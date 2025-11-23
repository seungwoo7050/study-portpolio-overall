import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchProductsDto, SearchResultDto, ProductSearchResultDto } from './dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('products')
  async searchProducts(
    @Query() searchDto: SearchProductsDto,
  ): Promise<SearchResultDto<ProductSearchResultDto>> {
    return this.searchService.searchProducts(searchDto);
  }
}
