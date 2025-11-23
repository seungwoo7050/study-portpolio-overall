package com.example.training.search.service;

import com.example.training.search.domain.Product;
import com.example.training.search.domain.ProductDocument;
import com.example.training.search.domain.ProductStatus;
import com.example.training.search.dto.CreateProductRequest;
import com.example.training.search.dto.ProductResponse;
import com.example.training.search.dto.UpdateProductRequest;
import com.example.training.search.repository.ProductRepository;
import com.example.training.search.repository.ProductSearchRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductSearchRepository productSearchRepository;

    @InjectMocks
    private ProductService productService;

    @Test
    void createProduct_shouldCreateProductAndSyncToElasticsearch() {
        // Given
        CreateProductRequest request = new CreateProductRequest(
            "Test Product",
            "Test Description",
            "Electronics",
            "TestBrand",
            new BigDecimal("99.99"),
            ProductStatus.ACTIVE
        );

        Product savedProduct = mock(Product.class);
        when(savedProduct.getId()).thenReturn(1L);
        when(savedProduct.getName()).thenReturn(request.getName());
        when(savedProduct.getDescription()).thenReturn(request.getDescription());
        when(savedProduct.getCategory()).thenReturn(request.getCategory());
        when(savedProduct.getBrand()).thenReturn(request.getBrand());
        when(savedProduct.getPrice()).thenReturn(request.getPrice());
        when(savedProduct.getStatus()).thenReturn(request.getStatus());
        when(savedProduct.getCreatedAt()).thenReturn(java.time.LocalDateTime.now());
        when(savedProduct.getUpdatedAt()).thenReturn(java.time.LocalDateTime.now());

        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);
        when(productSearchRepository.save(any(ProductDocument.class))).thenReturn(null);

        // When
        ProductResponse response = productService.createProduct(request);

        // Then
        assertThat(response.getName()).isEqualTo("Test Product");
        assertThat(response.getCategory()).isEqualTo("Electronics");
        verify(productRepository).save(any(Product.class));
        verify(productSearchRepository).save(any(ProductDocument.class));
    }

    @Test
    void getProduct_shouldReturnProduct_whenProductExists() {
        // Given
        Long productId = 1L;
        Product product = mock(Product.class);
        when(product.getId()).thenReturn(productId);
        when(product.getName()).thenReturn("Test Product");
        when(product.getDescription()).thenReturn("Description");
        when(product.getCategory()).thenReturn("Electronics");
        when(product.getBrand()).thenReturn("TestBrand");
        when(product.getPrice()).thenReturn(new BigDecimal("99.99"));
        when(product.getStatus()).thenReturn(ProductStatus.ACTIVE);
        when(product.getCreatedAt()).thenReturn(java.time.LocalDateTime.now());
        when(product.getUpdatedAt()).thenReturn(java.time.LocalDateTime.now());

        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        // When
        ProductResponse response = productService.getProduct(productId);

        // Then
        assertThat(response.getName()).isEqualTo("Test Product");
        verify(productRepository).findById(productId);
    }

    @Test
    void getProduct_shouldThrowException_whenProductNotFound() {
        // Given
        Long productId = 999L;
        when(productRepository.findById(productId)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> productService.getProduct(productId))
            .isInstanceOf(RuntimeException.class)
            .hasMessage("Product not found");
    }

    @Test
    void updateProduct_shouldUpdateProductAndSyncToElasticsearch() {
        // Given
        Long productId = 1L;
        Product existingProduct = mock(Product.class);
        when(existingProduct.getId()).thenReturn(productId);

        UpdateProductRequest request = new UpdateProductRequest(
            "New Name",
            "New Description",
            "New Category",
            "New Brand",
            new BigDecimal("100.00"),
            ProductStatus.ACTIVE
        );

        // After update() is called, mock returns new values
        when(existingProduct.getName()).thenReturn(request.getName());
        when(existingProduct.getDescription()).thenReturn(request.getDescription());
        when(existingProduct.getCategory()).thenReturn(request.getCategory());
        when(existingProduct.getBrand()).thenReturn(request.getBrand());
        when(existingProduct.getPrice()).thenReturn(request.getPrice());
        when(existingProduct.getStatus()).thenReturn(request.getStatus());
        when(existingProduct.getCreatedAt()).thenReturn(java.time.LocalDateTime.now());
        when(existingProduct.getUpdatedAt()).thenReturn(java.time.LocalDateTime.now());

        when(productRepository.findById(productId)).thenReturn(Optional.of(existingProduct));
        when(productRepository.save(any(Product.class))).thenReturn(existingProduct);
        when(productSearchRepository.save(any(ProductDocument.class))).thenReturn(null);

        // When
        ProductResponse response = productService.updateProduct(productId, request);

        // Then
        assertThat(response.getName()).isEqualTo("New Name");
        verify(productRepository).findById(productId);
        verify(productRepository).save(existingProduct);
        verify(productSearchRepository).save(any(ProductDocument.class));
    }

    @Test
    void deleteProduct_shouldDeleteProductAndRemoveFromElasticsearch() {
        // Given
        Long productId = 1L;
        Product product = mock(Product.class);

        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        doNothing().when(productRepository).delete(product);
        doNothing().when(productSearchRepository).deleteById(productId.toString());

        // When
        productService.deleteProduct(productId);

        // Then
        verify(productRepository).findById(productId);
        verify(productRepository).delete(product);
        verify(productSearchRepository).deleteById(productId.toString());
    }
}
