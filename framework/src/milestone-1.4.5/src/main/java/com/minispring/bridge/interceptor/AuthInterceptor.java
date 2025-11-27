package com.minispring.bridge.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * HandlerInterceptor for authentication on protected routes.
 *
 * <p>Corresponds to mini-spring's auth_required middleware:
 * <pre>
 * def auth_required(request: Request, next_fn: Callable) -> Any:
 *     token = request.get_header("authorization")
 *     if not token or not token.startswith("Bearer "):
 *         return Response.error("unauthorized", status=401)
 *     return next_fn(request)
 * </pre>
 *
 * <p>Spring Interceptor advantages over mini-spring's decorator approach:
 * - Can be applied via path patterns (/** , /api/**, /admin/**)
 * - Integrates with Spring MVC lifecycle
 * - Access to controller method metadata via HandlerMethod
 *
 * <p>Interceptor execution order:
 * 1. preHandle() - before controller (return false to abort)
 * 2. Controller method executes
 * 3. postHandle() - after controller, before view rendering
 * 4. afterCompletion() - after response sent (for cleanup)
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthInterceptor.class);

    /**
     * Pre-handle authentication check.
     *
     * <p>Executed before the controller method.
     *
     * @return true to continue, false to abort request with 401
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        String authHeader = request.getHeader("Authorization");

        // Check for Bearer token (simple auth like mini-spring)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            LOGGER.warn("Unauthorized access attempt: {} {}", request.getMethod(), request.getRequestURI());

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"unauthorized\"}");
            response.getWriter().flush();

            return false; // Abort request (controller won't execute)
        }

        // Token is valid (in production, verify JWT/session here)
        LOGGER.debug("Authenticated request: {}", authHeader);
        return true; // Continue to controller
    }
}
