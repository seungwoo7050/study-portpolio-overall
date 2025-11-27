package com.minispring.bridge.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Health check endpoint controller.
 *
 * <p>Corresponds to mini-spring's:
 * <pre>
 * @app.route("/health")
 * def health(request):
 *     return {"status": "up"}
 * </pre>
 *
 * <p>Note: Spring Boot Actuator provides /actuator/health automatically,
 * but we implement /health for exact parity with mini-spring.
 */
@RestController
public class HealthController {

    /**
     * Health check endpoint.
     *
     * <p>Endpoint: GET /health
     * <p>Response: {"status": "up"}
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "up"));
    }
}
