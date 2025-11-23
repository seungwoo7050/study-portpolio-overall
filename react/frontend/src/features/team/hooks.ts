import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teamApi } from './api';
import type {
  CreateTeamRequest,
  AddTeamMemberRequest,
  UpdateTeamMemberRequest,
  CreateWorkspaceItemRequest,
  UpdateWorkspaceItemRequest,
} from '../../shared/types/api';

export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  list: () => [...teamKeys.lists()] as const,
  details: () => [...teamKeys.all, 'detail'] as const,
  detail: (id: number) => [...teamKeys.details(), id] as const,
  members: (teamId: number) => [...teamKeys.all, teamId, 'members'] as const,
  workspaceItems: (teamId: number) => [...teamKeys.all, teamId, 'workspace-items'] as const,
  workspaceItem: (itemId: number) => ['workspace-items', itemId] as const,
};

/**
 * Hook to get list of teams
 */
export function useTeams() {
  return useQuery({
    queryKey: teamKeys.list(),
    queryFn: () => teamApi.getTeams(),
  });
}

/**
 * Hook to get team detail with members
 */
export function useTeam(teamId: number) {
  return useQuery({
    queryKey: teamKeys.detail(teamId),
    queryFn: () => teamApi.getTeam(teamId),
    enabled: !!teamId,
  });
}

/**
 * Hook to get team members
 */
export function useTeamMembers(teamId: number) {
  return useQuery({
    queryKey: teamKeys.members(teamId),
    queryFn: () => teamApi.getTeamMembers(teamId),
    enabled: !!teamId,
  });
}

/**
 * Hook to create a team
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamRequest) => teamApi.createTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.list() });
    },
  });
}

/**
 * Hook to add a team member
 */
export function useAddTeamMember(teamId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddTeamMemberRequest) => teamApi.addTeamMember(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
    },
  });
}

/**
 * Hook to update team member role
 */
export function useUpdateTeamMemberRole(teamId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: number; data: UpdateTeamMemberRequest }) =>
      teamApi.updateTeamMemberRole(teamId, memberId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
    },
  });
}

/**
 * Hook to remove team member
 */
export function useRemoveTeamMember(teamId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: number) => teamApi.removeTeamMember(teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
    },
  });
}

/**
 * Hook to get workspace items
 */
export function useWorkspaceItems(teamId: number, page?: number, size?: number) {
  return useQuery({
    queryKey: [...teamKeys.workspaceItems(teamId), { page, size }],
    queryFn: () => teamApi.getWorkspaceItems(teamId, page, size),
    enabled: !!teamId,
  });
}

/**
 * Hook to get workspace item detail
 */
export function useWorkspaceItem(itemId: number) {
  return useQuery({
    queryKey: teamKeys.workspaceItem(itemId),
    queryFn: () => teamApi.getWorkspaceItem(itemId),
    enabled: !!itemId,
  });
}

/**
 * Hook to create workspace item
 */
export function useCreateWorkspaceItem(teamId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkspaceItemRequest) => teamApi.createWorkspaceItem(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.workspaceItems(teamId) });
    },
  });
}

/**
 * Hook to update workspace item
 */
export function useUpdateWorkspaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdateWorkspaceItemRequest }) =>
      teamApi.updateWorkspaceItem(itemId, data),
    onSuccess: (_, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.workspaceItem(itemId) });
    },
  });
}

/**
 * Hook to delete workspace item
 */
export function useDeleteWorkspaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: number) => teamApi.deleteWorkspaceItem(itemId),
    onSuccess: () => {
      // Invalidate all workspace items queries since we don't know which team it belongs to
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}
