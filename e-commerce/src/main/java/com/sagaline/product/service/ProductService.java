package com.sagaline.product.service;

import com.sagaline.product.api.dto.CategoryDTO;
import com.sagaline.product.api.dto.CreateProductRequest;
import com.sagaline.product.api.dto.ProductDTO;
import com.sagaline.product.domain.Category;
import com.sagaline.product.domain.Product;
import com.sagaline.product.repository.CategoryRepository;
import com.sagaline.product.repository.ProductRepository;
import com.sagaline.product.search.ProductSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private ProductSearchService searchService;

    public ProductService(ProductRepository productRepository,
                         CategoryRepository categoryRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
    }

    @Autowired(required = false)
    public void setSearchService(@Lazy ProductSearchService searchService) {
        this.searchService = searchService;
    }

    @Transactional
    public ProductDTO createProduct(CreateProductRequest request) {
        log.info("Creating product: {}", request.getName());

        if (request.getSku() != null && productRepository.existsBySku(request.getSku())) {
            throw new IllegalArgumentException("SKU already exists");
        }

        Product product = Product.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .sku(request.getSku())
                .brand(request.getBrand())
                .isActive(true)
                .categories(new HashSet<>())
                .build();

        // Add categories
        if (request.getCategoryIds() != null && !request.getCategoryIds().isEmpty()) {
            Set<Category> categories = new HashSet<>(
                categoryRepository.findAllById(request.getCategoryIds())
            );
            product.setCategories(categories);
        }

        product = productRepository.save(product);
        log.info("Product created with ID: {}", product.getId());

        // Index in Elasticsearch
        if (searchService != null) {
            try {
                searchService.indexProduct(product);
            } catch (Exception e) {
                log.warn("Failed to index product in Elasticsearch: {}", e.getMessage());
            }
        }

        return toDTO(product);
    }

    @Transactional(readOnly = true)
    public Page<ProductDTO> getActiveProducts(Pageable pageable) {
        return productRepository.findByIsActive(true, pageable)
                .map(this::toDTO);
    }

    @Cacheable(value = "productDetails", key = "#id", unless = "#result == null")
    @Transactional(readOnly = true)
    public ProductDTO getProductById(Long id) {
        log.debug("Fetching product from database: id={}", id);
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        return toDTO(product);
    }

    @CacheEvict(value = "productDetails", key = "#id")
    @Transactional
    public ProductDTO updateProduct(Long id, CreateProductRequest request) {
        log.info("Updating product: {}, evicting cache", id);

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setBrand(request.getBrand());

        if (request.getCategoryIds() != null) {
            Set<Category> categories = new HashSet<>(
                categoryRepository.findAllById(request.getCategoryIds())
            );
            product.setCategories(categories);
        }

        product = productRepository.save(product);

        // Update index in Elasticsearch
        if (searchService != null) {
            try {
                searchService.indexProduct(product);
            } catch (Exception e) {
                log.warn("Failed to update product in Elasticsearch: {}", e.getMessage());
            }
        }

        return toDTO(product);
    }

    @CacheEvict(value = "productDetails", key = "#id")
    @Transactional
    public void deleteProduct(Long id) {
        log.info("Deleting product: {}, evicting cache", id);
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        product.setIsActive(false);
        productRepository.save(product);

        // Remove from search index
        if (searchService != null) {
            try {
                searchService.deleteProduct(id);
            } catch (Exception e) {
                log.warn("Failed to delete product from Elasticsearch: {}", e.getMessage());
            }
        }
    }

    private ProductDTO toDTO(Product product) {
        return ProductDTO.builder()
                .id(product.getId())
                .name(product.getName())
                .description(product.getDescription())
                .price(product.getPrice())
                .sku(product.getSku())
                .brand(product.getBrand())
                .isActive(product.getIsActive())
                .categories(product.getCategories().stream()
                        .map(this::toCategoryDTO)
                        .collect(Collectors.toSet()))
                .createdAt(product.getCreatedAt())
                .build();
    }

    private CategoryDTO toCategoryDTO(Category category) {
        return CategoryDTO.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .parentId(category.getParent() != null ? category.getParent().getId() : null)
                .build();
    }
}
