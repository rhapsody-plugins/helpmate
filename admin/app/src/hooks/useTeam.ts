import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';

export interface TeamMember {
  user_id: number;
  user: {
    id: number;
    login: string;
    email: string;
    display_name: string;
    first_name: string;
    last_name: string;
  } | null;
  roles: string[];
  assigned_by: number[];
  created_at: number;
  updated_at: number;
}

export interface CreateTeamMemberData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  roles: string[];
  include_password?: boolean;
  send_reset_link?: boolean;
}

export interface UpdateTeamMemberData {
  roles: string[];
}

export interface SearchUser {
  id: number;
  login: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
}

export function useTeam() {
  const queryClient = useQueryClient();

  // Get team members
  const useTeamMembers = (filters?: { role?: string; search?: string }) => {
    return useQuery({
      queryKey: ['team-members', filters],
      queryFn: async () => {
        const params: Record<string, string> = {};
        if (filters?.role) params.role = filters.role;
        if (filters?.search) params.search = filters.search;

        const response = await api.get<{
          error: boolean;
          data: TeamMember[];
        }>('/team-members', { params });
        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Create team member (new user)
  const useCreateTeamMember = () => {
    return useMutation({
      mutationFn: async (data: CreateTeamMemberData) => {
        const response = await api.post<{
          error: boolean;
          data: { user_id: number; roles: string[] };
          message?: string;
        }>('/team-members', data);
        if (response.data.error) {
          throw new Error(response.data.message || 'Failed to create team member');
        }
        return response.data.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['team-members'] });
        toast.success('Team member created successfully');
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        const message =
          error.response?.data?.message || error.message || 'Failed to create team member';
        toast.error(message);
      },
    });
  };

  // Update team member roles
  const useUpdateTeamMember = () => {
    return useMutation({
      mutationFn: async ({ user_id, data }: { user_id: number; data: UpdateTeamMemberData }) => {
        const response = await api.post<{
          error: boolean;
          data: { user_id: number; roles: string[] };
          message?: string;
        }>(`/team-members/${user_id}`, data);
        if (response.data.error) {
          throw new Error(response.data.message || 'Failed to update team member');
        }
        return response.data.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['team-members'] });
        toast.success('Team member updated successfully');
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        const message =
          error.response?.data?.message || error.message || 'Failed to update team member';
        toast.error(message);
      },
    });
  };

  // Add role to user
  const useAddRole = () => {
    return useMutation({
      mutationFn: async ({ user_id, role }: { user_id: number; role: string }) => {
        const response = await api.post<{
          error: boolean;
          data: { user_id: number; roles: string[] };
          message?: string;
        }>(`/team-members/${user_id}/roles`, { add: [role] });
        if (response.data.error) {
          throw new Error(response.data.message || 'Failed to add role');
        }
        return response.data.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['team-members'] });
        toast.success('Role added successfully');
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        const message = error.response?.data?.message || error.message || 'Failed to add role';
        toast.error(message);
      },
    });
  };

  // Remove role from user
  const useRemoveRole = () => {
    return useMutation({
      mutationFn: async ({ user_id, role }: { user_id: number; role: string }) => {
        const response = await api.post<{
          error: boolean;
          message?: string;
        }>(`/team-members/${user_id}/roles/${role}/delete`);
        if (response.data.error) {
          throw new Error(response.data.message || 'Failed to remove role');
        }
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['team-members'] });
        toast.success('Role removed successfully');
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        const message = error.response?.data?.message || error.message || 'Failed to remove role';
        toast.error(message);
      },
    });
  };

  // Remove team member (all roles)
  const useRemoveTeamMember = () => {
    return useMutation({
      mutationFn: async (user_id: number) => {
        const response = await api.post<{
          error: boolean;
          message?: string;
        }>(`/team-members/${user_id}/delete`);
        if (response.data.error) {
          throw new Error(response.data.message || 'Failed to remove team member');
        }
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['team-members'] });
        toast.success('Team member removed successfully');
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        const message =
          error.response?.data?.message || error.message || 'Failed to remove team member';
        toast.error(message);
      },
    });
  };

  // Search WordPress users
  const useSearchUsers = (search: string, limit = 50, isOpen?: boolean) => {
    return useQuery({
      queryKey: ['team-members', 'search-users', search, limit],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: SearchUser[];
        }>('/team-members/search-users', {
          params: { search, limit },
        });
        return response.data.data;
      },
      enabled: isOpen !== undefined ? isOpen : search.length > 0,
      refetchOnWindowFocus: false,
    });
  };

  // Get user permissions
  const useUserPermissions = () => {
    return useQuery({
      queryKey: ['team-members', 'permissions'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: {
            user_id: number;
            roles: string[];
            permissions: string[];
          };
        }>('/team-members/permissions');
        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Get available roles
  const useAvailableRoles = () => {
    return useQuery({
      queryKey: ['team-members', 'roles'],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: string[];
        }>('/team-members/roles');
        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  return {
    useTeamMembers,
    useCreateTeamMember,
    useUpdateTeamMember,
    useAddRole,
    useRemoveRole,
    useRemoveTeamMember,
    useSearchUsers,
    useUserPermissions,
    useAvailableRoles,
  };
}

