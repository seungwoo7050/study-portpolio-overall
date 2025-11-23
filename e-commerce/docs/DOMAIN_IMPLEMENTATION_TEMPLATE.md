# Domain Implementation Template

Use this template to implement each remaining domain: Product, Cart, Order, Payment, Inventory.

## Template Structure

For each domain, create the following files following the User domain pattern:

### 1. Domain Entities (`src/main/java/com/sagaline/{domain}/domain/`)

**Example: Product.java**
```java
package com.sagaline.product.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(unique = true)
    private String sku;

    private String brand;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

### 2. Repository (`src/main/java/com/sagaline/{domain}/repository/`)

**Example: ProductRepository.java**
```java
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
```

### 3. DTOs (`src/main/java/com/sagaline/{domain}/api/dto/`)

**Example: ProductDTO.java**
```java
package com.sagaline.product.api.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class ProductDTO {
    private Long id;
    private String name;
    private String description;
    private BigDecimal price;
    private String sku;
    private String brand;
    private Boolean isActive;
    private LocalDateTime createdAt;
}
```

**Example: CreateProductRequest.java**
```java
package com.sagaline.product.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateProductRequest {
    @NotBlank(message = "Name is required")
    private String name;

    private String description;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.0", message = "Price must be positive")
    private BigDecimal price;

    private String sku;
    private String brand;
}
```

### 4. Service (`src/main/java/com/sagaline/{domain}/service/`)

**Example: ProductService.java**
```java
package com.sagaline.product.service;

import com.sagaline.product.api.dto.*;
import com.sagaline.product.domain.Product;
import com.sagaline.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductService {

    private final ProductRepository productRepository;

    @Transactional
    public ProductDTO createProduct(CreateProductRequest request) {
        log.info("Creating product: {}", request.getName());

        Product product = Product.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .sku(request.getSku())
                .brand(request.getBrand())
                .isActive(true)
                .build();

        product = productRepository.save(product);
        return toDTO(product);
    }

    @Transactional(readOnly = true)
    public Page<ProductDTO> getActiveProducts(Pageable pageable) {
        return productRepository.findByIsActive(true, pageable)
                .map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public ProductDTO getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        return toDTO(product);
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
                .createdAt(product.getCreatedAt())
                .build();
    }
}
```

### 5. Controller (`src/main/java/com/sagaline/{domain}/api/`)

**Example: ProductController.java**
```java
package com.sagaline.product.api;

import com.sagaline.product.api.dto.*;
import com.sagaline.product.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Slf4j
public class ProductController {

    private final ProductService productService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductDTO> createProduct(@Valid @RequestBody CreateProductRequest request) {
        ProductDTO product = productService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(product);
    }

    @GetMapping
    public ResponseEntity<Page<ProductDTO>> getProducts(Pageable pageable) {
        Page<ProductDTO> products = productService.getActiveProducts(pageable);
        return ResponseEntity.ok(products);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductDTO> getProduct(@PathVariable Long id) {
        ProductDTO product = productService.getProductById(id);
        return ResponseEntity.ok(product);
    }
}
```

## Implementation Checklist per Domain

### Product Domain
- [ ] `Product.java` entity
- [ ] `Category.java` entity (with self-reference for hierarchy)
- [ ] `ProductRepository.java`
- [ ] `CategoryRepository.java`
- [ ] DTOs: `ProductDTO`, `CreateProductRequest`, `UpdateProductRequest`, `CategoryDTO`
- [ ] `ProductService.java`
- [ ] `CategoryService.java`
- [ ] `ProductController.java`
- [ ] `CategoryController.java`
- [ ] Unit tests
- [ ] Integration tests

### Cart Domain
- [ ] `Cart.java` entity (one per user)
- [ ] `CartItem.java` entity
- [ ] `CartRepository.java`
- [ ] `CartItemRepository.java`
- [ ] DTOs: `CartDTO`, `CartItemDTO`, `AddToCartRequest`, `UpdateCartItemRequest`
- [ ] `CartService.java` (methods: getCart, addItem, updateQuantity, removeItem, clearCart)
- [ ] `CartController.java`
- [ ] Unit tests
- [ ] Integration tests

### Order Domain
- [ ] `Order.java` entity
- [ ] `OrderItem.java` entity
- [ ] `OrderStatus.java` enum (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED)
- [ ] `OrderStatusHistory.java` entity
- [ ] `OrderRepository.java`
- [ ] DTOs: `OrderDTO`, `CreateOrderRequest`, `OrderItemDTO`, `OrderStatusHistoryDTO`
- [ ] `OrderService.java` (methods: createOrder, getOrders, getOrderById, updateStatus)
- [ ] `OrderController.java`
- [ ] Unit tests
- [ ] Integration tests

### Payment Domain
- [ ] `Payment.java` entity
- [ ] `PaymentTransaction.java` entity
- [ ] `PaymentStatus.java` enum (PENDING, SUCCESS, FAILED, REFUNDED)
- [ ] `PaymentMethod.java` enum (TOSS, CREDIT_CARD, BANK_TRANSFER)
- [ ] `PaymentRepository.java`
- [ ] DTOs: `PaymentDTO`, `ProcessPaymentRequest`, `PaymentTransactionDTO`
- [ ] `TossPaymentsClient.java` (mock implementation)
- [ ] `PaymentService.java`
- [ ] `PaymentController.java`
- [ ] Unit tests
- [ ] Integration tests

### Inventory Domain
- [ ] `Inventory.java` entity (with generated available_quantity)
- [ ] `InventoryReservation.java` entity
- [ ] `InventoryRepository.java`
- [ ] DTOs: `InventoryDTO`, `ReserveInventoryRequest`, `AdjustInventoryRequest`
- [ ] `InventoryService.java` (methods: reserve, release, adjust, checkAvailability)
- [ ] `InventoryController.java`
- [ ] Unit tests
- [ ] Integration tests

## Testing Pattern

**Unit Test Example**:
```java
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductService productService;

    @Test
    void createProduct_Success() {
        // Given
        CreateProductRequest request = new CreateProductRequest();
        request.setName("Test Product");
        request.setPrice(BigDecimal.valueOf(10000));

        Product savedProduct = Product.builder()
                .id(1L)
                .name("Test Product")
                .price(BigDecimal.valueOf(10000))
                .build();

        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);

        // When
        ProductDTO result = productService.createProduct(request);

        // Then
        assertThat(result.getName()).isEqualTo("Test Product");
        verify(productRepository).save(any(Product.class));
    }
}
```

**Integration Test Example**:
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "spring.profiles.active=test")
class ProductIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void createAndGetProduct() {
        // Create product
        CreateProductRequest request = new CreateProductRequest();
        request.setName("Test Product");
        request.setPrice(BigDecimal.valueOf(10000));

        ResponseEntity<ProductDTO> createResponse = restTemplate
                .withBasicAuth("admin", "admin")
                .postForEntity("/api/products", request, ProductDTO.class);

        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long productId = createResponse.getBody().getId();

        // Get product
        ResponseEntity<ProductDTO> getResponse = restTemplate
                .getForEntity("/api/products/" + productId, ProductDTO.class);

        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(getResponse.getBody().getName()).isEqualTo("Test Product");
    }
}
```

## Order Creation Flow (Complete Example)

```java
@Transactional
public OrderDTO createOrder(Long userId, CreateOrderRequest request) {
    // 1. Get user's cart
    Cart cart = cartRepository.findByUserId(userId)
            .orElseThrow(() -> new IllegalStateException("Cart not found"));

    if (cart.getItems().isEmpty()) {
        throw new IllegalStateException("Cart is empty");
    }

    // 2. Calculate total
    BigDecimal totalAmount = cart.getItems().stream()
            .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    // 3. Reserve inventory
    for (CartItem item : cart.getItems()) {
        inventoryService.reserve(item.getProduct().getId(), item.getQuantity());
    }

    // 4. Create order
    Order order = Order.builder()
            .userId(userId)
            .status(OrderStatus.PENDING)
            .totalAmount(totalAmount)
            .shippingAddress(request.getShippingAddress())
            .build();

    // 5. Create order items
    for (CartItem cartItem : cart.getItems()) {
        OrderItem orderItem = OrderItem.builder()
                .order(order)
                .productId(cartItem.getProduct().getId())
                .quantity(cartItem.getQuantity())
                .price(cartItem.getPrice())
                .subtotal(cartItem.getPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity())))
                .build();
        order.getItems().add(orderItem);
    }

    order = orderRepository.save(order);

    // 6. Process payment
    Payment payment = paymentService.processPayment(order.getId(), request.getPaymentMethod());

    if (payment.getStatus() == PaymentStatus.SUCCESS) {
        order.setStatus(OrderStatus.CONFIRMED);
        orderRepository.save(order);
    }

    // 7. Clear cart
    cart.getItems().clear();
    cartRepository.save(cart);

    return toDTO(order);
}
```

## Common Patterns

### Exception Handling
Create custom exceptions:
```java
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
```

Global exception handler:
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("BAD_REQUEST", ex.getMessage()));
    }
}
```

### Pagination
```java
@GetMapping
public ResponseEntity<Page<ProductDTO>> getProducts(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "createdAt,desc") String[] sort) {

    Pageable pageable = PageRequest.of(page, size, Sort.by(parseSort(sort)));
    Page<ProductDTO> products = productService.getProducts(pageable);
    return ResponseEntity.ok(products);
}
```

### Logging
```java
log.info("Creating order for user: {}", userId);
log.debug("Order details: {}", order);
log.error("Failed to process payment", exception);
```

## Next Steps

1. Implement Product domain using this template
2. Implement Cart domain
3. Implement Order domain
4. Implement Payment domain (with mock Toss Payments client)
5. Implement Inventory domain
6. Write integration tests
7. Test complete user journey
8. Update OpenAPI specification
9. Create evidence package

**Estimated Time**: 2-3 days for all 5 domains + tests

---

Follow this pattern systematically for each domain to complete Stage 1.
