export const UNMAPPED_FIELD = '__helpmate_cf7_none__';

export const INTEGRATION_SLUG_CONTACT_FORM_7 = 'contact_form_7';
export const INTEGRATION_SLUG_FORMINATOR = 'forminator_custom_form';
export const INTEGRATION_SLUG_WPFORMS = 'wpforms';
export const INTEGRATION_SLUG_NINJA_FORMS = 'ninja_forms';
export const INTEGRATION_SLUG_FORMIDABLE_FORMS = 'formidable_forms';

export type IntegrationMappableField = {
  key: string;
  label: string;
  required: boolean;
};

export type IntegrationAction = {
  id: string;
  label: string;
  tier: 'free' | 'pro';
  required_fields: string[];
  mappable_fields: IntegrationMappableField[];
  verification_contact_required?: boolean;
};

export type IntegrationForm = {
  id: number;
  title: string;
  fields: Array<{ name: string; type: string }>;
  config: {
    enabled: boolean;
    action: string;
    field_map: Record<string, string>;
  };
};

export type IntegrationFormsResponse = {
  error: boolean;
  installed: boolean;
  actions: IntegrationAction[];
  forms: IntegrationForm[];
};

export type FormConfigState = {
  enabled: boolean;
  action: string;
  field_map: Record<string, string>;
};

export type IntegrationEventRow = {
  id: number;
  integration: string;
  source: string;
  form_id: number | null;
  action: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  payload_hash: string | null;
  dedup_key: string | null;
  metadata: Record<string, unknown>;
  created_at: number | string;
};

export type IntegrationEventsResponse = {
  error: boolean;
  data: IntegrationEventRow[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
};

export type IntegrationRegistryItem = {
  id: 'cf7' | 'forminator' | 'wpforms' | 'ninja_forms' | 'formidable_forms';
  group: 'forms' | 'commerce' | 'messaging_crm';
  title: string;
  description: string;
  integrationSlug: string;
  queryKey: string;
  formsEndpoint: string;
  settingsKey: string;
  createFormUrl: string;
  notInstalledText: string;
  primaryCtaText: string;
  emptySupportingText: string;
  logsDescription: string;
};

/** Keys returned by GET /integrations/plugin-overview `plugins` map. */
export type IntegrationOverviewPluginId =
  | IntegrationRegistryItem['id']
  | 'woocommerce'
  | 'easy_digital_downloads'
  | 'surecart'
  | 'learnpress'
  | 'tutor'
  | 'elementor'
  | 'beaver_builder'
  | 'gutenberg';

export type IntegrationPluginOverviewEntry = {
  present: boolean;
  active: boolean;
  plugin_file: string | null;
  wp_org_slug: string | null;
  is_core?: boolean;
};

export type IntegrationPluginOverviewResponse = {
  error: boolean;
  capabilities: {
    install_plugins: boolean;
    activate_plugins: boolean;
  };
  plugins: Record<string, IntegrationPluginOverviewEntry>;
};
