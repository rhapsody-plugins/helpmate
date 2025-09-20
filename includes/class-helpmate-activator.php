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
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Activator
{

	/**
	 * Short Description. (use period)
	 *
	 * Long Description.
	 *
	 * @since    1.0.0
	 */
	public static function activate()
	{
		$plugin_slug = HELPMATE_BASENAME;
		require_once HELPMATE_DIR . 'includes/class-helpmate-database.php';
		require_once HELPMATE_DIR . 'includes/class-helpmate-settings.php';
		require_once HELPMATE_DIR . 'includes/class-helpmate-license.php';
		new Helpmate_Database();
		$license = new Helpmate_License(new Helpmate_Settings(), $plugin_slug);

		if ($license->get_license_key()) {
			// Verify existing license key
			$validation = $license->rp_validate_plugin_license();
			return;
		}

		$response = $license->rp_register_free_license($plugin_slug);

		if (!isset($response['success']) || !$response['success'] || !$license->get_license_key()) {
			wp_die(
				esc_html__('Helpmate could not be activated due to a license error. Please contact support.', 'helpmate-ai-chatbot'),
				esc_html__('Plugin Activation Error', 'helpmate-ai-chatbot'),
				array('back_link' => true)
			);
		}
	}

}
