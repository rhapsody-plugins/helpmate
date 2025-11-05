<?php

/**
 * Fired during plugin activation.
 *
 * This class defines all code necessary to run during the plugin's activation.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
	exit;

class Helpmate_Activator
{

	/**
	 * Runs when the plugin is activated.
	 *
	 * Checks if the plugin was previously deactivated, and if so,
	 * notifies the license server of reactivation.
	 *
	 * @since    1.0.0
	 */
	public static function activate()
	{
		global $wpdb;

		// Check if plugin was previously deactivated
		$was_deactivated = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			"SELECT setting_value FROM {$wpdb->prefix}helpmate_settings WHERE setting_key = %s",
			'was_deactivated'
		));

		// Only send activation feedback if the plugin was previously deactivated
		if ($was_deactivated !== null) {
			// Load required classes
			require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-helpmate-settings.php';
			require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-helpmate-api.php';

			// Initialize settings and API
			$settings = new Helpmate_Settings();
			$api = new Helpmate_Api($settings, 'helpmate');

			// Send activation feedback
			$api->send_activate_feedback();

			// Remove the deactivation flag
			$wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->prefix . 'helpmate_settings',
				array('setting_key' => 'was_deactivated'),
				array('%s')
			);
		}
	}

}
