import apiClient from '../../shared/lib/apiClient';
import type {
  ProjectDto,
  CreateProjectRequest,
  PaginatedResponse,
} from '../../shared/types/api';

export const projectApi = {
  // Get all projects
  getProjects: async (page?: number, size?: number) => {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (size !== undefined) params.append('size', size.toString());

    const { data } = await apiClient.get<PaginatedResponse<ProjectDto>>(
      `/projects?${params.toString()}`
    );
    return data;
  },

  // Create new project
  createProject: async (request: CreateProjectRequest) => {
    const { data } = await apiClient.post<ProjectDto>('/projects', request);
    return data;
  },

  // Get project by ID
  getProject: async (projectId: number) => {
    const { data } = await apiClient.get<ProjectDto>(`/projects/${projectId}`);
    return data;
  },
};
