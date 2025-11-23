package com.example.training.team.dto;

import com.example.training.team.domain.TeamRole;
import jakarta.validation.constraints.NotNull;

public class AddTeamMemberRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotNull(message = "Role is required")
    private TeamRole role;

    public AddTeamMemberRequest() {
    }

    public AddTeamMemberRequest(Long userId, TeamRole role) {
        this.userId = userId;
        this.role = role;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public TeamRole getRole() {
        return role;
    }

    public void setRole(TeamRole role) {
        this.role = role;
    }
}
