import {
  INTEGRATION_SLUG_CONTACT_FORM_7,
  INTEGRATION_SLUG_FORMINATOR,
  INTEGRATION_SLUG_WPFORMS,
  type IntegrationRegistryItem,
} from './types';

const baseAdminUrl = `${window.location.origin}/wp-admin/admin.php?page=`;

export const INTEGRATION_REGISTRY: IntegrationRegistryItem[] = [
  {
    id: 'cf7',
    title: 'Contact Form 7',
    description: 'Map CF7 forms to Helpmate actions and field mappings.',
    integrationSlug: INTEGRATION_SLUG_CONTACT_FORM_7,
    queryKey: 'cf7-forms',
    formsEndpoint: '/integrations/cf7/forms',
    settingsKey: 'cf7_integrations',
    createFormUrl: `${baseAdminUrl}wpcf7-new`,
    notInstalledText: 'Contact Form 7 is not installed or active.',
    primaryCtaText: 'Create a form in Contact Form 7',
    emptySupportingText:
      'Add a form in the plugin, then reopen this sheet to map it to Helpmate.',
    logsDescription:
      'Submission routing, validation, and processing events from CF7. No raw form data is stored.',
  },
  {
    id: 'forminator',
    title: 'Forminator',
    description:
      'Map Forminator custom forms to Helpmate actions and field mappings.',
    integrationSlug: INTEGRATION_SLUG_FORMINATOR,
    queryKey: 'forminator-forms',
    formsEndpoint: '/integrations/forminator/forms',
    settingsKey: 'forminator_integrations',
    createFormUrl: `${baseAdminUrl}forminator-cform-wizard`,
    notInstalledText: 'Forminator is not installed or active.',
    primaryCtaText: 'Create a custom form in Forminator',
    emptySupportingText:
      'Add a custom form in Forminator, then reopen this sheet to map it to Helpmate.',
    logsDescription:
      'Submission routing, validation, and processing events from Forminator custom forms. No raw form data is stored.',
  },
  {
    id: 'wpforms',
    title: 'WPForms',
    description: 'Map WPForms forms to Helpmate actions and field mappings.',
    integrationSlug: INTEGRATION_SLUG_WPFORMS,
    queryKey: 'wpforms-forms',
    formsEndpoint: '/integrations/wpforms/forms',
    settingsKey: 'wpforms_integrations',
    createFormUrl: `${baseAdminUrl}wpforms-builder`,
    notInstalledText: 'WPForms is not installed or active.',
    primaryCtaText: 'Create a form in WPForms',
    emptySupportingText:
      'Add a form in WPForms, then reopen this sheet to map it to Helpmate.',
    logsDescription:
      'Submission routing, validation, and processing events from WPForms. No raw form data is stored.',
  },
];
