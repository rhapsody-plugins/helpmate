<?php
/**
 * Gutenberg blocks: scheduling + promo (parity with Elementor widgets).
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Blocks
 */
class Helpmate_Blocks {

	/**
	 * @var Helpmate|null
	 */
	private static $helpmate = null;

	/**
	 * Per-request render index for scheduling blocks (per post).
	 *
	 * @var array<int, int>
	 */
	private static $scheduling_render_index = array();

	/**
	 * Per-request render index for promo blocks (per post).
	 *
	 * @var array<int, int>
	 */
	private static $promo_render_index = array();

	/**
	 * Boot hooks.
	 *
	 * @param Helpmate $helpmate Main plugin.
	 * @return void
	 */
	public static function run( $helpmate ) {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}
		self::$helpmate = $helpmate;
		add_action( 'init', array( __CLASS__, 'register_block_assets_early' ), 4 );
		add_action( 'init', array( __CLASS__, 'register_blocks' ), 10 );
		add_filter( 'block_categories_all', array( __CLASS__, 'register_block_category' ), 10, 2 );
		add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'enqueue_editor_data' ), 20 );
	}

	/**
	 * Register public asset handles before block type registration (editor needs handles).
	 *
	 * @return void
	 */
	public static function register_block_assets_early() {
		if ( self::$helpmate && self::$helpmate->get_plugin_public() ) {
			self::$helpmate->get_plugin_public()->register_scheduling_assets();
		}
		$css = HELPMATE_URL . 'public/css/promo-banner.css';
		$js  = HELPMATE_URL . 'public/js/promo-banner.js';
		if ( ! wp_style_is( 'helpmate-promo-banner', 'registered' ) ) {
			wp_register_style(
				'helpmate-promo-banner',
				$css,
				array(),
				HELPMATE_VERSION,
				'all'
			);
		}
		if ( ! wp_script_is( 'helpmate-promo-banner', 'registered' ) ) {
			wp_register_script(
				'helpmate-promo-banner',
				$js,
				array( 'jquery' ),
				HELPMATE_VERSION,
				true
			);
		}
		if ( ! wp_style_is( 'helpmate-blocks-editor', 'registered' ) ) {
			wp_register_style(
				'helpmate-blocks-editor',
				HELPMATE_URL . 'public/css/helpmate-blocks-editor.css',
				array(),
				HELPMATE_VERSION,
				'all'
			);
		}
	}

	/**
	 * Helpmate category in block inserter.
	 *
	 * @param array[] $categories       Categories.
	 * @param WP_Post $editor_context   Context.
	 * @return array[]
	 */
	public static function register_block_category( $categories, $editor_context ) {
		return array_merge(
			array(
				array(
					'slug'  => 'helpmate',
					'title' => esc_html__( 'Helpmate', 'helpmate-ai-chatbot' ),
					'icon'  => null,
				),
			),
			$categories
		);
	}

	/**
	 * Register block types from block.json + render callbacks.
	 *
	 * @return void
	 */
	public static function register_blocks() {
		register_block_type(
			HELPMATE_DIR . 'blocks/scheduling',
			array(
				'render_callback' => array( __CLASS__, 'render_scheduling_block' ),
			)
		);
		register_block_type(
			HELPMATE_DIR . 'blocks/promo-banner',
			array(
				'render_callback' => array( __CLASS__, 'render_promo_block' ),
			)
		);
	}

	/**
	 * Localize editor scripts after blocks are registered.
	 *
	 * @return void
	 */
	public static function enqueue_editor_data() {
		if ( ! is_admin() ) {
			return;
		}
		$post_id = 0;
		if ( isset( $_GET['post'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only for localization
			$post_id = (int) $_GET['post'];
		}

		$sched = WP_Block_Type_Registry::get_instance()->get_registered( Helpmate_Elementor_Utils::BLOCK_SCHEDULING );
		if ( $sched && $sched->editor_script ) {
			wp_set_script_translations( $sched->editor_script, 'helpmate-ai-chatbot', HELPMATE_DIR . 'languages' );
			wp_localize_script(
				$sched->editor_script,
				'helpmateSchedulingBlock',
				array(
					'warnings' => class_exists( 'Helpmate_Elementor_Utils' )
						? Helpmate_Elementor_Utils::get_scheduling_widget_warnings( $post_id )
						: array(),
					'postId'   => $post_id,
				)
			);
		}

		$promo = WP_Block_Type_Registry::get_instance()->get_registered( Helpmate_Elementor_Utils::BLOCK_PROMO_BANNER );
		if ( $promo && $promo->editor_script ) {
			wp_set_script_translations( $promo->editor_script, 'helpmate-ai-chatbot', HELPMATE_DIR . 'languages' );
			$enabled = self::$helpmate && self::$helpmate->get_promo_banner() && self::$helpmate->get_promo_banner()->is_enabled();
			wp_localize_script(
				$promo->editor_script,
				'helpmatePromoBlock',
				array(
					'moduleEnabled' => (bool) $enabled,
					'banners'       => current_user_can( 'edit_posts' ) ? self::get_active_banners_for_editor() : array(),
				)
			);
		}
	}

	/**
	 * Active promo banners for block editor select (same data as Elementor control).
	 *
	 * @return array<int, array{id:int,title:string}>
	 */
	public static function get_active_banners_for_editor() {
		global $wpdb;
		$table = esc_sql( $wpdb->prefix . 'helpmate_promo_banners' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name escaped; editor only
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, title FROM {$table} WHERE status = %s ORDER BY created_at DESC",
				'active'
			),
			ARRAY_A
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}
		$out = array();
		foreach ( $rows as $row ) {
			$out[] = array(
				'id'    => (int) $row['id'],
				'title' => isset( $row['title'] ) ? (string) $row['title'] : '',
			);
		}
		return $out;
	}

	/**
	 * Map block attributes to settings shape for build_promo_metadata_overrides().
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @return array<string, string>
	 */
	public static function block_attributes_to_promo_override_settings( array $attributes ) {
		$map = array(
			'overrideBackgroundColor'           => 'override_background_color',
			'overrideTextColor'                 => 'override_text_color',
			'overrideTextFontSize'              => 'override_text_font_size',
			'overrideButtonBackgroundColor'     => 'override_button_background_color',
			'overrideButtonTextColor'           => 'override_button_text_color',
			'overrideButtonTextFontSize'        => 'override_button_text_font_size',
			'overrideCountdownBackgroundColor'  => 'override_countdown_background_color',
			'overrideCountdownTextColor'        => 'override_countdown_text_color',
		);
		$settings = array();
		foreach ( $map as $attr => $key ) {
			if ( isset( $attributes[ $attr ] ) ) {
				$settings[ $key ] = is_string( $attributes[ $attr ] ) ? $attributes[ $attr ] : (string) $attributes[ $attr ];
			} else {
				$settings[ $key ] = '';
			}
		}
		return $settings;
	}

	/**
	 * Render callback: Helpmate Scheduling block.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Inner content.
	 * @param WP_Block             $block      Block instance.
	 * @return string
	 */
	public static function render_scheduling_block( $attributes, $content, $block ) {
		if ( ! self::$helpmate || ! self::$helpmate->get_plugin_public() ) {
			return '';
		}
		$post_id = get_the_ID();
		if ( ! isset( self::$scheduling_render_index[ $post_id ] ) ) {
			self::$scheduling_render_index[ $post_id ] = 0;
		}
		$idx = self::$scheduling_render_index[ $post_id ]++;
		$anchor = isset( $attributes['anchor'] ) ? sanitize_html_class( (string) $attributes['anchor'] ) : '';
		$suffix = $anchor !== '' ? $anchor : ( 'gb-' . (int) $post_id . '-' . $idx );
		$suffix = preg_replace( '/[^a-zA-Z0-9_-]/', '', $suffix );
		if ( $suffix === '' ) {
			$suffix = 'gb-' . $idx;
		}

		$heading = isset( $attributes['headingText'] ) ? trim( (string) $attributes['headingText'] ) : '';
		$align   = isset( $attributes['textAlign'] ) ? (string) $attributes['textAlign'] : '';
		if ( ! in_array( $align, array( 'left', 'center', 'right' ), true ) ) {
			$align = '';
		}

		$html = self::$helpmate->get_plugin_public()->get_scheduling_form_html(
			array(
				'instance_suffix' => $suffix,
				'heading_text'    => $heading,
				'text_align'      => $align,
			)
		);

		return $html ? $html : '';
	}

	/**
	 * Render callback: Helpmate Promo Bar block.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param string               $content    Inner content.
	 * @param WP_Block             $block      Block instance.
	 * @return string
	 */
	public static function render_promo_block( $attributes, $content, $block ) {
		if ( ! self::$helpmate ) {
			return '';
		}
		$promo = self::$helpmate->get_promo_banner();
		if ( ! $promo || ! $promo->is_enabled() ) {
			return '';
		}

		$post_id = get_the_ID();
		if ( ! isset( self::$promo_render_index[ $post_id ] ) ) {
			self::$promo_render_index[ $post_id ] = 0;
		}
		$pidx = self::$promo_render_index[ $post_id ]++;
		$anchor = isset( $attributes['anchor'] ) ? sanitize_html_class( (string) $attributes['anchor'] ) : '';
		$suffix = $anchor !== '' ? $anchor : ( 'pb-' . (int) $post_id . '-' . $pidx );
		$suffix = preg_replace( '/[^a-zA-Z0-9_-]/', '', $suffix );
		if ( $suffix === '' ) {
			$suffix = 'pb-' . $pidx;
		}

		$banner_id = isset( $attributes['bannerId'] ) ? (int) $attributes['bannerId'] : 0;
		if ( $banner_id <= 0 ) {
			return '';
		}

		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$banner_row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d AND status = %s",
				$banner_id,
				'active'
			),
			ARRAY_A
		);

		if ( ! $banner_row ) {
			return '';
		}

		$banner_row['metadata'] = json_decode( $banner_row['metadata'], true );
		if ( ! is_array( $banner_row['metadata'] ) ) {
			$banner_row['metadata'] = array();
		}

		$settings  = self::block_attributes_to_promo_override_settings( is_array( $attributes ) ? $attributes : array() );
		$overrides = Helpmate_Elementor_Utils::build_promo_metadata_overrides( $settings );

		$promo->enqueue_assets();
		ob_start();
		$promo->render_promo_banner(
			$banner_row,
			array(
				'metadata_overrides' => $overrides,
				'dom_id_suffix'      => $suffix,
			)
		);
		return ob_get_clean();
	}
}
