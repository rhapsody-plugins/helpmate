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
import { __ } from '@/lib/utils';
import type { ContactFormData } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
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

  const schema = useMemo(() => {
    const req = __('This field is required');
    const emailInvalid = __('Please enter a valid email address');
    const phoneShort = __('Please enter a valid phone number');
    return z.object({
      name: collectLeadSettings?.includes('name')
        ? z.string().min(1, req)
        : z.string(),
      email: collectLeadSettings?.includes('email')
        ? z.string().min(1, req).email(emailInvalid)
        : z.string(),
      phone: collectLeadSettings?.includes('phone')
        ? z.string().min(10, phoneShort)
        : z.string(),
      website: collectLeadSettings?.includes('website')
        ? z.string().min(1, req)
        : z.string(),
      message: collectLeadSettings?.includes('message')
        ? z.string().min(1, req)
        : z.string(),
    });
  }, [collectLeadSettings]);

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
          {__('Thank you for contacting us!')}
        </h3>
        <p className="text-sm text-green-600">
          {__(
            "We've received your information and will get back to you shortly."
          )}
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
                  <FormLabel>{__('Name')}</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="text" placeholder={__('Enter Name')} {...field} />
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
                  <FormLabel>{__('Email')}</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="email" placeholder={__('Enter Email')} {...field} />
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
                  <FormLabel>{__('Phone')}</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="tel" placeholder={__('Enter Phone')} {...field} />
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
                  <FormLabel>{__('Website')}</FormLabel>
                  <FormControl>
                    <Input className="bg-white" type="url" placeholder={__('Enter Website')} {...field} />
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
                  <FormLabel>{__('Message')}</FormLabel>
                  <FormControl>
                    <Textarea className="bg-white" placeholder={__('Enter Message')} {...field} />
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
            {isPending ? __('Submitting…') : __('Submit')}
          </Button>
        </Card>
      </form>
    </Form>
  );
}
