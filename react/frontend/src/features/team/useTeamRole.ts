import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { TeamMemberDto, TeamRole } from '../../shared/types/api';

/**
 * Hook to get the current user's role in a team
 */
export function useTeamRole(members: TeamMemberDto[] | undefined) {
  const { user } = useAuth();

  const currentMember = useMemo(() => {
    if (!user || !members) return null;
    return members.find((member) => member.userId === user.id);
  }, [user, members]);

  const role: TeamRole | null = currentMember?.role || null;

  const canManageMembers = useMemo(() => {
    return role === 'OWNER' || role === 'MANAGER';
  }, [role]);

  const isOwner = useMemo(() => {
    return role === 'OWNER';
  }, [role]);

  return {
    currentMember,
    role,
    canManageMembers,
    isOwner,
  };
}
