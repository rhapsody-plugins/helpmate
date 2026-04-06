<?php
/**
 * Beaver Builder: Helpmate Scheduling — frontend output.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$helpmate = Helpmate_Beaver_Builder::instance()->get_helpmate();
$builder  = class_exists( 'FLBuilderModel' ) && FLBuilderModel::is_builder_active();

if ( ! $helpmate || ! $helpmate->get_plugin_public() ) {
	return;
}

$suffix = isset( $module->node ) ? (string) $module->node : 'bb';
$suffix = preg_replace( '/[^a-zA-Z0-9_-]/', '', $suffix );
if ( $suffix === '' ) {
	$suffix = 'bb';
}

$heading = isset( $settings->heading_text ) ? trim( (string) $settings->heading_text ) : '';
$align   = isset( $settings->text_align ) ? (string) $settings->text_align : '';
if ( ! in_array( $align, array( 'left', 'center', 'right' ), true ) ) {
	$align = '';
}

$html = $helpmate->get_plugin_public()->get_scheduling_form_html(
	array(
		'instance_suffix' => $suffix,
		'heading_text'    => $heading,
		'text_align'      => $align,
	)
);

if ( $html === '' ) {
	if ( $builder ) {
		echo '<div class="fl-module-msg fl-module-msg-info">';
		echo esc_html__( 'Smart Schedules is disabled or unavailable. Enable it in Helpmate settings.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Markup from trusted plugin template
echo $html;
