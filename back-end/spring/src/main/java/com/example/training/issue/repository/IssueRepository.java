package com.example.training.issue.repository;

import com.example.training.issue.domain.Issue;
import com.example.training.issue.domain.IssueStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface IssueRepository extends JpaRepository<Issue, Long> {
    Page<Issue> findByProjectId(Long projectId, Pageable pageable);
    Page<Issue> findByProjectIdAndStatus(Long projectId, IssueStatus status, Pageable pageable);

    // Statistics queries
    int countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT COUNT(i) FROM Issue i WHERE i.status IN ('RESOLVED', 'CLOSED') " +
           "AND i.updatedAt BETWEEN :start AND :end")
    int countResolvedBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT i FROM Issue i ORDER BY (i.viewCount + " +
           "(SELECT COUNT(c) FROM Comment c WHERE c.issueId = i.id)) DESC")
    List<Issue> findPopularIssues(Pageable pageable);
}
