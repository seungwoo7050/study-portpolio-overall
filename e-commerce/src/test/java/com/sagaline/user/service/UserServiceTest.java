package com.sagaline.user.service;

import com.sagaline.common.metrics.MetricsConfiguration;
import com.sagaline.common.security.JwtTokenProvider;
import com.sagaline.user.api.dto.AuthResponse;
import com.sagaline.user.api.dto.LoginRequest;
import com.sagaline.user.api.dto.RegisterRequest;
import com.sagaline.user.domain.RefreshToken;
import com.sagaline.user.domain.User;
import com.sagaline.user.domain.UserRole;
import com.sagaline.user.domain.UserRoleEntity;
import com.sagaline.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private MetricsConfiguration.BusinessMetrics businessMetrics;

    @InjectMocks
    private UserService userService;

    @Test
    void register_Success() {
        // Given
        RegisterRequest request = new RegisterRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");
        request.setName("Test User");
        request.setPhoneNumber("010-1234-5678");

        User savedUser = User.builder()
                .id(1L)
                .email(request.getEmail())
                .passwordHash("hashed_password")
                .name(request.getName())
                .phoneNumber(request.getPhoneNumber())
                .isActive(true)
                .isEmailVerified(false)
                .build();

        UserRoleEntity roleEntity = UserRoleEntity.builder()
                .user(savedUser)
                .role(UserRole.ROLE_USER)
                .build();
        savedUser.setRoles(new HashSet<>(Set.of(roleEntity)));

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(passwordEncoder.encode(request.getPassword())).thenReturn("hashed_password");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtTokenProvider.createToken(anyString(), any(), anySet())).thenReturn("mock_jwt_token");
        when(jwtTokenProvider.getValidityInMilliseconds()).thenReturn(3600000L);
        when(refreshTokenService.createRefreshToken(any(User.class))).thenAnswer(invocation ->
                RefreshToken.builder()
                        .token("mock_refresh_token")
                        .user(invocation.getArgument(0))
                        .expiresAt(LocalDateTime.now().plusDays(7))
                        .build());

        // When
        AuthResponse response = userService.register(request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo("mock_jwt_token");
        assertThat(response.getUser().getEmail()).isEqualTo(request.getEmail());
        assertThat(response.getUser().getName()).isEqualTo(request.getName());

        verify(userRepository).existsByEmail(request.getEmail());
        verify(passwordEncoder).encode(request.getPassword());
        verify(userRepository, times(2)).save(any(User.class));
        verify(jwtTokenProvider).createToken(anyString(), any(), anySet());
        verify(refreshTokenService).createRefreshToken(any(User.class));
        verify(businessMetrics).incrementUserRegistrations();
    }

    @Test
    void register_EmailAlreadyExists_ThrowsException() {
        // Given
        RegisterRequest request = new RegisterRequest();
        request.setEmail("existing@example.com");
        request.setPassword("password123");
        request.setName("Test User");

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(true);

        // When & Then
        assertThatThrownBy(() -> userService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Email already registered");

        verify(userRepository).existsByEmail(request.getEmail());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void login_Success() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");

        User user = User.builder()
                .id(1L)
                .email(request.getEmail())
                .passwordHash("hashed_password")
                .name("Test User")
                .isActive(true)
                .build();

        UserRoleEntity roleEntity = UserRoleEntity.builder()
                .user(user)
                .role(UserRole.ROLE_USER)
                .build();
        user.setRoles(new HashSet<>(Set.of(roleEntity)));

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), user.getPasswordHash())).thenReturn(true);
        when(jwtTokenProvider.createToken(anyString(), any(), anySet())).thenReturn("mock_jwt_token");
        when(userRepository.save(any(User.class))).thenReturn(user);
        when(jwtTokenProvider.getValidityInMilliseconds()).thenReturn(3600000L);
        when(refreshTokenService.createRefreshToken(any(User.class))).thenAnswer(invocation ->
                RefreshToken.builder()
                        .token("mock_refresh_token")
                        .user(invocation.getArgument(0))
                        .expiresAt(LocalDateTime.now().plusDays(7))
                        .build());

        // When
        AuthResponse response = userService.login(request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getToken()).isEqualTo("mock_jwt_token");
        assertThat(response.getUser().getEmail()).isEqualTo(request.getEmail());

        verify(userRepository).findByEmail(request.getEmail());
        verify(passwordEncoder).matches(request.getPassword(), user.getPasswordHash());
        verify(userRepository).save(any(User.class)); // Save for lastLoginAt update
        verify(refreshTokenService).createRefreshToken(any(User.class));
    }

    @Test
    void login_InvalidPassword_ThrowsException() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("wrong_password");

        User user = User.builder()
                .id(1L)
                .email(request.getEmail())
                .passwordHash("hashed_password")
                .isActive(true)
                .build();

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), user.getPasswordHash())).thenReturn(false);

        // When & Then
        assertThatThrownBy(() -> userService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email or password");

        verify(userRepository).findByEmail(request.getEmail());
        verify(passwordEncoder).matches(request.getPassword(), user.getPasswordHash());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void login_UserNotActive_ThrowsException() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");

        User user = User.builder()
                .id(1L)
                .email(request.getEmail())
                .passwordHash("hashed_password")
                .isActive(false)
                .build();

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), user.getPasswordHash())).thenReturn(true);

        // When & Then
        assertThatThrownBy(() -> userService.login(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Account is deactivated");

        verify(userRepository).findByEmail(request.getEmail());
        verify(passwordEncoder).matches(request.getPassword(), user.getPasswordHash());
    }

    @Test
    void getUserById_ReturnsUserDto() {
        User user = User.builder()
                .id(1L)
                .email("test@example.com")
                .name("Test User")
                .isActive(true)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThat(userService.getUserById(1L))
                .isNotNull()
                .extracting("email", "name", "isActive")
                .containsExactly("test@example.com", "Test User", true);

        verify(userRepository).findById(1L);
    }

    @Test
    void getUserById_NotFound_ThrowsException() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User not found");

        verify(userRepository).findById(99L);
    }

    @Test
    void refreshAccessToken_ShouldIssueNewAccessToken() {
        User user = User.builder()
                .id(1L)
                .email("test@example.com")
                .passwordHash("hashed")
                .name("Test User")
                .isActive(true)
                .build();
        UserRoleEntity role = UserRoleEntity.builder()
                .user(user)
                .role(UserRole.ROLE_USER)
                .build();
        user.getRoles().add(role);

        RefreshToken refreshToken = RefreshToken.builder()
                .token("refresh-token")
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(2))
                .revoked(false)
                .build();

        when(refreshTokenService.validateRefreshToken("refresh-token")).thenReturn(true);
        when(refreshTokenService.findByToken("refresh-token")).thenReturn(Optional.of(refreshToken));
        when(refreshTokenService.verifyExpiration(refreshToken)).thenReturn(refreshToken);
        when(jwtTokenProvider.createToken(anyString(), any(), anySet())).thenReturn("new-access-token");
        when(jwtTokenProvider.getValidityInMilliseconds()).thenReturn(7200000L);

        AuthResponse response = userService.refreshAccessToken("refresh-token");

        assertThat(response.getToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        assertThat(response.getExpiresIn()).isEqualTo(7200L);
        assertThat(response.getUser().getEmail()).isEqualTo("test@example.com");

        verify(refreshTokenService).validateRefreshToken("refresh-token");
        verify(refreshTokenService).findByToken("refresh-token");
        verify(refreshTokenService).verifyExpiration(refreshToken);
        verify(jwtTokenProvider).createToken(anyString(), any(), anySet());
    }

    @Test
    void refreshAccessToken_InvalidToken_ThrowsException() {
        when(refreshTokenService.validateRefreshToken("invalid")).thenReturn(false);

        assertThatThrownBy(() -> userService.refreshAccessToken("invalid"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid refresh token");

        verify(refreshTokenService).validateRefreshToken("invalid");
        verify(refreshTokenService, never()).findByToken(anyString());
    }

    @Test
    void refreshAccessToken_NotFound_ThrowsException() {
        when(refreshTokenService.validateRefreshToken("refresh-token")).thenReturn(true);
        when(refreshTokenService.findByToken("refresh-token")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.refreshAccessToken("refresh-token"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Refresh token not found");

        verify(refreshTokenService).validateRefreshToken("refresh-token");
        verify(refreshTokenService).findByToken("refresh-token");
    }

    @Test
    void refreshAccessToken_RevokedToken_ThrowsException() {
        User user = User.builder()
                .id(1L)
                .email("revoked@example.com")
                .passwordHash("hashed")
                .name("Revoked User")
                .isActive(true)
                .build();
        UserRoleEntity role = UserRoleEntity.builder()
                .user(user)
                .role(UserRole.ROLE_USER)
                .build();
        user.getRoles().add(role);

        RefreshToken refreshToken = RefreshToken.builder()
                .token("revoked-token")
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .revoked(true)
                .build();

        when(refreshTokenService.validateRefreshToken("revoked-token")).thenReturn(true);
        when(refreshTokenService.findByToken("revoked-token")).thenReturn(Optional.of(refreshToken));
        when(refreshTokenService.verifyExpiration(refreshToken)).thenReturn(refreshToken);

        assertThatThrownBy(() -> userService.refreshAccessToken("revoked-token"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Refresh token has been revoked");

        verify(refreshTokenService).validateRefreshToken("revoked-token");
        verify(refreshTokenService).findByToken("revoked-token");
        verify(refreshTokenService).verifyExpiration(refreshToken);
        verify(jwtTokenProvider, never()).createToken(anyString(), any(), anySet());
    }
}
