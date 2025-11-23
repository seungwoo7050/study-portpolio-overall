import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/lib/queryClient';
import { CreateIssueForm } from './CreateIssueForm';
import { describe, it, expect, vi } from 'vitest';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('CreateIssueForm', () => {
  it('renders form fields correctly', () => {
    render(<CreateIssueForm projectId={1} />, { wrapper });

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assignee id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create issue/i })).toBeInTheDocument();
  });

  it('shows validation errors when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<CreateIssueForm projectId={1} />, { wrapper });

    const submitButton = screen.getByRole('button', { name: /create issue/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    });
  });

  it('accepts valid input', async () => {
    const user = userEvent.setup();
    render(<CreateIssueForm projectId={1} />, { wrapper });

    const titleInput = screen.getByLabelText(/title/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    await user.type(titleInput, 'Test Issue');
    await user.type(descriptionInput, 'Test Description');

    expect(titleInput).toHaveValue('Test Issue');
    expect(descriptionInput).toHaveValue('Test Description');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<CreateIssueForm projectId={1} onCancel={onCancel} />, { wrapper });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
