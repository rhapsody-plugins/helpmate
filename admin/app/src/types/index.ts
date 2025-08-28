import { PageType } from '@/context/MainContext';

export interface PaginationParams {
  page: number;
  per_page: number;
}

export interface PaginationResponse {
  total: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface DataSource extends Document {
  last_updated: number;
}

export interface Document extends DocumentInput {
  id: number;
  last_updated: number;
}

export interface DocumentInput {
  document_type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  vector?: string;
}

export interface MenuItem {
  title: string;
  icon?: React.ReactNode;
  status: boolean;
}

export interface SidebarMenuItemType {
  label: string;
  page: PageType;
  icon?: React.ReactNode;
  status?: boolean;
  pro?: boolean;
}

export interface DiscountedProduct {
  id: number;
  name: string;
  regular_price: string;
  sale_price: string;
  discount_percentage: number;
  stock_status: string;
  image_url: string;
}

export interface PostType {
  name: string;
  label: string;
  description: string;
  hierarchical: boolean;
  supports: string[];
  has_archive: boolean;
  rest_base: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  createdAt: Date;
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
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TicketMessage {
  id: number;
  datetime: string;
  role: 'user' | 'admin';
  message: string;
  metadata: Record<string, unknown>;
}

export interface Lead {
  id: number;
  name: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AbandonedCartType {
  id: number;
  customer: {
    ID: number;
    display_name: string;
    user_email: string;
  };
  cart_data: string;
  cart_status: string;
  woocommerce_session_id: string;
  timestamp: string;
  mails_sent: number;
  metadata: string;
}

export interface WordPressPost {
  id: number;
  title: string | { rendered: string };
  type: string;
  status: string;
  date: string;
  author: string;
  content?: string;
  metadata?: unknown;
}

export interface Coupon {
  id: number;
  code: string;
  amount: number;
  discount_type: string;
  description: string;
  date_expires: string;
  minimum_amount: number;
}

export interface PromoBanner {
  id: number;
  title: string;
  metadata: Record<string, unknown>;
  start_datetime: number;
  end_datetime: number;
  status: PromoBannerStatus;
  shortcode: string;
}

export interface PromoBannerInput {
  title: string;
  metadata: Record<string, unknown>;
  status: PromoBannerStatus;
  start_datetime: number;
  end_datetime: number;
}

export type PromoBannerStatus = 'active' | 'inactive' | 'expired';

export interface RefundReturnType {
  id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  type: 'refund' | 'return' | 'exchange';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  updated_at: number;
  amount: number;
}
