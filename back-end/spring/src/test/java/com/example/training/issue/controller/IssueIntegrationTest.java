package com.example.training.issue.controller;

import com.example.training.common.security.JwtUtil;
import com.example.training.issue.domain.Issue;
import com.example.training.issue.domain.IssueStatus;
import com.example.training.issue.domain.Project;
import com.example.training.issue.domain.User;
import com.example.training.issue.dto.IssueRequest;
import com.example.training.issue.repository.IssueRepository;
import com.example.training.issue.repository.ProjectRepository;
import com.example.training.issue.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class IssueIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private IssueRepository issueRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    private User testUser;
    private Project testProject;
    private String authToken;

    @BeforeEach
    void setUp() {
        // Create test user
        testUser = new User("test@example.com", passwordEncoder.encode("password"), "TestUser");
        testUser = userRepository.save(testUser);

        // Create test project
        testProject = new Project("Test Project", "Test Description");
        testProject = projectRepository.save(testProject);

        // Generate auth token
        authToken = jwtUtil.generateToken(testUser.getId(), testUser.getEmail());
    }

    @Test
    void createAndRetrieveIssue_Success() throws Exception {
        // Create issue
        IssueRequest request = new IssueRequest("Bug in login", "Users cannot login", null);

        String response = mockMvc.perform(post("/api/projects/{projectId}/issues", testProject.getId())
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Bug in login"))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        // Parse response to get issue ID
        Long issueId = objectMapper.readTree(response).get("id").asLong();

        // Retrieve the created issue
        mockMvc.perform(get("/api/issues/{id}", issueId)
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(issueId))
                .andExpect(jsonPath("$.title").value("Bug in login"))
                .andExpect(jsonPath("$.description").value("Users cannot login"))
                .andExpect(jsonPath("$.status").value("OPEN"));

        // Verify it's in the database
        Issue savedIssue = issueRepository.findById(issueId).orElseThrow();
        assertThat(savedIssue.getTitle()).isEqualTo("Bug in login");
        assertThat(savedIssue.getStatus()).isEqualTo(IssueStatus.OPEN);
    }

    @Test
    void getIssuesByProject_WithStatusFilter() throws Exception {
        // Create multiple issues
        Issue issue1 = new Issue(testProject.getId(), testUser.getId(), "Issue 1", "Description 1");
        issue1 = issueRepository.save(issue1);

        Issue issue2 = new Issue(testProject.getId(), testUser.getId(), "Issue 2", "Description 2");
        issue2.setStatus(IssueStatus.IN_PROGRESS);
        issue2 = issueRepository.save(issue2);

        // Get all issues
        mockMvc.perform(get("/api/projects/{projectId}/issues", testProject.getId())
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2));

        // Get only OPEN issues
        mockMvc.perform(get("/api/projects/{projectId}/issues", testProject.getId())
                        .param("status", "OPEN")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].status").value("OPEN"));
    }

    @Test
    void createIssue_Unauthorized() throws Exception {
        IssueRequest request = new IssueRequest("Bug in login", "Users cannot login", null);

        mockMvc.perform(post("/api/projects/{projectId}/issues", testProject.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}
