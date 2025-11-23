package com.example.training.issue.controller;

import com.example.training.issue.dto.CommentRequest;
import com.example.training.issue.dto.CommentResponse;
import com.example.training.issue.service.CommentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/issues")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @PostMapping("/{issueId}/comments")
    public ResponseEntity<CommentResponse> createComment(
            @PathVariable Long issueId,
            @Valid @RequestBody CommentRequest request,
            Authentication authentication
    ) {
        Long authorId = (Long) authentication.getPrincipal();
        CommentResponse response = commentService.createComment(issueId, authorId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{issueId}/comments")
    public ResponseEntity<List<CommentResponse>> getCommentsByIssue(@PathVariable Long issueId) {
        List<CommentResponse> comments = commentService.getCommentsByIssue(issueId);
        return ResponseEntity.ok(comments);
    }
}
