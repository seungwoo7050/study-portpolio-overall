package com.minispring.bridge.repository;

import com.minispring.bridge.model.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * User repository using Spring's JdbcTemplate with HikariCP connection pooling.
 *
 * <p>Corresponds to mini-spring's DatabaseConnection methods:
 * <ul>
 *   <li>list_users() → findAll()</li>
 *   <li>get_user(id) → findById(id)</li>
 *   <li>create_user(name, email) → save(user)</li>
 * </ul>
 *
 * <p>HikariCP is automatically configured via spring.datasource.hikari.* properties,
 * providing the same connection pooling features as milestone-1.3's ConnectionPool.
 */
@Repository
public class UserRepository {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Constructor injection of JdbcTemplate.
     *
     * <p>Spring Boot auto-configures JdbcTemplate with HikariCP DataSource.
     * This is equivalent to mini-spring's:
     * <pre>
     * def __init__(self, pool=inject(ConnectionPool)):
     *     self.pool = pool
     * </pre>
     */
    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * RowMapper converts SQL ResultSet to User object.
     * Similar to manual parsing in mini-spring's database layer.
     */
    private final RowMapper<User> userRowMapper = (rs, rowNum) -> new User(
        rs.getString("id"),
        rs.getString("name"),
        rs.getString("email")
    );

    /**
     * Find all users.
     *
     * <p>Equivalent to mini-spring's:
     * <pre>
     * def list_users(self) -> List[User]:
     *     with self._lock:
     *         return list(self._users.values())
     * </pre>
     */
    public List<User> findAll() {
        return jdbcTemplate.query("SELECT id, name, email FROM users", userRowMapper);
    }

    /**
     * Find user by ID.
     *
     * <p>Equivalent to mini-spring's:
     * <pre>
     * def get_user(self, user_id: str) -> Optional[User]:
     *     with self._lock:
     *         return self._users.get(user_id)
     * </pre>
     */
    public Optional<User> findById(String id) {
        List<User> results = jdbcTemplate.query(
            "SELECT id, name, email FROM users WHERE id = ?",
            userRowMapper,
            id
        );
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    /**
     * Create a new user.
     *
     * <p>Equivalent to mini-spring's:
     * <pre>
     * def create_user(self, name: str, email: str) -> User:
     *     with self._lock:
     *         identifier = str(self._sequence)
     *         self._sequence += 1
     *         user = User(id=identifier, name=name, email=email)
     *         self._users[identifier] = user
     *         return user
     * </pre>
     *
     * <p>Note: In this implementation, ID is generated externally before calling save().
     * For a more realistic implementation, you'd use database-generated IDs.
     */
    public User save(User user) {
        jdbcTemplate.update(
            "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
            user.getId(),
            user.getName(),
            user.getEmail()
        );
        return user;
    }

    /**
     * Get next available ID (simple sequence simulation).
     * In production, use database sequences or UUIDs.
     */
    public String getNextId() {
        Integer maxId = jdbcTemplate.queryForObject(
            "SELECT MAX(CAST(id AS INT)) FROM users",
            Integer.class
        );
        return String.valueOf(maxId == null ? 1 : maxId + 1);
    }
}
