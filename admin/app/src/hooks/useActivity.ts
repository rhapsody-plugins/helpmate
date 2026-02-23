import api from '@/lib/axios';
import {
  PaginationParams,
  PaginationResponse,
  TicketMessage
} from '@/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Ticket {
  id: number;
  ticket_id: string;
  datetime: string;
  subject: string;
  status: string;
  contact_id?: number | null;
  source?: string;
}

interface TicketsResponse {
  error: boolean;
  message?: string;
  tickets: Ticket[];
  pagination: PaginationResponse;
}

interface TicketMessagesResponse {
  error: boolean;
  message?: string;
  ticket?: {
    id: string;
    subject: string;
    status: string;
    created_at: string;
    user?: {
      id: number;
      name: string;
      email: string;
    };
    priority: string;
    contact_id?: number | null;
    source?: string;
  };
  messages: TicketMessage[];
}

export default function useActivity() {
  /* --------------------------------------- */
  /*                 Tickets                 */
  /* --------------------------------------- */

  const getTickets = useMutation<TicketsResponse, Error, PaginationParams & { contact_id?: number }>({
    mutationFn: async (params) => {
      const response = await api.get('/ticket/all', { params });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return (
        response.data ?? {
          error: false,
          tickets: [],
          pagination: {
            total: 0,
            per_page: 10,
            current_page: 1,
            total_pages: 0,
          },
        }
      );
    },
  });

  const getContactTickets = useMutation<TicketsResponse, Error, { contact_id: number; page?: number; per_page?: number }>({
    mutationFn: async ({ contact_id, page = 1, per_page = 20 }) => {
      const response = await api.get('/ticket/all', {
        params: { contact_id, page, per_page },
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return (
        response.data ?? {
          error: false,
          tickets: [],
          pagination: {
            total: 0,
            per_page: 20,
            current_page: 1,
            total_pages: 0,
          },
        }
      );
    },
  });

  const getTicketMessages = useMutation<
    TicketMessagesResponse,
    Error,
    { ticket_id: string }
  >({
    mutationFn: async ({ ticket_id }) => {
      const response = await api.get(`/ticket/messages`, {
        params: { ticket_id },
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return response.data;
    },
  });

  const replyToTicket = useMutation<
    TicketMessagesResponse,
    Error,
    { ticket_id: string; message: string }
  >({
    mutationFn: async ({ ticket_id, message }) => {
      const response = await api.post(`/ticket/reply`, {
        ticket_id,
        message,
        is_admin: true,
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return response.data;
    },
  });

  const updateTicketStatus = useMutation<
    TicketMessagesResponse,
    Error,
    { ticket_id: string; status: string }
  >({
    mutationFn: async ({ ticket_id, status }) => {
      const response = await api.post(`/ticket/status`, {
        ticket_id,
        status,
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return response.data;
    },
  });

  /* --------------------------------------- */
  /*                  Leads                  */
  /* --------------------------------------- */

  const useGetLeads = (page: number = 1, per_page: number = 10) => {
    return useQuery({
      queryKey: ['leads', page, per_page],
      queryFn: async () => {
        const response = await api.get('/leads', {
          params: { page, per_page },
        });
        if (response.data.error) {
          toast.error(response.data.message ?? 'Something went wrong!');
        }
        return response.data;
      },
      refetchOnWindowFocus: false,
    });
  };

  /* --------------------------------------- */
  /*           Contact Assignment            */
  /* --------------------------------------- */

  const assignContactToLead = useMutation<
    { error: boolean; message?: string },
    Error,
    { lead_id: number; contact_id: number }
  >({
    mutationFn: async ({ lead_id, contact_id }) => {
      const response = await api.post(`/leads/${lead_id}/assign-contact`, {
        contact_id,
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Failed to assign contact');
      } else {
        toast.success('Contact assigned successfully');
      }

      return response.data;
    },
  });

  const createContactFromLead = useMutation<
    { error: boolean; message?: string; contact_id?: number },
    Error,
    { lead_id: number; contact_data?: Record<string, unknown> }
  >({
    mutationFn: async ({ lead_id, contact_data }) => {
      const response = await api.post(`/leads/${lead_id}/create-contact`, contact_data ?? {});

      if (response.data.error) {
        toast.error(response.data.message ?? 'Failed to create contact');
      } else {
        toast.success('Contact created successfully');
      }

      return response.data;
    },
  });

  const assignContactToTicket = useMutation<
    { error: boolean; message?: string },
    Error,
    { ticket_id: string; contact_id: number }
  >({
    mutationFn: async ({ ticket_id, contact_id }) => {
      const response = await api.post(`/tickets/${ticket_id}/assign-contact`, {
        contact_id,
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Failed to assign contact');
      } else {
        toast.success('Contact assigned successfully');
      }

      return response.data;
    },
  });

  /* --------------------------------------- */
  /*              Task Creation              */
  /* --------------------------------------- */

  const createTaskFromLead = useMutation<
    { error: boolean; task_id?: number; message?: string },
    Error,
    { lead_id: number; task_data?: Record<string, unknown> }
  >({
    mutationFn: async ({ lead_id, task_data }) => {
      const response = await api.post(`/leads/${lead_id}/create-task`, task_data);

      if (response.data.error) {
        toast.error(response.data.message ?? 'Failed to create task');
      } else {
        toast.success('Task created successfully');
      }

      return response.data;
    },
  });

  const createTaskFromTicket = useMutation<
    { error: boolean; task_id?: number; message?: string },
    Error,
    { ticket_id: string; task_data?: Record<string, unknown> }
  >({
    mutationFn: async ({ ticket_id, task_data }) => {
      const response = await api.post(`/tickets/${ticket_id}/create-task`, task_data);

      if (response.data.error) {
        toast.error(response.data.message ?? 'Failed to create task');
      } else {
        toast.success('Task created successfully');
      }

      return response.data;
    },
  });

  const bulkCreateTasksFromLeads = useMutation<
    { error: boolean; results?: Array<{ lead_id: number; task_id: number | false; success: boolean }> },
    Error,
    { lead_ids: number[]; task_data?: Record<string, unknown> }
  >({
    mutationFn: async ({ lead_ids, task_data }) => {
      const response = await api.post('/leads/bulk-create-task', {
        lead_ids,
        ...task_data,
      });

      if (response.data.error) {
        toast.error('Failed to create some tasks');
      } else {
        const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
        toast.success(`Created ${successCount} task(s) successfully`);
      }

      return response.data;
    },
  });

  const bulkCreateTasksFromTickets = useMutation<
    { error: boolean; results?: Array<{ ticket_id: string; task_id: number | false; success: boolean }> },
    Error,
    { ticket_ids: string[]; task_data?: Record<string, unknown> }
  >({
    mutationFn: async ({ ticket_ids, task_data }) => {
      const response = await api.post('/tickets/bulk-create-task', {
        ticket_ids,
        ...task_data,
      });

      if (response.data.error) {
        toast.error('Failed to create some tasks');
      } else {
        const successCount = response.data.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
        toast.success(`Created ${successCount} task(s) successfully`);
      }

      return response.data;
    },
  });

  /* --------------------------------------- */
  /*         Manual Ticket Creation          */
  /* --------------------------------------- */

  const createTicket = useMutation<
    { error: boolean; ticket_id?: number; message?: string },
    Error,
    { subject: string; message: string; email: string; name?: string; priority?: string; contact_id?: number; skip_auto_create_contact?: boolean }
  >({
    mutationFn: async (data) => {
      const response = await api.post('/tickets/create', data);

      if (response.data.error) {
        toast.error(response.data.message ?? 'Failed to create ticket');
      } else {
        toast.success('Ticket created successfully');
      }

      return response.data;
    },
  });

  return {
    getTickets,
    getContactTickets,
    getTicketMessages,
    replyToTicket,
    updateTicketStatus,
    useGetLeads,
    assignContactToLead,
    createContactFromLead,
    assignContactToTicket,
    createTaskFromLead,
    createTaskFromTicket,
    bulkCreateTasksFromLeads,
    bulkCreateTasksFromTickets,
    createTicket,
  };
}
