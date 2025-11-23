package com.example.training.team.controller;

import com.example.training.team.dto.CreateWorkspaceItemRequest;
import com.example.training.team.dto.UpdateWorkspaceItemRequest;
import com.example.training.team.dto.WorkspaceItemResponse;
import com.example.training.team.service.WorkspaceItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class WorkspaceItemController {

    private final WorkspaceItemService workspaceItemService;

    public WorkspaceItemController(WorkspaceItemService workspaceItemService) {
        this.workspaceItemService = workspaceItemService;
    }

    @PostMapping("/api/teams/{teamId}/items")
    public ResponseEntity<WorkspaceItemResponse> createItem(
            Authentication authentication,
            @PathVariable Long teamId,
            @Valid @RequestBody CreateWorkspaceItemRequest request
    ) {
        Long userId = (Long) authentication.getPrincipal();
        WorkspaceItemResponse response = workspaceItemService.createItem(userId, teamId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/teams/{teamId}/items")
    public ResponseEntity<List<WorkspaceItemResponse>> getTeamItems(
            Authentication authentication,
            @PathVariable Long teamId
    ) {
        Long userId = (Long) authentication.getPrincipal();
        List<WorkspaceItemResponse> items = workspaceItemService.getTeamItems(userId, teamId);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/api/items/{id}")
    public ResponseEntity<WorkspaceItemResponse> getItem(
            Authentication authentication,
            @PathVariable Long id
    ) {
        Long userId = (Long) authentication.getPrincipal();
        WorkspaceItemResponse item = workspaceItemService.getItem(userId, id);
        return ResponseEntity.ok(item);
    }

    @PutMapping("/api/items/{id}")
    public ResponseEntity<WorkspaceItemResponse> updateItem(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody UpdateWorkspaceItemRequest request
    ) {
        Long userId = (Long) authentication.getPrincipal();
        WorkspaceItemResponse item = workspaceItemService.updateItem(userId, id, request);
        return ResponseEntity.ok(item);
    }

    @DeleteMapping("/api/items/{id}")
    public ResponseEntity<Void> deleteItem(
            Authentication authentication,
            @PathVariable Long id
    ) {
        Long userId = (Long) authentication.getPrincipal();
        workspaceItemService.deleteItem(userId, id);
        return ResponseEntity.noContent().build();
    }
}
