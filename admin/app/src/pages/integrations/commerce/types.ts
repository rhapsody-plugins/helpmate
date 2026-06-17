export type CommerceProviderId =
  | 'woocommerce'
  | 'easy_digital_downloads'
  | 'surecart';

export type CommerceIntegrationConfig = {
  enabled: boolean;
  selected_provider: '' | CommerceProviderId;
};
