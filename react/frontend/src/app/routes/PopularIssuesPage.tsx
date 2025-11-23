import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePopularIssues } from '../../features/stats/hooks';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export const PopularIssuesPage = () => {
  const [days, setDays] = useState(7);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = usePopularIssues({
    days,
    limit,
  });

  const handleRefresh = () => {
    refetch();
  };

  const lastUpdated = new Date(dataUpdatedAt).toLocaleString();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Popular Issues</h1>
        <p className="mt-2 text-gray-600">
          Most viewed and discussed issues in the last {days} days
        </p>
        {dataUpdatedAt > 0 && (
          <p className="mt-1 text-sm text-gray-500">Last updated: {lastUpdated}</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-1">
              Time Period (days)
            </label>
            <select
              id="days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Issues
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>
          </div>
          <Button onClick={handleRefresh} variant="primary">
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <QueryStateHandler
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="No popular issues found for the selected criteria"
          emptyTitle="No Popular Issues"
          loadingMessage="Loading popular issues..."
        >
          {(popularData) => (
            <div className="divide-y divide-gray-200">
              {popularData.items.map((item, index) => (
                <div key={item.issue.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Link
                          to={`/issues/${item.issue.id}`}
                          className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {item.issue.title}
                        </Link>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            STATUS_COLORS[item.issue.status]
                          }`}
                        >
                          {item.issue.status}
                        </span>
                      </div>
                      <p className="text-gray-600 line-clamp-2 mb-3">{item.issue.description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>👁️</span>
                          <span>{item.viewCount} views</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>💬</span>
                          <span>{item.commentCount} comments</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>⭐</span>
                          <span>Score: {item.score.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>📅</span>
                          <span>
                            {new Date(item.issue.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryStateHandler>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 About Data Freshness</h3>
        <p className="text-sm text-blue-800">
          This page uses React Query's staleTime feature to cache data for 5 minutes. Data will
          automatically refresh after this period, reducing unnecessary server requests while
          keeping information reasonably up-to-date.
        </p>
      </div>
    </div>
  );
};
