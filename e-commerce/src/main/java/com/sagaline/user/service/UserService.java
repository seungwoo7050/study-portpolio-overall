package com.sagaline.user.service;

import com.sagaline.common.metrics.MetricsConfiguration;
import com.sagaline.common.security.JwtTokenProvider;
import com.sagaline.user.api.dto.*;
import com.sagaline.user.domain.User;
import com.sagaline.user.domain.UserRole;
import com.sagaline.user.domain.UserRoleEntity;
import com.sagaline.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final MetricsConfiguration.BusinessMetrics businessMetrics;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        log.info("Registering new user: {}", request.getEmail());

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .phoneNumber(request.getPhoneNumber())
                .isActive(true)
                .isEmailVerified(false)
                .build();

        // Save user first to get the ID
        user = userRepository.save(user);

        // Create default role with the persisted user
        UserRoleEntity roleEntity = UserRoleEntity.builder()
                .user(user)
                .role(UserRole.ROLE_USER)
                .build();

        // Add to user's roles collection
        user.getRoles().add(roleEntity);

        // Save again to persist the role (cascade will handle it)
        user = userRepository.save(user);

        // Track metrics
        businessMetrics.incrementUserRegistrations();

        log.info("User registered successfully: {}", user.getId());

        // Generate JWT token
        Set<UserRole> roles = user.getRoles().stream()
                .map(UserRoleEntity::getRole)
                .collect(Collectors.toSet());

        String accessToken = jwtTokenProvider.createToken(user.getEmail(), user.getId(), roles);
        String refreshToken = refreshTokenService.createRefreshToken(user).getToken();
        Long expiresIn = jwtTokenProvider.getValidityInMilliseconds() / 1000;

        return AuthResponse.of(accessToken, refreshToken, expiresIn, toDTO(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        log.info("User login attempt: {}", request.getEmail());

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        if (!user.getIsActive()) {
            throw new IllegalStateException("Account is deactivated");
        }

        // Update last login
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("User logged in successfully: {}", user.getId());

        // Generate JWT token
        Set<UserRole> roles = user.getRoles().stream()
                .map(UserRoleEntity::getRole)
                .collect(Collectors.toSet());

        String accessToken = jwtTokenProvider.createToken(user.getEmail(), user.getId(), roles);
        String refreshToken = refreshTokenService.createRefreshToken(user).getToken();
        Long expiresIn = jwtTokenProvider.getValidityInMilliseconds() / 1000;

        return AuthResponse.of(accessToken, refreshToken, expiresIn, toDTO(user));
    }

    @Transactional
    public AuthResponse refreshAccessToken(String refreshTokenString) {
        log.info("Refreshing access token");

        // Validate refresh token
        if (!refreshTokenService.validateRefreshToken(refreshTokenString)) {
            throw new IllegalArgumentException("Invalid refresh token");
        }

        // Find refresh token in database
        var refreshToken = refreshTokenService.findByToken(refreshTokenString)
                .orElseThrow(() -> new IllegalArgumentException("Refresh token not found"));

        // Verify expiration
        refreshTokenService.verifyExpiration(refreshToken);

        // Check if revoked
        if (!refreshToken.isValid()) {
            throw new IllegalArgumentException("Refresh token has been revoked");
        }

        // Get user
        User user = refreshToken.getUser();

        // Generate new access token
        Set<UserRole> roles = user.getRoles().stream()
                .map(UserRoleEntity::getRole)
                .collect(Collectors.toSet());

        String accessToken = jwtTokenProvider.createToken(user.getEmail(), user.getId(), roles);
        Long expiresIn = jwtTokenProvider.getValidityInMilliseconds() / 1000;

        log.info("Access token refreshed for user: {}", user.getId());

        return AuthResponse.of(accessToken, refreshTokenString, expiresIn, toDTO(user));
    }

    @Transactional(readOnly = true)
    public UserDTO getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return toDTO(user);
    }

    private UserDTO toDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .phoneNumber(user.getPhoneNumber())
                .roles(user.getRoles().stream()
                        .map(UserRoleEntity::getRole)
                        .collect(Collectors.toSet()))
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
