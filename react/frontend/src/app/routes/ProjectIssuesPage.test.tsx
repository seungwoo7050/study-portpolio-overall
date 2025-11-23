/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/lib/queryClient';
import { ProjectIssuesPage } from './ProjectIssuesPage';
import * as issueHooks from '../../features/issue/hooks';
import * as projectHooks from '../../features/project/hooks';

vi.mock('../../features/issue/hooks');
vi.mock('../../features/project/hooks');

const mockProject = {
  id: 1,
  name: 'Test Project',
  description: 'Test Description',
  createdAt: '2025-01-01T00:00:00Z',
};

const mockIssues = {
  items: [
    {
      id: 1,
      projectId: 1,
      reporterId: 1,
      assigneeId: 2,
      title: 'Test Issue 1',
      description: 'Description 1',
      status: 'OPEN' as const,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 2,
      projectId: 1,
      reporterId: 1,
      assigneeId: null,
      title: 'Test Issue 2',
      description: 'Description 2',
      status: 'IN_PROGRESS' as const,
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    },
  ],
  totalCount: 2,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/projects/:projectId/issues" element={children} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('ProjectIssuesPage', () => {
  beforeEach(() => {
    vi.mocked(projectHooks.useProject).mockReturnValue({
      data: mockProject,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(issueHooks.useProjectIssues).mockReturnValue({
      data: mockIssues,
      isLoading: false,
      error: null,
    } as any);
  });

  it('renders project name and issues', async () => {
    window.history.pushState({}, '', '/projects/1/issues');

    render(<ProjectIssuesPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Test Project - Issues/i)).toBeInTheDocument();
      expect(screen.getByText('Test Issue 1')).toBeInTheDocument();
      expect(screen.getByText('Test Issue 2')).toBeInTheDocument();
    });
  });

  it('displays status filters', async () => {
    window.history.pushState({}, '', '/projects/1/issues');

    render(<ProjectIssuesPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /in progress/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resolved/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /closed/i })).toBeInTheDocument();
    });
  });

  it('opens create issue modal when clicking New Issue button', async () => {
    window.history.pushState({}, '', '/projects/1/issues');

    const user = userEvent.setup();
    render(<ProjectIssuesPage />, { wrapper });

    const newIssueButton = await screen.findByRole('button', { name: /new issue/i });
    await user.click(newIssueButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Issue')).toBeInTheDocument();
    });
  });

  it('displays loading state', () => {
    vi.mocked(issueHooks.useProjectIssues).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    window.history.pushState({}, '', '/projects/1/issues');

    render(<ProjectIssuesPage />, { wrapper });

    expect(screen.getByText(/loading issues/i)).toBeInTheDocument();
  });

  it('displays error state', () => {
    vi.mocked(issueHooks.useProjectIssues).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    window.history.pushState({}, '', '/projects/1/issues');

    render(<ProjectIssuesPage />, { wrapper });

    expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
  });

  it('displays empty state when no issues', () => {
    vi.mocked(issueHooks.useProjectIssues).mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
      error: null,
    } as any);

    window.history.pushState({}, '', '/projects/1/issues');

    render(<ProjectIssuesPage />, { wrapper });

    expect(screen.getByText(/no issues found/i)).toBeInTheDocument();
  });

  it('shows issue status badges with correct colors', async () => {
    window.history.pushState({}, '', '/projects/1/issues');

    render(<ProjectIssuesPage />, { wrapper });

    await waitFor(() => {
      const openBadge = screen.getAllByText(/open/i).find(el =>
        el.className.includes('bg-blue-100')
      );
      const inProgressBadge = screen.getAllByText(/in progress/i).find(el =>
        el.className.includes('bg-yellow-100')
      );

      expect(openBadge).toBeInTheDocument();
      expect(inProgressBadge).toBeInTheDocument();
    });
  });
});
