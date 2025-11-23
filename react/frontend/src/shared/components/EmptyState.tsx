interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({
  title = 'No data',
  message = 'There is no data to display.',
  action,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 text-6xl text-gray-300">📭</div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mb-6 text-gray-600">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
