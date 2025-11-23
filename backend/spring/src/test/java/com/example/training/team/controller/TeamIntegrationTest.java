package com.example.training.team.controller;

import com.example.training.common.security.JwtUtil;
import com.example.training.issue.domain.User;
import com.example.training.issue.repository.UserRepository;
import com.example.training.team.domain.Team;
import com.example.training.team.domain.TeamMember;
import com.example.training.team.domain.TeamRole;
import com.example.training.team.dto.AddTeamMemberRequest;
import com.example.training.team.dto.CreateTeamRequest;
import com.example.training.team.repository.TeamMemberRepository;
import com.example.training.team.repository.TeamRepository;
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
class TeamIntegrationTest {

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
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    private User ownerUser;
    private User memberUser;
    private User outsiderUser;
    private String ownerToken;
    private String memberToken;
    private String outsiderToken;

    @BeforeEach
    void setUp() {
        // Create test users
        ownerUser = new User("owner@example.com", passwordEncoder.encode("password"), "Owner");
        ownerUser = userRepository.save(ownerUser);
        ownerToken = jwtUtil.generateToken(ownerUser.getId(), ownerUser.getEmail());

        memberUser = new User("member@example.com", passwordEncoder.encode("password"), "Member");
        memberUser = userRepository.save(memberUser);
        memberToken = jwtUtil.generateToken(memberUser.getId(), memberUser.getEmail());

        outsiderUser = new User("outsider@example.com", passwordEncoder.encode("password"), "Outsider");
        outsiderUser = userRepository.save(outsiderUser);
        outsiderToken = jwtUtil.generateToken(outsiderUser.getId(), outsiderUser.getEmail());
    }

    @Test
    void createTeam_Success() throws Exception {
        CreateTeamRequest request = new CreateTeamRequest("Engineering Team");

        mockMvc.perform(post("/api/teams")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Engineering Team"));
    }

    @Test
    void getTeam_AsOwner_Success() throws Exception {
        // Create team with owner
        Team team = new Team("Test Team");
        team = teamRepository.save(team);
        TeamMember owner = new TeamMember(team.getId(), ownerUser.getId(), TeamRole.OWNER);
        teamMemberRepository.save(owner);

        mockMvc.perform(get("/api/teams/{id}", team.getId())
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test Team"));
    }

    @Test
    void getTeam_AsOutsider_NotFound() throws Exception {
        // Create team with owner
        Team team = new Team("Test Team");
        team = teamRepository.save(team);
        TeamMember owner = new TeamMember(team.getId(), ownerUser.getId(), TeamRole.OWNER);
        teamMemberRepository.save(owner);

        // Outsider tries to access
        mockMvc.perform(get("/api/teams/{id}", team.getId())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void addTeamMember_AsOwner_Success() throws Exception {
        // Create team with owner
        Team team = new Team("Test Team");
        team = teamRepository.save(team);
        TeamMember owner = new TeamMember(team.getId(), ownerUser.getId(), TeamRole.OWNER);
        teamMemberRepository.save(owner);

        AddTeamMemberRequest request = new AddTeamMemberRequest(memberUser.getId(), TeamRole.MEMBER);

        mockMvc.perform(post("/api/teams/{id}/members", team.getId())
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(memberUser.getId()))
                .andExpect(jsonPath("$.role").value("MEMBER"));
    }

    @Test
    void addTeamMember_AsMember_Forbidden() throws Exception {
        // Create team with owner and member
        Team team = new Team("Test Team");
        team = teamRepository.save(team);
        TeamMember owner = new TeamMember(team.getId(), ownerUser.getId(), TeamRole.OWNER);
        teamMemberRepository.save(owner);
        TeamMember member = new TeamMember(team.getId(), memberUser.getId(), TeamRole.MEMBER);
        teamMemberRepository.save(member);

        AddTeamMemberRequest request = new AddTeamMemberRequest(outsiderUser.getId(), TeamRole.MEMBER);

        // Regular member tries to add another member
        mockMvc.perform(post("/api/teams/{id}/members", team.getId())
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    void removeTeamMember_AsOutsider_NotFound() throws Exception {
        // Create team with owner and member
        Team team = new Team("Test Team");
        team = teamRepository.save(team);
        TeamMember owner = new TeamMember(team.getId(), ownerUser.getId(), TeamRole.OWNER);
        teamMemberRepository.save(owner);
        TeamMember member = new TeamMember(team.getId(), memberUser.getId(), TeamRole.MEMBER);
        teamMemberRepository.save(member);

        // Outsider tries to remove member
        mockMvc.perform(delete("/api/teams/{id}/members/{memberId}", team.getId(), member.getId())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void getMyTeams_ReturnsOnlyMyTeams() throws Exception {
        // Create two teams
        Team team1 = new Team("Team 1");
        team1 = teamRepository.save(team1);
        TeamMember owner1 = new TeamMember(team1.getId(), ownerUser.getId(), TeamRole.OWNER);
        teamMemberRepository.save(owner1);

        Team team2 = new Team("Team 2");
        team2 = teamRepository.save(team2);
        TeamMember owner2 = new TeamMember(team2.getId(), memberUser.getId(), TeamRole.OWNER);
        teamMemberRepository.save(owner2);

        // Owner should only see Team 1
        mockMvc.perform(get("/api/teams")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Team 1"));

        // Outsider should see no teams
        mockMvc.perform(get("/api/teams")
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
