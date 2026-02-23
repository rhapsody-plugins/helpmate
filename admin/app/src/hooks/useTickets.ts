import { useMutation } from '@tanstack/react-query';

/** Stub for admin — Ticket uses this but displayOnly mode prevents submission */
export function useTickets() {
  const createTicket = useMutation({
    mutationFn: async (_ticket: {
      subject: string;
      email: string;
      message: string;
    }) => ({ error: true, message: 'Display only' }),
  });

  const replyToTicket = useMutation({
    mutationFn: async (_params: { ticket_id: string; message: string }) => ({
      error: true,
      message: 'Display only',
    }),
  });

  return {
    createTicket,
    replyToTicket,
  };
}
