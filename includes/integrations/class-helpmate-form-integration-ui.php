<?php

/**
 * Shared UI helpers for form plugin integrations (Helpmate Integrations + native editor tabs).
 *
 * When adding native editor panels for other form plugins, reuse render_field_mapping_notice().
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/integrations
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_Form_Integration_UI
{
	/**
	 * Build field-mapping guidance for admin UIs.
	 *
	 * @param array<int, array{key?:string,label?:string,required?:bool}> $mappable_fields Action mappable field definitions.
	 * @param bool                                                         $has_form_fields   Whether scannable form fields exist.
	 * @param string                                                       $context           'generic' or 'cf7_editor'.
	 * @return string Plain-text notice message.
	 */
	public static function get_field_mapping_notice_message(array $mappable_fields, $has_form_fields, $context = 'generic')
	{
		$message = __('Make sure your form includes the fields this action needs. Then choose which form field fills each Helpmate field below.', 'helpmate-ai-chatbot');

		$required_labels = [];
		foreach ($mappable_fields as $mf) {
			if (empty($mf['required']) || empty($mf['label'])) {
				continue;
			}
			$label = trim((string) $mf['label']);
			if ($label !== '') {
				$required_labels[] = $label;
			}
		}

		if ($required_labels !== []) {
			$list = implode(', ', $required_labels);
			/* translators: %s: Comma-separated list of required Helpmate field labels for the selected action. */
			$message .= ' ' . sprintf(__('Required for this action: %s.', 'helpmate-ai-chatbot'), $list);
		}

		if (!$has_form_fields) {
			if ($context === 'cf7_editor') {
				$message .= ' ' . __('No form fields were found yet. Add fields on the Form tab, save the form, then map them below.', 'helpmate-ai-chatbot');
			} else {
				$message .= ' ' . __('No form fields were found yet. Add fields in your form builder, save the form, and reopen this screen.', 'helpmate-ai-chatbot');
			}
		} elseif ($context === 'cf7_editor') {
			$message .= ' ' . __('Add or edit fields on the Form tab, save the form, then map them below.', 'helpmate-ai-chatbot');
		}

		return $message;
	}

	/**
	 * Echo a compact muted notice above field-mapping rows in native form editor tabs.
	 *
	 * @param array<int, array{key?:string,label?:string,required?:bool}> $mappable_fields Action mappable field definitions.
	 * @param bool                                                         $has_form_fields   Whether scannable form fields exist.
	 * @param string                                                       $context           'generic' or 'cf7_editor'.
	 */
	public static function render_field_mapping_notice(array $mappable_fields, $has_form_fields, $context = 'generic')
	{
		$message = self::get_field_mapping_notice_message($mappable_fields, $has_form_fields, $context);
		if ($message === '') {
			return;
		}

		echo '<div class="helpmate-form-field-mapping-notice" style="margin:0 0 12px;padding:10px 12px;border:1px solid #c3c4c7;border-radius:4px;background:#f6f7f7;">';
		echo '<p class="description" style="margin:0;">' . esc_html($message) . '</p>';
		echo '</div>';
	}
}
