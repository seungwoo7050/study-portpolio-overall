package com.example.training.issue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class IssueRequest {

    @NotBlank(message = "Title is required")
    @Size(max = 200, message = "Title must not exceed 200 characters")
    private String title;

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;

    private Long assigneeId;

    public IssueRequest() {
    }

    public IssueRequest(String title, String description, Long assigneeId) {
        this.title = title;
        this.description = description;
        this.assigneeId = assigneeId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public Long getAssigneeId() {
        return assigneeId;
    }
}
