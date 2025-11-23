package com.sagaline.user.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    @Test
    void onCreate_ShouldInitializeTimestampsAndDefaults() {
        User user = User.builder()
                .email("test@example.com")
                .passwordHash("hashed")
                .name("Test User")
                .build();

        user.onCreate();

        assertThat(user.getCreatedAt()).isNotNull();
        assertThat(user.getUpdatedAt()).isNotNull();
        assertThat(user.getIsActive()).isTrue();
        assertThat(user.getIsEmailVerified()).isFalse();
    }

    @Test
    void onUpdate_ShouldRefreshUpdatedAt() {
        User user = User.builder()
                .email("test@example.com")
                .passwordHash("hashed")
                .name("Test User")
                .build();

        user.onCreate();
        LocalDateTime firstUpdatedAt = user.getUpdatedAt();

        user.onUpdate();

        assertThat(user.getUpdatedAt())
                .isNotNull()
                .isAfterOrEqualTo(firstUpdatedAt);
    }

    @Test
    void equalsAndHashCode_ShouldUseIdentifier() {
        User first = User.builder().id(1L).email("first@example.com").build();
        User second = User.builder().id(1L).email("second@example.com").build();
        User third = User.builder().id(2L).email("third@example.com").build();

        assertThat(first).isEqualTo(second);
        assertThat(first).isNotEqualTo(third);
        assertThat(first.hashCode()).isEqualTo(second.hashCode());
    }
}
