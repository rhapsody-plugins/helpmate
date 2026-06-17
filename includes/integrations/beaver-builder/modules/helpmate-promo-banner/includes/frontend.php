<?php
/**
 * Beaver Builder: Helpmate Promo Bar — frontend output.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$helpmate                   = Helpmate_Beaver_Builder::instance()->get_helpmate();
$helpmate_bb_builder_active = class_exists( 'FLBuilderModel' ) && FLBuilderModel::is_builder_active();

if ( ! $helpmate ) {
	if ( $helpmate_bb_builder_active ) {
		echo '<div class="fl-module-msg fl-module-msg-info">';
		echo esc_html__( 'Helpmate is not available.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

$helpmate_promo = $helpmate->get_promo_banner();
if ( ! $helpmate_promo || ! $helpmate_promo->is_enabled() ) {
	if ( $helpmate_bb_builder_active ) {
		echo '<div class="fl-module-msg fl-module-msg-warning">';
		echo esc_html__( 'Promo Bar is disabled in Helpmate module settings.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

$helpmate_banner_id = isset( $settings->banner_id ) ? (int) $settings->banner_id : 0;
if ( $helpmate_banner_id <= 0 ) {
	if ( $helpmate_bb_builder_active ) {
		echo '<div class="fl-module-msg fl-module-msg-info">';
		echo esc_html__( 'Select a promo banner.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

global $wpdb;
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Module output; row load; caching not appropriate
$helpmate_banner = $wpdb->get_row(
	$wpdb->prepare(
		"SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d AND status = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name uses wpdb->prefix
		$helpmate_banner_id,
		'active'
	),
	ARRAY_A
);

if ( ! $helpmate_banner ) {
	if ( $helpmate_bb_builder_active ) {
		echo '<div class="fl-module-msg fl-module-msg-warning">';
		echo esc_html__( 'This banner was not found or is inactive.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

$helpmate_banner['metadata'] = json_decode( $helpmate_banner['metadata'], true );
if ( ! is_array( $helpmate_banner['metadata'] ) ) {
	$helpmate_banner['metadata'] = array();
}

$helpmate_override_settings = array(
	'override_background_color'           => isset( $settings->override_background_color ) ? $settings->override_background_color : '',
	'override_text_color'                 => isset( $settings->override_text_color ) ? $settings->override_text_color : '',
	'override_text_font_size'             => isset( $settings->override_text_font_size ) ? $settings->override_text_font_size : '',
	'override_button_background_color'    => isset( $settings->override_button_background_color ) ? $settings->override_button_background_color : '',
	'override_button_text_color'          => isset( $settings->override_button_text_color ) ? $settings->override_button_text_color : '',
	'override_button_text_font_size'      => isset( $settings->override_button_text_font_size ) ? $settings->override_button_text_font_size : '',
	'override_countdown_background_color' => isset( $settings->override_countdown_background_color ) ? $settings->override_countdown_background_color : '',
	'override_countdown_text_color'       => isset( $settings->override_countdown_text_color ) ? $settings->override_countdown_text_color : '',
);

$helpmate_metadata_overrides = class_exists( 'Helpmate_Elementor_Utils' )
	? Helpmate_Elementor_Utils::build_promo_metadata_overrides( $helpmate_override_settings )
	: array();

$helpmate_dom_id_suffix = isset( $module->node ) ? (string) $module->node : 'bb';
$helpmate_dom_id_suffix = preg_replace( '/[^a-zA-Z0-9_-]/', '', $helpmate_dom_id_suffix );

$helpmate_promo->enqueue_assets();
$helpmate_promo->render_promo_banner(
	$helpmate_banner,
	array(
		'metadata_overrides' => $helpmate_metadata_overrides,
		'dom_id_suffix'      => $helpmate_dom_id_suffix,
	)
);
