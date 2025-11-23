package com.example.training.order.event;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class OrderEvent {

    private String eventId;
    private String eventType;
    private LocalDateTime timestamp;
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;

    // No-arg constructor for deserialization
    public OrderEvent() {
    }

    public OrderEvent(String eventType, Long orderId, Long userId, BigDecimal totalAmount) {
        this.eventId = UUID.randomUUID().toString();
        this.eventType = eventType;
        this.timestamp = LocalDateTime.now();
        this.orderId = orderId;
        this.userId = userId;
        this.totalAmount = totalAmount;
    }

    // Getters and Setters
    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }
}
