<?php

/**
 * The admin-specific functionality of the plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/admin
 */

/**
 * The admin-specific functionality of the plugin.
 *
 * Defines the plugin name, version, and two examples hooks for how to
 * enqueue the admin-specific stylesheet and JavaScript.
 *
 * @package    HelpMate
 * @subpackage HelpMate/admin
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
	exit;

class HelpMate_Admin
{

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
		 * defined in HelpMate_Loader as all of the hooks are defined
		 * in that particular class.
		 *
		 * The HelpMate_Loader will then create the relationship
		 * between the defined hooks and the functions defined in this
		 * class.
		 */

		wp_enqueue_style(HELPMATE_BASENAME, plugin_dir_url(__FILE__) . 'css/helpmate-admin.css', array(), HELPMATE_VERSION, 'all');


		// Check if we're on the HelpMate admin page
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
						HELPMATE_BASENAME . '-admin-vite',
						$vite_app_url . 'dist/assets/' . $latest_css,
						array(),
						HELPMATE_VERSION,
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
		 * defined in HelpMate_Loader as all of the hooks are defined
		 * in that particular class.
		 *
		 * The HelpMate_Loader will then create the relationship
		 * between the defined hooks and the functions defined in this
		 * class.
		 */

		wp_enqueue_script(HELPMATE_BASENAME, plugin_dir_url(__FILE__) . 'js/helpmate-admin.js', array('jquery'), HELPMATE_VERSION, false);

		// Localize the script with WordPress nonce
		wp_localize_script(HELPMATE_BASENAME, 'wpHelpmateApiSettings', array(
			'nonce' => wp_create_nonce('wp_rest'),
			'site_url' => get_site_url()
		));


		// Check if we're on the HelpMate admin page
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
						HELPMATE_BASENAME . '-admin-vite',
						$vite_app_url . 'dist/assets/' . $latest_js,
						array(),
						HELPMATE_VERSION,
						false
					);
				}
			}

			// Localize the script with WordPress nonce
			wp_localize_script(HELPMATE_BASENAME, 'wpHelpmateApiSettings', array(
				'nonce' => wp_create_nonce('wp_rest'),
				'site_url' => get_site_url()
			));
		}

		add_filter('script_loader_tag', 'add_type_attribute', 10, 3);
		function add_type_attribute($tag, $handle, $src)
		{
			if (HELPMATE_BASENAME . '-admin-vite' !== $handle) {
				return $tag;
			}
			return '<script type="module" src="' . esc_url($src) . '"></script>'; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript
		}

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

}
