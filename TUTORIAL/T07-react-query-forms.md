# T07: React Query + Forms

**난이도**: 🟡 중급
**예상 소요 시간**: 6~8시간
**선수 과목**: T06 (React 18 + Vite 기초)

---

## 개요

서버 상태 관리를 위한 React Query와 복잡한 폼 처리를 위한 React Hook Form을 학습합니다. 데이터 페칭, 캐싱, 폼 검증, 에러 처리 등을 다룹니다.

**학습 목표**:
- React Query로 서버 상태 관리 및 캐싱
- React Hook Form으로 효율적인 폼 처리
- Zod를 활용한 타입 안전 검증
- Optimistic Updates 구현
- 무한 스크롤 및 페이지네이션
- 파일 업로드 및 멀티스텝 폼

**프로젝트 연관성**:
- **video-editor**: v1.3 (파일 업로드, 프로젝트 관리)
- **e-commerce**: 상품 목록, 장바구니, 주문 폼

---

## 1. React Query 기초

### 1.1 설치 및 설정

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1분
      cacheTime: 5 * 60 * 1000, // 5분
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### 1.2 기본 데이터 페칭

```tsx
// src/hooks/useProducts.ts
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

async function fetchProducts(): Promise<Product[]> {
  const { data } = await axios.get('/api/products');
  return data;
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
}
```

```tsx
// src/components/ProductList.tsx
import { useProducts } from '../hooks/useProducts';

export function ProductList() {
  const { data, isLoading, isError, error } = useProducts();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      {data?.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price}</p>
        </div>
      ))}
    </div>
  );
}
```

### 1.3 Query Keys와 캐싱

Query Key는 캐시를 식별하는 고유 식별자입니다.

```tsx
// src/hooks/useProduct.ts
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

async function fetchProduct(id: number): Promise<Product> {
  const { data } = await axios.get(`/api/products/${id}`);
  return data;
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['products', id], // 배열 형태
    queryFn: () => fetchProduct(id),
    enabled: !!id, // id가 있을 때만 실행
  });
}

// 필터링된 상품 조회
export function useFilteredProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', 'filtered', filters], // 필터를 key에 포함
    queryFn: () => fetchFilteredProducts(filters),
  });
}
```

**Query Key 규칙**:
- 배열 형태 사용
- 계층적 구조: `['products']` → `['products', id]` → `['products', id, 'reviews']`
- 필터/파라미터를 key에 포함하여 자동으로 다른 캐시 생성

### 1.4 Mutations (생성, 수정, 삭제)

```tsx
// src/hooks/useCreateProduct.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface CreateProductData {
  name: string;
  price: number;
  description: string;
}

async function createProduct(data: CreateProductData): Promise<Product> {
  const response = await axios.post('/api/products', data);
  return response.data;
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: (newProduct) => {
      // 캐시 무효화: 상품 목록 다시 불러오기
      queryClient.invalidateQueries({ queryKey: ['products'] });

      // 또는 수동으로 캐시 업데이트
      // queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
      //   return old ? [...old, newProduct] : [newProduct];
      // });
    },
    onError: (error) => {
      console.error('Failed to create product:', error);
    },
  });
}
```

```tsx
// src/components/CreateProductForm.tsx
import { useState } from 'react';
import { useCreateProduct } from '../hooks/useCreateProduct';

export function CreateProductForm() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const createProduct = useCreateProduct();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProduct.mutate(
      { name, price: parseFloat(price), description: '' },
      {
        onSuccess: () => {
          setName('');
          setPrice('');
          alert('Product created!');
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Product name"
      />
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price"
      />
      <button type="submit" disabled={createProduct.isPending}>
        {createProduct.isPending ? 'Creating...' : 'Create Product'}
      </button>
      {createProduct.isError && (
        <div>Error: {createProduct.error.message}</div>
      )}
    </form>
  );
}
```

### 1.5 Optimistic Updates

사용자 경험을 개선하기 위해 서버 응답 전에 UI를 미리 업데이트합니다.

```tsx
// src/hooks/useToggleLike.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Product {
  id: number;
  name: string;
  liked: boolean;
  likeCount: number;
}

async function toggleLike(productId: number): Promise<void> {
  await axios.post(`/api/products/${productId}/like`);
}

export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleLike,
    onMutate: async (productId) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['products', productId] });

      // 이전 상태 백업
      const previousProduct = queryClient.getQueryData<Product>(['products', productId]);

      // Optimistic Update
      queryClient.setQueryData<Product>(['products', productId], (old) => {
        if (!old) return old;
        return {
          ...old,
          liked: !old.liked,
          likeCount: old.liked ? old.likeCount - 1 : old.likeCount + 1,
        };
      });

      return { previousProduct };
    },
    onError: (err, productId, context) => {
      // 에러 시 롤백
      if (context?.previousProduct) {
        queryClient.setQueryData(['products', productId], context.previousProduct);
      }
    },
    onSettled: (data, error, productId) => {
      // 완료 후 서버에서 최신 데이터 가져오기
      queryClient.invalidateQueries({ queryKey: ['products', productId] });
    },
  });
}
```

### 1.6 무한 스크롤 (Infinite Queries)

```tsx
// src/hooks/useInfiniteProducts.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';

interface ProductsResponse {
  products: Product[];
  nextCursor: number | null;
  hasMore: boolean;
}

async function fetchProductsPage({ pageParam = 0 }): Promise<ProductsResponse> {
  const { data } = await axios.get('/api/products', {
    params: { cursor: pageParam, limit: 20 },
  });
  return data;
}

export function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ['products', 'infinite'],
    queryFn: fetchProductsPage,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    initialPageParam: 0,
  });
}
```

```tsx
// src/components/InfiniteProductList.tsx
import { useInfiniteProducts } from '../hooks/useInfiniteProducts';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { useEffect, useRef } from 'react';

export function InfiniteProductList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteProducts();

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(loadMoreRef, {});
  const isIntersecting = !!entry?.isIntersecting;

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.products.map((product) => (
            <div key={product.id}>
              <h3>{product.name}</h3>
              <p>${product.price}</p>
            </div>
          ))}
        </div>
      ))}

      <div ref={loadMoreRef}>
        {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load More' : 'No more products'}
      </div>
    </div>
  );
}
```

```tsx
// src/hooks/useIntersectionObserver.ts
import { useEffect, useState, RefObject } from 'react';

export function useIntersectionObserver(
  elementRef: RefObject<Element>,
  options: IntersectionObserverInit
): IntersectionObserverEntry | null {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, options]);

  return entry;
}
```

---

## 2. React Hook Form

### 2.1 설치 및 기본 사용

```bash
npm install react-hook-form zod @hookform/resolvers
```

```tsx
// src/components/LoginForm.tsx
import { useForm } from 'react-hook-form';

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    console.log('Login data:', data);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 비동기 처리 시뮬레이션
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input
          type="email"
          placeholder="Email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />
        {errors.email && <span>{errors.email.message}</span>}
      </div>

      <div>
        <input
          type="password"
          placeholder="Password"
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters',
            },
          })}
        />
        {errors.password && <span>{errors.password.message}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### 2.2 Zod를 활용한 스키마 검증

```tsx
// src/schemas/product.schema.ts
import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  price: z.number().min(0, 'Price must be positive'),
  category: z.enum(['electronics', 'clothing', 'food'], {
    errorMap: () => ({ message: 'Invalid category' }),
  }),
  description: z.string().max(500, 'Description too long').optional(),
  tags: z.array(z.string()).min(1, 'At least one tag required'),
  stock: z.number().int('Stock must be integer').min(0, 'Stock cannot be negative'),
});

export type ProductFormData = z.infer<typeof productSchema>;
```

```tsx
// src/components/ProductForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, ProductFormData } from '../schemas/product.schema';

export function ProductForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      price: 0,
      category: 'electronics',
      tags: [],
      stock: 0,
    },
  });

  const onSubmit = (data: ProductFormData) => {
    console.log('Valid data:', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} placeholder="Product name" />
      {errors.name && <span>{errors.name.message}</span>}

      <input
        type="number"
        {...register('price', { valueAsNumber: true })}
        placeholder="Price"
      />
      {errors.price && <span>{errors.price.message}</span>}

      <select {...register('category')}>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
        <option value="food">Food</option>
      </select>
      {errors.category && <span>{errors.category.message}</span>}

      <textarea {...register('description')} placeholder="Description" />
      {errors.description && <span>{errors.description.message}</span>}

      <input
        type="number"
        {...register('stock', { valueAsNumber: true })}
        placeholder="Stock"
      />
      {errors.stock && <span>{errors.stock.message}</span>}

      <button type="submit">Submit</button>
    </form>
  );
}
```

### 2.3 동적 필드 (useFieldArray)

```tsx
// src/components/OrderForm.tsx
import { useForm, useFieldArray } from 'react-hook-form';

interface OrderItem {
  productId: number;
  quantity: number;
}

interface OrderFormData {
  customerName: string;
  items: OrderItem[];
}

export function OrderForm() {
  const { register, control, handleSubmit } = useForm<OrderFormData>({
    defaultValues: {
      customerName: '',
      items: [{ productId: 0, quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const onSubmit = (data: OrderFormData) => {
    console.log('Order:', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('customerName')} placeholder="Customer Name" />

      <h3>Order Items</h3>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input
            type="number"
            {...register(`items.${index}.productId`, { valueAsNumber: true })}
            placeholder="Product ID"
          />
          <input
            type="number"
            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
            placeholder="Quantity"
          />
          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={() => append({ productId: 0, quantity: 1 })}>
        Add Item
      </button>

      <button type="submit">Submit Order</button>
    </form>
  );
}
```

### 2.4 파일 업로드

```tsx
// src/components/FileUploadForm.tsx
import { useForm } from 'react-hook-form';
import { useState } from 'react';

interface FileUploadFormData {
  title: string;
  file: FileList;
}

export function FileUploadForm() {
  const { register, handleSubmit } = useForm<FileUploadFormData>();
  const [preview, setPreview] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: FileUploadFormData) => {
    const file = data.file[0];
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('file', file);

    // 업로드
    await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title')} placeholder="Title" />

      <input
        type="file"
        {...register('file')}
        onChange={onFileChange}
        accept="image/*"
      />

      {preview && <img src={preview} alt="Preview" style={{ maxWidth: '200px' }} />}

      <button type="submit">Upload</button>
    </form>
  );
}
```

### 2.5 멀티스텝 폼

```tsx
// src/components/MultiStepForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';

interface FormData {
  // Step 1
  name: string;
  email: string;
  // Step 2
  address: string;
  city: string;
  // Step 3
  cardNumber: string;
  cvv: string;
}

export function MultiStepForm() {
  const [step, setStep] = useState(1);
  const { register, handleSubmit, formState: { errors }, trigger } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    console.log('Final data:', data);
  };

  const nextStep = async () => {
    let fieldsToValidate: (keyof FormData)[] = [];

    if (step === 1) {
      fieldsToValidate = ['name', 'email'];
    } else if (step === 2) {
      fieldsToValidate = ['address', 'city'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setStep(step + 1);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>Step {step} of 3</div>

      {step === 1 && (
        <div>
          <h2>Personal Information</h2>
          <input {...register('name', { required: 'Name is required' })} placeholder="Name" />
          {errors.name && <span>{errors.name.message}</span>}

          <input
            type="email"
            {...register('email', { required: 'Email is required' })}
            placeholder="Email"
          />
          {errors.email && <span>{errors.email.message}</span>}
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Address</h2>
          <input {...register('address', { required: 'Address is required' })} placeholder="Address" />
          {errors.address && <span>{errors.address.message}</span>}

          <input {...register('city', { required: 'City is required' })} placeholder="City" />
          {errors.city && <span>{errors.city.message}</span>}
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Payment</h2>
          <input
            {...register('cardNumber', {
              required: 'Card number is required',
              pattern: { value: /^\d{16}$/, message: 'Invalid card number' },
            })}
            placeholder="Card Number"
          />
          {errors.cardNumber && <span>{errors.cardNumber.message}</span>}

          <input
            {...register('cvv', {
              required: 'CVV is required',
              pattern: { value: /^\d{3}$/, message: 'Invalid CVV' },
            })}
            placeholder="CVV"
          />
          {errors.cvv && <span>{errors.cvv.message}</span>}
        </div>
      )}

      <div>
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)}>
            Previous
          </button>
        )}
        {step < 3 ? (
          <button type="button" onClick={nextStep}>
            Next
          </button>
        ) : (
          <button type="submit">Submit</button>
        )}
      </div>
    </form>
  );
}
```

---

## 3. React Query + Forms 통합

### 3.1 폼 제출과 Mutation 결합

```tsx
// src/components/CreateProductFormWithQuery.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateProduct } from '../hooks/useCreateProduct';
import { productSchema, ProductFormData } from '../schemas/product.schema';

export function CreateProductFormWithQuery() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
  });

  const createProduct = useCreateProduct();

  const onSubmit = (data: ProductFormData) => {
    createProduct.mutate(data, {
      onSuccess: () => {
        reset(); // 폼 초기화
        alert('Product created successfully!');
      },
      onError: (error) => {
        alert(`Failed to create product: ${error.message}`);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} placeholder="Product name" />
      {errors.name && <span>{errors.name.message}</span>}

      <input
        type="number"
        {...register('price', { valueAsNumber: true })}
        placeholder="Price"
      />
      {errors.price && <span>{errors.price.message}</span>}

      <button type="submit" disabled={createProduct.isPending}>
        {createProduct.isPending ? 'Creating...' : 'Create Product'}
      </button>

      {createProduct.isError && (
        <div>Error: {createProduct.error.message}</div>
      )}
    </form>
  );
}
```

### 3.2 편집 폼 (초기값 로딩)

```tsx
// src/components/EditProductForm.tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useProduct } from '../hooks/useProduct';
import { useUpdateProduct } from '../hooks/useUpdateProduct';
import { ProductFormData } from '../schemas/product.schema';

interface EditProductFormProps {
  productId: number;
}

export function EditProductForm({ productId }: EditProductFormProps) {
  const { data: product, isLoading } = useProduct(productId);
  const updateProduct = useUpdateProduct();

  const { register, handleSubmit, reset } = useForm<ProductFormData>();

  // 데이터 로드 후 폼 초기화
  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        price: product.price,
        category: product.category,
        description: product.description,
        tags: product.tags,
        stock: product.stock,
      });
    }
  }, [product, reset]);

  const onSubmit = (data: ProductFormData) => {
    updateProduct.mutate({ id: productId, ...data });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      <input type="number" {...register('price', { valueAsNumber: true })} />
      <button type="submit" disabled={updateProduct.isPending}>
        Update Product
      </button>
    </form>
  );
}
```

### 3.3 자동 저장 (Auto-save)

```tsx
// src/components/AutoSaveForm.tsx
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useSaveDraft } from '../hooks/useSaveDraft';

interface DraftData {
  title: string;
  content: string;
}

export function AutoSaveForm() {
  const { register, watch } = useForm<DraftData>({
    defaultValues: {
      title: '',
      content: '',
    },
  });

  const saveDraft = useSaveDraft();

  // 폼 값 변경 감지
  const formValues = watch();

  // 디바운스된 저장 함수 (2초 대기)
  const debouncedSave = useDebouncedCallback((data: DraftData) => {
    saveDraft.mutate(data);
  }, 2000);

  useEffect(() => {
    debouncedSave(formValues);
  }, [formValues, debouncedSave]);

  return (
    <form>
      <input {...register('title')} placeholder="Title" />
      <textarea {...register('content')} placeholder="Content" />

      {saveDraft.isPending && <span>Saving...</span>}
      {saveDraft.isSuccess && <span>Saved!</span>}
    </form>
  );
}
```

---

## 4. 고급 패턴

### 4.1 Dependent Queries (의존적 쿼리)

```tsx
// src/hooks/useUserAndPosts.ts
import { useQuery } from '@tanstack/react-query';

export function useUser(userId: number) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => fetchUser(userId),
  });
}

export function useUserPosts(userId: number) {
  const { data: user } = useUser(userId);

  return useQuery({
    queryKey: ['posts', { userId }],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!user, // user가 로드된 후에만 실행
  });
}
```

### 4.2 Parallel Queries

```tsx
// src/hooks/useProductDetails.ts
import { useQueries } from '@tanstack/react-query';

export function useProductDetails(productId: number) {
  const results = useQueries({
    queries: [
      {
        queryKey: ['products', productId],
        queryFn: () => fetchProduct(productId),
      },
      {
        queryKey: ['products', productId, 'reviews'],
        queryFn: () => fetchProductReviews(productId),
      },
      {
        queryKey: ['products', productId, 'related'],
        queryFn: () => fetchRelatedProducts(productId),
      },
    ],
  });

  return {
    product: results[0].data,
    reviews: results[1].data,
    related: results[2].data,
    isLoading: results.some(r => r.isLoading),
    isError: results.some(r => r.isError),
  };
}
```

### 4.3 Prefetching (사전 로딩)

```tsx
// src/components/ProductListWithPrefetch.tsx
import { useQueryClient } from '@tanstack/react-query';
import { useProducts } from '../hooks/useProducts';

export function ProductListWithPrefetch() {
  const queryClient = useQueryClient();
  const { data: products } = useProducts();

  const prefetchProduct = (productId: number) => {
    queryClient.prefetchQuery({
      queryKey: ['products', productId],
      queryFn: () => fetchProduct(productId),
      staleTime: 60 * 1000, // 1분간 캐시 유지
    });
  };

  return (
    <div>
      {products?.map(product => (
        <div
          key={product.id}
          onMouseEnter={() => prefetchProduct(product.id)}
        >
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </div>
      ))}
    </div>
  );
}
```

### 4.4 Error Boundaries와 Suspense

```tsx
// src/App.tsx
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryErrorResetBoundary } from '@tanstack/react-query';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={reset}>
          <Suspense fallback={<div>Loading...</div>}>
            <ProductList />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

---

## 5. 트러블슈팅

### 5.1 "Too many re-renders" 에러

**원인**: useEffect 의존성 배열 문제

```tsx
// ❌ 잘못된 코드
useEffect(() => {
  queryClient.invalidateQueries(['products']);
}, [queryClient]); // queryClient는 안정적이지만 의존성에 포함하면 문제 발생 가능

// ✅ 올바른 코드
useEffect(() => {
  queryClient.invalidateQueries({ queryKey: ['products'] });
}, []); // 빈 배열 또는 특정 트리거만 포함
```

### 5.2 캐시가 업데이트되지 않음

**원인**: Query Key 불일치

```tsx
// ❌ 잘못된 코드
useQuery({ queryKey: ['products', { filter: 'electronics' }] });
queryClient.invalidateQueries({ queryKey: ['products'] }); // filter가 다르므로 무효화 안 됨

// ✅ 올바른 코드
queryClient.invalidateQueries({ queryKey: ['products'], exact: false }); // 모든 products 쿼리 무효화
```

### 5.3 Form validation이 느림

**원인**: 모든 입력마다 검증

```tsx
// ✅ mode 옵션 조정
useForm({
  mode: 'onBlur', // 포커스 잃을 때만 검증 (기본: onChange)
  reValidateMode: 'onSubmit', // 제출 시에만 재검증
});
```

---

## 6. 면접 대비 질문

### Q1: React Query의 staleTime과 cacheTime의 차이는?

**답변**:
- **staleTime**: 데이터가 "신선"한 상태로 유지되는 시간. 이 시간 동안은 refetch하지 않음 (기본: 0)
- **cacheTime**: 사용되지 않는 데이터가 메모리에 유지되는 시간 (기본: 5분)

**예시**:
```tsx
{
  staleTime: 60000, // 1분간 신선 → 1분 내 재요청 시 캐시 사용
  cacheTime: 300000, // 5분간 캐시 유지 → 컴포넌트 언마운트 후에도 5분간 보관
}
```

### Q2: Optimistic Update의 장단점은?

**답변**:
**장점**:
- 즉각적인 UI 피드백
- 사용자 경험 향상

**단점**:
- 복잡한 롤백 로직 필요
- 서버 응답과 불일치 가능성

### Q3: React Hook Form이 Controlled Component보다 빠른 이유는?

**답변**:
- **Uncontrolled Component** 기반으로 ref를 사용하여 DOM에 직접 접근
- 입력마다 리렌더링 발생하지 않음 (useState 불필요)
- 필요한 시점에만 값을 읽어옴

### Q4: useQuery와 useMutation의 차이는?

**답변**:
- **useQuery**: GET 요청, 자동 실행, 캐싱
- **useMutation**: POST/PUT/DELETE 요청, 수동 실행 (mutate 호출), 캐싱 안 함

### Q5: Query Key는 왜 배열 형태인가?

**답변**:
- 계층적 구조 표현: `['users', 1, 'posts']`
- 필터/파라미터 포함: `['products', { category: 'electronics' }]`
- 부분 무효화: `queryClient.invalidateQueries({ queryKey: ['users'] })`로 모든 users 쿼리 무효화

---

## 7. 다음 단계

### T07 완료 후:
1. **T08 (통계 + 검색 최적화)**: 복잡한 데이터 시각화
2. **T09 (테스팅 + 접근성)**: React Testing Library로 폼 테스트
3. **실전 프로젝트**: e-commerce 장바구니 + 주문 폼 구현

---

**마지막 업데이트**: 2025년 1월
**다음 튜토리얼**: [T08 - 통계 + 검색 최적화 →](./T08-stats-search-optimization.md)
