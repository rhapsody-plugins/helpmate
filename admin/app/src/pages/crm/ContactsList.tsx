import Loading from '@/components/Loading';
import PageHeader from '@/components/PageHeader';
import PageGuard from '@/components/PageGuard';
import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMain } from '@/contexts/MainContext';
import { useCrm } from '@/hooks/useCrm';
import { useSettings } from '@/hooks/useSettings';
import { __, sprintf } from '@/lib/utils';
import { Contact, ContactFilters } from '@/types/crm';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { defaultLocale } from './contacts/utils';
import { ContactCreateSheet } from './contacts/components/ContactCreateSheet';
import { Eye, Plus, Search, Trash2, User } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const { data: integrationSourceOptions = [] } =
    useContactIntegrationSourceOptions();
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
      header: __('Email'),
      cell: ({ row }) => (
        <div className="font-medium">{row.original.email}</div>
      ),
    },
    {
      id: 'full_name',
      header: __('Full Name'),
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
      header: __('Phone'),
      cell: ({ row }) => <div>{row.original.phone || '-'}</div>,
    },
    {
      accessorKey: 'status',
      header: __('Status'),
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: 'created_at',
      header: __('Created'),
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
      header: __('Actions'),
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
      confirm(
        sprintf(
          /* translators: %s: Contact email address */
          __('Are you sure you want to delete contact "%s"?'),
          contact.email
        )
      )
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
          title={sprintf(
            /* translators: %d: Contact count */
            __('Contacts (%d)'),
            contactCount
          )}
          rightActions={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild={!isAddDisabled}>
                  {isAddDisabled ? (
                    <div>
                      <Button
                        onClick={handleAddContact}
                        size="sm"
                        disabled={isAddDisabled}
                      >
                        <Plus className="mr-2 w-4 h-4" />
                        {__('Add Contact')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleAddContact}
                      size="sm"
                      disabled={isAddDisabled}
                    >
                      <Plus className="mr-2 w-4 h-4" />
                      {__('Add Contact')}
                    </Button>
                  )}
                </TooltipTrigger>
                {isAddDisabled && (
                  <TooltipContent>
                    <p>
                      {__(
                        'Non-Pro users are limited to 50 contacts. Upgrade to Pro for unlimited contacts.'
                      )}
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
              <CardTitle className="!text-lg !my-0">{__('Contacts')}</CardTitle>
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
                      <SelectItem value="all">{__('All Statuses')}</SelectItem>
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
                      <SelectItem value="all">
                        {__('All Integrations')}
                      </SelectItem>
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
                    <p className="text-muted-foreground">
                      {__('No contacts found')}
                    </p>
                    <Button
                      onClick={handleAddContact}
                      variant="outline"
                      className="mt-4"
                    >
                      <Plus className="mr-2 w-4 h-4" />
                      {__('Add Your First Contact')}
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
