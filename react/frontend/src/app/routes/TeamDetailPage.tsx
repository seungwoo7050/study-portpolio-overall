import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTeam, useRemoveTeamMember, useUpdateTeamMemberRole } from '../../features/team/hooks';
import { useTeamRole } from '../../features/team/useTeamRole';
import { Button } from '../../shared/components/Button';
import type { TeamRole } from '../../shared/types/api';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data, isLoading, error } = useTeam(Number(teamId));
  const { canManageMembers, currentMember } = useTeamRole(data?.members);
  const removeMember = useRemoveTeamMember(Number(teamId));
  const updateMemberRole = useUpdateTeamMemberRole(Number(teamId));

  const [activeTab, setActiveTab] = useState<'members' | 'workspace'>('members');

  if (isLoading) {
    return <div className="text-center py-12">Loading team...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">Error loading team: {error.message}</div>
    );
  }

  if (!data) {
    return <div className="text-center py-12">Team not found</div>;
  }

  const { team, members } = data;

  const handleRemoveMember = async (memberId: number) => {
    if (confirm('Are you sure you want to remove this member?')) {
      await removeMember.mutateAsync(memberId);
    }
  };

  const handleChangeRole = async (memberId: number, newRole: TeamRole) => {
    await updateMemberRole.mutateAsync({ memberId, data: { role: newRole } });
  };

  const getRoleBadgeColor = (role: TeamRole) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800';
      case 'MEMBER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link to="/teams" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            ← Back to Teams
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(team.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'workspace'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Workspace
          </button>
        </nav>
      </div>

      {activeTab === 'members' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
              {canManageMembers && (
                <Button variant="primary" size="sm">
                  Add Member
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{member.user.nickname}</p>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getRoleBadgeColor(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canManageMembers && member.id !== currentMember?.id && (
                    <div className="flex items-center gap-2">
                      {member.role !== 'OWNER' && (
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value as TeamRole)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="OWNER">OWNER</option>
                        </select>
                      )}
                      {member.role !== 'OWNER' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workspace' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Workspace Items</h2>
              <Link to={`/teams/${teamId}/workspace`}>
                <Button variant="primary" size="sm">
                  View All Items
                </Button>
              </Link>
            </div>
            <p className="text-gray-600">
              Workspace items are documents and resources shared within the team.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
