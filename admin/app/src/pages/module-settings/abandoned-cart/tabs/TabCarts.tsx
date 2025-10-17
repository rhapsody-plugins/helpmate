import { ProBadge } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import useAbandonedCart from '@/hooks/useAbandonedCart';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { AbandonedCartType } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useEffect, useMemo } from 'react';

export default function TabCarts() {
  const { getSettingsMutation, getProQuery } = useSettings();
  const { getAbandonedCarts, sendEmail } = useAbandonedCart();
  const { data: abandonedCarts, isFetching: isFetchingAbandonedCarts } =
    getAbandonedCarts;
  const { data: settings, mutate: getSettings } = getSettingsMutation;

  useEffect(() => {
    getSettings('abandoned_cart');
  }, [getSettings]);

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
          return <div>{format(new Date(timestamp * 1000), 'PPpp')}</div>;
        },
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return (
            <div className="flex gap-2 justify-end items-center">
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
    [sendEmail, settings]
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        {!getProQuery.data && (
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
    </div>
  );
}
