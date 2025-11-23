package com.sagaline.product.search;

import lombok.Data;

@Data
public class SearchRequest {
    private String query;
    private String category;
    private Long minPrice;
    private Long maxPrice;
    private String brand;

    public boolean hasAllFilters() {
        return query != null && category != null && minPrice != null && maxPrice != null;
    }

    public boolean hasPrice() {
        return minPrice != null && maxPrice != null;
    }
}
