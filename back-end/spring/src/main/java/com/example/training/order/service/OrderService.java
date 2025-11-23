package com.example.training.order.service;

import com.example.training.common.exception.ResourceNotFoundException;
import com.example.training.order.domain.Order;
import com.example.training.order.domain.OrderItem;
import com.example.training.order.dto.CreateOrderRequest;
import com.example.training.order.dto.OrderItemRequest;
import com.example.training.order.dto.OrderResponse;
import com.example.training.order.event.OrderEvent;
import com.example.training.order.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private static final String ORDER_EVENTS_TOPIC = "order-events";

    private final OrderRepository orderRepository;
    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;

    public OrderService(OrderRepository orderRepository, KafkaTemplate<String, OrderEvent> kafkaTemplate) {
        this.orderRepository = orderRepository;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Transactional
    public OrderResponse createOrder(Long userId, CreateOrderRequest request) {
        // Create order
        Order order = new Order();
        order.setUserId(userId);

        // Add items
        for (OrderItemRequest itemRequest : request.getItems()) {
            OrderItem item = new OrderItem();
            item.setProductId(itemRequest.getProductId());
            item.setQuantity(itemRequest.getQuantity());
            item.setPrice(itemRequest.getPrice());
            order.addItem(item);
        }

        // Calculate total amount
        order.calculateTotalAmount();

        // Save order
        Order savedOrder = orderRepository.save(order);

        // Publish event after transaction commits
        publishOrderCreatedEvent(savedOrder);

        logger.info("Order created: orderId={}, userId={}, totalAmount={}",
                savedOrder.getId(), savedOrder.getUserId(), savedOrder.getTotalAmount());

        return new OrderResponse(savedOrder);
    }

    private void publishOrderCreatedEvent(Order order) {
        try {
            OrderEvent event = new OrderEvent(
                    "ORDER_CREATED",
                    order.getId(),
                    order.getUserId(),
                    order.getTotalAmount()
            );

            kafkaTemplate.send(ORDER_EVENTS_TOPIC, event.getEventId(), event);
            logger.info("Published ORDER_CREATED event: eventId={}, orderId={}",
                    event.getEventId(), order.getId());
        } catch (Exception e) {
            logger.error("Failed to publish ORDER_CREATED event for orderId={}", order.getId(), e);
            // In production, you might want to implement a retry mechanism or dead letter queue
        }
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return new OrderResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getUserOrders(Long userId) {
        List<Order> orders = orderRepository.findByUserId(userId);
        return orders.stream()
                .map(OrderResponse::new)
                .collect(Collectors.toList());
    }
}
