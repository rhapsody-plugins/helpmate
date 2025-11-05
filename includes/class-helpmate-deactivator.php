<?php

/**
 * Fired during plugin deactivation.
 *
 * This class defines all code necessary to run during the plugin's deactivation.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Deactivator {

	/**
	 * Runs when the plugin is deactivated.
	 *
	 * Saves a flag in settings to track that the plugin was deactivated
	 * so we can notify the license server on reactivation.
	 *
	 * @since    1.0.0
	 */
	public static function deactivate() {
		global $wpdb;

		// Check if the setting already exists
		$exists = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			"SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_settings WHERE setting_key = %s",
			'was_deactivated'
		));

		if ($exists) {
			// Update existing row
			$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->prefix . 'helpmate_settings',
				array(
					'setting_value' => json_encode(true),
					'last_updated' => time()
				),
				array('setting_key' => 'was_deactivated'),
				array('%s', '%d'),
				array('%s')
			);
		} else {
			// Insert new row
			$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->prefix . 'helpmate_settings',
				array(
					'setting_key' => 'was_deactivated',
					'setting_value' => json_encode(true),
					'last_updated' => time()
				),
				array('%s', '%s', '%d')
			);
		}
	}

}
