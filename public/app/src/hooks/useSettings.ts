import api from '@/lib/axios';
import { BotSettings } from '@/types';
import { useQuery } from '@tanstack/react-query';

export const useSettings = () => {
  const getSettingsQuery = useQuery<BotSettings, Error>({
    queryKey: ['bot-settings'],
    queryFn: async () => {
      const res = await api.get('/bot-settings');
      return res.data;
    },
    initialData: {
      is_pro: false,
      is_woocommerce_active: false,
      modules: {},
      customization: {},
      proactive_sales_products: [],
      quick_options: [],
      settings: {
        welcome_message: [],
        refund_return_reasons: [],
        order_tracker_email_required: false,
        order_tracker_phone_required: false,
        sales_notification_show_frequency: 10000,
        sales_notification_hide_frequency: 5000,
        sales_notification_template: '1',
        proactive_sales_show_frequency: 10000,
        proactive_sales_hide_frequency: 5000,
        proactive_sales_template: '1',
        collect_lead: false,
        lead_form_fields: [],
        exit_intent_coupon: '',
        coupon_collect_lead: false,
        welcome_message_sound: true,
        show_ticket_creation_option: true,
      },
    },
  });

  return {
    getSettingsQuery,
  };
};
