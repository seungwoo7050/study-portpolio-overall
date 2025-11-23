import apiClient from '../../shared/lib/apiClient';
import type { DailyIssueStatsDto, PopularIssueDto } from '../../shared/types/api';

export interface DailyStatsParams {
  from: string; // ISODate
  to: string; // ISODate
}

export interface PopularIssuesParams {
  days?: number;
  limit?: number;
}

export interface DailyStatsResponse {
  items: DailyIssueStatsDto[];
}

export interface PopularIssuesResponse {
  items: PopularIssueDto[];
}

export interface ExternalApiResponse {
  source: string;
  data: {
    value: number;
    label: string;
  };
}

export const statsApi = {
  getDailyStats: async (params: DailyStatsParams): Promise<DailyStatsResponse> => {
    const response = await apiClient.get<DailyStatsResponse>('/stats/daily', {
      params,
    });
    return response.data;
  },

  getPopularIssues: async (params?: PopularIssuesParams): Promise<PopularIssuesResponse> => {
    const response = await apiClient.get<PopularIssuesResponse>('/issues/popular', {
      params,
    });
    return response.data;
  },

  getExternalData: async (): Promise<ExternalApiResponse> => {
    const response = await apiClient.get<ExternalApiResponse>('/external/example');
    return response.data;
  },
};
