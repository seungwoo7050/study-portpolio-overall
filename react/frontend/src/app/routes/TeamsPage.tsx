import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeams } from '../../features/team/hooks';
import { CreateTeamForm } from '../../features/team/CreateTeamForm';
import { Button } from '../../shared/components/Button';

export function TeamsPage() {
  const { data, isLoading, error } = useTeams();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (isLoading) {
    return <div className="text-center py-12">Loading teams...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        Error loading teams: {error.message}
      </div>
    );
  }

  const teams = data?.items || [];

  return (
    <main className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          aria-label="Create new team"
        >
          Create Team
        </Button>
      </header>

      {teams.length === 0 ? (
        <section className="bg-white rounded-lg shadow" aria-label="Empty teams state">
          <div className="p-6 text-center">
            <p className="text-gray-600">No teams yet. Create a team to collaborate with others.</p>
          </div>
        </section>
      ) : (
        <section aria-label="Teams list">
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  to={`/teams/${team.id}`}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
                  aria-label={`View team: ${team.name}`}
                >
                  <article>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{team.name}</h3>
                    <p className="text-sm text-gray-500">
                      <time dateTime={team.createdAt}>
                        Created {new Date(team.createdAt).toLocaleDateString()}
                      </time>
                    </p>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-team-title"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 id="create-team-title" className="text-2xl font-bold text-gray-900 mb-4">Create New Team</h2>
            <CreateTeamForm
              onSuccess={() => setShowCreateModal(false)}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
