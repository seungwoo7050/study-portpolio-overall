package com.example.training.issue.controller;

import com.example.training.issue.domain.IssueStatus;
import com.example.training.issue.dto.IssueRequest;
import com.example.training.issue.dto.IssueResponse;
import com.example.training.issue.dto.IssueUpdateRequest;
import com.example.training.issue.service.IssueService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class IssueController {

    private final IssueService issueService;

    public IssueController(IssueService issueService) {
        this.issueService = issueService;
    }

    @PostMapping("/projects/{projectId}/issues")
    public ResponseEntity<IssueResponse> createIssue(
            @PathVariable Long projectId,
            @Valid @RequestBody IssueRequest request,
            Authentication authentication
    ) {
        Long reporterId = (Long) authentication.getPrincipal();
        IssueResponse response = issueService.createIssue(projectId, reporterId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/projects/{projectId}/issues")
    public ResponseEntity<Page<IssueResponse>> getIssuesByProject(
            @PathVariable Long projectId,
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<IssueResponse> issues = issueService.getIssuesByProject(projectId, status, pageable);
        return ResponseEntity.ok(issues);
    }

    @GetMapping("/issues/{id}")
    public ResponseEntity<IssueResponse> getIssueById(@PathVariable Long id) {
        IssueResponse issue = issueService.getIssueById(id);
        return ResponseEntity.ok(issue);
    }

    @PutMapping("/issues/{id}")
    public ResponseEntity<IssueResponse> updateIssue(
            @PathVariable Long id,
            @Valid @RequestBody IssueUpdateRequest request
    ) {
        IssueResponse response = issueService.updateIssue(id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/issues/{id}")
    public ResponseEntity<Void> deleteIssue(@PathVariable Long id) {
        issueService.deleteIssue(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/issues/popular")
    public ResponseEntity<List<IssueResponse>> getPopularIssues() {
        List<IssueResponse> popularIssues = issueService.getPopularIssues();
        return ResponseEntity.ok(popularIssues);
    }
}
