package com.sagaline.user.api;

import com.sagaline.user.api.dto.AuthResponse;
import com.sagaline.user.api.dto.LoginRequest;
import com.sagaline.user.api.dto.RefreshTokenRequest;
import com.sagaline.user.api.dto.RegisterRequest;
import com.sagaline.user.api.dto.UserDTO;
import com.sagaline.user.domain.UserRole;
import com.sagaline.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private AuthController authController;

    private UserDTO userDto;

    @BeforeEach
    void setUp() {
        userDto = UserDTO.builder()
                .id(1L)
                .email("test@example.com")
                .name("Test User")
                .phoneNumber("010-1234-5678")
                .roles(Set.of(UserRole.ROLE_USER))
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void register_ShouldDelegateToService() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");
        request.setName("Test User");

        when(userService.register(any(RegisterRequest.class)))
                .thenReturn(AuthResponse.of("mock_token", userDto));

        ResponseEntity<AuthResponse> response = authController.register(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getToken()).isEqualTo("mock_token");
        assertThat(response.getBody().getUser().getEmail()).isEqualTo("test@example.com");
        verify(userService).register(request);
    }

    @Test
    void login_ShouldReturnTokenResponse() {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");

        when(userService.login(any(LoginRequest.class)))
                .thenReturn(AuthResponse.of("mock_token", userDto));

        ResponseEntity<AuthResponse> response = authController.login(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getUser().getName()).isEqualTo("Test User");
        verify(userService).login(request);
    }

    @Test
    void refresh_ShouldReturnUpdatedTokens() {
        RefreshTokenRequest request = new RefreshTokenRequest("refresh-token");
        AuthResponse expected = AuthResponse.of("new-access-token", "refresh-token", 3600L, userDto);
        when(userService.refreshAccessToken("refresh-token")).thenReturn(expected);

        ResponseEntity<AuthResponse> response = authController.refresh(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getRefreshToken()).isEqualTo("refresh-token");
        assertThat(response.getBody().getToken()).isEqualTo("new-access-token");
        verify(userService).refreshAccessToken("refresh-token");
    }

    @Test
    void getCurrentUser_ShouldReturnUserFromService() {
        when(userService.getUserById(1L)).thenReturn(userDto);

        ResponseEntity<UserDTO> response = authController.getCurrentUser(1L);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getEmail()).isEqualTo("test@example.com");
        verify(userService).getUserById(1L);
    }
}
