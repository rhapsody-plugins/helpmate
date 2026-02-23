import Loading from '@/components/Loading';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import { SocialConversation, useSocialChat } from '@/hooks/useSocialChat';
import {
  contactFormSchema,
  type ContactFormData,
} from '@/pages/crm/contacts/schemas';
import { Contact } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Trash2, Unlink, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import ContactSidebarContent from './ContactSidebarContent';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ContactSidebarProps {
  conversation: SocialConversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactSidebar({
  conversation,
  open,
  onOpenChange,
}: ContactSidebarProps) {
  const queryClient = useQueryClient();
  const { useConversationContact, linkContactMutation, unlinkContactMutation } = useSocialChat();
  const { useContact } = useCrm();
  const [linkedContactId, setLinkedContactId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Get conversation ID - can be number (social) or string (website)
  const conversationId = conversation.id;
  const { data: conversationContact } = useConversationContact(
    conversationId,
    open && !conversation.contact_id && !linkedContactId
  );

  // Use conversation.contact_id if available (highest priority), otherwise use linkedContactId or fetched contact
  // conversation.contact_id takes priority because it comes from the refetched conversation data
  const contactId =
    conversation.contact_id ||
    linkedContactId ||
    conversationContact?.contact_id ||
    null;

  const { data: contact, isLoading: contactLoading } = useContact(
    contactId,
    open && contactId !== null
  );

  const {
    useContactStatuses,
    useCustomFields,
    updateContactMutation,
    deleteContactMutation,
  } = useCrm();

  const { data: statusesData } = useContactStatuses();
  const statuses = statusesData || [];
  const { data: customFieldsData } = useCustomFields();
  const customFields = customFieldsData || [];

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

  // Track the last contact ID we reset the form for
  const lastResetContactIdRef = useRef<number | null>(null);

  // Reset form when contact changes
  useEffect(() => {
    if (contact && contact.id !== lastResetContactIdRef.current) {
      // Only reset if this is a different contact
      lastResetContactIdRef.current = contact.id;

      // Prepare custom fields for form (keys as strings for zod)
      const customFieldsData: Record<
        string,
        string | number | string[] | null
      > = {};
      if (contact.custom_fields) {
        Object.entries(contact.custom_fields).forEach(
          ([fieldId, fieldValue]) => {
            customFieldsData[fieldId] = fieldValue.value;
          }
        );
      }

      form.reset({
        prefix: contact.prefix || 'none',
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        date_of_birth: contact.date_of_birth || '',
        address_line_1: contact.address_line_1 || '',
        address_line_2: contact.address_line_2 || '',
        city: contact.city || '',
        state: contact.state || '',
        zip_code: contact.zip_code || '',
        country: contact.country || '',
        wp_user_id: contact.wp_user_id || null,
        status: contact.status || 'Subscribed',
        custom_fields: customFieldsData,
      });
    }
  }, [contact, form]);

  const handleSave = (data: ContactFormData) => {
    if (!contactId) return;

    // Prepare custom fields data for API (convert string keys to numbers)
    const customFieldsData: Record<number, string | number | string[] | null> =
      {};
    if (data.custom_fields) {
      Object.entries(data.custom_fields).forEach(([fieldId, value]) => {
        customFieldsData[parseInt(fieldId)] = value;
      });
    }

    // API accepts simple values for custom_fields when creating/updating
    // The Contact type uses ContactCustomFieldValue for reading, but API accepts simple values for writing
    const dataToSave = {
      ...data,
      prefix: data.prefix === 'none' ? undefined : data.prefix,
      // Convert null to undefined for wp_user_id to match Contact type
      wp_user_id: data.wp_user_id ?? undefined,
      custom_fields: customFieldsData,
    } as unknown as Partial<Contact>;

    updateContactMutation.mutate({ contactId, data: dataToSave });
  };

  const handleDelete = () => {
    if (!contactId) return;
    if (
      confirm(
        'Are you sure you want to delete this contact? This action cannot be undone.'
      )
    ) {
      deleteContactMutation.mutate(contactId);
    }
  };

  // Reset linkedContactId and edit mode when conversation changes
  // Also sync with conversation.contact_id when it updates
  useEffect(() => {
    if (conversation.contact_id) {
      setLinkedContactId(conversation.contact_id);
    } else {
      setLinkedContactId(null);
    }
    setIsEditMode(false);
  }, [conversation.id, conversation.contact_id]);

  // Handle unlinking contact
  const handleUnlinkContact = () => {
    if (!confirm('Are you sure you want to unlink this contact from the conversation?')) {
      return;
    }
    unlinkContactMutation.mutate(conversationId, {
      onSuccess: () => {
        setLinkedContactId(null);
        setIsEditMode(false);
        queryClient.invalidateQueries({ queryKey: ['social-conversations'] });
      },
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="flex h-full flex-col w-[500px] border-l bg-background shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 justify-between items-center p-4 border-b">
        <h3 className="text-lg font-semibold !my-[11px]">Contact Details</h3>
        <div className="flex gap-2 items-center">
          {contactId && contact && !isEditMode && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Change Contact</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlinkContact}
                    disabled={unlinkContactMutation.isPending}
                  >
                    <Unlink className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unlink Contact</TooltipContent>
              </Tooltip>
              <Button
                size="sm"
                onClick={form.handleSubmit(handleSave)}
                disabled={updateContactMutation.isPending}
              >
                {updateContactMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteContactMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {isEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(false)}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-hidden flex-1 min-h-0">
        <ScrollArea className="h-full">
        {contactLoading ? (
          <div className="p-4">
            <Loading />
          </div>
        ) : isEditMode ? (
          <div className="p-4">
            <LinkContactForm
              conversation={conversation}
              isReassignment={true}
              currentContactId={contactId}
              onContactCreated={(newContactId) => {
                // Optimistically set the linked contact ID to immediately show contact
                setLinkedContactId(newContactId);
                setIsEditMode(false);

                // Link new contact to conversation (reassignment)
                linkContactMutation.mutate(
                  {
                    conversationId,
                    contactId: newContactId,
                  },
                  {
                    onSuccess: () => {
                      // Invalidate conversation queries to refresh with contact_id
                      queryClient.invalidateQueries({
                        queryKey: ['social-conversations'],
                      });
                      // Invalidate contact query to ensure fresh data
                      queryClient.invalidateQueries({
                        queryKey: ['crm-contact', newContactId],
                      });
                    },
                  }
                );
              }}
            />
          </div>
        ) : contactId && contact ? (
          <ContactSidebarContent
            contactId={contact.id}
            form={form}
            customFields={customFields}
            statuses={statuses}
          />
        ) : (
          <div className="p-4">
            <LinkContactForm
              conversation={conversation}
              onContactCreated={(newContactId) => {
                // Optimistically set the linked contact ID to immediately show contact
                setLinkedContactId(newContactId);

                // Link contact to conversation (works for both social and website conversations)
                linkContactMutation.mutate(
                  {
                    conversationId,
                    contactId: newContactId,
                  },
                  {
                    onSuccess: () => {
                      // Invalidate conversation queries to refresh with contact_id
                      queryClient.invalidateQueries({
                        queryKey: ['social-conversations'],
                      });
                      // Invalidate contact query to ensure fresh data
                      queryClient.invalidateQueries({
                        queryKey: ['crm-contact', newContactId],
                      });
                    },
                  }
                );
              }}
            />
          </div>
        )}
        </ScrollArea>
      </div>
    </div>
  );
}

interface LinkContactFormProps {
  conversation: SocialConversation;
  onContactCreated: (contactId: number) => void;
  isReassignment?: boolean;
  currentContactId?: number | null;
}

function LinkContactForm({
  conversation,
  onContactCreated,
  isReassignment = false,
  currentContactId,
}: LinkContactFormProps) {
  const { getProQuery } = useSettings();
  const { data: isPro } = getProQuery;
  const { createContactMutation, useContactStatuses, useContacts } = useCrm();
  const { data: statusesData } = useContactStatuses();
  const statuses = statusesData || [];

  const [contactSearch, setContactSearch] = useState('');
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'select' | 'create'>('select');

  // Fetch contacts for search
  const { data: contactsData } = useContacts({ search: contactSearch }, 1, 50);
  // Filter out current contact when in reassignment mode
  const contacts = (contactsData?.contacts || []).filter(
    (c) => !isReassignment || c.id !== currentContactId
  );
  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // Get total contact count for limit check
  const { data: allContactsData } = useContacts({}, 1, 1);
  const contactCount = allContactsData?.pagination?.total || 0;

  // Parse name from participant_name
  const nameParts = (conversation.participant_name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const [formData, setFormData] = useState({
    first_name: firstName,
    last_name: lastName,
    email: '', // Email might not be available from conversation
    phone: '',
    status: 'Subscribed',
    avatar_url: conversation.participant_profile_pic || '',
  });

  // Handle existing contact selection
  const handleSelectContact = (contactId: number) => {
    setSelectedContactId(contactId);
    setContactPopoverOpen(false);
    onContactCreated(contactId);
  };

  // Handle create new contact
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      alert('Email is required');
      return;
    }

    // Check contact limit for non-Pro users
    if (!isPro && contactCount >= 50) {
      toast.error(
        'Non-Pro users are limited to 50 contacts. Upgrade to Pro for unlimited contacts.'
      );
      return;
    }

    createContactMutation.mutate(
      {
        ...formData,
        status: formData.status,
      },
      {
        onSuccess: (result) => {
          onContactCreated(result.contact_id);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-base font-semibold">
          {isReassignment ? 'Change Contact' : 'Link Contact'}
        </h4>
        <p className="mb-4 text-sm text-muted-foreground">
          {isReassignment
            ? 'Select a different contact to link to this conversation, or create a new one.'
            : 'This conversation is not linked to a contact. Select an existing contact or create a new one to view details and manage interactions.'}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="select">Select Existing</TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {activeTab === 'select' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Contact</label>
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
                        ? `${selectedContact.email} (${selectedContact.first_name} ${selectedContact.last_name})`
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
                        {contacts.map((contact) => (
                          <CommandItem
                            key={contact.id}
                            onSelect={() => handleSelectContact(contact.id)}
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
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className="px-3 py-2 w-full rounded-md border"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  className="px-3 py-2 w-full rounded-md border"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="px-3 py-2 w-full rounded-md border"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="px-3 py-2 w-full rounded-md border"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="px-3 py-2 w-full rounded-md border"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="submit"
                disabled={createContactMutation.isPending}
                className="w-full"
              >
                {createContactMutation.isPending
                  ? 'Creating...'
                  : 'Create Contact'}
              </Button>
            </form>
          )}
        </div>
      </Tabs>
    </div>
  );
}
