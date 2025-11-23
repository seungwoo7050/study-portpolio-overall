import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issueApi } from './api';
import type {
  IssueStatus,
  CreateIssueRequest,
  UpdateIssueRequest,
  CreateCommentRequest,
} from '../../shared/types/api';

export const useProjectIssues = (
  projectId: number,
  status?: IssueStatus,
  page?: number,
  size?: number
) => {
  return useQuery({
    queryKey: ['issues', projectId, status, page, size],
    queryFn: () => issueApi.getProjectIssues(projectId, status, page, size),
    enabled: !!projectId,
  });
};

export const useIssue = (issueId: number) => {
  return useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => issueApi.getIssue(issueId),
    enabled: !!issueId,
  });
};

export const useCreateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: number;
      data: CreateIssueRequest;
    }) => issueApi.createIssue(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['issues', variables.projectId],
      });
    },
  });
};

export const useUpdateIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      issueId,
      data,
    }: {
      issueId: number;
      data: UpdateIssueRequest;
    }) => issueApi.updateIssue(issueId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issue', data.id] });
      queryClient.invalidateQueries({ queryKey: ['issues', data.projectId] });
    },
  });
};

export const useDeleteIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (issueId: number) => issueApi.deleteIssue(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
};

export const useIssueComments = (issueId: number) => {
  return useQuery({
    queryKey: ['comments', issueId],
    queryFn: () => issueApi.getIssueComments(issueId),
    enabled: !!issueId,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      issueId,
      data,
    }: {
      issueId: number;
      data: CreateCommentRequest;
    }) => issueApi.createComment(issueId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.issueId] });
    },
  });
};
