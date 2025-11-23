package com.example.training.issue.service;

import com.example.training.issue.domain.Project;
import com.example.training.issue.dto.ProjectRequest;
import com.example.training.issue.dto.ProjectResponse;
import com.example.training.issue.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;

    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    @Transactional
    public ProjectResponse createProject(ProjectRequest request) {
        Project project = new Project(request.getName(), request.getDescription());
        Project savedProject = projectRepository.save(project);
        return ProjectResponse.from(savedProject);
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> getAllProjects() {
        return projectRepository.findAll().stream()
                .map(ProjectResponse::from)
                .collect(Collectors.toList());
    }
}
