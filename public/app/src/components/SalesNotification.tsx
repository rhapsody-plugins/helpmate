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
  const { 'sales-notifications': salesNotifications = false } =
    settings.modules;
  const { sales_notification_template = '1' } = settings.settings;
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
    // Don't proceed if sales notifications are disabled
    if (!salesNotifications) return;
    // Don't proceed if we don't have order data
    if (
      !order ||
      (Array.isArray(order) && order.length === 0) ||
      (typeof order === 'object' && Object.keys(order).length === 0)
    )
      return;
    // Skip if this is the first data load
    if (!initialDataLoaded.current) {
      initialDataLoaded.current = true;
      return;
    }
    // Skip if we've already shown this order
    if (lastOrderId.current === order.time) return;

    const variation = getToastVariation(String(sales_notification_template));
    toast.dismiss();

    toast.custom((id: string | number) => {
      switch (variation) {
        case 'compact':
          return <CompactToast order={order} t={String(id)} />;
        case 'detailed':
          return <DetailedToast order={order} t={String(id)} />;
        default:
          return <DefaultToast order={order} t={String(id)} />;
      }
    });

    // Store the current order ID to prevent duplicates
    // lastOrderId.current = order.time;
  }, [
    lastQueryTime,
    salesNotifications,
    getRecentSaleNotification.data,
    sales_notification_template,
  ]);

  return null;
}
