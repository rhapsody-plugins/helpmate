<?php

/**
 * The admin-specific functionality of the plugin.
 *
 * Defines the plugin name, version, and two examples hooks for how to
 * enqueue the admin-specific stylesheet and JavaScript.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/admin
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
	exit;

class Helpmate_Admin
{

	/**
	 * The ID of this plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      string    $plugin_name    The ID of this plugin.
	 */
	private $plugin_name;

	/**
	 * The version of this plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      string    $version    The current version of this plugin.
	 */
	private $version;

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 * @param      string    $plugin_name       The name of the plugin.
	 * @param      string    $version    The version of this plugin.
	 */
	public function __construct($plugin_name, $version)
	{

		$this->plugin_name = $plugin_name;
		$this->version = $version;

		// Add menu highlighting hook
		add_action('admin_head', array($this, 'add_menu_highlighting_css'));

		// Add AJAX hooks for checklist functionality
		add_action('wp_ajax_helpmate_update_checklist', array($this, 'ajax_update_checklist'));
		add_action('wp_ajax_helpmate_skip_checklist', array($this, 'ajax_skip_checklist'));

	}

	/**
	 * Register the stylesheets for the admin area.
	 *
	 * @since    1.0.0
	 */
	public function enqueue_styles()
	{

		/**
		 * This function is provided for demonstration purposes only.
		 *
		 * An instance of this class should be passed to the run() function
		 * defined in Helpmate_Loader as all of the hooks are defined
		 * in that particular class.
		 *
		 * The Helpmate_Loader will then create the relationship
		 * between the defined hooks and the functions defined in this
		 * class.
		 */

		wp_enqueue_style($this->plugin_name, plugin_dir_url(__FILE__) . 'css/helpmate-admin.css', array(), $this->version, 'all');


		// Check if we're on the Helpmate admin page
		$screen = get_current_screen();
		if ($screen && $screen->id === 'toplevel_page_helpmate') {
			$is_dev = defined('WP_HELPMATE_DEV') && WP_HELPMATE_DEV;

			if (!$is_dev) {
				// Production mode - load compiled CSS
				$vite_app_url = plugin_dir_url(__FILE__) . 'app/';
				$dist_dir = plugin_dir_path(__FILE__) . 'app/dist/assets/';
				$css_files = glob($dist_dir . 'index-*.css');

				if (!empty($css_files)) {
					$latest_css = basename(end($css_files));
					wp_enqueue_style(
						$this->plugin_name . '-admin-vite',
						$vite_app_url . 'dist/assets/' . $latest_css,
						array(),
						$this->version,
						'all'
					);
				}
			}
		}

	}

	/**
	 * Register the JavaScript for the admin area.
	 *
	 * @since    1.0.0
	 */
	public function enqueue_scripts()
	{

		/**
		 * This function is provided for demonstration purposes only.
		 *
		 * An instance of this class should be passed to the run() function
		 * defined in Helpmate_Loader as all of the hooks are defined
		 * in that particular class.
		 *
		 * The Helpmate_Loader will then create the relationship
		 * between the defined hooks and the functions defined in this
		 * class.
		 */

		wp_enqueue_script($this->plugin_name, plugin_dir_url(__FILE__) . 'js/helpmate-admin.js', array('jquery'), $this->version, false);

		// Localize the script with WordPress nonce
		wp_localize_script($this->plugin_name, 'helpmateApiSettings', array(
			'nonce' => wp_create_nonce('wp_rest'),
			'site_url' => get_site_url()
		));


		// Check if we're on the Helpmate admin page
		$screen = get_current_screen();
		if ($screen && $screen->id === 'toplevel_page_helpmate') {
			$is_dev = defined('WP_HELPMATE_DEV') && WP_HELPMATE_DEV;

			if (!$is_dev) {
				// Production mode - load compiled JS
				$vite_app_url = plugin_dir_url(__FILE__) . 'app/';
				$dist_dir = plugin_dir_path(__FILE__) . 'app/dist/assets/';
				$js_files = glob($dist_dir . 'index-*.js');

				if (!empty($js_files)) {
					$latest_js = basename(end($js_files));
					wp_enqueue_script(
						$this->plugin_name . '-admin-vite',
						$vite_app_url . 'dist/assets/' . $latest_js,
						array(),
						$this->version,
						false
					);
					add_filter('wp_script_attributes', array($this, 'add_type_attribute'), 10, 1);
				}
			}
		}

	}

	/**
	 * Add the type attribute to the Vite script.
	 *
	 * @since    1.0.0
	 */
	public function add_type_attribute($attributes)
	{
		// Only do this for a specific script.
		if (isset($attributes['id']) && $attributes['id'] === $this->plugin_name . '-admin-vite-js') {
			$attributes['type'] = 'module';
		}

		return $attributes;
	}

	/**
	 * Add the plugin admin menu.
	 *
	 * @since    1.0.0
	 */
	public function add_plugin_admin_menu()
	{
		add_menu_page(
			'Helpmate',
			'Helpmate',
			'manage_options',
			'helpmate',
			array($this, 'display_plugin_setup_page'),
			plugin_dir_url(__FILE__) . 'image/helpmate-wp-menu-icon.svg',
			58
		);

		add_submenu_page(
			'helpmate',
			'Dashboard',
			'Dashboard',
			'manage_options',
			'helpmate',
			array($this, 'display_plugin_setup_page')
		);

		add_submenu_page(
			'helpmate',
			'Train Chatbot',
			'Train Chatbot',
			'manage_options',
			'helpmate&tab=data-source',
			array($this, 'display_plugin_setup_page')
		);

		// Add submenus
		add_submenu_page(
			'helpmate',
			'App Center',
			'App Center',
			'manage_options',
			'helpmate&tab=apps',
			array($this, 'display_plugin_setup_page')
		);

		add_submenu_page(
			'helpmate',
			'Get Help',
			'Get Help',
			'manage_options',
			'helpmate-get-help',
			array($this, 'redirect_to_support')
		);

		add_submenu_page(
			'helpmate',
			'Upgrade',
			'Upgrade',
			'manage_options',
			'helpmate-upgrade',
			array($this, 'redirect_to_pricing')
		);
	}

	/**
	 * Display the plugin setup page.
	 *
	 * @since    1.0.0
	 */
	public function display_plugin_setup_page()
	{
		include_once plugin_dir_path(__FILE__) . 'partials/helpmate-admin-display.php';
	}

	/**
	 * Enqueue the media library for the plugin.
	 *
	 * @since    1.0.0
	 */
	public function enqueue_media($hook)
	{
		// Load media library only on your plugin page
		if ($hook !== 'toplevel_page_helpmate')
			return;

		wp_enqueue_media();
	}

	/**
	 * Redirect to support page.
	 *
	 * @since    1.0.0
	 */
	public function redirect_to_support()
	{
		wp_redirect('https://rhapsodyplugins.com/contact');
		exit;
	}

	/**
	 * Redirect to pricing page.
	 *
	 * @since    1.0.0
	 */
	public function redirect_to_pricing()
	{
		wp_redirect('https://rhapsodyplugins.com/helpmate/#pricing');
		exit;
	}

	/**
	 * Add custom CSS for menu highlighting.
	 *
	 * @since    1.0.0
	 */
	public function add_menu_highlighting_css()
	{
		$screen = get_current_screen();
		if ($screen && $screen->id === 'toplevel_page_helpmate') {
			// Sanitize tab parameter for CSS highlighting
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Used for CSS highlighting only, not security-sensitive
			$tab = isset($_GET['tab']) ? sanitize_text_field(wp_unslash($_GET['tab'])) : '';

			if ($tab === 'apps') {
				add_filter('admin_body_class', function($classes) {
					return $classes . ' helpmate-apps-tab';
				});
			}

			if ($tab === 'data-source') {
				add_filter('admin_body_class', function($classes) {
					return $classes . ' helpmate-data-source-tab';
				});
			}
		}
	}

}
