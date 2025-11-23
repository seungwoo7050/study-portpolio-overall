package com.sagaline.common.health;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.LivenessState;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.kafka.core.KafkaAdmin;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * Custom health indicators for liveness and readiness probes
 * Kubernetes uses these to determine if pods should be restarted or receive traffic
 */
@Configuration
public class CustomHealthIndicators {

    /**
     * Database health indicator
     * Checks if database connection is available
     */
    @Bean
    public HealthIndicator dbHealthIndicator(DataSource dataSource) {
        return () -> {
            try (Connection connection = dataSource.getConnection()) {
                if (connection.isValid(2)) {
                    return Health.up()
                            .withDetail("database", "PostgreSQL")
                            .withDetail("validationQuery", "Connection validated")
                            .build();
                }
            } catch (Exception e) {
                return Health.down()
                        .withDetail("error", e.getMessage())
                        .build();
            }
            return Health.down().withDetail("error", "Connection invalid").build();
        };
    }

    /**
     * Redis health indicator
     * Checks if Redis connection is available
     */
    @Bean
    public HealthIndicator redisHealthIndicator(RedisConnectionFactory redisConnectionFactory) {
        return () -> {
            try {
                redisConnectionFactory.getConnection().ping();
                return Health.up()
                        .withDetail("redis", "Connected")
                        .build();
            } catch (Exception e) {
                return Health.down()
                        .withDetail("error", e.getMessage())
                        .build();
            }
        };
    }

    /**
     * Liveness probe
     * Indicates whether the application is running
     * If this fails, Kubernetes will restart the pod
     */
    @Bean
    public HealthIndicator livenessProbe(ApplicationAvailability availability) {
        return () -> {
            LivenessState livenessState = availability.getLivenessState();

            if (livenessState == LivenessState.CORRECT) {
                return Health.up()
                        .withDetail("state", livenessState.toString())
                        .withDetail("description", "Application is alive")
                        .build();
            }

            return Health.status(new Status("FATAL"))
                    .withDetail("state", livenessState.toString())
                    .withDetail("description", "Application is not alive")
                    .build();
        };
    }

    /**
     * Readiness probe
     * Indicates whether the application is ready to serve traffic
     * If this fails, Kubernetes will not route traffic to this pod
     */
    @Bean
    public HealthIndicator readinessProbe(ApplicationAvailability availability,
                                         DataSource dataSource,
                                         RedisConnectionFactory redisConnectionFactory) {
        return () -> {
            ReadinessState readinessState = availability.getReadinessState();

            // Check if application is ready
            if (readinessState != ReadinessState.ACCEPTING_TRAFFIC) {
                return Health.outOfService()
                        .withDetail("state", readinessState.toString())
                        .withDetail("description", "Application not ready to accept traffic")
                        .build();
            }

            // Check critical dependencies
            Health.Builder builder = Health.up();

            // Check database
            try (Connection connection = dataSource.getConnection()) {
                if (!connection.isValid(2)) {
                    return Health.down()
                            .withDetail("database", "unavailable")
                            .build();
                }
                builder.withDetail("database", "ready");
            } catch (Exception e) {
                return Health.down()
                        .withDetail("database", "error: " + e.getMessage())
                        .build();
            }

            // Check Redis
            try {
                redisConnectionFactory.getConnection().ping();
                builder.withDetail("redis", "ready");
            } catch (Exception e) {
                // Redis is optional, don't fail readiness
                builder.withDetail("redis", "unavailable (degraded mode)");
            }

            return builder
                    .withDetail("state", readinessState.toString())
                    .withDetail("description", "Application ready to serve traffic")
                    .build();
        };
    }
}
