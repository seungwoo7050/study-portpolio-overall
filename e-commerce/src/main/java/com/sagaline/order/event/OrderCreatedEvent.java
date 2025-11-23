package com.sagaline.order.event;

import com.sagaline.common.event.BaseEvent;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class OrderCreatedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private BigDecimal totalAmount;
    private String status;
    private List<OrderItemData> items;

    public OrderCreatedEvent(Long orderId, Long userId, BigDecimal totalAmount, String status, List<OrderItemData> items) {
        super("OrderCreated", "order-service");
        this.orderId = orderId;
        this.userId = userId;
        this.totalAmount = totalAmount;
        this.status = status;
        this.items = items;
    }

    @Data
    @NoArgsConstructor
    public static class OrderItemData {
        private Long productId;
        private Integer quantity;
        private BigDecimal price;

        public OrderItemData(Long productId, Integer quantity, BigDecimal price) {
            this.productId = productId;
            this.quantity = quantity;
            this.price = price;
        }
    }
}
