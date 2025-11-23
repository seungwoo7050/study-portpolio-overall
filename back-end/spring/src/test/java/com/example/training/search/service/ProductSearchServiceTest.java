package com.example.training.search.service;

import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import com.example.training.search.domain.ProductDocument;
import com.example.training.search.domain.ProductStatus;
import com.example.training.search.dto.ProductResponse;
import com.example.training.search.dto.ProductSearchRequest;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.TotalHitsRelation;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProductSearchServiceTest {

    @Mock
    private ElasticsearchOperations elasticsearchOperations;

    @InjectMocks
    private ProductSearchService productSearchService;

    @Test
    void searchProducts_shouldReturnFilteredResults() {
        // Given
        ProductSearchRequest request = new ProductSearchRequest(
            "laptop",
            "Electronics",
            null,
            null,
            null,
            0,
            10
        );

        ProductDocument doc1 = new ProductDocument(
            "1",
            "Gaming Laptop",
            "High-performance gaming laptop",
            "Electronics",
            "BrandA",
            new BigDecimal("1500.00"),
            ProductStatus.ACTIVE.name(),
            LocalDateTime.now()
        );

        ProductDocument doc2 = new ProductDocument(
            "2",
            "Business Laptop",
            "Professional laptop for work",
            "Electronics",
            "BrandB",
            new BigDecimal("1200.00"),
            ProductStatus.ACTIVE.name(),
            LocalDateTime.now()
        );

        SearchHit<ProductDocument> hit1 = new SearchHit<>("products", "1", null, 1.0f, null, null, null, null, null, null, doc1);
        SearchHit<ProductDocument> hit2 = new SearchHit<>("products", "2", null, 0.9f, null, null, null, null, null, null, doc2);

        List<SearchHit<ProductDocument>> searchHitList = Arrays.asList(hit1, hit2);

        SearchHits<ProductDocument> searchHits = mock(SearchHits.class);
        when(searchHits.getTotalHits()).thenReturn(2L);
        when(searchHits.getSearchHits()).thenReturn(searchHitList);

        when(elasticsearchOperations.search(any(NativeQuery.class), eq(ProductDocument.class), any(IndexCoordinates.class)))
            .thenReturn(searchHits);

        // When
        Page<ProductResponse> results = productSearchService.searchProducts(request);

        // Then
        assertThat(results.getContent()).hasSize(2);
        assertThat(results.getTotalElements()).isEqualTo(2);
        assertThat(results.getContent().get(0).getName()).isEqualTo("Gaming Laptop");
    }

    @Test
    void searchProducts_shouldHandleEmptyResults() {
        // Given
        ProductSearchRequest request = new ProductSearchRequest(
            "nonexistent",
            null,
            null,
            null,
            null,
            0,
            10
        );

        SearchHits<ProductDocument> searchHits = mock(SearchHits.class);
        when(searchHits.getTotalHits()).thenReturn(0L);
        when(searchHits.getSearchHits()).thenReturn(Arrays.asList());

        when(elasticsearchOperations.search(any(NativeQuery.class), eq(ProductDocument.class), any(IndexCoordinates.class)))
            .thenReturn(searchHits);

        // When
        Page<ProductResponse> results = productSearchService.searchProducts(request);

        // Then
        assertThat(results.getContent()).isEmpty();
        assertThat(results.getTotalElements()).isEqualTo(0);
    }
}
