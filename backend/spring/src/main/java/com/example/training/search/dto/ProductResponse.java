package com.example.training.search.dto;

import com.example.training.search.domain.Product;
import com.example.training.search.domain.ProductDocument;
import com.example.training.search.domain.ProductStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ProductResponse {

    private Long id;
    private String name;
    private String description;
    private String category;
    private String brand;
    private BigDecimal price;
    private ProductStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    protected ProductResponse() {
    }

    public ProductResponse(Long id, String name, String description, String category, String brand,
                          BigDecimal price, ProductStatus status, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.brand = brand;
        this.price = price;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static ProductResponse from(Product product) {
        return new ProductResponse(
            product.getId(),
            product.getName(),
            product.getDescription(),
            product.getCategory(),
            product.getBrand(),
            product.getPrice(),
            product.getStatus(),
            product.getCreatedAt(),
            product.getUpdatedAt()
        );
    }

    public static ProductResponse from(ProductDocument document) {
        return new ProductResponse(
            Long.parseLong(document.getId()),
            document.getName(),
            document.getDescription(),
            document.getCategory(),
            document.getBrand(),
            document.getPrice(),
            ProductStatus.valueOf(document.getStatus()),
            document.getCreatedAt(),
            null
        );
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getCategory() {
        return category;
    }

    public String getBrand() {
        return brand;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public ProductStatus getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
