import Loading from '@/components/Loading';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMain } from '@/contexts/MainContext';
import { useCrm } from '@/hooks/useCrm';
import { Contact } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  FileText,
  GraduationCap,
  Mail,
  MessageCircle,
  ShoppingBag,
  ShoppingCart,
  TicketPercent,
  Trash2,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { contactFormSchema, type ContactFormData } from './contacts/schemas';
import { AbandonedCartsTab } from './contacts/tabs/AbandonedCartsTab';
import { ConversationsTab } from './contacts/tabs/ConversationsTab';
import { EmailsTab } from './contacts/tabs/EmailsTab';
import { NotesTab } from './contacts/tabs/NotesTab';
import { OrdersTab } from './contacts/tabs/OrdersTab';
import { OverviewTab } from './contacts/tabs/OverviewTab';
import { SchedulesTab } from './contacts/tabs/SchedulesTab';
import { TasksTab } from './contacts/tabs/TasksTab';
import { TicketsTab } from './contacts/tabs/TicketsTab';
import { LmsTab } from './contacts/tabs/LmsTab';

export default function ContactDetails() {
  const { setPage } = useMain();
  const [contactId, setContactId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const storedId = sessionStorage.getItem('crm_selected_contact_id');
    if (storedId === 'new') {
      setIsNew(true);
      setContactId(null);
    } else if (storedId) {
      setContactId(parseInt(storedId, 10));
      setIsNew(false);
    } else {
      // No contact selected, go back to list
      setPage('crm-contacts');
    }
  }, [setPage]);

  const {
    useContactStatuses,
    useContact,
    useCustomFields,
    createContactMutation,
    updateContactMutation,
    deleteContactMutation,
  } = useCrm();

  const { data: statusesData } = useContactStatuses();
  const statuses = statusesData || [];

  const { data: contact, isLoading: contactLoading } = useContact(
    contactId,
    !isNew && contactId !== null
  );

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
    } else if (isNew && lastResetContactIdRef.current !== null) {
      // Reset to new contact state
      lastResetContactIdRef.current = null;

      // Check for prefilled email from sessionStorage
      const prefilledEmail =
        sessionStorage.getItem('crm_new_contact_email') || '';

      form.reset({
        prefix: 'none',
        first_name: '',
        last_name: '',
        email: prefilledEmail,
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

      // Clear the prefilled email from sessionStorage after using it
      if (prefilledEmail) {
        sessionStorage.removeItem('crm_new_contact_email');
      }
    }
  }, [contact, isNew, form]);

  const handleSave = (data: ContactFormData) => {
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

    // API accepts simple values for custom_fields when creating/updating
    // The Contact type uses ContactCustomFieldValue for reading, but API accepts simple values for writing
    const dataToSave = {
      ...data,
      prefix: data.prefix === 'none' ? undefined : data.prefix,
      // Convert null to undefined for wp_user_id to match Contact type
      wp_user_id: data.wp_user_id ?? undefined,
      custom_fields: customFieldsData,
    } as unknown as Partial<Contact>;

    if (isNew) {
      createContactMutation.mutate(dataToSave, {
        onSuccess: (result) => {
          sessionStorage.setItem(
            'crm_selected_contact_id',
            result.contact_id.toString()
          );
          // Clear prefilled email if it exists
          sessionStorage.removeItem('crm_new_contact_email');
          setIsNew(false);
          setContactId(result.contact_id);
        },
      });
    } else if (contactId) {
      updateContactMutation.mutate(
        { contactId, data: dataToSave },
        {
          onSuccess: () => {
            // The query will refetch, but since we're tracking the contact ID,
            // the form won't reset unnecessarily because the contact ID hasn't changed
          },
        }
      );
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem('crm_selected_contact_id');
    setPage('crm-contacts');
  };

  const handleDelete = () => {
    if (!contactId || isNew) return;
    if (
      confirm(
        'Are you sure you want to delete this contact? This action cannot be undone.'
      )
    ) {
      deleteContactMutation.mutate(contactId, {
        onSuccess: () => {
          sessionStorage.removeItem('crm_selected_contact_id');
          setPage('crm-contacts');
        },
      });
    }
  };

  if (contactLoading && !isNew) {
    return <Loading />;
  }

  const formValues = form.watch();
  const displayName = isNew
    ? 'New Contact'
    : [formValues.first_name, formValues.last_name].filter(Boolean).join(' ') ||
      formValues.email ||
      'Contact';

  return (
    <PageGuard page="crm-contact-details">
      <div className="gap-0">
        <PageHeader
          title={displayName}
          rightActions={
            <div className="flex gap-2">
              <Button onClick={handleBack} variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              {!isNew && contactId && (
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  size="sm"
                  disabled={deleteContactMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button onClick={form.handleSubmit(handleSave)} size="sm">
                {isNew ? 'Create Contact' : 'Update Contact'}
              </Button>
            </div>
          }
        />

        <div className="overflow-auto flex-1 p-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="flex flex-wrap gap-1 w-full h-auto p-1">
              <TabsTrigger value="overview" className="!text-xs">
                <User className="!w-3 !h-3" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="emails" className="!text-xs">
                <Mail className="!w-3 !h-3" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="orders" className="!text-xs">
                <ShoppingBag className="!w-3 !h-3" />
                Orders
              </TabsTrigger>
              <TabsTrigger value="abandoned-carts" className="!text-xs">
                <ShoppingCart className="!w-3 !h-3" />
                Abandoned Carts
              </TabsTrigger>
              <TabsTrigger value="conversations" className="!text-xs">
                <MessageCircle className="!w-3 !h-3" />
                Conversations
              </TabsTrigger>
              <TabsTrigger value="tickets" className="!text-xs">
                <TicketPercent className="!w-3 !h-3" />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="tasks" className="!text-xs">
                <ClipboardList className="!w-3 !h-3" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="schedules" className="!text-xs">
                <Calendar className="!w-3 !h-3" />
                Schedules
              </TabsTrigger>
              <TabsTrigger value="notes" className="!text-xs">
                <FileText className="!w-3 !h-3" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="lms" className="!text-xs">
                <GraduationCap className="!w-3 !h-3" />
                LMS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <OverviewTab
                form={form}
                customFields={customFields}
                statuses={statuses}
              />
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <EmailsTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <OrdersTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="abandoned-carts" className="mt-4">
              <AbandonedCartsTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="conversations" className="mt-4">
              <ConversationsTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="tickets" className="mt-4">
              <TicketsTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <TasksTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="schedules" className="mt-4">
              <SchedulesTab email={form.watch().email || contact?.email || null} />
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <NotesTab contactId={contactId} />
            </TabsContent>

            <TabsContent value="lms" className="mt-4">
              <LmsTab contactId={contactId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageGuard>
  );
}
