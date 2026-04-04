import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCrm } from '@/hooks/useCrm';
import useAbandonedCart from '@/hooks/useAbandonedCart';
import { AbandonedCartType } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { parseUTCTimestamp, defaultLocale } from '../utils';
import { Eye } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/axios';
import { ContentPreviewSheet } from './ContentPreviewSheet';

interface AbandonedCartsTabProps {
  contactId: number | null;
}

interface CartItem {
  key: string;
  product_id?: number;
  variation_id?: number;
  quantity?: number;
}

const PAGE_SIZE = 10;

// Helper function to parse cart items
function parseCartItems(cart: AbandonedCartType): CartItem[] {
  let cartData: unknown = null;
  try {
    cartData =
      typeof cart.cart_data === 'string'
        ? JSON.parse(cart.cart_data)
        : cart.cart_data;
  } catch {
    return [];
  }

  const cartItems: CartItem[] = [];
  if (cartData) {
    if (Array.isArray(cartData)) {
      cartData.forEach((item: unknown, index: number) => {
        if (item && typeof item === 'object') {
          const cartItem = item as {
            key?: string;
            product_id?: number;
            variation_id?: number;
            quantity?: number;
          };
          cartItems.push({
            key: cartItem.key || String(index),
            product_id: cartItem.product_id,
            variation_id: cartItem.variation_id,
            quantity: cartItem.quantity || 1,
          });
        }
      });
    } else if (typeof cartData === 'object') {
      Object.entries(cartData).forEach(([key, item]: [string, unknown]) => {
        if (item && typeof item === 'object') {
          const cartItem = item as {
            product_id?: number;
            variation_id?: number;
            quantity?: number;
          };
          cartItems.push({
            key,
            product_id: cartItem.product_id,
            variation_id: cartItem.variation_id,
            quantity: cartItem.quantity || 1,
          });
        }
      });
    }
  }
  return cartItems;
}

export function AbandonedCartsTab({ contactId }: AbandonedCartsTabProps) {
  const { useContact } = useCrm();
  const { data: contact, isLoading: contactLoading } = useContact(
    contactId,
    contactId !== null
  );
  const contactEmail = contact?.email?.trim() ?? '';
  const { getAbandonedCarts } = useAbandonedCart({
    search: contactEmail,
    perPage: 100,
    page: 1,
    listEnabled: contactId !== null && contactEmail !== '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [previewCart, setPreviewCart] = useState<AbandonedCartType | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [productNames, setProductNames] = useState<Record<number, string>>({});

  const abandonedCarts = getAbandonedCarts.data?.carts ?? [];
  const { isFetching: isFetchingCarts } = getAbandonedCarts;

  // Exact email match (search is substring on server)
  const filteredCarts = useMemo(() => {
    if (!contact?.email) {
      return [];
    }
    const em = contact.email.toLowerCase();
    return abandonedCarts.filter(
      (cart: AbandonedCartType) =>
        cart.customer?.user_email?.toLowerCase() === em
    );
  }, [contact?.email, abandonedCarts]);

  // Reset to page 1 when filtered carts change
  useEffect(() => {
    setCurrentPage(1);
  }, [contact?.email]);

  // Fetch product names for preview cart
  useEffect(() => {
    if (!previewCart) {
      return;
    }

    const fetchProductNames = async () => {
      const cartItems = parseCartItems(previewCart);
      const productIds = new Set<number>();
      cartItems.forEach((item) => {
        if (item.product_id) {
          productIds.add(item.product_id);
        }
        if (item.variation_id) {
          productIds.add(item.variation_id);
        }
      });

      if (productIds.size > 0) {
        try {
          const idsArray = Array.from(productIds);
          const idsParam = idsArray.join(',');
          const response = await api.get<{
            error: boolean;
            data: Record<string, string | null>;
          }>('/products/names', { params: { ids: idsParam } });

          if (response.data && !response.data.error && response.data.data) {
            const fetchedNames: Record<number, string> = {};
            Object.entries(response.data.data).forEach(([id, name]) => {
              const productId = parseInt(id, 10);
              if (!isNaN(productId)) {
                if (name && typeof name === 'string') {
                  fetchedNames[productId] = name;
                } else {
                  fetchedNames[productId] = `Product #${productId}`;
                }
              }
            });
            setProductNames(fetchedNames);
          } else {
            const fallbackNames: Record<number, string> = {};
            idsArray.forEach((id) => {
              fallbackNames[id] = `Product #${id}`;
            });
            setProductNames(fallbackNames);
          }
        } catch {
          const fallbackNames: Record<number, string> = {};
          Array.from(productIds).forEach((id) => {
            fallbackNames[id] = `Product #${id}`;
          });
          setProductNames(fallbackNames);
        }
      }
    };

    fetchProductNames();
  }, [previewCart]);

  const handlePreviewCart = (cart: AbandonedCartType, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewCart(cart);
    setIsPreviewOpen(true);
  };

  const columns: ColumnDef<AbandonedCartType>[] = [
    {
      accessorKey: 'id',
      header: 'Cart #',
      cell: ({ row }) => (
        <span className="font-medium">#{row.original.id}</span>
      ),
    },
    {
      accessorKey: 'cart_status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.cart_status}
        </Badge>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      cell: ({ row }) => {
        const itemCount = parseCartItems(row.original).length;
        return <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>;
      },
    },
    {
      accessorKey: 'mails_sent',
      header: 'Emails Sent',
      cell: ({ row }) => <span>{row.original.mails_sent}</span>,
    },
    {
      accessorKey: 'timestamp',
      header: 'Date',
      cell: ({ row }) => {
        const timestamp = +row.original.timestamp;
        return format(parseUTCTimestamp(timestamp), 'PPpp', {
          locale: defaultLocale,
        });
      },
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
            onClick={(e) => handlePreviewCart(row.original, e)}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const isLoading = contactLoading || isFetchingCarts;

  // Build preview content
  const previewContent = previewCart ? (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Status</span>
          <div>
            <Badge variant="outline">{previewCart.cart_status}</Badge>
          </div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Date</span>
          <div className="font-medium">
            {format(parseUTCTimestamp(+previewCart.timestamp), 'PPpp', {
              locale: defaultLocale,
            })}
          </div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Emails Sent</span>
          <div className="font-medium">{previewCart.mails_sent}</div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <div className="mb-3 font-semibold">Products</div>
        <div className="space-y-3">
          {parseCartItems(previewCart).map((item) => {
            const productId = item.variation_id || item.product_id;
            const productName = productId
              ? productNames[productId] || `Product #${productId}`
              : 'Product';

            return (
              <div
                key={item.key}
                className="flex justify-between items-center p-3 rounded-lg bg-muted"
              >
                <div>
                  <div className="font-medium">{productName}</div>
                  {item.variation_id && item.product_id && (
                    <div className="text-xs text-muted-foreground">
                      Variation
                    </div>
                  )}
                </div>
                <div className="font-medium">Qty: {item.quantity || 1}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="!text-lg !my-0">
            Abandoned Carts ({filteredCarts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={columns}
            data={filteredCarts}
            loading={isLoading}
            showPagination={true}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <ContentPreviewSheet
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        title={previewCart ? `Cart #${previewCart.id}` : 'Cart Preview'}
        content={previewContent}
      />
    </>
  );
}
