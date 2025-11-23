import { useQuery } from '@tanstack/react-query';
import { productApi } from './api';
import type { ProductSearchParams } from '../../shared/types/api';

export const useProductSearch = (params: ProductSearchParams) => {
  return useQuery({
    queryKey: ['products', 'search', params],
    queryFn: () => productApi.searchProducts(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useProduct = (productId: number) => {
  return useQuery({
    queryKey: ['products', productId],
    queryFn: () => productApi.getProduct(productId),
    enabled: !!productId,
  });
};
