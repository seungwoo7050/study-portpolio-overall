package com.sagaline.common.ratelimit;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@Profile("!test")
@RequiredArgsConstructor
public class RateLimitService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final MeterRegistry meterRegistry;

    /**
     * Check if the request is allowed based on rate limiting rules
     *
     * @param key         Unique identifier (e.g., userId, IP address)
     * @param maxRequests Maximum number of requests allowed
     * @param duration    Time window for the limit
     * @return true if request is allowed, false if rate limit exceeded
     */
    public boolean isAllowed(String key, int maxRequests, Duration duration) {
        String rateLimitKey = "rate_limit:" + key;

        try {
            // Increment the counter
            Long currentCount = redisTemplate.opsForValue().increment(rateLimitKey);

            if (currentCount == null) {
                currentCount = 0L;
            }

            // Set expiration on first request
            if (currentCount == 1) {
                redisTemplate.expire(rateLimitKey, duration);
            }

            boolean allowed = currentCount <= maxRequests;

            // Track metrics
            if (allowed) {
                Counter.builder("rate_limit.requests")
                        .tag("status", "allowed")
                        .description("Number of requests allowed by rate limiter")
                        .register(meterRegistry)
                        .increment();
            } else {
                Counter.builder("rate_limit.requests")
                        .tag("status", "rejected")
                        .description("Number of requests rejected by rate limiter")
                        .register(meterRegistry)
                        .increment();

                log.warn("Rate limit exceeded for key: {}, count: {}/{}", key, currentCount, maxRequests);
            }

            return allowed;

        } catch (Exception e) {
            log.error("Error checking rate limit, allowing request", e);
            // On error, allow the request (fail-open)
            return true;
        }
    }

    /**
     * Reset rate limit for a specific key
     */
    public void reset(String key) {
        String rateLimitKey = "rate_limit:" + key;
        redisTemplate.delete(rateLimitKey);
        log.info("Rate limit reset for key: {}", key);
    }

    /**
     * Get current request count for a key
     */
    public long getCurrentCount(String key) {
        String rateLimitKey = "rate_limit:" + key;
        Object count = redisTemplate.opsForValue().get(rateLimitKey);
        return count != null ? Long.parseLong(count.toString()) : 0;
    }

    /**
     * Get remaining time until rate limit resets
     */
    public long getRemainingTimeSeconds(String key) {
        String rateLimitKey = "rate_limit:" + key;
        Long ttl = redisTemplate.getExpire(rateLimitKey, TimeUnit.SECONDS);
        return ttl != null ? ttl : 0;
    }
}
