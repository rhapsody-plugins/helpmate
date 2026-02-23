import { ProBadge } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useMain } from '@/contexts/MainContext';
import useAbandonedCart from '@/hooks/useAbandonedCart';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { AbandonedCartType } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { User, UserPlus } from 'lucide-react';
import { parseUTCTimestamp, defaultLocale } from '@/pages/crm/contacts/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContactCreateSheet } from '@/pages/crm/contacts/components/ContactCreateSheet';

export default function TabCarts() {
  const { getSettingsMutation, getProQuery } = useSettings();
  const { getAbandonedCarts, sendEmail } = useAbandonedCart();
  const { data: abandonedCarts, isFetching: isFetchingAbandonedCarts } =
    getAbandonedCarts;
  const { data: settings, mutate: getSettings } = getSettingsMutation;
  const { setPage } = useMain();
  const [contactSearchCache, setContactSearchCache] = useState<
    Record<string, number | null>
  >({});
  const [searchingEmails, setSearchingEmails] = useState<Set<string>>(new Set());
  const searchedEmailsRef = useRef<Set<string>>(new Set());
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createSheetEmail, setCreateSheetEmail] = useState<string>('');

  useEffect(() => {
    getSettings('abandoned_cart');
  }, [getSettings]);

  // Pre-search for contacts when abandoned carts load
  useEffect(() => {
    if (!abandonedCarts || abandonedCarts.length === 0) return;

    const searchContacts = async () => {
      // Get unique emails from abandoned carts
      const uniqueEmails = new Set<string>();
      abandonedCarts.forEach((cart: AbandonedCartType) => {
        if (cart.customer?.user_email) {
          uniqueEmails.add(cart.customer.user_email);
        }
      });

      // Search for contacts that haven't been searched yet
      const emailsToSearch = Array.from(uniqueEmails).filter(
        (email) => !searchedEmailsRef.current.has(email)
      );

      if (emailsToSearch.length === 0) return;

      // Mark emails as being searched
      emailsToSearch.forEach((email) => {
        searchedEmailsRef.current.add(email);
      });

      // Search for each email
      for (const email of emailsToSearch) {
        try {
          const response = await api.get<{
            error: boolean;
            data: { contacts: Array<{ id: number; email: string }> };
          }>('/crm/contacts', {
            params: {
              search: email,
              per_page: 100,
            },
          });

          if (!response.data.error && response.data.data?.contacts) {
            const contact = response.data.data.contacts.find(
              (c) => c.email.toLowerCase() === email.toLowerCase()
            );
            if (contact) {
              setContactSearchCache((prev) => ({ ...prev, [email]: contact.id }));
            } else {
              // Contact doesn't exist
              setContactSearchCache((prev) => ({ ...prev, [email]: null }));
            }
          } else {
            // No contacts found
            setContactSearchCache((prev) => ({ ...prev, [email]: null }));
          }
        } catch (error) {
          console.error(error);
          // Error searching, treat as no contact
          setContactSearchCache((prev) => ({ ...prev, [email]: null }));
        }
      }
    };

    searchContacts();
  }, [abandonedCarts]);

  const handleContactClick = useCallback(
    async (email: string) => {
      // Check cache first
      if (contactSearchCache[email] !== undefined) {
        const cachedContactId = contactSearchCache[email];
        if (cachedContactId) {
          sessionStorage.setItem(
            'crm_selected_contact_id',
            cachedContactId.toString()
          );
          setPage('crm-contact-details');
        } else {
          // Contact doesn't exist, open create sheet
          setCreateSheetEmail(email);
          setIsCreateSheetOpen(true);
        }
        return;
      }

      // Mark as searching
      setSearchingEmails((prev) => new Set(prev).add(email));

      // Search for contact by email
      try {
        const response = await api.get<{
          error: boolean;
          data: { contacts: Array<{ id: number; email: string }> };
        }>('/crm/contacts', {
          params: {
            search: email,
            per_page: 100,
          },
        });

        if (!response.data.error && response.data.data?.contacts) {
          const contact = response.data.data.contacts.find(
            (c) => c.email.toLowerCase() === email.toLowerCase()
          );
          if (contact) {
            setContactSearchCache((prev) => ({ ...prev, [email]: contact.id }));
            setSearchingEmails((prev) => {
              const next = new Set(prev);
              next.delete(email);
              return next;
            });
            sessionStorage.setItem(
              'crm_selected_contact_id',
              contact.id.toString()
            );
            setPage('crm-contact-details');
          } else {
            // Contact doesn't exist
            setContactSearchCache((prev) => ({ ...prev, [email]: null }));
            setSearchingEmails((prev) => {
              const next = new Set(prev);
              next.delete(email);
              return next;
            });
            // Contact doesn't exist, open create sheet
            setCreateSheetEmail(email);
            setIsCreateSheetOpen(true);
          }
        } else {
          // Error or no contacts, open create sheet
          setContactSearchCache((prev) => ({ ...prev, [email]: null }));
          setSearchingEmails((prev) => {
            const next = new Set(prev);
            next.delete(email);
            return next;
          });
          setCreateSheetEmail(email);
          setIsCreateSheetOpen(true);
        }
      } catch (error) {
        console.error(error);
        // Error searching, open create sheet
        setContactSearchCache((prev) => ({ ...prev, [email]: null }));
        setSearchingEmails((prev) => {
          const next = new Set(prev);
          next.delete(email);
          return next;
        });
        setCreateSheetEmail(email);
        setIsCreateSheetOpen(true);
      }
    },
    [setPage]
  );

  const columns: ColumnDef<AbandonedCartType>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Customer',
        cell: ({ row }) => {
          const customer = row.original.customer;
          return <div>{customer.display_name}</div>;
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => {
          const customer = row.original.customer;
          return <div>{customer.user_email}</div>;
        },
      },
      {
        accessorKey: 'products',
        header: 'Products',
        cell: ({ row }) => {
          const cart = row.original;
          let cartData: unknown = null;
          try {
            cartData =
              typeof cart.cart_data === 'string'
                ? JSON.parse(cart.cart_data)
                : cart.cart_data;
          } catch (error) {
            // Invalid JSON
            console.error(error);
          }

          // Count items in cart (cart_data can be an object or array)
          let productCount = 0;
          if (cartData) {
            if (Array.isArray(cartData)) {
              productCount = cartData.length;
            } else if (typeof cartData === 'object') {
              productCount = Object.keys(cartData).length;
            }
          }

          return <div>{productCount}</div>;
        },
      },
      {
        accessorKey: 'cart_status',
        header: 'Status',
      },
      {
        accessorKey: 'mails_sent',
        header: 'Emails Sent',
      },
      {
        accessorKey: 'timestamp',
        header: 'Last Activity',
        cell: ({ row }) => {
          const timestamp = +row.original.timestamp;
          return (
            <div>
              {format(parseUTCTimestamp(timestamp), 'PPpp', {
                locale: defaultLocale,
              })}
            </div>
          );
        },
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const email = row.original.customer.user_email;
          const cachedContactId = contactSearchCache[email];
          const isSearching = searchingEmails.has(email);
          const hasCachedResult = cachedContactId !== undefined;
          const hasContact = cachedContactId !== null;

          return (
            <div className="flex gap-2 justify-end items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleContactClick(email)}
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <User className="mr-2 w-4 h-4" />
                    Searching...
                  </>
                ) : hasCachedResult && hasContact ? (
                  <>
                    <User className="mr-2 w-4 h-4" />
                    Contact Details
                  </>
                ) : hasCachedResult && !hasContact ? (
                  <>
                    <UserPlus className="mr-2 w-4 h-4" />
                    Create Contact
                  </>
                ) : (
                  <>
                    <User className="mr-2 w-4 h-4" />
                    Contact Details
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  sendEmail.mutate({
                    id: row.original.id,
                    user_id: row.original.customer.ID,
                    template_id: (settings?.selected_email_template as number) || 1,
                    cart_data: row.original.cart_data,
                  })
                }
              >
                Send Email
              </Button>
            </div>
          );
        },
      },
    ],
    [sendEmail, settings, contactSearchCache, searchingEmails, handleContactClick]
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        {!getProQuery.isLoading && !getProQuery.data && (
          <ProBadge
            topMessage="You paid for the click. Don't lose the cart. Recover sales automatically."
            buttonText="Recover Lost Carts Now"
            tooltipMessage={null}
          />
        )}
        <Card
          className={cn(
            !getProQuery.data &&
              'opacity-50 cursor-not-allowed pointer-events-none'
          )}
        >
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              Abandoned Carts{' '}
              <InfoTooltip message="Review all abandoned carts and their statuses." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFetchingAbandonedCarts ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-32 h-4" />
                      <Skeleton className="w-16 h-4" />
                      <Skeleton className="w-20 h-4" />
                      <Skeleton className="w-32 h-4" />
                      <div className="flex gap-2 ml-auto">
                        <Skeleton className="w-20 h-8" />
                        <Skeleton className="w-24 h-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ReusableTable
                columns={columns}
                data={abandonedCarts}
                className={cn(
                  'w-full',
                  !getProQuery.data &&
                    'opacity-50 cursor-not-allowed pointer-events-none'
                )}
                rightAlignedColumns={['actions']}
                loading={isFetchingAbandonedCarts}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ContactCreateSheet
        open={isCreateSheetOpen}
        onOpenChange={setIsCreateSheetOpen}
        initialEmail={createSheetEmail}
        onContactCreated={(contactId) => {
          // Update cache with the new contact
          if (createSheetEmail) {
            setContactSearchCache((prev) => ({
              ...prev,
              [createSheetEmail]: contactId,
            }));
          }
          // Navigate to contact details
          sessionStorage.setItem(
            'crm_selected_contact_id',
            contactId.toString()
          );
          setPage('crm-contact-details');
        }}
      />
    </div>
  );
}
