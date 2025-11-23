/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/lib/queryClient';
import { TeamsPage } from './TeamsPage';
import * as teamHooks from '../../features/team/hooks';

vi.mock('../../features/team/hooks');

const mockTeams = {
  items: [
    {
      id: 1,
      name: 'Team Alpha',
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Team Beta',
      createdAt: '2025-01-02T00:00:00Z',
    },
  ],
  totalCount: 2,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('TeamsPage', () => {
  beforeEach(() => {
    vi.mocked(teamHooks.useTeams).mockReturnValue({
      data: mockTeams,
      isLoading: false,
      error: null,
    } as any);
  });

  it('renders page heading', async () => {
    render(<TeamsPage />, { wrapper });

    expect(screen.getByRole('heading', { name: /teams/i })).toBeInTheDocument();
  });

  it('displays all teams', async () => {
    render(<TeamsPage />, { wrapper });

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
  });

  it('shows Create Team button', async () => {
    render(<TeamsPage />, { wrapper });

    expect(screen.getByRole('button', { name: /create.*team/i })).toBeInTheDocument();
  });

  it('opens create team modal when clicking Create Team button', async () => {
    const user = userEvent.setup();
    render(<TeamsPage />, { wrapper });

    const createButton = screen.getByRole('button', { name: /create.*team/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Team')).toBeInTheDocument();
    });
  });

  it('displays loading state', () => {
    vi.mocked(teamHooks.useTeams).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<TeamsPage />, { wrapper });

    expect(screen.getByText(/loading teams/i)).toBeInTheDocument();
  });

  it('displays error state', () => {
    vi.mocked(teamHooks.useTeams).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load teams'),
    } as any);

    render(<TeamsPage />, { wrapper });

    expect(screen.getByText(/error loading teams/i)).toBeInTheDocument();
  });

  it('displays empty state when no teams exist', () => {
    vi.mocked(teamHooks.useTeams).mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
      error: null,
    } as any);

    render(<TeamsPage />, { wrapper });

    expect(screen.getByText(/no teams yet/i)).toBeInTheDocument();
  });

  it('renders team links correctly', () => {
    render(<TeamsPage />, { wrapper });

    const teamLinks = screen.getAllByRole('link');
    expect(teamLinks).toHaveLength(2);
    expect(teamLinks[0]).toHaveAttribute('href', '/teams/1');
    expect(teamLinks[1]).toHaveAttribute('href', '/teams/2');
  });

  it('displays team creation dates', () => {
    render(<TeamsPage />, { wrapper });

    // Check that dates are formatted and displayed
    const dateElements = screen.getAllByText(/created/i);
    expect(dateElements.length).toBeGreaterThan(0);
  });
});
