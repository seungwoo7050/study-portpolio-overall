# Stage 3.1: 검색 (Search) - Elasticsearch + Nori

## 문서 정보
- **작성일**: 2025-11-23
- **Stage**: 3.1 - Search
- **구성 요소**: Elasticsearch 8.11.0, Nori Analysis Plugin
- **상태**: ✅ 구현 완료

---

## 목차
1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [Nori Tokenizer](#nori-tokenizer)
4. [Product Document 매핑](#product-document-매핑)
5. [검색 기능](#검색-기능)
6. [인덱싱 전략](#인덱싱-전략)
7. [검색 최적화](#검색-최적화)
8. [메트릭 및 모니터링](#메트릭-및-모니터링)
9. [모범 사례](#모범-사례)
10. [트러블슈팅](#트러블슈팅)

---

## 개요

### 왜 Elasticsearch인가?

**기존 데이터베이스 검색의 한계**:
```sql
-- LIKE 검색 (느리고 부정확)
SELECT * FROM products
WHERE name LIKE '%노트북%' OR description LIKE '%노트북%';

-- 문제점:
-- 1. 인덱스 사용 불가 (Full Table Scan)
-- 2. 한국어 형태소 분석 불가 ("노트북" ≠ "노트북을", "노트북이")
-- 3. 관련도 순위 정렬 불가
-- 4. 느린 성능 (100만 건 이상)
```

**Elasticsearch의 장점**:
- **빠른 전문 검색**: 역인덱스(Inverted Index) 구조
- **한국어 지원**: Nori Tokenizer
- **관련도 순위**: TF-IDF, BM25 알고리즘
- **Faceted Search**: 카테고리, 가격, 브랜드 필터
- **실시간 검색**: Near real-time (1초 이내)

### Nori Analysis Plugin

**Nori**: Elasticsearch의 공식 한국어 형태소 분석 플러그인

**기능**:
- **형태소 분석**: "노트북을" → "노트북" + "을"
- **복합어 분해**: "삼성전자" → "삼성" + "전자" (decompound_mode)
- **품사 태깅**: "빠른", "빨리" → 형용사, 부사 구분
- **불용어 제거**: 조사, 어미 등 제거

---

## 아키텍처

### 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Request                            │
│  GET /api/products/search?q=노트북&category=전자제품           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ProductController                               │
│  @GetMapping("/search")                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            ProductSearchService                              │
│  - search(query, pageable)                                   │
│  - facetedSearch(request, pageable)                          │
│  - autocomplete(prefix, limit)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         ProductSearchRepository                              │
│  ElasticsearchRepository<ProductDocument, Long>              │
│  - searchByNameOrDescription(query, pageable)                │
│  - facetedSearch(query, category, min, max, pageable)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP REST API (port 9200)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Elasticsearch 8.11.0                        │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Index: products                          │  │
│  │  - Analyzer: nori (Korean)                            │  │
│  │  - Settings: product-settings.json                    │  │
│  │  - Mappings: ProductDocument 자동 생성                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Nori Analysis Plugin                       │  │
│  │  - Tokenizer: nori_tokenizer                          │  │
│  │  - Decompound Mode: mixed                             │  │
│  │  - Part of Speech Filter: 불용어 제거                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Inverted Index                           │  │
│  │  "노트북" → [doc1, doc3, doc7]                         │  │
│  │  "삼성" → [doc1, doc5]                                 │  │
│  │  "LG" → [doc2, doc4]                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Indexing Flow (Product 생성/수정 시):

ProductService.createProduct(product)
  ↓
@AfterReturning → ProductService
  ↓
productSearchService.indexProduct(product)
  ↓
ProductDocument document = mapToDocument(product)
  ↓
searchRepository.save(document)
  ↓
Elasticsearch Index 저장
```

### Spring Data Elasticsearch 통합

**의존성**:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
</dependency>
```

**설정** (`application.yml`):
```yaml
spring:
  elasticsearch:
    uris: ${ELASTICSEARCH_URIS:http://localhost:9200}
    connection-timeout: 10s
    socket-timeout: 30s
```

**위치**: `/e-commerce/src/main/resources/application.yml:33-36`

---

## Nori Tokenizer

### Nori Plugin 설치

**Dockerfile**:
```dockerfile
FROM docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Install Nori (Korean) analysis plugin
RUN bin/elasticsearch-plugin install --batch analysis-nori

# Configure Elasticsearch
RUN echo "xpack.security.enabled: false" >> config/elasticsearch.yml
RUN echo "discovery.type: single-node" >> config/elasticsearch.yml
```

**위치**: `/e-commerce/infrastructure/docker/Dockerfile.elasticsearch`

### Analyzer 설정

**product-settings.json**:
```json
{
  "analysis": {
    "analyzer": {
      "nori": {
        "type": "custom",
        "tokenizer": "nori_tokenizer",
        "filter": [
          "lowercase",
          "nori_part_of_speech"
        ]
      }
    },
    "tokenizer": {
      "nori_tokenizer": {
        "type": "nori_tokenizer",
        "decompound_mode": "mixed"
      }
    },
    "filter": {
      "nori_part_of_speech": {
        "type": "nori_part_of_speech",
        "stoptags": [
          "E", "IC", "J", "MAG", "MAJ", "MM", "SP",
          "SSC", "SSO", "SC", "SE", "XPN", "XSA",
          "XSN", "XSV", "UNA", "NA", "VSV"
        ]
      }
    }
  }
}
```

**위치**: `/e-commerce/src/main/resources/elasticsearch/product-settings.json`

### Decompound Mode

**종류**:
1. **none**: 복합어 분해 안함
   - "삼성전자" → ["삼성전자"]

2. **discard** (기본값): 원본 제거, 분해된 것만
   - "삼성전자" → ["삼성", "전자"]

3. **mixed**: 원본 + 분해된 것 모두 유지
   - "삼성전자" → ["삼성전자", "삼성", "전자"]

**Sagaline 설정**: `mixed` (검색 커버리지 최대화)

### 품사 태그 (Part of Speech)

**제거되는 품사** (stoptags):
- **E**: 어미 (예: ~었다, ~입니다)
- **J**: 조사 (예: ~을, ~를, ~이, ~가)
- **MAG**: 일반 부사 (예: 매우, 아주)
- **SC**: 구분자 (예: 쉼표, 마침표)
- **SP**: 공백

**유지되는 품사**:
- **NNG**: 일반 명사 (예: 노트북, 삼성)
- **NNP**: 고유 명사 (예: 갤럭시, LG)
- **SL**: 외래어 (예: Laptop, Computer)
- **SN**: 숫자 (예: 15, 512)

### Nori Tokenizer 예시

**입력 텍스트**:
```
"삼성 갤럭시 노트북 15인치 512GB"
```

**Nori 분석 결과**:
```json
{
  "tokens": [
    {"token": "삼성", "position": 0, "type": "word"},
    {"token": "갤럭시", "position": 1, "type": "word"},
    {"token": "노트북", "position": 2, "type": "word"},
    {"token": "15", "position": 3, "type": "word"},
    {"token": "인치", "position": 4, "type": "word"},
    {"token": "512", "position": 5, "type": "word"},
    {"token": "gb", "position": 6, "type": "word"}
  ]
}
```

**Elasticsearch Analyze API로 테스트**:
```bash
curl -X POST "localhost:9200/products/_analyze" \
  -H 'Content-Type: application/json' \
  -d '{
    "analyzer": "nori",
    "text": "삼성 갤럭시 노트북 15인치 512GB"
  }'
```

---

## Product Document 매핑

### ProductDocument Entity

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "products")
@Setting(settingPath = "elasticsearch/product-settings.json")
public class ProductDocument {

    @Id
    private Long id;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String name;

    @Field(type = FieldType.Text, analyzer = "nori")
    private String description;

    @Field(type = FieldType.Keyword)
    private String category;

    @Field(type = FieldType.Long)
    private Long price;

    @Field(type = FieldType.Keyword)
    private String brand;

    @Field(type = FieldType.Integer)
    private Integer stock;

    @Field(type = FieldType.Date)
    private LocalDateTime createdAt;

    @Field(type = FieldType.Date)
    private LocalDateTime updatedAt;
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/search/ProductDocument.java`

### Field Type 설명

#### Text vs Keyword

**Text** (전문 검색용):
- **analyzer 적용**: "삼성 노트북" → ["삼성", "노트북"]
- **부분 매칭**: "노트" 검색 시 "노트북" 매칭
- **대소문자 무시**: "SAMSUNG" = "samsung"
- **사용 필드**: `name`, `description`

**Keyword** (정확한 매칭용):
- **analyzer 미적용**: "전자제품" → ["전자제품"] (그대로)
- **완전 일치**: "전자" 검색 시 "전자제품" 매칭 안됨
- **대소문자 구분**: "Electronics" ≠ "electronics"
- **집계/정렬**: 카테고리, 브랜드 facet에 사용
- **사용 필드**: `category`, `brand`

**Long/Integer** (숫자):
- **범위 검색**: `price >= 100000 AND price <= 200000`
- **정렬**: 가격순, 재고순 정렬

**Date** (날짜):
- **범위 검색**: 최근 1주일 신상품
- **정렬**: 최신순 정렬

### Mapping Example

**Elasticsearch에서 자동 생성된 매핑**:
```json
{
  "products": {
    "mappings": {
      "properties": {
        "id": {"type": "long"},
        "name": {
          "type": "text",
          "analyzer": "nori",
          "fields": {
            "keyword": {"type": "keyword"}
          }
        },
        "description": {
          "type": "text",
          "analyzer": "nori"
        },
        "category": {"type": "keyword"},
        "price": {"type": "long"},
        "brand": {"type": "keyword"},
        "stock": {"type": "integer"},
        "createdAt": {"type": "date"},
        "updatedAt": {"type": "date"}
      }
    }
  }
}
```

---

## 검색 기능

### 1. Full-text Search (전문 검색)

**쿼리**:
```
GET /api/products/search?q=노트북
```

**ProductSearchRepository**:
```java
@Query("{\"multi_match\": {\"query\": \"?0\", \"fields\": [\"name^2\", \"description\"], \"type\": \"best_fields\"}}")
Page<ProductDocument> searchByNameOrDescription(String query, Pageable pageable);
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/search/ProductSearchRepository.java:19-20`

**Elasticsearch Query DSL**:
```json
{
  "query": {
    "multi_match": {
      "query": "노트북",
      "fields": ["name^2", "description"],
      "type": "best_fields"
    }
  }
}
```

**설명**:
- `multi_match`: 여러 필드에서 검색
- `name^2`: name 필드에 2배 가중치 (제목이 본문보다 중요)
- `description`: description 필드 (가중치 1)
- `best_fields`: 가장 높은 점수 필드 사용

**검색 예시**:
```
Query: "삼성 노트북"

Results:
1. "삼성 갤럭시북 15.6인치 노트북" (score: 8.5)
   - name 매칭: "삼성" + "노트북" (boost x2)

2. "LG 그램 노트북 - 삼성 SSD 장착" (score: 5.2)
   - description 매칭: "삼성" + "노트북"

3. "삼성 모니터 27인치" (score: 2.1)
   - name 매칭: "삼성" only
```

### 2. Faceted Search (패싯 검색)

**쿼리**:
```
GET /api/products/search?q=노트북&category=전자제품&minPrice=1000000&maxPrice=2000000
```

**ProductSearchRepository**:
```java
@Query("{\"bool\": {\"must\": [{\"multi_match\": {\"query\": \"?0\", \"fields\": [\"name^2\", \"description\"]}}], \"filter\": [{\"term\": {\"category\": \"?1\"}}, {\"range\": {\"price\": {\"gte\": ?2, \"lte\": ?3}}}]}}")
Page<ProductDocument> facetedSearch(String query, String category, Long minPrice, Long maxPrice, Pageable pageable);
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/search/ProductSearchRepository.java:40-41`

**Elasticsearch Query DSL**:
```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "노트북",
            "fields": ["name^2", "description"]
          }
        }
      ],
      "filter": [
        {"term": {"category": "전자제품"}},
        {"range": {"price": {"gte": 1000000, "lte": 2000000}}}
      ]
    }
  }
}
```

**설명**:
- `bool.must`: 반드시 매칭 (점수에 영향)
- `bool.filter`: 필터링 (점수에 영향 없음, 빠름)
- `term`: 정확한 매칭 (category)
- `range`: 범위 검색 (price)

**점수 계산**:
- `must` 조건만 점수 계산
- `filter` 조건은 yes/no 판단만 (점수 미영향)
- 결과: 빠른 성능 + 정확한 순위

### 3. Autocomplete (자동 완성)

**쿼리**:
```
GET /api/products/autocomplete?prefix=노트
```

**ProductSearchService**:
```java
public List<String> autocomplete(String prefix, int limit) {
    Pageable pageable = Pageable.ofSize(limit);
    Page<ProductDocument> results = searchRepository.searchByNameOrDescription(prefix, pageable);

    return results.getContent().stream()
            .map(ProductDocument::getName)
            .distinct()
            .limit(limit)
            .collect(Collectors.toList());
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/search/ProductSearchService.java:140-149`

**결과 예시**:
```json
[
  "노트북",
  "노트북 가방",
  "노트북 스탠드",
  "노트북 쿨러",
  "노트북 받침대"
]
```

### 4. Category Search (카테고리 검색)

```java
Page<ProductDocument> findByCategory(String category, Pageable pageable);
```

**Elasticsearch Query**:
```json
{
  "query": {
    "term": {
      "category": "전자제품"
    }
  }
}
```

### 5. Price Range Search (가격 범위 검색)

```java
Page<ProductDocument> findByPriceBetween(Long minPrice, Long maxPrice, Pageable pageable);
```

**Elasticsearch Query**:
```json
{
  "query": {
    "range": {
      "price": {
        "gte": 1000000,
        "lte": 2000000
      }
    }
  }
}
```

### 6. Brand Search (브랜드 검색)

```java
Page<ProductDocument> findByBrand(String brand, Pageable pageable);
```

**Elasticsearch Query**:
```json
{
  "query": {
    "term": {
      "brand": "삼성"
    }
  }
}
```

---

## 인덱싱 전략

### 1. Automatic Indexing (자동 인덱싱)

**ProductService에서 Product 생성/수정 시 자동 인덱싱**:

```java
@Service
public class ProductService {

    private final ProductSearchService searchService;

    @Transactional
    public Product createProduct(ProductRequest request) {
        // 1. Database에 저장
        Product product = productRepository.save(newProduct);

        // 2. Elasticsearch에 인덱싱
        searchService.indexProduct(product);

        return product;
    }

    @Transactional
    public Product updateProduct(Long id, ProductRequest request) {
        Product product = productRepository.save(updatedProduct);

        // Elasticsearch 업데이트
        searchService.indexProduct(product);

        return product;
    }

    @Transactional
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);

        // Elasticsearch에서 삭제
        searchService.deleteProduct(id);
    }
}
```

### 2. Bulk Reindexing (전체 재인덱싱)

**사용 시기**:
- 초기 데이터 마이그레이션
- 매핑 변경 후 재인덱싱
- 인덱스 손상 복구

**ProductSearchService**:
```java
@Transactional(readOnly = true)
public void reindexAllProducts() {
    log.info("Starting full reindex of products");
    List<Product> products = productRepository.findAll();

    List<ProductDocument> documents = products.stream()
            .map(this::mapToDocument)
            .collect(Collectors.toList());

    searchRepository.saveAll(documents);
    log.info("Reindexed {} products", documents.size());

    Counter.builder("search.reindex.total")
            .description("Number of full reindex operations")
            .register(meterRegistry)
            .increment();
}
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/search/ProductSearchService.java:53-69`

**실행**:
```bash
# API를 통해 재인덱싱 트리거
curl -X POST http://localhost:8080/api/admin/products/reindex
```

### 3. Incremental Indexing (증분 인덱싱)

**배치 스케줄링** (향후 구현):
```java
@Scheduled(cron = "0 0 2 * * *")  // 매일 새벽 2시
public void incrementalReindex() {
    LocalDateTime lastIndexTime = getLastIndexTime();

    List<Product> updatedProducts = productRepository
        .findByUpdatedAtAfter(lastIndexTime);

    updatedProducts.forEach(product ->
        searchService.indexProduct(product)
    );
}
```

---

## 검색 최적화

### 1. Boosting (필드 가중치)

```json
{
  "query": {
    "multi_match": {
      "query": "노트북",
      "fields": [
        "name^2",        // name 필드: 가중치 2
        "description^1", // description 필드: 가중치 1
        "category^0.5"   // category 필드: 가중치 0.5
      ]
    }
  }
}
```

**효과**:
- 제목에 "노트북"이 있으면 점수 2배
- 본문에 "노트북"이 있으면 기본 점수
- 카테고리에 "노트북"이 있으면 점수 0.5배

### 2. Pagination (페이지네이션)

**from-size 방식** (기본):
```java
Pageable pageable = PageRequest.of(0, 20);  // page=0, size=20
Page<ProductDocument> results = searchRepository.search(query, pageable);
```

**Elasticsearch Query**:
```json
{
  "from": 0,
  "size": 20,
  "query": {...}
}
```

**한계**:
- `from + size <= 10,000` (Elasticsearch 제한)
- Deep pagination 성능 저하

**Search After** (대량 데이터):
```json
{
  "size": 20,
  "query": {...},
  "search_after": [1234567890],  // 이전 페이지 마지막 문서의 sort 값
  "sort": [{"createdAt": "desc"}]
}
```

### 3. Highlighting (검색어 강조)

**쿼리**:
```json
{
  "query": {...},
  "highlight": {
    "fields": {
      "name": {},
      "description": {}
    },
    "pre_tags": ["<em>"],
    "post_tags": ["</em>"]
  }
}
```

**결과**:
```json
{
  "name": "삼성 <em>노트북</em> 15인치",
  "description": "고성능 <em>노트북</em>으로..."
}
```

### 4. Filtering vs Querying

**Query** (점수 계산):
```json
{
  "query": {
    "match": {"name": "노트북"}
  }
}
```
- TF-IDF 점수 계산
- 느림

**Filter** (점수 계산 안함):
```json
{
  "query": {
    "bool": {
      "filter": [
        {"term": {"category": "전자제품"}}
      ]
    }
  }
}
```
- Yes/No 판단만
- 빠름 (캐시 가능)

**권장**:
- 검색어: `query` (점수 필요)
- 필터: `filter` (점수 불필요, 빠름)

---

## 메트릭 및 모니터링

### Custom Metrics

**ProductSearchService**:
```java
// 인덱싱 메트릭
Counter.builder("search.index.products")
        .description("Number of products indexed")
        .register(meterRegistry)
        .increment();

Timer.builder("search.index.duration")
        .description("Time to index a product")
        .register(meterRegistry)
        .record(duration);

// 검색 메트릭
Counter.builder("search.queries")
        .tag("type", "fulltext")  // or "faceted"
        .description("Number of search queries")
        .register(meterRegistry)
        .increment();

Timer.builder("search.query.duration")
        .tag("type", "fulltext")
        .description("Time to execute search query")
        .register(meterRegistry)
        .record(duration);

// 재인덱싱 메트릭
Counter.builder("search.reindex.total")
        .description("Number of full reindex operations")
        .register(meterRegistry)
        .increment();
```

**위치**: `/e-commerce/src/main/java/com/sagaline/product/search/ProductSearchService.java:39-42,79-83`

### Prometheus Queries

**검색 쿼리 수**:
```promql
rate(search_queries_total[5m])
```

**평균 검색 시간**:
```promql
rate(search_query_duration_seconds_sum[5m]) /
rate(search_query_duration_seconds_count[5m])
```

**인덱싱 속도**:
```promql
rate(search_index_products_total[5m])
```

### Grafana Dashboard

**패널**:
1. Search Queries per Second
2. Average Search Latency
3. Indexing Rate
4. Search Type Distribution (fulltext vs faceted)

---

## 모범 사례

### 1. 적절한 Analyzer 선택

**한국어 텍스트**: `nori` analyzer
```java
@Field(type = FieldType.Text, analyzer = "nori")
private String name;
```

**영어 텍스트**: `standard` analyzer (기본값)
```java
@Field(type = FieldType.Text)
private String englishName;
```

**코드, URL**: `keyword` (분석 안함)
```java
@Field(type = FieldType.Keyword)
private String sku;
```

### 2. Text와 Keyword 멀티 필드

```json
{
  "name": {
    "type": "text",
    "analyzer": "nori",
    "fields": {
      "keyword": {
        "type": "keyword"
      }
    }
  }
}
```

**사용**:
- `name`: 검색용
- `name.keyword`: 정렬, 집계용

### 3. 인덱스 설계

**별도 인덱스 vs 단일 인덱스**:

❌ **나쁜 예** (모든 타입을 하나의 인덱스에):
```
products: {product, review, seller, ...}
```

✅ **좋은 예** (타입별 별도 인덱스):
```
products: Product 문서
reviews: Review 문서
sellers: Seller 문서
```

### 4. 샤드 설정

**개발 환경**:
```json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

**프로덕션** (100만 문서 기준):
```json
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1
  }
}
```

**가이드**:
- 샤드 크기: 20-40GB
- 총 문서 수 / 250,000 = 샤드 개수

### 5. 검색 결과 캐싱

**Request Cache** (동일한 쿼리):
```json
{
  "query": {...},
  "size": 0  // 집계 결과만 (캐시 가능)
}
```

**애플리케이션 레벨 캐싱**:
```java
@Cacheable(value = "product-search", key = "#query")
public Page<ProductDocument> search(String query, Pageable pageable) {
    return searchRepository.searchByNameOrDescription(query, pageable);
}
```

---

## 트러블슈팅

### 문제 1: 한국어 검색이 작동하지 않음

**증상**:
```
Query: "노트북"
Results: 0 results
```

**원인**: Nori plugin 미설치

**해결**:
```bash
# Elasticsearch 컨테이너 접속
docker exec -it sagaline-elasticsearch bash

# Nori plugin 설치 확인
bin/elasticsearch-plugin list

# 없으면 설치
bin/elasticsearch-plugin install analysis-nori

# Elasticsearch 재시작
docker restart sagaline-elasticsearch
```

### 문제 2: 복합어 검색 실패

**증상**:
```
Query: "삼성전자"
Results: 0 results (하지만 "삼성"으로는 검색됨)
```

**원인**: `decompound_mode: discard` (원본 제거)

**해결**:
```json
{
  "tokenizer": {
    "nori_tokenizer": {
      "type": "nori_tokenizer",
      "decompound_mode": "mixed"  // discard → mixed
    }
  }
}
```

### 문제 3: 검색 점수가 이상함

**증상**:
- 관련성 낮은 문서가 상위 노출
- 점수가 모두 1.0

**원인**: `term` 쿼리 사용 (점수 고정)

**해결**:
```java
// ❌ term query (점수 없음)
{"term": {"name": "노트북"}}

// ✅ match query (TF-IDF 점수)
{"match": {"name": "노트북"}}
```

### 문제 4: Elasticsearch 연결 실패

**증상**:
```
org.springframework.data.elasticsearch.NoReachableHostException:
  Unable to connect to localhost:9200
```

**해결**:
```bash
# Elasticsearch 상태 확인
curl http://localhost:9200

# Docker 컨테이너 확인
docker ps | grep elasticsearch

# 로그 확인
docker logs sagaline-elasticsearch

# application.yml 확인
spring.elasticsearch.uris: http://localhost:9200
```

### 문제 5: 인덱스 매핑 충돌

**증상**:
```
MapperParsingException:
  Field 'price' is defined as [long] in mapping but [text] in document
```

**원인**: 기존 인덱스 매핑과 불일치

**해결**:
```bash
# 인덱스 삭제
curl -X DELETE http://localhost:9200/products

# 애플리케이션 재시작 (자동 매핑 재생성)
# 또는 재인덱싱
curl -X POST http://localhost:8080/api/admin/products/reindex
```

---

## 참고 자료

### 내부 문서
- [메트릭 수집 (Prometheus)](../stage2/metrics-prometheus.md)
- [캐싱 (Redis)](./caching-redis.md)
- [State.yml](../../.meta/state.yml)

### 외부 리소스
- [Elasticsearch 공식 문서](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Nori Analysis Plugin](https://www.elastic.co/guide/en/elasticsearch/plugins/current/analysis-nori.html)
- [Spring Data Elasticsearch](https://docs.spring.io/spring-data/elasticsearch/docs/current/reference/html/)
- [Elasticsearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)

### 구현 파일 위치
- ProductDocument: `/e-commerce/src/main/java/com/sagaline/product/search/ProductDocument.java`
- ProductSearchService: `/e-commerce/src/main/java/com/sagaline/product/search/ProductSearchService.java`
- ProductSearchRepository: `/e-commerce/src/main/java/com/sagaline/product/search/ProductSearchRepository.java`
- Nori Settings: `/e-commerce/src/main/resources/elasticsearch/product-settings.json`
- Dockerfile: `/e-commerce/infrastructure/docker/Dockerfile.elasticsearch`
- Application Config: `/e-commerce/src/main/resources/application.yml:33-36`

---

**문서 버전**: 1.0
**최종 수정일**: 2025-11-23
**작성자**: Claude (Design Documentation)
