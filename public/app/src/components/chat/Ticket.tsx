'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useTickets } from '@/hooks/useTickets';
import { __ } from '@/lib/utils';
import type { ContactFormData } from '../../types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

export function Ticket({
  data,
  messageId,
  onSubmit,
  displayOnly = false,
}: {
  data: ContactFormData;
  messageId: string;
  onSubmit: (messageId: string, submitted: boolean) => void;
  /** When true, show form read-only (e.g. admin inbox) — no submission */
  displayOnly?: boolean;
}) {
  const { createTicket } = useTickets();
  const [isSubmitted, setIsSubmitted] = useState(data.submitted || false);

  const formSchema = useMemo(
    () =>
      z.object({
        subject: z.string().min(1, __('Subject is required')),
        email: z.string().email(__('Invalid email address')),
        message: z.string().min(1, __('Message is required')),
      }),
    []
  );

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
    <>
      {isSubmitted ? (
        <div className="overflow-hidden my-3 rounded-lg border">
          <div className="flex justify-between items-center p-3 border-b bg-slate-50">
            <div className="flex items-center text-lg">{__('Ticket submitted')}</div>
          </div>
        </div>
      ) : (
        <Card className="p-3 mt-2 shadow-none">
          <Form {...form}>
            <form
              onSubmit={displayOnly ? (e) => e.preventDefault() : form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{__('Subject')}</FormLabel>
                    <FormControl>
                      <Input placeholder={__('Enter subject')} {...field} disabled={displayOnly} />
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
                    <FormLabel>{__('Email')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={__('Enter your email')}
                        type="email"
                        {...field}
                        disabled={displayOnly}
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
                    <FormLabel>{__('Message')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={__('Enter your message')}
                        rows={4}
                        {...field}
                        disabled={displayOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!displayOnly && (
                <Button type="submit" disabled={createTicket.isPending}>
                  <Send />{' '}
                  {createTicket.isPending ? __('Submitting…') : __('Submit Ticket')}
                </Button>
              )}
            </form>
          </Form>
        </Card>
      )}
    </>
  );
}
