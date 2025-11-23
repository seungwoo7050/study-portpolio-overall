import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateWorkspaceItem } from './hooks';
import { Button } from '../../shared/components/Button';

const createWorkspaceItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  content: z.string().min(1, 'Content is required'),
});

type CreateWorkspaceItemFormData = z.infer<typeof createWorkspaceItemSchema>;

interface CreateWorkspaceItemFormProps {
  teamId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateWorkspaceItemForm({
  teamId,
  onSuccess,
  onCancel,
}: CreateWorkspaceItemFormProps) {
  const createItem = useCreateWorkspaceItem(teamId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateWorkspaceItemFormData>({
    resolver: zodResolver(createWorkspaceItemSchema),
  });

  const onSubmit = async (data: CreateWorkspaceItemFormData) => {
    try {
      await createItem.mutateAsync(data);
      onSuccess?.();
    } catch {
      setError('root', {
        message: 'Failed to create workspace item. Please try again.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {errors.root.message}
        </div>
      )}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          {...register('title')}
          type="text"
          id="title"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Meeting notes, project plan, etc."
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <textarea
          {...register('content')}
          id="content"
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter the content of your workspace item..."
        />
        {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>}
      </div>
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Item'}
        </Button>
      </div>
    </form>
  );
}
