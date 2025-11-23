/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/lib/queryClient';
import { IssueDetailPage } from './IssueDetailPage';
import * as issueHooks from '../../features/issue/hooks';

vi.mock('../../features/issue/hooks');

const mockIssue = {
  id: 1,
  projectId: 1,
  reporterId: 1,
  assigneeId: 2,
  title: 'Test Issue',
  description: 'Test Description',
  status: 'OPEN' as const,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockComments = {
  items: [
    {
      id: 1,
      issueId: 1,
      authorId: 1,
      content: 'First comment',
      createdAt: '2025-01-01T01:00:00Z',
      updatedAt: '2025-01-01T01:00:00Z',
    },
    {
      id: 2,
      issueId: 1,
      authorId: 2,
      content: 'Second comment',
      createdAt: '2025-01-01T02:00:00Z',
      updatedAt: '2025-01-01T02:00:00Z',
    },
  ],
  totalCount: 2,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/issues/:issueId" element={children} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('IssueDetailPage', () => {
  beforeEach(() => {
    vi.mocked(issueHooks.useIssue).mockReturnValue({
      data: mockIssue,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(issueHooks.useIssueComments).mockReturnValue({
      data: mockComments,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(issueHooks.useDeleteIssue).mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);

    vi.mocked(issueHooks.useCreateComment).mockReturnValue({
      mutateAsync: vi.fn(),
    } as any);
  });

  it('renders issue title and description', async () => {
    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /test issue/i })).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });
  });

  it('displays issue metadata correctly', async () => {
    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/reporter/i)).toBeInTheDocument();
      expect(screen.getByText(/assignee/i)).toBeInTheDocument();
      expect(screen.getByText(/created/i)).toBeInTheDocument();
      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });
  });

  it('shows Edit and Delete buttons', async () => {
    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  it('displays comments section with correct count', async () => {
    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /comments \(2\)/i })).toBeInTheDocument();
      expect(screen.getByText('First comment')).toBeInTheDocument();
      expect(screen.getByText('Second comment')).toBeInTheDocument();
    });
  });

  it('displays empty comments state', async () => {
    vi.mocked(issueHooks.useIssueComments).mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
      error: null,
    } as any);

    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });
  });

  it('shows comment form', async () => {
    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/write a comment/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /post comment/i })).toBeInTheDocument();
    });
  });

  it('opens edit modal when clicking Edit button', async () => {
    window.history.pushState({}, '', '/issues/1');

    const user = userEvent.setup();
    render(<IssueDetailPage />, { wrapper });

    const editButton = await screen.findByRole('button', { name: /edit/i });
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Issue')).toBeInTheDocument();
    });
  });

  it('displays loading state', () => {
    vi.mocked(issueHooks.useIssue).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    expect(screen.getByText(/loading issue/i)).toBeInTheDocument();
  });

  it('displays error state', () => {
    vi.mocked(issueHooks.useIssue).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    expect(screen.getByText(/failed to load issue/i)).toBeInTheDocument();
  });

  it('displays status badge with correct styling', async () => {
    window.history.pushState({}, '', '/issues/1');

    render(<IssueDetailPage />, { wrapper });

    await waitFor(() => {
      const badge = screen.getAllByText(/open/i).find(el =>
        el.className.includes('bg-blue-100')
      );
      expect(badge).toBeInTheDocument();
    });
  });
});
