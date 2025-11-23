package com.example.training.issue.dto;

import com.example.training.issue.domain.Comment;

import java.time.LocalDateTime;

public class CommentResponse {
    private Long id;
    private Long issueId;
    private Long authorId;
    private String content;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public CommentResponse(Long id, Long issueId, Long authorId, String content,
                           LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.issueId = issueId;
        this.authorId = authorId;
        this.content = content;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static CommentResponse from(Comment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getIssueId(),
                comment.getAuthorId(),
                comment.getContent(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }

    public Long getId() {
        return id;
    }

    public Long getIssueId() {
        return issueId;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public String getContent() {
        return content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
