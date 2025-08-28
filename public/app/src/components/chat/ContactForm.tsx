'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Form,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLeads } from '@/hooks/useLeads';
import { useSettings } from '@/hooks/useSettings';
import type { ContactFormData } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

interface ContactFormProps {
  data: ContactFormData;
  messageId: string;
  onSubmit: (messageId: string, submitted: boolean) => void;
}

export function ContactForm({ messageId, onSubmit }: ContactFormProps) {
  const { createLead } = useLeads();
  const { mutate: createLeadMutation, isPending } = createLead;
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;
  const collectLeadSettings = settings?.settings?.lead_form_fields;

  const [isSubmitted, setIsSubmitted] = useState(false);

  const schema = z.object({
    name: z.string().min(collectLeadSettings?.includes('name') ? 1 : 0),
    email: z
      .string()
      .email()
      .min(collectLeadSettings?.includes('email') ? 1 : 0),
    phone: z.string().min(collectLeadSettings?.includes('phone') ? 10 : 0),
    website: z.string().min(collectLeadSettings?.includes('website') ? 1 : 0),
    message: z.string().min(collectLeadSettings?.includes('message') ? 1 : 0),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      website: '',
      message: '',
    },
  });

  const handleLeadCollect = () => {
    createLeadMutation(
      {
        name: form.getValues('name'),
        metadata: {
          email: form.getValues('email'),
          phone: form.getValues('phone'),
          website: form.getValues('website'),
          message: form.getValues('message'),
        },
      },
      {
        onSuccess: () => {
          setIsSubmitted(true);
          onSubmit(messageId, true);
        },
        onError: (error) => {
          console.error('Error creating lead:', error);
        },
      }
    );
  };

  if (isSubmitted) {
    return (
      <div className="my-3 p-4 bg-green-50 border border-green-100 rounded-lg">
        <h3 className="text-green-700 font-medium mb-2">
          Thank you for contacting us!
        </h3>
        <p className="text-sm text-green-600">
          We've received your information and will get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleLeadCollect)}>
        <Card className="flex flex-col gap-4 mt-2 p-4 shadow-none">
          {collectLeadSettings?.includes('name') && (
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="text" placeholder="Enter Name" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          {collectLeadSettings?.includes('email') && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="email" placeholder="Enter Email" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          {collectLeadSettings?.includes('phone') && (
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="tel" placeholder="Enter Phone" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          {collectLeadSettings?.includes('website') && (
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="url" placeholder="Enter Website" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          {collectLeadSettings?.includes('message') && (
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea className="bg-white" placeholder="Enter Message" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <Button
            className="self-start"
            type="submit"
            disabled={isPending}
          >
            {isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </Card>
      </form>
    </Form>
  );
}
