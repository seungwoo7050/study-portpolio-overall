package com.example.training.issue.service;

import com.example.training.common.exception.ResourceNotFoundException;
import com.example.training.issue.domain.Comment;
import com.example.training.issue.dto.CommentRequest;
import com.example.training.issue.dto.CommentResponse;
import com.example.training.issue.repository.CommentRepository;
import com.example.training.issue.repository.IssueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final IssueRepository issueRepository;

    public CommentService(CommentRepository commentRepository, IssueRepository issueRepository) {
        this.commentRepository = commentRepository;
        this.issueRepository = issueRepository;
    }

    @Transactional
    public CommentResponse createComment(Long issueId, Long authorId, CommentRequest request) {
        if (!issueRepository.existsById(issueId)) {
            throw new ResourceNotFoundException("Issue not found: " + issueId);
        }

        Comment comment = new Comment(issueId, authorId, request.getContent());
        Comment savedComment = commentRepository.save(comment);
        return CommentResponse.from(savedComment);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByIssue(Long issueId) {
        if (!issueRepository.existsById(issueId)) {
            throw new ResourceNotFoundException("Issue not found: " + issueId);
        }

        return commentRepository.findByIssueIdOrderByCreatedAtAsc(issueId).stream()
                .map(CommentResponse::from)
                .collect(Collectors.toList());
    }
}
