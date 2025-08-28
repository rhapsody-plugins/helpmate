import api from '@/lib/axios';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useTickets() {
  const createTicket = useMutation<
    { error: boolean; message: string },
    Error,
    { subject: string; email: string; message: string }
  >({
    mutationFn: async (ticket: {
      subject: string;
      email: string;
      message: string;
    }) => {
      const response = await api.post('/ticket', ticket);
      if (response.data.error) {
        toast.error(response.data.message);
      }
      return response.data;
    },
  });

  const replyToTicket = useMutation<
    { error: boolean; message: string },
    Error,
    { ticket_id: string; message: string }
  >({
    mutationFn: async (ticket: { ticket_id: string; message: string }) => {
      const response = await api.post('/ticket/reply', {
        ticket_id: ticket.ticket_id,
        message: ticket.message,
      });
      if (response.data.error) {
        toast.error(response.data.message);
      }
      return response.data;
    },
  });

  return {
    createTicket,
    replyToTicket,
  };
}
