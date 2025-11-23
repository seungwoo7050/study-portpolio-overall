package com.example.training.search.service;

import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.RangeQuery;
import co.elastic.clients.json.JsonData;
import com.example.training.search.domain.ProductDocument;
import com.example.training.search.dto.ProductResponse;
import com.example.training.search.dto.ProductSearchRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProductSearchService {

    private final ElasticsearchOperations elasticsearchOperations;

    public ProductSearchService(ElasticsearchOperations elasticsearchOperations) {
        this.elasticsearchOperations = elasticsearchOperations;
    }

    public Page<ProductResponse> searchProducts(ProductSearchRequest searchRequest) {
        Pageable pageable = PageRequest.of(searchRequest.getPage(), searchRequest.getSize());

        BoolQuery.Builder boolQueryBuilder = new BoolQuery.Builder();

        // Keyword search on name and description
        if (searchRequest.getQ() != null && !searchRequest.getQ().isEmpty()) {
            boolQueryBuilder.must(Query.of(q -> q
                .multiMatch(m -> m
                    .query(searchRequest.getQ())
                    .fields("name", "description")
                )
            ));
        }

        // Filter by category
        if (searchRequest.getCategory() != null && !searchRequest.getCategory().isEmpty()) {
            boolQueryBuilder.filter(Query.of(q -> q
                .term(t -> t
                    .field("category")
                    .value(searchRequest.getCategory())
                )
            ));
        }

        // Filter by brand
        if (searchRequest.getBrand() != null && !searchRequest.getBrand().isEmpty()) {
            boolQueryBuilder.filter(Query.of(q -> q
                .term(t -> t
                    .field("brand")
                    .value(searchRequest.getBrand())
                )
            ));
        }

        // Filter by price range
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

        NativeQuery query = NativeQuery.builder()
            .withQuery(Query.of(q -> q.bool(boolQueryBuilder.build())))
            .withPageable(pageable)
            .build();

        SearchHits<ProductDocument> searchHits = elasticsearchOperations.search(
            query,
            ProductDocument.class,
            IndexCoordinates.of("products")
        );

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
