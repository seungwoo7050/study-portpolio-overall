package com.minispring.bridge.filter;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Servlet Filter for logging all HTTP requests and responses.
 *
 * <p>Corresponds to mini-spring's logging_middleware:
 * <pre>
 * def logging_middleware(request: Request, next_fn: Callable) -> Any:
 *     LOGGER.info("%s %s", request.method, request.path)
 *     response = next_fn(request)
 *     LOGGER.info("→ %s", response.status)
 *     return response
 * </pre>
 *
 * <p>Filter vs Interceptor in Spring:
 * - Filters: Part of Servlet API, execute before Spring MVC (can't access @PathVariable)
 * - Interceptors: Part of Spring MVC, execute after routing (can access path variables)
 *
 * <p>We use Filter for logging since it's applied globally and doesn't need
 * access to controller-level details.
 */
@Component
public class LoggingFilter implements Filter {

    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingFilter.class);

    /**
     * Intercept every HTTP request/response.
     *
     * <p>Execution order:
     * 1. LoggingFilter (this) - logs request
     * 2. AuthInterceptor (if applicable) - checks authorization
     * 3. Controller method - handles request
     * 4. LoggingFilter (this) - logs response
     *
     * <p>This mirrors mini-spring's middleware chain execution.
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Log incoming request (pre-processing)
        String method = httpRequest.getMethod();
        String path = httpRequest.getRequestURI();
        LOGGER.info("{} {}", method, path);

        // Continue filter chain (call next filter/interceptor/controller)
        long startTime = System.currentTimeMillis();
        chain.doFilter(request, response);
        long duration = System.currentTimeMillis() - startTime;

        // Log response (post-processing)
        int status = httpResponse.getStatus();
        LOGGER.info("→ {} ({}ms)", status, duration);
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        LOGGER.info("LoggingFilter initialized (global middleware)");
    }

    @Override
    public void destroy() {
        LOGGER.info("LoggingFilter destroyed");
    }
}
