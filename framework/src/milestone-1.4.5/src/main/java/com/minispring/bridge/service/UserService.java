package com.minispring.bridge.service;

import com.minispring.bridge.model.User;
import com.minispring.bridge.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * User service layer handling business logic.
 *
 * <p>In mini-spring, business logic is directly in controllers.
 * Spring Boot encourages service layer separation for:
 * <ul>
 *   <li>Transaction management (@Transactional)</li>
 *   <li>Business logic reuse</li>
 *   <li>Testability</li>
 * </ul>
 *
 * <p>This is one difference in Spring Boot's layered architecture compared
 * to mini-spring's simpler controller → repository pattern.
 */
@Service
public class UserService {

    private final UserRepository userRepository;

    /**
     * Constructor injection (preferred over field injection).
     *
     * <p>Equivalent to mini-spring's:
     * <pre>
     * def __init__(self, repo=inject(UserRepository)):
     *     self.repo = repo
     * </pre>
     */
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Get all users.
     */
    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    /**
     * Get user by ID.
     */
    @Transactional(readOnly = true)
    public Optional<User> getUserById(String id) {
        return userRepository.findById(id);
    }

    /**
     * Create a new user with auto-generated ID.
     *
     * <p>@Transactional ensures atomic operation within database transaction.
     * This is equivalent to mini-spring's manual connection management:
     * <pre>
     * with pool.acquire() as conn:
     *     user = conn.create_user(name, email)
     * </pre>
     */
    @Transactional
    public User createUser(String name, String email) {
        String id = userRepository.getNextId();
        User user = new User(id, name, email);
        return userRepository.save(user);
    }
}
