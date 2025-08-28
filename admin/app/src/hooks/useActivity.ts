import api from '@/lib/axios';
import {
  Lead,
  PaginationParams,
  PaginationResponse,
  TicketMessage,
} from '@/types';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Session {
  session_id: string;
  message_count: number;
  total_tokens: number;
  start_time: string;
  last_activity: string;
}

interface SessionsResponse {
  error: boolean;
  message?: string;
  sessions: Session[];
  pagination: PaginationResponse;
}
interface ChatHistory {
  id: number;
  message: string;
  role: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface ChatHistoryResponse {
  error: boolean;
  message?: string;
  history: ChatHistory[];
}

interface Ticket {
  id: number;
  ticket_id: string;
  datetime: string;
  subject: string;
  status: string;
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
  };
  messages: TicketMessage[];
}

interface LeadsResponse {
  error: boolean;
  message?: string;
  leads: Lead[];
  pagination: PaginationResponse;
}

export default function useActivity() {
  /* --------------------------------------- */
  /*                   Chat                  */
  /* --------------------------------------- */

  const getSessions = useMutation<SessionsResponse, Error, PaginationParams>({
    mutationFn: async (params) => {
      const response = await api.get('/chat/all-sessions', {
        params,
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return (
        response.data ?? {
          error: false,
          sessions: [],
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

  const getChatHistory = useMutation<
    ChatHistoryResponse,
    Error,
    { session_id: string }
  >({
    mutationFn: async ({ session_id }) => {
      const response = await api.post(`/chat/history`, {
        session_id,
      });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return response.data;
    },
  });

  /* --------------------------------------- */
  /*                 Tickets                 */
  /* --------------------------------------- */

  const getTickets = useMutation<TicketsResponse, Error, PaginationParams>({
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

  const getLeads = useMutation<LeadsResponse, Error, PaginationParams>({
    mutationFn: async (params) => {
      const response = await api.get('/leads', { params });

      if (response.data.error) {
        toast.error(response.data.message ?? 'Something went wrong!');
      }

      return response.data;
    },
  });

  return {
    getSessions,
    getChatHistory,
    getTickets,
    getTicketMessages,
    replyToTicket,
    updateTicketStatus,
    getLeads,
  };
}
