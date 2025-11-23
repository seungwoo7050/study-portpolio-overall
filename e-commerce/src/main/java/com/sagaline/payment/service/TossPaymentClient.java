package com.sagaline.payment.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Client for Toss Payments API with circuit breaker and retry patterns
 * In production, this would make actual HTTP calls to Toss Payments API
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TossPaymentClient {

    /**
     * Process payment with circuit breaker and retry
     * Circuit breaker prevents cascading failures when payment service is down
     * Retry handles transient failures with exponential backoff
     */
    @CircuitBreaker(name = "paymentService", fallbackMethod = "processPaymentFallback")
    @Retry(name = "paymentService")
    public PaymentResult processPayment(PaymentRequest request) {
        log.info("Processing payment for order: {}, amount: {}",
                request.getOrderId(), request.getAmount());

        // Simulate external API call
        // In production, this would call Toss Payments API
        // Example: restTemplate.postForObject(tossPaymentsUrl, request, PaymentResponse.class)

        // Simulate random failures for testing circuit breaker (remove in production)
        simulateRandomFailure();

        // Mock successful payment
        String transactionId = "TOSS_" + UUID.randomUUID().toString();
        log.info("Payment processed successfully. Transaction ID: {}", transactionId);

        return PaymentResult.builder()
                .success(true)
                .transactionId(transactionId)
                .status("COMPLETED")
                .message("Payment processed successfully")
                .build();
    }

    /**
     * Fallback method when circuit is open or retries exhausted
     * Provides graceful degradation
     */
    private PaymentResult processPaymentFallback(PaymentRequest request, Exception e) {
        log.error("Payment service unavailable. Fallback triggered for order: {}. Error: {}",
                request.getOrderId(), e.getMessage());

        return PaymentResult.builder()
                .success(false)
                .transactionId(null)
                .status("PENDING")
                .message("Payment processing delayed. Your order is pending. Please try again later.")
                .build();
    }

    /**
     * Simulate random failures for testing (remove in production)
     * 20% failure rate to test circuit breaker
     */
    private void simulateRandomFailure() {
        if (Math.random() < 0.0) {  // Set to 0.0 to disable simulation
            throw new RuntimeException("Simulated payment service failure");
        }
    }

    // Inner classes for request/response
    public static class PaymentRequest {
        private Long orderId;
        private Long amount;
        private String method;
        private String customerEmail;

        public Long getOrderId() { return orderId; }
        public void setOrderId(Long orderId) { this.orderId = orderId; }
        public Long getAmount() { return amount; }
        public void setAmount(Long amount) { this.amount = amount; }
        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }
        public String getCustomerEmail() { return customerEmail; }
        public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private PaymentRequest request = new PaymentRequest();

            public Builder orderId(Long orderId) {
                request.orderId = orderId;
                return this;
            }

            public Builder amount(Long amount) {
                request.amount = amount;
                return this;
            }

            public Builder method(String method) {
                request.method = method;
                return this;
            }

            public Builder customerEmail(String email) {
                request.customerEmail = email;
                return this;
            }

            public PaymentRequest build() {
                return request;
            }
        }
    }

    @lombok.Builder
    @lombok.Data
    public static class PaymentResult {
        private boolean success;
        private String transactionId;
        private String status;
        private String message;
    }
}
