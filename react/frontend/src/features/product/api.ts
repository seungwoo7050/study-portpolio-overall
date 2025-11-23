import apiClient from '../../shared/lib/apiClient';
import type {
  ProductDto,
  PaginatedResponse,
  ProductSearchParams,
} from '../../shared/types/api';

export const productApi = {
  searchProducts: async (
    params: ProductSearchParams
  ): Promise<PaginatedResponse<ProductDto>> => {
    const { data } = await apiClient.get<PaginatedResponse<ProductDto>>(
      '/search/products',
      { params }
    );
    return data;
  },

  getProduct: async (productId: number): Promise<ProductDto> => {
    const { data } = await apiClient.get<ProductDto>(`/products/${productId}`);
    return data;
  },
};
