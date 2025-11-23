package com.example.training.stats.dto;

import com.example.training.stats.domain.DailyIssueStats;

import java.time.LocalDate;

public record DailyStatsResponse(
    LocalDate date,
    Integer createdCount,
    Integer resolvedCount,
    Integer commentCount
) {
    public static DailyStatsResponse from(DailyIssueStats stats) {
        return new DailyStatsResponse(
            stats.getDate(),
            stats.getCreatedCount(),
            stats.getResolvedCount(),
            stats.getCommentCount()
        );
    }
}
