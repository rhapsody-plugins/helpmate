import {
  INTEGRATION_SLUG_CONTACT_FORM_7,
  INTEGRATION_SLUG_FORMINATOR,
  INTEGRATION_SLUG_FORMIDABLE_FORMS,
  INTEGRATION_SLUG_NINJA_FORMS,
  INTEGRATION_SLUG_WPFORMS,
  type IntegrationRegistryItem,
} from './types';

const baseAdminUrl = `${window.location.origin}/wp-admin/admin.php?page=`;

export const INTEGRATION_REGISTRY: IntegrationRegistryItem[] = [
  {
    id: 'cf7',
    group: 'forms',
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
    group: 'forms',
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
    id: 'ninja_forms',
    group: 'forms',
    title: 'Ninja Forms',
    description: 'Map Ninja Forms forms to Helpmate actions and field mappings.',
    integrationSlug: INTEGRATION_SLUG_NINJA_FORMS,
    queryKey: 'ninja-forms',
    formsEndpoint: '/integrations/ninja-forms/forms',
    settingsKey: 'ninja_forms_integrations',
    createFormUrl: `${baseAdminUrl}ninja-forms`,
    notInstalledText: 'Ninja Forms is not installed or active.',
    primaryCtaText: 'Create a form in Ninja Forms',
    emptySupportingText:
      'Add a form in Ninja Forms, then reopen this sheet to map it to Helpmate.',
    logsDescription:
      'Submission routing, validation, and processing events from Ninja Forms. No raw form data is stored.',
  },
  {
    id: 'wpforms',
    group: 'forms',
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
  {
    id: 'formidable_forms',
    group: 'forms',
    title: 'Formidable Forms',
    description:
      'Map Formidable Forms forms to Helpmate actions and field mappings.',
    integrationSlug: INTEGRATION_SLUG_FORMIDABLE_FORMS,
    queryKey: 'formidable-forms',
    formsEndpoint: '/integrations/formidable/forms',
    settingsKey: 'formidable_forms_integrations',
    createFormUrl: `${baseAdminUrl}formidable`,
    notInstalledText: 'Formidable Forms is not installed or active.',
    primaryCtaText: 'Create a form in Formidable Forms',
    emptySupportingText:
      'Add a form in Formidable Forms, then reopen this sheet to map it to Helpmate.',
    logsDescription:
      'Submission routing, validation, and processing events from Formidable Forms. No raw form data is stored.',
  },
];
