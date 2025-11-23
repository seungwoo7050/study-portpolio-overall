# Milestone 5 – 검색/필터 UI + 성능 기초 설계 일지
> 상품 검색 시스템, URL 쿼리스트링 동기화, 성능 최적화 (코드 스플리팅, 메모이제이션) 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

복잡한 검색/필터 UI 구현 및 성능 최적화:
- Elasticsearch 기반 상품 검색 (다중 필터)
- URL 쿼리스트링과 상태 동기화
- React.memo, useMemo, useCallback 활용
- 코드 스플리팅 (React.lazy + Suspense)
- 재사용 가능한 Table 컴포넌트

### 1.2 기능 요구사항

#### 1.2.1 대상 API

**상품 검색 API**:
- `GET /api/search/products?q=&category=&brand=&minPrice=&maxPrice=&page=&size=`
- 쿼리 파라미터:
  - `q`: 검색어 (name/description 대상)
  - `category`: 카테고리 필터
  - `brand`: 브랜드 필터
  - `minPrice`, `maxPrice`: 가격 범위
  - `page`, `size`: 페이지네이션
- 응답: `{ items: ProductDto[], totalCount: number }`

**상품 상세 API**:
- `GET /api/products/{productId}`
- 응답: `ProductDto`

#### 1.2.2 구현 화면

**ProductSearchPage** (`/products`):
- 검색 입력란 (debounce 500ms)
- 카테고리 드롭다운 (Electronics, Clothing, Food 등)
- 브랜드 드롭다운
- 가격 범위 입력 (minPrice, maxPrice)
- 검색 결과 테이블:
  - 컬럼: Name, Category, Brand, Price, Status
  - 행 클릭 시 상세 모달
- 페이지네이션
- "Clear Filters" 버튼

#### 1.2.3 URL 쿼리스트링 동기화

**요구사항**:
- 필터 변경 시 URL 자동 업데이트
  - 예: `/products?q=laptop&category=Electronics&page=2`
- 브라우저 뒤로가기/앞으로가기 시 필터 복원
- URL 공유 시 동일한 검색 결과 표시

**useQueryParams 훅**:
```tsx
const [params, updateParams] = useQueryParams<{
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}>();

// 사용 예시
updateParams({ q: 'laptop', page: 1 });
```

### 1.3 비기능 요구사항

#### 1.3.1 성능
- **검색 debounce**: 500ms (연속 입력 시 API 호출 최소화)
- **코드 스플리팅**: ProductSearchPage lazy loading
- **메모이제이션**:
  - 테이블 행 컴포넌트: React.memo
  - 필터링 로직: useMemo
  - 콜백 함수: useCallback

#### 1.3.2 사용자 경험
- **로딩 인디케이터**: 검색 중 스피너 표시
- **빈 결과**: "No products found. Try different filters."
- **필터 초기화**: "Clear Filters" 버튼 원클릭

#### 1.3.3 코드 품질
- **재사용 가능한 Table 컴포넌트**: 제네릭 타입 지원
- **타입 안정성**: ProductSearchParams, ProductDto
- **테스트**: useQueryParams 훅 테스트

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 URL 쿼리스트링 동기화인가?

**장점**:
- **공유 가능**: URL만으로 검색 결과 공유
- **북마크**: 자주 쓰는 필터 조합 저장
- **뒤로가기**: 브라우저 네비게이션 동작
- **SEO**: 검색 엔진 크롤링 가능 (공개 검색 시)

**구현 방식**:
- `react-router-dom`의 `useSearchParams`
- 쿼리 변경 시 `setSearchParams` 호출
- 쿼리 읽을 때 `searchParams.get()`

### 2.2 왜 Debounce인가?

**문제점 (debounce 없이)**:
```text
사용자 입력: "laptop"
- 'l' → API 호출
- 'la' → API 호출
- 'lap' → API 호출
- 'lapt' → API 호출
- 'lapto' → API 호출
- 'laptop' → API 호출
총 6번 API 호출
```

**Debounce 적용 후**:
```text
사용자 입력: "laptop" (500ms 대기)
- 'laptop' → API 호출 1회
```

**구현**:
```tsx
const [searchQuery, setSearchQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 500);

  return () => clearTimeout(timer);
}, [searchQuery]);

// debouncedQuery를 useQuery의 queryKey에 사용
```

### 2.3 코드 스플리팅 전략

**번들 크기 문제**:
- 모든 페이지를 하나의 JS 파일로 번들링
- 초기 로드 시간 증가
- 사용하지 않는 페이지 코드도 다운로드

**코드 스플리팅 솔루션**:
```tsx
// Before
import { ProductSearchPage } from './ProductSearchPage';

// After
const ProductSearchPage = lazy(() => import('./ProductSearchPage'));

<Route path="/products" element={
  <Suspense fallback={<LoadingSpinner />}>
    <ProductSearchPage />
  </Suspense>
} />
```

**결과**:
- `/products` 접근 시에만 ProductSearchPage.js 다운로드
- 초기 번들 크기 감소 (~50KB)

### 2.4 React.memo vs useMemo vs useCallback

| 항목 | React.memo | useMemo | useCallback |
|------|------------|---------|-------------|
| 용도 | 컴포넌트 재렌더링 방지 | 계산 결과 캐싱 | 함수 참조 캐싱 |
| 반환 | 컴포넌트 | 값 | 함수 |
| 예시 | `React.memo(TableRow)` | `useMemo(() => expensiveCalc(), [deps])` | `useCallback(() => {}, [deps])` |

**사용 시나리오**:
- **React.memo**: 테이블 행 (props 변경 없으면 리렌더링 안 함)
- **useMemo**: 필터링된 데이터 (filterData 함수 결과 캐싱)
- **useCallback**: 이벤트 핸들러 (자식 컴포넌트에 전달)

---

## 3. 레이어별 상세 설계

### 3.1 상품 API 레이어 (features/product/api.ts)

```ts
import apiClient from '../../shared/lib/apiClient';
import type { ProductDto, PaginatedResponse, ProductSearchParams } from '../../shared/types/api';

export const productApi = {
  searchProducts: async (params: ProductSearchParams): Promise<PaginatedResponse<ProductDto>> => {
    const response = await apiClient.get('/search/products', { params });
    return response.data;
  },

  getProduct: async (productId: number): Promise<ProductDto> => {
    const response = await apiClient.get(`/products/${productId}`);
    return response.data;
  },
};
```

### 3.2 상품 검색 훅 (features/product/hooks.ts)

```ts
import { useQuery } from '@tanstack/react-query';
import { productApi } from './api';
import type { ProductSearchParams } from '../../shared/types/api';

export const useProductSearch = (params: ProductSearchParams) => {
  return useQuery({
    queryKey: ['products', 'search', params],
    queryFn: () => productApi.searchProducts(params),
    staleTime: 5 * 60 * 1000, // 5분
  });
};

export const useProduct = (productId: number) => {
  return useQuery({
    queryKey: ['products', productId],
    queryFn: () => productApi.getProduct(productId),
    enabled: !!productId,
  });
};
```

### 3.3 useQueryParams 훅 (shared/hooks/useQueryParams.ts)

```ts
import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

export function useQueryParams<T extends object = Record<string, string | number>>(): [
  T,
  (updates: Partial<T>) => void
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const result: Record<string, string | number> = {};
    searchParams.forEach((value, key) => {
      // 숫자로 파싱 시도
      if (!isNaN(Number(value))) {
        result[key] = Number(value);
      } else {
        result[key] = value;
      }
    });
    return result as T;
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: Partial<T>) => {
      const newParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          newParams.delete(key); // 빈 값은 제거
        } else {
          newParams.set(key, String(value));
        }
      });

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  return [params, updateParams];
}
```

### 3.4 Table 컴포넌트 (shared/components/Table.tsx)

```tsx
import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string | number;
}

export function Table<T>({ data, columns, onRowClick, keyExtractor }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
            >
              {columns.map((column) => (
                <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3.5 ProductSearchPage

```tsx
import { useState, useEffect } from 'react';
import { useProductSearch } from '../../features/product/hooks';
import { useQueryParams } from '../../shared/hooks/useQueryParams';
import { Table } from '../../shared/components/Table';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';
import type { ProductDto, ProductSearchParams } from '../../shared/types/api';

export function ProductSearchPage() {
  const [params, updateParams] = useQueryParams<ProductSearchParams>();

  // Debounced search
  const [searchQuery, setSearchQuery] = useState(params.q || '');
  const [debouncedQuery, setDebouncedQuery] = useState(params.q || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      updateParams({ q: searchQuery, page: 1 });
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchParams: ProductSearchParams = {
    q: debouncedQuery,
    category: params.category,
    brand: params.brand,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    page: params.page || 1,
    size: params.size || 20,
  };

  const { data, isLoading, isError, error } = useProductSearch(searchParams);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    updateParams({ q: undefined, category: undefined, brand: undefined, minPrice: undefined, maxPrice: undefined, page: 1 });
  };

  const columns = [
    { key: 'name', header: 'Name', render: (product: ProductDto) => product.name },
    { key: 'category', header: 'Category', render: (product: ProductDto) => product.category },
    { key: 'brand', header: 'Brand', render: (product: ProductDto) => product.brand },
    {
      key: 'price',
      header: 'Price',
      render: (product: ProductDto) => `$${product.price.toFixed(2)}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (product: ProductDto) => (
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {product.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Product Search</h1>

      {/* 필터 섹션 */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 검색어 */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              value={params.category || ''}
              onChange={(e) => updateParams({ category: e.target.value, page: 1 })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            >
              <option value="">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Clothing">Clothing</option>
              <option value="Food">Food</option>
            </select>
          </div>

          {/* 브랜드 */}
          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
              Brand
            </label>
            <select
              id="brand"
              value={params.brand || ''}
              onChange={(e) => updateParams({ brand: e.target.value, page: 1 })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            >
              <option value="">All Brands</option>
              <option value="BrandA">Brand A</option>
              <option value="BrandB">Brand B</option>
            </select>
          </div>

          {/* Clear 버튼 */}
          <div className="flex items-end">
            <Button onClick={handleClearFilters} variant="outline" className="w-full">
              Clear Filters
            </Button>
          </div>
        </div>

        {/* 가격 범위 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="minPrice" className="block text-sm font-medium text-gray-700 mb-1">
              Min Price
            </label>
            <input
              id="minPrice"
              type="number"
              value={params.minPrice || ''}
              onChange={(e) => updateParams({ minPrice: Number(e.target.value), page: 1 })}
              placeholder="0"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            />
          </div>
          <div>
            <label htmlFor="maxPrice" className="block text-sm font-medium text-gray-700 mb-1">
              Max Price
            </label>
            <input
              id="maxPrice"
              type="number"
              value={params.maxPrice || ''}
              onChange={(e) => updateParams({ maxPrice: Number(e.target.value), page: 1 })}
              placeholder="10000"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            />
          </div>
        </div>
      </div>

      {/* 검색 결과 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <QueryStateHandler
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          isEmpty={(data) => data.items.length === 0}
          emptyMessage="No products found. Try different filters."
        >
          {(products) => (
            <>
              <Table
                data={products.items}
                columns={columns}
                keyExtractor={(product) => product.id}
                onRowClick={(product) => alert(`Product: ${product.name}`)}
              />

              {/* 페이지네이션 */}
              <div className="flex justify-between items-center px-6 py-4 border-t">
                <div className="text-sm text-gray-700">
                  Total: {products.totalCount} products
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={(params.page || 1) === 1}
                    onClick={() => updateParams({ page: (params.page || 1) - 1 })}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-1 text-sm">Page {params.page || 1}</span>
                  <Button
                    disabled={products.items.length < (params.size || 20)}
                    onClick={() => updateParams({ page: (params.page || 1) + 1 })}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </QueryStateHandler>
      </div>
    </div>
  );
}
```

---

## 4. 성능 최적화

### 4.1 코드 스플리팅 (App.tsx)

```tsx
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './shared/components/LoadingSpinner';

const ProductSearchPage = lazy(() =>
  import('./app/routes/ProductSearchPage').then((module) => ({
    default: module.ProductSearchPage,
  }))
);

function App() {
  return (
    <Routes>
      <Route
        path="/products"
        element={
          <RequireAuth>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <ProductSearchPage />
              </Suspense>
            </MainLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
```

**효과**:
- `/products` 접근 전까지 ProductSearchPage.js 다운로드 안 함
- 초기 로드 시간 감소

### 4.2 React.memo (TableRow 컴포넌트)

```tsx
import { memo } from 'react';
import type { ProductDto } from '../../shared/types/api';

interface TableRowProps {
  product: ProductDto;
  onClick: (product: ProductDto) => void;
}

export const TableRow = memo(function TableRow({ product, onClick }: TableRowProps) {
  return (
    <tr onClick={() => onClick(product)} className="cursor-pointer hover:bg-gray-50">
      <td className="px-6 py-4">{product.name}</td>
      <td className="px-6 py-4">{product.category}</td>
      <td className="px-6 py-4">{product.brand}</td>
      <td className="px-6 py-4">${product.price.toFixed(2)}</td>
      <td className="px-6 py-4">{product.status}</td>
    </tr>
  );
});
```

**효과**:
- props 변경 없으면 재렌더링 안 함
- 큰 테이블에서 성능 향상

### 4.3 useMemo (필터링 로직)

```tsx
const filteredProducts = useMemo(() => {
  return data?.items.filter((product) => {
    if (params.minPrice && product.price < params.minPrice) return false;
    if (params.maxPrice && product.price > params.maxPrice) return false;
    return true;
  }) || [];
}, [data, params.minPrice, params.maxPrice]);
```

### 4.4 useCallback (이벤트 핸들러)

```tsx
const handleRowClick = useCallback((product: ProductDto) => {
  setSelectedProduct(product);
  setShowModal(true);
}, []);

<Table
  data={products}
  onRowClick={handleRowClick}  // 함수 참조가 변경 안 되므로 TableRow 재렌더링 방지
/>
```

---

## 5. 알려진 제약 & 향후 개선점

### 5.1 현재 제약

1. **Debounce 라이브러리 미사용**:
   - 직접 구현으로 코드 복잡
   - 개선: `use-debounce` 라이브러리

2. **가상 스크롤 미구현**:
   - 수천 개 행 렌더링 시 성능 저하
   - 개선: `react-window` 또는 `react-virtual`

3. **필터 저장 기능 없음**:
   - 자주 쓰는 필터 조합 저장 불가
   - 개선: localStorage에 presets 저장

### 5.2 향후 개선점

**Milestone 6**:
- E2E 테스트 (검색 → 필터 → 페이지네이션)
- 성능 프로파일링 (React DevTools Profiler)

---

## 6. 체크리스트 (Milestone 5 완료 기준)

- [x] productApi 구현 (searchProducts, getProduct)
- [x] useProductSearch, useProduct 훅
- [x] useQueryParams 훅 (URL 쿼리스트링 동기화)
- [x] Table 제네릭 컴포넌트
- [x] ProductSearchPage (검색, 필터, 페이지네이션)
- [x] Debounce 구현 (500ms)
- [x] 코드 스플리팅 (ProductSearchPage lazy loading)
- [x] React.memo 적용 (TableRow)
- [x] useMemo, useCallback 활용
- [x] Clear Filters 기능
- [x] URL 쿼리스트링 동기화 (뒤로가기/앞으로가기 대응)

---

**이 설계를 기반으로 Milestone 6에서 종합 테스트 전략 및 접근성을 구축합니다.**
