package com.sagaline.order.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateOrderRequest {

    @NotBlank(message = "Shipping address is required")
    private String shippingAddress;

    private String shippingCity;

    private String shippingPostalCode;

    @NotBlank(message = "Payment method is required")
    private String paymentMethod;
}
