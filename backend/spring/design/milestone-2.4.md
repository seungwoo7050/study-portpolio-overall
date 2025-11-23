# Elasticsearch 검색 통합 설계 일지 (Milestone 2.4)
> 상품 카탈로그에 전문 검색 기능을 추가하고 RDB와 검색 인덱스 동기화를 구현한 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 2.3까지의 기능 위에 **Elasticsearch 기반 전문 검색**을 추가한다:
- RDB(PostgreSQL/H2)와 Elasticsearch 이중 저장
- 키워드 검색 (name, description 대상)
- 다중 필터링 (카테고리, 브랜드, 가격 범위)
- 검색 인덱스 동기화 전략

상품 카탈로그 도메인을 통해 **검색 인덱스 설계 및 동기화 패턴**을 학습한다.

### 1.2 기능 요구사항

#### 1.2.1 도메인 모델

**Product (RDB 엔티티)**
- `id`: Long (PK)
- `name`: String
- `description`: String
- `category`: String (예: Electronics, Books, Clothing)
- `brand`: String
- `price`: BigDecimal
- `status`: Enum (ACTIVE, INACTIVE)
- `createdAt`, `updatedAt`: LocalDateTime

**ProductDocument (Elasticsearch 문서)**
- `id`: String (Product의 id와 동일)
- `name`: String (text, 전문 검색)
- `description`: String (text, 전문 검색)
- `category`: String (keyword, 정확 일치)
- `brand`: String (keyword, 정확 일치)
- `price`: Double (range 쿼리)
- `createdAt`: Instant (날짜 범위 쿼리 가능)

#### 1.2.2 API 엔드포인트

**상품 CRUD (RDB 기준):**
- `POST /api/products` - 상품 생성 (RDB + ES 인덱싱)
- `PUT /api/products/{id}` - 상품 수정 (RDB + ES 업데이트)
- `DELETE /api/products/{id}` - 상품 삭제 (RDB + ES 삭제)
- `GET /api/products/{id}` - 상품 상세 조회 (RDB)

**검색 API (Elasticsearch):**
- `GET /api/search/products`
  - 쿼리 파라미터:
    - `q`: 키워드 (name, description 대상)
    - `category`: 카테고리 필터
    - `brand`: 브랜드 필터
    - `minPrice`, `maxPrice`: 가격 범위
    - `page`, `size`: 페이징

### 1.3 비기능 요구사항

#### 1.3.1 검색 성능
- 키워드 검색 응답 시간 < 500ms (상품 10만 개 기준)
- 다중 필터 적용 시에도 일관된 성능

#### 1.3.2 데이터 일관성
- CRUD 작업 시 RDB와 ES 동기화
- 동기화 실패 시 로그 및 재시도 (선택)

#### 1.3.3 확장성
- Elasticsearch 인덱스 설정: 3 샤드, 1 레플리카
- 향후 한국어 토크나이저(Nori) 추가 가능한 구조

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 Elasticsearch인가?

**RDB 검색의 한계:**
- `LIKE '%keyword%'` 쿼리는 인덱스 활용 불가 → Full Table Scan
- 여러 필드에 대한 전문 검색 어려움
- 대량 데이터에서 성능 저하

**Elasticsearch의 장점:**
- **역색인 (Inverted Index)**: 토큰 기반 빠른 검색
- **다중 필드 매칭**: Multi-Match Query
- **다양한 필터**: Term, Range, Bool Query 조합
- **확장성**: 샤딩/레플리카로 수평 확장

**트레이드오프:**
- 추가 인프라 필요 (Elasticsearch 클러스터)
- 동기화 복잡도 증가
- → 검색 성능 향상이 필요한 경우 충분히 가치 있음

### 2.2 RDB + Elasticsearch 이중 저장 전략

**패턴: Dual Write**
```
┌─────────────────────────────────────┐
│  ProductService                     │
│  ┌───────────────────────────────┐ │
│  │ 1. RDB에 저장 (트랜잭션)       │ │
│  │ 2. Elasticsearch에 인덱싱     │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**왜 이 패턴인가?**
- **RDB**: Source of Truth (트랜잭션 보장)
- **Elasticsearch**: 검색 전용 읽기 복제본

**대안:**
1. **Change Data Capture (CDC)**: Debezium 등으로 RDB 변경 스트림 → Kafka → ES
   - 장점: 동기화 분리, 실패 복구 용이
   - 단점: 복잡도 높음
2. **Event Sourcing**: 이벤트 발행 → ES 구독
   - 장점: 느슨한 결합
   - 단점: 이벤트 인프라 필요

**우리의 선택: Dual Write (동기 인덱싱)**
- 이유: 학습 목적, 단순성
- 트레이드오프: 동기화 실패 처리 복잡

### 2.3 Elasticsearch 필드 타입 선택

| 필드 | 타입 | 이유 |
|------|------|------|
| name | text | 전문 검색 대상, 토큰화 필요 |
| description | text | 전문 검색 대상 |
| category | keyword | 정확 일치 필터, 집계 가능 |
| brand | keyword | 정확 일치 필터 |
| price | double | 범위 쿼리 (gte, lte) |
| createdAt | date | 날짜 범위 쿼리 (선택) |

**text vs keyword:**
- **text**: 분석기(analyzer)로 토큰화 → 부분 일치 검색
- **keyword**: 정규화 없이 저장 → 정확 일치, 집계, 정렬

---

## 3. Elasticsearch 설정 및 인덱스 설계

### 3.1 Spring Boot 설정

**build.gradle (의존성 추가):**
```gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-data-elasticsearch'
}
```

**application.yml:**
```yaml
spring:
  elasticsearch:
    uris: http://localhost:9200
```

### 3.2 ProductDocument (Elasticsearch 매핑)

**파일:** `search/domain/ProductDocument.java`

```java
@Document(indexName = "products")
@Setting(shards = 3, replicas = 1)
public class ProductDocument {

    @Id
    private String id;  // Product의 id와 동일 (String 변환)

    @Field(type = FieldType.Text)
    private String name;

    @Field(type = FieldType.Text)
    private String description;

    @Field(type = FieldType.Keyword)
    private String category;

    @Field(type = FieldType.Keyword)
    private String brand;

    @Field(type = FieldType.Double)
    private Double price;

    @Field(type = FieldType.Date, format = DateFormat.basic_date_time)
    private Instant createdAt;

    // 생성자, getter, setter

    public static ProductDocument from(Product product) {
        ProductDocument doc = new ProductDocument();
        doc.setId(String.valueOf(product.getId()));
        doc.setName(product.getName());
        doc.setDescription(product.getDescription());
        doc.setCategory(product.getCategory());
        doc.setBrand(product.getBrand());
        doc.setPrice(product.getPrice().doubleValue());
        doc.setCreatedAt(product.getCreatedAt().toInstant(ZoneOffset.UTC));
        return doc;
    }
}
```

**설계 포인트:**
- **@Document**: Elasticsearch 인덱스 이름 지정
- **@Setting**: 샤드/레플리카 설정
- **@Field**: 필드 타입 명시 (Text, Keyword, Double, Date)
- **from() 메서드**: Product 엔티티 → ProductDocument 변환

### 3.3 Elasticsearch Repository

**ProductSearchRepository:**
```java
public interface ProductSearchRepository extends ElasticsearchRepository<ProductDocument, String> {
    // Spring Data Elasticsearch가 기본 CRUD 제공
    // save(), findById(), delete() 등
}
```

---

## 4. 검색 서비스 설계

### 4.1 ProductSearchService

**파일:** `search/service/ProductSearchService.java`

```java
@Service
public class ProductSearchService {

    private final ElasticsearchOperations elasticsearchOperations;

    public ProductSearchService(ElasticsearchOperations elasticsearchOperations) {
        this.elasticsearchOperations = elasticsearchOperations;
    }

    public Page<ProductResponse> searchProducts(ProductSearchRequest searchRequest) {
        Pageable pageable = PageRequest.of(searchRequest.getPage(), searchRequest.getSize());

        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();

        // 1. 키워드 검색 (name, description)
        if (searchRequest.getQ() != null && !searchRequest.getQ().isEmpty()) {
            boolQueryBuilder.must(Query.of(q -> q
                .multiMatch(m -> m
                    .query(searchRequest.getQ())
                    .fields("name", "description")
                )
            ));
        }

        // 2. 카테고리 필터
        if (searchRequest.getCategory() != null && !searchRequest.getCategory().isEmpty()) {
            boolQueryBuilder.filter(Query.of(q -> q
                .term(t -> t
                    .field("category")
                    .value(searchRequest.getCategory())
                )
            ));
        }

        // 3. 브랜드 필터
        if (searchRequest.getBrand() != null && !searchRequest.getBrand().isEmpty()) {
            boolQueryBuilder.filter(Query.of(q -> q
                .term(t -> t
                    .field("brand")
                    .value(searchRequest.getBrand())
                )
            ));
        }

        // 4. 가격 범위 필터
        if (searchRequest.getMinPrice() != null || searchRequest.getMaxPrice() != null) {
            RangeQuery.Builder rangeBuilder = new RangeQuery.Builder().field("price");

            if (searchRequest.getMinPrice() != null) {
                rangeBuilder.gte(JsonData.of(searchRequest.getMinPrice().doubleValue()));
            }

            if (searchRequest.getMaxPrice() != null) {
                rangeBuilder.lte(JsonData.of(searchRequest.getMaxPrice().doubleValue()));
            }

            boolQueryBuilder.filter(Query.of(q -> q.range(rangeBuilder.build())));
        }

        // 5. 쿼리 빌드 및 실행
        NativeQuery query = NativeQuery.builder()
            .withQuery(Query.of(q -> q.bool(boolQueryBuilder.build())))
            .withPageable(pageable)
            .build();

        SearchHits<ProductDocument> searchHits = elasticsearchOperations.search(
            query,
            ProductDocument.class,
            IndexCoordinates.of("products")
        );

        // 6. 결과 변환
        List<ProductResponse> products = searchHits.getSearchHits().stream()
            .map(SearchHit::getContent)
            .map(ProductResponse::from)
            .collect(Collectors.toList());

        return PageableExecutionUtils.getPage(
            products,
            pageable,
            searchHits::getTotalHits
        );
    }
}
```

**설계 포인트:**
- **BoolQuery**: must(검색), filter(필터) 조합
  - `must`: 점수에 영향, 키워드 검색
  - `filter`: 점수 영향 없음, 정확 일치 필터 (캐싱 가능)
- **MultiMatchQuery**: 여러 필드에 동일 키워드 검색
- **TermQuery**: 정확 일치 (keyword 필드용)
- **RangeQuery**: 범위 검색 (gte, lte)
- **Pageable**: 페이징 지원

### 4.2 ProductSearchRequest DTO

```java
public class ProductSearchRequest {
    private String q;              // 키워드
    private String category;       // 카테고리 필터
    private String brand;          // 브랜드 필터
    private BigDecimal minPrice;   // 최소 가격
    private BigDecimal maxPrice;   // 최대 가격
    private int page = 0;          // 페이지 번호
    private int size = 20;         // 페이지 크기

    // Getters, Setters
}
```

---

## 5. RDB + Elasticsearch 동기화 패턴

### 5.1 ProductService (Dual Write)

**파일:** `search/service/ProductService.java`

```java
@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductSearchRepository productSearchRepository;

    public ProductService(ProductRepository productRepository,
                          ProductSearchRepository productSearchRepository) {
        this.productRepository = productRepository;
        this.productSearchRepository = productSearchRepository;
    }

    @Transactional
    public ProductResponse createProduct(CreateProductRequest request) {
        // 1. RDB에 저장
        Product product = new Product(
            request.getName(),
            request.getDescription(),
            request.getCategory(),
            request.getBrand(),
            request.getPrice()
        );
        product = productRepository.save(product);

        // 2. Elasticsearch에 인덱싱
        ProductDocument doc = ProductDocument.from(product);
        productSearchRepository.save(doc);

        return ProductResponse.from(product);
    }

    @Transactional
    public ProductResponse updateProduct(Long id, UpdateProductRequest request) {
        // 1. RDB 업데이트
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        if (request.getName() != null) product.setName(request.getName());
        if (request.getDescription() != null) product.setDescription(request.getDescription());
        if (request.getCategory() != null) product.setCategory(request.getCategory());
        if (request.getBrand() != null) product.setBrand(request.getBrand());
        if (request.getPrice() != null) product.setPrice(request.getPrice());

        product = productRepository.save(product);

        // 2. Elasticsearch 업데이트
        ProductDocument doc = ProductDocument.from(product);
        productSearchRepository.save(doc);

        return ProductResponse.from(product);
    }

    @Transactional
    public void deleteProduct(Long id) {
        // 1. RDB 삭제
        if (!productRepository.existsById(id)) {
            throw new ResourceNotFoundException("Product not found");
        }
        productRepository.deleteById(id);

        // 2. Elasticsearch 삭제
        productSearchRepository.deleteById(String.valueOf(id));
    }

    public ProductResponse getProduct(Long id) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        return ProductResponse.from(product);
    }
}
```

**설계 포인트:**
- **트랜잭션 내 동기화**: RDB 저장 후 ES 인덱싱
- **실패 처리**: ES 인덱싱 실패 시 트랜잭션 롤백 (선택적)
- **ID 일치**: RDB의 Long id를 String으로 변환하여 ES에 저장

### 5.2 동기화 실패 처리 (선택)

**전략 1: 예외 전파 (트랜잭션 롤백)**
```java
@Transactional
public void createProduct(...) {
    product = productRepository.save(product);

    // ES 인덱싱 실패 시 예외 발생 → 트랜잭션 롤백
    productSearchRepository.save(doc);
}
```

**전략 2: 로그 & 재시도 큐**
```java
@Transactional
public void createProduct(...) {
    product = productRepository.save(product);

    try {
        productSearchRepository.save(doc);
    } catch (Exception e) {
        log.error("Failed to index product: {}", product.getId(), e);
        // 재시도 큐에 추가 (예: Redis, Kafka)
    }
}
```

**우리의 선택: 전략 1 (간단 버전)**
- 이유: 학습 목적, 동기화 보장
- 트레이드오프: ES 장애 시 상품 생성 불가

---

## 6. Controller 계층

### 6.1 ProductController (CRUD)

```java
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(
            @Valid @RequestBody CreateProductRequest request,
            Authentication authentication) {

        ProductResponse response = productService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> getProduct(@PathVariable Long id) {
        ProductResponse product = productService.getProduct(id);
        return ResponseEntity.ok(product);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponse> updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProductRequest request) {

        ProductResponse updated = productService.updateProduct(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }
}
```

### 6.2 SearchController (검색)

```java
@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final ProductSearchService productSearchService;

    @GetMapping("/products")
    public ResponseEntity<Page<ProductResponse>> searchProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        ProductSearchRequest searchRequest = new ProductSearchRequest();
        searchRequest.setQ(q);
        searchRequest.setCategory(category);
        searchRequest.setBrand(brand);
        searchRequest.setMinPrice(minPrice);
        searchRequest.setMaxPrice(maxPrice);
        searchRequest.setPage(page);
        searchRequest.setSize(size);

        Page<ProductResponse> results = productSearchService.searchProducts(searchRequest);
        return ResponseEntity.ok(results);
    }
}
```

---

## 7. 테스트 전략

### 7.1 Elasticsearch 통합 테스트

**Testcontainers 사용 (권장):**
```java
@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class ProductSearchServiceTest {

    @Container
    static ElasticsearchContainer elasticsearch = new ElasticsearchContainer(
        "docker.elastic.co/elasticsearch/elasticsearch:8.10.0"
    );

    @DynamicPropertySource
    static void setProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.elasticsearch.uris", elasticsearch::getHttpHostAddress);
    }

    @Autowired
    private ProductSearchService productSearchService;

    @Autowired
    private ProductSearchRepository productSearchRepository;

    @BeforeEach
    void setUp() {
        productSearchRepository.deleteAll();

        // 테스트 데이터 인덱싱
        ProductDocument doc1 = new ProductDocument();
        doc1.setId("1");
        doc1.setName("Samsung Galaxy S24");
        doc1.setCategory("Electronics");
        doc1.setBrand("Samsung");
        doc1.setPrice(999.99);
        productSearchRepository.save(doc1);

        // 인덱스 리프레시 (즉시 검색 가능하게)
        elasticsearchOperations.indexOps(ProductDocument.class).refresh();
    }

    @Test
    void searchProducts_키워드검색() {
        ProductSearchRequest request = new ProductSearchRequest();
        request.setQ("Galaxy");

        Page<ProductResponse> results = productSearchService.searchProducts(request);

        assertThat(results.getContent()).hasSize(1);
        assertThat(results.getContent().get(0).getName()).contains("Galaxy");
    }

    @Test
    void searchProducts_카테고리필터() {
        ProductSearchRequest request = new ProductSearchRequest();
        request.setCategory("Electronics");

        Page<ProductResponse> results = productSearchService.searchProducts(request);

        assertThat(results.getContent()).allMatch(p -> p.getCategory().equals("Electronics"));
    }

    @Test
    void searchProducts_가격범위() {
        ProductSearchRequest request = new ProductSearchRequest();
        request.setMinPrice(BigDecimal.valueOf(500));
        request.setMaxPrice(BigDecimal.valueOf(1500));

        Page<ProductResponse> results = productSearchService.searchProducts(request);

        assertThat(results.getContent()).allMatch(p ->
            p.getPrice().compareTo(BigDecimal.valueOf(500)) >= 0 &&
            p.getPrice().compareTo(BigDecimal.valueOf(1500)) <= 0
        );
    }
}
```

**TestSearchConfig (Mock 사용 시):**
```java
@TestConfiguration
public class TestSearchConfig {

    @Bean
    @Primary
    public ProductSearchRepository productSearchRepository() {
        return Mockito.mock(ProductSearchRepository.class);
    }
}
```

### 7.2 동기화 테스트

**ProductServiceTest:**
```java
@SpringBootTest
@Transactional
class ProductServiceTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductSearchRepository productSearchRepository;

    @Test
    void createProduct_RDB와ES모두저장() {
        CreateProductRequest request = new CreateProductRequest(
            "Test Product", "Description", "Category", "Brand", BigDecimal.valueOf(100)
        );

        ProductResponse response = productService.createProduct(request);

        // RDB 확인
        assertThat(productRepository.findById(response.getId())).isPresent();

        // ES 확인
        assertThat(productSearchRepository.findById(String.valueOf(response.getId()))).isPresent();
    }

    @Test
    void deleteProduct_RDB와ES모두삭제() {
        // Given: 상품 생성
        Product product = productRepository.save(new Product(...));
        productSearchRepository.save(ProductDocument.from(product));

        // When: 삭제
        productService.deleteProduct(product.getId());

        // Then
        assertThat(productRepository.findById(product.getId())).isEmpty();
        assertThat(productSearchRepository.findById(String.valueOf(product.getId()))).isEmpty();
    }
}
```

---

## 8. 완료 기준 및 검증

### 8.1 로컬 검증

**1. 상품 생성:**
```bash
curl -X POST http://localhost:8080/api/products \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"iPhone 15","description":"Latest iPhone","category":"Electronics","brand":"Apple","price":1299.99}'
```

**2. 검색:**
```bash
# 키워드 검색
curl "http://localhost:8080/api/search/products?q=iPhone" \
  -H "Authorization: Bearer <TOKEN>"

# 다중 필터
curl "http://localhost:8080/api/search/products?category=Electronics&minPrice=1000&maxPrice=2000" \
  -H "Authorization: Bearer <TOKEN>"
```

**3. Elasticsearch 직접 확인:**
```bash
curl http://localhost:9200/products/_search?pretty
```

### 8.2 완료 체크리스트

- [x] Product 엔티티 및 ProductRepository
- [x] ProductDocument (Elasticsearch 매핑)
- [x] ProductSearchRepository
- [x] ProductSearchService (BoolQuery, MultiMatch, Range)
- [x] ProductService (Dual Write 동기화)
- [x] 검색 API (`GET /api/search/products`)
- [x] CRUD API와 ES 동기화 확인
- [x] Elasticsearch 통합 테스트 (Testcontainers)
- [x] 다중 필터 검색 테스트
- [x] CI 파이프라인에서 테스트 통과

---

## 9. 설계 결정 사항 및 트레이드오프

### 9.1 Dual Write vs CDC

| 방식 | 장점 | 단점 | 선택 이유 |
|------|------|------|-----------|
| Dual Write | 간단, 즉시 동기화 | 동기화 실패 처리 복잡, ES 장애 시 영향 | **선택**: 학습 목적 |
| CDC (Debezium) | 동기화 분리, 재시도 용이 | 인프라 복잡, 약간의 지연 | 프로덕션 권장 |

### 9.2 Testcontainers vs Mock

**선택: Testcontainers (권장)**
- **장점**: 실제 Elasticsearch 동작 검증
- **단점**: 테스트 시간 증가, Docker 필요
- **대안**: Mock으로 단위 테스트, 통합 테스트는 수동

---

## 10. 알려진 제약 & 향후 개선점

### 10.1 현재 제약

1. **한국어 토크나이저 미적용**
   - 현재 기본 analyzer 사용
   - 개선: Nori (Korean) analyzer 추가

2. **전체 재색인 기능 없음**
   - 동기화 실패 시 복구 어려움
   - 개선: 관리자 API로 전체 재색인

3. **검색 점수 튜닝 부족**
   - 모든 필드 동일 가중치
   - 개선: boost 설정, 관련도 튜닝

4. **실시간성 부족**
   - ES의 refresh_interval (기본 1초)
   - 개선: 실시간 요구 시 refresh 강제

### 10.2 다음 마일스톤 (2.5)에서 추가될 것

**도메인:**
- Order, OrderItem, Notification

**패턴:**
- Kafka 이벤트 발행 (Producer)
- Kafka 이벤트 소비 (Consumer)
- 비동기 처리 (주문 → 알림)

**테스트:**
- Kafka 통합 테스트 (Awaitility)
- 이벤트 발행/소비 검증

---

## 11. 결론

Milestone 2.4에서 확립한 것:
- ✅ Elasticsearch 인덱스 설계
- ✅ BoolQuery, MultiMatch, Range 쿼리
- ✅ RDB + ES Dual Write 동기화 패턴
- ✅ 다중 필터 검색 구현
- ✅ Testcontainers 통합 테스트

**핵심 성과:**
- **검색 인덱스 설계 패턴** 학습
- RDB와 검색 엔진의 **책임 분리** 이해
- 이후 대규모 검색 시스템 구축 기반 마련

**다음 단계 (Milestone 2.5):**
- Kafka 이벤트 스트리밍
- 비동기 이벤트 처리
- Producer/Consumer 패턴
