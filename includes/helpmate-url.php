<?php

/**
 * Site URL helpers for license-server identity and localhost detection.
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Canonical site URL for license-server payloads (baked at build time when set).
 *
 * @return string
 */
function helpmate_get_site_url(): string {
	if ( defined( 'HELPMATE_BAKED_SITE_URL' ) && HELPMATE_BAKED_SITE_URL !== '' ) {
		return untrailingslashit( HELPMATE_BAKED_SITE_URL );
	}
	return get_site_url();
}

/**
 * URL of the running WordPress install (ignores build-time bake).
 *
 * Use for HTTP fetches (e.g. quick-train homepage) against the live site.
 *
 * @return string
 */
function helpmate_get_runtime_site_url(): string {
	return untrailingslashit( get_site_url() );
}

/**
 * Hostname derived from the canonical site URL.
 *
 * @return string
 */
function helpmate_get_site_domain(): string {
	$host = wp_parse_url( helpmate_get_site_url(), PHP_URL_HOST );
	return is_string( $host ) ? $host : '';
}

/**
 * Whether the canonical site URL represents a localhost install.
 *
 * @return bool
 */
function helpmate_is_localhost_site(): bool {
	$url = strtolower( helpmate_get_site_url() );
	return strpos( $url, 'localhost' ) !== false || strpos( $url, '127.0.0.1' ) !== false;
}
