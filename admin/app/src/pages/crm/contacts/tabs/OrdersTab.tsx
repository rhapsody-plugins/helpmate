import { ReusableTable } from '@/components/ReusableTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCrm } from '@/hooks/useCrm';
import { ManualOrder, Order, WooCommerceOrder } from '@/types/crm';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, ShoppingBag } from 'lucide-react';
import { defaultLocale } from '../utils';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { manualOrderFormSchema, type ManualOrderFormData } from '../schemas';
import { parseUTCDate } from '../utils';

interface OrdersTabProps {
  contactId: number | null;
}

const PAGE_SIZE = 10;

// WooCommerce Icon Component
const WooCommerceIcon = ({ className = 'w-4 h-4' }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 42 32"
      className={className}
    >
      <path
        fill="currentColor"
        d="M23.915 11.97c-.571-.058-1.623.236-2.104 2.53 0 1.412.33 2.235.872 2.53.992.293 2.164-1 2.164-2.412.03-.912.09-2.118-.932-2.648m7.698 0c-.572-.058-1.624.236-2.105 2.53 0 1.412.33 2.235.872 2.53.992.293 2.165-1 2.165-2.412.06-.912.09-2.118-.932-2.648"
      />
      <path
        fill="currentColor"
        d="M32.816 7H8.85c-1.924 0-3.518 1.53-3.518 3.441V18.5c0 1.882 1.564 3.441 3.518 3.441h23.965c1.924 0 3.517-1.53 3.517-3.441v-8.088C36.334 8.529 34.74 7 32.817 7M16.008 19.765S14.354 17.617 13.933 16c-.421-1.618-.481-.883-.481-.883s-1.323 2.912-2.706 4.765-2.075-.912-2.075-.912c-.481-.558-1.864-8.794-1.864-8.794.782-2.088 2.105-.382 2.105-.382l1.353 6.706s2.074-4.118 2.736-5.147c.691-1.059 1.864-.765 1.954.323s1.233 4.118 1.233 4.118c.09-3.147 1.413-6.147 1.624-6.647.21-.5 2.345-1.059 1.954.941-.932 2.236-1.864 6.97-1.624 9.559-.6 1.97-2.134.118-2.134.118m8.66-1.06c-.632.295-2.978 1.854-4.631-1.676-1.053-3.559 1.262-6.176 1.262-6.176s3.037-2.53 5.112.823c1.654 3.677-1.112 6.736-1.744 7.03m7.727 0c-.632.295-2.977 1.854-4.63-1.676-1.053-3.559 1.262-6.176 1.262-6.176s3.037-2.53 5.111.823c1.654 3.677-1.112 6.736-1.743 7.03"
      />
      <path
        fill="currentColor"
        d="M20.187 21.912 25.569 25l-1.112-3.088-3.097-.853z"
      />
    </svg>
  );
};

export function OrdersTab({ contactId }: OrdersTabProps) {
  const {
    useContactOrders,
    createManualOrderMutation,
    useWooCommerceNewOrderUrl,
  } = useCrm();
  const { data: orders, isLoading } = useContactOrders(
    contactId,
    contactId !== null
  );
  const { data: wooCommerceNewOrderUrl, refetch: fetchWooCommerceUrl } =
    useWooCommerceNewOrderUrl();
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when contactId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contactId]);

  const orderForm = useForm<ManualOrderFormData>({
    resolver: zodResolver(manualOrderFormSchema),
    defaultValues: {
      product_name: '',
      quantity: 1,
      price: 0,
      order_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    },
  });

  const handleCreateOrder = (data: ManualOrderFormData) => {
    if (!contactId) return;
    createManualOrderMutation.mutate(
      { contactId, data },
      {
        onSuccess: () => {
          setShowAddOrder(false);
          orderForm.reset({
            product_name: '',
            quantity: 1,
            price: 0,
            order_date: new Date().toISOString().split('T')[0],
            status: 'pending',
            notes: '',
          });
        },
      }
    );
  };

  const handleAddWooCommerceOrder = async () => {
    try {
      const result = await fetchWooCommerceUrl();
      const url = result.data || wooCommerceNewOrderUrl;
      if (url) {
        window.location.href = url;
        return;
      }
    } catch (error) {
      console.error(error);
      // Continue to fallback
    }
    // Fallback to constructing URL manually if API fails or returns no URL
    const fallbackUrl = `${window.location.origin}/wp-admin/admin.php?page=wc-orders&action=new`;
    window.location.href = fallbackUrl;
  };

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: 'order_number',
      header: 'Order #',
      cell: ({ row }) => {
        const isManual = row.original.order_type === 'manual';
        return (
          <div className="flex gap-2 items-center font-medium">
            {!isManual && (
              <WooCommerceIcon className="!w-5 !h-5 text-muted-foreground" />
            )}
            {isManual ? row.original.order_number : `#${row.original.order_number}`}
          </div>
        );
      },
    },
    {
      accessorKey: 'order_type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={row.original.order_type === 'manual' ? 'secondary' : 'default'}>
          {row.original.order_type === 'manual' ? 'Manual' : 'WooCommerce'}
        </Badge>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => {
        const isManual = row.original.order_type === 'manual';
        if (isManual) {
          const manualOrder = row.original as ManualOrder;
          return (
            <span className="text-sm">
              {manualOrder.product_name} × {manualOrder.quantity}
            </span>
          );
        }
        return <span className="text-sm text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => {
        const isManual = row.original.order_type === 'manual';
        const manualOrder = isManual ? (row.original as ManualOrder) : null;
        const wooOrder = !isManual ? (row.original as WooCommerceOrder) : null;

        return formatDistanceToNow(
          isManual && manualOrder
            ? parseUTCDate(manualOrder.order_date)
            : wooOrder
            ? parseUTCDate(wooOrder.date_created)
            : new Date(),
          { addSuffix: true, locale: defaultLocale }
        );
      },
    },
    {
      id: 'actions',
      header: '',
      meta: { className: 'text-right' },
      cell: ({ row }) => {
        const isManual = row.original.order_type === 'manual';
        if (!isManual) {
          const wooOrder = row.original as WooCommerceOrder;
          return (
            <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
              <a
                href={wooOrder.edit_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex justify-center items-center w-8 h-8 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          );
        }
        return <div className="flex gap-1 justify-end" />;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="!text-lg !my-0">
              Orders ({orders?.length || 0})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={handleAddWooCommerceOrder}
                size="sm"
                variant="outline"
              >
                <WooCommerceIcon className="!w-6 !h-6" />
                Create WooCommerce Order
              </Button>
              <Button onClick={() => setShowAddOrder(true)} size="sm">
                <ShoppingBag className="w-4 h-4" />
                Create Manual Order
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ReusableTable
            columns={columns}
            data={orders || []}
            loading={isLoading}
            showPagination={true}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {showAddOrder && (
        <Card>
          <CardHeader>
            <CardTitle>Create Manual Order</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...orderForm}>
              <form
                onSubmit={orderForm.handleSubmit(handleCreateOrder)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={orderForm.control}
                    name="product_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={orderForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 1)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={orderForm.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={orderForm.control}
                    name="order_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={orderForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">
                              Processing
                            </SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={orderForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddOrder(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Order</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
