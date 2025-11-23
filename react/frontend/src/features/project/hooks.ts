import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from './api';
import type { CreateProjectRequest } from '../../shared/types/api';

export const useProjects = (page?: number, size?: number) => {
  return useQuery({
    queryKey: ['projects', page, size],
    queryFn: () => projectApi.getProjects(page, size),
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateProjectRequest) =>
      projectApi.createProject(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useProject = (projectId: number) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getProject(projectId),
    enabled: !!projectId,
  });
};
