import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Task,
  TaskFilters,
  TaskFormData,
  Pagination,
  Contact,
} from '@/types/crm';

export function useTasks() {
  const queryClient = useQueryClient();

  // Get tasks
  const useTasks = (filters?: TaskFilters, page = 1, perPage = 20) => {
    return useQuery({
      queryKey: ['tasks', filters, page, perPage],
      queryFn: async () => {
        const params: Record<string, string | number | boolean> = {
          page,
          per_page: perPage,
        };
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
              params[key] = value;
            }
          });
        }
        const response = await api.get<{
          error: boolean;
          data: { tasks: Task[]; pagination: Pagination };
        }>('/tasks', { params });
        return response.data.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  // Get single task
  const useTask = (taskId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['task', taskId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: Task;
        }>(`/tasks/${taskId}`);
        return response.data.data;
      },
      enabled: enabled && taskId !== null,
    });
  };

  // Create task
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const response = await api.post<{
        error: boolean;
        task_id: number;
        message: string;
      }>('/tasks', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Task created successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create task');
    },
  });

  // Update task
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: Partial<TaskFormData> }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/tasks/${taskId}`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Task updated successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update task');
    },
  });

  // Delete task
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/tasks/${taskId}/delete`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Task deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete task');
    },
  });

  // Get task contacts
  const useTaskContacts = (taskId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['task-contacts', taskId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: Contact[];
        }>(`/tasks/${taskId}/contacts`);
        return response.data.data;
      },
      enabled: enabled && taskId !== null,
    });
  };

  // Update task contacts
  const updateTaskContactsMutation = useMutation({
    mutationFn: async ({ taskId, contactIds }: { taskId: number; contactIds: number[] }) => {
      const response = await api.post<{
        error: boolean;
        message: string;
      }>(`/tasks/${taskId}/contacts`, { contact_ids: contactIds });
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Task contacts updated successfully');
      queryClient.invalidateQueries({ queryKey: ['task', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-contacts', variables.taskId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update task contacts');
    },
  });

  // Get tasks for a contact
  const useContactTasks = (contactId: number | null, enabled = true) => {
    return useQuery({
      queryKey: ['contact-tasks', contactId],
      queryFn: async () => {
        const response = await api.get<{
          error: boolean;
          data: Task[];
        }>(`/crm/contacts/${contactId}/tasks`);
        return response.data.data;
      },
      enabled: enabled && contactId !== null,
    });
  };

  return {
    useTasks,
    useTask,
    createTaskMutation,
    updateTaskMutation,
    deleteTaskMutation,
    useTaskContacts,
    updateTaskContactsMutation,
    useContactTasks,
  };
}
