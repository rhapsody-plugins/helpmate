<?php
/**
 * Elementor: Smart Schedules (appointment) widget.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Elementor_Widget_Scheduling
 */
class Helpmate_Elementor_Widget_Scheduling extends \Elementor\Widget_Base {

	/**
	 * Widget slug.
	 *
	 * @return string
	 */
	public function get_name() {
		return Helpmate_Elementor_Utils::WIDGET_SCHEDULING;
	}

	/**
	 * Widget label in panel.
	 *
	 * @return string
	 */
	public function get_title() {
		return esc_html__( 'Helpmate Scheduling', 'helpmate-ai-chatbot' );
	}

	/**
	 * Widget icon.
	 *
	 * @return string
	 */
	public function get_icon() {
		return 'eicon-calendar';
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
	 * Ensure scheduling assets load in Elementor canvas (enqueue during render is too late for &lt;head&gt;).
	 *
	 * @return string[]
	 */
	public function get_style_depends() {
		return array( 'helpmate-scheduling' );
	}

	/**
	 * @return string[]
	 */
	public function get_script_depends() {
		return array( 'helpmate-scheduling' );
	}

	/**
	 * Register controls.
	 *
	 * @return void
	 */
	protected function register_controls() {
		$post_id = get_the_ID();

		$warnings = Helpmate_Elementor_Utils::get_scheduling_widget_warnings( $post_id );
		if ( ! empty( $warnings ) ) {
			$this->start_controls_section(
				'helpmate_scheduling_warnings',
				array(
					'label' => esc_html__( 'Helpmate notices', 'helpmate-ai-chatbot' ),
				)
			);
			$html = '<div class="elementor-alert elementor-alert-warning">';
			foreach ( $warnings as $w ) {
				$html .= '<p style="margin:0 0 8px;">' . esc_html( $w ) . '</p>';
			}
			$html .= '</div>';
			$this->add_control(
				'helpmate_warnings_html',
				array(
					'type'            => \Elementor\Controls_Manager::RAW_HTML,
					'raw'             => $html,
					'content_classes' => 'elementor-panel-alert elementor-panel-alert-warning',
				)
			);
			$this->end_controls_section();
		}

		$this->start_controls_section(
			'helpmate_scheduling_content',
			array(
				'label' => esc_html__( 'Content', 'helpmate-ai-chatbot' ),
			)
		);

		$this->add_control(
			'heading_text',
			array(
				'label'       => esc_html__( 'Heading', 'helpmate-ai-chatbot' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'default'     => '',
				'placeholder' => esc_html__( 'Schedule an Appointment', 'helpmate-ai-chatbot' ),
			)
		);

		$this->add_responsive_control(
			'align',
			array(
				'label'     => esc_html__( 'Alignment', 'helpmate-ai-chatbot' ),
				'type'      => \Elementor\Controls_Manager::CHOOSE,
				'options'   => array(
					'left'   => array(
						'title' => esc_html__( 'Left', 'helpmate-ai-chatbot' ),
						'icon'  => 'eicon-text-align-left',
					),
					'center' => array(
						'title' => esc_html__( 'Center', 'helpmate-ai-chatbot' ),
						'icon'  => 'eicon-text-align-center',
					),
					'right'  => array(
						'title' => esc_html__( 'Right', 'helpmate-ai-chatbot' ),
						'icon'  => 'eicon-text-align-right',
					),
				),
				'default'   => '',
				'selectors' => array(
					'{{WRAPPER}} .helpmate-scheduling-root' => 'text-align: {{VALUE}};',
				),
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render widget output.
	 *
	 * @return void
	 */
	protected function render() {
		$helpmate = Helpmate_Elementor::instance()->get_helpmate();
		if ( ! $helpmate || ! $helpmate->get_plugin_public() ) {
			return;
		}

		$settings = $this->get_settings_for_display();
		$suffix   = $this->get_id();
		$suffix   = preg_replace( '/[^a-zA-Z0-9_-]/', '', $suffix );
		if ( $suffix === '' ) {
			$suffix = 'el';
		}

		$heading = isset( $settings['heading_text'] ) ? trim( (string) $settings['heading_text'] ) : '';

		$html = $helpmate->get_plugin_public()->get_scheduling_form_html(
			array(
				'instance_suffix' => $suffix,
				'heading_text'    => $heading,
			)
		);

		if ( $html === '' ) {
			if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				echo '<div class="elementor-alert elementor-alert-info">';
				esc_html_e( 'Smart Schedules is disabled or unavailable. Enable it in Helpmate settings.', 'helpmate-ai-chatbot' );
				echo '</div>';
			}
			return;
		}

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Markup from trusted plugin template
		echo $html;
	}
}
