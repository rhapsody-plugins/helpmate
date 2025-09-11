<?php

/**
 * The public-facing functionality of the plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/public
 */

/**
 * The public-facing functionality of the plugin.
 *
 * Defines the plugin name, version, and two examples hooks for how to
 * enqueue the public-facing stylesheet and JavaScript.
 *
 * @package    HelpMate
 * @subpackage HelpMate/public
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
	exit;

class HelpMate_Public
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
	 * @var      HelpMate_Promo_Banner    $promo_banner    The promo banner instance.
	 */
	private $promo_banner;

	/**
	 * Initialize the class and set its properties.
	 *
	 * @since    1.0.0
	 * @param      string    $plugin_name       The name of the plugin.
	 * @param      string    $version    The version of this plugin.
	 * @param      HelpMate_Promo_Banner    $promo_banner    The promo banner instance.
	 */
	public function __construct($plugin_name, $version, $promo_banner)
	{

		$this->plugin_name = $plugin_name;
		$this->version = $version;
		$this->promo_banner = $promo_banner;

		// Add action to display HelpMate on all frontend pages
		add_action('wp_footer', array($this, 'display_helpmate'));

	}

	/**
	 * Register the stylesheets for the public-facing side of the site.
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
		 * defined in HelpMate_Loader as all of the hooks are defined
		 * in that particular class.
		 *
		 * The HelpMate_Loader will then create the relationship
		 * between the defined hooks and the functions defined in this
		 * class.
		 */

		wp_enqueue_script($this->plugin_name, plugin_dir_url(__FILE__) . 'js/helpmate-public.js', array('jquery'), $this->version, false);

		// Localize the script with WordPress nonce
		wp_localize_script($this->plugin_name, 'helpmateApiSettings', array(
			'nonce' => wp_create_nonce('wp_rest'),
			'site_url' => get_site_url()
		));

		$this->promo_banner->enqueue_assets();

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
	 * Display the HelpMate interface on all frontend pages.
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

}
