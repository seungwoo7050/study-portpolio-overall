package com.example.training.search.controller;

import com.example.training.search.domain.Product;
import com.example.training.search.domain.ProductStatus;
import com.example.training.search.dto.CreateProductRequest;
import com.example.training.search.dto.UpdateProductRequest;
import com.example.training.search.repository.ProductRepository;
import com.example.training.search.repository.ProductSearchRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProductRepository productRepository;

    @MockBean
    private ProductSearchRepository productSearchRepository;

    @BeforeEach
    void setUp() {
        productRepository.deleteAll();
    }

    @Test
    @WithMockUser
    void createProduct_shouldReturnCreatedProduct() throws Exception {
        // Given
        CreateProductRequest request = new CreateProductRequest(
            "Test Product",
            "Test Description",
            "Electronics",
            "TestBrand",
            new BigDecimal("99.99"),
            ProductStatus.ACTIVE
        );

        // When & Then
        mockMvc.perform(post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name", is("Test Product")))
            .andExpect(jsonPath("$.category", is("Electronics")))
            .andExpect(jsonPath("$.brand", is("TestBrand")))
            .andExpect(jsonPath("$.price", is(99.99)))
            .andExpect(jsonPath("$.status", is("ACTIVE")));
    }

    @Test
    @WithMockUser
    void getProduct_shouldReturnProduct_whenProductExists() throws Exception {
        // Given
        Product product = new Product(
            "Test Product",
            "Description",
            "Electronics",
            "TestBrand",
            new BigDecimal("99.99"),
            ProductStatus.ACTIVE
        );
        Product savedProduct = productRepository.save(product);

        // When & Then
        mockMvc.perform(get("/api/products/{id}", savedProduct.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name", is("Test Product")))
            .andExpect(jsonPath("$.category", is("Electronics")));
    }

    @Test
    @WithMockUser
    void updateProduct_shouldReturnUpdatedProduct() throws Exception {
        // Given
        Product product = new Product(
            "Old Name",
            "Old Description",
            "Old Category",
            "Old Brand",
            new BigDecimal("50.00"),
            ProductStatus.INACTIVE
        );
        Product savedProduct = productRepository.save(product);

        UpdateProductRequest request = new UpdateProductRequest(
            "New Name",
            "New Description",
            "New Category",
            "New Brand",
            new BigDecimal("100.00"),
            ProductStatus.ACTIVE
        );

        // When & Then
        mockMvc.perform(put("/api/products/{id}", savedProduct.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name", is("New Name")))
            .andExpect(jsonPath("$.category", is("New Category")))
            .andExpect(jsonPath("$.price", is(100.00)))
            .andExpect(jsonPath("$.status", is("ACTIVE")));
    }

    @Test
    @WithMockUser
    void deleteProduct_shouldReturnNoContent() throws Exception {
        // Given
        Product product = new Product(
            "Test Product",
            "Description",
            "Electronics",
            "TestBrand",
            new BigDecimal("99.99"),
            ProductStatus.ACTIVE
        );
        Product savedProduct = productRepository.save(product);

        // When & Then
        mockMvc.perform(delete("/api/products/{id}", savedProduct.getId()))
            .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser
    void createProduct_shouldReturnBadRequest_whenInvalidData() throws Exception {
        // Given - Invalid request with missing required fields
        CreateProductRequest request = new CreateProductRequest(
            "",
            "Description",
            "",
            "",
            null,
            null
        );

        // When & Then
        mockMvc.perform(post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }
}
