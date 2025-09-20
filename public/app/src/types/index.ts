import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from '@/components/ui/card';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSettings } from '@/hooks/useSettings';
import { useQuery, useMutation } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom';
import * as reactHookForm from 'react-hook-form';
import { toast } from 'sonner';

export type ReactType = typeof React;
export type ReactDOMType = typeof ReactDOM;
export type UseQueryType = typeof useQuery;
export type UseMutationType = typeof useMutation;
export type ToastType = typeof toast;
export type ReactHookFormType = typeof reactHookForm;
export type UseSettingsType = typeof useSettings;
export type ToastVariationType = 'default' | 'compact' | 'detailed';
export type ButtonType = typeof Button;
export type CardType = typeof Card;
export type CardHeaderType = typeof CardHeader;
export type CardTitleType = typeof CardTitle;
export type CardDescriptionType = typeof CardDescription;
export type CardActionType = typeof CardAction;
export type FormType = typeof Form;
export type FormControlType = typeof FormControl;
export type FormFieldType = typeof FormField;
export type FormItemType = typeof FormItem;
export type FormLabelType = typeof FormLabel;
export type FormMessageType = typeof FormMessage;
export type InputType = typeof Input;
export type SelectType = typeof Select;
export type SelectContentType = typeof SelectContent;
export type SelectItemType = typeof SelectItem;
export type SelectTriggerType = typeof SelectTrigger;
export type SelectValueType = typeof SelectValue;
export type TextareaType = typeof Textarea;
export type TooltipType = typeof Tooltip;
export type TooltipContentType = typeof TooltipContent;
export type TooltipProviderType = typeof TooltipProvider;
export type TooltipTriggerType = typeof TooltipTrigger;

export interface HelpmateWindowType {
  React: ReactType;
  ReactDOM: ReactDOMType;
  useQuery: UseQueryType;
  useMutation: UseMutationType;
  sonner: ToastType;
  reactHookForm: ReactHookFormType;
  useSettings: UseSettingsType;
  components: {
    Button: ButtonType;
    Card: {
      Card: CardType;
      CardHeader: CardHeaderType;
      CardTitle: CardTitleType;
      CardDescription: CardDescriptionType;
      CardAction: CardActionType;
    };
    Form: {
      Form: FormType;
      FormControl: FormControlType;
      FormField: FormFieldType;
      FormItem: FormItemType;
      FormLabel: FormLabelType;
      FormMessage: FormMessageType;
    };
    Input: InputType;
    Select: {
      Select: SelectType;
      SelectContent: SelectContentType;
      SelectItem: SelectItemType;
      SelectTrigger: SelectTriggerType;
      SelectValue: SelectValueType;
    };
    Textarea: TextareaType;
    Tooltip: {
      Tooltip: TooltipType;
      TooltipContent: TooltipContentType;
      TooltipProvider: TooltipProviderType;
      TooltipTrigger: TooltipTriggerType;
    };
  };
}

export interface HelpmateProWindowType {
  isPro: boolean;
  components: {
    ImageSearch: React.ComponentType<ImageSearchProps> | null;
    ProactiveSales: React.ComponentType<ProactiveSalesProps> | null;
    ExitIntentCoupon: React.ComponentType | null;
    OrderTracker: React.ComponentType<OrderTrackerProps> | null;
    RefundReturn: React.ComponentType<RefundReturnProps> | null;
  };
}

export interface Product {
  id: number;
  name: string;
  price: string;
  image: string;
  regular_price: string;
  sale_price: string;
  discount_percentage: number;
  stock_status: string;
  permalink?: string;
  url?: string;
  currency_symbol: string;
  average_rating?: number;
  review_count?: number;
}

export interface AiResponse {
  error: boolean;
  reply: {
    type:
      | 'text'
      | 'product-carousel'
      | 'coupon'
      | 'contact-form'
      | 'faq-options'
      | 'order-tracker';
    text: string;
    links?: {
      label: string;
      url: string;
    }[];
    data?: {
      [key: string]: unknown;
    };
  };
  message_ids: {
    user: number;
    assistant: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  createdAt: Date;
  links?: {
    label: string;
    url: string;
  }[];
  type?:
    | 'text'
    | 'product-carousel'
    | 'coupon'
    | 'contact-form'
    | 'faq-options'
    | 'order-tracker'
    | 'ticket'
    | 'handover'
    | 'refund-return';
  data?:
    | CouponData
    | ProductCarouselData
    | ContactFormData
    | FAQItem[]
    | OrderTrackerData
    | HandoverData;
}

export interface HandoverData {
  handover: {
    title: string;
    value: string;
  }[];
  submitted?: boolean;
}

export interface ProductCarouselData {
  products: Product[];
}

export interface MessageActionsProps {
  message: string;
  messageId: string;
}

export interface CouponData {
  code: string;
  discount: string;
  validUntil: string;
}

export interface ContactFormData {
  submitted?: boolean;
}

export interface FAQItem {
  title: string;
  content: string;
}

export interface OrderTrackerData {
  submitted?: boolean;
  orderId?: string;
}

export interface OrderDetails {
  orderId: string;
  status: string;
  date: string;
  items: OrderItem[];
  shippingAddress: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: string;
}

export interface BotSettings {
  is_pro: boolean;
  is_woocommerce_active: boolean;
  modules: Record<string, boolean>;
  customization: Record<string, unknown>;
  proactive_sales_products: Product[];
  quick_options: FAQItem[];
  settings: {
    welcome_message: string[];
    refund_return_reasons: string[];
    order_tracker_email_required: boolean;
    order_tracker_phone_required: boolean;
    sales_notification_hide_frequency: number;
    sales_notification_show_frequency: number;
    sales_notification_template: string;
    proactive_sales_hide_frequency: number;
    proactive_sales_show_frequency: number;
    proactive_sales_template: string;
    collect_lead: boolean;
    lead_form_fields: string[];
    exit_intent_coupon: string;
    coupon_collect_lead: boolean;
    welcome_message_sound: boolean;
    show_ticket_creation_option: boolean;
    hide_on_mobile: boolean;
  };
}

export interface RecentSaleNotification {
  type: 'sale' | 'download' | 'review';
  customer_name: string;
  product_name: string;
  time: string;
  product_url: string;
  product_image: string;
}

export interface ImageSearchProps {
  image: File | null;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImageButtonClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface ProactiveSalesProps {
  onOpenChat: (productId: number) => void;
  isChatOpen: boolean;
}

export interface OrderTrackerProps {
  data: OrderTrackerData;
  messageId: string;
  onSubmit: (messageId: string, orderId: string) => void;
}

export interface TicketProps {
  data: ContactFormData;
  messageId: string;
  onSubmit: (messageId: string, submitted: boolean) => void;
}

export interface RefundReturnProps {
  data: ContactFormData;
  messageId: string;
  onSubmit: (messageId: string, submitted: boolean) => void;
}
