package com.example.training.order.service;

import com.example.training.order.domain.Notification;
import com.example.training.order.domain.NotificationType;
import com.example.training.order.event.OrderEvent;
import com.example.training.order.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void handleOrderEvent_shouldCreateNotificationForOrderCreated() {
        // Given
        OrderEvent event = new OrderEvent(
                "ORDER_CREATED",
                1L,
                10L,
                new BigDecimal("100.00")
        );

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setId(1L);
            return notification;
        });

        // When
        notificationService.handleOrderEvent(event);

        // Then
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());

        Notification savedNotification = captor.getValue();
        assertThat(savedNotification.getUserId()).isEqualTo(10L);
        assertThat(savedNotification.getType()).isEqualTo(NotificationType.ORDER_CREATED);
        assertThat(savedNotification.getMessage()).contains("order #1");
        assertThat(savedNotification.getMessage()).contains("$100.00");
    }

    @Test
    void handleOrderEvent_shouldCreateNotificationForOrderPaid() {
        // Given
        OrderEvent event = new OrderEvent(
                "ORDER_PAID",
                2L,
                20L,
                new BigDecimal("200.00")
        );

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setId(2L);
            return notification;
        });

        // When
        notificationService.handleOrderEvent(event);

        // Then
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());

        Notification savedNotification = captor.getValue();
        assertThat(savedNotification.getUserId()).isEqualTo(20L);
        assertThat(savedNotification.getType()).isEqualTo(NotificationType.ORDER_PAID);
        assertThat(savedNotification.getMessage()).contains("Payment confirmed");
    }

    @Test
    void handleOrderEvent_shouldCreateNotificationForOrderCancelled() {
        // Given
        OrderEvent event = new OrderEvent(
                "ORDER_CANCELLED",
                3L,
                30L,
                new BigDecimal("300.00")
        );

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setId(3L);
            return notification;
        });

        // When
        notificationService.handleOrderEvent(event);

        // Then
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());

        Notification savedNotification = captor.getValue();
        assertThat(savedNotification.getUserId()).isEqualTo(30L);
        assertThat(savedNotification.getType()).isEqualTo(NotificationType.ORDER_CANCELLED);
        assertThat(savedNotification.getMessage()).contains("cancelled");
    }
}
