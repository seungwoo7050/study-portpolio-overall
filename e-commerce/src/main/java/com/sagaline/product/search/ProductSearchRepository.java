package com.sagaline.product.search;

import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@Profile("!test")
public interface ProductSearchRepository extends ElasticsearchRepository<ProductDocument, Long> {

    /**
     * Full-text search on name and description fields
     */
    @Query("{\"multi_match\": {\"query\": \"?0\", \"fields\": [\"name^2\", \"description\"], \"type\": \"best_fields\"}}")
    Page<ProductDocument> searchByNameOrDescription(String query, Pageable pageable);

    /**
     * Search by category
     */
    Page<ProductDocument> findByCategory(String category, Pageable pageable);

    /**
     * Search by price range
     */
    Page<ProductDocument> findByPriceBetween(Long minPrice, Long maxPrice, Pageable pageable);

    /**
     * Search by brand
     */
    Page<ProductDocument> findByBrand(String brand, Pageable pageable);

    /**
     * Complex faceted search
     */
    @Query("{\"bool\": {\"must\": [{\"multi_match\": {\"query\": \"?0\", \"fields\": [\"name^2\", \"description\"]}}], \"filter\": [{\"term\": {\"category\": \"?1\"}}, {\"range\": {\"price\": {\"gte\": ?2, \"lte\": ?3}}}]}}")
    Page<ProductDocument> facetedSearch(String query, String category, Long minPrice, Long maxPrice, Pageable pageable);
}
