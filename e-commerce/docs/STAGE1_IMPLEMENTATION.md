# Stage 1: Monolith Foundation - Implementation Summary

**Status**: In Progress
**Goal**: Working end-to-end e-commerce system

## Implementation Scope

### Database Migrations ✅ COMPLETED
All database schemas created:
- `V001__create_user_schema.sql` - Users, profiles, roles
- `V002__create_product_schema.sql` - Products, categories
- `V003__create_cart_schema.sql` - Carts, cart items
- `V004__create_order_schema.sql` - Orders, order items, status history
- `V005__create_payment_schema.sql` - Payments, transactions
- `V006__create_inventory_schema.sql` - Inventory, reservations

### Domain Implementation Plan

Due to the extensive scope (6 domains × 4-5 files each = ~30-40 files), the implementation is structured as follows:

#### 1. User Domain
**Files**:
- ✅ `User.java` - Entity with roles, profile
- ✅ `UserRole.java` - Enum (ROLE_USER, ROLE_ADMIN, ROLE_SELLER)
- ✅ `UserRoleEntity.java` - Role mapping entity
- 🔄 `UserRepository.java` - JPA repository
- 🔄 `UserService.java` - Registration, authentication
- 🔄 `AuthController.java` - /api/auth/register, /api/auth/login
- 🔄 `JwtTokenProvider.java` - JWT generation/validation
- 🔄 `SecurityConfig.java` - Spring Security configuration

**Key Endpoints**:
```
POST /api/auth/register - User registration
POST /api/auth/login - User login (returns JWT)
GET /api/users/{id} - Get user profile
PUT /api/users/{id} - Update user profile
```

#### 2. Product Domain
**Files**:
- 🔄 `Product.java` - Product entity
- 🔄 `Category.java` - Category entity (hierarchical)
- 🔄 `ProductRepository.java`
- 🔄 `CategoryRepository.java`
- 🔄 `ProductService.java`
- 🔄 `ProductController.java`

**Key Endpoints**:
```
GET /api/products - List products (paginated)
GET /api/products/{id} - Get product details
POST /api/products - Create product (ADMIN)
PUT /api/products/{id} - Update product (ADMIN)
DELETE /api/products/{id} - Delete product (ADMIN)
GET /api/categories - List categories
```

#### 3. Cart Domain
**Files**:
- 🔄 `Cart.java` - Cart entity
- 🔄 `CartItem.java` - Cart item entity
- 🔄 `CartRepository.java`
- 🔄 `CartService.java`
- 🔄 `CartController.java`

**Key Endpoints**:
```
GET /api/cart - Get user's cart
POST /api/cart/items - Add item to cart
PUT /api/cart/items/{id} - Update item quantity
DELETE /api/cart/items/{id} - Remove item from cart
DELETE /api/cart - Clear cart
```

#### 4. Order Domain
**Files**:
- 🔄 `Order.java` - Order entity
- 🔄 `OrderItem.java` - Order line item
- 🔄 `OrderStatus.java` - Enum (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED)
- 🔄 `OrderStatusHistory.java` - Status change tracking
- 🔄 `OrderRepository.java`
- 🔄 `OrderService.java` - Order creation, status management
- 🔄 `OrderController.java`

**Key Endpoints**:
```
POST /api/orders - Create order from cart
GET /api/orders - List user's orders
GET /api/orders/{id} - Get order details
PUT /api/orders/{id}/status - Update order status (ADMIN)
GET /api/orders/{id}/history - Get status history
```

#### 5. Payment Domain
**Files**:
- 🔄 `Payment.java` - Payment entity
- 🔄 `PaymentTransaction.java` - Transaction log
- 🔄 `PaymentStatus.java` - Enum (PENDING, SUCCESS, FAILED, REFUNDED)
- 🔄 `PaymentMethod.java` - Enum (TOSS, CREDIT_CARD, BANK_TRANSFER)
- 🔄 `PaymentRepository.java`
- 🔄 `PaymentService.java`
- 🔄 `TossPaymentsClient.java` - Mock Toss Payments integration
- 🔄 `PaymentController.java`

**Key Endpoints**:
```
POST /api/payments/process - Process payment for order
GET /api/payments/{id} - Get payment details
POST /api/payments/{id}/refund - Refund payment (ADMIN)
```

#### 6. Inventory Domain
**Files**:
- 🔄 `Inventory.java` - Stock levels
- 🔄 `InventoryReservation.java` - Stock reservations
- 🔄 `InventoryRepository.java`
- 🔄 `InventoryService.java` - Reserve, release, adjust stock
- 🔄 `InventoryController.java`

**Key Endpoints**:
```
GET /api/inventory/{productId} - Get stock level
PUT /api/inventory/{productId} - Adjust stock (ADMIN)
POST /api/inventory/reserve - Reserve stock for order
POST /api/inventory/release - Release reservation
```

## Technical Implementation Details

### JWT Authentication
```java
// Token structure
{
  "sub": "user@example.com",
  "userId": 123,
  "roles": ["ROLE_USER"],
  "iat": 1699999999,
  "exp": 1700000999
}

// Token validity: 15 minutes
// Refresh token: 7 days (future enhancement)
```

### Security Configuration
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    // Permit: /api/auth/**, /api/health, /actuator/**
    // Require authentication: All other /api/** endpoints
    // Role-based access:
    //   - ADMIN: Can manage products, inventory, order status
    //   - USER: Can manage own cart, orders, profile
}
```

### Exception Handling
```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    // NotFoundException -> 404
    // ValidationException -> 400
    // UnauthorizedException -> 401
    // ForbiddenException -> 403
    // Generic Exception -> 500
}
```

### Data Transfer Objects (DTOs)
```java
// Request DTOs
RegisterRequest { email, password, name, phoneNumber }
LoginRequest { email, password }
AddToCartRequest { productId, quantity }
CreateOrderRequest { shippingAddress, paymentMethod }

// Response DTOs
UserDTO { id, email, name, roles, createdAt }
ProductDTO { id, name, description, price, categories }
CartDTO { id, items[], totalAmount }
OrderDTO { id, status, items[], totalAmount, createdAt }
PaymentDTO { id, orderId, amount, status, method }
```

### Service Layer Patterns
```java
// Transaction management
@Transactional
public Order createOrder(Long userId, CreateOrderRequest request) {
    // 1. Get cart
    // 2. Validate cart not empty
    // 3. Reserve inventory
    // 4. Create order
    // 5. Clear cart
    // 6. Return order
}

// Error handling
try {
    // Business logic
} catch (Exception e) {
    log.error("Error in operation", e);
    throw new ServiceException("Operation failed", e);
}
```

## Testing Strategy

### Unit Tests
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void registerUser_Success() {
        // Given
        RegisterRequest request = new RegisterRequest(...);

        // When
        UserDTO result = userService.register(request);

        // Then
        assertThat(result.getEmail()).isEqualTo(request.getEmail());
        verify(userRepository).save(any(User.class));
    }
}
```

### Integration Tests
```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@TestPropertySource(properties = "spring.profiles.active=test")
class UserIntegrationTest {
    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void completeUserJourney() {
        // 1. Register
        // 2. Login (get JWT)
        // 3. Update profile
        // 4. Get profile
        // All should succeed
    }
}
```

### E2E Scenario Test
```java
@Test
void completeEcommerceJourney() {
    // 1. Register user
    // 2. Login (get JWT)
    // 3. Browse products
    // 4. Add items to cart
    // 5. Create order
    // 6. Process payment
    // 7. Check order status
    // 8. Verify inventory updated
}
```

## Performance Requirements

### KPIs (from CLAUDE.md)
- API latency p99 ≤ 100ms (simple queries like GET /products)
- API latency p99 ≤ 200ms (complex queries like POST /orders)
- Test coverage ≥ 80%
- No critical/high security vulnerabilities

### Database Optimization
- Indexes on frequently queried columns (email, product_id, user_id, status)
- Generated columns for calculated fields (available_quantity)
- Foreign key constraints for data integrity
- Proper connection pooling (HikariCP configured)

## Korean Market Integration

### Toss Payments (Mock Implementation)
```java
@Service
public class TossPaymentsClient {
    public PaymentResponse processPayment(PaymentRequest request) {
        // Mock implementation for Stage 1
        // Returns success for test mode
        // Real integration in Stage 4
        return PaymentResponse.builder()
            .transactionId("mock-" + UUID.randomUUID())
            .status(PaymentStatus.SUCCESS)
            .build();
    }
}
```

### Kakao OAuth
```java
// OAuth configuration prepared
// Full implementation in Stage 4.1
@Configuration
public class OAuth2Config {
    // client-id: ${KAKAO_CLIENT_ID}
    // client-secret: ${KAKAO_CLIENT_SECRET}
    // redirect-uri: /api/auth/oauth2/callback/kakao
}
```

### Korean Address Format
```java
@Data
public class Address {
    private String addressLine1;  // 도로명주소
    private String addressLine2;  // 상세주소
    private String city;          // 시/도
    private String district;      // 구/군
    private String postalCode;    // 우편번호
    private String country = "KR";
}
```

## Validation Examples

### Complete User Journey (cURL)
```bash
# 1. Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "홍길동",
    "phoneNumber": "010-1234-5678"
  }'

# 2. Login
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }' | jq -r '.token')

# 3. Browse products
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/products?page=0&size=20

# 4. Add to cart
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8080/api/cart/items \
  -d '{
    "productId": 1,
    "quantity": 2
  }'

# 5. View cart
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/cart

# 6. Create order
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8080/api/orders \
  -d '{
    "shippingAddress": "서울시 강남구 테헤란로 123",
    "shippingCity": "서울",
    "shippingPostalCode": "06234",
    "paymentMethod": "TOSS"
  }'

# 7. Check order
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/orders/1
```

## Evidence Package

### To Be Created in `docs/evidence/stage-1/`
1. **validation-report.md** - Complete test results
2. **api-examples/** - cURL commands, Postman collection
3. **screenshots/** - API responses, database queries
4. **test-results/** - JUnit reports, coverage reports
5. **architecture/** - Database schema diagram, component diagram
6. **performance/** - Latency measurements

## Next Steps

1. Complete remaining domain implementations (Product, Cart, Order, Payment, Inventory)
2. Implement JWT authentication and security
3. Write comprehensive tests (unit + integration)
4. Run validation tests
5. Collect evidence
6. Update OpenAPI specification
7. Commit and tag

## Notes

- This is a monolith application (single deployment unit)
- All domains in one codebase, one database
- Clear separation via packages (DDD)
- Ready for Stage 5 microservices decomposition
- PIPA compliance: PII encryption deferred to Stage 4.1
- Kakao OAuth: Full implementation in Stage 4.1
- Toss Payments: Mock for now, real integration in Stage 4.1

---

**Implementation continues...**
