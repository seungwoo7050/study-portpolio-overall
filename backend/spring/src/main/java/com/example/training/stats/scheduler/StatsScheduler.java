package com.example.training.stats.scheduler;

import com.example.training.stats.service.StatsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class StatsScheduler {

    private static final Logger log = LoggerFactory.getLogger(StatsScheduler.class);

    private final StatsService statsService;

    public StatsScheduler(StatsService statsService) {
        this.statsService = statsService;
    }

    // Run every day at 3 AM
    // For testing: every 5 minutes - "0 */5 * * * *"
    @Scheduled(cron = "0 0 3 * * *")
    public void aggregateDailyStats() {
        try {
            LocalDate yesterday = LocalDate.now().minusDays(1);
            log.info("Starting daily stats aggregation for: {}", yesterday);
            statsService.aggregateDailyStats(yesterday);
            log.info("Completed daily stats aggregation for: {}", yesterday);
        } catch (Exception e) {
            log.error("Error during daily stats aggregation", e);
        }
    }
}
