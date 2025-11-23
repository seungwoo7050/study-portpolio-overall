package com.example.training.stats.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_issue_stats", uniqueConstraints = {
    @UniqueConstraint(columnNames = "date")
})
public class DailyIssueStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate date;

    @Column(nullable = false)
    private Integer createdCount;

    @Column(nullable = false)
    private Integer resolvedCount;

    @Column(nullable = false)
    private Integer commentCount;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    protected DailyIssueStats() {
    }

    public DailyIssueStats(LocalDate date, Integer createdCount, Integer resolvedCount, Integer commentCount) {
        this.date = date;
        this.createdCount = createdCount;
        this.resolvedCount = resolvedCount;
        this.commentCount = commentCount;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getDate() {
        return date;
    }

    public Integer getCreatedCount() {
        return createdCount;
    }

    public Integer getResolvedCount() {
        return resolvedCount;
    }

    public Integer getCommentCount() {
        return commentCount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void update(Integer createdCount, Integer resolvedCount, Integer commentCount) {
        this.createdCount = createdCount;
        this.resolvedCount = resolvedCount;
        this.commentCount = commentCount;
    }
}
