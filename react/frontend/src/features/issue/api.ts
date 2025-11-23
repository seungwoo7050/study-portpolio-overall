import apiClient from '../../shared/lib/apiClient';
import type {
  IssueDto,
  IssueStatus,
  CreateIssueRequest,
  UpdateIssueRequest,
  PaginatedResponse,
  CommentDto,
  CreateCommentRequest,
} from '../../shared/types/api';

export const issueApi = {
  // Get issues for a project
  getProjectIssues: async (
    projectId: number,
    status?: IssueStatus,
    page?: number,
    size?: number
  ) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page !== undefined) params.append('page', page.toString());
    if (size !== undefined) params.append('size', size.toString());

    const { data } = await apiClient.get<PaginatedResponse<IssueDto>>(
      `/projects/${projectId}/issues?${params.toString()}`
    );
    return data;
  },

  // Create new issue
  createIssue: async (projectId: number, request: CreateIssueRequest) => {
    const { data } = await apiClient.post<IssueDto>(
      `/projects/${projectId}/issues`,
      request
    );
    return data;
  },

  // Get issue by ID
  getIssue: async (issueId: number) => {
    const { data } = await apiClient.get<IssueDto>(`/issues/${issueId}`);
    return data;
  },

  // Update issue
  updateIssue: async (issueId: number, request: UpdateIssueRequest) => {
    const { data } = await apiClient.put<IssueDto>(
      `/issues/${issueId}`,
      request
    );
    return data;
  },

  // Delete issue
  deleteIssue: async (issueId: number) => {
    await apiClient.delete(`/issues/${issueId}`);
  },

  // Get comments for an issue
  getIssueComments: async (issueId: number) => {
    const { data } = await apiClient.get<PaginatedResponse<CommentDto>>(
      `/issues/${issueId}/comments`
    );
    return data;
  },

  // Create comment
  createComment: async (issueId: number, request: CreateCommentRequest) => {
    const { data } = await apiClient.post<CommentDto>(
      `/issues/${issueId}/comments`,
      request
    );
    return data;
  },
};
