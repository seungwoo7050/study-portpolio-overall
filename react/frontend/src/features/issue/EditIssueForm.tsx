import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../shared/components/Button';
import { useUpdateIssue } from './hooks';
import type { IssueDto, IssueStatus } from '../../shared/types/api';

const editIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().min(1, 'Description is required'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  assigneeId: z.string().optional(),
});

type EditIssueFormData = z.infer<typeof editIssueSchema>;

interface EditIssueFormProps {
  issue: IssueDto;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditIssueForm({ issue, onSuccess, onCancel }: EditIssueFormProps) {
  const updateIssue = useUpdateIssue();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditIssueFormData>({
    resolver: zodResolver(editIssueSchema),
    defaultValues: {
      title: issue.title,
      description: issue.description,
      status: issue.status,
      assigneeId: issue.assigneeId?.toString() || '',
    },
  });

  const onSubmit = async (data: EditIssueFormData) => {
    try {
      await updateIssue.mutateAsync({
        issueId: issue.id,
        data: {
          title: data.title,
          description: data.description,
          status: data.status as IssueStatus,
          assigneeId: data.assigneeId ? Number(data.assigneeId) : null,
        },
      });
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update issue:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title *
        </label>
        <input
          id="title"
          type="text"
          {...register('title')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description *
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={6}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status *
        </label>
        <select
          id="status"
          {...register('status')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
        >
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        {errors.status && (
          <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="assigneeId"
          className="block text-sm font-medium text-gray-700"
        >
          Assignee ID (Optional)
        </label>
        <input
          id="assigneeId"
          type="number"
          {...register('assigneeId')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
        />
        {errors.assigneeId && (
          <p className="mt-1 text-sm text-red-600">{errors.assigneeId.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
