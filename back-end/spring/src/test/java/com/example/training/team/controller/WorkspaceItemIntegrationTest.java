package com.example.training.team.controller;

import com.example.training.common.security.JwtUtil;
import com.example.training.issue.domain.User;
import com.example.training.issue.repository.UserRepository;
import com.example.training.team.domain.Team;
import com.example.training.team.domain.TeamMember;
import com.example.training.team.domain.TeamRole;
import com.example.training.team.domain.WorkspaceItem;
import com.example.training.team.dto.CreateWorkspaceItemRequest;
import com.example.training.team.dto.UpdateWorkspaceItemRequest;
import com.example.training.team.repository.TeamMemberRepository;
import com.example.training.team.repository.TeamRepository;
import com.example.training.team.repository.WorkspaceItemRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class WorkspaceItemIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private WorkspaceItemRepository workspaceItemRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    private User teamMemberUser;
    private User outsiderUser;
    private String memberToken;
    private String outsiderToken;
    private Team testTeam;

    @BeforeEach
    void setUp() {
        // Create test users
        teamMemberUser = new User("member@example.com", passwordEncoder.encode("password"), "Member");
        teamMemberUser = userRepository.save(teamMemberUser);
        memberToken = jwtUtil.generateToken(teamMemberUser.getId(), teamMemberUser.getEmail());

        outsiderUser = new User("outsider@example.com", passwordEncoder.encode("password"), "Outsider");
        outsiderUser = userRepository.save(outsiderUser);
        outsiderToken = jwtUtil.generateToken(outsiderUser.getId(), outsiderUser.getEmail());

        // Create test team
        testTeam = new Team("Test Team");
        testTeam = teamRepository.save(testTeam);
        TeamMember member = new TeamMember(testTeam.getId(), teamMemberUser.getId(), TeamRole.MEMBER);
        teamMemberRepository.save(member);
    }

    @Test
    void createItem_AsTeamMember_Success() throws Exception {
        CreateWorkspaceItemRequest request = new CreateWorkspaceItemRequest(
                "Project Proposal", "Details about the proposal"
        );

        mockMvc.perform(post("/api/teams/{teamId}/items", testTeam.getId())
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Project Proposal"))
                .andExpect(jsonPath("$.teamId").value(testTeam.getId()))
                .andExpect(jsonPath("$.createdBy").value(teamMemberUser.getId()));
    }

    @Test
    void createItem_AsOutsider_NotFound() throws Exception {
        CreateWorkspaceItemRequest request = new CreateWorkspaceItemRequest(
                "Unauthorized Item", "This should fail"
        );

        mockMvc.perform(post("/api/teams/{teamId}/items", testTeam.getId())
                        .header("Authorization", "Bearer " + outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getItem_AsTeamMember_Success() throws Exception {
        // Create an item
        WorkspaceItem item = new WorkspaceItem(
                testTeam.getId(), "Meeting Notes", "Discussion points", teamMemberUser.getId()
        );
        item = workspaceItemRepository.save(item);

        mockMvc.perform(get("/api/items/{id}", item.getId())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Meeting Notes"));
    }

    @Test
    void getItem_AsOutsider_NotFound() throws Exception {
        // Create an item
        WorkspaceItem item = new WorkspaceItem(
                testTeam.getId(), "Secret Document", "Confidential", teamMemberUser.getId()
        );
        item = workspaceItemRepository.save(item);

        // Outsider tries to access
        mockMvc.perform(get("/api/items/{id}", item.getId())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateItem_AsTeamMember_Success() throws Exception {
        // Create an item
        WorkspaceItem item = new WorkspaceItem(
                testTeam.getId(), "Draft", "Initial content", teamMemberUser.getId()
        );
        item = workspaceItemRepository.save(item);

        UpdateWorkspaceItemRequest request = new UpdateWorkspaceItemRequest(
                "Final Version", "Updated content"
        );

        mockMvc.perform(put("/api/items/{id}", item.getId())
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Final Version"))
                .andExpect(jsonPath("$.content").value("Updated content"));
    }

    @Test
    void deleteItem_AsTeamMember_Success() throws Exception {
        // Create an item
        WorkspaceItem item = new WorkspaceItem(
                testTeam.getId(), "Temporary", "To be deleted", teamMemberUser.getId()
        );
        item = workspaceItemRepository.save(item);

        mockMvc.perform(delete("/api/items/{id}", item.getId())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteItem_AsOutsider_NotFound() throws Exception {
        // Create an item
        WorkspaceItem item = new WorkspaceItem(
                testTeam.getId(), "Protected", "Cannot delete", teamMemberUser.getId()
        );
        item = workspaceItemRepository.save(item);

        // Outsider tries to delete
        mockMvc.perform(delete("/api/items/{id}", item.getId())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void getTeamItems_AsTeamMember_Success() throws Exception {
        // Create multiple items
        WorkspaceItem item1 = new WorkspaceItem(
                testTeam.getId(), "Item 1", "Content 1", teamMemberUser.getId()
        );
        workspaceItemRepository.save(item1);

        WorkspaceItem item2 = new WorkspaceItem(
                testTeam.getId(), "Item 2", "Content 2", teamMemberUser.getId()
        );
        workspaceItemRepository.save(item2);

        mockMvc.perform(get("/api/teams/{teamId}/items", testTeam.getId())
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void getTeamItems_AsOutsider_NotFound() throws Exception {
        // Create an item
        WorkspaceItem item = new WorkspaceItem(
                testTeam.getId(), "Secret", "Hidden", teamMemberUser.getId()
        );
        workspaceItemRepository.save(item);

        // Outsider tries to list items
        mockMvc.perform(get("/api/teams/{teamId}/items", testTeam.getId())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isNotFound());
    }
}
