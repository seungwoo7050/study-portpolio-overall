import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import { useProjects } from '../../features/project/hooks';
import { CreateProjectForm } from '../../features/project/CreateProjectForm';

export function ProjectsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [page] = useState(0);
  const [size] = useState(20);

  const { data, isLoading, error } = useProjects(page, size);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <Button variant="primary" onClick={() => setIsCreating(true)}>
          New Project
        </Button>
      </div>

      {/* Create Project Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>
            <CreateProjectForm
              onSuccess={() => setIsCreating(false)}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="bg-white rounded-lg shadow">
        {isLoading && (
          <div className="p-6">
            <p className="text-gray-600">Loading projects...</p>
          </div>
        )}

        {error && (
          <div className="p-6">
            <p className="text-red-600">Failed to load projects. Please try again.</p>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="p-6">
            <p className="text-gray-600">No projects yet. Create your first project to get started.</p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="divide-y divide-gray-200">
            {data.items.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}/issues`}
                className="block p-6 hover:bg-gray-50 transition"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-gray-600 mb-2">{project.description}</p>
                )}
                <p className="text-sm text-gray-500">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}

        {data && data.totalCount > size && (
          <div className="p-4 border-t border-gray-200 text-center text-sm text-gray-500">
            Showing {data.items.length} of {data.totalCount} projects
          </div>
        )}
      </div>
    </div>
  );
}
