import { Button } from '../../shared/components/Button';

export function IssuesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Issues</h1>
        <Button variant="primary">New Issue</Button>
      </div>
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <p className="text-gray-600">No issues found. Create an issue to track your work.</p>
        </div>
      </div>
    </div>
  );
}
