import { ProBadge } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import useCoupons from '@/hooks/useCoupons';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { Coupon } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function TabCoupons() {
  const { getCouponsQuery } = useCoupons();
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();
  const { data: settings = { coupons: [] as number[] }, mutate: getSettings } =
    getSettingsMutation;
  const { data: coupons, isFetching } = getCouponsQuery;
  const { mutate: updateSettings } = updateSettingsMutation;

  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');

  useEffect(() => {
    getSettings('coupons');
  }, []);

  const handleAdd = useCallback(
    (id: number) => {
      const previousCoupons = (settings.coupons as number[]) ?? [];
      updateSettings(
        {
          key: 'coupons',
          data: {
            ...settings,
            coupons: [...previousCoupons, id],
          },
        },
        {
          onSuccess: () => {
            getSettings('coupons');
          },
        }
      );
    },
    [settings, updateSettings, getSettings, settings]
  );

  const handleRemove = useCallback(
    (id: number) => {
      const previousCoupons = (settings.coupons as number[]) ?? [];
      updateSettings(
        {
          key: 'coupons',
          data: {
            ...settings,
            coupons: previousCoupons.filter((coupon) => coupon !== id),
          },
        },
        {
          onSuccess: () => {
            getSettings('coupons');
          },
        }
      );
    },
    [settings, updateSettings, getSettings, settings]
  );

  const commonColumns = useMemo<ColumnDef<Coupon>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Code',
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
      },
      {
        accessorKey: 'discount_type',
        header: 'Discount Type',
      },
      {
        accessorKey: 'description',
        header: 'Description',
      },
      {
        accessorKey: 'date_expires',
        header: 'Expires',
      },
      {
        accessorKey: 'usage_count',
        header: 'Usage Count',
      },
    ],
    []
  );

  const columns = useMemo<ColumnDef<Coupon>[]>(
    () => [
      ...commonColumns,
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button size="sm" onClick={() => handleAdd(row.original.id)}>
            Add
          </Button>
        ),
      },
    ],
    [commonColumns, handleAdd]
  );

  const savedColumns = useMemo<ColumnDef<Coupon>[]>(
    () => [
      ...commonColumns,
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleRemove(row.original.id)}
          >
            Remove
          </Button>
        ),
      },
    ],
    [commonColumns, handleRemove]
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        {!getProQuery.data && (
          <ProBadge
            topMessage="Imagine your chatbot whispering 'Here's 10% off' right before they bounce. That's smart conversion."
            buttonText="Convert Exits into Orders"
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
            <div className="flex justify-between items-center">
              <CardTitle className="items-center text-xl font-bold">
                Available Coupons
              </CardTitle>
              <Input
                placeholder="Search coupons..."
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="w-48 h-6" />
                  <Skeleton className="w-48 h-10" />
                </div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="w-full h-16" />
                  ))}
                </div>
              </div>
            ) : (
              <ReusableTable
                columns={columns}
                data={coupons.filter(
                  (coupon) =>
                    !(settings.coupons as number[]).includes(coupon.id)
                )}
                className="w-full"
                rightAlignedColumns={['actions']}
                loading={isFetching}
                globalFilter={searchFilter}
                onGlobalFilterChange={setSearchFilter}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        {!getProQuery.data && (
          <ProBadge
            topMessage="Imagine your chatbot whispering 'Here's 10% off' right before they bounce. That's smart conversion."
            buttonText="Convert Exits into Orders"
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
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-bold">
                Saved for Coupon Delivery
              </CardTitle>
              <Input
                placeholder="Search saved coupons..."
                value={searchFilterSaved}
                onChange={(event) => setSearchFilterSaved(event.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="w-48 h-6" />
                  <Skeleton className="w-48 h-10" />
                </div>
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="w-full h-16" />
                  ))}
                </div>
              </div>
            ) : (
              <ReusableTable
                columns={savedColumns}
                data={
                  coupons?.filter((coupon) =>
                    (settings.coupons as number[]).includes(coupon.id)
                  ) ?? []
                }
                rightAlignedColumns={['actions']}
                className="w-full"
                loading={isFetching}
                globalFilter={searchFilterSaved}
                onGlobalFilterChange={setSearchFilterSaved}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
