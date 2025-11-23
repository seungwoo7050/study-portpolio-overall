package com.sagaline;

import com.sagaline.cart.api.dto.AddToCartRequest;
import com.sagaline.cart.api.dto.CartDTO;
import com.sagaline.order.api.dto.CreateOrderRequest;
import com.sagaline.order.api.dto.OrderDTO;
import com.sagaline.product.api.dto.CreateProductRequest;
import com.sagaline.product.api.dto.ProductDTO;
import com.sagaline.user.api.dto.AuthResponse;
import com.sagaline.user.api.dto.RegisterRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class EcommerceIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void completeEcommerceJourney() {
        // 1. Register user
        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setEmail("test@example.com");
        registerRequest.setPassword("SecurePass123!");
        registerRequest.setName("Test User");
        registerRequest.setPhoneNumber("010-1234-5678");

        ResponseEntity<AuthResponse> registerResponse = restTemplate.postForEntity(
                "/api/auth/register",
                registerRequest,
                AuthResponse.class
        );

        // Debug: Log response details
        System.out.println("=== Registration Response ===");
        System.out.println("Status Code: " + registerResponse.getStatusCode());
        System.out.println("Status Code Value: " + registerResponse.getStatusCode().value());
        System.out.println("Response Body: " + registerResponse.getBody());
        System.out.println("============================");

        assertThat(registerResponse.getStatusCode().is2xxSuccessful())
                .withFailMessage("Registration failed with status: " + registerResponse.getStatusCode() +
                               ", body: " + registerResponse.getBody())
                .isTrue();
        assertThat(registerResponse.getBody()).isNotNull();
        String userToken = registerResponse.getBody().getToken();
        assertThat(userToken).isNotBlank();

        // 2. Create product (public endpoint)
        CreateProductRequest productRequest = new CreateProductRequest();
        productRequest.setName("노트북");
        productRequest.setDescription("고성능 게이밍 노트북");
        productRequest.setPrice(BigDecimal.valueOf(1500000));
        productRequest.setSku("LAPTOP-001");
        productRequest.setBrand("Samsung");

        ResponseEntity<ProductDTO> productResponse = restTemplate.postForEntity(
                "/api/products",
                productRequest,
                ProductDTO.class
        );

        assertThat(productResponse.getStatusCode().is2xxSuccessful()).isTrue();
        ProductDTO product = productResponse.getBody();
        assertThat(product).isNotNull();
        assertThat(product.getId()).isNotNull();

        // 3. Add to cart (requires authentication)
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(userToken);

        AddToCartRequest addToCartRequest = new AddToCartRequest();
        addToCartRequest.setProductId(product.getId());
        addToCartRequest.setQuantity(2);

        HttpEntity<AddToCartRequest> cartEntity = new HttpEntity<>(addToCartRequest, headers);
        ResponseEntity<CartDTO> cartResponse = restTemplate.postForEntity(
                "/api/cart/items",
                cartEntity,
                CartDTO.class
        );

        assertThat(cartResponse.getStatusCode().is2xxSuccessful()).isTrue();
        CartDTO cart = cartResponse.getBody();
        assertThat(cart).isNotNull();
        assertThat(cart.getItems()).hasSize(1);
        assertThat(cart.getTotalItems()).isEqualTo(2);
        assertThat(cart.getTotalAmount()).isEqualByComparingTo(BigDecimal.valueOf(3000000));

        // 4. Create order
        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setShippingAddress("서울시 강남구 테헤란로 123");
        orderRequest.setShippingCity("서울");
        orderRequest.setShippingPostalCode("06234");
        orderRequest.setPaymentMethod("TOSS");

        HttpEntity<CreateOrderRequest> orderEntity = new HttpEntity<>(orderRequest, headers);
        ResponseEntity<OrderDTO> orderResponse = restTemplate.postForEntity(
                "/api/orders",
                orderEntity,
                OrderDTO.class
        );

        assertThat(orderResponse.getStatusCode().is2xxSuccessful()).isTrue();
        OrderDTO order = orderResponse.getBody();
        assertThat(order).isNotNull();
        assertThat(order.getId()).isNotNull();
        assertThat(order.getItems()).hasSize(1);
        assertThat(order.getTotalAmount()).isEqualByComparingTo(BigDecimal.valueOf(3000000));
        assertThat(order.getStatus()).isNotNull();

        // 5. Verify cart is cleared
        HttpEntity<Void> getCartEntity = new HttpEntity<>(headers);
        ResponseEntity<CartDTO> clearedCartResponse = restTemplate.exchange(
                "/api/cart",
                HttpMethod.GET,
                getCartEntity,
                CartDTO.class
        );

        assertThat(clearedCartResponse.getStatusCode().is2xxSuccessful()).isTrue();
        CartDTO clearedCart = clearedCartResponse.getBody();
        assertThat(clearedCart).isNotNull();
        // Cart should be empty or have 0 items after order creation
        assertThat(clearedCart.getItems()).isEmpty();
    }
}
