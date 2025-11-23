package com.example.training.stats.controller;

import com.example.training.issue.domain.Comment;
import com.example.training.issue.domain.Issue;
import com.example.training.issue.domain.Project;
import com.example.training.issue.domain.User;
import com.example.training.issue.repository.CommentRepository;
import com.example.training.issue.repository.IssueRepository;
import com.example.training.issue.repository.ProjectRepository;
import com.example.training.issue.repository.UserRepository;
import com.example.training.stats.service.StatsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class StatsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StatsService statsService;

    @Autowired
    private IssueRepository issueRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        issueRepository.deleteAll();
        commentRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @WithMockUser
    void getDailyStats_shouldReturnStats_whenDataExists() throws Exception {
        // Given
        User user = new User("test@example.com", "hashedPassword", "Test User");
        userRepository.save(user);

        Project project = new Project("Test Project", "Description");
        projectRepository.save(project);

        LocalDate yesterday = LocalDate.now().minusDays(1);

        // Aggregate stats for yesterday
        statsService.aggregateDailyStats(yesterday);

        // When & Then
        mockMvc.perform(get("/api/stats/daily")
                .param("from", yesterday.toString())
                .param("to", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser
    void getDailyStats_shouldReturnEmptyArray_whenNoDataExists() throws Exception {
        // Given
        LocalDate from = LocalDate.now().minusDays(30);
        LocalDate to = LocalDate.now().minusDays(20);

        // When & Then
        mockMvc.perform(get("/api/stats/daily")
                .param("from", from.toString())
                .param("to", to.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
    }
}
