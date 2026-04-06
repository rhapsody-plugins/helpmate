export interface Contact {
  id: number;
  prefix?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  wp_user_id?: number;
  status: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  custom_fields?: Record<number, ContactCustomFieldValue>;
}

export interface ContactCustomFieldValue {
  field_id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  value: string | number | string[] | null;
}

export interface CustomField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'textarea' | 'dropdown' | 'checkbox' | 'radio' | 'email' | 'url' | 'phone' | 'file' | 'multi_select' | 'rich_text';
  field_options?: string[];
  is_required: boolean;
  entity_type: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContactNote {
  id: number;
  contact_id: number;
  note_content: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ManualOrder {
  id: number;
  contact_id: number;
  order_number: string;
  product_name: string;
  quantity: number;
  price: number;
  order_date: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  customer_info?: Record<string, string | number | boolean | null>;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  order_type: 'manual';
}

export interface WooCommerceOrderVendorLine {
  product_label: string;
  vendor_store_name: string;
  vendor_id: number;
}

export interface WooCommerceOrder {
  id: number;
  order_number: string;
  status: string;
  total: string;
  date_created: string;
  edit_url: string;
  order_type: 'woocommerce';
  /** Present when Dokan integration + toggle enabled (optional). */
  vendor_summary?: string;
  vendor_lines?: WooCommerceOrderVendorLine[];
}

export interface EddOrder {
  id: number;
  order_number: string;
  status: string;
  total: string;
  date_created: string;
  edit_url: string;
  /** Plain-text line-item summary from the server (EDD). */
  product_summary?: string;
  order_type: 'easy_digital_downloads';
}

export interface SureCartOrder {
  id: string;
  order_number: string;
  status: string;
  total: string;
  currency?: string;
  date_created: string;
  edit_url: string;
  product_summary?: string;
  order_type: 'surecart';
}

export type Order = ManualOrder | WooCommerceOrder | EddOrder | SureCartOrder;

export interface ContactFilters {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// Task-related types
export interface Task {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  custom_fields?: Record<number, TaskCustomFieldValue>;
  contacts?: Contact[];
  is_overdue?: boolean;
}

export interface TaskCustomFieldValue {
  field_id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  value: string | number | string[] | null;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  assigned_to?: number | 'me' | 'unassigned';
  search?: string;
  due_date_from?: string;
  due_date_to?: string;
  overdue?: boolean;
  has_contacts?: boolean;
}

export interface TaskFormData {
  title: string;
  description?: string;
  due_date?: string;
  assigned_to?: number | null;
  contact_ids?: number[];
  custom_fields?: Record<number, TaskCustomFieldValue>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  tasks: Task[];
}

// Email-related types
export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  is_default?: boolean | string | number;
  original_subject?: string;
  original_body?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactEmail {
  id: number;
  contact_id: number;
  template_id: number | null;
  subject: string;
  body: string;
  sent_by: number;
  sent_by_name?: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string | null;
}

// Segment-related types
export interface SegmentCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty';
  value: string | number;
}

export interface SegmentConditionGroup {
  logic: 'AND' | 'OR';
  conditions: SegmentCondition[];
}

export interface Segment {
  id: number;
  name: string;
  conditions: {
    logic: 'AND' | 'OR';
    groups: SegmentConditionGroup[];
  };
  contact_count: number;
  created_at: string;
  updated_at: string;
}

// Campaign-related types
export interface Campaign {
  id: number;
  name: string;
  template_id: number;
  segment_id: number | null;
  subject_override?: string | null;
  body_override?: string | null;
  type?: 'one_time' | 'recurring';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduled_at?: string | null;
  sent_at?: string | null;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  interval_value?: number | null;
  interval_unit?: 'days' | 'weeks' | 'months' | null;
  send_time?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  is_active?: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  total_sent: number;
  total_failed: number;
  total_bounced: number;
  total_unsubscribed: number;
  bounce_rate: number;
}

// Recurring campaign types
export interface RecurringCampaign {
  id: number;
  name: string;
  template_id: number;
  segment_id: number;
  subject_override?: string | null;
  body_override?: string | null;
  interval_value: number;
  interval_unit: 'days' | 'weeks' | 'months';
  send_time?: string | null;
  next_run_at: string;
  last_run_at?: string | null;
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// Failed email (campaign or sequence)
export interface FailedEmail {
  contact_id: number;
  contact_email: string | null;
  contact_name: string | null;
  error_message: string;
  source: 'email_record' | 'failure_record';
}

// Email sequence types
export interface EmailSequenceStep {
  id: number;
  sequence_id: number;
  step_order: number;
  template_id: number;
  subject_override?: string | null;
  body_override?: string | null;
  delay_days: number;
  delay_hours: number;
  created_at: string;
  updated_at: string;
}

export interface EmailSequence {
  id: number;
  name: string;
  segment_id: number;
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  steps?: EmailSequenceStep[];
  sent_count?: number;
  failed_count?: number;
}

// Email tracking types
export interface EmailTracking {
  id: number;
  email_id: number;
  campaign_id?: number | null;
  recurring_campaign_id?: number | null;
  sequence_id?: number | null;
  sequence_step_id?: number | null;
  contact_id: number;
  opened_at?: string | null;
  opened_count: number;
  clicked_at?: string | null;
  clicked_count: number;
  bounced_at?: string | null;
  bounce_reason?: string | null;
  unsubscribed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTrackingStats {
  total_tracked: number;
  total_bounced: number;
  total_unsubscribed: number;
}
