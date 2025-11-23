import { useState } from 'react';
import { useDailyStats } from '../../features/stats/hooks';
import { DailyStatsChart } from '../../features/stats/DailyStatsChart';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';

export const StatsDashboardPage = () => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [fromDate, setFromDate] = useState(sevenDaysAgo.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);

  const { data, isLoading, isError, error, refetch } = useDailyStats({
    from: fromDate,
    to: toDate,
  });

  const handleRefresh = () => {
    refetch();
  };

  const calculateTotals = () => {
    if (!data?.items) return { created: 0, resolved: 0, comments: 0 };

    return data.items.reduce(
      (acc, item) => ({
        created: acc.created + item.createdCount,
        resolved: acc.resolved + item.resolvedCount,
        comments: acc.comments + item.commentCount,
      }),
      { created: 0, resolved: 0, comments: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Statistics Dashboard</h1>
        <p className="mt-2 text-gray-600">View daily issue statistics and trends</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="toDate" className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={handleRefresh} variant="primary">
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Total Issues Created</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{totals.created}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Total Issues Resolved</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{totals.resolved}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Total Comments</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">{totals.comments}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Trends</h2>
        <QueryStateHandler
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          isEmpty={(d) => d.items.length === 0}
          emptyMessage="No statistics available for the selected date range"
          emptyTitle="No Data"
          loadingMessage="Loading statistics..."
        >
          {(statsData) => <DailyStatsChart data={statsData.items} />}
        </QueryStateHandler>
      </div>
    </div>
  );
};
