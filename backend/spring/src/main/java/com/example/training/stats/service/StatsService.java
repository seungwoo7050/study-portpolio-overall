package com.example.training.stats.service;

import com.example.training.issue.repository.CommentRepository;
import com.example.training.issue.repository.IssueRepository;
import com.example.training.stats.domain.DailyIssueStats;
import com.example.training.stats.repository.DailyIssueStatsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
public class StatsService {

    private static final Logger log = LoggerFactory.getLogger(StatsService.class);

    private final DailyIssueStatsRepository dailyStatsRepository;
    private final IssueRepository issueRepository;
    private final CommentRepository commentRepository;

    public StatsService(DailyIssueStatsRepository dailyStatsRepository,
                       IssueRepository issueRepository,
                       CommentRepository commentRepository) {
        this.dailyStatsRepository = dailyStatsRepository;
        this.issueRepository = issueRepository;
        this.commentRepository = commentRepository;
    }

    @Transactional
    public void aggregateDailyStats(LocalDate date) {
        log.info("Aggregating daily stats for date: {}", date);

        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(LocalTime.MAX);

        // Count issues created on the date
        int createdCount = issueRepository.countByCreatedAtBetween(startOfDay, endOfDay);

        // Count issues resolved on the date
        int resolvedCount = issueRepository.countResolvedBetween(startOfDay, endOfDay);

        // Count comments created on the date
        int commentCount = commentRepository.countByCreatedAtBetween(startOfDay, endOfDay);

        // Upsert: update if exists, insert if not
        DailyIssueStats stats = dailyStatsRepository.findByDate(date)
            .map(existing -> {
                existing.update(createdCount, resolvedCount, commentCount);
                return existing;
            })
            .orElseGet(() -> new DailyIssueStats(date, createdCount, resolvedCount, commentCount));

        dailyStatsRepository.save(stats);
        log.info("Daily stats aggregated: created={}, resolved={}, comments={}",
                 createdCount, resolvedCount, commentCount);
    }

    @Transactional(readOnly = true)
    public List<DailyIssueStats> getDailyStats(LocalDate from, LocalDate to) {
        return dailyStatsRepository.findByDateBetweenOrderByDateAsc(from, to);
    }
}
