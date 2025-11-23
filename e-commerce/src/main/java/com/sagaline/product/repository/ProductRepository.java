package com.sagaline.product.repository;

import com.sagaline.product.domain.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Page<Product> findByIsActive(Boolean isActive, Pageable pageable);
    boolean existsBySku(String sku);
}
