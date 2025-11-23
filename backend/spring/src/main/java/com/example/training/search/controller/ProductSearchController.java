package com.example.training.search.controller;

import com.example.training.search.dto.ProductResponse;
import com.example.training.search.dto.ProductSearchRequest;
import com.example.training.search.service.ProductSearchService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/search/products")
public class ProductSearchController {

    private final ProductSearchService productSearchService;

    public ProductSearchController(ProductSearchService productSearchService) {
        this.productSearchService = productSearchService;
    }

    @GetMapping
    public ResponseEntity<Page<ProductResponse>> searchProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        ProductSearchRequest searchRequest = new ProductSearchRequest(
            q, category, brand, minPrice, maxPrice, page, size
        );

        Page<ProductResponse> results = productSearchService.searchProducts(searchRequest);
        return ResponseEntity.ok(results);
    }
}
