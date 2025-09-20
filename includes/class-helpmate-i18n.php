<?php

/**
 * Define the internationalization functionality.
 *
 * Loads and defines the internationalization files for this plugin
 * so that it is ready for translation.
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

class Helpmate_i18n {
	/**
	 * Load the plugin text domain for translation.
	 *
	 * @since    1.0.0
	 * @deprecated Since WordPress 4.6, this is no longer needed for WordPress.org hosted plugins
	 */
	public function load_plugin_textdomain() {
		// WordPress automatically loads translations for plugins hosted on WordPress.org
		// This method is kept for backward compatibility but is no longer needed
	}



}
