import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/lib/queryClient';
import { CreateTeamForm } from './CreateTeamForm';

describe('CreateTeamForm', () => {
  it('renders team name input field', () => {
    const mockOnSuccess = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CreateTeamForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </QueryClientProvider>
    );

    expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
  });

  it('renders cancel button when onCancel is provided', () => {
    const mockOnSuccess = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CreateTeamForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </QueryClientProvider>
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
