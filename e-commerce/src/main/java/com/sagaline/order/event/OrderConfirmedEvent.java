package com.sagaline.order.event;

import com.sagaline.common.event.BaseEvent;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class OrderConfirmedEvent extends BaseEvent {
    private Long orderId;
    private Long userId;
    private String status;

    public OrderConfirmedEvent(Long orderId, Long userId, String status) {
        super("OrderConfirmed", "order-service");
        this.orderId = orderId;
        this.userId = userId;
        this.status = status;
    }
}
