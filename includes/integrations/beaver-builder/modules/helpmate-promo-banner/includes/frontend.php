<?php
/**
 * Beaver Builder: Helpmate Promo Bar — frontend output.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$helpmate = Helpmate_Beaver_Builder::instance()->get_helpmate();
$builder  = class_exists( 'FLBuilderModel' ) && FLBuilderModel::is_builder_active();

if ( ! $helpmate ) {
	if ( $builder ) {
		echo '<div class="fl-module-msg fl-module-msg-info">';
		echo esc_html__( 'Helpmate is not available.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

$promo = $helpmate->get_promo_banner();
if ( ! $promo || ! $promo->is_enabled() ) {
	if ( $builder ) {
		echo '<div class="fl-module-msg fl-module-msg-warning">';
		echo esc_html__( 'Promo Bar is disabled in Helpmate module settings.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

$banner_id = isset( $settings->banner_id ) ? (int) $settings->banner_id : 0;
if ( $banner_id <= 0 ) {
	if ( $builder ) {
		echo '<div class="fl-module-msg fl-module-msg-info">';
		echo esc_html__( 'Select a promo banner.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

global $wpdb;
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
$banner = $wpdb->get_row(
	$wpdb->prepare(
		"SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d AND status = %s",
		$banner_id,
		'active'
	),
	ARRAY_A
);

if ( ! $banner ) {
	if ( $builder ) {
		echo '<div class="fl-module-msg fl-module-msg-warning">';
		echo esc_html__( 'This banner was not found or is inactive.', 'helpmate-ai-chatbot' );
		echo '</div>';
	}
	return;
}

$banner['metadata'] = json_decode( $banner['metadata'], true );
if ( ! is_array( $banner['metadata'] ) ) {
	$banner['metadata'] = array();
}

$settings_arr = array(
	'override_background_color'           => isset( $settings->override_background_color ) ? $settings->override_background_color : '',
	'override_text_color'                 => isset( $settings->override_text_color ) ? $settings->override_text_color : '',
	'override_text_font_size'             => isset( $settings->override_text_font_size ) ? $settings->override_text_font_size : '',
	'override_button_background_color'    => isset( $settings->override_button_background_color ) ? $settings->override_button_background_color : '',
	'override_button_text_color'          => isset( $settings->override_button_text_color ) ? $settings->override_button_text_color : '',
	'override_button_text_font_size'      => isset( $settings->override_button_text_font_size ) ? $settings->override_button_text_font_size : '',
	'override_countdown_background_color' => isset( $settings->override_countdown_background_color ) ? $settings->override_countdown_background_color : '',
	'override_countdown_text_color'       => isset( $settings->override_countdown_text_color ) ? $settings->override_countdown_text_color : '',
);

$overrides = class_exists( 'Helpmate_Elementor_Utils' )
	? Helpmate_Elementor_Utils::build_promo_metadata_overrides( $settings_arr )
	: array();

$suffix = isset( $module->node ) ? (string) $module->node : 'bb';
$suffix = preg_replace( '/[^a-zA-Z0-9_-]/', '', $suffix );

$promo->enqueue_assets();
$promo->render_promo_banner(
	$banner,
	array(
		'metadata_overrides' => $overrides,
		'dom_id_suffix'      => $suffix,
	)
);
