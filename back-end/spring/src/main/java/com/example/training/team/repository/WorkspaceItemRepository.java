package com.example.training.team.repository;

import com.example.training.team.domain.WorkspaceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkspaceItemRepository extends JpaRepository<WorkspaceItem, Long> {
    List<WorkspaceItem> findByTeamId(Long teamId);
}
