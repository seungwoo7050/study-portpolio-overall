package com.sagaline.user.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshTokenTest {

    @Test
    void onCreate_ShouldInitializeDefaults() {
        RefreshToken token = RefreshToken.builder()
                .token("token")
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build();

        token.onCreate();

        assertThat(token.getCreatedAt()).isNotNull();
        assertThat(token.getRevoked()).isFalse();
    }

    @Test
    void isValid_ShouldReflectExpirationAndRevocation() {
        RefreshToken active = RefreshToken.builder()
                .token("active")
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .revoked(false)
                .build();

        RefreshToken expired = RefreshToken.builder()
                .token("expired")
                .expiresAt(LocalDateTime.now().minusMinutes(10))
                .revoked(false)
                .build();

        RefreshToken revoked = RefreshToken.builder()
                .token("revoked")
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .revoked(true)
                .build();

        assertThat(active.isValid()).isTrue();
        assertThat(expired.isValid()).isFalse();
        assertThat(revoked.isValid()).isFalse();
    }

    @Test
    void revoke_ShouldMarkTokenAsRevoked() {
        RefreshToken token = RefreshToken.builder()
                .token("revoke")
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .revoked(false)
                .build();

        token.revoke();

        assertThat(token.getRevoked()).isTrue();
        assertThat(token.getRevokedAt()).isNotNull();
    }
}
