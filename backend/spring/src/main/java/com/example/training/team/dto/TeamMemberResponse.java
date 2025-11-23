package com.example.training.team.dto;

import com.example.training.team.domain.TeamMember;
import com.example.training.team.domain.TeamRole;

import java.time.LocalDateTime;

public class TeamMemberResponse {

    private Long id;
    private Long teamId;
    private Long userId;
    private TeamRole role;
    private LocalDateTime joinedAt;

    public TeamMemberResponse() {
    }

    public TeamMemberResponse(Long id, Long teamId, Long userId, TeamRole role, LocalDateTime joinedAt) {
        this.id = id;
        this.teamId = teamId;
        this.userId = userId;
        this.role = role;
        this.joinedAt = joinedAt;
    }

    public static TeamMemberResponse from(TeamMember member) {
        return new TeamMemberResponse(
            member.getId(),
            member.getTeamId(),
            member.getUserId(),
            member.getRole(),
            member.getJoinedAt()
        );
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTeamId() {
        return teamId;
    }

    public void setTeamId(Long teamId) {
        this.teamId = teamId;
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

    public LocalDateTime getJoinedAt() {
        return joinedAt;
    }

    public void setJoinedAt(LocalDateTime joinedAt) {
        this.joinedAt = joinedAt;
    }
}
