import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTeam, useWorkspaceItems } from '../../features/team/hooks';
import { CreateWorkspaceItemForm } from '../../features/team/CreateWorkspaceItemForm';
import { Button } from '../../shared/components/Button';

export function TeamWorkspacePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: teamData } = useTeam(Number(teamId));
  const { data: itemsData, isLoading, error } = useWorkspaceItems(Number(teamId));
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (isLoading) {
    return <div className="text-center py-12">Loading workspace items...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        Error loading workspace items: {error.message}
      </div>
    );
  }

  const items = itemsData?.items || [];
  const team = teamData?.team;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link
            to={`/teams/${teamId}`}
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
          >
            ← Back to Team
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {team?.name} - Workspace
          </h1>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Create Item
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 text-center">
            <p className="text-gray-600">
              No workspace items yet. Create one to start collaborating with your team.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 mb-4 whitespace-pre-wrap">{item.content}</p>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Created {new Date(item.createdAt).toLocaleDateString()}</span>
                {item.updatedAt !== item.createdAt && (
                  <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Workspace Item</h2>
            <CreateWorkspaceItemForm
              teamId={Number(teamId)}
              onSuccess={() => setShowCreateModal(false)}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
