package com.example.training.order.integration;

import com.example.training.order.domain.Notification;
import com.example.training.order.domain.NotificationType;
import com.example.training.order.dto.CreateOrderRequest;
import com.example.training.order.dto.OrderItemRequest;
import com.example.training.order.dto.OrderResponse;
import com.example.training.order.repository.NotificationRepository;
import com.example.training.order.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@SpringBootTest
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 3, brokerProperties = {
        "listeners=PLAINTEXT://localhost:9092",
        "port=9092"
})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class OrderKafkaIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Test
    void createOrder_shouldPublishEventAndCreateNotification() {
        // Given
        Long userId = 1L;
        OrderItemRequest itemRequest = new OrderItemRequest();
        itemRequest.setProductId(100L);
        itemRequest.setQuantity(2);
        itemRequest.setPrice(new BigDecimal("25.00"));

        CreateOrderRequest request = new CreateOrderRequest();
        request.setItems(List.of(itemRequest));

        // When
        OrderResponse orderResponse = orderService.createOrder(userId, request);

        // Then - Order should be created
        assertThat(orderResponse).isNotNull();
        assertThat(orderResponse.getId()).isNotNull();
        assertThat(orderResponse.getTotalAmount()).isEqualByComparingTo(new BigDecimal("50.00"));

        // Wait for Kafka consumer to process the event
        await()
                .atMost(10, TimeUnit.SECONDS)
                .pollInterval(100, TimeUnit.MILLISECONDS)
                .untilAsserted(() -> {
                    List<Notification> notifications = notificationRepository.findByUserId(userId);
                    assertThat(notifications).hasSize(1);

                    Notification notification = notifications.get(0);
                    assertThat(notification.getType()).isEqualTo(NotificationType.ORDER_CREATED);
                    assertThat(notification.getMessage()).contains("order #" + orderResponse.getId());
                    assertThat(notification.getMessage()).contains("$50.00");
                });
    }
}
