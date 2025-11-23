package com.sagaline.common.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Interceptor to track HTTP request metrics
 */
@Component
public class HttpMetricsInterceptor implements HandlerInterceptor {

    private final MeterRegistry meterRegistry;
    private static final String START_TIME_ATTRIBUTE = "startTime";

    public HttpMetricsInterceptor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(START_TIME_ATTRIBUTE, System.nanoTime());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                               Object handler, Exception ex) {
        Long startTime = (Long) request.getAttribute(START_TIME_ATTRIBUTE);
        if (startTime != null) {
            long duration = System.nanoTime() - startTime;

            String endpoint = getEndpoint(request);
            String method = request.getMethod();
            String status = String.valueOf(response.getStatus());

            // Record request duration
            Timer.builder("http_request_duration_seconds")
                    .description("HTTP request duration in seconds")
                    .tag("endpoint", endpoint)
                    .tag("method", method)
                    .tag("status", status)
                    .register(meterRegistry)
                    .record(duration, java.util.concurrent.TimeUnit.NANOSECONDS);

            // Record request count
            meterRegistry.counter("http_requests_total",
                    "endpoint", endpoint,
                    "method", method,
                    "status", status
            ).increment();
        }
    }

    private String getEndpoint(HttpServletRequest request) {
        String uri = request.getRequestURI();

        // Normalize endpoints to avoid cardinality explosion
        if (uri.startsWith("/api/users/")) {
            return "/api/users/{id}";
        } else if (uri.startsWith("/api/products/")) {
            return "/api/products/{id}";
        } else if (uri.startsWith("/api/orders/")) {
            return "/api/orders/{id}";
        } else if (uri.startsWith("/api/cart/")) {
            return "/api/cart/{action}";
        }

        return uri;
    }
}
