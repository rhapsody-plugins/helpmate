import api from '@/lib/axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

export interface ScheduleType {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  user_id: number | null;
  contact_id: number | null;
  has_contact?: boolean;
  created_at: number;
  updated_at: number;
  metadata: string | null;
}

export interface SmartSchedulingSettings {
  enabled: boolean;
  timeSlotDuration: number;
  /** Minutes to hold a selected slot before it is released (e.g. 3, 5, 10). Default 5. */
  slotReserveMinutes?: number;
  buttonText?: string;
  availability: {
    [day: string]: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
  };
  formFields: {
    name: { visible: boolean; required: boolean };
    email: { visible: boolean; required: boolean };
    phone: { visible: boolean; required: boolean };
    message: { visible: boolean; required: boolean };
    date: { visible: boolean; required: boolean };
    time: { visible: boolean; required: boolean };
  };
  emailTemplates?: {
    pending?: number | null;
    confirmed?: number | null;
    cancelled?: number | null;
  };
}

interface SchedulesResponse {
  data: ScheduleType[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export function useSmartScheduling() {
  const queryClient = useQueryClient();
  const { getProQuery } = useSettings();
  const isPro = getProQuery.data ?? false;

  const getSchedulesQuery = useQuery<SchedulesResponse>({
    queryKey: ['schedules'],
    queryFn: async () => {
      const response = await api.get('/schedules');
      return response.data;
    },
    enabled: isPro,
    initialData: {
      data: [],
      total: 0,
      page: 1,
      per_page: 20,
      total_pages: 0,
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      phone?: string;
      message?: string;
      scheduled_date: string;
      scheduled_time: string;
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to create schedules');
      }
      const response = await api.post('/schedules', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Schedule created successfully');
      getSchedulesQuery.refetch();
    },
    onError: () => {
      toast.error('Failed to create schedule');
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      status?: string;
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
      scheduled_date?: string;
      scheduled_time?: string;
      contact_id?: number;
    }) => {
      if (!isPro) {
        throw new Error('Pro license required to update schedules');
      }
      const response = await api.post(`/schedules/${data.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Schedule updated successfully');
      getSchedulesQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['contact-schedules'] });
    },
    onError: () => {
      toast.error('Failed to update schedule');
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!isPro) {
        throw new Error('Pro license required to delete schedules');
      }
      const response = await api.post(`/schedules/${id}/delete`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Schedule deleted successfully');
      getSchedulesQuery.refetch();
    },
    onError: () => {
      toast.error('Failed to delete schedule');
    },
  });

  const getSettingsMutation = useMutation<SmartSchedulingSettings, Error, void>({
    mutationFn: async () => {
      const response = await api.get('/settings/smart_schedules');
      return response.data ?? {
        enabled: false,
        timeSlotDuration: 30,
        slotReserveMinutes: 5,
        buttonText: 'Get Appointments',
        availability: {
          monday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          tuesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          wednesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          thursday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          friday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          saturday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          sunday: { enabled: false, startTime: '09:00', endTime: '17:00' },
        },
        formFields: {
          name: { visible: true, required: true },
          email: { visible: true, required: true },
          phone: { visible: true, required: false },
          message: { visible: true, required: false },
          date: { visible: true, required: true },
          time: { visible: true, required: true },
        },
        emailTemplates: {
          pending: null,
          confirmed: null,
          cancelled: null,
        },
      };
    },
    onError: () => {
      toast.error('Failed to fetch settings');
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SmartSchedulingSettings) => {
      const response = await api.post('/settings', { smart_schedules: data });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Settings updated successfully');
      getSettingsMutation.mutate();
    },
    onError: () => {
      toast.error('Failed to update settings');
    },
  });

  // Get schedules for a contact by email
  const useContactSchedules = (email: string | null, enabled = true) => {
    return useQuery<ScheduleType[]>({
      queryKey: ['contact-schedules', email],
      queryFn: async () => {
        const response = await api.get<SchedulesResponse>('/schedules', {
          params: { email },
        });
        return response.data.data;
      },
      enabled: isPro && enabled && email !== null && email !== '',
      initialData: [],
    });
  };

  return {
    getSchedulesQuery,
    createScheduleMutation,
    updateScheduleMutation,
    deleteScheduleMutation,
    getSettingsMutation,
    updateSettingsMutation,
    useContactSchedules,
  };
}

