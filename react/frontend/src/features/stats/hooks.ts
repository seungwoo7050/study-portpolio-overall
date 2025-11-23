import { useQuery } from '@tanstack/react-query';
import { statsApi, type DailyStatsParams, type PopularIssuesParams } from './api';

export const useDailyStats = (params: DailyStatsParams) => {
  return useQuery({
    queryKey: ['stats', 'daily', params],
    queryFn: () => statsApi.getDailyStats(params),
    enabled: !!params.from && !!params.to,
  });
};

export const usePopularIssues = (params?: PopularIssuesParams) => {
  return useQuery({
    queryKey: ['issues', 'popular', params],
    queryFn: () => statsApi.getPopularIssues(params),
    // Use staleTime to keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useExternalData = () => {
  return useQuery({
    queryKey: ['external', 'example'],
    queryFn: () => statsApi.getExternalData(),
    // Retry on failure
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
