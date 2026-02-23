import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import useActivity from '@/hooks/useActivity';
import { useCrm } from '@/hooks/useCrm';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Plus } from 'lucide-react';
import { parseUTCDate, defaultLocale } from '../utils';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { TicketDetailsSheet } from './TicketDetailsSheet';

const ticketFormSchema = (selectedContactId: number | null) =>
  z
    .object({
      subject: z.string().min(1, 'Subject is required'),
      message: z.string().min(1, 'Message is required'),
      email: z
        .string()
        .email('Invalid email address')
        .optional()
        .or(z.literal('')),
      name: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      createNewContact: z.boolean().optional(),
    })
    .refine(
      (data) => {
        // Email required if no contact selected AND not creating new contact
        if (!selectedContactId && !data.createNewContact) {
          return data.email && data.email.length > 0;
        }
        // Email required if creating new contact
        if (data.createNewContact) {
          return data.email && data.email.length > 0;
        }
        return true;
      },
      {
        message: 'Email is required when no contact is selected',
        path: ['email'],
      }
    );

type TicketFormData = z.infer<ReturnType<typeof ticketFormSchema>>;

interface TicketsTabProps {
  contactId: number | null;
}

interface TicketData {
  ticket_id: string;
  subject: string;
  status: string;
  source?: string;
  datetime?: string;
}

const PAGE_SIZE = 10;

export function TicketsTab({ contactId }: TicketsTabProps) {
  const activityHook = useActivity();
  const { useContacts, useContact, createContactMutation } = useCrm();
  const [showTicketSheet, setShowTicketSheet] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(
    contactId
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch contacts - include current contact in search if sheet is open
  const { data: contactsData } = useContacts({ search: contactSearch }, 1, 50);
  const contacts = contactsData?.contacts || [];
  const { data: currentContact, isLoading: currentContactLoading } = useContact(
    contactId,
    !!contactId
  );

  // Contacts for dropdown: exclude current contact (already selected by default) and dedupe by id
  const allContacts = React.useMemo(() => {
    const seen = new Set<number>();
    return contacts.filter((c) => {
      if (contactId && c.id === contactId) return false;
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [contacts, contactId]);

  const schema = useMemo(
    () => ticketFormSchema(selectedContactId),
    [selectedContactId]
  );

  const form = useForm<TicketFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: '',
      message: '',
      email: '',
      name: '',
      priority: 'normal',
      createNewContact: false,
    },
  });

  // Reset to page 1 when contactId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contactId]);

  useEffect(() => {
    if (contactId) {
      activityHook.getContactTickets.mutate({
        contact_id: contactId,
        page: currentPage,
        per_page: PAGE_SIZE,
      });
      setSelectedContactId(contactId);
    }
  }, [contactId, currentPage]);

  // Clear email validation errors when contact selection changes
  useEffect(() => {
    if (selectedContactId) {
      form.clearErrors('email');
    }
  }, [selectedContactId, form]);

  // Pre-select contact and pre-fill form when sheet opens
  useEffect(() => {
    if (isCreateSheetOpen && contactId) {
      // Always set selectedContactId when sheet opens
      setSelectedContactId(contactId);

      // Pre-fill form fields when currentContact is available
      if (currentContact) {
        form.setValue('email', currentContact.email || '');
        form.setValue(
          'name',
          `${currentContact.first_name || ''} ${
            currentContact.last_name || ''
          }`.trim() || ''
        );
      }
    } else if (!isCreateSheetOpen) {
      // Reset form when sheet closes
      form.reset({
        subject: '',
        message: '',
        email: '',
        name: '',
        priority: 'normal',
      });
      setSelectedContactId(contactId);
    }
  }, [isCreateSheetOpen, contactId, currentContact, form]);

  const { data: ticketsData } = activityHook.getContactTickets;
  const tickets = ticketsData?.tickets || [];
  const pagination = ticketsData?.pagination as
    | {
    total?: number;
    total_pages?: number;
    current_page?: number;
      }
    | undefined;

  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setShowTicketSheet(true);
  };

  const handleStatusUpdate = () => {
    // Refresh tickets list after status update
    if (contactId) {
      activityHook.getContactTickets.mutate({
        contact_id: contactId,
        page: currentPage,
        per_page: PAGE_SIZE,
      });
    }
  };

  const handleCreateTicket = async (data: TicketFormData) => {
    try {
      let contactIdToUse = selectedContactId;

      // If checkbox is checked, create contact first
      if (data.createNewContact && data.email) {
        const nameParts = (data.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const contactResult = await createContactMutation.mutateAsync({
          email: data.email,
          first_name: firstName,
          last_name: lastName,
          status: 'Subscribed',
        });

        if (contactResult?.contact_id) {
          contactIdToUse = contactResult.contact_id;
        }
      }

      // Get email from selected contact if contact is selected
      let email = data.email;
      if (selectedContact && !email) {
        email = selectedContact.email;
      }

      await activityHook.createTicket.mutateAsync({
        subject: data.subject,
        message: data.message,
        email: email || '',
        name: data.name || '',
        priority: data.priority || 'normal',
        contact_id: contactIdToUse || undefined,
        skip_auto_create_contact: !contactIdToUse && !data.createNewContact,
      });

      form.reset();
      setIsCreateSheetOpen(false);
      setSelectedContactId(contactId);

      // Refresh tickets list
      if (contactId) {
        activityHook.getContactTickets.mutate({
          contact_id: contactId,
          page: currentPage,
          per_page: PAGE_SIZE,
        });
      }
    } catch {
      // Error handling is done in the mutation
    }
  };

  // Get selected contact - prefer currentContact if it matches selectedContactId
  const selectedContact = React.useMemo(() => {
    if (selectedContactId === contactId) {
      // If we're looking for the current contact, prefer currentContact (most up-to-date)
      // but fall back to allContacts if currentContact isn't loaded yet
      return currentContact || allContacts.find((c) => c.id === contactId);
    }
    return allContacts.find((c) => c.id === selectedContactId);
  }, [selectedContactId, contactId, currentContact, allContacts]);

  const columns: ColumnDef<TicketData>[] = [
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.subject}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === 'open'
              ? 'default'
              : row.original.status === 'closed'
              ? 'secondary'
              : 'outline'
          }
          className="capitalize"
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) =>
        row.original.source ? (
          <Badge variant="outline" className="capitalize">{row.original.source}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'datetime',
      header: 'Created',
      cell: ({ row }) =>
        row.original.datetime ? (
          formatDistanceToNow(parseUTCDate(row.original.datetime), {
            addSuffix: true,
            locale: defaultLocale,
          })
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTicketClick(row.original.ticket_id)}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (!contactId) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No contact selected.
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="!text-lg !my-0">
              Tickets ({pagination?.total || tickets.length})
            </CardTitle>
            <Button
              onClick={() => {
                setSelectedContactId(contactId);
                setIsCreateSheetOpen(true);
              }}
              size="sm"
            >
              <Plus className="mr-2 w-4 h-4" />
              Create Ticket
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={columns}
            data={tickets}
            loading={activityHook.getContactTickets.isPending}
            showPagination={true}
            serverSidePagination={true}
            totalCount={pagination?.total || 0}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            onRowClick={(row) => handleTicketClick(row.ticket_id)}
          />
        </CardContent>
      </Card>

      <TicketDetailsSheet
        open={showTicketSheet}
        onOpenChange={setShowTicketSheet}
        ticketId={selectedTicketId}
        contactId={contactId}
        onStatusUpdate={handleStatusUpdate}
      />

      <Sheet
        open={isCreateSheetOpen}
        onOpenChange={(open) => {
          setIsCreateSheetOpen(open);
          if (!open) {
            setSelectedContactId(contactId);
            form.reset();
          }
        }}
      >
        <SheetContent className="sm:!max-w-2xl flex flex-col h-full gap-0 overflow-hidden">
          <SheetHeader className="pb-4 mt-6 border-b">
            <SheetTitle className="text-lg font-bold !my-0">
              Create New Ticket
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 p-4 pt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateTicket)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter ticket subject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!selectedContactId && (
                  <>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="customer@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="createNewContact"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Create new contact with this email
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Contact (Optional)</FormLabel>
                  <Popover
                    open={contactPopoverOpen}
                    onOpenChange={setContactPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="justify-between w-full"
                      >
                        {selectedContact
                          ? `${selectedContact.email}${
                              selectedContact.first_name ||
                              selectedContact.last_name
                                ? ` (${[
                                    selectedContact.first_name,
                                    selectedContact.last_name,
                                  ]
                                    .filter(Boolean)
                                    .join(' ')})`
                                : ''
                            }`
                          : selectedContactId &&
                            selectedContactId === contactId &&
                            currentContactLoading
                          ? 'Loading contact...'
                          : 'Select contact...'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-full">
                      <Command>
                        <CommandInput
                          placeholder="Search contacts..."
                          value={contactSearch}
                          onValueChange={setContactSearch}
                        />
                        <CommandEmpty>No contacts found.</CommandEmpty>
                        <CommandGroup className="overflow-y-auto max-h-64">
                          <CommandItem
                            onSelect={() => {
                              setSelectedContactId(null);
                              setContactPopoverOpen(false);
                            }}
                          >
                            <Checkbox
                              checked={selectedContactId === null}
                              className="mr-2"
                            />
                            No contact
                          </CommandItem>
                          {allContacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              onSelect={() => {
                                setSelectedContactId(contact.id);
                                setContactPopoverOpen(false);
                              }}
                            >
                              <Checkbox
                                checked={selectedContactId === contact.id}
                                className="mr-2"
                              />
                              {contact.email} ({contact.first_name}{' '}
                              {contact.last_name})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter ticket message"
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateSheetOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={activityHook.createTicket.isPending}
                  >
                    {activityHook.createTicket.isPending
                      ? 'Creating...'
                      : 'Create Ticket'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
