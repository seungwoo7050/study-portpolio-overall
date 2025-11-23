package com.sagaline.product.search;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/search")
@ConditionalOnBean(ProductSearchService.class)
@RequiredArgsConstructor
public class SearchController {

    private final ProductSearchService searchService;

    /**
     * Full-text search endpoint
     * GET /api/search?q=노트북&page=0&size=20
     */
    @GetMapping
    public ResponseEntity<Page<ProductDocument>> search(
            @RequestParam("q") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection
    ) {
        log.info("Search request: query={}, page={}, size={}", query, page, size);

        Sort.Direction direction = Sort.Direction.fromString(sortDirection);
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

        Page<ProductDocument> results = searchService.search(query, pageable);

        return ResponseEntity.ok(results);
    }

    /**
     * Faceted search endpoint with filters
     * GET /api/search/faceted?q=노트북&category=electronics&minPrice=500000&maxPrice=2000000
     */
    @GetMapping("/faceted")
    public ResponseEntity<Page<ProductDocument>> facetedSearch(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Long minPrice,
            @RequestParam(required = false) Long maxPrice,
            @RequestParam(required = false) String brand,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        log.info("Faceted search: q={}, category={}, priceRange=[{},{}]",
                q, category, minPrice, maxPrice);

        SearchRequest request = new SearchRequest();
        request.setQuery(q);
        request.setCategory(category);
        request.setMinPrice(minPrice);
        request.setMaxPrice(maxPrice);
        request.setBrand(brand);

        Pageable pageable = PageRequest.of(page, size);
        Page<ProductDocument> results = searchService.facetedSearch(request, pageable);

        return ResponseEntity.ok(results);
    }

    /**
     * Autocomplete endpoint
     * GET /api/search/autocomplete?prefix=노트
     */
    @GetMapping("/autocomplete")
    public ResponseEntity<List<String>> autocomplete(
            @RequestParam String prefix,
            @RequestParam(defaultValue = "10") int limit
    ) {
        log.info("Autocomplete request: prefix={}, limit={}", prefix, limit);

        List<String> suggestions = searchService.autocomplete(prefix, limit);

        return ResponseEntity.ok(suggestions);
    }

    /**
     * Reindex all products (admin endpoint)
     * POST /api/search/reindex
     */
    @PostMapping("/reindex")
    public ResponseEntity<String> reindex() {
        log.info("Reindex request received");

        searchService.reindexAllProducts();

        return ResponseEntity.ok("Reindex completed");
    }
}
