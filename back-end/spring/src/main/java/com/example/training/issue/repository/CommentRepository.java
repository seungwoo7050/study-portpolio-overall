package com.example.training.issue.repository;

import com.example.training.issue.domain.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByIssueIdOrderByCreatedAtAsc(Long issueId);

    // Statistics queries
    int countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
}
