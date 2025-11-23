package com.sagaline.user.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserRoleEntityTest {

    @Test
    void onCreate_ShouldSetCreatedAtTimestamp() {
        UserRoleEntity role = UserRoleEntity.builder()
                .role(UserRole.ROLE_USER)
                .user(User.builder().id(1L).email("test@example.com").build())
                .build();

        role.onCreate();

        assertThat(role.getCreatedAt()).isNotNull();
    }

    @Test
    void equalsAndHashCode_ShouldUseIdentifier() {
        UserRoleEntity first = UserRoleEntity.builder().id(1L).build();
        UserRoleEntity second = UserRoleEntity.builder().id(1L).build();
        UserRoleEntity third = UserRoleEntity.builder().id(2L).build();

        assertThat(first).isEqualTo(second);
        assertThat(first).isNotEqualTo(third);
        assertThat(first.hashCode()).isEqualTo(second.hashCode());
    }
}
