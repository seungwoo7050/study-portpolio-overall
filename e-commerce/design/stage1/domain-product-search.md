# 상품 카탈로그 & 검색 시스템 설계 일지 (Product & Search Domain)
> Elasticsearch + Nori 토크나이저 기반 한글 전문 검색 및 상품 관리 시스템 설계

## 1. 문제 정의 & 요구사항

### 1.1 목표

효율적인 상품 관리 및 한글 검색 시스템 구축:
- 상품 CRUD (관리자 전용)
- 계층형 카테고리 구조
- 한글 전문 검색 (Elasticsearch + Nori)
- 패싯 검색 (카테고리, 가격대, 브랜드)
- 자동완성
- Redis 캐싱으로 성능 최적화

### 1.2 기능 요구사항

#### 1.2.1 상품 관리
- 상품 생성/수정/삭제 (ADMIN만 가능)
- 상품 목록 조회 (페이징, 정렬)
- 상품 상세 조회 (캐싱 적용)
- 카테고리별 상품 조회
- 활성/비활성 상태 관리

#### 1.2.2 카테고리
- 계층형 구조 (parent_id self-referencing)
- 카테고리 CRUD
- 상품-카테고리 다대다 관계

#### 1.2.3 검색 (Elasticsearch)
- 한글 전문 검색 (Nori 형태소 분석)
- 패싯 검색:
  - 카테고리별 필터
  - 가격 범위 (min_price ~ max_price)
  - 브랜드 필터
- 자동완성 (N-gram 기반)
- 검색 결과 페이징
- 관련도 순 정렬

### 1.3 비기능 요구사항

#### 1.3.1 성능
- 상품 조회 p99 < 50ms (캐시 히트 시)
- 검색 응답 p99 < 200ms
- 캐시 히트율 ≥ 80%
- Elasticsearch 인덱싱 < 1초

#### 1.3.2 일관성
- DB ↔ Elasticsearch 동기화
- Dual-write 패턴 (트랜잭션 내)
- 실패 시 재시도 로직

#### 1.3.3 확장성
- Elasticsearch 샤딩 (향후)
- 캐시 분산 (Redis Cluster)

---

## 2. 도메인 모델 설계

### 2.1 엔티티 구조

#### 2.1.1 Product 엔티티
```java
@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Long price;  // 원 단위 (KRW)

    @Column(unique = true)
    private String sku;  // Stock Keeping Unit

    private String brand;
    private String imageUrl;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @ManyToMany
    @JoinTable(
        name = "product_categories",
        joinColumns = @JoinColumn(name = "product_id"),
        inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private Set<Category> categories = new HashSet<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

**설계 결정:**
- `price`: Long 타입으로 소수점 연산 오류 방지
- `sku`: 유니크 제약으로 재고 관리 연동 준비
- `isActive`: Soft Delete (실제 삭제하지 않음)
- `categories`: Many-to-Many (한 상품이 여러 카테고리 속함)

#### 2.1.2 Category 엔티티
```java
@Entity
@Table(name = "categories")
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Category parent;  // Self-referencing

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    private Set<Category> children = new HashSet<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

**계층 구조 예시:**
```
전자제품 (parent_id = null)
  ├─ 컴퓨터 (parent_id = 1)
  │   ├─ 노트북 (parent_id = 2)
  │   └─ 데스크톱 (parent_id = 2)
  └─ 모바일 (parent_id = 1)
      ├─ 스마트폰 (parent_id = 5)
      └─ 태블릿 (parent_id = 5)
```

### 2.2 Elasticsearch 문서 모델

#### 2.2.1 ProductDocument
```java
@Document(indexName = "products")
public class ProductDocument {
    @Id
    private String id;  // Product.id를 String으로

    @Field(type = FieldType.Text, analyzer = "nori")
    private String name;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String description;

    @Field(type = FieldType.Long)
    private Long price;

    @Field(type = FieldType.Keyword)
    private String brand;

    @Field(type = FieldType.Keyword)
    private List<String> categories;  // 카테고리 이름 목록

    @Field(type = FieldType.Boolean)
    private Boolean isActive;

    @Field(type = FieldType.Date)
    private LocalDateTime createdAt;
}
```

#### 2.2.2 Elasticsearch Index Mapping
```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "nori": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["lowercase"]
        },
        "ngram_analyzer": {
          "type": "custom",
          "tokenizer": "ngram_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "ngram_tokenizer": {
          "type": "ngram",
          "min_gram": 2,
          "max_gram": 3
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "nori",
        "fields": {
          "ngram": {
            "type": "text",
            "analyzer": "ngram_analyzer"
          }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "nori"
      },
      "price": { "type": "long" },
      "brand": { "type": "keyword" },
      "categories": { "type": "keyword" },
      "isActive": { "type": "boolean" }
    }
  }
}
```

**Nori 토크나이저 예시:**
```
Input: "삼성 갤럭시 노트북"
Tokens: ["삼성", "갤럭시", "노트북"]

Input: "LG 그램 17인치 노트북"
Tokens: ["LG", "그램", "17", "인치", "노트북"]
```

---

## 3. 상품 관리 흐름

### 3.1 상품 생성 (ADMIN)

```
Admin: POST /api/products
Authorization: Bearer <admin-token>
{
  "name": "삼성 갤럭시 북3",
  "description": "13세대 인텔 코어 프로세서...",
  "price": 1490000,
  "sku": "SAMSUNG-GB3-001",
  "brand": "삼성",
  "categoryIds": [2, 3]  // 컴퓨터, 노트북
}

↓

ProductController.createProduct()
  ↓
ProductService.createProduct()
  ├─ 1. Category 조회 및 검증
  ├─ 2. Product 엔티티 생성
  ├─ 3. DB 저장 (productRepository.save)
  ├─ 4. Elasticsearch 인덱싱 (productSearchService.indexProduct)
  ├─ 5. 메트릭 기록
  └─ 6. ProductDTO 반환

↓

Response:
{
  "id": 1,
  "name": "삼성 갤럭시 북3",
  "price": 1490000,
  "categories": [
    {"id": 2, "name": "컴퓨터"},
    {"id": 3, "name": "노트북"}
  ],
  "createdAt": "2025-11-23T10:00:00"
}
```

**핵심 로직:**
```java
@Service
public class ProductService {
    @Transactional
    public ProductDTO createProduct(CreateProductRequest request) {
        // 카테고리 조회
        Set<Category> categories = categoryRepository
            .findAllById(request.getCategoryIds())
            .stream()
            .collect(Collectors.toSet());

        // Product 생성
        Product product = Product.builder()
            .name(request.getName())
            .description(request.getDescription())
            .price(request.getPrice())
            .sku(request.getSku())
            .brand(request.getBrand())
            .categories(categories)
            .isActive(true)
            .build();

        product = productRepository.save(product);

        // Elasticsearch 인덱싱 (비동기 고려 가능)
        productSearchService.indexProduct(product);

        return toDTO(product);
    }
}
```

### 3.2 상품 수정 (Cache Invalidation)

```
ProductService.updateProduct()
  ├─ 1. Product 조회
  ├─ 2. 필드 업데이트
  ├─ 3. DB 저장
  ├─ 4. Elasticsearch 재인덱싱
  └─ 5. 캐시 무효화 (@CacheEvict)

↓

@CacheEvict(value = "products", key = "#id")
public ProductDTO updateProduct(Long id, UpdateProductRequest request) {
    Product product = productRepository.findById(id)
        .orElseThrow(() -> new NotFoundException("Product not found"));

    // 필드 업데이트
    product.setName(request.getName());
    product.setPrice(request.getPrice());
    // ...

    product = productRepository.save(product);

    // Elasticsearch 동기화
    productSearchService.updateProduct(product);

    return toDTO(product);
}
```

### 3.3 상품 조회 (Caching)

```
Client: GET /api/products/1

↓

ProductController.getProduct(1)
  ↓
ProductService.getProductById(1)
  ├─ 1. Redis 캐시 조회 (@Cacheable)
  │   ├─ Cache HIT: 즉시 반환 (< 10ms)
  │   └─ Cache MISS: DB 조회 후 캐싱
  └─ 2. ProductDTO 반환

↓

@Cacheable(value = "products", key = "#id")
public ProductDTO getProductById(Long id) {
    Product product = productRepository.findById(id)
        .orElseThrow(() -> new NotFoundException("Product not found"));

    return toDTO(product);
}
```

**캐시 설정:**
```yaml
spring:
  cache:
    redis:
      time-to-live: 3600000  # 1시간
      cache-null-values: false
```

---

## 4. 검색 시스템 설계

### 4.1 전문 검색 (Full-Text Search)

```
Client: GET /api/search?q=노트북&page=0&size=20

↓

SearchController.search()
  ↓
ProductSearchService.search("노트북")
  ├─ 1. Elasticsearch Query DSL 생성
  ├─ 2. nori 분석기로 토큰화: ["노트북"]
  ├─ 3. name, description 필드 검색
  ├─ 4. isActive = true 필터
  ├─ 5. 관련도 점수 계산
  ├─ 6. 페이징 (0~19)
  └─ 7. SearchResponse 반환

↓

Response:
{
  "results": [
    {
      "id": 1,
      "name": "삼성 갤럭시 북3 노트북",
      "price": 1490000,
      "brand": "삼성",
      "score": 2.45
    },
    {
      "id": 2,
      "name": "LG 그램 17인치 노트북",
      "price": 1890000,
      "brand": "LG",
      "score": 2.12
    }
  ],
  "totalHits": 15,
  "page": 0,
  "size": 20
}
```

**Elasticsearch Query DSL:**
```java
public List<ProductDocument> search(String query) {
    NativeSearchQuery searchQuery = NativeSearchQueryBuilder.builder()
        .withQuery(QueryBuilders.multiMatchQuery(query)
            .field("name", 2.0f)        // name에 가중치 2배
            .field("description", 1.0f)
            .analyzer("nori")
        )
        .withFilter(QueryBuilders.termQuery("isActive", true))
        .withPageable(PageRequest.of(0, 20))
        .build();

    return elasticsearchOperations.search(searchQuery, ProductDocument.class)
        .getSearchHits()
        .stream()
        .map(SearchHit::getContent)
        .collect(Collectors.toList());
}
```

### 4.2 패싯 검색 (Faceted Search)

```
GET /api/search?q=노트북&category=컴퓨터&minPrice=1000000&maxPrice=2000000&brand=삼성

↓

ProductSearchService.searchWithFilters()
  ├─ 1. 기본 검색 쿼리 (q=노트북)
  ├─ 2. 필터 추가:
  │   ├─ categories: "컴퓨터"
  │   ├─ price: [1000000 TO 2000000]
  │   └─ brand: "삼성"
  ├─ 3. Aggregation (패싯 집계):
  │   ├─ categories (용어 집계)
  │   ├─ brands (용어 집계)
  │   └─ price_ranges (범위 집계)
  └─ 4. SearchResponseWithFacets 반환
```

**Query DSL:**
```java
BoolQueryBuilder boolQuery = QueryBuilders.boolQuery()
    .must(multiMatchQuery(query).fields("name", "description"))
    .filter(termQuery("categories", category))
    .filter(rangeQuery("price").gte(minPrice).lte(maxPrice))
    .filter(termQuery("brand", brand))
    .filter(termQuery("isActive", true));

NativeSearchQuery searchQuery = NativeSearchQueryBuilder.builder()
    .withQuery(boolQuery)
    .withAggregations(
        // 카테고리별 상품 수
        AggregationBuilders.terms("categories_agg").field("categories"),
        // 브랜드별 상품 수
        AggregationBuilders.terms("brands_agg").field("brand"),
        // 가격대별 상품 수
        AggregationBuilders.range("price_ranges")
            .field("price")
            .addRange(0, 500000)
            .addRange(500000, 1000000)
            .addRange(1000000, 2000000)
    )
    .build();
```

**Response with Facets:**
```json
{
  "results": [...],
  "facets": {
    "categories": [
      {"name": "노트북", "count": 8},
      {"name": "데스크톱", "count": 2}
    ],
    "brands": [
      {"name": "삼성", "count": 5},
      {"name": "LG", "count": 3},
      {"name": "ASUS", "count": 2}
    ],
    "priceRanges": [
      {"range": "0-500000", "count": 0},
      {"range": "500000-1000000", "count": 3},
      {"range": "1000000-2000000", "count": 7}
    ]
  }
}
```

### 4.3 자동완성 (Autocomplete)

```
GET /api/search/autocomplete?q=노트

↓

ProductSearchService.autocomplete("노트")
  ├─ 1. N-gram 분석기 사용 (name.ngram 필드)
  ├─ 2. Prefix Query
  ├─ 3. 상위 10개 제안
  └─ 4. 제안 목록 반환

↓

Response:
{
  "suggestions": [
    "노트북",
    "노트북 가방",
    "노트북 거치대",
    "노트북 쿨러"
  ]
}
```

**Query DSL:**
```java
NativeSearchQuery searchQuery = NativeSearchQueryBuilder.builder()
    .withQuery(QueryBuilders.matchQuery("name.ngram", query))
    .withFilter(termQuery("isActive", true))
    .withPageable(PageRequest.of(0, 10))
    .build();

return elasticsearchOperations.search(searchQuery, ProductDocument.class)
    .getSearchHits()
    .stream()
    .map(hit -> hit.getContent().getName())
    .distinct()
    .collect(Collectors.toList());
```

---

## 5. DB ↔ Elasticsearch 동기화

### 5.1 Dual-Write 패턴

```
ProductService.createProduct()
  @Transactional
  ├─ 1. productRepository.save(product)  // DB 저장
  └─ 2. productSearchService.indexProduct(product)  // ES 인덱싱

// 동일 트랜잭션 내에서 순차 실행
```

**장점:**
- 구현 간단
- 즉시 검색 가능

**단점:**
- Elasticsearch 실패 시 롤백 필요
- DB와 ES 사이 일시적 불일치 가능

**개선 (향후):**
- Change Data Capture (CDC): Debezium + Kafka
- Outbox Pattern: DB에 이벤트 저장 → 별도 프로세스가 ES 동기화

### 5.2 재인덱싱 (Bulk Reindex)

```bash
POST /api/admin/products/reindex
Authorization: Bearer <admin-token>

↓

ProductService.reindexAll()
  ├─ 1. 모든 활성 상품 조회 (페이징)
  ├─ 2. Elasticsearch 기존 인덱스 삭제 (선택적)
  ├─ 3. Bulk Insert (1000개씩)
  └─ 4. 완료 로그
```

**핵심 로직:**
```java
@Transactional(readOnly = true)
public void reindexAll() {
    log.info("Starting full reindex...");

    Pageable pageable = PageRequest.of(0, 1000);
    Page<Product> page;

    do {
        page = productRepository.findAll(pageable);
        List<ProductDocument> documents = page.getContent()
            .stream()
            .map(this::toDocument)
            .collect(Collectors.toList());

        // Bulk insert
        elasticsearchOperations.save(documents);

        log.info("Indexed {} products", documents.size());
        pageable = pageable.next();
    } while (page.hasNext());

    log.info("Reindex completed");
}
```

---

## 6. 캐싱 전략

### 6.1 캐시 구조

**Redis Key Structure:**
```
products::{id}              -> ProductDTO (TTL: 1시간)
categories::all             -> List<CategoryDTO> (TTL: 1일)
search::query::{hash}       -> SearchResponse (TTL: 10분)
```

### 6.2 Cache-aside Pattern

```
@Cacheable(value = "products", key = "#id")
public ProductDTO getProductById(Long id) {
    // 1. Redis 조회 (자동)
    // 2. 없으면 DB 조회
    Product product = productRepository.findById(id).orElseThrow();
    ProductDTO dto = toDTO(product);
    // 3. Redis 저장 (자동)
    return dto;
}
```

### 6.3 Cache Invalidation

**상품 수정 시:**
```java
@CacheEvict(value = "products", key = "#id")
public ProductDTO updateProduct(Long id, UpdateProductRequest request) {
    // 업데이트 로직
    // 캐시 무효화 (자동)
}
```

**상품 삭제 시:**
```java
@CacheEvict(value = "products", key = "#id")
public void deleteProduct(Long id) {
    productRepository.deleteById(id);
    productSearchService.deleteProduct(id.toString());
}
```

---

## 7. 성능 최적화

### 7.1 N+1 문제 해결

**문제:**
```java
// N+1 발생
List<Product> products = productRepository.findAll();
for (Product p : products) {
    p.getCategories().size();  // 각 상품마다 카테고리 조회 쿼리 발생
}
```

**해결:**
```java
@EntityGraph(attributePaths = {"categories"})
List<Product> findAllWithCategories();

// 또는 Fetch Join
@Query("SELECT p FROM Product p LEFT JOIN FETCH p.categories")
List<Product> findAllWithCategories();
```

### 7.2 Elasticsearch 인덱싱 성능

**Bulk Indexing:**
```java
// 개별 인덱싱 (느림)
for (Product p : products) {
    productSearchService.indexProduct(p);  // 각각 HTTP 요청
}

// Bulk 인덱싱 (빠름)
List<ProductDocument> docs = products.stream()
    .map(this::toDocument)
    .collect(Collectors.toList());
elasticsearchOperations.save(docs);  // 한 번의 요청
```

### 7.3 캐시 워밍 (Cache Warming)

**애플리케이션 시작 시:**
```java
@Component
public class CacheWarmingListener implements ApplicationListener<ApplicationReadyEvent> {
    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        log.info("Warming up cache...");

        // 인기 상품 캐싱
        List<Product> popularProducts = productRepository.findTop100ByOrderByViewsDesc();
        for (Product p : popularProducts) {
            productService.getProductById(p.getId());  // 캐시 저장
        }

        log.info("Cache warming completed");
    }
}
```

---

## 8. 테스트 전략

### 8.1 유닛 테스트

```java
@Test
void createProduct_Success() {
    // Given
    CreateProductRequest request = CreateProductRequest.builder()
        .name("테스트 상품")
        .price(10000L)
        .build();

    when(productRepository.save(any())).thenReturn(product);

    // When
    ProductDTO result = productService.createProduct(request);

    // Then
    assertThat(result.getName()).isEqualTo("테스트 상품");
    verify(productSearchService).indexProduct(any());
}
```

### 8.2 통합 테스트 (Elasticsearch)

```java
@SpringBootTest
@Testcontainers
class ProductSearchIntegrationTest {
    @Container
    static ElasticsearchContainer elasticsearch =
        new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:8.11.0");

    @Test
    void search_KoreanQuery_FindsProducts() {
        // Given
        productSearchService.indexProduct(product1);
        productSearchService.indexProduct(product2);

        // When
        List<ProductDocument> results = productSearchService.search("노트북");

        // Then
        assertThat(results).hasSize(2);
        assertThat(results).extracting("name")
            .contains("삼성 노트북", "LG 노트북");
    }
}
```

---

## 9. 검증 체크리스트

- [ ] 상품 생성/수정/삭제 (ADMIN 권한)
- [ ] 상품 목록 조회 (페이징)
- [ ] 상품 상세 조회 (캐시 히트)
- [ ] 카테고리 계층 구조 생성
- [ ] 한글 검색 동작 (Nori 토크나이저)
- [ ] 패싯 검색 (카테고리, 가격, 브랜드)
- [ ] 자동완성 동작
- [ ] DB-Elasticsearch 동기화 확인
- [ ] 캐시 무효화 동작
- [ ] N+1 문제 해결 검증
- [ ] Bulk 재인덱싱 기능
- [ ] 검색 응답 시간 p99 < 200ms
- [ ] 캐시 히트율 ≥ 80%
