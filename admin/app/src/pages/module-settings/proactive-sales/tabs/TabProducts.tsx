import { ProBadge } from '@/components/ProBadge';
import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Input } from '@/components/ui/input';
import { useDataSource } from '@/hooks/useDataSource';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { DiscountedProduct } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ============================================================================
// COMPONENT
// ============================================================================

export default function TabProducts() {
  // ========================================================================
  // HOOKS & STATE
  // ========================================================================

  const { getDiscountedProductsMutation } = useDataSource();
  const { getSettingsMutation, updateSettingsMutation, getProQuery } =
    useSettings();

  const {
    mutate: getDiscountedProducts,
    isPending: isFetching,
    data: discountedProducts = [],
  } = getDiscountedProductsMutation;
  const {
    data: proactiveSales = { products: [] },
    mutate: getSettings,
  } = getSettingsMutation;
  const { mutate: updateSettings } = updateSettingsMutation;

  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchFilterSaved, setSearchFilterSaved] = useState<string>('');

  // ========================================================================
  // EFFECTS
  // ========================================================================

  useEffect(() => {
    getDiscountedProducts();
    getSettings('proactive_sales');
  }, []);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleAdd = useCallback(
    (id: number) => {
      const previousProducts = (proactiveSales?.products as number[]) || [];
      updateSettings(
        {
          key: 'proactive_sales',
          data: {
            ...proactiveSales,
            products: [...previousProducts, id],
          },
        },
        {
          onSuccess: () => {
            getSettings('proactive_sales');
          },
        }
      );
    },
    [getSettings, proactiveSales, updateSettings]
  );

  const handleRemove = useCallback(
    (id: number) => {
      updateSettings(
        {
          key: 'proactive_sales',
          data: {
            ...proactiveSales,
            products: [
              ...(proactiveSales?.products as number[]).filter(
                (product) => product !== id
              ),
            ],
          },
        },
        {
          onSuccess: () => {
            getSettings('proactive_sales');
          },
        }
      );
    },
    [getSettings, proactiveSales, updateSettings]
  );

  // ========================================================================
  // MEMOIZED VALUES
  // ========================================================================

  const commonColumns = useMemo<ColumnDef<DiscountedProduct>[]>(
    () => [
      {
        accessorKey: 'image_url',
        header: 'Image',
        cell: ({ row }) => (
          <img
            src={row.original.image_url}
            alt={row.original.name}
            className="object-cover w-10 h-10 rounded-md"
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'regular_price',
        header: 'Regular Price',
        cell: ({ row }) => (
          <span
            className="text-sm font-medium"
            dangerouslySetInnerHTML={{ __html: row.original.regular_price }}
          />
        ),
      },
      {
        accessorKey: 'sale_price',
        header: 'Sale Price',
        cell: ({ row }) => (
          <span
            className="text-sm font-medium"
            dangerouslySetInnerHTML={{ __html: row.original.sale_price }}
          />
        ),
      },
      {
        accessorKey: 'discount_percentage',
        header: 'Discount Percentage',
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {row.original.discount_percentage}%
          </span>
        ),
      },
      {
        accessorKey: 'stock_status',
        header: 'Stock Status',
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.stock_status === 'instock'
                ? 'outline'
                : 'destructive'
            }
            color={row.original.stock_status === 'instock' ? 'green' : 'red'}
          >
            {row.original.stock_status === 'instock'
              ? 'In Stock'
              : 'Out of Stock'}
          </Badge>
        ),
      },
    ],
    []
  );

  const columns = useMemo<ColumnDef<DiscountedProduct>[]>(
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

  const savedColumns = useMemo<ColumnDef<DiscountedProduct>[]>(
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

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Available Products Card */}
      <div className="relative">
        {!getProQuery.data && (
          <ProBadge
            topMessage="It's like having a sales rep in every visitor's pocket, ready with the perfect pitch."
            buttonText="Boost Sales Conversations"
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
              <div>
                <CardTitle className="flex gap-1 items-center text-xl font-bold">
                  Discounted Products
                  <InfoTooltip message="Add discounted products for proactive sales." />
                </CardTitle>
              </div>
              <Input
                placeholder="Search products..."
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ReusableTable
              columns={columns}
              data={discountedProducts?.filter(
                (product) =>
                  !(proactiveSales?.products as number[])?.includes(
                    product.id
                  )
              )}
              className="w-full"
              rightAlignedColumns={['actions']}
              loading={isFetching}
              globalFilter={searchFilter}
              onGlobalFilterChange={setSearchFilter}
            />
          </CardContent>
        </Card>
      </div>

      {/* Saved Products Card */}
      <div className="relative">
        {!getProQuery.data && (
          <ProBadge
            topMessage="It's like having a sales rep in every visitor's pocket, ready with the perfect pitch."
            buttonText="Boost Sales Conversations"
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
                Saved for Proactive Sales
              </CardTitle>
              <Input
                placeholder="Search saved products..."
                value={searchFilterSaved}
                onChange={(event) => setSearchFilterSaved(event.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ReusableTable
              columns={savedColumns}
              data={
                discountedProducts?.filter((product) =>
                  (proactiveSales?.products as number[]).includes(product.id)
                ) || []
              }
              rightAlignedColumns={['actions']}
              className="w-full"
              loading={isFetching}
              globalFilter={searchFilterSaved}
              onGlobalFilterChange={setSearchFilterSaved}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}