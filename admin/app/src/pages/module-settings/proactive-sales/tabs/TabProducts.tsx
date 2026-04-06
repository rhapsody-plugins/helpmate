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
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { DiscountedProduct } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SVG_THUMB_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
  );

function discountedProductPlaceholderUrl(): string {
  const base =
    typeof window !== 'undefined'
      ? window.helpmateApiSettings?.plugin_url
      : undefined;
  if (base) {
    return `${base}assets/images/product-placeholder.svg`;
  }
  return SVG_THUMB_PLACEHOLDER;
}

function DiscountedProductThumbnail({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string;
}) {
  const placeholder = discountedProductPlaceholderUrl();
  const initial = imageUrl?.trim() ? imageUrl : placeholder;

  return (
    <img
      src={initial}
      alt={name}
      className="object-cover w-10 h-10 rounded-md bg-muted"
      onError={(e) => {
        const el = e.currentTarget;
        if (el.getAttribute('data-img-fallback') === '1') {
          return;
        }
        el.setAttribute('data-img-fallback', '1');
        el.src = placeholder;
      }}
    />
  );
}

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

  const dokanCheckQuery = useQuery<{ active?: boolean }, Error>({
    queryKey: ['check-dokan', 'proactive-sales-products'],
    queryFn: async () => {
      const response = await api.get('/check-dokan');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const wcfmCheckQuery = useQuery<{ active?: boolean }, Error>({
    queryKey: ['check-wcfm', 'proactive-sales-products'],
    queryFn: async () => {
      const response = await api.get('/check-wcfm');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const dokanIntegrationQuery = useQuery<
    { show_vendor_in_product_lists?: boolean },
    Error
  >({
    queryKey: ['settings', 'dokan_integration', 'proactive-sales'],
    queryFn: async () => {
      const response = await api.get('/settings/dokan_integration');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const wcfmIntegrationQuery = useQuery<
    { show_vendor_in_product_lists?: boolean },
    Error
  >({
    queryKey: ['settings', 'wcfm_integration', 'proactive-sales'],
    queryFn: async () => {
      const response = await api.get('/settings/wcfm_integration');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const multivendorConfigQuery = useQuery<{ selected_provider?: string }, Error>({
    queryKey: ['settings', 'multivendor_integration', 'proactive-sales'],
    queryFn: async () => {
      const response = await api.get('/settings/multivendor_integration');
      return response.data ?? {};
    },
    refetchOnWindowFocus: false,
  });

  const selectedMultivendorProvider =
    multivendorConfigQuery.data?.selected_provider === 'wcfm'
      ? 'wcfm'
      : multivendorConfigQuery.data?.selected_provider === 'dokan'
        ? 'dokan'
        : 'dokan';

  const showVendorOnDiscounted =
    selectedMultivendorProvider === 'wcfm' && wcfmCheckQuery.data?.active === true
      ? wcfmIntegrationQuery.data?.show_vendor_in_product_lists === true
      : selectedMultivendorProvider === 'dokan' &&
        dokanCheckQuery.data?.active === true &&
        dokanIntegrationQuery.data?.show_vendor_in_product_lists === true;

  // ========================================================================
  // MEMOIZED VALUES
  // ========================================================================

  const commonColumns = useMemo<ColumnDef<DiscountedProduct>[]>(
    () => [
      {
        accessorKey: 'image_url',
        header: 'Image',
        cell: ({ row }) => (
          <DiscountedProductThumbnail
            name={row.original.name}
            imageUrl={row.original.image_url}
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

  const columns = useMemo<ColumnDef<DiscountedProduct>[]>(() => {
    const vendorCol: ColumnDef<DiscountedProduct> = {
      id: 'vendor_store',
      header: 'Vendor',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.vendor_store_name?.trim()
            ? row.original.vendor_store_name
            : '—'}
        </span>
      ),
    };
    const tail: ColumnDef<DiscountedProduct>[] = [
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button size="sm" onClick={() => handleAdd(row.original.id)}>
            Add
          </Button>
        ),
      },
    ];
    if (showVendorOnDiscounted) {
      return [...commonColumns, vendorCol, ...tail];
    }
    return [...commonColumns, ...tail];
  }, [commonColumns, handleAdd, showVendorOnDiscounted]);

  const savedColumns = useMemo<ColumnDef<DiscountedProduct>[]>(() => {
    const vendorCol: ColumnDef<DiscountedProduct> = {
      id: 'vendor_store_saved',
      header: 'Vendor',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.vendor_store_name?.trim()
            ? row.original.vendor_store_name
            : '—'}
        </span>
      ),
    };
    const tail: ColumnDef<DiscountedProduct>[] = [
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
    ];
    if (showVendorOnDiscounted) {
      return [...commonColumns, vendorCol, ...tail];
    }
    return [...commonColumns, ...tail];
  }, [commonColumns, handleRemove, showVendorOnDiscounted]);

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