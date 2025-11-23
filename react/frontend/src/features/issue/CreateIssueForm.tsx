import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../shared/components/Button';
import { useCreateIssue } from './hooks';

const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().min(1, 'Description is required'),
  assigneeId: z.string().optional(),
});

type CreateIssueFormData = z.infer<typeof createIssueSchema>;

interface CreateIssueFormProps {
  projectId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateIssueForm({
  projectId,
  onSuccess,
  onCancel,
}: CreateIssueFormProps) {
  const createIssue = useCreateIssue();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateIssueFormData>({
    resolver: zodResolver(createIssueSchema),
  });

  const onSubmit = async (data: CreateIssueFormData) => {
    try {
      await createIssue.mutateAsync({
        projectId,
        data: {
          title: data.title,
          description: data.description,
          assigneeId: data.assigneeId ? Number(data.assigneeId) : undefined,
        },
      });
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create issue:', error);
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
          placeholder="Enter issue title"
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
          placeholder="Enter issue description"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
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
          placeholder="Enter user ID"
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
          {isSubmitting ? 'Creating...' : 'Create Issue'}
        </Button>
      </div>
    </form>
  );
}
