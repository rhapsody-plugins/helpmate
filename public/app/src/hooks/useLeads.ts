import api from '@/lib/axios';
import { useMutation } from '@tanstack/react-query';

interface LeadData {
  name: string;
  metadata?: Record<string, string | number | boolean | null>;
}

interface LeadResponse {
  error: boolean;
  lead?: boolean;
  message?: string;
}

export const useLeads = () => {
  const createLead = useMutation<LeadResponse, Error, LeadData>({
    mutationFn: async (data) => {
      const response = await api.post<LeadResponse>('/leads', data);
      return response.data;
    },
    onError: (error) => {
      console.error('Error creating lead:', error);
    },
  });

  return {
    createLead,
  };
};
