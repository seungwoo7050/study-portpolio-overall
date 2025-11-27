package com.minispring.bridge.config;

import com.minispring.bridge.interceptor.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC configuration for registering interceptors.
 *
 * <p>Corresponds to mini-spring's middleware registration:
 * <pre>
 * # Global middleware (applied to all routes)
 * app.use(logging_middleware)
 *
 * # Route-specific middleware (applied via decorator)
 * @app.route("/api/users/{id}", methods=["GET"])
 * @app.middleware(auth_required)
 * def get_user(request, id):
 *     ...
 * </pre>
 *
 * <p>Spring Boot approach:
 * - Filters: Registered automatically via @Component (LoggingFilter)
 * - Interceptors: Registered via WebMvcConfigurer.addInterceptors()
 *
 * <p>Path patterns control which routes trigger which interceptors:
 * - /** : All routes
 * - /api/** : All /api routes
 * - /api/users/{id} : Specific route (supports path variables)
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;

    public WebConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    /**
     * Register interceptors with path patterns.
     *
     * <p>Execution order:
     * 1. LoggingFilter (all requests) - global
     * 2. AuthInterceptor (protected routes only) - route-specific
     * 3. Controller method
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
            // Protected routes requiring authentication (matching mini-spring's @app.middleware(auth_required))
            .addPathPatterns("/api/users/{id}")  // GET /api/users/{id}
            .addPathPatterns("/api/users")       // POST /api/users (but not GET)
            .excludePathPatterns("/health");     // Health check is public

        // Note: In mini-spring, we apply middleware per HTTP method via decorator.
        // In Spring Boot, we can use request.getMethod() in preHandle() for finer control.
        // For this spike, we keep it simple and protect all matching paths.
    }
}
