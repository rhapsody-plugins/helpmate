<?php
/**
 * Elementor helpers: widget detection, scheduling placement index, landing URL cache.
 *
 * @package Helpmate
 * @subpackage Helpmate/includes/integrations
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Elementor_Utils
 */
class Helpmate_Elementor_Utils {

	public const WIDGET_SCHEDULING     = 'helpmate-scheduling';
	public const WIDGET_PROMO_BANNER   = 'helpmate-promo-banner';
	/** @var string Gutenberg block name */
	public const BLOCK_SCHEDULING      = 'helpmate/scheduling';
	/** @var string Gutenberg block name */
	public const BLOCK_PROMO_BANNER    = 'helpmate/promo-banner';
	/** @var string Beaver Builder module slug (matches helpmate-promo-banner.php filename) */
	public const BEAVER_MODULE_PROMO_BANNER = 'helpmate-promo-banner';
	/** @var string Beaver Builder module slug (matches helpmate-scheduling.php filename) */
	public const BEAVER_MODULE_SCHEDULING   = 'helpmate-scheduling';
	public const CACHE_GROUP           = 'helpmate';
	public const CACHE_LANDING_KEY     = 'helpmate_scheduling_landing_post_id';
	public const CACHE_PLACEMENTS_KEY  = 'helpmate_scheduling_placements_index';

	/**
	 * Register invalidation hooks.
	 *
	 * @return void
	 */
	public static function init_hooks() {
		add_action( 'save_post', array( __CLASS__, 'invalidate_on_post_save' ), 10, 2 );
		add_action( 'deleted_post', array( __CLASS__, 'invalidate_caches' ) );
		add_action( 'fl_builder_after_save_layout', array( __CLASS__, 'invalidate_caches' ) );
		add_action( 'fl_builder_after_save_user_template', array( __CLASS__, 'invalidate_caches' ) );
	}

	/**
	 * Invalidate scheduling caches when a post or page is saved.
	 *
	 * @param int     $post_id Post ID.
	 * @param WP_Post $post    Post object.
	 * @return void
	 */
	public static function invalidate_on_post_save( $post_id, $post ) {
		if ( ! $post instanceof WP_Post ) {
			return;
		}
		if ( ! in_array( $post->post_type, self::scheduling_embed_post_types(), true ) ) {
			return;
		}
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		self::invalidate_caches();
	}

	/**
	 * Clear object cache keys used for scheduling discovery and warnings.
	 *
	 * @return void
	 */
	public static function invalidate_caches() {
		wp_cache_delete( self::CACHE_LANDING_KEY, self::CACHE_GROUP );
		wp_cache_delete( self::CACHE_PLACEMENTS_KEY, self::CACHE_GROUP );
		// Legacy key from older releases (shortcode-only discovery).
		wp_cache_delete( 'helpmate_scheduling_page_' . md5( '%[helpmate_scheduling]%' ), self::CACHE_GROUP );
	}

	/**
	 * Recursively count Elementor elements of a widget type.
	 *
	 * @param array|null $elements    Elementor elements tree.
	 * @param string     $widget_type Widget name.
	 * @return int
	 */
	public static function count_widgets_in_data( $elements, $widget_type ) {
		$count = 0;
		if ( ! is_array( $elements ) ) {
			return 0;
		}
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}
			if ( isset( $element['widgetType'] ) && $element['widgetType'] === $widget_type ) {
				++$count;
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$count += self::count_widgets_in_data( $element['elements'], $widget_type );
			}
		}
		return $count;
	}

	/**
	 * Whether post meta contains an Elementor widget type.
	 *
	 * @param int    $post_id     Post ID.
	 * @param string $widget_type Widget name.
	 * @return bool
	 */
	public static function post_has_widget( $post_id, $widget_type ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return false;
		}
		$raw = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! is_string( $raw ) || $raw === '' ) {
			return false;
		}
		$needle = '"widgetType":"' . $widget_type . '"';
		if ( strpos( $raw, $needle ) !== false ) {
			return true;
		}
		$decoded = json_decode( $raw, true );
		if ( ! is_array( $decoded ) ) {
			return false;
		}
		return self::count_widgets_in_data( $decoded, $widget_type ) > 0;
	}

	/**
	 * Whether post content contains a registered block (parsed from the post).
	 *
	 * @param int    $post_id    Post ID.
	 * @param string $block_name Full block name, e.g. helpmate/scheduling.
	 * @return bool
	 */
	public static function post_has_block( $post_id, $block_name ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 || ! function_exists( 'has_block' ) ) {
			return false;
		}
		$post = get_post( $post_id );
		return $post instanceof WP_Post && has_block( $block_name, $post );
	}

	/**
	 * True if the page embeds promo via Elementor widget or Gutenberg block (not shortcode alone).
	 *
	 * @param int $post_id Post ID.
	 * @return bool
	 */
	public static function post_has_promo_embed( $post_id ) {
		return self::post_has_widget( $post_id, self::WIDGET_PROMO_BANNER )
			|| self::post_has_block( $post_id, self::BLOCK_PROMO_BANNER )
			|| self::post_has_beaver_module( $post_id, self::BEAVER_MODULE_PROMO_BANNER );
	}

	/**
	 * Post types that may host scheduling shortcode, blocks, Elementor, or Beaver layouts.
	 *
	 * @return string[]
	 */
	public static function scheduling_embed_post_types() {
		$types = array( 'post', 'page', 'fl-builder-template', 'fl-theme-layout' );
		return array_values( array_filter( $types, 'post_type_exists' ) );
	}

	/**
	 * Published Beaver layout data for a post.
	 *
	 * @param int $post_id Post ID.
	 * @return array
	 */
	public static function get_beaver_published_layout( $post_id ) {
		if ( ! class_exists( 'FLBuilderModel' ) ) {
			return array();
		}
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return array();
		}
		$data = FLBuilderModel::get_layout_data( 'published', $post_id );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * Module slug from a Beaver layout node (object or array).
	 *
	 * @param object|array|null $node Layout node.
	 * @return string
	 */
	private static function beaver_layout_node_module_slug( $node ) {
		if ( is_object( $node ) ) {
			if ( isset( $node->type ) && 'module' === $node->type && isset( $node->settings ) && isset( $node->settings->type ) ) {
				return (string) $node->settings->type;
			}
		}
		if ( is_array( $node ) ) {
			$type = isset( $node['type'] ) ? $node['type'] : '';
			if ( 'module' === $type && isset( $node['settings'] ) ) {
				$s = $node['settings'];
				if ( is_object( $s ) && isset( $s->type ) ) {
					return (string) $s->type;
				}
				if ( is_array( $s ) && isset( $s['type'] ) ) {
					return (string) $s['type'];
				}
			}
		}
		return '';
	}

	/**
	 * Count Beaver module instances of a slug in layout data.
	 *
	 * @param array  $data Layout nodes keyed by node id.
	 * @param string $slug Module slug, e.g. helpmate-scheduling.
	 * @return int
	 */
	public static function count_beaver_modules_in_layout( $data, $slug ) {
		if ( ! is_array( $data ) || array() === $data ) {
			return 0;
		}
		$count = 0;
		foreach ( $data as $node ) {
			if ( self::beaver_layout_node_module_slug( $node ) === $slug ) {
				++$count;
			}
		}
		return $count;
	}

	/**
	 * Whether a post's published Beaver layout includes a module slug.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $slug    Module slug.
	 * @return bool
	 */
	public static function post_has_beaver_module( $post_id, $slug ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 || ! is_string( $slug ) || $slug === '' ) {
			return false;
		}
		return self::count_beaver_modules_in_layout( self::get_beaver_published_layout( $post_id ), $slug ) > 0;
	}

	/**
	 * Count blocks of a given blockName in a parsed blocks tree (innerBlocks included).
	 *
	 * @param array  $blocks Parsed blocks from parse_blocks().
	 * @param string $name   Full block name.
	 * @return int
	 */
	public static function count_named_blocks_recursive( $blocks, $name ) {
		$count = 0;
		if ( ! is_array( $blocks ) ) {
			return 0;
		}
		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}
			if ( ! empty( $block['blockName'] ) && $block['blockName'] === $name ) {
				++$count;
			}
			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$count += self::count_named_blocks_recursive( $block['innerBlocks'], $name );
			}
		}
		return $count;
	}

	/**
	 * Count Helpmate scheduling blocks in raw post content.
	 *
	 * @param string $content Post content.
	 * @return int
	 */
	public static function count_scheduling_blocks_in_content( $content ) {
		if ( ! is_string( $content ) || $content === '' || ! function_exists( 'parse_blocks' ) ) {
			return 0;
		}
		return self::count_named_blocks_recursive( parse_blocks( $content ), self::BLOCK_SCHEDULING );
	}

	/**
	 * Build or retrieve cached scheduling placements (shortcode + Elementor widget + block + Beaver hosts).
	 *
	 * @return array{shortcode_ids: int[], widget_ids: int[], block_ids: int[], beaver_ids: int[]}
	 */
	public static function get_scheduling_placements_index() {
		$cached = wp_cache_get( self::CACHE_PLACEMENTS_KEY, self::CACHE_GROUP );
		if ( false !== $cached && is_array( $cached ) && isset( $cached['block_ids'], $cached['beaver_ids'] ) ) {
			return $cached;
		}

		global $wpdb;
		$embed_types = self::scheduling_embed_post_types();
		if ( empty( $embed_types ) ) {
			$index = array(
				'shortcode_ids' => array(),
				'widget_ids'    => array(),
				'block_ids'     => array(),
				'beaver_ids'    => array(),
			);
			wp_cache_set( self::CACHE_PLACEMENTS_KEY, $index, self::CACHE_GROUP, HOUR_IN_SECONDS );
			return $index;
		}

		$pt_placeholders = implode( ',', array_fill( 0, count( $embed_types ), '%s' ) );
		$shortcode_pattern = '%[helpmate_scheduling]%';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Cached; post types are safe slugs; rebuilt on save_post / BB save
		$shortcode_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
				WHERE post_status = 'publish'
				AND post_type IN ($pt_placeholders)
				AND post_content LIKE %s",
				...array_merge( $embed_types, array( $shortcode_pattern ) )
			)
		);

		$widget_like = '%"widgetType":"' . self::WIDGET_SCHEDULING . '"%';

		$widget_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT p.ID FROM {$wpdb->posts} p
				INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
				WHERE p.post_status = 'publish'
				AND p.post_type IN ($pt_placeholders)
				AND pm.meta_key = %s
				AND pm.meta_value LIKE %s",
				...array_merge( $embed_types, array( '_elementor_data', $widget_like ) )
			)
		);

		$block_like = '%wp:' . self::BLOCK_SCHEDULING . '%';

		$block_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
				WHERE post_status = 'publish'
				AND post_type IN ($pt_placeholders)
				AND post_content LIKE %s",
				...array_merge( $embed_types, array( $block_like ) )
			)
		);

		$beaver_like = '%' . $wpdb->esc_like( self::BEAVER_MODULE_SCHEDULING ) . '%';

		$beaver_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT p.ID FROM {$wpdb->posts} p
				INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
				WHERE p.post_status = 'publish'
				AND p.post_type IN ($pt_placeholders)
				AND pm.meta_key = %s
				AND pm.meta_value LIKE %s",
				...array_merge( $embed_types, array( '_fl_builder_data', $beaver_like ) )
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		$index = array(
			'shortcode_ids' => array_map( 'intval', (array) $shortcode_ids ),
			'widget_ids'    => array_map( 'intval', (array) $widget_ids ),
			'block_ids'     => array_map( 'intval', (array) $block_ids ),
			'beaver_ids'    => array_map( 'intval', (array) $beaver_ids ),
		);

		wp_cache_set( self::CACHE_PLACEMENTS_KEY, $index, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $index;
	}

	/**
	 * Post ID of the newest published page/post that hosts scheduling (shortcode or widget).
	 *
	 * @return int 0 if none.
	 */
	public static function get_scheduling_landing_post_id() {
		$cached = wp_cache_get( self::CACHE_LANDING_KEY, self::CACHE_GROUP );
		if ( false !== $cached ) {
			return (int) $cached;
		}

		$index       = self::get_scheduling_placements_index();
		$block_ids   = isset( $index['block_ids'] ) ? $index['block_ids'] : array();
		$beaver_ids  = isset( $index['beaver_ids'] ) ? $index['beaver_ids'] : array();
		$all_ids     = array_unique(
			array_merge( $index['shortcode_ids'], $index['widget_ids'], $block_ids, $beaver_ids )
		);
		$all_ids = array_filter( array_map( 'intval', $all_ids ) );

		if ( empty( $all_ids ) ) {
			wp_cache_set( self::CACHE_LANDING_KEY, 0, self::CACHE_GROUP, HOUR_IN_SECONDS );
			return 0;
		}

		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $all_ids ), '%d' ) );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- IDs are integers; placeholders built safely
		$sql = "SELECT ID FROM {$wpdb->posts}
			WHERE post_status = 'publish'
			AND ID IN ($placeholders)
			ORDER BY post_date DESC
			LIMIT 1";
		$post_id = (int) $wpdb->get_var( $wpdb->prepare( $sql, ...$all_ids ) );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		wp_cache_set( self::CACHE_LANDING_KEY, $post_id, self::CACHE_GROUP, HOUR_IN_SECONDS );

		return $post_id;
	}

	/**
	 * Permalink for scheduling landing, or null.
	 *
	 * @return string|null
	 */
	public static function get_scheduling_landing_permalink() {
		$id = self::get_scheduling_landing_post_id();
		if ( $id <= 0 ) {
			return null;
		}
		$url = get_permalink( $id );
		return $url ? $url : null;
	}

	/**
	 * Warnings for the scheduling Elementor widget panel.
	 *
	 * @param int $post_id Current document post ID.
	 * @return string[]
	 */
	public static function get_scheduling_widget_warnings( $post_id ) {
		$warnings = array();
		$post_id  = (int) $post_id;

		if ( class_exists( '\Elementor\Plugin' ) ) {
			$doc = \Elementor\Plugin::instance()->documents->get_current();
			if ( $doc && method_exists( $doc, 'get_elements_data' ) ) {
				$data = $doc->get_elements_data();
				if ( is_array( $data ) && self::count_widgets_in_data( $data, self::WIDGET_SCHEDULING ) > 1 ) {
					$warnings[] = __( 'Multiple Helpmate Scheduling widgets are on this layout. Use only one unless you have a reason to duplicate the form.', 'helpmate-ai-chatbot' );
				}
			}
		}

		$layout_post_id = $post_id;
		if ( class_exists( 'FLBuilderModel' ) && FLBuilderModel::is_builder_active() ) {
			$bb_pid = (int) FLBuilderModel::get_post_id();
			if ( $bb_pid > 0 ) {
				$layout_post_id = $bb_pid;
			}
		}
		if ( $layout_post_id > 0 && class_exists( 'FLBuilderModel' ) ) {
			$bb_layout = self::get_beaver_published_layout( $layout_post_id );
			if ( self::count_beaver_modules_in_layout( $bb_layout, self::BEAVER_MODULE_SCHEDULING ) > 1 ) {
				$warnings[] = __( 'Multiple Helpmate Scheduling modules are on this Beaver Builder layout. Use only one unless you have a reason to duplicate the form.', 'helpmate-ai-chatbot' );
			}
		}

		if ( $post_id > 0 ) {
			$content = get_post_field( 'post_content', $post_id );
			if ( is_string( $content ) ) {
				$block_count = self::count_scheduling_blocks_in_content( $content );
				if ( $block_count > 1 ) {
					$warnings[] = __( 'This page contains more than one Helpmate Scheduling block. Use only one unless you have a reason to duplicate the form.', 'helpmate-ai-chatbot' );
				}
				if ( has_shortcode( $content, 'helpmate_scheduling' ) && self::post_has_widget( $post_id, self::WIDGET_SCHEDULING ) ) {
					$warnings[] = __( 'This page contains both the [helpmate_scheduling] shortcode and the Helpmate Scheduling widget. Remove one to avoid duplicate forms.', 'helpmate-ai-chatbot' );
				}
				if ( has_shortcode( $content, 'helpmate_scheduling' ) && $block_count > 0 ) {
					$warnings[] = __( 'This page contains both the [helpmate_scheduling] shortcode and the Helpmate Scheduling block. Remove one to avoid duplicate forms.', 'helpmate-ai-chatbot' );
				}
				if ( $block_count > 0 && self::post_has_widget( $post_id, self::WIDGET_SCHEDULING ) ) {
					$warnings[] = __( 'This page contains both the Helpmate Scheduling block and the Helpmate Scheduling Elementor widget. Remove one to avoid duplicate forms.', 'helpmate-ai-chatbot' );
				}
				if ( has_shortcode( $content, 'helpmate_scheduling' ) && self::post_has_beaver_module( $post_id, self::BEAVER_MODULE_SCHEDULING ) ) {
					$warnings[] = __( 'This page contains both the [helpmate_scheduling] shortcode and the Helpmate Scheduling Beaver Builder module. Remove one to avoid duplicate forms.', 'helpmate-ai-chatbot' );
				}
				if ( $block_count > 0 && self::post_has_beaver_module( $post_id, self::BEAVER_MODULE_SCHEDULING ) ) {
					$warnings[] = __( 'This page contains both the Helpmate Scheduling block and the Helpmate Scheduling Beaver Builder module. Remove one to avoid duplicate forms.', 'helpmate-ai-chatbot' );
				}
				if ( self::post_has_widget( $post_id, self::WIDGET_SCHEDULING ) && self::post_has_beaver_module( $post_id, self::BEAVER_MODULE_SCHEDULING ) ) {
					$warnings[] = __( 'This page contains both the Helpmate Scheduling Elementor widget and the Helpmate Scheduling Beaver Builder module. Remove one to avoid duplicate forms.', 'helpmate-ai-chatbot' );
				}
			}
		}

		$index       = self::get_scheduling_placements_index();
		$block_ids   = isset( $index['block_ids'] ) ? $index['block_ids'] : array();
		$beaver_ids  = isset( $index['beaver_ids'] ) ? $index['beaver_ids'] : array();

		if ( ! empty( $index['shortcode_ids'] ) && ! empty( $index['widget_ids'] ) ) {
			$warnings[] = __( 'Scheduling is embedded via shortcode on at least one page and via the Elementor widget on another. Helpmate works best with a single scheduling landing page—remove the extra placement.', 'helpmate-ai-chatbot' );
		}
		if ( ! empty( $index['shortcode_ids'] ) && ! empty( $block_ids ) ) {
			$warnings[] = __( 'Scheduling is embedded via shortcode on at least one page and via the Helpmate Scheduling block on another. Helpmate works best with a single scheduling landing page—remove the extra placement.', 'helpmate-ai-chatbot' );
		}
		if ( ! empty( $index['widget_ids'] ) && ! empty( $block_ids ) ) {
			$warnings[] = __( 'Scheduling is embedded via the Elementor widget on at least one page and via the Helpmate Scheduling block on another. Helpmate works best with a single scheduling landing page—remove the extra placement.', 'helpmate-ai-chatbot' );
		}
		if ( ! empty( $index['shortcode_ids'] ) && ! empty( $beaver_ids ) ) {
			$warnings[] = __( 'Scheduling is embedded via shortcode on at least one page and via the Helpmate Scheduling Beaver Builder module on another. Helpmate works best with a single scheduling landing page—remove the extra placement.', 'helpmate-ai-chatbot' );
		}
		if ( ! empty( $index['widget_ids'] ) && ! empty( $beaver_ids ) ) {
			$warnings[] = __( 'Scheduling is embedded via the Elementor widget on at least one page and via the Helpmate Scheduling Beaver Builder module on another. Helpmate works best with a single scheduling landing page—remove the extra placement.', 'helpmate-ai-chatbot' );
		}
		if ( ! empty( $block_ids ) && ! empty( $beaver_ids ) ) {
			$warnings[] = __( 'Scheduling is embedded via the Helpmate Scheduling block on at least one page and via the Beaver Builder module on another. Helpmate works best with a single scheduling landing page—remove the extra placement.', 'helpmate-ai-chatbot' );
		}

		if ( count( $index['shortcode_ids'] ) > 1 ) {
			$warnings[] = __( 'More than one published page contains the [helpmate_scheduling] shortcode. Only the newest page is used for chat links; remove extras to avoid confusion.', 'helpmate-ai-chatbot' );
		}
		if ( count( $block_ids ) > 1 ) {
			$warnings[] = __( 'More than one published page contains the Helpmate Scheduling block. Only the newest page is used for chat links; remove extras to avoid confusion.', 'helpmate-ai-chatbot' );
		}
		if ( count( $beaver_ids ) > 1 ) {
			$warnings[] = __( 'More than one published layout contains the Helpmate Scheduling Beaver Builder module. Only the newest page is used for chat links; remove extras to avoid confusion.', 'helpmate-ai-chatbot' );
		}

		return $warnings;
	}

	/**
	 * Normalize Elementor control value (COLOR may be string or array with a "color" key).
	 *
	 * @param mixed $raw Setting value.
	 * @return string Extracted string or empty string.
	 */
	public static function normalize_elementor_color_setting( $raw ) {
		if ( is_string( $raw ) ) {
			return trim( $raw );
		}
		if ( is_array( $raw ) ) {
			if ( isset( $raw['color'] ) && is_string( $raw['color'] ) ) {
				return trim( $raw['color'] );
			}
		}
		return '';
	}

	/**
	 * Whether an Elementor widget setting is intentionally empty.
	 *
	 * @param mixed $raw Raw value.
	 * @return bool
	 */
	public static function elementor_color_setting_is_empty( $raw ) {
		return self::normalize_elementor_color_setting( $raw ) === '';
	}

	/**
	 * Sanitize a CSS color for promo metadata (hex, rgb/a, hsl/a, CSS variables).
	 *
	 * @param mixed $value Raw value (string or Elementor color array).
	 * @return string|null Sanitized or null to skip override.
	 */
	public static function sanitize_promo_css_color( $value ) {
		$value = self::normalize_elementor_color_setting( $value );
		if ( $value === '' ) {
			return null;
		}
		$hex = sanitize_hex_color( $value );
		if ( $hex ) {
			return $hex;
		}
		if ( preg_match( '/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*[\d.]+\s*)?\)$/i', $value ) ) {
			return $value;
		}
		// Elementor global colors and some pickers output hsl()/var().
		if ( preg_match( '/^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+\s*)?\)$/i', $value ) ) {
			return $value;
		}
		if ( preg_match( '/^var\(\s*--[a-zA-Z0-9_-]+\s*\)$/i', $value ) ) {
			return $value;
		}
		return null;
	}

	/**
	 * Sanitize font-size token for promo metadata.
	 *
	 * @param string $value Raw value.
	 * @return string|null
	 */
	public static function sanitize_promo_font_size( $value ) {
		if ( is_array( $value ) && isset( $value['size'], $value['unit'] ) ) {
			$size = trim( (string) $value['size'] );
			$unit = trim( (string) $value['unit'] );
			if ( $size !== '' && preg_match( '/^(px|rem|em|%)$/i', $unit ) ) {
				$value = $size . $unit;
			} else {
				$value = '';
			}
		} else {
			$value = trim( (string) $value );
		}
		if ( $value === '' ) {
			return null;
		}
		if ( preg_match( '/^\d+(\.\d+)?(px|rem|em|%)$/i', $value ) ) {
			return $value;
		}
		return null;
	}

	/**
	 * Promo widget color keys that may be linked to Elementor global colors (__globals__).
	 *
	 * @return string[]
	 */
	public static function promo_elementor_global_color_setting_keys() {
		return array(
			'override_background_color',
			'override_text_color',
			'override_button_background_color',
			'override_button_text_color',
			'override_countdown_background_color',
			'override_countdown_text_color',
		);
	}

	/**
	 * Resolve globals/colors?id={id} to a hex/string from the active kit (frontend-safe).
	 *
	 * @param string $global_key Elementor global reference, e.g. globals/colors?id=primary.
	 * @return string Empty if not resolved.
	 */
	public static function resolve_elementor_kit_global_color( $global_key ) {
		if ( ! is_string( $global_key ) || $global_key === '' ) {
			return '';
		}
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return '';
		}
		if ( ! preg_match( '#^globals/colors\?id=([\w-]+)$#', $global_key, $m ) ) {
			return '';
		}
		$id  = $m[1];
		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
		if ( ! $kit ) {
			return '';
		}
		foreach ( array( 'system_colors', 'custom_colors' ) as $repeater_key ) {
			$rows = $kit->get_settings_for_display( $repeater_key );
			if ( ! is_array( $rows ) ) {
				continue;
			}
			foreach ( $rows as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				if ( isset( $row['_id'], $row['color'] ) && (string) $row['_id'] === $id ) {
					return trim( (string) $row['color'] );
				}
			}
		}
		return '';
	}

	/**
	 * Fill empty color slots from __globals__ so PHP metadata merge matches Elementor visuals.
	 *
	 * @param \Elementor\Widget_Base $widget   Widget instance.
	 * @param array                  $settings Display settings (mutated keys merged in).
	 * @return array
	 */
	public static function merge_promo_elementor_global_colors_into_settings( $widget, array $settings ) {
		if ( ! $widget instanceof \Elementor\Widget_Base ) {
			return $settings;
		}
		$raw = $widget->get_settings();
		if ( ! is_array( $raw ) || empty( $raw['__globals__'] ) || ! is_array( $raw['__globals__'] ) ) {
			return $settings;
		}
		$globals = $raw['__globals__'];
		foreach ( self::promo_elementor_global_color_setting_keys() as $key ) {
			if ( ! self::elementor_color_setting_is_empty( $settings[ $key ] ?? null ) ) {
				continue;
			}
			if ( empty( $globals[ $key ] ) || ! is_string( $globals[ $key ] ) ) {
				continue;
			}
			$hex = self::resolve_elementor_kit_global_color( $globals[ $key ] );
			if ( $hex === '' ) {
				continue;
			}
			if ( null === self::sanitize_promo_css_color( $hex ) ) {
				continue;
			}
			$settings[ $key ] = $hex;
		}
		return $settings;
	}

	/**
	 * Build safe metadata overrides from Elementor widget settings.
	 *
	 * @param array $settings Widget display settings.
	 * @return array Non-empty keys only, safe for merging into banner metadata.
	 */
	public static function build_promo_metadata_overrides( array $settings ) {
		$out = array();
		$map = array(
			'override_background_color'       => 'background_color',
			'override_text_color'             => 'text_color',
			'override_text_font_size'         => 'text_font_size',
			'override_button_background_color' => 'button_background_color',
			'override_button_text_color'      => 'button_text_color',
			'override_button_text_font_size'  => 'button_text_font_size',
			'override_countdown_background_color' => 'countdown_background_color',
			'override_countdown_text_color'   => 'countdown_text_color',
		);

		foreach ( $map as $setting_key => $meta_key ) {
			if ( ! array_key_exists( $setting_key, $settings ) ) {
				continue;
			}
			$raw = $settings[ $setting_key ];
			if ( strpos( $setting_key, 'font_size' ) !== false ) {
				if ( $raw === '' || $raw === null ) {
					continue;
				}
				$clean = self::sanitize_promo_font_size( $raw );
			} else {
				if ( self::elementor_color_setting_is_empty( $raw ) ) {
					continue;
				}
				$clean = self::sanitize_promo_css_color( $raw );
			}
			if ( null !== $clean ) {
				$out[ $meta_key ] = $clean;
			}
		}

		return $out;
	}
}

Helpmate_Elementor_Utils::init_hooks();
