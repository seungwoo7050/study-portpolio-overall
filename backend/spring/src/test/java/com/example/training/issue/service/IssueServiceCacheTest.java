package com.example.training.issue.service;

import com.example.training.issue.domain.Issue;
import com.example.training.issue.dto.IssueResponse;
import com.example.training.issue.repository.IssueRepository;
import com.example.training.issue.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
class IssueServiceCacheTest {

    @Autowired
    private IssueService issueService;

    @MockBean
    private IssueRepository issueRepository;

    @MockBean
    private ProjectRepository projectRepository;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        // Clear cache and reset mocks before each test
        if (cacheManager.getCache("popularIssues") != null) {
            cacheManager.getCache("popularIssues").clear();
        }
        reset(issueRepository);
    }

    @Test
    void getPopularIssues_shouldCacheResults() {
        // Given
        Issue issue1 = new Issue(1L, 1L, "Issue 1", "Description 1");
        Issue issue2 = new Issue(1L, 1L, "Issue 2", "Description 2");
        List<Issue> issues = Arrays.asList(issue1, issue2);

        when(issueRepository.findPopularIssues(any(PageRequest.class))).thenReturn(issues);

        // When - First call
        List<IssueResponse> firstCall = issueService.getPopularIssues();

        // When - Second call
        List<IssueResponse> secondCall = issueService.getPopularIssues();

        // Then
        assertThat(firstCall).hasSize(2);
        assertThat(secondCall).hasSize(2);

        // Verify that repository was called only once due to caching
        verify(issueRepository, times(1)).findPopularIssues(any(PageRequest.class));

        // Verify cache is populated
        assertThat(cacheManager.getCache("popularIssues")).isNotNull();
    }

    @Test
    void getPopularIssues_cacheShouldBeEvictedAfterClear() {
        // Given
        Issue issue1 = new Issue(1L, 1L, "Issue 1", "Description 1");
        List<Issue> issues = Arrays.asList(issue1);

        when(issueRepository.findPopularIssues(any(PageRequest.class))).thenReturn(issues);

        // When - First call
        List<IssueResponse> firstCall = issueService.getPopularIssues();
        assertThat(firstCall).hasSize(1);

        // Verify repository was called once
        verify(issueRepository, times(1)).findPopularIssues(any(PageRequest.class));

        // Clear cache
        cacheManager.getCache("popularIssues").clear();

        // Second call after cache clear
        List<IssueResponse> secondCall = issueService.getPopularIssues();
        assertThat(secondCall).hasSize(1);

        // Then - Repository should be called twice (once before clear, once after clear)
        verify(issueRepository, times(2)).findPopularIssues(any(PageRequest.class));
    }
}
