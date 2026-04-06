<?php

/**
 * The core plugin class.
 *
 * This is used to define internationalization, admin-specific hooks, and
 * public-facing site hooks.
 *
 * Also maintains the unique identifier of this plugin as well as the current
 * version of the plugin.
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

class Helpmate
{

	/**
	 * The loader that's responsible for maintaining and registering all hooks that power
	 * the plugin.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      Helpmate_Loader    $loader    Maintains and registers all hooks for the plugin.
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
	 * @var      Helpmate_Database    $database    The database instance.
	 */
	protected $database;

	/**
	 * The settings handler instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      Helpmate_Settings    $settings    The settings handler instance.
	 */
	protected $settings;

	/**
	 * The api instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      Helpmate_Api    $api    The api instance.
	 */
	protected $api;

	/**
	 * The chat instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Chat    $chat    The chat instance.
	 */
	private $chat;

	/**
	 * The document handler instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Document_Handler    $document_handler    The document handler instance.
	 */
	private $document_handler;

	/**
	 * The backend routes instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Backend_Routes    $backend_routes    The backend routes instance.
	 */
	private $backend_routes;

	/**
	 * The frontend routes instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Frontend_Routes    $frontend_routes    The frontend routes instance.
	 */
	private $frontend_routes;

	/**
	 * The dashboard instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Dashboard    $dashboard    The dashboard instance.
	 */
	private $dashboard;

	/**
	 * The leads instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Leads    $leads    The leads instance.
	 */
	private $leads;

	/**
	 * The promo banner instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Promo_Banner    $promo_banner    The promo banner instance.
	 */
	private $promo_banner;

	/**
	 * The sales notification instance.
	 *
	 * @since    1.0.0
	 * @access   protected
	 * @var      Helpmate_Sales_Notification    $sales_notification    The sales notification instance.
	 */
	protected $sales_notification;

	/**
	 * The ticket instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Ticket    $ticket    The ticket instance.
	 */
	private $ticket;

	/**
	 * The analytics instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Analytics    $analytics    The analytics instance.
	 */
	private $analytics;

	/**
	 * The woocommerce instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_WooCommerce    $woocommerce    The woocommerce instance.
	 */
	private $woocommerce;

	/**
	 * The Easy Digital Downloads instance.
	 *
	 * @since    2.0.3
	 * @access   private
	 * @var      Helpmate_EDD    $edd    The EDD instance.
	 */
	private $edd;

	/**
	 * The SureCart instance.
	 *
	 * @since    2.0.4
	 * @access   private
	 * @var      Helpmate_SureCart    $surecart    The SureCart instance.
	 */
	private $surecart;

	/**
	 * The general tools instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_General_Tools    $general_tools    The general tools instance.
	 */
	private $general_tools;

	/**
	 * The background processor instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Background_Processor    $background_processor    The background processor instance.
	 */
	private $background_processor;

	/**
	 * The job tracker instance.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Job_Tracker    $job_tracker    The job tracker instance.
	 */
	private $job_tracker;

	/**
	 * The social chat instance.
	 *
	 * @since    1.2.0
	 * @access   private
	 * @var      Helpmate_Social_Chat    $social_chat    The social chat instance.
	 */
	private $social_chat;

	/**
	 * The CRM instance.
	 *
	 * @since    1.3.0
	 * @access   private
	 * @var      Helpmate_CRM    $crm    The CRM instance.
	 */
	private $crm;

	/**
	 * The Team instance.
	 *
	 * @since    1.3.0
	 * @access   private
	 * @var      Helpmate_Team    $team    The Team instance.
	 */
	private $team;

	/**
	 * The Notifications instance.
	 *
	 * @since    1.3.0
	 * @access   private
	 * @var      Helpmate_Notifications    $notifications    The Notifications instance.
	 */
	private $notifications;

	/**
	 * The Tasks instance.
	 *
	 * @since    1.1.7
	 * @access   private
	 * @var      Helpmate_Tasks    $tasks    The Tasks instance.
	 */
	private $tasks;

	/**
	 * The CRM Analytics instance.
	 *
	 * @since    1.3.0
	 * @access   private
	 * @var      Helpmate_Crm_Analytics    $crm_analytics    The CRM Analytics instance.
	 */
	private $crm_analytics;

	/**
	 * The CRM Order Metabox instance.
	 *
	 * @since    1.3.0
	 * @access   private
	 * @var      Helpmate_Crm_Order_Metabox    $crm_order_metabox    The CRM Order Metabox instance.
	 */
	private $crm_order_metabox;

	/**
	 * The post/page meta box instance for knowledge base.
	 *
	 * @since    1.0.0
	 * @access   private
	 * @var      Helpmate_Post_Meta_Box|null    $post_meta_box    The post meta box instance (null when not in admin).
	 */
	private $post_meta_box;

	/**
	 * Shared integration event service.
	 *
	 * @var Helpmate_Integration_Events
	 */
	private $integration_events;

	/**
	 * Contact Form 7 integration handler.
	 *
	 * @var Helpmate_CF7_Integration
	 */
	private $cf7_integration;


	/**
	 * Forminator custom forms integration handler.
	 *
	 * @var Helpmate_Forminator_Integration
	 */
	private $forminator_integration;

	/**
	 * WPForms integration handler.
	 *
	 * @var Helpmate_WPForms_Integration
	 */
	private $wpforms_integration;

	/**
	 * Ninja Forms integration handler.
	 *
	 * @var Helpmate_Ninja_Forms_Integration
	 */
	private $ninja_forms_integration;

	/**
	 * Formidable Forms integration handler.
	 *
	 * @var Helpmate_Formidable_Forms_Integration
	 */
	private $formidable_forms_integration;

	/**
	 * Integration plugin overview / install / activate (REST).
	 *
	 * @var Helpmate_Integration_Plugins
	 */
	private $integration_plugins;

	/**
	 * Public-facing plugin instance (shortcodes, front assets).
	 *
	 * @since 1.4.0
	 * @var Helpmate_Public|null
	 */
	private $plugin_public;


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

		$this->database = new Helpmate_Database();
		$this->settings = new Helpmate_Settings;
		$this->api = new Helpmate_Api($this->settings, $this->plugin_name);
		$this->dashboard = new Helpmate_Dashboard($this);
		$this->analytics = new Helpmate_Analytics();

		$this->chat = new Helpmate_Chat($this);
		$this->general_tools = new Helpmate_General_Tools($this);
		$this->leads = new Helpmate_Leads;
		$this->promo_banner = new Helpmate_Promo_Banner($this->settings);
		$this->sales_notification = new Helpmate_Sales_Notification($this->settings);
		$this->ticket = new Helpmate_Ticket($this->settings);

		$this->document_handler = new Helpmate_Document_Handler($this->api, $this->chat);
		$this->woocommerce = new Helpmate_WooCommerce($this->settings);
		$this->edd = new Helpmate_EDD($this->settings);
		$this->surecart = new Helpmate_SureCart($this->settings);
		$this->social_chat = new Helpmate_Social_Chat($this);
		$this->crm = new Helpmate_CRM($this);
		$this->crm_order_metabox = new Helpmate_Crm_Order_Metabox($this->crm);
		$this->team = new Helpmate_Team($this);
		$this->notifications = new Helpmate_Notifications($this);
		$this->tasks = new Helpmate_Tasks($this);
		$this->crm_analytics = new Helpmate_Crm_Analytics($this);
		$this->integration_events = new Helpmate_Integration_Events($this);
		$this->cf7_integration = new Helpmate_CF7_Integration($this, $this->integration_events);
		$this->forminator_integration = new Helpmate_Forminator_Integration($this, $this->integration_events);
		$this->wpforms_integration = new Helpmate_WPForms_Integration($this, $this->integration_events);
		$this->ninja_forms_integration = new Helpmate_Ninja_Forms_Integration($this, $this->integration_events);
		$this->formidable_forms_integration = new Helpmate_Formidable_Forms_Integration($this, $this->integration_events);
		$this->integration_plugins = new Helpmate_Integration_Plugins();

		// Initialize post/page meta box for knowledge base
		if (is_admin()) {
			$this->post_meta_box = new Helpmate_Post_Meta_Box($this, $this->settings, $this->document_handler);
		}

		// Initialize background processing
		$this->job_tracker = new Helpmate_Job_Tracker();
		$this->background_processor = new Helpmate_Background_Processor($this->document_handler, $this->chat, $this->job_tracker);

		$this->backend_routes = new Helpmate_Backend_Routes($this);
		$this->frontend_routes = new Helpmate_Frontend_Routes($this);

		if (!$this->is_helpmate_pro_active() && $this->api->get_key() && $this->api->get_product_slug() !== 'helpmate-free') {
			add_action('admin_notices', function () {
				echo '<div class="error"><p>' . esc_html__('Helpmate Pro Api key requires the Pro version of the plugin to be installed. Please install the Pro version of the plugin to continue.', 'helpmate-ai-chatbot') . '</p></div>';
			});
		}

		$this->define_admin_hooks();
		$this->define_public_hooks();

		// Elementor loads before this plugin (typical alphabetical order), so elementor/loaded may have already fired.
		if ( did_action( 'elementor/loaded' ) ) {
			$this->init_elementor_integration();
		} else {
			add_action( 'elementor/loaded', array( $this, 'init_elementor_integration' ) );
		}

		if ( function_exists( 'register_block_type' ) ) {
			Helpmate_Blocks::run( $this );
		}

		add_action( 'plugins_loaded', array( $this, 'init_beaver_integration' ), 20 );
	}

	/**
	 * Load Beaver Builder modules when the builder is active.
	 *
	 * @return void
	 */
	public function init_beaver_integration() {
		if ( ! class_exists( 'FLBuilder' ) ) {
			return;
		}
		require_once HELPMATE_DIR . 'includes/integrations/class-helpmate-beaver-builder.php';
		Helpmate_Beaver_Builder::instance()->run( $this );
	}

	/**
	 * Load Elementor widgets when Elementor is active.
	 *
	 * @return void
	 */
	public function init_elementor_integration() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return;
		}
		require_once HELPMATE_DIR . 'includes/integrations/class-helpmate-elementor.php';
		Helpmate_Elementor::instance()->run( $this );
	}

	/**
	 * Load the required dependencies for this plugin.
	 *
	 * Include the following files that make up the plugin:
	 *
	 * - Helpmate_Loader. Orchestrates the hooks of the plugin.
	 * - Helpmate_i18n. Defines internationalization functionality.
	 * - Helpmate_Admin. Defines all hooks for the admin area.
	 * - Helpmate_Public. Defines all hooks for the public side of the site.
	 * - Helpmate_Database. Defines the database functionality.
	 * - Helpmate_Settings. Defines the settings functionality.
	 * - Helpmate_Api. Defines the api functionality.
	 * - Helpmate_Security. Defines the security functionality.
	 * - Helpmate_Dashboard. Defines the dashboard functionality.
	 * - Helpmate_Analytics. Defines the analytics functionality.
	 * - Helpmate_Chat. Defines the chat functionality.
	 * - Helpmate_Document_Handler. Defines the document handler functionality.
	 * - Helpmate_Backend_Routes. Defines the backend routes functionality.
	 * - Helpmate_Frontend_Routes. Defines the frontend routes functionality
	 * - Helpmate_Leads. Defines the leads functionality.
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
			'includes/class-helpmate-api.php',
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
			'includes/modules/class-helpmate-edd.php',
			'includes/modules/class-helpmate-surecart.php',
			'includes/modules/class-helpmate-social-chat.php',
			'includes/modules/class-helpmate-crm.php',
			'includes/modules/class-helpmate-crm-order-metabox.php',
			'includes/modules/class-helpmate-team.php',
			'includes/class-helpmate-notifications.php',
			'includes/class-helpmate-realtime.php',
			'includes/modules/class-helpmate-tasks.php',
			'includes/modules/class-helpmate-crm-analytics.php',
			'includes/modules/class-helpmate-post-meta-box.php',
			'includes/class-helpmate-permissions.php',
			'includes/social/class-helpmate-social-message-processor.php',
			'includes/class-helpmate-background-processor.php',
			'includes/class-helpmate-job-tracker.php',
			'includes/commerce/interface-commerce-provider-adapter.php',
			'includes/commerce/class-helpmate-commerce-woocommerce-adapter.php',
			'includes/commerce/class-helpmate-commerce-edd-adapter.php',
			'includes/commerce/class-helpmate-commerce-surecart-adapter.php',
			'includes/commerce/class-helpmate-commerce-adapter-registry.php',
			'includes/integrations/class-helpmate-integration-events.php',
			'includes/integrations/class-helpmate-cf7-integration.php',
			'includes/integrations/class-helpmate-forminator-integration.php',
			'includes/integrations/class-helpmate-wpforms-integration.php',
			'includes/integrations/class-helpmate-ninja-forms-integration.php',
			'includes/integrations/class-helpmate-formidable-forms-integration.php',
			'includes/integrations/class-helpmate-integration-plugins.php',
			'includes/integrations/class-helpmate-elementor-utils.php',
			'includes/integrations/class-helpmate-blocks.php',
		);

		foreach ($required_files as $file) {
			$file_path = HELPMATE_DIR . $file;
			if (!file_exists($file_path)) {
				throw new Exception(
					esc_html(
						sprintf(
							/* translators: 1: File name */
							__('Required file %s not found.', 'helpmate-ai-chatbot'),
							esc_html($file)
						)
					)
				);
			}
			require_once $file_path;
		}

		$this->loader = new Helpmate_Loader();
	}

	/**
	 * Define the locale for this plugin for internationalization.
	 *
	 * Uses the Helpmate_i18n class in order to set the domain and to register the hook
	 * with WordPress.
	 *
	 * @since    1.0.0
	 * @access   private
	 */
	private function set_locale()
	{
		$plugin_i18n = new Helpmate_i18n();

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
		// Check for plugin updates and create default templates if needed
		add_action('admin_init', [$this, 'check_plugin_update']);
		$plugin_admin = new Helpmate_Admin($this->get_plugin_name(), $this->get_version());

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
		$this->plugin_public = new Helpmate_Public($this->get_plugin_name(), $this->get_version(), $this->promo_banner, $this->sales_notification);

		$this->loader->add_action('wp_enqueue_scripts', $this->plugin_public, 'enqueue_styles');
		$this->loader->add_action('wp_enqueue_scripts', $this->plugin_public, 'enqueue_scripts');
		$this->loader->add_action('rest_api_init', $this->frontend_routes, 'register_routes');
		// Register backend routes with priority 20 to ensure custom fields route runs after pro plugin
		// This allows our route to take precedence when pro route blocks access
		$this->loader->add_action('rest_api_init', $this->backend_routes, 'register_routes', 20);
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
	 * @return Helpmate_Database The database instance.
	 */
	public function get_database()
	{
		return $this->database;
	}

	/**
	 * Get the settings instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Settings The settings instance.
	 */
	public function get_settings()
	{
		return $this->settings;
	}

	/**
	 * Get the document handler instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Document_Handler The document handler instance.
	 */
	public function get_document_handler()
	{
		return $this->document_handler;
	}

	/**
	 * Get the chat instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Chat The chat instance.
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
	 * Create default email templates if they don't exist.
	 *
	 * @since    1.3.0
	 */
	public function create_default_email_templates()
	{
		// Create default email templates if they don't exist
		if ($this->crm) {
			// Migrate existing default templates first
			$this->crm->migrate_existing_default_templates();

			$this->crm->create_default_smart_schedule_templates();

			// Create abandoned cart follow-up templates and set them in settings
			$followup_templates = $this->crm->create_default_abandoned_cart_followup_templates();

			// Create refund return template and set it in settings
			$refund_template_id = $this->crm->create_default_refund_return_template();

			// Create abandoned cart initial template and set it in settings
			$abandoned_cart_template_id = $this->crm->create_default_abandoned_cart_template();

			// Set abandoned cart settings with initial template
			if ($abandoned_cart_template_id) {
				$abandoned_cart_settings = $this->settings->get_setting('abandoned_cart');
				if ($abandoned_cart_settings) {
					// Only set if not already set
					if (!isset($abandoned_cart_settings['selected_email_template']) || !$abandoned_cart_settings['selected_email_template']) {
						$abandoned_cart_settings['selected_email_template'] = $abandoned_cart_template_id;
						$this->settings->set_setting('abandoned_cart', $abandoned_cart_settings);
					}
				} else {
					// Create new settings with the template
					$this->settings->set_setting('abandoned_cart', [
						'selected_email_template' => $abandoned_cart_template_id,
						'abandoned_cart_after' => '60',
						'delete_abandoned_cart_after' => '10080',
						'cart_recovery_button_text' => 'Recover Cart',
						'coupon_code' => '',
						'follow_up_emails' => [],
					]);
				}
			}

			// Set abandoned cart follow-up emails in settings
			if (!empty($followup_templates)) {
				$abandoned_cart_settings = $this->settings->get_setting('abandoned_cart');
				if (!$abandoned_cart_settings) {
					$abandoned_cart_settings = [];
				}

				$follow_up_emails = isset($abandoned_cart_settings['follow_up_emails']) ? $abandoned_cart_settings['follow_up_emails'] : [];

				// Check if default follow-up emails already exist
				$existing_ids = array_column($follow_up_emails, 'id');
				$next_id = !empty($existing_ids) ? max($existing_ids) + 1 : 1;

				// Create default follow-up email entries if they don't exist
				$default_emails = [
					[
						'id' => $next_id++,
						'delay' => 3,
						'delayUnit' => 'hours',
						'template_id' => $followup_templates['first'] ?? null,
						'enabled' => false, // Disabled by default
					],
					[
						'id' => $next_id++,
						'delay' => 1,
						'delayUnit' => 'days',
						'template_id' => $followup_templates['second'] ?? null,
						'enabled' => false, // Disabled by default
					],
					[
						'id' => $next_id++,
						'delay' => 3,
						'delayUnit' => 'days',
						'template_id' => $followup_templates['third'] ?? null,
						'enabled' => false, // Disabled by default
					],
				];

				// Only add emails that don't already exist (check by template_id)
				$existing_template_ids = array_column($follow_up_emails, 'template_id');
				foreach ($default_emails as $default_email) {
					if ($default_email['template_id'] && !in_array($default_email['template_id'], $existing_template_ids)) {
						$follow_up_emails[] = $default_email;
					}
				}

				// Update settings with new follow-up emails
				$abandoned_cart_settings['follow_up_emails'] = $follow_up_emails;
				$this->settings->set_setting('abandoned_cart', $abandoned_cart_settings);
			}

			// Set refund return settings with template
			if ($refund_template_id) {
				$refund_settings = $this->settings->get_setting('refund_return');
				if ($refund_settings) {
					// Only set if not already set
					if (!isset($refund_settings['selected_email_template']) || !$refund_settings['selected_email_template']) {
						$refund_settings['selected_email_template'] = $refund_template_id;
						$this->settings->set_setting('refund_return', $refund_settings);
					}
				} else {
					// Create new settings with the template
					$this->settings->set_setting('refund_return', [
						'selected_email_template' => $refund_template_id,
						'policy_url' => '',
						'reasons' => [],
					]);
				}
			}
		}
	}

	/**
	 * Check for plugin updates and create default templates if needed.
	 *
	 * @since    1.3.0
	 */
	public function check_plugin_update()
	{
		$stored_version = get_option('helpmate_version');
		$current_version = HELPMATE_VERSION;

		// If version has changed or templates haven't been created, create them
		if ($stored_version !== $current_version || !$stored_version) {
			// Create default email templates
			$this->create_default_email_templates();

			$commerce_settings = $this->settings->get_setting('commerce_integration');
			$detected_providers = $this->get_detected_commerce_providers();
			$default_selected_provider = '';
			if (count($detected_providers) === 1) {
				$default_selected_provider = $detected_providers[0];
			}

			if (!is_array($commerce_settings) || empty($commerce_settings)) {
				$this->settings->set_setting('commerce_integration', [
					'enabled' => true,
					'selected_provider' => $default_selected_provider,
				]);
			} else {
				$selected_provider = isset($commerce_settings['selected_provider']) ? (string) $commerce_settings['selected_provider'] : '';
				if (empty($selected_provider) && count($detected_providers) === 1) {
					$commerce_settings['selected_provider'] = $default_selected_provider;
					$commerce_settings['enabled'] = true;
					$this->settings->set_setting('commerce_integration', $commerce_settings);
				}
			}

			// Update stored version
			update_option('helpmate_version', $current_version);
		}
	}

	/**
	 * The reference to the class that orchestrates the hooks with the plugin.
	 *
	 * @since     1.0.0
	 * @return    Helpmate_Loader    Orchestrates the hooks of the plugin.
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
	 * Check if Easy Digital Downloads is active.
	 *
	 * @since 2.0.3
	 * @return bool Whether Easy Digital Downloads is active.
	 */
	public function is_edd_active()
	{
		return is_plugin_active('easy-digital-downloads/easy-digital-downloads.php');
	}

	/**
	 * Check if SureCart is active.
	 *
	 * @since 2.0.4
	 * @return bool Whether SureCart is active.
	 */
	public function is_surecart_active()
	{
		return is_plugin_active('surecart/surecart.php');
	}

	/**
	 * Get commerce integration settings.
	 *
	 * @since 2.0.3
	 * @return array Commerce integration settings.
	 */
	public function get_commerce_integration_settings(): array
	{
		$settings = $this->settings->get_setting('commerce_integration');
		if (!is_array($settings)) {
			$settings = [];
		}

		return [
			'enabled' => !array_key_exists('enabled', $settings) || !empty($settings['enabled']),
			'selected_provider' => isset($settings['selected_provider']) ? (string) $settings['selected_provider'] : '',
			'provider_selection_required' => count($this->get_detected_commerce_providers()) > 1 && empty($settings['selected_provider']),
		];
	}

	/**
	 * Get detected commerce providers by plugin activation only.
	 *
	 * @since 2.0.3
	 * @return array
	 */
	public function get_detected_commerce_providers(): array
	{
		$providers = [];
		if ($this->is_woocommerce_active()) {
			$providers[] = 'woocommerce';
		}
		if ($this->is_edd_active()) {
			$providers[] = 'easy_digital_downloads';
		}
		if ($this->is_surecart_active()) {
			$providers[] = 'surecart';
		}
		return $providers;
	}

	/**
	 * Get active commerce providers.
	 *
	 * @since 2.0.3
	 * @return array Active commerce provider keys.
	 */
	public function get_active_commerce_providers(): array
	{
		$selected = $this->get_primary_commerce_provider();
		if (!empty($selected)) {
			return [$selected];
		}
		return [];
	}

	/**
	 * Get the primary commerce provider key.
	 *
	 * @since 2.0.3
	 * @return string Primary commerce provider.
	 */
	public function get_primary_commerce_provider(): string
	{
		$settings = $this->get_commerce_integration_settings();
		$detected = $this->get_detected_commerce_providers();
		$selected = isset($settings['selected_provider']) ? (string) $settings['selected_provider'] : '';
		if (!empty($selected) && in_array($selected, $detected, true)) {
			return $selected;
		}
		if (count($detected) === 1) {
			return $detected[0];
		}
		return '';
	}

	/**
	 * Whether the primary commerce plugin is installed and active.
	 *
	 * @since 2.0.5
	 * @return bool
	 */
	public function is_primary_commerce_plugin_active(): bool
	{
		$primary = $this->get_primary_commerce_provider();
		if ('' === $primary) {
			return false;
		}
		if ('woocommerce' === $primary) {
			return $this->is_woocommerce_active();
		}
		if ('easy_digital_downloads' === $primary) {
			return $this->is_edd_active();
		}
		if ('surecart' === $primary) {
			return $this->is_surecart_active();
		}
		return false;
	}

	/**
	 * Image search is allowed (module on, Pro, primary set, primary plugin active).
	 *
	 * @since 2.0.5
	 * @return bool
	 */
	public function is_image_search_operational(): bool
	{
		if ($this->get_product_slug() === 'helpmate-free' || !$this->is_helpmate_pro_active()) {
			return false;
		}
		$modules = $this->settings->get_setting('modules');
		if (!is_array($modules) || empty($modules[HELPMATE_MODULE_IMAGE_SEARCH])) {
			return false;
		}
		$primary = $this->get_primary_commerce_provider();
		if ('' === $primary) {
			return false;
		}
		$detected = $this->get_detected_commerce_providers();
		if (!in_array($primary, $detected, true)) {
			return false;
		}
		return $this->is_primary_commerce_plugin_active();
	}

	/**
	 * Commerce catalog is usable for the current primary (provider set + plugin active).
	 *
	 * @since 2.0.5
	 * @return bool
	 */
	public function is_commerce_catalog_operational(): bool
	{
		return '' !== $this->get_primary_commerce_provider() && $this->is_primary_commerce_plugin_active();
	}

	/**
	 * Whether sales-notification toasts should run for the current commerce setup.
	 *
	 * @since 2.0.5
	 * @return bool
	 */
	public function is_sales_notification_commerce_active(): bool
	{
		return $this->is_commerce_catalog_operational();
	}

	/**
	 * Get the ticket instance.
	 *
	 * @since    1.0.0
	 * @return    Helpmate_Ticket    The ticket instance.
	 */
	public function get_ticket()
	{
		return $this->ticket;
	}

	/**
	 * Get the backend routes instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Backend_Routes The backend routes instance.
	 */
	public function get_backend_routes()
	{
		return $this->backend_routes;
	}

	/**
	 * Get the frontend routes instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Frontend_Routes The frontend routes instance.
	 */
	public function get_frontend_routes()
	{
		return $this->frontend_routes;
	}

	/**
	 * Get the dashboard instance.
	 *
	 * @since    1.0.0
	 * @return   Helpmate_Dashboard
	 */
	public function get_dashboard()
	{
		return $this->dashboard;
	}

	/**
	 * Get the leads instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Leads The leads instance.
	 */
	public function get_leads()
	{
		return $this->leads;
	}

	/**
	 * Get the analytics instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Analytics The analytics instance.
	 */
	public function get_analytics()
	{
		return $this->analytics;
	}

	/**
	 * Get the woocommerce instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_WooCommerce The woocommerce instance.
	 */
	public function get_woocommerce()
	{
		return $this->woocommerce;
	}

	/**
	 * Get the EDD instance.
	 *
	 * @since 2.0.3
	 * @return Helpmate_EDD The EDD instance.
	 */
	public function get_edd()
	{
		return $this->edd;
	}

	/**
	 * Get the SureCart instance.
	 *
	 * @since 2.0.4
	 * @return Helpmate_SureCart The SureCart instance.
	 */
	public function get_surecart()
	{
		return $this->surecart;
	}

	/**
	 * Get selected commerce adapter instance.
	 *
	 * @since 2.0.3
	 * @return CommerceProviderAdapter|null
	 */
	public function get_commerce_adapter()
	{
		$provider = $this->get_primary_commerce_provider();
		if (empty($provider)) {
			return null;
		}
		$registry = new Helpmate_Commerce_Adapter_Registry($this);
		return $registry->get_adapter($provider);
	}

	/**
	 * Get the general tools instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_General_Tools The general tools instance.
	 */
	public function get_general_tools()
	{
		return $this->general_tools;
	}

	/**
	 * Get the background processor instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Background_Processor The background processor instance.
	 */
	public function get_background_processor()
	{
		return $this->background_processor;
	}

	/**
	 * Get the job tracker instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Job_Tracker The job tracker instance.
	 */
	public function get_job_tracker()
	{
		return $this->job_tracker;
	}

	/**
	 * Get the api instance.
	 *
	 * @since 1.0.0
	 * @return Helpmate_Api The api instance.
	 */
	public function get_api()
	{
		return $this->api;
	}

	/**
	 * Check if Helpmate Pro is active.
	 *
	 * @since 1.0.0
	 * @return bool Whether Helpmate Pro is active.
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
		return $this->api->get_product_slug();
	}

	/**
	 * Get the social chat instance.
	 *
	 * @since 1.2.0
	 * @return Helpmate_Social_Chat The social chat instance.
	 */
	public function get_social_chat()
	{
		return $this->social_chat;
	}

	/**
	 * Get the CRM instance.
	 *
	 * @since 1.3.0
	 * @return Helpmate_CRM The CRM instance.
	 */
	public function get_crm()
	{
		return $this->crm;
	}

	/**
	 * Get the Team instance.
	 *
	 * @since 1.3.0
	 * @return Helpmate_Team The Team instance.
	 */
	public function get_team()
	{
		return $this->team;
	}

	/**
	 * Get the Notifications instance.
	 *
	 * @since 1.3.0
	 * @return Helpmate_Notifications The Notifications instance.
	 */
	public function get_notifications()
	{
		return $this->notifications;
	}

	/**
	 * Get the Tasks instance.
	 *
	 * @since 1.1.7
	 * @return Helpmate_Tasks The Tasks instance.
	 */
	public function get_tasks()
	{
		return $this->tasks;
	}

	/**
	 * Get the CRM Analytics instance.
	 *
	 * @since    1.3.0
	 * @return   Helpmate_Crm_Analytics The CRM Analytics instance.
	 */
	public function get_crm_analytics()
	{
		return $this->crm_analytics;
	}

	/**
	 * Get the promo banner instance.
	 *
	 * @since    1.0.0
	 * @return   Helpmate_Promo_Banner The promo banner instance.
	 */
	public function get_promo_banner()
	{
		return $this->promo_banner;
	}

	/**
	 * Public class instance (shortcodes, scheduling, front hooks).
	 *
	 * @since 1.4.0
	 * @return Helpmate_Public|null
	 */
	public function get_plugin_public()
	{
		return $this->plugin_public;
	}

	/**
	 * Get the sales notification instance.
	 *
	 * @since    1.0.0
	 * @return   Helpmate_Sales_Notification The sales notification instance.
	 */
	public function get_sales_notification()
	{
		return $this->sales_notification;
	}

	/**
	 * Get the integration events service instance.
	 *
	 * @return Helpmate_Integration_Events
	 */
	public function get_integration_events()
	{
		return $this->integration_events;
	}

	/**
	 * Get the Contact Form 7 integration instance.
	 *
	 * @return Helpmate_CF7_Integration
	 */
	public function get_cf7_integration()
	{
		return $this->cf7_integration;
	}

	/**
	 * Get the Forminator integration instance.
	 *
	 * @return Helpmate_Forminator_Integration
	 */
	public function get_forminator_integration()
	{
		return $this->forminator_integration;
	}

	/**
	 * Get the WPForms integration instance.
	 *
	 * @return Helpmate_WPForms_Integration
	 */
	public function get_wpforms_integration()
	{
		return $this->wpforms_integration;
	}

	/**
	 * Get the Ninja Forms integration instance.
	 *
	 * @return Helpmate_Ninja_Forms_Integration
	 */
	public function get_ninja_forms_integration()
	{
		return $this->ninja_forms_integration;
	}

	/**
	 * Get the Formidable Forms integration instance.
	 *
	 * @return Helpmate_Formidable_Forms_Integration
	 */
	public function get_formidable_forms_integration()
	{
		return $this->formidable_forms_integration;
	}

	/**
	 * Integration plugins helper (overview / install / activate).
	 *
	 * @return Helpmate_Integration_Plugins
	 */
	public function get_integration_plugins()
	{
		return $this->integration_plugins;
	}

}
