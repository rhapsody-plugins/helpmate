import { ActivityLayout } from '@/components/layout/ActivityLayout';
import PageGuard from '@/components/PageGuard';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMain } from '@/contexts/MainContext';
import useActivity from '@/hooks/useActivity';
import { useCrm } from '@/hooks/useCrm';
import { cn } from '@/lib/utils';
import { ContactCreateSheet } from '@/pages/crm/contacts/components/ContactCreateSheet';
import { Lead } from '@/types';
import { Pencil, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const formatSource = (source: string | undefined): string => {
  if (!source) return '';
  if (source === 'facebook_messenger') return 'Facebook';
  return source.replace(/_/g, ' ');
};

const formatDateTime = (timestamp: string | undefined): string => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return timestamp;
  }
};

export default function Leads() {
  const { useGetLeads, createContactFromLead, assignContactToLead } = useActivity();
  const { useContacts, useContact } = useCrm();
  const { setPage: setMainPage } = useMain();
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showContactSheet, setShowContactSheet] = useState(false);

  // Contact reassignment state
  const [contactSearch, setContactSearch] = useState('');
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  const getLeads = useGetLeads(page, perPage);
  const { data: leads, isPending: leadsLoading, refetch: refetchLeads } = getLeads;

  // Fetch contacts for search
  const { data: contactsData } = useContacts({ search: contactSearch }, 1, 50);
  const contacts = contactsData?.contacts || [];

  // Fetch linked contact info
  const { data: linkedContact } = useContact(
    selectedLead?.contact_id ?? null,
    !!selectedLead?.contact_id
  );

  // Handle contact reassignment
  const handleAssignContact = async (newContactId: number) => {
    if (!selectedLead) return;

    await assignContactToLead.mutateAsync({
      lead_id: selectedLead.id,
      contact_id: newContactId,
    });

    // Update selected lead with new contact_id
    setSelectedLead({
      ...selectedLead,
      contact_id: newContactId,
    });

    setContactPopoverOpen(false);
    setContactSearch('');

    // Refresh leads list
    await refetchLeads();
  };

  const isLoading = Boolean(leadsLoading);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchLeads();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (leads) {
      // If we have a selected lead, try to find it in the updated list and keep it selected
      if (selectedLead) {
        const updatedLead = leads.leads.find(
          (lead: Lead) => lead.id === selectedLead.id
        );
        if (updatedLead) {
          setSelectedLead(updatedLead);
          return;
        }
      }
      // Otherwise, select the first lead
      setSelectedLead(leads.leads[0] ?? null);
    }
  }, [leads, selectedLead]);

  const sidebarContent = useMemo(() => {
    return (leads?.leads ?? []).map((lead: Lead) => (
      <SidebarMenuItem key={String(lead.id)} className="pb-2">
        <SidebarMenuButton
          onClick={() => setSelectedLead(lead)}
          isActive={selectedLead?.id === lead.id}
          className={cn('p-3 h-auto rounded-none')}
        >
          <div className={cn('flex flex-col items-start')}>
            <span className="font-medium text-sm truncate max-w-[180px]">
              {lead.name}
            </span>
            <div className="flex gap-2 items-center">
              <span className="text-xs">{formatDateTime(lead.timestamp)}</span>
              {lead.source && (
                <Badge variant="outline" className="text-xs capitalize">
                  {formatSource(lead.source)}
                </Badge>
              )}
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));
  }, [leads?.leads, selectedLead?.id]);

  const handleCreateContact = async () => {
    if (!selectedLead) return;

    // If email is missing, open the contact creation sheet to add it manually
    if (!selectedLead.metadata?.email) {
      setShowContactSheet(true);
      return;
    }

    try {
      const result = await createContactFromLead.mutateAsync({
        lead_id: selectedLead.id,
      });

      if (result.contact_id) {
        // Update the selected lead immediately with the new contact_id
        setSelectedLead({
          ...selectedLead,
          contact_id: result.contact_id,
        });

        // Refresh leads list in the background
        await refetchLeads();
      }
    } catch (error: unknown) {
      console.error('Error creating contact from lead:', error);
      // Error handling is done in the mutation
    }
  };

  const handleContactCreated = (contactId: number) => {
    if (!selectedLead) return;

    // Update the selected lead with the new contact_id
    setSelectedLead({
      ...selectedLead,
      contact_id: contactId,
    });

    // Refresh leads list
    refetchLeads();
    setShowContactSheet(false);
  };

  const handleViewContact = () => {
    if (selectedLead?.contact_id) {
      sessionStorage.setItem(
        'crm_selected_contact_id',
        selectedLead.contact_id.toString()
      );
      setMainPage('crm-contact-details');
    }
  };

  const mainContent = (
    <div className="overflow-y-auto flex-1 p-4 -ml-3 h-full">
      {selectedLead ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{selectedLead.name}</CardTitle>
                  <CardDescription>
                    Created on {formatDateTime(selectedLead.timestamp)}
                  </CardDescription>
                </div>
                {selectedLead.source && (
                  <Badge variant="outline" className="capitalize">{formatSource(selectedLead.source)}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedLead.contact_id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="font-medium">Contact</div>
                      <div className="flex flex-wrap gap-2 items-center min-w-0">
                        {linkedContact ? (
                          <span className="min-w-0 truncate">
                            {linkedContact.first_name} {linkedContact.last_name}
                            {linkedContact.email && ` (${linkedContact.email})`}
                          </span>
                        ) : (
                          <span>#{selectedLead.contact_id}</span>
                        )}
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleViewContact}
                          >
                            View Contact
                          </Button>
                          <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="w-8 h-8"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </PopoverTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Change Contact</TooltipContent>
                            </Tooltip>
                            <PopoverContent className="p-0 w-72" align="end">
                            <Command>
                              <CommandInput
                                placeholder="Search contacts..."
                                value={contactSearch}
                                onValueChange={setContactSearch}
                              />
                              <CommandEmpty>No contacts found.</CommandEmpty>
                              <CommandGroup className="overflow-y-auto max-h-64">
                                {contacts
                                  .filter((c) => c.id !== selectedLead.contact_id)
                                  .map((contact) => (
                                    <CommandItem
                                      key={contact.id}
                                      onSelect={() => handleAssignContact(contact.id)}
                                    >
                                      <Checkbox
                                        checked={false}
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
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="font-medium">Contact</div>
                    <Button
                      onClick={handleCreateContact}
                      disabled={createContactFromLead.isPending}
                      className="w-full"
                    >
                      <UserPlus className="mr-2 w-4 h-4" />
                      {createContactFromLead.isPending
                        ? 'Creating Contact...'
                        : 'Create Contact from Lead'}
                    </Button>
                    {!selectedLead.metadata?.email && (
                      <p className="text-sm text-muted-foreground">
                        Email will be required when creating the contact
                      </p>
                    )}
                  </div>
                )}
                {Object.entries(selectedLead.metadata || {}).map(
                  ([key, value]) =>
                    !!value && (
                      <div key={key} className="grid grid-cols-2 gap-4">
                        <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                        <div>{String(value)}</div>
                      </div>
                    )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No leads available.
        </div>
      )}
    </div>
  );

  return (
    <PageGuard page="crm-leads">
      <div className="flex flex-col gap-0">
        <PageHeader title="Leads" />

        <div className="p-6">
          <ActivityLayout
            title="Leads"
            description="View and manage customer leads."
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            sidebarContent={sidebarContent}
            mainContent={mainContent}
            isLoading={isLoading}
            pagination={
              leads?.pagination
                ? {
                    currentPage: leads.pagination.current_page,
                    totalPages: leads.pagination.total_pages,
                    onPageChange: setPage,
                  }
                : undefined
            }
          />
        </div>
      </div>

      <ContactCreateSheet
        open={showContactSheet}
        onOpenChange={setShowContactSheet}
        initialEmail={selectedLead?.metadata?.email as string || ''}
        initialFirstName={selectedLead?.name?.split(' ')[0] || ''}
        initialLastName={selectedLead?.name?.split(' ').slice(1).join(' ') || ''}
        onContactCreated={handleContactCreated}
        leadId={selectedLead?.id}
      />
    </PageGuard>
  );
}
