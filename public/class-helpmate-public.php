<?php

/**
 * The public-facing functionality of the plugin.
 *
 * Defines the plugin name, version, and two examples hooks for how to
 * enqueue the public-facing stylesheet and JavaScript.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/public
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
	exit;

class Helpmate_Public
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
	 * @access   private
	 * @var      Helpmate_Sales_Notification|null    $sales_notification    The sales notification instance.
	 */
	private $sales_notification;

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 * @param      string    $plugin_name       The name of the plugin.
	 * @param      string    $version    The version of this plugin.
	 * @param      Helpmate_Promo_Banner|null    $promo_banner    The promo banner instance.
	 * @param      Helpmate_Sales_Notification|null    $sales_notification    The sales notification instance.
	 */
	public function __construct($plugin_name, $version, $promo_banner = null, $sales_notification = null)
	{

		$this->plugin_name = $plugin_name;
		$this->version = $version;
		$this->promo_banner = $promo_banner;
		$this->sales_notification = $sales_notification;

		// Add action to display Helpmate on all frontend pages
		add_action('wp_footer', array($this, 'display_helpmate'));

		// Register shortcode for Smart Schedules
		add_shortcode('helpmate_scheduling', array($this, 'render_scheduling_shortcode'));

		// Register unsubscribe page routes
		add_action('init', array($this, 'register_unsubscribe_rewrite_rules'));
		add_filter('query_vars', array($this, 'register_unsubscribe_query_vars'));
		add_action('template_redirect', array($this, 'handle_unsubscribe_page'));

		// Register early so Elementor (and other builders) can enqueue via script/style depends before render().
		add_action('wp_enqueue_scripts', array($this, 'register_scheduling_assets'), 1);

	}

	/**
	 * Register the stylesheets for the public-facing side of the site.
	 *
	 * @since    1.0.0
	 */
	/**
	 * Register Smart Schedules CSS/JS handles (enqueue when the form is rendered).
	 *
	 * @since 1.4.0
	 * @return void
	 */
	public function register_scheduling_assets()
	{
		$style_url = plugin_dir_url(__FILE__) . 'css/helpmate-scheduling.css';
		$script_url = plugin_dir_url(__FILE__) . 'js/helpmate-scheduling.js';
		wp_register_style(
			$this->plugin_name . '-scheduling',
			$style_url,
			array(),
			$this->version,
			'all'
		);
		wp_register_script(
			$this->plugin_name . '-scheduling',
			$script_url,
			array('jquery'),
			$this->version,
			true
		);
	}

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

		wp_enqueue_style($this->plugin_name, plugin_dir_url(__FILE__) . 'css/helpmate-public.css', array(), $this->version, 'all');

		$is_dev = defined('WP_HELPMATE_DEV') && WP_HELPMATE_DEV;

		if (!$is_dev) {
			// Production mode - load compiled CSS
			$vite_app_url = plugin_dir_url(__FILE__) . 'app/';
			$dist_dir = plugin_dir_path(__FILE__) . 'app/dist/assets/';
			$css_files = glob($dist_dir . 'index-*.css');

			if (!empty($css_files)) {
				$latest_css = basename(end($css_files));
				wp_enqueue_style(
					$this->plugin_name . '-public-vite',
					$vite_app_url . 'dist/assets/' . $latest_css,
					array(),
					$this->version,
					'all'
				);
			}
		}

	}

	/**
	 * Register the JavaScript for the public-facing side of the site.
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

		wp_enqueue_script($this->plugin_name, plugin_dir_url(__FILE__) . 'js/helpmate-public.js', array('jquery'), $this->version, false);

		if ($this->promo_banner) {
			$this->promo_banner->enqueue_assets();
		}

		if ($this->sales_notification) {
			$this->sales_notification->enqueue_assets();
		}

		// Localize the script with WordPress nonce
		wp_localize_script($this->plugin_name, 'helpmateApiSettings', array(
			'nonce' => wp_create_nonce('wp_rest'),
			'site_url' => get_site_url()
		));

		$is_dev = defined('WP_HELPMATE_DEV') && WP_HELPMATE_DEV;

		// Prepare configuration data
		$vite_app_url = plugin_dir_url(__FILE__) . 'app/';
		$dist_dir = plugin_dir_path(__FILE__) . 'app/dist/assets/';

		$js_files = glob($dist_dir . 'index-*.js');
		$css_files = glob($dist_dir . 'index-*.css');

		$latest_js = !empty($js_files) ? basename(end($js_files)) : '';
		$latest_css = !empty($css_files) ? basename(end($css_files)) : '';

		// Localize configuration data
		wp_localize_script($this->plugin_name, 'helpmateConfig', array(
			'isDev' => $is_dev,
			'viteAppUrl' => $vite_app_url,
			'latestJs' => $latest_js,
			'latestCss' => $latest_css,
			'cssUrl' => $vite_app_url . 'dist/assets/' . $latest_css,
			'jsUrl' => $vite_app_url . 'dist/assets/' . $latest_js
		));

		// Enqueue the shadow DOM setup script first
		wp_enqueue_script(
			$this->plugin_name . '-shadow-dom',
			plugin_dir_url(__FILE__) . 'js/helpmate-shadow-dom.js',
			array(),
			$this->version,
			true
		);

		if (!$is_dev) {
			// Production mode - load compiled JS
			if (!empty($js_files)) {
				wp_enqueue_script(
					$this->plugin_name . '-public-vite',
					$vite_app_url . 'dist/assets/' . $latest_js,
					array(),
					$this->version,
					false
				);
				add_filter('wp_script_attributes', array($this, 'add_type_attribute'), 10, 1);

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
		if (isset($attributes['id']) && $attributes['id'] === $this->plugin_name . '-public-vite-js') {
			$attributes['type'] = 'module';
		}

		return $attributes;
	}

	/**
	 * Display the Helpmate interface on all frontend pages.
	 *
	 * @since    1.0.0
	 */
	public function display_helpmate()
	{
		// Only display on frontend pages
		if (!is_admin()) {
			require_once plugin_dir_path(__FILE__) . 'partials/helpmate-public-display.php';
		}
	}

	/**
	 * Render the Smart Schedules shortcode.
	 *
	 * @since    1.3.0
	 * @param    array    $atts    Shortcode attributes.
	 * @return   string   HTML output.
	 */
	public function render_scheduling_shortcode($atts = array())
	{
		return $this->get_scheduling_form_html(array());
	}

	/**
	 * Output HTML for the Smart Schedules form (shortcode, Elementor, blocks).
	 *
	 * @since 1.4.0
	 * @param array $args {
	 *     @type string $instance_suffix Unique suffix for element IDs (alphanumeric).
	 *     @type string $heading_text    Optional heading; empty uses default translated string.
	 *     @type string $text_align      Optional left|center|right for root text-align.
	 * }
	 * @return string HTML or empty if disabled.
	 */
	public function get_scheduling_form_html($args = array())
	{
		$args = wp_parse_args(
			$args,
			array(
				'instance_suffix' => '',
				'heading_text'    => '',
				'text_align'      => '',
			)
		);

		$settings = $GLOBALS['helpmate']->get_settings()->get_setting('smart_schedules', array());

		if (empty($settings) || empty($settings['enabled'])) {
			return '';
		}

		wp_enqueue_style($this->plugin_name . '-scheduling');
		wp_enqueue_script($this->plugin_name . '-scheduling');

		wp_localize_script(
			$this->plugin_name . '-scheduling',
			'helpmateScheduling',
			array(
				'apiUrl' => rest_url('helpmate/v1/'),
				'nonce'  => wp_create_nonce('wp_rest'),
			)
		);

		$helpmate_scheduling_instance = $args['instance_suffix'];
		if ($helpmate_scheduling_instance === '') {
			$helpmate_scheduling_instance = 'sc-' . wp_generate_password(8, false, false);
		}
		$helpmate_scheduling_instance = preg_replace('/[^a-zA-Z0-9_-]/', '', $helpmate_scheduling_instance);
		if ($helpmate_scheduling_instance === '') {
			$helpmate_scheduling_instance = 'hm1';
		}

		$helpmate_scheduling_heading = $args['heading_text'] !== '' ? $args['heading_text'] : null;

		$helpmate_scheduling_text_align = '';
		if ( in_array( $args['text_align'], array( 'left', 'center', 'right' ), true ) ) {
			$helpmate_scheduling_text_align = $args['text_align'];
		}

		ob_start();
		include plugin_dir_path(__FILE__) . 'partials/helpmate-scheduling-form.php';
		return ob_get_clean();
	}

	/**
	 * Register rewrite rules for unsubscribe page.
	 *
	 * @since    1.3.0
	 */
	public function register_unsubscribe_rewrite_rules()
	{
		add_rewrite_rule(
			'^helpmate-unsubscribe/?$',
			'index.php?helpmate_unsubscribe=1',
			'top'
		);
	}

	/**
	 * Register query vars for unsubscribe page.
	 *
	 * @since    1.3.0
	 * @param    array    $vars    Existing query vars.
	 * @return   array    Modified query vars.
	 */
	public function register_unsubscribe_query_vars($vars)
	{
		$vars[] = 'helpmate_unsubscribe';
		return $vars;
	}

	/**
	 * Handle unsubscribe page request.
	 *
	 * @since    1.3.0
	 */
	public function handle_unsubscribe_page()
	{
		if (!get_query_var('helpmate_unsubscribe')) {
			return;
		}

		// Get parameters from URL
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Public unsubscribe link, no nonce needed
		$email_id = isset($_GET['email_id']) ? (int) $_GET['email_id'] : 0;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Public unsubscribe link, no nonce needed
		$contact_id = isset($_GET['contact_id']) ? (int) $_GET['contact_id'] : 0;

		$error = null;
		$success = false;
		$already_unsubscribed = false;

		if ($email_id && $contact_id) {
			// Check if already unsubscribed
			$crm = $GLOBALS['helpmate']->get_crm();
			$contact = $crm->get_contact($contact_id);

			if ($contact && strtolower($contact['status']) === 'unsubscribed') {
				$already_unsubscribed = true;
				$success = true;
			} elseif ($contact) {
				// Process unsubscribe
				$result = $crm->track_unsubscribe($email_id, $contact_id);
				$success = $result;
				if (!$result) {
					$error = __('Failed to unsubscribe. Please try again later.', 'helpmate-ai-chatbot');
				}
			} else {
				$error = __('Contact not found.', 'helpmate-ai-chatbot');
			}
		} else {
			$error = __('Invalid unsubscribe link.', 'helpmate-ai-chatbot');
		}

		// Enqueue unsubscribe page styles
		wp_enqueue_style(
			$this->plugin_name . '-unsubscribe',
			plugin_dir_url(__FILE__) . 'css/helpmate-unsubscribe.css',
			array(),
			$this->version,
			'all'
		);

		// Enqueue unsubscribe page script only when resubscribe is available
		if ($success && !$error) {
			wp_enqueue_script(
				$this->plugin_name . '-unsubscribe',
				plugin_dir_url(__FILE__) . 'js/helpmate-unsubscribe.js',
				array(),
				$this->version,
				true
			);

			wp_localize_script($this->plugin_name . '-unsubscribe', 'helpmateUnsubscribe', array(
				'restUrl' => rest_url('helpmate/v1/crm/resubscribe'),
				'contactId' => $contact_id,
				'i18n' => array(
					'processing' => __('Processing...', 'helpmate-ai-chatbot'),
					'error' => __('Failed to resubscribe. Please try again.', 'helpmate-ai-chatbot'),
				),
			));
		}

		// Render the unsubscribe page
		include plugin_dir_path(__FILE__) . 'partials/helpmate-unsubscribe-page.php';
		exit;
	}

}
