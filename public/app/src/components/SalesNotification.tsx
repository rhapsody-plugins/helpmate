import {
  CompactToast,
  DefaultToast,
  DetailedToast,
} from '@/components/SalesNotificationVariations';
import { useSalesNotification } from '@/hooks/useSalesNotification';
import { useSettings } from '@/hooks/useSettings';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ToastVariation = 'default' | 'compact' | 'detailed';

const getToastVariation = (template: string): ToastVariation => {
  switch (template) {
    case '2':
      return 'compact';
    case '3':
      return 'detailed';
    default:
      return 'default';
  }
};

export default function SalesNotification() {
  const { data: settings } = useSettings().getSettingsQuery;
  const salesNotifications = settings?.modules?.['sales-notifications'] ?? false;
  const sales_notification_template =
    (settings?.settings?.sales_notification_template as string) ?? '1';
  const { getRecentSaleNotification } = useSalesNotification();
  const [lastQueryTime, setLastQueryTime] = useState(Date.now());
  const initialDataLoaded = useRef(false);
  const lastOrderId = useRef<string | null>(null);

  useEffect(() => {
    if (getRecentSaleNotification.isFetching) {
      setLastQueryTime(Date.now());
    }
  }, [getRecentSaleNotification.isFetching]);

  useEffect(() => {
    const order = getRecentSaleNotification.data;
    if (!salesNotifications) return;
    if (
      !order ||
      (typeof order === 'object' && Object.keys(order).length === 0)
    ) {
      return;
    }
    if (!initialDataLoaded.current) {
      initialDataLoaded.current = true;
      return;
    }
    if (lastOrderId.current === order.time) return;

    const variation = getToastVariation(String(sales_notification_template));
    toast.dismiss();

    toast.custom((id: string | number) => {
      const orderWithImage = {
        ...order,
        product_image: order.product_image || '',
      };
      switch (variation) {
        case 'compact':
          return <CompactToast order={orderWithImage} t={String(id)} />;
        case 'detailed':
          return <DetailedToast order={orderWithImage} t={String(id)} />;
        default:
          return <DefaultToast order={orderWithImage} t={String(id)} />;
      }
    });

    lastOrderId.current = order.time;
  }, [
    lastQueryTime,
    salesNotifications,
    getRecentSaleNotification.data,
    sales_notification_template,
  ]);

  return null;
}
