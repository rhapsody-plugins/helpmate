<?php
/**
 * Elementor integration bootstrap.
 *
 * @package Helpmate
 * @subpackage Helpmate/includes/integrations
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Elementor
 */
final class Helpmate_Elementor {

	/**
	 * Singleton instance.
	 *
	 * @var Helpmate_Elementor|null
	 */
	private static $instance = null;

	/**
	 * Main plugin instance.
	 *
	 * @var Helpmate|null
	 */
	private $helpmate = null;

	/**
	 * Whether Elementor hooks were wired (avoid duplicate widget registration).
	 *
	 * @var bool
	 */
	private $bootstrapped = false;

	/**
	 * Get singleton.
	 *
	 * @return Helpmate_Elementor
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Helpmate main instance.
	 *
	 * @return Helpmate|null
	 */
	public function get_helpmate() {
		return $this->helpmate;
	}

	/**
	 * Boot Elementor hooks.
	 *
	 * @param Helpmate $helpmate Main plugin.
	 * @return void
	 */
	public function run( $helpmate ) {
		if ( $this->bootstrapped ) {
			return;
		}
		$this->bootstrapped = true;
		$this->helpmate     = $helpmate;

		// Same late-load issue: init/widgets hooks may have run before this plugin bootstrapped.
		if ( did_action( 'elementor/init' ) ) {
			$this->register_category();
		} else {
			add_action( 'elementor/init', array( $this, 'register_category' ) );
		}

		if ( did_action( 'elementor/widgets/register' ) ) {
			$this->register_widgets( \Elementor\Plugin::instance()->widgets_manager );
		} else {
			add_action( 'elementor/widgets/register', array( $this, 'register_widgets' ) );
		}
	}

	/**
	 * Register Helpmate widgets category.
	 *
	 * @return void
	 */
	public function register_category() {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return;
		}
		\Elementor\Plugin::instance()->elements_manager->add_category(
			'helpmate',
			array(
				'title' => esc_html__( 'Helpmate', 'helpmate-ai-chatbot' ),
				'icon'  => 'fa fa-comments',
			)
		);
	}

	/**
	 * Register widgets.
	 *
	 * @param \Elementor\Widgets_Manager $widgets_manager Manager.
	 * @return void
	 */
	public function register_widgets( $widgets_manager ) {
		require_once HELPMATE_DIR . 'includes/integrations/elementor/class-helpmate-elementor-widget-scheduling.php';
		require_once HELPMATE_DIR . 'includes/integrations/elementor/class-helpmate-elementor-widget-promo-banner.php';

		$widgets_manager->register( new Helpmate_Elementor_Widget_Scheduling() );
		$widgets_manager->register( new Helpmate_Elementor_Widget_Promo_Banner() );
	}
}
