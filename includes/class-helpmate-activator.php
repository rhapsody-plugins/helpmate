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
	 * Also creates default email templates on activation (idempotent - only creates if missing).
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

		// Create default email templates on activation
		// The CRM methods check if templates exist before creating, so this is safe to call every time
		// Check if global instance exists (plugin might be already loaded)
		if (isset($GLOBALS['helpmate']) && $GLOBALS['helpmate'] instanceof Helpmate) {
			$GLOBALS['helpmate']->create_default_email_templates();
		} else {
			// Create a new instance to create templates
			// The class file is already loaded by the main plugin file
			if (class_exists('Helpmate')) {
				$helpmate = new Helpmate();
				$helpmate->create_default_email_templates();
			}
		}

		// Register rewrite rules for unsubscribe page and flush
		add_rewrite_rule(
			'^helpmate-unsubscribe/?$',
			'index.php?helpmate_unsubscribe=1',
			'top'
		);
		flush_rewrite_rules();
	}

}
