import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import { useProjectIssues } from '../../features/issue/hooks';
import { useProject } from '../../features/project/hooks';
import { CreateIssueForm } from '../../features/issue/CreateIssueForm';
import type { IssueStatus } from '../../shared/types/api';

const STATUS_OPTIONS: { value: IssueStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const STATUS_COLORS: Record<IssueStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export function ProjectIssuesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'ALL'>('ALL');
  const [page] = useState(0);
  const [size] = useState(20);

  const projectIdNum = Number(projectId);
  const { data: project } = useProject(projectIdNum);
  const { data, isLoading, error } = useProjectIssues(
    projectIdNum,
    statusFilter === 'ALL' ? undefined : statusFilter,
    page,
    size
  );

  return (
    <main className="space-y-6">
      {/* Header */}
      <header>
        <Link
          to="/projects"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          aria-label="Back to Projects"
        >
          ← Back to Projects
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {project?.name || 'Project'} - Issues
            </h1>
            {project?.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
          </div>
          <Button
            variant="primary"
            onClick={() => setIsCreating(true)}
            aria-label="Create new issue"
          >
            New Issue
          </Button>
        </div>
      </header>

      {/* Create Issue Modal */}
      {isCreating && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-issue-title"
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 id="create-issue-title" className="text-xl font-bold mb-4">Create New Issue</h2>
            <CreateIssueForm
              projectId={projectIdNum}
              onSuccess={() => setIsCreating(false)}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <section aria-label="Issue filters" className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-2" role="group" aria-label="Filter by status">
          <span className="text-sm font-medium text-gray-700" id="status-filter-label">Status:</span>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              aria-pressed={statusFilter === option.value}
              aria-label={`Filter by ${option.label}`}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                statusFilter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Issues List */}
      <section aria-label="Issues list" className="bg-white rounded-lg shadow">
        {isLoading && (
          <div className="p-6">
            <p className="text-gray-600">Loading issues...</p>
          </div>
        )}

        {error && (
          <div className="p-6">
            <p className="text-red-600">Failed to load issues. Please try again.</p>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="p-6">
            <p className="text-gray-600">
              No issues found. Create your first issue to get started.
            </p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {data.items.map((issue) => (
              <li key={issue.id}>
                <Link
                  to={`/issues/${issue.id}`}
                  className="block p-6 hover:bg-gray-50 transition"
                  aria-label={`View issue: ${issue.title}`}
                >
                  <article className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-500">#{issue.id}</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            STATUS_COLORS[issue.status]
                          }`}
                          aria-label={`Status: ${issue.status.replace('_', ' ')}`}
                        >
                          {issue.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {issue.title}
                      </h3>
                      <p className="text-gray-600 line-clamp-2 mb-2">
                        {issue.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <time dateTime={issue.createdAt}>
                          Created {new Date(issue.createdAt).toLocaleDateString()}
                        </time>
                        <time dateTime={issue.updatedAt}>
                          Updated {new Date(issue.updatedAt).toLocaleDateString()}
                        </time>
                        {issue.assigneeId && (
                          <span>Assignee: User #{issue.assigneeId}</span>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {data && data.totalCount > size && (
          <div className="p-4 border-t border-gray-200 text-center text-sm text-gray-500">
            Showing {data.items.length} of {data.totalCount} issues
          </div>
        )}
      </section>
    </main>
  );
}
