import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import {
  useIssue,
  useDeleteIssue,
  useIssueComments,
  useCreateComment,
} from '../../features/issue/hooks';
import { EditIssueForm } from '../../features/issue/EditIssueForm';
import { useForm } from 'react-hook-form';
import type { IssueStatus } from '../../shared/types/api';

const STATUS_COLORS: Record<IssueStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const issueIdNum = Number(issueId);
  const { data: issue, isLoading, error } = useIssue(issueIdNum);
  const { data: commentsData } = useIssueComments(issueIdNum);
  const deleteIssue = useDeleteIssue();
  const createComment = useCreateComment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<{ content: string }>();

  const handleDelete = async () => {
    if (!issue) return;

    if (window.confirm('Are you sure you want to delete this issue?')) {
      try {
        await deleteIssue.mutateAsync(issue.id);
        navigate(`/projects/${issue.projectId}/issues`);
      } catch (error) {
        console.error('Failed to delete issue:', error);
      }
    }
  };

  const onCommentSubmit = async (data: { content: string }) => {
    try {
      await createComment.mutateAsync({
        issueId: issueIdNum,
        data: { content: data.content },
      });
      reset();
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading issue...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="p-6">
        <p className="text-red-600">Failed to load issue. Please try again.</p>
      </div>
    );
  }

  return (
    <main className="space-y-6">
      {/* Header */}
      <header>
        <Link
          to={`/projects/${issue.projectId}/issues`}
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          aria-label="Back to Issues"
        >
          ← Back to Issues
        </Link>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm text-gray-500">#{issue.id}</span>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  STATUS_COLORS[issue.status]
                }`}
                aria-label={`Status: ${issue.status.replace('_', ' ')}`}
              >
                {issue.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{issue.title}</h1>
          </div>
          <nav aria-label="Issue actions" className="flex space-x-2">
            <Button
              variant="secondary"
              onClick={() => setIsEditing(true)}
              aria-label="Edit issue"
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700"
              aria-label="Delete issue"
            >
              Delete
            </Button>
          </nav>
        </div>
      </header>

      {/* Edit Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-issue-title"
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 id="edit-issue-title" className="text-xl font-bold mb-4">Edit Issue</h2>
            <EditIssueForm
              issue={issue}
              onSuccess={() => setIsEditing(false)}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </div>
      )}

      {/* Issue Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
            <p className="text-gray-900 whitespace-pre-wrap">{issue.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Reporter</h3>
              <p className="text-gray-900">User #{issue.reporterId}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Assignee</h3>
              <p className="text-gray-900">
                {issue.assigneeId ? `User #${issue.assigneeId}` : 'Unassigned'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
              <p className="text-gray-900">
                {new Date(issue.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Updated</h3>
              <p className="text-gray-900">
                {new Date(issue.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <section aria-labelledby="comments-heading" className="bg-white rounded-lg shadow p-6">
        <h2 id="comments-heading" className="text-xl font-bold text-gray-900 mb-4">
          Comments ({commentsData?.totalCount || 0})
        </h2>

        {/* Comment List */}
        <ul className="space-y-4 mb-6" aria-label="List of comments">
          {commentsData?.items.map((comment) => (
            <li key={comment.id} className="border-l-4 border-gray-200 pl-4 py-2">
              <article>
                <header className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    User #{comment.authorId}
                  </span>
                  <time className="text-xs text-gray-500" dateTime={comment.createdAt}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </time>
                </header>
                <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
              </article>
            </li>
          ))}

          {commentsData?.items.length === 0 && (
            <li className="text-gray-500 text-sm">
              No comments yet. Be the first to comment!
            </li>
          )}
        </ul>

        {/* Add Comment Form */}
        <form
          onSubmit={handleSubmit(onCommentSubmit)}
          className="border-t pt-4"
          aria-label="Add comment"
        >
          <label htmlFor="comment-content" className="sr-only">
            Comment content
          </label>
          <textarea
            id="comment-content"
            {...register('content', { required: true })}
            rows={3}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            placeholder="Write a comment..."
            aria-required="true"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
