package com.example.training.team.dto;

import com.example.training.team.domain.WorkspaceItem;

import java.time.LocalDateTime;

public class WorkspaceItemResponse {

    private Long id;
    private Long teamId;
    private String title;
    private String content;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public WorkspaceItemResponse() {
    }

    public WorkspaceItemResponse(Long id, Long teamId, String title, String content,
                                 Long createdBy, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.teamId = teamId;
        this.title = title;
        this.content = content;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static WorkspaceItemResponse from(WorkspaceItem item) {
        return new WorkspaceItemResponse(
            item.getId(),
            item.getTeamId(),
            item.getTitle(),
            item.getContent(),
            item.getCreatedBy(),
            item.getCreatedAt(),
            item.getUpdatedAt()
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Long createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
