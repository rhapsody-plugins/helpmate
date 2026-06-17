import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/context/ThemeContext';
import { useLeads } from '@/hooks/useLeads';
import { useSettings } from '@/hooks/useSettings';
import { __, cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMemo } from 'react';
import { z } from 'zod';

export default function LeadCollection({
  setCollectLead,
  title = __('Please fill out the form to continue.'),
  variant = 'large',
  textColor = 'text-white',
}: {
  setCollectLead: (collectLead: boolean) => void;
  title?: string;
  variant?: 'small' | 'large';
  textColor?: string;
}) {
  const { icon_shape } = useTheme();
  const { createLead } = useLeads();
  const { mutate: createLeadMutation, isPending } = createLead;
  const { getSettingsQuery } = useSettings();
  const { data: settings } = getSettingsQuery;
  const collectLeadSettings = settings?.settings?.lead_form_fields;

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
          localStorage.setItem('lead_collected', 'true');
          setCollectLead(true);
        },
        onError: (error) => {
          console.error('Error creating lead:', error);
        },
      }
    );
  };

  return (
    <div
      className={cn(
        'flex overflow-y-auto flex-col gap-4 p-10 h-full bg-gradient-to-b from-primary to-primary/0',
        variant === 'small' ? 'p-4 bg-white' : 'p-10',
        icon_shape === 'square' ? 'rounded-none' : 'rounded-t-xl',
        icon_shape === 'circle' ? 'rounded-t-xl' : 'rounded-t-xl',
        icon_shape === 'rounded' ? 'rounded-t-xl' : 'rounded-t-xl',
        icon_shape === 'rectangle' ? 'rounded-t-xl' : 'rounded-t-xl'
      )}
    >
      <div className={cn('text-xl font-semibold text-center', textColor)}>{title}</div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleLeadCollect)}>
          <div className="flex flex-col gap-4">
            {collectLeadSettings?.includes('name') && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn(textColor)}>{__('Name')}</FormLabel>
                    <FormControl>
                      <Input className="bg-white" type="text" {...field} />
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
                    <FormLabel className={cn(textColor)}>{__('Email')}</FormLabel>
                    <FormControl>
                      <Input className="bg-white" type="email" {...field} />
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
                    <FormLabel className={cn(textColor)}>{__('Phone')}</FormLabel>
                    <FormControl>
                      <Input className="bg-white" type="tel" {...field} />
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
                    <FormLabel className={cn(textColor)}>{__('Website')}</FormLabel>
                    <FormControl>
                      <Input className="bg-white" type="url" {...field} />
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
                    <FormLabel className={cn(textColor)}>{__('Message')}</FormLabel>
                    <FormControl>
                      <Textarea className="bg-white" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <Button className={cn(variant === 'small' && 'self-start')} type="submit" size="lg" disabled={isPending}>
              {isPending ? __('Submitting…') : __('Submit')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
