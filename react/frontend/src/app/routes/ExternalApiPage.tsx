import { useExternalData } from '../../features/stats/hooks';
import { QueryStateHandler } from '../../shared/components/QueryStateHandler';
import { Button } from '../../shared/components/Button';

export const ExternalApiPage = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useExternalData();

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">External API Data</h1>
        <p className="mt-2 text-gray-600">
          Data fetched from external API with automatic retry on failure
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">API Status</h2>
            <p className="text-sm text-gray-600 mt-1">
              {isFetching ? 'Fetching data...' : 'Data loaded successfully'}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="primary" disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <QueryStateHandler
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          loadingMessage="Fetching external data..."
        >
          {(externalData) => (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Response</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">Source</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {externalData.source}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-1">Label</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {externalData.data.label}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-600 mb-1">Value</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {externalData.data.value}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Raw JSON</h3>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
                  <code>{JSON.stringify(externalData, null, 2)}</code>
                </pre>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-semibold text-green-900 mb-2">
                  ✓ Retry Strategy Enabled
                </h4>
                <p className="text-sm text-green-800">
                  This API request is configured with automatic retry logic. If the request fails,
                  it will retry up to 3 times with exponential backoff (1s, 2s, 4s). This ensures
                  resilience against temporary network issues or API unavailability.
                </p>
              </div>
            </div>
          )}
        </QueryStateHandler>
      </div>

      {isError && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-semibold text-red-900 mb-2">Error Details</h4>
          <p className="text-sm text-red-800">
            The external API request failed after multiple retry attempts. This could be due to:
          </p>
          <ul className="mt-2 ml-5 text-sm text-red-800 list-disc">
            <li>Network connectivity issues</li>
            <li>External API server downtime</li>
            <li>Request timeout</li>
            <li>Authentication or authorization errors</li>
          </ul>
          <p className="mt-3 text-sm text-red-800">
            Try refreshing the page or check back later.
          </p>
        </div>
      )}
    </div>
  );
};
