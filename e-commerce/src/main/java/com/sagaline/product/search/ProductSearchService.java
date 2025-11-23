package com.sagaline.product.search;

import com.sagaline.product.domain.Product;
import com.sagaline.product.repository.ProductRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@ConditionalOnBean(ProductSearchRepository.class)
@RequiredArgsConstructor
public class ProductSearchService {

    private final ProductSearchRepository searchRepository;
    private final ProductRepository productRepository;
    private final MeterRegistry meterRegistry;

    /**
     * Index a product in Elasticsearch
     */
    public void indexProduct(Product product) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            ProductDocument document = mapToDocument(product);
            searchRepository.save(document);
            log.info("Indexed product: id={}, name={}", product.getId(), product.getName());

            Counter.builder("search.index.products")
                    .description("Number of products indexed")
                    .register(meterRegistry)
                    .increment();
        } finally {
            sample.stop(Timer.builder("search.index.duration")
                    .description("Time to index a product")
                    .register(meterRegistry));
        }
    }

    /**
     * Bulk index all products from database to Elasticsearch
     */
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

    /**
     * Full-text search with Korean support
     */
    public Page<ProductDocument> search(String query, Pageable pageable) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            Page<ProductDocument> results = searchRepository.searchByNameOrDescription(query, pageable);

            Counter.builder("search.queries")
                    .tag("type", "fulltext")
                    .description("Number of search queries")
                    .register(meterRegistry)
                    .increment();

            return results;
        } finally {
            sample.stop(Timer.builder("search.query.duration")
                    .tag("type", "fulltext")
                    .description("Time to execute search query")
                    .register(meterRegistry));
        }
    }

    /**
     * Faceted search with filters
     */
    public Page<ProductDocument> facetedSearch(SearchRequest request, Pageable pageable) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            Page<ProductDocument> results;

            if (request.hasAllFilters()) {
                results = searchRepository.facetedSearch(
                        request.getQuery(),
                        request.getCategory(),
                        request.getMinPrice(),
                        request.getMaxPrice(),
                        pageable
                );
            } else if (request.getCategory() != null) {
                results = searchRepository.findByCategory(request.getCategory(), pageable);
            } else if (request.hasPrice()) {
                results = searchRepository.findByPriceBetween(
                        request.getMinPrice(),
                        request.getMaxPrice(),
                        pageable
                );
            } else {
                results = search(request.getQuery(), pageable);
            }

            Counter.builder("search.queries")
                    .tag("type", "faceted")
                    .description("Number of search queries")
                    .register(meterRegistry)
                    .increment();

            return results;
        } finally {
            sample.stop(Timer.builder("search.query.duration")
                    .tag("type", "faceted")
                    .description("Time to execute search query")
                    .register(meterRegistry));
        }
    }

    /**
     * Autocomplete suggestions
     */
    public List<String> autocomplete(String prefix, int limit) {
        Pageable pageable = Pageable.ofSize(limit);
        Page<ProductDocument> results = searchRepository.searchByNameOrDescription(prefix, pageable);

        return results.getContent().stream()
                .map(ProductDocument::getName)
                .distinct()
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * Delete product from index
     */
    public void deleteProduct(Long productId) {
        searchRepository.deleteById(productId);
        log.info("Deleted product from index: id={}", productId);
    }

    /**
     * Map Product entity to ProductDocument
     */
    private ProductDocument mapToDocument(Product product) {
        // Get the first category (products can have multiple categories)
        String categoryName = product.getCategories() != null && !product.getCategories().isEmpty()
                ? product.getCategories().iterator().next().getName()
                : null;

        // Convert BigDecimal price to Long (cents/won)
        Long priceInCents = product.getPrice() != null
                ? product.getPrice().multiply(new java.math.BigDecimal("100")).longValue()
                : 0L;

        return ProductDocument.builder()
                .id(product.getId())
                .name(product.getName())
                .description(product.getDescription())
                .category(categoryName)
                .price(priceInCents)
                .brand(product.getBrand() != null ? product.getBrand() : "Unknown")
                .stock(0) // Stock will be from inventory service later
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }
}
