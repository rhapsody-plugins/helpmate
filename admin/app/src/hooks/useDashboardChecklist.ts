import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';

export interface ChecklistStatus {
  has_knowledge_base: boolean;
  has_test_chat: boolean;
  has_customization: boolean;
  has_business_hours_configured: boolean;
  has_contacts: boolean;
}

export function useDashboardChecklist() {
  const checklistQuery = useQuery<ChecklistStatus, Error>({
    queryKey: ['dashboard-checklist'],
    queryFn: async () => {
      const response = await api.get<{
        error: boolean;
        data: ChecklistStatus;
      }>('/dashboard/checklist-status');
      return response.data.data;
    },
    refetchOnWindowFocus: false,
  });

  return {
    checklistQuery,
  };
}

