package com.example.training.team.controller;

import com.example.training.team.dto.*;
import com.example.training.team.service.TeamService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @PostMapping
    public ResponseEntity<TeamResponse> createTeam(
            Authentication authentication,
            @Valid @RequestBody CreateTeamRequest request
    ) {
        Long userId = (Long) authentication.getPrincipal();
        TeamResponse response = teamService.createTeam(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<TeamResponse>> getMyTeams(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        List<TeamResponse> teams = teamService.getMyTeams(userId);
        return ResponseEntity.ok(teams);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TeamResponse> getTeam(
            Authentication authentication,
            @PathVariable Long id
    ) {
        Long userId = (Long) authentication.getPrincipal();
        TeamResponse team = teamService.getTeam(userId, id);
        return ResponseEntity.ok(team);
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<TeamMemberResponse>> getTeamMembers(
            Authentication authentication,
            @PathVariable Long id
    ) {
        Long userId = (Long) authentication.getPrincipal();
        List<TeamMemberResponse> members = teamService.getTeamMembers(userId, id);
        return ResponseEntity.ok(members);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<TeamMemberResponse> addTeamMember(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody AddTeamMemberRequest request
    ) {
        Long userId = (Long) authentication.getPrincipal();
        TeamMemberResponse member = teamService.addTeamMember(userId, id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(member);
    }

    @PatchMapping("/{id}/members/{memberId}")
    public ResponseEntity<TeamMemberResponse> updateTeamMemberRole(
            Authentication authentication,
            @PathVariable Long id,
            @PathVariable Long memberId,
            @Valid @RequestBody UpdateTeamMemberRoleRequest request
    ) {
        Long userId = (Long) authentication.getPrincipal();
        TeamMemberResponse member = teamService.updateTeamMemberRole(userId, id, memberId, request);
        return ResponseEntity.ok(member);
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeTeamMember(
            Authentication authentication,
            @PathVariable Long id,
            @PathVariable Long memberId
    ) {
        Long userId = (Long) authentication.getPrincipal();
        teamService.removeTeamMember(userId, id, memberId);
        return ResponseEntity.noContent().build();
    }
}
