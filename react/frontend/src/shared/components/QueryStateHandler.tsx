import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { EmptyState } from './EmptyState';

interface QueryStateHandlerProps<T> {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  loadingMessage?: string;
  children: (data: T) => React.ReactNode;
}

export function QueryStateHandler<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty,
  emptyMessage = 'No data available',
  emptyTitle = 'No Results',
  loadingMessage = 'Loading...',
  children,
}: QueryStateHandlerProps<T>) {
  if (isLoading) {
    return <LoadingSpinner message={loadingMessage} />;
  }

  if (isError) {
    return (
      <ErrorMessage message={error?.message || 'An error occurred while fetching data'} />
    );
  }

  if (!data || (isEmpty && isEmpty(data))) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return <>{children(data)}</>;
}
