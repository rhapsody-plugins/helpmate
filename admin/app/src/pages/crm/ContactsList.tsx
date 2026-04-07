import Loading from '@/components/Loading';
import PageHeader from '@/components/PageHeader';
import PageGuard from '@/components/PageGuard';
import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { useMain } from '@/contexts/MainContext';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { Contact, ContactFilters, CustomField } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { defaultLocale } from './contacts/utils';
import { toast } from 'sonner';
import {
  Check,
  ChevronsUpDown,
  Eye,
  Loader2,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const PREFIX_OPTIONS = ['none', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];

// Helper function to parse UTC date strings correctly
function parseUTCDate(dateString: string): Date {
  // If already has timezone info (Z or +/- offset), use as-is
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }
  // If it's a datetime string (has 'T' or space between date and time), treat as UTC
  // MySQL format: "YYYY-MM-DD HH:MM:SS" or ISO format: "YYYY-MM-DDTHH:MM:SS"
  if (
    dateString.includes('T') ||
    /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(dateString)
  ) {
    // Replace space with 'T' for ISO format, then append 'Z'
    const isoString = dateString.replace(' ', 'T');
    return new Date(isoString + 'Z');
  }
  // Otherwise, parse as-is (date-only strings)
  return new Date(dateString);
}

const contactFormSchema = z.object({
  prefix: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().optional(),
  wp_user_id: z.number().optional().nullable(),
  status: z.string().min(1, 'Status is required'),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

function WordPressUserSelector({
  form,
}: {
  form: ReturnType<typeof useForm<ContactFormData>>;
}) {
  const { useSearchWpUsers } = useCrm();
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { data: users, isLoading } = useSearchWpUsers(searchQuery);

  const selectedUserId = form.watch('wp_user_id');
  const selectedUser = users?.find((u) => u.id === selectedUserId);

  return (
    <FormField
      control={form.control}
      name="wp_user_id"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>WordPress User</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    'w-full justify-between',
                    !field.value && 'text-muted-foreground'
                  )}
                >
                  {selectedUser
                    ? `${selectedUser.display_name} (${selectedUser.email})`
                    : 'Select WordPress user...'}
                  <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-full" align="start">
              <Command>
                <CommandInput
                  className="!border-none !ring-0 !ring-offset-0 h-5"
                  placeholder="Search users..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandEmpty>
                  {isLoading ? 'Loading...' : 'No user found.'}
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => {
                      form.setValue('wp_user_id', null);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        !field.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    No user
                  </CommandItem>
                  {users?.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.id}-${user.display_name}`}
                      onSelect={() => {
                        form.setValue('wp_user_id', user.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          user.id === field.value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {user.display_name} ({user.email})
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function CustomFieldFormInput({
  form,
  field,
}: {
  form: ReturnType<typeof useForm<ContactFormData>>;
  field: CustomField;
}) {
  const fieldName = `custom_fields.${field.id}` as const;

  switch (field.field_type) {
    case 'textarea':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Textarea
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'dropdown':
    case 'radio':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <Select
                value={formField.value || ''}
                onValueChange={formField.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.field_label}`} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {field.field_options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'checkbox':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <input
                  type="checkbox"
                  checked={formField.value || false}
                  onChange={(e) => formField.onChange(e.target.checked)}
                  className="rounded"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-red-500">*</span>}
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'number':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    case 'date':
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    default:
      return (
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field: formField }) => (
            <FormItem>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-red-500">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type={field.field_type === 'email' ? 'email' : 'text'}
                  value={formField.value || ''}
                  onChange={(e) => formField.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
  }
}

interface ContactCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ContactCreateSheet({ open, onOpenChange }: ContactCreateSheetProps) {
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
    },
  });

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

    // Validate required custom fields (mirror TaskDetails pattern)
    if (customFields) {
      const requiredFields = customFields.filter((f) => f.is_required);
      for (const field of requiredFields) {
        const fieldValue = data.custom_fields?.[String(field.id)];
        if (
          !fieldValue ||
          (typeof fieldValue === 'string' && fieldValue.trim() === '')
        ) {
          form.setError(`custom_fields.${field.id}`, {
            type: 'required',
            message: `${field.field_label} is required`,
          });
          return;
        }
      }
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
      onSuccess: () => {
        onOpenChange(false);
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

export default function ContactsList() {
  const { setPage } = useMain();
  const [page, setPageState] = useState(1);
  const [perPage] = useState(20);
  const [filters, setFilters] = useState<ContactFilters>({});
  const [search, setSearch] = useState('');
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);

  // Check sessionStorage on mount - if contact ID is set, navigate to contact details
  useEffect(() => {
    const storedId = sessionStorage.getItem('crm_selected_contact_id');
    if (storedId && storedId !== 'new') {
      // Contact ID is set, navigate to contact details page
      setPage('crm-contact-details');
    }
  }, [setPage]);

  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const {
    useContactStatuses,
    useContactIntegrationSourceOptions,
    useContacts,
    deleteContactMutation,
  } = useCrm();
  const { data: statusesData } = useContactStatuses();
  const { data: integrationSourceOptions = [] } = useContactIntegrationSourceOptions();
  const statuses = statusesData || [];

  const { data: contactsData, isLoading } = useContacts(
    { ...filters, search },
    page,
    perPage
  );

  const contacts = contactsData?.contacts || [];
  const pagination = contactsData?.pagination;
  const contactCount = pagination?.total || 0;

  // Check if add button should be disabled
  const isAddDisabled = !isPro && contactCount >= 50;

  const columns: ColumnDef<Contact>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.email}</div>
      ),
    },
    {
      id: 'full_name',
      header: 'Full Name',
      cell: ({ row }) => {
        const contact = row.original;
        const fullName = [contact.first_name, contact.last_name]
          .filter(Boolean)
          .join(' ');
        return <div>{fullName || '-'}</div>;
      },
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <div>{row.original.phone || '-'}</div>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDistanceToNow(parseUTCDate(row.original.created_at), {
            addSuffix: true,
            locale: defaultLocale,
          })}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const contact = row.original;
        return (
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleViewContact(e, contact)}
              className="w-8 h-8"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleDeleteContact(e, contact)}
              className="w-8 h-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const handleRowClick = (contact: Contact) => {
    setPage('crm-contact-details');
    // Store contact ID in sessionStorage or context for details page
    sessionStorage.setItem('crm_selected_contact_id', contact.id.toString());
  };

  const handleViewContact = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation();
    handleRowClick(contact);
  };

  const handleDeleteContact = (e: React.MouseEvent, contact: Contact) => {
    e.stopPropagation();
    if (
      confirm(`Are you sure you want to delete contact "${contact.email}"?`)
    ) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  const handleAddContact = () => {
    setIsCreateSheetOpen(true);
  };

  return (
    <PageGuard page="crm-contacts">
      <div className="gap-0">
        <PageHeader
          title={`Contacts (${contactCount})`}
          rightActions={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild={!isAddDisabled}>
                  {isAddDisabled ? (
                    <div>
                      <Button onClick={handleAddContact} size="sm" disabled={isAddDisabled}>
                        <Plus className="mr-2 w-4 h-4" />
                        Add Contact
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleAddContact} size="sm" disabled={isAddDisabled}>
                      <Plus className="mr-2 w-4 h-4" />
                      Add Contact
                    </Button>
                  )}
                </TooltipTrigger>
                {isAddDisabled && (
                  <TooltipContent>
                    <p>
                      Non-Pro users are limited to 50 contacts. Upgrade to Pro
                      for unlimited contacts.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          }
        />

        <div className="overflow-auto flex-1 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="!text-lg !my-0">Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPageState(1);
                  }}
                  className="!pl-9"
                />
              </div>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => {
                  setFilters((prev) => ({
                    ...prev,
                    status: value === 'all' ? undefined : value,
                  }));
                  setPageState(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.integration_source || 'all'}
                onValueChange={(value) => {
                  setFilters((prev) => ({
                    ...prev,
                    integration_source: value === 'all' ? undefined : value,
                  }));
                  setPageState(1);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Integration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Integrations</SelectItem>
                  {integrationSourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <Loading />
            ) : contacts.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-12 text-center">
                <User className="mb-4 w-16 h-16 opacity-20 text-muted-foreground" />
                <p className="text-muted-foreground">No contacts found</p>
                <Button
                  onClick={handleAddContact}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="mr-2 w-4 h-4" />
                  Add Your First Contact
                </Button>
              </div>
            ) : (
              <ReusableTable
                columns={columns}
                data={contacts}
                onRowClick={handleRowClick}
                enableSorting={false}
                showPagination={true}
                serverSidePagination={true}
                totalCount={pagination?.total || 0}
                currentPage={page}
                onPageChange={(newPage) => setPageState(newPage)}
                pageSize={perPage}
              />
            )}
              </div>
            </CardContent>
          </Card>
        </div>

        <ContactCreateSheet
          open={isCreateSheetOpen}
          onOpenChange={setIsCreateSheetOpen}
        />
      </div>
    </PageGuard>
  );
}
