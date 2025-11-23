package com.example.training.stats.controller;

import com.example.training.stats.dto.DailyStatsResponse;
import com.example.training.stats.service.StatsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/daily")
    public ResponseEntity<List<DailyStatsResponse>> getDailyStats(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        List<DailyStatsResponse> stats = statsService.getDailyStats(from, to)
            .stream()
            .map(DailyStatsResponse::from)
            .collect(Collectors.toList());
        return ResponseEntity.ok(stats);
    }
}
