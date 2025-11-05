<?php

/**
 * The plugin bootstrap file
 *
 * This file is read by WordPress to generate the plugin information in the plugin
 * admin area. This file also includes all of the dependencies used by the plugin,
 * registers the activation and deactivation functions, and defines a function
 * that starts the plugin.
 *
 * @link              https://rhapsodyplugins.com/helpmate
 * @since             1.0.0
 * @package           Helpmate
 *
 * @wordpress-plugin
 * Plugin Name:       Helpmate – Sales & Support AI Chatbot for WooCommerce
 * Plugin URI:        https://rhapsodyplugins.com/helpmate
 * Description:       Helpmate is an AI-powered WooCommerce chatbot that boosts sales, automates support, and engages customers 24/7 with smart, human-like chat.
 * Version:           1.1.4
 * Author:            Rhapsody Plugins
 * Author URI:        https://rhapsodyplugins.com/
 * Requires at least: 5.0
 * Tested up to:      6.8.2
 * Stable tag:        1.1.4
 * Requires PHP:      7.4
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       helpmate-ai-chatbot
 * Domain Path:       /languages
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Currently plugin version.
 * Start at version 1.0.0 and use SemVer - https://semver.org
 * Rename this for your plugin and update it as you release new versions.
 */
define('HELPMATE_VERSION', '1.1.4');

/**
 * Plugin constants
 */
define('HELPMATE_DIR', plugin_dir_path(__FILE__));
define('HELPMATE_URL', plugin_dir_url(__FILE__));
define('HELPMATE_BASENAME', plugin_basename(__FILE__));
define('HELPMATE_FEATURES', ['ai_response', 'data_source']);

/**
 * Module constants
 */
define('HELPMATE_MODULE_WOOCOMMERCE', 'woocommerce');
define('HELPMATE_MODULE_CHATBOT', 'chatbot');
define('HELPMATE_MODULE_IMAGE_SEARCH', 'image-search');
define('HELPMATE_MODULE_PROACTIVE_SALES', 'proactive-sales');
define('HELPMATE_MODULE_REFUND_RETURN', 'refund-return');
define('HELPMATE_MODULE_SALES_NOTIFICATIONS', 'sales-notifications');
define('HELPMATE_MODULE_TICKET_SYSTEM', 'ticket-system');
define('HELPMATE_MODULE_ABANDONED_CART', 'abandoned-cart');
define('HELPMATE_MODULE_ORDER_TRACKER', 'order-tracker');
define('HELPMATE_MODULE_COUPON_DELIVERY', 'coupon-delivery');
define('HELPMATE_MODULE_PROMO_BANNER', 'promo-banner');
define('HELPMATE_MODULE_DEFAULT_SETTINGS', [
	HELPMATE_MODULE_CHATBOT => true,
	HELPMATE_MODULE_SALES_NOTIFICATIONS => true,
	HELPMATE_MODULE_PROMO_BANNER => true,
	HELPMATE_MODULE_TICKET_SYSTEM => true,
	HELPMATE_MODULE_IMAGE_SEARCH => false,
	HELPMATE_MODULE_PROACTIVE_SALES => false,
	HELPMATE_MODULE_REFUND_RETURN => false,
	HELPMATE_MODULE_ABANDONED_CART => false,
	HELPMATE_MODULE_ORDER_TRACKER => false,
	HELPMATE_MODULE_COUPON_DELIVERY => false,
]);

/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-helpmate-activator.php
 */
function activate_helpmate()
{
	require_once plugin_dir_path(__FILE__) . 'includes/class-helpmate-activator.php';
	Helpmate_Activator::activate();
}

/**
 * The code that runs during plugin deactivation.
 * This action is documented in includes/class-helpmate-deactivator.php
 */
function deactivate_helpmate()
{
	require_once plugin_dir_path(__FILE__) . 'includes/class-helpmate-deactivator.php';
	Helpmate_Deactivator::deactivate();
}

register_activation_hook(__FILE__, 'activate_helpmate');
register_deactivation_hook(__FILE__, 'deactivate_helpmate');

/**
 * The core plugin class that is used to define internationalization,
 * admin-specific hooks, and public-facing site hooks.
 */
require plugin_dir_path(__FILE__) . 'includes/class-helpmate.php';

/**
 * Set the script translations for the plugin.
 *
 * @since    1.0.0
 */
function helpmate_set_script_translations()
{
	wp_set_script_translations(HELPMATE_BASENAME, 'helpmate-ai-chatbot', plugin_dir_path(__FILE__) . 'languages');
}
add_action('init', 'helpmate_set_script_translations');

/**
 * Begins execution of the plugin.
 *
 * Since everything within the plugin is registered via hooks,
 * then kicking off the plugin from this point in the file does
 * not affect the page life cycle.
 *
 * @since    1.0.0
 */
function run_helpmate()
{
	$plugin = new Helpmate();
	$GLOBALS['helpmate'] = $plugin;
	$plugin->run();
}

/**
 * Add plugin action links
 *
 * @since    1.0.0
 */
function helpmate_plugin_action_links($links)
{
	$settings_link = '<a href="' . admin_url('admin.php?page=helpmate') . '">' . __('Train Chatbot', 'helpmate-ai-chatbot') . '</a>';
	$upgrade_link = '<a href="https://rhapsodyplugins.com/helpmate/#pricing" style="font-weight: bold;" target="_blank">' . __('Upgrade', 'helpmate-ai-chatbot') . '</a>';
	array_unshift($links, $settings_link, $upgrade_link);
	return $links;
}
add_filter('plugin_action_links_' . HELPMATE_BASENAME, 'helpmate_plugin_action_links');

run_helpmate();
