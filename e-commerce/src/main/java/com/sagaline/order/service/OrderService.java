package com.sagaline.order.service;

import com.sagaline.cart.domain.Cart;
import com.sagaline.cart.domain.CartItem;
import com.sagaline.cart.repository.CartRepository;
import com.sagaline.common.config.KafkaConfig;
import com.sagaline.common.event.EventPublisher;
import com.sagaline.common.metrics.MetricsConfiguration;
import com.sagaline.order.api.dto.CreateOrderRequest;
import com.sagaline.order.api.dto.OrderDTO;
import com.sagaline.order.api.dto.OrderItemDTO;
import com.sagaline.order.domain.Order;
import com.sagaline.order.domain.OrderItem;
import com.sagaline.order.domain.OrderStatus;
import com.sagaline.order.event.OrderConfirmedEvent;
import com.sagaline.order.event.OrderCreatedEvent;
import com.sagaline.order.repository.OrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final CartRepository cartRepository;
    private final MetricsConfiguration.BusinessMetrics businessMetrics;
    private final ObjectProvider<EventPublisher> eventPublisherProvider;

    public OrderService(OrderRepository orderRepository,
                        CartRepository cartRepository,
                        MetricsConfiguration.BusinessMetrics businessMetrics,
                        ObjectProvider<EventPublisher> eventPublisherProvider) {
        this.orderRepository = orderRepository;
        this.cartRepository = cartRepository;
        this.businessMetrics = businessMetrics;
        this.eventPublisherProvider = eventPublisherProvider;
    }

    @Transactional
    public OrderDTO createOrder(Long userId, CreateOrderRequest request) {
        log.info("Creating order for user: {}", userId);

        // 1. Get cart
        Cart cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("Cart not found"));

        if (cart.getItems().isEmpty()) {
            throw new IllegalStateException("Cart is empty");
        }

        // 2. Calculate total
        BigDecimal totalAmount = cart.getItems().stream()
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3. Create order
        Order order = Order.builder()
                .userId(userId)
                .status(OrderStatus.PENDING)
                .totalAmount(totalAmount)
                .shippingAddress(request.getShippingAddress())
                .shippingCity(request.getShippingCity())
                .shippingPostalCode(request.getShippingPostalCode())
                .build();

        // 4. Create order items from cart
        for (CartItem cartItem : cart.getItems()) {
            BigDecimal subtotal = cartItem.getPrice().multiply(BigDecimal.valueOf(cartItem.getQuantity()));

            OrderItem orderItem = OrderItem.builder()
                    .productId(cartItem.getProduct().getId())
                    .quantity(cartItem.getQuantity())
                    .price(cartItem.getPrice())
                    .subtotal(subtotal)
                    .build();

            order.addItem(orderItem);
        }

        order = orderRepository.save(order);

        // 5. Clear cart
        cart.clearItems();
        cartRepository.save(cart);

        // Track metrics
        businessMetrics.incrementOrdersCreated();
        businessMetrics.addRevenue(totalAmount.doubleValue());

        // Publish OrderCreated event
        OrderCreatedEvent event = new OrderCreatedEvent(
                order.getId(),
                order.getUserId(),
                order.getTotalAmount(),
                order.getStatus().name(),
                order.getItems().stream()
                        .map(item -> new OrderCreatedEvent.OrderItemData(
                                item.getProductId(),
                                item.getQuantity(),
                                item.getPrice()
                        ))
                        .collect(Collectors.toList())
        );
        EventPublisher publisher = eventPublisherProvider.getIfAvailable();
        if (publisher != null) {
            publisher.publish(KafkaConfig.ORDER_EVENTS_TOPIC, event);
        } else {
            log.warn("Event publisher not available, skipping OrderCreated event for order {}", order.getId());
        }

        log.info("Order created successfully: {}", order.getId());

        return toDTO(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderDTO> getUserOrders(Long userId, Pageable pageable) {
        return orderRepository.findByUserId(userId, pageable)
                .map(this::toDTO);
    }

    @Transactional(readOnly = true)
    public OrderDTO getOrderById(Long userId, Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        if (!order.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Order does not belong to user");
        }

        return toDTO(order);
    }

    @Transactional
    public OrderDTO updateOrderStatus(Long orderId, OrderStatus newStatus) {
        log.info("Updating order {} status to {}", orderId, newStatus);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        OrderStatus oldStatus = order.getStatus();
        order.setStatus(newStatus);
        order = orderRepository.save(order);

        // Track status change metrics
        if (newStatus == OrderStatus.CONFIRMED && oldStatus != OrderStatus.CONFIRMED) {
            businessMetrics.incrementOrdersConfirmed();

            // Publish OrderConfirmed event
            OrderConfirmedEvent event = new OrderConfirmedEvent(
                    order.getId(),
                    order.getUserId(),
                    newStatus.name()
            );
            EventPublisher publisher = eventPublisherProvider.getIfAvailable();
            if (publisher != null) {
                publisher.publish(KafkaConfig.ORDER_EVENTS_TOPIC, event);
            } else {
                log.warn("Event publisher not available, skipping OrderConfirmed event for order {}", order.getId());
            }
        } else if (newStatus == OrderStatus.CANCELLED && oldStatus != OrderStatus.CANCELLED) {
            businessMetrics.incrementOrdersCancelled();
        }

        return toDTO(order);
    }

    private OrderDTO toDTO(Order order) {
        List<OrderItemDTO> itemDTOs = order.getItems().stream()
                .map(item -> OrderItemDTO.builder()
                        .id(item.getId())
                        .productId(item.getProductId())
                        .quantity(item.getQuantity())
                        .price(item.getPrice())
                        .subtotal(item.getSubtotal())
                        .build())
                .collect(Collectors.toList());

        return OrderDTO.builder()
                .id(order.getId())
                .userId(order.getUserId())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .shippingAddress(order.getShippingAddress())
                .shippingCity(order.getShippingCity())
                .shippingPostalCode(order.getShippingPostalCode())
                .items(itemDTOs)
                .createdAt(order.getCreatedAt())
                .build();
    }
}
