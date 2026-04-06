<?php
/**
 * Beaver Builder: Helpmate Promo Bar module.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class FLHelpmatePromoBannerModule
 */
class FLHelpmatePromoBannerModule extends FLBuilderModule {

	/**
	 * Constructor.
	 */
	public function __construct() {
		parent::__construct(
			array(
				'name'            => __( 'Helpmate Promo Bar', 'helpmate-ai-chatbot' ),
				'description'     => __( 'Display a Helpmate promo banner with optional style overrides.', 'helpmate-ai-chatbot' ),
				'category'        => __( 'Helpmate', 'helpmate-ai-chatbot' ),
				'icon'            => 'megaphone.svg',
				'partial_refresh' => true,
			)
		);
	}
}

$promo_options = Helpmate_Beaver_Builder::get_promo_banner_select_options();

FLBuilder::register_module(
	'FLHelpmatePromoBannerModule',
	array(
		'content' => array(
			'title'    => __( 'Content', 'helpmate-ai-chatbot' ),
			'sections' => array(
				'main' => array(
					'title'  => '',
					'fields' => array(
						'banner_id' => array(
							'type'    => 'select',
							'label'   => __( 'Promo banner', 'helpmate-ai-chatbot' ),
							'options' => $promo_options,
							'default' => '',
						),
					),
				),
			),
		),
		'style'   => array(
			'title'    => __( 'Style overrides', 'helpmate-ai-chatbot' ),
			'sections' => array(
				'overrides' => array(
					'title'  => '',
					'fields' => array(
						'override_background_color'         => array(
							'type'  => 'color',
							'label' => __( 'Bar background', 'helpmate-ai-chatbot' ),
							'show_reset' => true,
						),
						'override_text_color'               => array(
							'type'  => 'color',
							'label' => __( 'Text color', 'helpmate-ai-chatbot' ),
							'show_reset' => true,
						),
						'override_text_font_size'           => array(
							'type'        => 'unit',
							'label'       => __( 'Text font size', 'helpmate-ai-chatbot' ),
							'units'       => array( 'px', 'em', 'rem' ),
							'placeholder' => '',
						),
						'override_button_background_color'  => array(
							'type'  => 'color',
							'label' => __( 'Button background', 'helpmate-ai-chatbot' ),
							'show_reset' => true,
						),
						'override_button_text_color'        => array(
							'type'  => 'color',
							'label' => __( 'Button text color', 'helpmate-ai-chatbot' ),
							'show_reset' => true,
						),
						'override_button_text_font_size'    => array(
							'type'        => 'unit',
							'label'       => __( 'Button font size', 'helpmate-ai-chatbot' ),
							'units'       => array( 'px', 'em', 'rem' ),
							'placeholder' => '',
						),
						'override_countdown_background_color' => array(
							'type'  => 'color',
							'label' => __( 'Countdown background', 'helpmate-ai-chatbot' ),
							'show_reset' => true,
						),
						'override_countdown_text_color'     => array(
							'type'  => 'color',
							'label' => __( 'Countdown text', 'helpmate-ai-chatbot' ),
							'show_reset' => true,
						),
					),
				),
			),
		),
	)
);
