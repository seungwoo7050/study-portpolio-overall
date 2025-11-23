package com.example.training.team.dto;

import com.example.training.team.domain.TeamRole;
import jakarta.validation.constraints.NotNull;

public class UpdateTeamMemberRoleRequest {

    @NotNull(message = "Role is required")
    private TeamRole role;

    public UpdateTeamMemberRoleRequest() {
    }

    public UpdateTeamMemberRoleRequest(TeamRole role) {
        this.role = role;
    }

    public TeamRole getRole() {
        return role;
    }

    public void setRole(TeamRole role) {
        this.role = role;
    }
}
