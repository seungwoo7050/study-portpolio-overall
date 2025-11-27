package com.minispring.bridge;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring Boot application entry point for Milestone 1.4.5 (Spring Bridge).
 *
 * <p>This application demonstrates the Spring Boot equivalent of mini-spring
 * framework features from Milestones 1.1-1.4:
 *
 * <ul>
 *   <li><b>HTTP Server (M1.1)</b>: Embedded Tomcat replaces raw socket programming</li>
 *   <li><b>Routing (M1.2)</b>: @RestController + @RequestMapping replaces @app.route()</li>
 *   <li><b>Middleware (M1.2)</b>: Filter + HandlerInterceptor replace middleware decorators</li>
 *   <li><b>DI Container (M1.2)</b>: Spring IoC container replaces manual DependencyContainer</li>
 *   <li><b>Connection Pool (M1.3)</b>: HikariCP replaces manual ConnectionPool implementation</li>
 *   <li><b>Integration (M1.4)</b>: Spring Boot auto-configuration replaces manual wiring</li>
 * </ul>
 *
 * <p>Comparison with mini-spring's main.py:
 * <pre>
 * # mini-spring/src/milestone-1.4/main.py
 * app = create_app(host="0.0.0.0", port=8080)
 * signal.signal(signal.SIGINT, graceful_shutdown(app))
 * app.listen(port=8080)
 * </pre>
 *
 * <p>Spring Boot equivalent:
 * <pre>
 * public static void main(String[] args) {
 *     SpringApplication.run(SpringBridgeApplication.class, args);
 * }
 * </pre>
 *
 * <p>What Spring Boot auto-configures (that mini-spring does manually):
 * <ul>
 *   <li>Embedded web server (Tomcat) with thread pool</li>
 *   <li>HikariCP connection pool with optimal defaults</li>
 *   <li>Jackson JSON serialization/deserialization</li>
 *   <li>Exception handling and error responses</li>
 *   <li>Logging infrastructure (SLF4J + Logback)</li>
 *   <li>Health endpoint (/actuator/health)</li>
 *   <li>Graceful shutdown hooks</li>
 * </ul>
 *
 * <p><b>Key Learning</b>: Spring Boot eliminates ~500 lines of boilerplate code
 * (HTTP server, routing, DI container, connection pool) in exchange for implicit
 * behavior and "magic" configuration. Understanding mini-spring internals helps
 * debug Spring Boot issues.
 */
@SpringBootApplication
public class SpringBridgeApplication {

    /**
     * Application entry point.
     *
     * <p>SpringApplication.run() performs:
     * 1. Create ApplicationContext (DI container)
     * 2. Component scan (@Component, @Service, @Repository, @RestController)
     * 3. Auto-configure beans (HikariCP, JdbcTemplate, Jackson, etc.)
     * 4. Start embedded web server (Tomcat on port 8080)
     * 5. Register shutdown hooks for graceful shutdown
     *
     * <p>This single line replaces mini-spring's:
     * - HttpServer initialization
     * - Router setup
     * - DependencyContainer creation
     * - ConnectionPool initialization
     * - Middleware registration
     * - Signal handler setup
     */
    public static void main(String[] args) {
        SpringApplication.run(SpringBridgeApplication.class, args);
    }
}
