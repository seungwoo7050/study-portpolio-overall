package com.sagaline.order.consumer;

import com.sagaline.common.config.KafkaConfig;
import com.sagaline.order.event.OrderConfirmedEvent;
import com.sagaline.order.event.OrderCreatedEvent;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.context.annotation.Profile;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@Profile("!test")
@RequiredArgsConstructor
public class OrderEventConsumer {

    private final MeterRegistry meterRegistry;

    /**
     * Handle OrderCreated events
     * In a real application, this would send email notifications, update analytics, etc.
     */
    @KafkaListener(
            topics = KafkaConfig.ORDER_EVENTS_TOPIC,
            groupId = "order-notification-service",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleOrderEvent(@Payload Object event,
                                  @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
                                  @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                                  @Header(KafkaHeaders.OFFSET) long offset) {
        log.info("Received order event: topic={}, partition={}, offset={}, eventType={}",
                topic, partition, offset, event.getClass().getSimpleName());

        try {
            if (event instanceof OrderCreatedEvent) {
                handleOrderCreated((OrderCreatedEvent) event);
            } else if (event instanceof OrderConfirmedEvent) {
                handleOrderConfirmed((OrderConfirmedEvent) event);
            } else {
                log.warn("Unknown event type: {}", event.getClass().getSimpleName());
            }

            // Track successful processing
            Counter.builder("kafka.events.consumed")
                    .tag("topic", topic)
                    .tag("event_type", event.getClass().getSimpleName())
                    .tag("status", "success")
                    .description("Number of Kafka events consumed")
                    .register(meterRegistry)
                    .increment();

        } catch (Exception e) {
            log.error("Error processing order event", e);

            // Track failed processing
            Counter.builder("kafka.events.consumed")
                    .tag("topic", topic)
                    .tag("event_type", event.getClass().getSimpleName())
                    .tag("status", "failed")
                    .description("Number of Kafka events consumed")
                    .register(meterRegistry)
                    .increment();

            // In production, this would be sent to a dead letter queue
            throw e;
        }
    }

    private void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Processing OrderCreated event: orderId={}, userId={}, totalAmount={}",
                event.getOrderId(), event.getUserId(), event.getTotalAmount());

        // TODO: Send order confirmation email
        // TODO: Update analytics
        // TODO: Notify inventory service to reserve stock

        log.info("Order creation notification sent for orderId: {}", event.getOrderId());
    }

    private void handleOrderConfirmed(OrderConfirmedEvent event) {
        log.info("Processing OrderConfirmed event: orderId={}, userId={}, status={}",
                event.getOrderId(), event.getUserId(), event.getStatus());

        // TODO: Send order confirmation SMS
        // TODO: Update customer dashboard

        log.info("Order confirmation notification sent for orderId: {}", event.getOrderId());
    }
}
