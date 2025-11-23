package com.example.training.stats.repository;

import com.example.training.stats.domain.DailyIssueStats;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyIssueStatsRepository extends JpaRepository<DailyIssueStats, Long> {

    Optional<DailyIssueStats> findByDate(LocalDate date);

    List<DailyIssueStats> findByDateBetweenOrderByDateAsc(LocalDate from, LocalDate to);
}
