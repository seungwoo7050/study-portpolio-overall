import { Button } from '../../shared/components/Button';

export function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Welcome to Issue Tracker</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Dashboard</h2>
        <p className="text-gray-600 mb-4">
          This is a training project for learning React patterns including CRUD operations,
          authentication, team management, and more.
        </p>
        <div className="flex gap-4">
          <Button variant="primary">Get Started</Button>
          <Button variant="outline">Learn More</Button>
        </div>
      </div>
    </div>
  );
}
