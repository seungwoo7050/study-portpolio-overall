package com.example.training.issue.dto;

import com.example.training.issue.domain.Issue;
import com.example.training.issue.domain.IssueStatus;

import java.time.LocalDateTime;

public class IssueResponse {
    private Long id;
    private Long projectId;
    private Long reporterId;
    private Long assigneeId;
    private String title;
    private String description;
    private IssueStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public IssueResponse(Long id, Long projectId, Long reporterId, Long assigneeId,
                         String title, String description, IssueStatus status,
                         LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.projectId = projectId;
        this.reporterId = reporterId;
        this.assigneeId = assigneeId;
        this.title = title;
        this.description = description;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static IssueResponse from(Issue issue) {
        return new IssueResponse(
                issue.getId(),
                issue.getProjectId(),
                issue.getReporterId(),
                issue.getAssigneeId(),
                issue.getTitle(),
                issue.getDescription(),
                issue.getStatus(),
                issue.getCreatedAt(),
                issue.getUpdatedAt()
        );
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public Long getReporterId() {
        return reporterId;
    }

    public Long getAssigneeId() {
        return assigneeId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public IssueStatus getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
