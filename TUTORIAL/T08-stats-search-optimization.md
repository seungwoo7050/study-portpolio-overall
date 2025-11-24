# T08: 통계/검색 + URL 동기화 + 성능 최적화

> **목표**: React 고급 패턴과 성능 최적화로 프로덕션 수준 UI 구현
> **예상 시간**: 15-20시간
> **난이도**: 🟠 고급
> **선행 요구사항**: [T06: React/Vite 기본](./T06-react-vite-basics.md), [T07: React Query + Forms](./T07-react-query-forms.md)
> **적용 프로젝트**: React Milestone M4 (통계 대시보드), M5 (상품 검색 페이지)

---

## 목차

1. [차트 시각화](#1-차트-시각화)
2. [통계 API 연동](#2-통계-api-연동)
3. [검색 UI 구현](#3-검색-ui-구현)
4. [URL 상태 동기화](#4-url-상태-동기화)
5. [React.memo 최적화](#5-reactmemo-최적화)
6. [useMemo/useCallback](#6-usememousecallback)
7. [가상화 (Virtualization)](#7-가상화-virtualization)
8. [성능 측정](#8-성능-측정)
9. [트러블슈팅](#9-트러블슈팅)
10. [프로젝트 적용](#10-프로젝트-적용)

---

## 1. 차트 시각화

### 1.1 라이브러리 선택

**Recharts** (추천):
- React 네이티브, 선언적 API
- TypeScript 지원 우수
- 반응형 차트 기본 제공

**Chart.js + react-chartjs-2** (대안):
- 더 많은 차트 타입
- 커스터마이징 유연
- 번들 크기 작음

```bash
# Recharts
npm install recharts

# Chart.js
npm install chart.js react-chartjs-2
```

### 1.2 Line Chart (시계열 데이터)

```tsx
// components/charts/RevenueChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DataPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface RevenueChartProps {
  data: DataPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `$${value / 1000}k`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === 'revenue') return `$${value.toLocaleString()}`;
            return value;
          }}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#8884d8"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#82ca9d"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### 1.3 Bar Chart (카테고리별 비교)

```tsx
// components/charts/CategoryChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CategoryData {
  category: string;
  sales: number;
  profit: number;
}

interface CategoryChartProps {
  data: CategoryData[];
}

export function CategoryChart({ data }: CategoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" />
        <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
        <Tooltip
          formatter={(value: number) => `$${value.toLocaleString()}`}
        />
        <Legend />
        <Bar dataKey="sales" fill="#8884d8" />
        <Bar dataKey="profit" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 1.4 Pie Chart (비율 시각화)

```tsx
// components/charts/StatusPieChart.tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StatusData {
  name: string;
  value: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

interface StatusPieChartProps {
  data: StatusData[];
}

export function StatusPieChart({ data }: StatusPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => value.toLocaleString()} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

---

## 2. 통계 API 연동

### 2.1 통계 데이터 타입

```tsx
// types/stats.ts
export interface DailyStat {
  date: string;
  revenue: number;
  orders: number;
  users: number;
}

export interface CategoryStat {
  category: string;
  sales: number;
  profit: number;
  margin: number;
}

export interface OrderStatusStat {
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  count: number;
}

export interface DashboardStats {
  daily: DailyStat[];
  categories: CategoryStat[];
  orderStatus: OrderStatusStat[];
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    conversionRate: number;
  };
}

export interface StatsQueryParams {
  startDate: string;
  endDate: string;
  granularity?: 'day' | 'week' | 'month';
}
```

### 2.2 React Query로 통계 조회

```tsx
// hooks/useStats.ts
import { useQuery } from '@tanstack/react-query';
import { DashboardStats, StatsQueryParams } from '@/types/stats';
import { api } from '@/lib/api';

export function useStats(params: StatsQueryParams) {
  return useQuery({
    queryKey: ['stats', params],
    queryFn: async () => {
      const response = await api.get<DashboardStats>('/api/stats/dashboard', {
        params,
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}

export function useCategoryStats(dateRange: { start: string; end: string }) {
  return useQuery({
    queryKey: ['stats', 'categories', dateRange],
    queryFn: async () => {
      const response = await api.get('/api/stats/categories', {
        params: dateRange,
      });
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}
```

### 2.3 통계 대시보드 컴포넌트

```tsx
// pages/Dashboard.tsx
import { useState } from 'react';
import { useStats } from '@/hooks/useStats';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { CategoryChart } from '@/components/charts/CategoryChart';
import { StatusPieChart } from '@/components/charts/StatusPieChart';
import { DateRangePicker } from '@/components/DateRangePicker';

export function Dashboard() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data, isLoading, error } = useStats(dateRange);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        데이터를 불러오는 중 오류가 발생했습니다.
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="총 매출"
          value={`$${data.summary.totalRevenue.toLocaleString()}`}
          trend={+12.5}
        />
        <StatCard
          title="주문 수"
          value={data.summary.totalOrders.toLocaleString()}
          trend={+8.2}
        />
        <StatCard
          title="평균 주문 금액"
          value={`$${data.summary.averageOrderValue.toFixed(2)}`}
          trend={+3.1}
        />
        <StatCard
          title="전환율"
          value={`${(data.summary.conversionRate * 100).toFixed(1)}%`}
          trend={-1.4}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">매출 추이</h2>
          <RevenueChart data={data.daily} />
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">카테고리별 판매</h2>
          <CategoryChart data={data.categories} />
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">주문 상태</h2>
          <StatusPieChart
            data={data.orderStatus.map(s => ({ name: s.status, value: s.count }))}
          />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  trend: number;
}

function StatCard({ title, value, trend }: StatCardProps) {
  const isPositive = trend > 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <p className="text-sm text-gray-600">{title}</p>
      <div className="flex items-baseline justify-between mt-2">
        <p className="text-2xl font-semibold">{value}</p>
        <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      </div>
    </div>
  );
}
```

---

## 3. 검색 UI 구현

### 3.1 검색 입력 디바운싱

```tsx
// hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### 3.2 검색 API 연동

```tsx
// hooks/useProductSearch.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ProductSearchParams {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  inStock: boolean;
}

export interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export function useProductSearch(params: ProductSearchParams) {
  return useQuery({
    queryKey: ['products', 'search', params],
    queryFn: async () => {
      const response = await api.get<SearchResult>('/api/products/search', {
        params,
      });
      return response.data;
    },
    enabled: params.query.length >= 2, // 최소 2글자 이상
    staleTime: 2 * 60 * 1000, // 2분
  });
}
```

### 3.3 검색 페이지 구현

```tsx
// pages/ProductSearch.tsx
import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useProductSearch, ProductSearchParams } from '@/hooks/useProductSearch';
import { ProductCard } from '@/components/ProductCard';
import { SearchFilters } from '@/components/SearchFilters';
import { Pagination } from '@/components/Pagination';

export function ProductSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Omit<ProductSearchParams, 'query'>>({
    sortBy: 'relevance',
    page: 1,
    limit: 20,
  });

  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data, isLoading, isFetching } = useProductSearch({
    query: debouncedQuery,
    ...filters,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="상품 검색..."
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {isFetching && (
            <div className="absolute right-4 top-3.5">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1">
          <SearchFilters filters={filters} onChange={setFilters} />
        </aside>

        <main className="lg:col-span-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : data && data.products.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-gray-600">
                {data.total}개의 결과
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {data.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="mt-8">
                <Pagination
                  currentPage={data.page}
                  totalPages={data.totalPages}
                  onPageChange={(page) => setFilters({ ...filters, page })}
                />
              </div>
            </>
          ) : debouncedQuery ? (
            <div className="text-center text-gray-500 py-12">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              검색어를 입력해주세요.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

---

## 4. URL 상태 동기화

### 4.1 useSearchParams 기본

```tsx
// hooks/useQueryParams.ts
import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export function useQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getParam = useCallback(
    (key: string): string | null => {
      return searchParams.get(key);
    },
    [searchParams]
  );

  const setParam = useCallback(
    (key: string, value: string | number | boolean | null) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (value === null || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
        return newParams;
      });
    },
    [setSearchParams]
  );

  const setParams = useCallback(
    (params: Record<string, string | number | boolean | null>) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        Object.entries(params).forEach(([key, value]) => {
          if (value === null || value === '') {
            newParams.delete(key);
          } else {
            newParams.set(key, String(value));
          }
        });
        return newParams;
      });
    },
    [setSearchParams]
  );

  return { getParam, setParam, setParams, searchParams };
}
```

### 4.2 타입 안전한 Query Params Hook

```tsx
// hooks/useTypedQueryParams.ts
import { useQueryParams } from './useQueryParams';
import { useMemo } from 'react';

interface SearchFilters {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  page: number;
}

export function useSearchFilters() {
  const { getParam, setParams, searchParams } = useQueryParams();

  const filters = useMemo((): SearchFilters => {
    return {
      query: getParam('q') || '',
      category: getParam('category') || undefined,
      minPrice: getParam('minPrice') ? Number(getParam('minPrice')) : undefined,
      maxPrice: getParam('maxPrice') ? Number(getParam('maxPrice')) : undefined,
      sortBy: (getParam('sort') as SearchFilters['sortBy']) || 'relevance',
      page: Number(getParam('page')) || 1,
    };
  }, [searchParams]);

  const updateFilters = (updates: Partial<SearchFilters>) => {
    setParams({
      q: updates.query ?? filters.query,
      category: updates.category ?? filters.category ?? null,
      minPrice: updates.minPrice ?? filters.minPrice ?? null,
      maxPrice: updates.maxPrice ?? filters.maxPrice ?? null,
      sort: updates.sortBy ?? filters.sortBy,
      page: updates.page ?? filters.page,
    });
  };

  return { filters, updateFilters };
}
```

### 4.3 URL과 동기화된 검색

```tsx
// pages/ProductSearchWithURL.tsx
import { useEffect, useState } from 'react';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useDebounce } from '@/hooks/useDebounce';
import { useProductSearch } from '@/hooks/useProductSearch';

export function ProductSearchWithURL() {
  const { filters, updateFilters } = useSearchFilters();
  const [localQuery, setLocalQuery] = useState(filters.query);
  const debouncedQuery = useDebounce(localQuery, 300);

  // URL 변경 시 로컬 상태 동기화
  useEffect(() => {
    setLocalQuery(filters.query);
  }, [filters.query]);

  // 디바운스된 쿼리를 URL에 반영
  useEffect(() => {
    if (debouncedQuery !== filters.query) {
      updateFilters({ query: debouncedQuery, page: 1 });
    }
  }, [debouncedQuery]);

  const { data, isLoading } = useProductSearch({
    query: filters.query,
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sortBy: filters.sortBy,
    page: filters.page,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <input
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="상품 검색..."
        className="w-full px-4 py-3 border rounded-lg"
      />

      <div className="mt-4 flex gap-4">
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilters({ sortBy: e.target.value as any, page: 1 })}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="relevance">관련도순</option>
          <option value="price_asc">낮은 가격순</option>
          <option value="price_desc">높은 가격순</option>
          <option value="newest">최신순</option>
        </select>

        <select
          value={filters.category || ''}
          onChange={(e) => updateFilters({ category: e.target.value || undefined, page: 1 })}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">전체 카테고리</option>
          <option value="electronics">전자제품</option>
          <option value="fashion">패션</option>
          <option value="home">홈/리빙</option>
        </select>
      </div>

      {/* 검색 결과 렌더링 */}
      {isLoading ? (
        <div className="flex justify-center mt-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        data && (
          <div className="mt-8">
            <p className="text-sm text-gray-600 mb-4">{data.total}개의 결과</p>
            {/* 상품 목록 */}
          </div>
        )
      )}
    </div>
  );
}
```

---

## 5. React.memo 최적화

### 5.1 React.memo 기본

**언제 사용하는가?**
- Props가 자주 변경되지 않는 컴포넌트
- 렌더링 비용이 높은 컴포넌트
- 리스트 아이템

```tsx
// components/ProductCard.tsx
import { memo } from 'react';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: number) => void;
}

// memo 적용 전: 부모가 리렌더되면 항상 리렌더
export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  console.log('ProductCard rendered:', product.id);

  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition">
      <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover rounded" />
      <h3 className="mt-2 font-semibold">{product.name}</h3>
      <p className="text-gray-600 text-sm mt-1">{product.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-bold">${product.price}</span>
        <button
          onClick={() => onAddToCart?.(product.id)}
          disabled={!product.inStock}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
        >
          {product.inStock ? '장바구니' : '품절'}
        </button>
      </div>
    </div>
  );
}

// memo 적용 후: props가 변경될 때만 리렌더
export const ProductCardMemo = memo(ProductCard);
```

### 5.2 커스텀 비교 함수

```tsx
// components/ProductCardOptimized.tsx
import { memo } from 'react';

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    price: number;
    imageUrl: string;
    inStock: boolean;
  };
  onAddToCart?: (productId: number) => void;
}

function arePropsEqual(
  prevProps: ProductCardProps,
  nextProps: ProductCardProps
): boolean {
  // product 객체의 주요 필드만 비교
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.inStock === nextProps.product.inStock
    // onAddToCart는 비교하지 않음 (useCallback으로 안정화 가정)
  );
}

export const ProductCardOptimized = memo(ProductCard, arePropsEqual);
```

### 5.3 리스트 최적화 예제

```tsx
// components/ProductList.tsx
import { memo } from 'react';
import { Product } from '@/types';
import { ProductCardMemo } from './ProductCard';

interface ProductListProps {
  products: Product[];
  onAddToCart: (productId: number) => void;
}

// 부모 컴포넌트도 memo로 감싸기
export const ProductList = memo(function ProductList({
  products,
  onAddToCart
}: ProductListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCardMemo
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
});
```

---

## 6. useMemo/useCallback

### 6.1 useMemo - 값 메모이제이션

```tsx
// pages/Dashboard.tsx
import { useMemo } from 'react';

function Dashboard({ data }: { data: DailyStat[] }) {
  // 매 렌더마다 재계산 (비효율)
  const totalRevenue = data.reduce((sum, day) => sum + day.revenue, 0);

  // useMemo: data가 변경될 때만 재계산
  const totalRevenueMemo = useMemo(() => {
    console.log('Calculating total revenue...');
    return data.reduce((sum, day) => sum + day.revenue, 0);
  }, [data]);

  // 복잡한 필터링/정렬
  const topProducts = useMemo(() => {
    return data
      .flatMap(day => day.products)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [data]);

  return (
    <div>
      <h2>총 매출: ${totalRevenueMemo.toLocaleString()}</h2>
      {/* ... */}
    </div>
  );
}
```

### 6.2 useCallback - 함수 메모이제이션

```tsx
// components/SearchBar.tsx
import { useCallback, useState } from 'react';
import { SearchInput } from './SearchInput';

function SearchBar() {
  const [results, setResults] = useState<string[]>([]);

  // 매 렌더마다 새 함수 생성 (비효율)
  const handleSearch = (query: string) => {
    console.log('Searching:', query);
    // API 호출...
  };

  // useCallback: 의존성이 변경될 때만 새 함수 생성
  const handleSearchMemo = useCallback((query: string) => {
    console.log('Searching:', query);
    // API 호출...
  }, []); // 의존성 없음 - 함수는 마운트 시 한 번만 생성

  return (
    <div>
      <SearchInput onSearch={handleSearchMemo} />
    </div>
  );
}
```

### 6.3 실전: 검색 + 필터 최적화

```tsx
// pages/ProductSearchOptimized.tsx
import { useState, useMemo, useCallback } from 'react';
import { useProductSearch } from '@/hooks/useProductSearch';
import { ProductList } from '@/components/ProductList';

export function ProductSearchOptimized() {
  const [filters, setFilters] = useState({
    query: '',
    category: '',
    minPrice: 0,
    maxPrice: 1000,
  });

  const { data } = useProductSearch(filters);

  // 필터링된 상품 목록 (useMemo)
  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];

    return data.products.filter(product => {
      const matchesPrice =
        product.price >= filters.minPrice &&
        product.price <= filters.maxPrice;
      const matchesCategory =
        !filters.category || product.category === filters.category;

      return matchesPrice && matchesCategory;
    });
  }, [data?.products, filters.minPrice, filters.maxPrice, filters.category]);

  // 통계 계산 (useMemo)
  const stats = useMemo(() => {
    const totalPrice = filteredProducts.reduce((sum, p) => sum + p.price, 0);
    const avgPrice = filteredProducts.length > 0
      ? totalPrice / filteredProducts.length
      : 0;

    return {
      count: filteredProducts.length,
      totalPrice,
      avgPrice,
    };
  }, [filteredProducts]);

  // 필터 업데이트 핸들러 (useCallback)
  const handlePriceChange = useCallback((min: number, max: number) => {
    setFilters(prev => ({ ...prev, minPrice: min, maxPrice: max }));
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setFilters(prev => ({ ...prev, category }));
  }, []);

  const handleAddToCart = useCallback((productId: number) => {
    console.log('Adding to cart:', productId);
    // 장바구니 로직...
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">
          {stats.count}개 상품 (평균 ${stats.avgPrice.toFixed(2)})
        </h2>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <aside className="col-span-1">
          <PriceRangeFilter onChange={handlePriceChange} />
          <CategoryFilter onChange={handleCategoryChange} />
        </aside>

        <main className="col-span-3">
          <ProductList
            products={filteredProducts}
            onAddToCart={handleAddToCart}
          />
        </main>
      </div>
    </div>
  );
}
```

---

## 7. 가상화 (Virtualization)

### 7.1 react-window 설치

```bash
npm install react-window
npm install --save-dev @types/react-window
```

### 7.2 FixedSizeList (고정 높이)

```tsx
// components/VirtualizedList.tsx
import { FixedSizeList as List } from 'react-window';

interface Product {
  id: number;
  name: string;
  price: number;
}

interface VirtualizedProductListProps {
  products: Product[];
}

export function VirtualizedProductList({ products }: VirtualizedProductListProps) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const product = products[index];

    return (
      <div
        style={style}
        className="flex items-center justify-between px-4 border-b hover:bg-gray-50"
      >
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-sm text-gray-600">ID: {product.id}</p>
        </div>
        <span className="font-semibold">${product.price}</span>
      </div>
    );
  };

  return (
    <List
      height={600}
      itemCount={products.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

### 7.3 VariableSizeList (가변 높이)

```tsx
// components/VirtualizedCommentList.tsx
import { useRef } from 'react';
import { VariableSizeList as List } from 'react-window';

interface Comment {
  id: number;
  author: string;
  text: string;
}

interface VirtualizedCommentListProps {
  comments: Comment[];
}

export function VirtualizedCommentList({ comments }: VirtualizedCommentListProps) {
  const listRef = useRef<List>(null);

  const getItemSize = (index: number) => {
    const comment = comments[index];
    // 텍스트 길이에 따라 높이 계산
    const lines = Math.ceil(comment.text.length / 50);
    return 60 + lines * 20; // 기본 60px + 줄당 20px
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const comment = comments[index];

    return (
      <div style={style} className="px-4 py-3 border-b">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-300" />
          <div className="flex-1">
            <p className="font-medium">{comment.author}</p>
            <p className="text-sm text-gray-600 mt-1">{comment.text}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <List
      ref={listRef}
      height={600}
      itemCount={comments.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

### 7.4 무한 스크롤 + 가상화

```tsx
// components/InfiniteVirtualList.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

export function InfiniteVirtualList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['products', 'infinite'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(`/api/products?page=${pageParam}&limit=50`);
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    initialPageParam: 1,
  });

  const products = data?.pages.flatMap(page => page.products) ?? [];
  const itemCount = hasNextPage ? products.length + 1 : products.length;

  const loadMoreItems = isFetchingNextPage
    ? () => {}
    : () => fetchNextPage();

  const isItemLoaded = (index: number) => !hasNextPage || index < products.length;

  const Item = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    if (!isItemLoaded(index)) {
      return (
        <div style={style} className="flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      );
    }

    const product = products[index];
    return (
      <div style={style} className="px-4 py-3 border-b hover:bg-gray-50">
        <p className="font-medium">{product.name}</p>
        <p className="text-sm text-gray-600">${product.price}</p>
      </div>
    );
  };

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <List
          ref={ref}
          onItemsRendered={onItemsRendered}
          height={600}
          itemCount={itemCount}
          itemSize={80}
          width="100%"
        >
          {Item}
        </List>
      )}
    </InfiniteLoader>
  );
}
```

---

## 8. 성능 측정

### 8.1 React DevTools Profiler

**사용 방법**:
1. Chrome 확장 프로그램 설치: React Developer Tools
2. 개발자 도구 → Profiler 탭
3. 녹화 시작 → 인터랙션 → 녹화 중지
4. Flame Graph에서 렌더링 시간 확인

### 8.2 <Profiler> 컴포넌트

```tsx
// components/ProfiledComponent.tsx
import { Profiler, ProfilerOnRenderCallback } from 'react';

const onRenderCallback: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
};

export function ProfiledProductList({ products }: { products: Product[] }) {
  return (
    <Profiler id="ProductList" onRender={onRenderCallback}>
      <div className="grid grid-cols-3 gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </Profiler>
  );
}
```

### 8.3 커스텀 성능 측정 Hook

```tsx
// hooks/useRenderCount.ts
import { useEffect, useRef } from 'react';

export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    console.log(`${componentName} rendered ${renderCount.current} times`);
  });

  return renderCount.current;
}

// 사용 예시
function ProductCard({ product }: { product: Product }) {
  const renderCount = useRenderCount('ProductCard');

  return (
    <div>
      <span className="text-xs text-gray-400">Renders: {renderCount}</span>
      {/* ... */}
    </div>
  );
}
```

### 8.4 Performance API

```tsx
// utils/performance.ts
export function measurePerformance(name: string, fn: () => void) {
  performance.mark(`${name}-start`);
  fn();
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);

  const measure = performance.getEntriesByName(name)[0];
  console.log(`${name} took ${measure.duration}ms`);

  performance.clearMarks();
  performance.clearMeasures();
}

// 사용 예시
function Dashboard() {
  const { data } = useStats();

  useEffect(() => {
    if (data) {
      measurePerformance('process-stats', () => {
        // 데이터 처리 로직
        const processed = processStatsData(data);
      });
    }
  }, [data]);
}
```

---

## 9. 트러블슈팅

### 9.1 차트가 반응형으로 동작하지 않음

**문제**: 브라우저 창 크기 변경 시 차트 크기가 업데이트되지 않음

**원인**: ResponsiveContainer가 제대로 작동하지 않음

**해결**:
```tsx
// 방법 1: 부모 컨테이너에 명시적 크기 지정
<div style={{ width: '100%', height: '400px' }}>
  <ResponsiveContainer>
    <LineChart data={data}>
      {/* ... */}
    </LineChart>
  </ResponsiveContainer>
</div>

// 방법 2: aspect ratio 사용
<ResponsiveContainer width="100%" aspect={2}>
  <LineChart data={data}>
    {/* ... */}
  </LineChart>
</ResponsiveContainer>
```

### 9.2 검색 API 과도한 호출

**문제**: 타이핑할 때마다 API 호출 발생

**원인**: 디바운싱 없이 직접 API 호출

**해결**:
```tsx
// useDebounce 적용
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 300);

const { data } = useQuery({
  queryKey: ['search', debouncedQuery],
  queryFn: () => searchAPI(debouncedQuery),
  enabled: debouncedQuery.length >= 2, // 최소 길이 체크
});
```

### 9.3 React.memo가 작동하지 않음

**문제**: memo로 감싸도 계속 리렌더됨

**원인 1**: Props로 전달되는 객체/배열/함수가 매번 새로 생성됨

**해결**:
```tsx
// 잘못된 예
function Parent() {
  const config = { theme: 'dark' }; // 매 렌더마다 새 객체

  return <ChildMemo config={config} />;
}

// 올바른 예
function Parent() {
  const config = useMemo(() => ({ theme: 'dark' }), []);

  return <ChildMemo config={config} />;
}
```

**원인 2**: 인라인 함수를 props로 전달

**해결**:
```tsx
// 잘못된 예
<ChildMemo onDelete={(id) => deleteItem(id)} />

// 올바른 예
const handleDelete = useCallback((id) => deleteItem(id), []);
<ChildMemo onDelete={handleDelete} />
```

### 9.4 URL 상태가 동기화되지 않음

**문제**: setSearchParams 호출 후 즉시 getParam하면 이전 값 반환

**원인**: setSearchParams는 비동기이며, 다음 렌더에서 반영됨

**해결**:
```tsx
// 잘못된 예
const handleSearch = (query: string) => {
  setSearchParams({ q: query });
  const currentQuery = searchParams.get('q'); // 여전히 이전 값
};

// 올바른 예 - 로컬 상태와 URL 분리
const [localQuery, setLocalQuery] = useState('');
const debouncedQuery = useDebounce(localQuery, 300);

useEffect(() => {
  setSearchParams({ q: debouncedQuery });
}, [debouncedQuery]);
```

### 9.5 가상화 리스트 스크롤 위치 초기화

**문제**: 데이터 업데이트 시 스크롤이 맨 위로 이동

**원인**: itemCount 변경 시 react-window가 자동으로 스크롤 초기화

**해결**:
```tsx
const listRef = useRef<List>(null);

// 스크롤 위치 저장
const [scrollOffset, setScrollOffset] = useState(0);

const handleScroll = ({ scrollOffset }: { scrollOffset: number }) => {
  setScrollOffset(scrollOffset);
};

// 데이터 업데이트 후 복원
useEffect(() => {
  if (listRef.current && scrollOffset > 0) {
    listRef.current.scrollTo(scrollOffset);
  }
}, [data]);

return (
  <List
    ref={listRef}
    onScroll={handleScroll}
    // ...
  />
);
```

---

## 10. 프로젝트 적용

### Milestone 4: 통계 대시보드

```tsx
// pages/AdminDashboard.tsx
import { useState } from 'react';
import { useStats } from '@/hooks/useStats';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { CategoryChart } from '@/components/charts/CategoryChart';
import { StatusPieChart } from '@/components/charts/StatusPieChart';
import { DateRangePicker } from '@/components/DateRangePicker';

export function AdminDashboard() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data, isLoading } = useStats(dateRange);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">대시보드</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="총 매출"
          value={`$${data.summary.totalRevenue.toLocaleString()}`}
          change={+12.5}
          icon="💰"
        />
        <KPICard
          title="주문 수"
          value={data.summary.totalOrders.toLocaleString()}
          change={+8.2}
          icon="📦"
        />
        <KPICard
          title="평균 주문액"
          value={`$${data.summary.averageOrderValue.toFixed(2)}`}
          change={+3.1}
          icon="💳"
        />
        <KPICard
          title="전환율"
          value={`${(data.summary.conversionRate * 100).toFixed(1)}%`}
          change={-1.4}
          icon="📊"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="매출 추이">
          <RevenueChart data={data.daily} />
        </ChartCard>

        <ChartCard title="카테고리별 판매">
          <CategoryChart data={data.categories} />
        </ChartCard>

        <ChartCard title="주문 상태 분포">
          <StatusPieChart
            data={data.orderStatus.map(s => ({ name: s.status, value: s.count }))}
          />
        </ChartCard>

        <ChartCard title="상위 상품">
          <TopProductsTable products={data.topProducts} />
        </ChartCard>
      </div>
    </div>
  );
}
```

### Milestone 5: 상품 검색 페이지

```tsx
// pages/ProductSearchPage.tsx
import { memo, useCallback, useMemo } from 'react';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { ProductList } from '@/components/ProductList';
import { SearchFilters } from '@/components/SearchFilters';

export function ProductSearchPage() {
  const { filters, updateFilters } = useSearchFilters();
  const debouncedQuery = useDebounce(filters.query, 300);

  const { data, isLoading, isFetching } = useProductSearch({
    ...filters,
    query: debouncedQuery,
  });

  // 검색 통계 계산 (useMemo)
  const searchStats = useMemo(() => {
    if (!data) return null;

    const avgPrice = data.products.length > 0
      ? data.products.reduce((sum, p) => sum + p.price, 0) / data.products.length
      : 0;

    const inStockCount = data.products.filter(p => p.inStock).length;

    return {
      total: data.total,
      avgPrice,
      inStockCount,
      outOfStockCount: data.total - inStockCount,
    };
  }, [data]);

  // 장바구니 추가 핸들러 (useCallback)
  const handleAddToCart = useCallback((productId: number) => {
    console.log('Adding to cart:', productId);
    // 장바구니 API 호출
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 검색 입력 */}
      <div className="mb-6">
        <input
          type="text"
          value={filters.query}
          onChange={(e) => updateFilters({ query: e.target.value, page: 1 })}
          placeholder="상품 검색..."
          className="w-full px-4 py-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
        />
        {isFetching && <span className="text-sm text-gray-500 ml-2">검색 중...</span>}
      </div>

      {/* 통계 */}
      {searchStats && (
        <div className="mb-6 flex gap-4 text-sm text-gray-600">
          <span>총 {searchStats.total}개</span>
          <span>평균 ${searchStats.avgPrice.toFixed(2)}</span>
          <span>재고 {searchStats.inStockCount}개</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        {/* 필터 사이드바 */}
        <aside className="col-span-1">
          <SearchFilters filters={filters} onUpdate={updateFilters} />
        </aside>

        {/* 검색 결과 */}
        <main className="col-span-3">
          {isLoading ? (
            <LoadingGrid />
          ) : data && data.products.length > 0 ? (
            <ProductList
              products={data.products}
              onAddToCart={handleAddToCart}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  );
}

// ProductList는 memo로 최적화
const ProductList = memo(function ProductList({
  products,
  onAddToCart
}: {
  products: Product[];
  onAddToCart: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {products.map(product => (
        <ProductCardMemo
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
});
```

---

## 면접 질문

### 1. React.memo와 useMemo의 차이는?
**답변**:
- **React.memo**: 컴포넌트 자체를 메모이제이션. Props가 변경되지 않으면 리렌더 생략
- **useMemo**: 특정 값(계산 결과)을 메모이제이션. 의존성 배열이 변경되지 않으면 재계산 생략

**예시**:
```tsx
// React.memo - 컴포넌트
const MemoChild = memo(({ data }) => <div>{data}</div>);

// useMemo - 값
const expensiveValue = useMemo(() => computeExpensive(data), [data]);
```

### 2. 가상화(Virtualization)가 필요한 이유는?
**답변**:
- **문제**: 10,000개 항목을 모두 렌더하면 DOM 노드 10,000개 생성 → 메모리/성능 이슈
- **해결**: 화면에 보이는 항목만 렌더 (예: 20개) → 스크롤 시 재사용
- **효과**: 초기 렌더 시간 90% 감소, 메모리 사용량 95% 감소

**실전 경험**:
> "M5 검색 페이지에서 1,000개 상품 렌더 시 초기 로드 3초 → react-window 적용 후 0.5초로 개선"

### 3. URL 상태 동기화의 장점은?
**답변**:
1. **북마크 가능**: 검색 결과 URL 복사 시 필터 상태 유지
2. **뒤로가기 지원**: 브라우저 히스토리와 자동 동기화
3. **공유 가능**: URL만으로 동일한 화면 재현

**구현 방법**:
```tsx
// useSearchParams로 URL과 상태 동기화
const [searchParams, setSearchParams] = useSearchParams();
const query = searchParams.get('q') || '';

// 디바운스 + URL 업데이트
const debouncedQuery = useDebounce(localQuery, 300);
useEffect(() => {
  setSearchParams({ q: debouncedQuery });
}, [debouncedQuery]);
```

### 4. useMemo/useCallback을 항상 써야 하나?
**답변**: **아니다**. 불필요하게 사용하면 오히려 성능 저하.

**사용해야 하는 경우**:
- 계산 비용이 높은 작업 (배열 정렬/필터, 복잡한 수학 계산)
- Props로 전달하는 객체/함수 (자식이 memo인 경우)
- useEffect 의존성 배열에 들어가는 값

**사용하지 말아야 하는 경우**:
- 단순한 계산 (메모이제이션 비용이 더 큼)
- Props로 전달하지 않는 함수
- 자식 컴포넌트가 memo가 아닌 경우

### 5. Recharts의 ResponsiveContainer가 작동하는 원리는?
**답변**:
- **ResizeObserver API** 사용: 부모 컨테이너 크기 변화 감지
- 크기 변경 시 차트를 자동으로 리렌더하여 새 너비/높이 반영
- 부모에 명시적 크기가 없으면 0으로 인식 → 차트 안 보임

**주의사항**:
```tsx
// 부모에 크기 지정 필수
<div style={{ width: '100%', height: '400px' }}>
  <ResponsiveContainer>
    <LineChart />
  </ResponsiveContainer>
</div>
```

---

**마지막 업데이트**: 2025년 1월
**다음 튜토리얼**: [T09 - 테스트/접근성 →](./T09-testing-accessibility.md)
