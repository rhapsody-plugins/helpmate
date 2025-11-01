'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/useSettings';
import { useTickets } from '@/hooks/useTickets';
import type { HandoverData } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(1, 'Message is required'),
});

interface HandoverProps {
  handoverData: HandoverData;
  messageId: string;
  onSubmit: (messageId: string, submitted: boolean) => void;
}

export function Handover({ handoverData, messageId, onSubmit }: HandoverProps) {
  const { getSettingsQuery } = useSettings();
  const settings = getSettingsQuery.data;
  const showTicketCreationOption =
    settings?.settings?.show_ticket_creation_option;
  const { createTicket } = useTickets();
  const [isSubmitted, setIsSubmitted] = useState(
    handoverData.submitted || false
  );

  const handleHandoverClick = (title: string, value: string) => {
    const lowerTitle = title.toLowerCase();
    let url = '';

    if (lowerTitle.includes('whatsapp')) {
      url = `https://wa.me/${value.replace(/[^0-9+]/g, '')}`;
    } else if (lowerTitle.includes('messenger')) {
      url = `https://m.me/${value}`;
    } else if (lowerTitle.includes('call') || lowerTitle.includes('phone')) {
      url = `tel:${value.replace(/[^0-9+]/g, '')}`;
    } else if (lowerTitle.includes('email')) {
      url = `mailto:${value}`;
    } else if (lowerTitle.includes('website') || lowerTitle.includes('web')) {
      url = value.startsWith('http') ? value : `https://${value}`;
    }

    if (url) {
      window.open(url, '_blank');
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: '',
      email: '',
      message: '',
    },
  });

  async function handleSubmit(values: z.infer<typeof formSchema>) {
    const response = await createTicket.mutateAsync({
      subject: values.subject,
      email: values.email,
      message: values.message,
    });
    if (!response.error) {
      setIsSubmitted(true);
      onSubmit(messageId, true);
    }
  }

  return (
    <div className="my-2 space-y-2">
      <>
        {handoverData.handover.length > 0 && (
          <p className="mb-1 text-xs text-slate-500">Select a option:</p>
        )}
        {handoverData.handover.map((handover, index) => (
          <Button
            key={index}
            size="sm"
            className="justify-between px-3 py-2 w-full h-auto text-sm font-normal text-left text-black bg-white hover:!bg-slate-100"
            onClick={() => handleHandoverClick(handover.title, handover.value)}
          >
            <span className="mr-2 truncate">
              <span className="font-semibold">{handover.title}:</span>{' '}
              {handover.value}
            </span>
            <ChevronRight size={16} className="flex-shrink-0 text-slate-400" />
          </Button>
        ))}
      </>
      {showTicketCreationOption && (
        <>
          <p className="mb-1 text-xs text-slate-500">Create a new ticket:</p>
          {isSubmitted ? (
            <div className="overflow-hidden my-3 rounded-lg border">
              <div className="flex justify-between items-center p-3 border-b bg-slate-50">
                <div className="flex items-center">Ticket submitted</div>
              </div>
            </div>
          ) : (
            <Card className="gap-0 p-0 mt-2 shadow-none">
              <CardContent className="p-4">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter subject" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your email"
                              type="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter your message"
                              rows={4}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit">
                      <Send /> Submit Ticket
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
