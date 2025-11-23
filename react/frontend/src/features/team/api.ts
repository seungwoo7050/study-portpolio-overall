import apiClient from '../../shared/lib/apiClient';
import type {
  TeamDto,
  TeamMemberDto,
  WorkspaceItemDto,
  CreateTeamRequest,
  AddTeamMemberRequest,
  UpdateTeamMemberRequest,
  CreateWorkspaceItemRequest,
  UpdateWorkspaceItemRequest,
  PaginatedResponse,
} from '../../shared/types/api';

export const teamApi = {
  /**
   * Create a new team
   */
  createTeam: async (data: CreateTeamRequest): Promise<TeamDto> => {
    const response = await apiClient.post<TeamDto>('/teams', data);
    return response.data;
  },

  /**
   * Get list of teams the current user is a member of
   */
  getTeams: async (): Promise<PaginatedResponse<TeamDto>> => {
    const response = await apiClient.get<PaginatedResponse<TeamDto>>('/teams');
    return response.data;
  },

  /**
   * Get team detail with members
   */
  getTeam: async (teamId: number): Promise<{ team: TeamDto; members: TeamMemberDto[] }> => {
    const response = await apiClient.get<{ team: TeamDto; members: TeamMemberDto[] }>(
      `/teams/${teamId}`
    );
    return response.data;
  },

  /**
   * Get team members
   */
  getTeamMembers: async (teamId: number): Promise<PaginatedResponse<TeamMemberDto>> => {
    const response = await apiClient.get<PaginatedResponse<TeamMemberDto>>(
      `/teams/${teamId}/members`
    );
    return response.data;
  },

  /**
   * Add a team member
   */
  addTeamMember: async (
    teamId: number,
    data: AddTeamMemberRequest
  ): Promise<TeamMemberDto> => {
    const response = await apiClient.post<TeamMemberDto>(`/teams/${teamId}/members`, data);
    return response.data;
  },

  /**
   * Update team member role
   */
  updateTeamMemberRole: async (
    teamId: number,
    memberId: number,
    data: UpdateTeamMemberRequest
  ): Promise<TeamMemberDto> => {
    const response = await apiClient.patch<TeamMemberDto>(
      `/teams/${teamId}/members/${memberId}`,
      data
    );
    return response.data;
  },

  /**
   * Remove team member
   */
  removeTeamMember: async (teamId: number, memberId: number): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}/members/${memberId}`);
  },

  /**
   * Create workspace item
   */
  createWorkspaceItem: async (
    teamId: number,
    data: CreateWorkspaceItemRequest
  ): Promise<WorkspaceItemDto> => {
    const response = await apiClient.post<WorkspaceItemDto>(`/teams/${teamId}/items`, data);
    return response.data;
  },

  /**
   * Get workspace items for a team
   */
  getWorkspaceItems: async (
    teamId: number,
    page?: number,
    size?: number
  ): Promise<PaginatedResponse<WorkspaceItemDto>> => {
    const response = await apiClient.get<PaginatedResponse<WorkspaceItemDto>>(
      `/teams/${teamId}/items`,
      {
        params: { page, size },
      }
    );
    return response.data;
  },

  /**
   * Get workspace item detail
   */
  getWorkspaceItem: async (itemId: number): Promise<WorkspaceItemDto> => {
    const response = await apiClient.get<WorkspaceItemDto>(`/items/${itemId}`);
    return response.data;
  },

  /**
   * Update workspace item
   */
  updateWorkspaceItem: async (
    itemId: number,
    data: UpdateWorkspaceItemRequest
  ): Promise<WorkspaceItemDto> => {
    const response = await apiClient.put<WorkspaceItemDto>(`/items/${itemId}`, data);
    return response.data;
  },

  /**
   * Delete workspace item
   */
  deleteWorkspaceItem: async (itemId: number): Promise<void> => {
    await apiClient.delete(`/items/${itemId}`);
  },
};
