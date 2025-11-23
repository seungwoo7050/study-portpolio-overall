package com.sagaline.payment.event;

import com.sagaline.common.event.BaseEvent;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class PaymentCompletedEvent extends BaseEvent {
    private Long paymentId;
    private Long orderId;
    private BigDecimal amount;
    private String method;
    private String transactionId;

    public PaymentCompletedEvent(Long paymentId, Long orderId, BigDecimal amount, String method, String transactionId) {
        super("PaymentCompleted", "payment-service");
        this.paymentId = paymentId;
        this.orderId = orderId;
        this.amount = amount;
        this.method = method;
        this.transactionId = transactionId;
    }
}
