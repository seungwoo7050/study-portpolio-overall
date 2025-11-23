import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ProductSearchResultDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  category: string;

  @Expose()
  brand: string;

  @Expose()
  price: number;

  @Expose()
  status: string;

  @Expose()
  created_at: Date;
}

export class SearchResultDto<T> {
  data: T[];
  total: number;
  page: number;
  size: number;

  constructor(data: T[], total: number, page: number, size: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.size = size;
  }
}
