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

		// Add unread notification count to parent Helpmate menu (after add_plugin_admin_menu)
		add_action('admin_menu', array($this, 'add_notification_count_to_menu'), 999);

		// Add AJAX hooks for checklist functionality
		add_action('wp_ajax_helpmate_update_checklist', array($this, 'ajax_update_checklist'));
		add_action('wp_ajax_helpmate_skip_checklist', array($this, 'ajax_skip_checklist'));

		// Add redirect hook for main menu page
		add_action('admin_init', array($this, 'handle_menu_redirects'));

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

		// Enqueue deactivation feedback styles on plugins page
		if ($screen && $screen->id === 'plugins') {
			wp_enqueue_style(
				$this->plugin_name . '-deactivation-feedback',
				plugin_dir_url(__FILE__) . 'css/helpmate-deactivation-feedback.css',
				array(),
				$this->version,
				'all'
			);
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

		// Localize the script with WordPress nonce and REST base (canonical URL for API calls)
		wp_localize_script($this->plugin_name, 'helpmateApiSettings', array(
			'nonce' => wp_create_nonce('wp_rest'),
			'site_url' => get_site_url(),
			'rest_url' => rest_url('helpmate/v1'),
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
					$vite_handle = $this->plugin_name . '-admin-vite';
					wp_enqueue_script(
						$vite_handle,
						$vite_app_url . 'dist/assets/' . $latest_js,
						array(),
						$this->version,
						false
					);
					wp_localize_script($vite_handle, 'helpmateApiSettings', array(
						'nonce' => wp_create_nonce('wp_rest'),
						'site_url' => get_site_url(),
						'rest_url' => rest_url('helpmate/v1'),
					));
					add_filter('wp_script_attributes', array($this, 'add_type_attribute'), 10, 1);
				}
			}
		}

		// Enqueue deactivation feedback script on plugins page
		if ($screen && $screen->id === 'plugins') {
			wp_enqueue_script(
				$this->plugin_name . '-deactivation-feedback',
				plugin_dir_url(__FILE__) . 'js/helpmate-deactivation-feedback.js',
				array('jquery'),
				$this->version,
				true
			);
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
	 * Add unread notification count badge to the parent Helpmate menu item.
	 *
	 * @since    1.3.0
	 */
	public function add_notification_count_to_menu()
	{
		if (!isset($GLOBALS['menu']) || !isset($GLOBALS['helpmate'])) {
			return;
		}
		$helpmate = $GLOBALS['helpmate'];
		if (!method_exists($helpmate, 'get_notifications')) {
			return;
		}
		$notifications = $helpmate->get_notifications();
		$counts = $notifications->get_unread_counts();
		$count = isset($counts['total']) ? (int) $counts['total'] : 0;

		foreach ($GLOBALS['menu'] as $key => $item) {
			if (isset($item[2]) && $item[2] === 'helpmate') {
				$GLOBALS['menu'][ $key ][0] = $count > 0
					? 'Helpmate <span class="awaiting-mod">' . $count . '</span>'
					: 'Helpmate';
				break;
			}
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
			'edit_posts',
			'helpmate',
			array($this, 'display_plugin_setup_page'),
			plugin_dir_url(__FILE__) . 'image/helpmate-wp-menu-icon.svg',
			58
		);

		// Remove the duplicate "Helpmate" submenu that WordPress creates automatically
		remove_submenu_page('helpmate', 'helpmate');

		// Get current user ID for permission checks
		$current_user_id = get_current_user_id();

		// Dashboard - first menu item
		if (Helpmate_Permissions::can_access_feature($current_user_id, 'analytics')) {
			add_submenu_page(
				'helpmate',
				'Dashboard',
				'Dashboard',
				'edit_posts',
				'helpmate',
				array($this, 'display_plugin_setup_page')
			);
		}

		// Helpmate AI - Knowledge Base / Train Chatbot
		if (Helpmate_Permissions::can_access_feature($current_user_id, 'chat_settings')) {
			add_submenu_page(
				'helpmate',
				'Helpmate AI',
				'Helpmate AI',
				'edit_posts',
				'helpmate&tab=data-source',
				array($this, 'display_plugin_setup_page')
			);
		}

		// Automations - only show if API key exists and user has chat_settings permission
		if ($GLOBALS['helpmate']->get_api()->get_key() && Helpmate_Permissions::can_access_feature($current_user_id, 'chat_settings')) {
			add_submenu_page(
				'helpmate',
				'Automations',
				'Automations',
				'edit_posts',
				'helpmate&tab=automation&subtab=support-auto-responses',
				array($this, 'display_plugin_setup_page')
			);
		}

		// Inbox - requires live_chat
		if (Helpmate_Permissions::can_access_feature($current_user_id, 'live_chat')) {
			add_submenu_page(
				'helpmate',
				'Inbox',
				'Inbox',
				'edit_posts',
				'helpmate&tab=social-chat&subtab=inbox',
				array($this, 'display_plugin_setup_page')
			);
		}

		// Channels - show if user has chat_settings (social) or live_chat (live chat)
		$has_chat_settings = Helpmate_Permissions::can_access_feature($current_user_id, 'chat_settings');
		$has_live_chat = Helpmate_Permissions::can_access_feature($current_user_id, 'live_chat');
		if ($has_chat_settings || $has_live_chat) {
			$channels_url = $has_chat_settings
				? 'helpmate&tab=social-chat&subtab=facebook'
				: 'helpmate&tab=live-chat&subtab=settings';
			add_submenu_page(
				'helpmate',
				'Channels',
				'Channels',
				'edit_posts',
				$channels_url,
				array($this, 'display_plugin_setup_page')
			);
		}

		// CRM - show if user has permission
		if (
			Helpmate_Permissions::can_access_feature($current_user_id, 'crm_contacts') ||
			Helpmate_Permissions::can_access_feature($current_user_id, 'contacts_view') ||
			Helpmate_Permissions::can_access_feature($current_user_id, 'contacts_full')
		) {
			add_submenu_page(
				'helpmate',
				'CRM',
				'CRM',
				'edit_posts',
				'helpmate&tab=crm&subtab=contacts',
				array($this, 'display_plugin_setup_page')
			);
		}

		// Admin Hub - show if user has team_management, analytics, or manage_options
		if (
			Helpmate_Permissions::can_access_feature($current_user_id, 'team_management') ||
			Helpmate_Permissions::can_access_feature($current_user_id, 'analytics') ||
			user_can($current_user_id, 'manage_options')
		) {
			add_submenu_page(
				'helpmate',
				'Admin Hub',
				'Admin Hub',
				'edit_posts',
				'helpmate&tab=control-center&subtab=team',
				array($this, 'display_plugin_setup_page')
			);
		}

		add_submenu_page(
			'helpmate',
			'Get Help',
			'Get Help',
			'edit_posts',
			'helpmate-get-help',
			array($this, 'redirect_to_support')
		);

		add_submenu_page(
			'helpmate',
			'Upgrade',
			'Upgrade',
			'edit_posts',
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
	 * Handle menu redirects to ensure proper tab/subtab parameters.
	 *
	 * @since    1.0.0
	 */
	public function handle_menu_redirects()
	{
		// Get current page
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Used for routing only, not security-sensitive
		$page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Used for routing only, not security-sensitive
		$tab = isset($_GET['tab']) ? sanitize_text_field(wp_unslash($_GET['tab'])) : '';

		// Redirect main menu page (no tab) to dashboard
		if ($page === 'helpmate' && empty($tab)) {
			$url = add_query_arg(
				array(
					'page'    => 'helpmate',
					'tab'     => 'control-center',
					'subtab'  => 'dashboard',
				),
				admin_url('admin.php')
			);
			wp_safe_redirect($url);
			exit;
		}
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
		// phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- Safe hardcoded redirect to plugin support page
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
		// phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- Safe hardcoded redirect to plugin pricing page
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
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Used for CSS highlighting only, not security-sensitive
			$subtab = isset($_GET['subtab']) ? sanitize_text_field(wp_unslash($_GET['subtab'])) : '';

			if ($tab === 'control-center' && $subtab === 'dashboard') {
				add_filter('admin_body_class', function ($classes) {
					return $classes . ' helpmate-dashboard-tab';
				});
			}

			if ($tab === 'data-source') {
				add_filter('admin_body_class', function ($classes) {
					return $classes . ' helpmate-helpmate-ai-tab';
				});
			}

			if ($tab === 'automation') {
				add_filter('admin_body_class', function ($classes) {
					return $classes . ' helpmate-automation-tab';
				});
			}

			if ($tab === 'social-chat' && in_array($subtab, array('inbox', 'inbox-archived'), true)) {
				add_filter('admin_body_class', function ($classes) {
					return $classes . ' helpmate-inbox-tab';
				});
			}

			if (($tab === 'social-chat' && ! in_array($subtab, array('inbox', 'inbox-archived'), true)) ||
				$tab === 'live-chat') {
				add_filter('admin_body_class', function ($classes) {
					return $classes . ' helpmate-channels-tab';
				});
			}

			if ($tab === 'crm') {
				add_filter('admin_body_class', function ($classes) {
					return $classes . ' helpmate-crm-tab';
				});
			}

			if ($tab === 'control-center' && $subtab !== 'dashboard') {
				add_filter('admin_body_class', function ($classes) {
					return $classes . ' helpmate-admin-hub-tab';
				});
			}
		}
	}

}
