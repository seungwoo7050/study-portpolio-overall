import apiClient from '../../shared/lib/apiClient';
import type {
  LoginRequest,
  LoginResponse,
  CreateUserRequest,
  UserDto,
} from '../../shared/types/api';

export const authApi = {
  /**
   * User registration (public endpoint)
   */
  register: async (data: CreateUserRequest): Promise<UserDto> => {
    const response = await apiClient.post<UserDto>('/users', data);
    return response.data;
  },

  /**
   * User login (public endpoint)
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  /**
   * Get current authenticated user
   */
  getCurrentUser: async (): Promise<UserDto> => {
    const response = await apiClient.get<UserDto>('/auth/me');
    return response.data;
  },
};
