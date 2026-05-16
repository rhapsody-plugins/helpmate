<?php
/**
 * Beaver Builder: Helpmate Scheduling — frontend output.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$helpmate                   = Helpmate_Beaver_Builder::instance()->get_helpmate();
$helpmate_bb_builder_active = class_exists( 'FLBuilderModel' ) && FLBuilderModel::is_builder_active();

if ( ! $helpmate || ! $helpmate->get_plugin_public() ) {
	return;
}

$helpmate_dom_id_suffix = isset( $module->node ) ? (string) $module->node : 'bb';
$helpmate_dom_id_suffix = preg_replace( '/[^a-zA-Z0-9_-]/', '', $helpmate_dom_id_suffix );
if ( $helpmate_dom_id_suffix === '' ) {
	$helpmate_dom_id_suffix = 'bb';
}

$helpmate_heading_text = isset( $settings->heading_text ) ? trim( (string) $settings->heading_text ) : '';
$helpmate_text_align   = isset( $settings->text_align ) ? (string) $settings->text_align : '';
if ( ! in_array( $helpmate_text_align, array( 'left', 'center', 'right' ), true ) ) {
	$helpmate_text_align = '';
}

$helpmate_scheduling_html = $helpmate->get_plugin_public()->get_scheduling_form_html(
	array(
		'instance_suffix' => $helpmate_dom_id_suffix,
		'heading_text'    => $helpmate_heading_text,
		'text_align'      => $helpmate_text_align,
	)
);

if ( $helpmate_scheduling_html === '' ) {
	if ( $helpmate_bb_builder_active ) {
		echo '<div class="fl-module-msg fl-module-msg-info">';
		echo esc_html__( 'Smart Schedules is disabled or unavailable. Enable it in Helpmate settings.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Markup from trusted plugin template
echo $helpmate_scheduling_html;
