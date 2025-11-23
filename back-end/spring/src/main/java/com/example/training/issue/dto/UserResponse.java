package com.example.training.issue.dto;

import com.example.training.issue.domain.User;

import java.time.LocalDateTime;

public class UserResponse {
    private Long id;
    private String email;
    private String nickname;
    private LocalDateTime createdAt;

    public UserResponse(Long id, String email, String nickname, LocalDateTime createdAt) {
        this.id = id;
        this.email = email;
        this.nickname = nickname;
        this.createdAt = createdAt;
    }

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getCreatedAt()
        );
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getNickname() {
        return nickname;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
