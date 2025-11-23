package com.example.training.issue.service;

import com.example.training.common.exception.ResourceNotFoundException;
import com.example.training.issue.domain.Issue;
import com.example.training.issue.domain.IssueStatus;
import com.example.training.issue.dto.IssueRequest;
import com.example.training.issue.dto.IssueResponse;
import com.example.training.issue.dto.IssueUpdateRequest;
import com.example.training.issue.repository.IssueRepository;
import com.example.training.issue.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IssueServiceTest {

    @Mock
    private IssueRepository issueRepository;

    @Mock
    private ProjectRepository projectRepository;

    @InjectMocks
    private IssueService issueService;

    private Issue testIssue;

    @BeforeEach
    void setUp() {
        testIssue = new Issue(1L, 1L, "Test Issue", "Description");
    }

    @Test
    void createIssue_Success() {
        // Given
        Long projectId = 1L;
        Long reporterId = 1L;
        IssueRequest request = new IssueRequest("New Issue", "Description", null);

        when(projectRepository.existsById(projectId)).thenReturn(true);
        when(issueRepository.save(any(Issue.class))).thenReturn(testIssue);

        // When
        IssueResponse response = issueService.createIssue(projectId, reporterId, request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("Test Issue");
        verify(projectRepository).existsById(projectId);
        verify(issueRepository).save(any(Issue.class));
    }

    @Test
    void createIssue_ProjectNotFound() {
        // Given
        Long projectId = 999L;
        Long reporterId = 1L;
        IssueRequest request = new IssueRequest("New Issue", "Description", null);

        when(projectRepository.existsById(projectId)).thenReturn(false);

        // When & Then
        assertThatThrownBy(() -> issueService.createIssue(projectId, reporterId, request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Project not found");

        verify(projectRepository).existsById(projectId);
        verify(issueRepository, never()).save(any(Issue.class));
    }

    @Test
    void updateIssue_ChangeStatus() {
        // Given
        Long issueId = 1L;
        IssueUpdateRequest request = new IssueUpdateRequest(null, null, IssueStatus.IN_PROGRESS, null);

        when(issueRepository.findById(issueId)).thenReturn(Optional.of(testIssue));
        when(issueRepository.save(any(Issue.class))).thenReturn(testIssue);

        // When
        IssueResponse response = issueService.updateIssue(issueId, request);

        // Then
        assertThat(response).isNotNull();
        verify(issueRepository).findById(issueId);
        verify(issueRepository).save(any(Issue.class));
    }

    @Test
    void getIssueById_NotFound() {
        // Given
        Long issueId = 999L;
        when(issueRepository.findById(issueId)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> issueService.getIssueById(issueId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Issue not found");
    }

    @Test
    void deleteIssue_Success() {
        // Given
        Long issueId = 1L;
        when(issueRepository.existsById(issueId)).thenReturn(true);

        // When
        issueService.deleteIssue(issueId);

        // Then
        verify(issueRepository).existsById(issueId);
        verify(issueRepository).deleteById(issueId);
    }
}
