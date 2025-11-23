package com.example.training.team.dto;

import com.example.training.team.domain.Team;

import java.time.LocalDateTime;

public class TeamResponse {

    private Long id;
    private String name;
    private LocalDateTime createdAt;

    public TeamResponse() {
    }

    public TeamResponse(Long id, String name, LocalDateTime createdAt) {
        this.id = id;
        this.name = name;
        this.createdAt = createdAt;
    }

    public static TeamResponse from(Team team) {
        return new TeamResponse(team.getId(), team.getName(), team.getCreatedAt());
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
