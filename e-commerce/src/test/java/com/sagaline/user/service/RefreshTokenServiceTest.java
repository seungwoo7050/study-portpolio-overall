package com.sagaline.user.service;

import com.sagaline.common.security.JwtTokenProvider;
import com.sagaline.user.domain.RefreshToken;
import com.sagaline.user.domain.User;
import com.sagaline.user.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    @Test
    void createRefreshToken_ShouldRevokeExistingAndPersistNewToken() {
        User user = User.builder()
                .id(1L)
                .email("user@example.com")
                .build();

        when(jwtTokenProvider.createRefreshToken("user@example.com", 1L))
                .thenReturn("generated-refresh-token");
        when(jwtTokenProvider.getRefreshValidityInMilliseconds()).thenReturn(3600000L);
        when(refreshTokenRepository.save(any(RefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RefreshToken created = refreshTokenService.createRefreshToken(user);

        assertThat(created.getToken()).isEqualTo("generated-refresh-token");
        assertThat(created.getUser()).isEqualTo(user);
        assertThat(created.getExpiresAt()).isAfter(LocalDateTime.now());

        verify(refreshTokenRepository).revokeAllByUser(eq(user), any(LocalDateTime.class));
        verify(refreshTokenRepository).save(any(RefreshToken.class));
        verify(jwtTokenProvider).createRefreshToken("user@example.com", 1L);
    }

    @Test
    void verifyExpiration_WithValidToken_ShouldReturnToken() {
        RefreshToken token = RefreshToken.builder()
                .token("valid")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .revoked(false)
                .build();

        RefreshToken verified = refreshTokenService.verifyExpiration(token);

        assertThat(verified).isSameAs(token);
        verify(refreshTokenRepository, never()).delete(any(RefreshToken.class));
    }

    @Test
    void verifyExpiration_WithExpiredToken_ShouldDeleteAndThrow() {
        RefreshToken token = RefreshToken.builder()
                .token("expired")
                .expiresAt(LocalDateTime.now().minusMinutes(1))
                .build();

        assertThatThrownBy(() -> refreshTokenService.verifyExpiration(token))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Refresh token has expired. Please login again.");

        verify(refreshTokenRepository).delete(token);
    }

    @Test
    void validateRefreshToken_ShouldDelegateToProvider() {
        when(jwtTokenProvider.validateToken("refresh"))
                .thenReturn(true);
        when(jwtTokenProvider.isRefreshToken("refresh"))
                .thenReturn(true);

        assertThat(refreshTokenService.validateRefreshToken("refresh")).isTrue();

        verify(jwtTokenProvider).validateToken("refresh");
        verify(jwtTokenProvider).isRefreshToken("refresh");
    }

    @Test
    void revokeToken_ShouldMarkTokenAsRevoked() {
        RefreshToken token = RefreshToken.builder()
                .token("to-revoke")
                .revoked(false)
                .build();

        when(refreshTokenRepository.save(token)).thenReturn(token);

        refreshTokenService.revokeToken(token);

        assertThat(token.getRevoked()).isTrue();
        assertThat(token.getRevokedAt()).isNotNull();
        verify(refreshTokenRepository).save(token);
    }

    @Test
    void cleanupExpiredTokens_ShouldInvokeRepositoryDeletion() {
        refreshTokenService.cleanupExpiredTokens();

        verify(refreshTokenRepository).deleteExpiredTokens(any(LocalDateTime.class));
    }
}
