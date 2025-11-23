package com.example.training.issue.dto;

import com.example.training.issue.domain.IssueStatus;
import jakarta.validation.constraints.Size;

public class IssueUpdateRequest {

    @Size(max = 200, message = "Title must not exceed 200 characters")
    private String title;

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;

    private IssueStatus status;

    private Long assigneeId;

    public IssueUpdateRequest() {
    }

    public IssueUpdateRequest(String title, String description, IssueStatus status, Long assigneeId) {
        this.title = title;
        this.description = description;
        this.status = status;
        this.assigneeId = assigneeId;
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

    public Long getAssigneeId() {
        return assigneeId;
    }
}
