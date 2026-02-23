import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { Contact } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  PREFIX_OPTIONS,
  contactFormSchema,
  type ContactFormData,
} from '../schemas';
import { CustomFieldFormInput } from './CustomFieldFormInput';
import { WordPressUserSelector } from './WordPressUserSelector';

interface ContactCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
  initialFirstName?: string;
  initialLastName?: string;
  leadId?: number;
  onContactCreated?: (contactId: number) => void;
}

export function ContactCreateSheet({
  open,
  onOpenChange,
  initialEmail,
  initialFirstName,
  initialLastName,
  leadId,
  onContactCreated,
}: ContactCreateSheetProps) {
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const { createContactMutation, useContactStatuses, useCustomFields, useContacts } =
    useCrm();
  const { data: statusesData } = useContactStatuses();
  const statuses = statusesData || [];
  const { data: customFieldsData } = useCustomFields();
  const customFields = customFieldsData || [];
  const { data: contactsData } = useContacts({}, 1, 1);
  const contactCount = contactsData?.pagination?.total || 0;

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      prefix: 'none',
      first_name: initialFirstName || '',
      last_name: initialLastName || '',
      email: initialEmail || '',
      phone: '',
      date_of_birth: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      wp_user_id: null,
      status: 'Subscribed',
      custom_fields: {},
    },
  });

  useEffect(() => {
    if (open) {
      if (initialEmail) {
        form.setValue('email', initialEmail);
      }
      if (initialFirstName) {
        form.setValue('first_name', initialFirstName);
      }
      if (initialLastName) {
        form.setValue('last_name', initialLastName);
      }
    }
  }, [open, initialEmail, initialFirstName, initialLastName, form]);

  useEffect(() => {
    if (!open) {
      form.reset({
        prefix: 'none',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        wp_user_id: null,
        status: 'Subscribed',
        custom_fields: {},
      });
    }
  }, [open, form]);

  const onSubmit = (data: ContactFormData) => {
    // Check contact limit for non-Pro users
    if (!isPro && contactCount >= 50) {
      toast.error(
        'Non-Pro users are limited to 50 contacts. Upgrade to Pro for unlimited contacts.'
      );
      return;
    }

    // Prepare custom fields data for API (convert string keys to numbers)
    const customFieldsData: Record<number, string | number | string[] | null> =
      {};
    if (data.custom_fields) {
      Object.entries(data.custom_fields).forEach(([fieldId, value]) => {
        customFieldsData[parseInt(fieldId)] = value;
      });
    }

    const dataToSave = {
      ...data,
      prefix: data.prefix === 'none' ? undefined : data.prefix,
      wp_user_id: data.wp_user_id ?? undefined,
      custom_fields: customFieldsData,
    } as unknown as Partial<Contact>;

    createContactMutation.mutate(dataToSave, {
      onSuccess: async (result) => {
        // If this contact was created from a lead, assign it to the lead
        if (leadId && result?.contact_id) {
          try {
            await api.post(`/leads/${leadId}/assign-contact`, {
              contact_id: result.contact_id,
            });
          } catch (error) {
            // Silently fail - assignment is not critical
            console.error('Error assigning contact to lead:', error);
          }
        }

        onOpenChange(false);
        if (onContactCreated && result?.contact_id) {
          onContactCreated(result.contact_id);
        }
      },
    });
  };

  const isSubmitting = createContactMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0 overflow-hidden">
        <SheetHeader className="pb-4 mt-6 border-b">
          <SheetTitle className="text-lg font-bold !my-0">
            Create Contact
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 p-4 pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="prefix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prefix</FormLabel>
                          <Select
                            value={field.value || 'none'}
                            onValueChange={(value) =>
                              field.onChange(
                                value === 'none' ? undefined : value
                              )
                            }
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select prefix" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PREFIX_OPTIONS.map((prefix) => (
                                <SelectItem key={prefix} value={prefix}>
                                  {prefix === 'none' ? 'None' : prefix}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                          <FormLabel>
                            Email <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input type="tel" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <WordPressUserSelector form={form} />
                </CardContent>
              </Card>

              {/* Address Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Address Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="address_line_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address_line_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="zip_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Custom Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {customFields.map((field) => (
                      <CustomFieldFormInput
                        key={field.id}
                        form={form}
                        field={field}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  )}
                  Create Contact
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

