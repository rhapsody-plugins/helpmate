<?php

/**
 * The file that defines the core plugin class
 *
 * A class definition that includes attributes and functions used across both the
 * public-facing side of the site and the admin area.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

/**
 * The core plugin class.
 *
 * This is used to define internationalization, admin-specific hooks, and
 * public-facing site hooks.
 *
 * Also maintains the unique identifier of this plugin as well as the current
 * version of the plugin.
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
	exit;

class HelpMate
{

	/**
	 * The loader that's responsible for maintaining and registering all hooks that power
	 * the plugin.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      HelpMate_Loader    $loader    Maintains and registers all hooks for the plugin.
	 */
	protected $loader;

	/**
	 * The unique identifier of this plugin.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      string    $plugin_name    The string used to uniquely identify this plugin.
	 */
	protected $plugin_name;

	/**
	 * The current version of the plugin.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      string    $version    The current version of the plugin.
	 */
	protected $version;

	/**
	 * The database instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      HelpMate_Database    $database    The database instance.
	 */
	protected $database;

	/**
	 * The settings handler instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      HelpMate_Settings    $settings    The settings handler instance.
	 */
	protected $settings;

	/**
	 * The security instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      HelpMate_Security    $security    The security instance.
	 */
	protected $security;

	/**
	 * The license instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      HelpMate_License    $license    The license instance.
	 */
	protected $license;

	/**
	 * The chat instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Chat    $chat    The chat instance.
	 */
	private $chat;

	/**
	 * The document handler instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Document_Handler    $document_handler    The document handler instance.
	 */
	private $document_handler;

	/**
	 * The backend routes instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Backend_Routes    $backend_routes    The backend routes instance.
	 */
	private $backend_routes;

	/**
	 * The frontend routes instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Frontend_Routes    $frontend_routes    The frontend routes instance.
	 */
	private $frontend_routes;

	/**
	 * The dashboard instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Dashboard    $dashboard    The dashboard instance.
	 */
	private $dashboard;

	/**
	 * The leads instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Leads    $leads    The leads instance.
	 */
	private $leads;

	/**
	 * The promo banner instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Promo_Banner    $promo_banner    The promo banner instance.
	 */
	private $promo_banner;

	/**
	 * The sales notification instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      HelpMate_Sales_Notification    $sales_notification    The sales notification instance.
	 */
	protected $sales_notification;

	/**
	 * The ticket instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Ticket    $ticket    The ticket instance.
	 */
	private $ticket;

	/**
	 * The analytics instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Analytics    $analytics    The analytics instance.
	 */
	private $analytics;

	/**
	 * The woocommerce instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_WooCommerce    $woocommerce    The woocommerce instance.
	 */
	private $woocommerce;

	/**
	 * The general tools instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_General_Tools    $general_tools    The general tools instance.
	 */
	private $general_tools;

	/**
	 * The background processor instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Background_Processor    $background_processor    The background processor instance.
	 */
	private $background_processor;

	/**
	 * The job tracker instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      HelpMate_Job_Tracker    $job_tracker    The job tracker instance.
	 */
	private $job_tracker;

	/**
	 * Define the core functionality of the plugin.
	 *
	 * Set the plugin name and the plugin version that can be used throughout the plugin.
	 * Load the dependencies, define the locale, and set the hooks for the admin area and
	 * the public-facing side of the site.
	 *
	 * @since    1.0.0
	 */
	public function __construct()
	{
		if (defined('HELPMATE_VERSION')) {
			$this->version = HELPMATE_VERSION;
		} else {
			$this->version = '1.0.0';
		}
		$this->plugin_name = 'helpmate';

		$this->load_dependencies();
		$this->set_locale();

		$this->database = new HelpMate_Database();
		$this->settings = new HelpMate_Settings;
		$this->security = new HelpMate_Security($this->settings);
		$this->license = new HelpMate_License($this->settings, $this->plugin_name);
		$this->dashboard = new HelpMate_Dashboard;
		$this->analytics = new HelpMate_Analytics();

		$this->chat = new HelpMate_Chat($this);
		$this->general_tools = new HelpMate_General_Tools($this);
		$this->leads = new HelpMate_Leads;
		$this->promo_banner = new HelpMate_Promo_Banner($this->settings);
		$this->sales_notification = new HelpMate_Sales_Notification($this->settings);
		$this->ticket = new HelpMate_Ticket($this->settings);

		$this->document_handler = new HelpMate_Document_Handler($this->license, $this->chat);
		$this->woocommerce = new HelpMate_WooCommerce($this->settings);

		// Initialize background processing
		$this->job_tracker = new HelpMate_Job_Tracker();
		$this->background_processor = new HelpMate_Background_Processor($this->document_handler, $this->chat, $this->job_tracker);

		$this->backend_routes = new HelpMate_Backend_Routes($this);
		$this->frontend_routes = new HelpMate_Frontend_Routes($this);

		if (!$this->is_helpmate_pro_active() && $this->license->get_product_slug() !== 'helpmate-free') {
			add_action('admin_notices', function () {
				echo '<div class="error"><p>' . esc_html__('Helpmate Pro license requires the Pro version of the plugin to be installed. Please install the Pro version of the plugin to continue.', 'helpmate') . '</p></div>';
			});
		}

		$this->define_admin_hooks();
		$this->define_public_hooks();
	}

	/**
	 * Load the required dependencies for this plugin.
	 *
	 * Include the following files that make up the plugin:
	 *
	 * - HelpMate_Loader. Orchestrates the hooks of the plugin.
	 * - HelpMate_i18n. Defines internationalization functionality.
	 * - HelpMate_Admin. Defines all hooks for the admin area.
	 * - HelpMate_Public. Defines all hooks for the public side of the site.
	 * - HelpMate_Database. Defines the database functionality.
	 * - HelpMate_Settings. Defines the settings functionality.
	 * - HelpMate_License. Defines the license functionality.
	 * - HelpMate_Security. Defines the security functionality.
	 * - HelpMate_Dashboard. Defines the dashboard functionality.
	 * - HelpMate_Analytics. Defines the analytics functionality.
	 * - HelpMate_Chat. Defines the chat functionality.
	 * - HelpMate_Document_Handler. Defines the document handler functionality.
	 * - HelpMate_Backend_Routes. Defines the backend routes functionality.
	 * - HelpMate_Frontend_Routes. Defines the frontend routes functionality
	 * - HelpMate_Leads. Defines the leads functionality.
	 *
	 * Create an instance of the loader which will be used to register the hooks
	 * with WordPress.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function load_dependencies()
	{
		$required_files = array(
			'includes/class-helpmate-loader.php',
			'includes/class-helpmate-i18n.php',
			'admin/class-helpmate-admin.php',
			'public/class-helpmate-public.php',
			'includes/class-helpmate-database.php',
			'includes/class-helpmate-settings.php',
			'includes/class-helpmate-license.php',
			'includes/class-helpmate-security.php',
			'includes/class-helpmate-dashboard.php',
			'includes/class-helpmate-analytics.php',
			'includes/class-helpmate-document-handler.php',
			'includes/class-helpmate-backend-routes.php',
			'includes/class-helpmate-frontend-routes.php',
			'includes/chat/class-helpmate-chat.php',
			'includes/chat/class-helpmate-general-tools.php',
			'includes/modules/class-helpmate-leads.php',
			'includes/modules/class-helpmate-promo-banner.php',
			'includes/modules/class-helpmate-sales-notification.php',
			'includes/modules/class-helpmate-ticket.php',
			'includes/modules/class-helpmate-woocommerce.php',
			'includes/class-helpmate-background-processor.php',
			'includes/class-helpmate-job-tracker.php',
		);

		foreach ($required_files as $file) {
			$file_path = HELPMATE_DIR . $file;
			if (!file_exists($file_path)) {
				throw new Exception(
					esc_html(
						sprintf(
							/* translators: 1: File name */
							__('Required file %s not found.', 'helpmate'),
							esc_html($file)
						)
					)
				);
			}
			require_once $file_path;
		}

		$this->loader = new HelpMate_Loader();
	}

	/**
	 * Define the locale for this plugin for internationalization.
	 *
	 * Uses the HelpMate_i18n class in order to set the domain and to register the hook
	 * with WordPress.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function set_locale()
	{
		$plugin_i18n = new HelpMate_i18n();

		$this->loader->add_action('plugins_loaded', $plugin_i18n, 'load_plugin_textdomain');
	}

	/**
	 * Register all of the hooks related to the admin area functionality
	 * of the plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function define_admin_hooks()
	{
		$plugin_admin = new HelpMate_Admin($this->get_plugin_name(), $this->get_version());

		$this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_media');
		$this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_styles');
		$this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_scripts');
		$this->loader->add_action('admin_menu', $plugin_admin, 'add_plugin_admin_menu');
	}

	/**
	 * Register all of the hooks related to the public-facing functionality
	 * of the plugin.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function define_public_hooks()
	{
		$plugin_public = new HelpMate_Public($this->get_plugin_name(), $this->get_version(), $this->promo_banner);

		$this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
		$this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_scripts');
		$this->loader->add_action('rest_api_init', $this->frontend_routes, 'register_routes');
		$this->loader->add_action('rest_api_init', $this->backend_routes, 'register_routes');
	}

	/**
	 * Run the loader to execute all of the hooks with WordPress.
	 *
	 * @since    1.0.0
	 */
	public function run()
	{
		$this->loader->run();
	}

	/**
	 * Get the database instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Database The database instance.
	 */
	public function get_database()
	{
		return $this->database;
	}

	/**
	 * Get the settings instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Settings The settings instance.
	 */
	public function get_settings()
	{
		return $this->settings;
	}

	/**
	 * Get the security instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Security The security instance.
	 */
	public function get_security()
	{
		return $this->security;
	}

	/**
	 * Get the document handler instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Document_Handler The document handler instance.
	 */
	public function get_document_handler()
	{
		return $this->document_handler;
	}

	/**
	 * Get the chat instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Chat The chat instance.
	 */
	public function get_chat()
	{
		return $this->chat;
	}

	/**
	 * The name of the plugin used to uniquely identify it within the context of
	 * WordPress and to define internationalization functionality.
	 *
	 * @since     1.0.0
	 * @return    string    The name of the plugin.
	 */
	public function get_plugin_name()
	{
		return $this->plugin_name;
	}

	/**
	 * The reference to the class that orchestrates the hooks with the plugin.
	 *
	 * @since     1.0.0
	 * @return    HelpMate_Loader    Orchestrates the hooks of the plugin.
	 */
	public function get_loader()
	{
		return $this->loader;
	}

	/**
	 * Retrieve the version number of the plugin.
	 *
	 * @since     1.0.0
	 * @return    string    The version number of the plugin.
	 */
	public function get_version()
	{
		return $this->version;
	}

	/**
	 * Get the modules instance.
	 *
	 * @since 1.0.0
	 * @return bool Whether WooCommerce is active.
	 */
	public function is_woocommerce_active()
	{
		return is_plugin_active('woocommerce/woocommerce.php');
	}

	/**
	 * Get the promo banner instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Promo_Banner The promo banner instance.
	 */
	public function get_promo_banner()
	{
		return $this->promo_banner;
	}

	/**
	 * Get the sales notification instance.
	 *
	 * @since    1.0.0
	 * @return    HelpMate_Sales_Notification    The sales notification instance.
	 */
	public function get_sales_notification()
	{
		return $this->sales_notification;
	}

	/**
	 * Get the ticket instance.
	 *
	 * @since    1.0.0
	 * @return    HelpMate_Ticket    The ticket instance.
	 */
	public function get_ticket()
	{
		return $this->ticket;
	}

	/**
	 * Get the backend routes instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Backend_Routes The backend routes instance.
	 */
	public function get_backend_routes()
	{
		return $this->backend_routes;
	}

	/**
	 * Get the frontend routes instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Frontend_Routes The frontend routes instance.
	 */
	public function get_frontend_routes()
	{
		return $this->frontend_routes;
	}

	/**
	 * Get the dashboard instance.
	 *
	 * @since    1.0.0
	 * @return   HelpMate_Dashboard
	 */
	public function get_dashboard()
	{
		return $this->dashboard;
	}

	/**
	 * Get the leads instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Leads The leads instance.
	 */
	public function get_leads()
	{
		return $this->leads;
	}

	/**
	 * Get the analytics instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Analytics The analytics instance.
	 */
	public function get_analytics()
	{
		return $this->analytics;
	}

	/**
	 * Get the woocommerce instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_WooCommerce The woocommerce instance.
	 */
	public function get_woocommerce()
	{
		return $this->woocommerce;
	}

	/**
	 * Get the general tools instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_General_Tools The general tools instance.
	 */
	public function get_general_tools()
	{
		return $this->general_tools;
	}

	/**
	 * Get the background processor instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Background_Processor The background processor instance.
	 */
	public function get_background_processor()
	{
		return $this->background_processor;
	}

	/**
	 * Get the job tracker instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_Job_Tracker The job tracker instance.
	 */
	public function get_job_tracker()
	{
		return $this->job_tracker;
	}

	/**
	 * Get the license instance.
	 *
	 * @since 1.0.0
	 * @return HelpMate_License The license instance.
	 */
	public function get_license()
	{
		return $this->license;
	}

	/**
	 * Check if HelpMate Pro is active.
	 *
	 * @since 1.0.0
	 * @return bool Whether HelpMate Pro is active.
	 */
	public function is_helpmate_pro_active()
	{
		return is_plugin_active('helpmate-pro/helpmate-pro.php');
	}

	/**
	 * Get the product slug.
	 *
	 * @since 1.0.0
	 * @return string The product slug.
	 */
	public function get_product_slug()
	{
		return $this->license->get_product_slug();
	}
}
