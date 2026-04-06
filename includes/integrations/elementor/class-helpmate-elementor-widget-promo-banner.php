<?php
/**
 * Elementor: Helpmate Promo Bar widget.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Elementor_Widget_Promo_Banner
 */
class Helpmate_Elementor_Widget_Promo_Banner extends \Elementor\Widget_Base {

	/**
	 * Widget slug.
	 *
	 * @return string
	 */
	public function get_name() {
		return Helpmate_Elementor_Utils::WIDGET_PROMO_BANNER;
	}

	/**
	 * Widget label.
	 *
	 * @return string
	 */
	public function get_title() {
		return esc_html__( 'Helpmate Promo Bar', 'helpmate-ai-chatbot' );
	}

	/**
	 * Icon.
	 *
	 * @return string
	 */
	public function get_icon() {
		return 'eicon-banner';
	}

	/**
	 * Categories.
	 *
	 * @return string[]
	 */
	public function get_categories() {
		return array( 'helpmate' );
	}

	/**
	 * Script deps.
	 *
	 * @return string[]
	 */
	public function get_script_depends() {
		return array( 'helpmate-promo-banner' );
	}

	/**
	 * Style deps.
	 *
	 * @return string[]
	 */
	public function get_style_depends() {
		return array( 'helpmate-promo-banner' );
	}

	/**
	 * Register controls.
	 *
	 * @return void
	 */
	protected function register_controls() {
		$banners = $this->get_active_banners_for_control();

		$this->start_controls_section(
			'helpmate_promo_content',
			array(
				'label' => esc_html__( 'Content', 'helpmate-ai-chatbot' ),
			)
		);

		$options = array( '' => esc_html__( '— Select —', 'helpmate-ai-chatbot' ) );
		foreach ( $banners as $row ) {
			$id    = (int) $row['id'];
			$title = isset( $row['title'] ) ? $row['title'] : '';
			/* translators: 1: Banner title, 2: Banner database ID */
			$options[ (string) $id ] = sprintf(
				esc_html__( '%1$s (ID %2$d)', 'helpmate-ai-chatbot' ),
				$title !== '' ? esc_html( $title ) : esc_html__( '(No title)', 'helpmate-ai-chatbot' ),
				$id
			);
		}

		$this->add_control(
			'banner_id',
			array(
				'label'   => esc_html__( 'Promo banner', 'helpmate-ai-chatbot' ),
				'type'    => \Elementor\Controls_Manager::SELECT,
				'options' => $options,
				'default' => '',
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'helpmate_promo_style_overrides',
			array(
				'label' => esc_html__( 'Style overrides', 'helpmate-ai-chatbot' ),
				'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
			)
		);

		$sel_bar  = '{{WRAPPER}} .helpmate-promo-banner';
		$sel_btn  = '{{WRAPPER}} a.helpmate-promo-banner-button';
		$sel_cbox = '{{WRAPPER}} .helpmate-promo-banner-countdown-box';
		$sel_cnum = '{{WRAPPER}} .helpmate-promo-banner-countdown-number';

		$this->add_control(
			'override_hint',
			array(
				'type'            => \Elementor\Controls_Manager::RAW_HTML,
				'raw'             => '<p>' . esc_html__( 'Leave empty to use colors and sizes from the Helpmate admin promo settings.', 'helpmate-ai-chatbot' ) . '</p>',
				'content_classes' => 'elementor-descriptor',
			)
		);

		$this->add_control(
			'override_background_color',
			array(
				'label'     => esc_html__( 'Bar background', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::COLOR,
				'selectors' => array(
					$sel_bar => 'background-color: {{VALUE}}!important;',
				),
			)
		);

		$this->add_control(
			'override_text_color',
			array(
				'label'     => esc_html__( 'Text color', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::COLOR,
				'selectors' => array(
					$sel_bar => 'color: {{VALUE}}!important;',
				),
			)
		);

		$this->add_control(
			'override_text_font_size',
			array(
				'label'     => esc_html__( 'Text font size', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'selectors' => array(
					$sel_bar => 'font-size: {{VALUE}}!important;',
				),
			)
		);

		$this->add_control(
			'override_button_background_color',
			array(
				'label'     => esc_html__( 'Button background', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::COLOR,
				'selectors' => array(
					$sel_btn => 'background-color: {{VALUE}}!important;',
				),
			)
		);

		$this->add_control(
			'override_button_text_color',
			array(
				'label'     => esc_html__( 'Button text color', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::COLOR,
				'selectors' => array(
					$sel_btn => 'color: {{VALUE}}!important;',
				),
			)
		);

		$this->add_control(
			'override_button_text_font_size',
			array(
				'label'     => esc_html__( 'Button font size', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::TEXT,
				'selectors' => array(
					$sel_btn => 'font-size: {{VALUE}}!important;',
				),
			)
		);

		$this->add_control(
			'override_countdown_background_color',
			array(
				'label'     => esc_html__( 'Countdown background', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::COLOR,
				'selectors' => array(
					$sel_cbox => 'background-color: {{VALUE}}!important;',
					$sel_cnum => 'background-color: {{VALUE}}!important;',
				),
			)
		);

		$this->add_control(
			'override_countdown_text_color',
			array(
				'label'     => esc_html__( 'Countdown text', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::COLOR,
				'selectors' => array(
					$sel_cnum => 'color: {{VALUE}}!important;',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Active banners for select.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private function get_active_banners_for_control() {
		global $wpdb;
		$table = esc_sql( $wpdb->prefix . 'helpmate_promo_banners' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name escaped; admin/editor only
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, title FROM {$table} WHERE status = %s ORDER BY created_at DESC",
				'active'
			),
			ARRAY_A
		);
		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Render.
	 *
	 * @return void
	 */
	protected function render() {
		$helpmate = Helpmate_Elementor::instance()->get_helpmate();
		if ( ! $helpmate ) {
			return;
		}

		$promo = $helpmate->get_promo_banner();
		if ( ! $promo || ! $promo->is_enabled() ) {
			if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				echo '<div class="elementor-alert elementor-alert-warning">';
				esc_html_e( 'Promo Bar is disabled in Helpmate module settings.', 'helpmate-ai-chatbot' );
				echo '</div>';
			}
			return;
		}

		$settings = $this->get_settings_for_display();
		$settings = Helpmate_Elementor_Utils::merge_promo_elementor_global_colors_into_settings( $this, $settings );
		$banner_id = isset( $settings['banner_id'] ) ? (int) $settings['banner_id'] : 0;
		if ( $banner_id <= 0 ) {
			if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				echo '<div class="elementor-alert elementor-alert-info">';
				esc_html_e( 'Select a promo banner.', 'helpmate-ai-chatbot' );
				echo '</div>';
			}
			return;
		}

		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$banner = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d AND status = %s",
				$banner_id,
				'active'
			),
			ARRAY_A
		);

		if ( ! $banner ) {
			if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				echo '<div class="elementor-alert elementor-alert-warning">';
				esc_html_e( 'This banner was not found or is inactive.', 'helpmate-ai-chatbot' );
				echo '</div>';
			}
			return;
		}

		$banner['metadata'] = json_decode( $banner['metadata'], true );
		if ( ! is_array( $banner['metadata'] ) ) {
			$banner['metadata'] = array();
		}

		$overrides = Helpmate_Elementor_Utils::build_promo_metadata_overrides( $settings );
		$suffix    = $this->get_id();
		$suffix    = preg_replace( '/[^a-zA-Z0-9_-]/', '', $suffix );

		$promo->enqueue_assets();
		$promo->render_promo_banner(
			$banner,
			array(
				'metadata_overrides' => $overrides,
				'dom_id_suffix'      => $suffix,
			)
		);
	}
}
