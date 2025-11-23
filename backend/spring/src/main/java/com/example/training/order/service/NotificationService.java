package com.example.training.order.service;

import com.example.training.order.domain.Notification;
import com.example.training.order.domain.NotificationType;
import com.example.training.order.dto.NotificationResponse;
import com.example.training.order.event.OrderEvent;
import com.example.training.order.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @KafkaListener(topics = "order-events", groupId = "training-group")
    @Transactional
    public void handleOrderEvent(OrderEvent event) {
        logger.info("Received order event: eventId={}, eventType={}, orderId={}",
                event.getEventId(), event.getEventType(), event.getOrderId());

        try {
            if ("ORDER_CREATED".equals(event.getEventType())) {
                createOrderNotification(event);
            } else if ("ORDER_PAID".equals(event.getEventType())) {
                createOrderPaidNotification(event);
            } else if ("ORDER_CANCELLED".equals(event.getEventType())) {
                createOrderCancelledNotification(event);
            }
        } catch (Exception e) {
            logger.error("Failed to process order event: eventId={}", event.getEventId(), e);
            throw e; // Re-throw to let Kafka handle retry
        }
    }

    private void createOrderNotification(OrderEvent event) {
        Notification notification = new Notification();
        notification.setUserId(event.getUserId());
        notification.setType(NotificationType.ORDER_CREATED);
        notification.setMessage(String.format(
                "Your order #%d has been created successfully. Total amount: $%.2f",
                event.getOrderId(), event.getTotalAmount()
        ));

        notificationRepository.save(notification);
        logger.info("Created ORDER_CREATED notification for userId={}, orderId={}",
                event.getUserId(), event.getOrderId());

        // In a real application, you might send an email or push notification here
        simulateEmailSending(notification);
    }

    private void createOrderPaidNotification(OrderEvent event) {
        Notification notification = new Notification();
        notification.setUserId(event.getUserId());
        notification.setType(NotificationType.ORDER_PAID);
        notification.setMessage(String.format(
                "Payment confirmed for order #%d. Amount: $%.2f",
                event.getOrderId(), event.getTotalAmount()
        ));

        notificationRepository.save(notification);
        logger.info("Created ORDER_PAID notification for userId={}, orderId={}",
                event.getUserId(), event.getOrderId());

        simulateEmailSending(notification);
    }

    private void createOrderCancelledNotification(OrderEvent event) {
        Notification notification = new Notification();
        notification.setUserId(event.getUserId());
        notification.setType(NotificationType.ORDER_CANCELLED);
        notification.setMessage(String.format(
                "Order #%d has been cancelled.",
                event.getOrderId()
        ));

        notificationRepository.save(notification);
        logger.info("Created ORDER_CANCELLED notification for userId={}, orderId={}",
                event.getUserId(), event.getOrderId());

        simulateEmailSending(notification);
    }

    private void simulateEmailSending(Notification notification) {
        // Simulate email sending
        logger.info("📧 Email sent to userId={}: {}", notification.getUserId(), notification.getMessage());
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getUserNotifications(Long userId) {
        List<Notification> notifications = notificationRepository.findByUserId(userId);
        return notifications.stream()
                .map(NotificationResponse::new)
                .collect(Collectors.toList());
    }
}
