package com.example.training.team.service;

import com.example.training.common.exception.ForbiddenException;
import com.example.training.common.exception.ResourceNotFoundException;
import com.example.training.issue.domain.User;
import com.example.training.issue.repository.UserRepository;
import com.example.training.team.domain.Team;
import com.example.training.team.domain.TeamMember;
import com.example.training.team.domain.TeamRole;
import com.example.training.team.dto.*;
import com.example.training.team.repository.TeamMemberRepository;
import com.example.training.team.repository.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;

    public TeamService(TeamRepository teamRepository,
                       TeamMemberRepository teamMemberRepository,
                       UserRepository userRepository) {
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public TeamResponse createTeam(Long userId, CreateTeamRequest request) {
        // Verify user exists
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }

        Team team = new Team(request.getName());
        team = teamRepository.save(team);

        // Creator becomes OWNER
        TeamMember ownerMember = new TeamMember(team.getId(), userId, TeamRole.OWNER);
        teamMemberRepository.save(ownerMember);

        return TeamResponse.from(team);
    }

    public List<TeamResponse> getMyTeams(Long userId) {
        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);
        List<Long> teamIds = memberships.stream()
                .map(TeamMember::getTeamId)
                .collect(Collectors.toList());

        return teamRepository.findAllById(teamIds).stream()
                .map(TeamResponse::from)
                .collect(Collectors.toList());
    }

    public TeamResponse getTeam(Long userId, Long teamId) {
        assertTeamMember(userId, teamId);
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
        return TeamResponse.from(team);
    }

    public List<TeamMemberResponse> getTeamMembers(Long userId, Long teamId) {
        assertTeamMember(userId, teamId);
        return teamMemberRepository.findByTeamId(teamId).stream()
                .map(TeamMemberResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public TeamMemberResponse addTeamMember(Long userId, Long teamId, AddTeamMemberRequest request) {
        assertCanManageMembers(userId, teamId);

        // Verify target user exists
        if (!userRepository.existsById(request.getUserId())) {
            throw new ResourceNotFoundException("User not found");
        }

        // Check if already a member
        if (teamMemberRepository.existsByTeamIdAndUserId(teamId, request.getUserId())) {
            throw new IllegalArgumentException("User is already a team member");
        }

        TeamMember member = new TeamMember(teamId, request.getUserId(), request.getRole());
        member = teamMemberRepository.save(member);
        return TeamMemberResponse.from(member);
    }

    @Transactional
    public TeamMemberResponse updateTeamMemberRole(Long userId, Long teamId, Long memberId,
                                                     UpdateTeamMemberRoleRequest request) {
        assertCanManageMembers(userId, teamId);

        TeamMember member = teamMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("Team member not found"));

        if (!member.getTeamId().equals(teamId)) {
            throw new ResourceNotFoundException("Team member not found in this team");
        }

        // Prevent removing the last owner
        if (member.getRole() == TeamRole.OWNER && request.getRole() != TeamRole.OWNER) {
            int ownerCount = teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.OWNER);
            if (ownerCount <= 1) {
                throw new IllegalArgumentException("Cannot remove the last owner");
            }
        }

        member.setRole(request.getRole());
        member = teamMemberRepository.save(member);
        return TeamMemberResponse.from(member);
    }

    @Transactional
    public void removeTeamMember(Long userId, Long teamId, Long memberId) {
        assertCanManageMembers(userId, teamId);

        TeamMember member = teamMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("Team member not found"));

        if (!member.getTeamId().equals(teamId)) {
            throw new ResourceNotFoundException("Team member not found in this team");
        }

        // Prevent removing the last owner
        if (member.getRole() == TeamRole.OWNER) {
            int ownerCount = teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.OWNER);
            if (ownerCount <= 1) {
                throw new IllegalArgumentException("Cannot remove the last owner");
            }
        }

        teamMemberRepository.delete(member);
    }

    // Permission check helpers
    private void assertTeamMember(Long userId, Long teamId) {
        if (!teamMemberRepository.existsByTeamIdAndUserId(teamId, userId)) {
            throw new ResourceNotFoundException("Team not found");
        }
    }

    private void assertCanManageMembers(Long userId, Long teamId) {
        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.MANAGER) {
            throw new ForbiddenException("Only OWNER or MANAGER can manage team members");
        }
    }
}
