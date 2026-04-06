<?php
/**
 * Beaver Builder: register Helpmate modules.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Beaver_Builder
 */
final class Helpmate_Beaver_Builder {

	/**
	 * Singleton.
	 *
	 * @var Helpmate_Beaver_Builder|null
	 */
	private static $instance = null;

	/**
	 * @var Helpmate|null
	 */
	private $helpmate = null;

	/**
	 * Whether extensions hook was registered.
	 *
	 * @var bool
	 */
	private $bootstrapped = false;

	/**
	 * @return Helpmate_Beaver_Builder
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * @return Helpmate|null
	 */
	public function get_helpmate() {
		return $this->helpmate;
	}

	/**
	 * Boot Beaver Builder integration.
	 *
	 * @param Helpmate $helpmate Main plugin.
	 * @return void
	 */
	public function run( $helpmate ) {
		if ( $this->bootstrapped || ! class_exists( 'FLBuilder' ) ) {
			return;
		}
		$this->bootstrapped = true;
		$this->helpmate     = $helpmate;

		add_action( 'fl_builder_register_extensions', array( $this, 'register_modules' ) );
	}

	/**
	 * Load and register custom modules (runs during FLBuilderModel::load_modules).
	 *
	 * @return void
	 */
	public function register_modules() {
		static $registered = false;
		if ( $registered ) {
			return;
		}
		$registered = true;

		require_once HELPMATE_DIR . 'includes/integrations/beaver-builder/modules/helpmate-promo-banner/helpmate-promo-banner.php';
		require_once HELPMATE_DIR . 'includes/integrations/beaver-builder/modules/helpmate-scheduling/helpmate-scheduling.php';
	}

	/**
	 * Options for promo banner select (Beaver module settings).
	 *
	 * @return array<string, string>
	 */
	public static function get_promo_banner_select_options() {
		global $wpdb;
		$table = esc_sql( $wpdb->prefix . 'helpmate_promo_banners' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name escaped; builder UI only
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, title FROM {$table} WHERE status = %s ORDER BY created_at DESC",
				'active'
			),
			ARRAY_A
		);
		$options = array( '' => esc_html__( '— Select —', 'helpmate-ai-chatbot' ) );
		if ( ! is_array( $rows ) ) {
			return $options;
		}
		foreach ( $rows as $row ) {
			$id    = (int) $row['id'];
			$title = isset( $row['title'] ) ? (string) $row['title'] : '';
			/* translators: 1: Banner title, 2: Banner database ID */
			$options[ (string) $id ] = sprintf(
				esc_html__( '%1$s (ID %2$d)', 'helpmate-ai-chatbot' ),
				$title !== '' ? esc_html( $title ) : esc_html__( '(No title)', 'helpmate-ai-chatbot' ),
				$id
			);
		}
		return $options;
	}
}
