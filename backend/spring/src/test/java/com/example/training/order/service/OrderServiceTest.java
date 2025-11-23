package com.example.training.order.service;

import com.example.training.order.domain.Order;
import com.example.training.order.dto.CreateOrderRequest;
import com.example.training.order.dto.OrderItemRequest;
import com.example.training.order.dto.OrderResponse;
import com.example.training.order.event.OrderEvent;
import com.example.training.order.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private KafkaTemplate<String, OrderEvent> kafkaTemplate;

    @InjectMocks
    private OrderService orderService;

    @Test
    void createOrder_shouldCreateOrderAndPublishEvent() {
        // Given
        Long userId = 1L;
        OrderItemRequest itemRequest = new OrderItemRequest();
        itemRequest.setProductId(100L);
        itemRequest.setQuantity(2);
        itemRequest.setPrice(new BigDecimal("25.00"));

        CreateOrderRequest request = new CreateOrderRequest();
        request.setItems(List.of(itemRequest));

        Order savedOrder = new Order();
        savedOrder.setId(1L);
        savedOrder.setUserId(userId);
        savedOrder.setTotalAmount(new BigDecimal("50.00"));

        when(orderRepository.save(any(Order.class))).thenReturn(savedOrder);

        // When
        OrderResponse response = orderService.createOrder(userId, request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getUserId()).isEqualTo(userId);
        assertThat(response.getTotalAmount()).isEqualByComparingTo(new BigDecimal("50.00"));

        verify(orderRepository).save(any(Order.class));
        verify(kafkaTemplate).send(eq("order-events"), any(String.class), any(OrderEvent.class));
    }

    @Test
    void createOrder_shouldCalculateTotalAmountCorrectly() {
        // Given
        Long userId = 1L;
        OrderItemRequest item1 = new OrderItemRequest();
        item1.setProductId(100L);
        item1.setQuantity(2);
        item1.setPrice(new BigDecimal("25.00"));

        OrderItemRequest item2 = new OrderItemRequest();
        item2.setProductId(101L);
        item2.setQuantity(1);
        item2.setPrice(new BigDecimal("30.00"));

        CreateOrderRequest request = new CreateOrderRequest();
        request.setItems(List.of(item1, item2));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(1L);
            return order;
        });

        // When
        OrderResponse response = orderService.createOrder(userId, request);

        // Then
        assertThat(response.getTotalAmount()).isEqualByComparingTo(new BigDecimal("80.00"));
        assertThat(response.getItems()).hasSize(2);
    }

    @Test
    void getOrder_shouldReturnOrder() {
        // Given
        Long orderId = 1L;
        Order order = new Order();
        order.setId(orderId);
        order.setUserId(1L);
        order.setTotalAmount(new BigDecimal("100.00"));

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        // When
        OrderResponse response = orderService.getOrder(orderId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(orderId);
    }

    @Test
    void getUserOrders_shouldReturnUserOrders() {
        // Given
        Long userId = 1L;
        Order order1 = new Order();
        order1.setId(1L);
        order1.setUserId(userId);
        order1.setTotalAmount(new BigDecimal("50.00"));

        Order order2 = new Order();
        order2.setId(2L);
        order2.setUserId(userId);
        order2.setTotalAmount(new BigDecimal("75.00"));

        when(orderRepository.findByUserId(userId)).thenReturn(List.of(order1, order2));

        // When
        List<OrderResponse> orders = orderService.getUserOrders(userId);

        // Then
        assertThat(orders).hasSize(2);
        assertThat(orders.get(0).getId()).isEqualTo(1L);
        assertThat(orders.get(1).getId()).isEqualTo(2L);
    }
}
