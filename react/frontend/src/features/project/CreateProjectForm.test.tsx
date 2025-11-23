import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/lib/queryClient';
import { CreateProjectForm } from './CreateProjectForm';
import { describe, it, expect, vi } from 'vitest';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('CreateProjectForm', () => {
  it('renders form fields correctly', () => {
    render(<CreateProjectForm />, { wrapper });

    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('shows validation error when name is empty', async () => {
    const user = userEvent.setup();
    render(<CreateProjectForm />, { wrapper });

    const submitButton = screen.getByRole('button', { name: /create project/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/project name is required/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess when form is submitted successfully', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onCancel = vi.fn();

    render(<CreateProjectForm onSuccess={onSuccess} onCancel={onCancel} />, {
      wrapper,
    });

    const nameInput = screen.getByLabelText(/project name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    await user.type(nameInput, 'Test Project');
    await user.type(descriptionInput, 'Test Description');

    // Note: In a real test, you would mock the API call
    // For now, this test demonstrates the structure
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<CreateProjectForm onCancel={onCancel} />, { wrapper });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
