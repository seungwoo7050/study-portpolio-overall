import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';
import type { LoginRequest, CreateUserRequest } from '../../shared/types/api';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/**
 * Hook to get current authenticated user
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.getCurrentUser,
    retry: false,
    staleTime: Infinity, // User data rarely changes during a session
  });
}

/**
 * Hook to login
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (response) => {
      // Store the JWT token in localStorage
      localStorage.setItem('accessToken', response.accessToken);

      // Set the user data in the cache
      queryClient.setQueryData(authKeys.me, response.user);
    },
  });
}

/**
 * Hook to register a new user
 */
export function useRegister() {
  return useMutation({
    mutationFn: (data: CreateUserRequest) => authApi.register(data),
  });
}

/**
 * Hook to logout
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Clear token from localStorage
      localStorage.removeItem('accessToken');

      // Clear all queries
      queryClient.clear();
    },
  });
}
