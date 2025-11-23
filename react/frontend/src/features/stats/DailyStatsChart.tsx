import type { DailyIssueStatsDto } from '../../shared/types/api';

interface DailyStatsChartProps {
  data: DailyIssueStatsDto[];
}

export const DailyStatsChart = ({ data }: DailyStatsChartProps) => {
  if (data.length === 0) {
    return null;
  }

  const maxValue = Math.max(
    ...data.flatMap((item) => [item.createdCount, item.resolvedCount, item.commentCount])
  );

  const getBarHeight = (value: number) => {
    if (maxValue === 0) return '0%';
    return `${(value / maxValue) * 100}%`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="flex items-end gap-4 h-64 p-4 bg-gray-50 rounded-lg">
          {data.map((item) => (
            <div key={item.date} className="flex flex-col items-center flex-1 min-w-[120px]">
              <div className="flex items-end justify-center gap-1 h-48 w-full">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: getBarHeight(item.createdCount) }}
                    title={`Created: ${item.createdCount}`}
                  />
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-full bg-green-500 rounded-t transition-all"
                    style={{ height: getBarHeight(item.resolvedCount) }}
                    title={`Resolved: ${item.resolvedCount}`}
                  />
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-full bg-purple-500 rounded-t transition-all"
                    style={{ height: getBarHeight(item.commentCount) }}
                    title={`Comments: ${item.commentCount}`}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2 text-center">
                {new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span className="text-sm text-gray-700">Created</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-sm text-gray-700">Resolved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded" />
            <span className="text-sm text-gray-700">Comments</span>
          </div>
        </div>
      </div>
    </div>
  );
};
