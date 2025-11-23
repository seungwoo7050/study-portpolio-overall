package com.sagaline.common.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for custom Prometheus metrics
 */
@Configuration
public class MetricsConfiguration {

    @Bean
    public BusinessMetrics businessMetrics(MeterRegistry meterRegistry) {
        return new BusinessMetrics(meterRegistry);
    }

    /**
     * Business metrics for tracking e-commerce operations
     */
    public static class BusinessMetrics {
        private final MeterRegistry meterRegistry;

        // User metrics
        private final Counter userRegistrationsTotal;

        // Order metrics
        private final Counter ordersCreatedTotal;
        private final Counter ordersConfirmedTotal;
        private final Counter ordersCancelledTotal;

        // Payment metrics
        private final Counter paymentTransactionsTotal;
        private final Counter paymentSuccessTotal;
        private final Counter paymentFailedTotal;

        // Revenue metrics
        private final Counter revenueTotalKRW;

        // Database metrics
        private final Timer databaseQueryDuration;

        public BusinessMetrics(MeterRegistry meterRegistry) {
            this.meterRegistry = meterRegistry;

            // Initialize user metrics
            this.userRegistrationsTotal = Counter.builder("user_registrations_total")
                    .description("Total number of user registrations")
                    .register(meterRegistry);

            // Initialize order metrics
            this.ordersCreatedTotal = Counter.builder("orders_created_total")
                    .description("Total number of orders created")
                    .tag("status", "created")
                    .register(meterRegistry);

            this.ordersConfirmedTotal = Counter.builder("orders_created_total")
                    .description("Total number of orders confirmed")
                    .tag("status", "confirmed")
                    .register(meterRegistry);

            this.ordersCancelledTotal = Counter.builder("orders_created_total")
                    .description("Total number of orders cancelled")
                    .tag("status", "cancelled")
                    .register(meterRegistry);

            // Initialize payment metrics
            this.paymentTransactionsTotal = Counter.builder("payment_transactions_total")
                    .description("Total number of payment transactions")
                    .tag("status", "all")
                    .tag("method", "all")
                    .register(meterRegistry);

            this.paymentSuccessTotal = Counter.builder("payment_transactions_total")
                    .description("Total number of successful payments")
                    .tag("status", "success")
                    .tag("method", "toss")
                    .register(meterRegistry);

            this.paymentFailedTotal = Counter.builder("payment_transactions_total")
                    .description("Total number of failed payments")
                    .tag("status", "failed")
                    .tag("method", "toss")
                    .register(meterRegistry);

            // Initialize revenue metrics
            this.revenueTotalKRW = Counter.builder("revenue_total")
                    .description("Total revenue in KRW")
                    .baseUnit("krw")
                    .tag("currency", "KRW")
                    .register(meterRegistry);

            // Initialize database metrics
            this.databaseQueryDuration = Timer.builder("database_query_duration_seconds")
                    .description("Database query execution time")
                    .tag("query_type", "select")
                    .register(meterRegistry);
        }

        public void incrementUserRegistrations() {
            userRegistrationsTotal.increment();
        }

        public void incrementOrdersCreated() {
            ordersCreatedTotal.increment();
        }

        public void incrementOrdersConfirmed() {
            ordersConfirmedTotal.increment();
        }

        public void incrementOrdersCancelled() {
            ordersCancelledTotal.increment();
        }

        public void incrementPaymentTransaction(String method) {
            Counter.builder("payment_transactions_total")
                    .tag("status", "all")
                    .tag("method", method)
                    .register(meterRegistry)
                    .increment();
        }

        public void incrementPaymentSuccess(String method) {
            Counter.builder("payment_transactions_total")
                    .tag("status", "success")
                    .tag("method", method)
                    .register(meterRegistry)
                    .increment();
        }

        public void incrementPaymentFailed(String method) {
            Counter.builder("payment_transactions_total")
                    .tag("status", "failed")
                    .tag("method", method)
                    .register(meterRegistry)
                    .increment();
        }

        public void addRevenue(double amount) {
            revenueTotalKRW.increment(amount);
        }

        public Timer.Sample startDatabaseTimer() {
            return Timer.start(meterRegistry);
        }

        public void recordDatabaseQuery(Timer.Sample sample, String queryType) {
            Timer timer = Timer.builder("database_query_duration_seconds")
                    .tag("query_type", queryType)
                    .register(meterRegistry);
            sample.stop(timer);
        }
    }
}
