package com.minispring.bridge.controller;

import com.minispring.bridge.model.User;
import com.minispring.bridge.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST controller for user management endpoints.
 *
 * <p>Direct mapping to mini-spring's controllers.py:
 * <pre>
 * # mini-spring
 * @app.route("/api/users", methods=["GET"])
 * def list_users(request):
 *     ...
 *
 * @app.route("/api/users/{id}", methods=["GET"])
 * @app.middleware(auth_required)
 * def get_user(request, id):
 *     ...
 *
 * @app.route("/api/users", methods=["POST"])
 * @app.middleware(auth_required)
 * def create_user(request):
 *     ...
 * </pre>
 *
 * <p>Spring Boot equivalent uses @RestController, @RequestMapping, and
 * method-level annotations (@GetMapping, @PostMapping).
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    /**
     * Constructor injection of UserService.
     *
     * <p>Spring's DI container (@Autowired implicit on single constructor)
     * is equivalent to mini-spring's:
     * <pre>
     * pool = request.app.resolve("connection_pool")
     * </pre>
     */
    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * List all users.
     *
     * <p>Endpoint: GET /api/users
     *
     * <p>mini-spring equivalent:
     * <pre>
     * @app.route("/api/users", methods=["GET"])
     * def list_users(request):
     *     pool = request.app.resolve("connection_pool")
     *     with pool.acquire() as conn:
     *         users = conn.list_users()
     *     return {"users": [u.to_dict() for u in users]}
     * </pre>
     *
     * <p>Spring Boot handles:
     * - Connection pooling (HikariCP automatic)
     * - JSON serialization (Jackson automatic)
     * - HTTP response formatting
     */
    @GetMapping
    public ResponseEntity<Map<String, List<User>>> listUsers() {
        List<User> users = userService.getAllUsers();
        return ResponseEntity.ok(Map.of("users", users));
    }

    /**
     * Get user by ID.
     *
     * <p>Endpoint: GET /api/users/{id}
     * <p>Requires authentication (via AuthInterceptor)
     *
     * <p>mini-spring equivalent:
     * <pre>
     * @app.route("/api/users/{id}", methods=["GET"])
     * @app.middleware(auth_required)
     * def get_user(request, id):
     *     pool = request.app.resolve("connection_pool")
     *     with pool.acquire() as conn:
     *         user = conn.get_user(id)
     *     if user is None:
     *         return Response.error("user_not_found", status=404)
     *     return {"user": user.to_dict()}
     * </pre>
     *
     * <p>@PathVariable extracts {id} from URL, similar to mini-spring's
     * path parameter extraction in routing.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable String id) {
        return userService.getUserById(id)
            .map(user -> ResponseEntity.ok(Map.of("user", user)))
            .orElseGet(() -> ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "user_not_found")));
    }

    /**
     * Create a new user.
     *
     * <p>Endpoint: POST /api/users
     * <p>Requires authentication (via AuthInterceptor)
     *
     * <p>mini-spring equivalent:
     * <pre>
     * @app.route("/api/users", methods=["POST"])
     * @app.middleware(auth_required)
     * def create_user(request):
     *     data = request.json()
     *     name = data.get("name")
     *     email = data.get("email")
     *     pool = request.app.resolve("connection_pool")
     *     with pool.acquire() as conn:
     *         user = conn.create_user(name=name, email=email)
     *     return Response(status=201, payload={"user": user.to_dict()})
     * </pre>
     *
     * <p>@RequestBody automatically deserializes JSON to Map.
     * Spring Boot's Jackson handles JSON parsing (mini-spring does manual parsing).
     */
    @PostMapping
    public ResponseEntity<Map<String, User>> createUser(@RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        String email = payload.get("email");

        if (name == null || email == null) {
            return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(Map.of());
        }

        User user = userService.createUser(name, email);
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Map.of("user", user));
    }
}
