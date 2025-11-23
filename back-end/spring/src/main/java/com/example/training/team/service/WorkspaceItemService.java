package com.example.training.team.service;

import com.example.training.common.exception.ResourceNotFoundException;
import com.example.training.team.domain.WorkspaceItem;
import com.example.training.team.dto.CreateWorkspaceItemRequest;
import com.example.training.team.dto.UpdateWorkspaceItemRequest;
import com.example.training.team.dto.WorkspaceItemResponse;
import com.example.training.team.repository.TeamMemberRepository;
import com.example.training.team.repository.WorkspaceItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class WorkspaceItemService {

    private final WorkspaceItemRepository workspaceItemRepository;
    private final TeamMemberRepository teamMemberRepository;

    public WorkspaceItemService(WorkspaceItemRepository workspaceItemRepository,
                                TeamMemberRepository teamMemberRepository) {
        this.workspaceItemRepository = workspaceItemRepository;
        this.teamMemberRepository = teamMemberRepository;
    }

    @Transactional
    public WorkspaceItemResponse createItem(Long userId, Long teamId, CreateWorkspaceItemRequest request) {
        assertTeamMember(userId, teamId);

        WorkspaceItem item = new WorkspaceItem(teamId, request.getTitle(), request.getContent(), userId);
        item = workspaceItemRepository.save(item);
        return WorkspaceItemResponse.from(item);
    }

    public List<WorkspaceItemResponse> getTeamItems(Long userId, Long teamId) {
        assertTeamMember(userId, teamId);

        return workspaceItemRepository.findByTeamId(teamId).stream()
                .map(WorkspaceItemResponse::from)
                .collect(Collectors.toList());
    }

    public WorkspaceItemResponse getItem(Long userId, Long itemId) {
        WorkspaceItem item = workspaceItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        assertTeamMember(userId, item.getTeamId());
        return WorkspaceItemResponse.from(item);
    }

    @Transactional
    public WorkspaceItemResponse updateItem(Long userId, Long itemId, UpdateWorkspaceItemRequest request) {
        WorkspaceItem item = workspaceItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        assertTeamMember(userId, item.getTeamId());

        item.setTitle(request.getTitle());
        item.setContent(request.getContent());
        item = workspaceItemRepository.save(item);
        return WorkspaceItemResponse.from(item);
    }

    @Transactional
    public void deleteItem(Long userId, Long itemId) {
        WorkspaceItem item = workspaceItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        assertTeamMember(userId, item.getTeamId());
        workspaceItemRepository.delete(item);
    }

    private void assertTeamMember(Long userId, Long teamId) {
        if (!teamMemberRepository.existsByTeamIdAndUserId(teamId, userId)) {
            throw new ResourceNotFoundException("Item not found");
        }
    }
}
