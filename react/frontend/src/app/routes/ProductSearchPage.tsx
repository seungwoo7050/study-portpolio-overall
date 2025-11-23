import { useMemo, useCallback } from 'react';
import { useProductSearch } from '../../features/product/hooks';
import { useQueryParams } from '../../shared/hooks/useQueryParams';
import { Table, type TableColumn } from '../../shared/components/Table';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';
import type { ProductDto, ProductSearchParams } from '../../shared/types/api';

export function ProductSearchPage() {
  const [queryParams, setQueryParams] = useQueryParams<ProductSearchParams>();

  // Extract search parameters with defaults
  const searchParams = useMemo<ProductSearchParams>(
    () => ({
      q: queryParams.q || '',
      category: queryParams.category || '',
      brand: queryParams.brand || '',
      minPrice: queryParams.minPrice,
      maxPrice: queryParams.maxPrice,
      page: queryParams.page || 1,
      size: queryParams.size || 20,
    }),
    [queryParams]
  );

  const { data, isLoading, error } = useProductSearch(searchParams);

  // Memoized table columns to prevent re-creation on every render
  const columns = useMemo<TableColumn<ProductDto>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (product) => (
          <div className="font-medium">{product.name}</div>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        render: (product) => (
          <div className="max-w-xs truncate">{product.description}</div>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        render: (product) => (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
            {product.category}
          </span>
        ),
      },
      {
        key: 'brand',
        header: 'Brand',
        render: (product) => product.brand,
      },
      {
        key: 'price',
        header: 'Price',
        render: (product) => `$${product.price.toFixed(2)}`,
        width: '120px',
      },
      {
        key: 'status',
        header: 'Status',
        render: (product) => (
          <span
            className={`px-2 py-1 rounded text-xs ${
              product.status === 'ACTIVE'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {product.status}
          </span>
        ),
        width: '100px',
      },
    ],
    []
  );

  // Memoized key extractor function
  const keyExtractor = useCallback((product: ProductDto) => product.id, []);

  // Handler functions with useCallback for optimization
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQueryParams({ q: e.target.value, page: 1 });
    },
    [setQueryParams]
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQueryParams({ category: e.target.value, page: 1 });
    },
    [setQueryParams]
  );

  const handleBrandChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQueryParams({ brand: e.target.value, page: 1 });
    },
    [setQueryParams]
  );

  const handleMinPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value ? Number(e.target.value) : undefined;
      setQueryParams({ minPrice: value, page: 1 });
    },
    [setQueryParams]
  );

  const handleMaxPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value ? Number(e.target.value) : undefined;
      setQueryParams({ maxPrice: value, page: 1 });
    },
    [setQueryParams]
  );

  const handleClearFilters = useCallback(() => {
    setQueryParams({
      q: '',
      category: '',
      brand: '',
      minPrice: undefined,
      maxPrice: undefined,
      page: 1,
    });
  }, [setQueryParams]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setQueryParams({ page: newPage });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setQueryParams]
  );

  // Calculate pagination info
  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.totalCount / (searchParams.size || 20));
  }, [data, searchParams.size]);

  const currentPage = searchParams.page || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Product Search</h1>
        <p className="mt-2 text-gray-600">
          Search and filter products with advanced criteria
        </p>
      </div>

      {/* Filters Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Search
            </label>
            <input
              id="search"
              type="text"
              value={searchParams.q}
              onChange={handleSearchChange}
              placeholder="Search products..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Category
            </label>
            <input
              id="category"
              type="text"
              value={searchParams.category}
              onChange={handleCategoryChange}
              placeholder="Filter by category..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="brand"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Brand
            </label>
            <input
              id="brand"
              type="text"
              value={searchParams.brand}
              onChange={handleBrandChange}
              placeholder="Filter by brand..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="minPrice"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Min Price
            </label>
            <input
              id="minPrice"
              type="number"
              min="0"
              step="0.01"
              value={searchParams.minPrice ?? ''}
              onChange={handleMinPriceChange}
              placeholder="Min price..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="maxPrice"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Max Price
            </label>
            <input
              id="maxPrice"
              type="number"
              min="0"
              step="0.01"
              value={searchParams.maxPrice ?? ''}
              onChange={handleMaxPriceChange}
              placeholder="Max price..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleClearFilters}
              variant="secondary"
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <QueryStateHandler
          isLoading={isLoading}
          isError={!!error}
          error={error as Error | null}
          data={data}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="No products found matching your criteria."
        >
          {(data) => (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Results ({data.totalCount} products)
                </h2>
              </div>

              <Table
                columns={columns}
                data={data.items}
                keyExtractor={keyExtractor}
                emptyMessage="No products found"
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      variant="secondary"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      variant="secondary"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </QueryStateHandler>
      </div>
    </div>
  );
}
