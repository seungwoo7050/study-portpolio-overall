package com.example.training.issue.service;

import com.example.training.common.exception.ResourceNotFoundException;
import com.example.training.issue.domain.Issue;
import com.example.training.issue.domain.IssueStatus;
import com.example.training.issue.dto.IssueRequest;
import com.example.training.issue.dto.IssueResponse;
import com.example.training.issue.dto.IssueUpdateRequest;
import com.example.training.issue.repository.IssueRepository;
import com.example.training.issue.repository.ProjectRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class IssueService {

    private final IssueRepository issueRepository;
    private final ProjectRepository projectRepository;

    public IssueService(IssueRepository issueRepository, ProjectRepository projectRepository) {
        this.issueRepository = issueRepository;
        this.projectRepository = projectRepository;
    }

    @Transactional
    public IssueResponse createIssue(Long projectId, Long reporterId, IssueRequest request) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project not found: " + projectId);
        }

        Issue issue = new Issue(projectId, reporterId, request.getTitle(), request.getDescription());
        if (request.getAssigneeId() != null) {
            issue.setAssigneeId(request.getAssigneeId());
        }

        Issue savedIssue = issueRepository.save(issue);
        return IssueResponse.from(savedIssue);
    }

    @Transactional(readOnly = true)
    public Page<IssueResponse> getIssuesByProject(Long projectId, IssueStatus status, Pageable pageable) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project not found: " + projectId);
        }

        Page<Issue> issues;
        if (status != null) {
            issues = issueRepository.findByProjectIdAndStatus(projectId, status, pageable);
        } else {
            issues = issueRepository.findByProjectId(projectId, pageable);
        }

        return issues.map(IssueResponse::from);
    }

    @Transactional
    public IssueResponse getIssueById(Long id) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Issue not found: " + id));
        issue.incrementViewCount();
        issueRepository.save(issue);
        return IssueResponse.from(issue);
    }

    @Transactional
    public IssueResponse updateIssue(Long id, IssueUpdateRequest request) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Issue not found: " + id));

        if (request.getTitle() != null) {
            issue.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            issue.setDescription(request.getDescription());
        }
        if (request.getStatus() != null) {
            issue.setStatus(request.getStatus());
        }
        if (request.getAssigneeId() != null) {
            issue.setAssigneeId(request.getAssigneeId());
        }

        Issue updatedIssue = issueRepository.save(issue);
        return IssueResponse.from(updatedIssue);
    }

    @Transactional
    public void deleteIssue(Long id) {
        if (!issueRepository.existsById(id)) {
            throw new ResourceNotFoundException("Issue not found: " + id);
        }
        issueRepository.deleteById(id);
    }

    @Cacheable(value = "popularIssues", key = "'top10'")
    @Transactional(readOnly = true)
    public List<IssueResponse> getPopularIssues() {
        List<Issue> popularIssues = issueRepository.findPopularIssues(PageRequest.of(0, 10));
        return popularIssues.stream()
                .map(IssueResponse::from)
                .collect(Collectors.toList());
    }
}
