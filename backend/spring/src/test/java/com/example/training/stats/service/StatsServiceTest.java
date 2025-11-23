package com.example.training.stats.service;

import com.example.training.issue.domain.Issue;
import com.example.training.issue.domain.IssueStatus;
import com.example.training.issue.repository.CommentRepository;
import com.example.training.issue.repository.IssueRepository;
import com.example.training.stats.domain.DailyIssueStats;
import com.example.training.stats.repository.DailyIssueStatsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StatsServiceTest {

    @Mock
    private DailyIssueStatsRepository dailyStatsRepository;

    @Mock
    private IssueRepository issueRepository;

    @Mock
    private CommentRepository commentRepository;

    @InjectMocks
    private StatsService statsService;

    private LocalDate testDate;
    private LocalDateTime startOfDay;
    private LocalDateTime endOfDay;

    @BeforeEach
    void setUp() {
        testDate = LocalDate.of(2025, 1, 15);
        startOfDay = testDate.atStartOfDay();
        endOfDay = testDate.atTime(LocalTime.MAX);
    }

    @Test
    void aggregateDailyStats_shouldCreateNewStats_whenNotExists() {
        // Given
        when(issueRepository.countByCreatedAtBetween(startOfDay, endOfDay)).thenReturn(5);
        when(issueRepository.countResolvedBetween(startOfDay, endOfDay)).thenReturn(3);
        when(commentRepository.countByCreatedAtBetween(startOfDay, endOfDay)).thenReturn(12);
        when(dailyStatsRepository.findByDate(testDate)).thenReturn(Optional.empty());

        DailyIssueStats savedStats = new DailyIssueStats(testDate, 5, 3, 12);
        when(dailyStatsRepository.save(any(DailyIssueStats.class))).thenReturn(savedStats);

        // When
        statsService.aggregateDailyStats(testDate);

        // Then
        verify(issueRepository).countByCreatedAtBetween(startOfDay, endOfDay);
        verify(issueRepository).countResolvedBetween(startOfDay, endOfDay);
        verify(commentRepository).countByCreatedAtBetween(startOfDay, endOfDay);
        verify(dailyStatsRepository).save(any(DailyIssueStats.class));
    }

    @Test
    void aggregateDailyStats_shouldUpdateExistingStats_whenExists() {
        // Given
        DailyIssueStats existingStats = new DailyIssueStats(testDate, 2, 1, 5);
        when(dailyStatsRepository.findByDate(testDate)).thenReturn(Optional.of(existingStats));

        when(issueRepository.countByCreatedAtBetween(startOfDay, endOfDay)).thenReturn(5);
        when(issueRepository.countResolvedBetween(startOfDay, endOfDay)).thenReturn(3);
        when(commentRepository.countByCreatedAtBetween(startOfDay, endOfDay)).thenReturn(12);

        when(dailyStatsRepository.save(any(DailyIssueStats.class))).thenReturn(existingStats);

        // When
        statsService.aggregateDailyStats(testDate);

        // Then
        verify(dailyStatsRepository).findByDate(testDate);
        verify(dailyStatsRepository).save(existingStats);
        assertThat(existingStats.getCreatedCount()).isEqualTo(5);
        assertThat(existingStats.getResolvedCount()).isEqualTo(3);
        assertThat(existingStats.getCommentCount()).isEqualTo(12);
    }
}
