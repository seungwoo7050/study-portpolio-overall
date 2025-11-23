package com.example.training.search.service;

import com.example.training.search.domain.Product;
import com.example.training.search.domain.ProductDocument;
import com.example.training.search.dto.CreateProductRequest;
import com.example.training.search.dto.ProductResponse;
import com.example.training.search.dto.UpdateProductRequest;
import com.example.training.search.repository.ProductRepository;
import com.example.training.search.repository.ProductSearchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductSearchRepository productSearchRepository;

    public ProductService(ProductRepository productRepository, ProductSearchRepository productSearchRepository) {
        this.productRepository = productRepository;
        this.productSearchRepository = productSearchRepository;
    }

    @Transactional
    public ProductResponse createProduct(CreateProductRequest request) {
        Product product = new Product(
            request.getName(),
            request.getDescription(),
            request.getCategory(),
            request.getBrand(),
            request.getPrice(),
            request.getStatus()
        );

        Product savedProduct = productRepository.save(product);

        // Sync to Elasticsearch
        productSearchRepository.save(ProductDocument.from(savedProduct));

        return ProductResponse.from(savedProduct);
    }

    public ProductResponse getProduct(Long id) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Product not found"));
        return ProductResponse.from(product);
    }

    @Transactional
    public ProductResponse updateProduct(Long id, UpdateProductRequest request) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Product not found"));

        product.update(
            request.getName(),
            request.getDescription(),
            request.getCategory(),
            request.getBrand(),
            request.getPrice(),
            request.getStatus()
        );

        Product updatedProduct = productRepository.save(product);

        // Sync to Elasticsearch
        productSearchRepository.save(ProductDocument.from(updatedProduct));

        return ProductResponse.from(updatedProduct);
    }

    @Transactional
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Product not found"));

        productRepository.delete(product);

        // Delete from Elasticsearch
        productSearchRepository.deleteById(id.toString());
    }
}
