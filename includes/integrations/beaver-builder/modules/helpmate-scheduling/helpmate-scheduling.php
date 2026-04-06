<?php
/**
 * Beaver Builder: Helpmate Smart Schedules module.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class FLHelpmateSchedulingModule
 */
class FLHelpmateSchedulingModule extends FLBuilderModule {

	/**
	 * Constructor.
	 */
	public function __construct() {
		parent::__construct(
			array(
				'name'            => __( 'Helpmate Scheduling', 'helpmate-ai-chatbot' ),
				'description'     => __( 'Display the Helpmate Smart Schedules appointment form.', 'helpmate-ai-chatbot' ),
				'category'        => __( 'Helpmate', 'helpmate-ai-chatbot' ),
				'icon'            => 'schedule.svg',
				'partial_refresh' => true,
			)
		);
	}
}

FLBuilder::register_module(
	'FLHelpmateSchedulingModule',
	array(
		'general' => array(
			'title'    => __( 'Content', 'helpmate-ai-chatbot' ),
			'sections' => array(
				'main' => array(
					'title'  => '',
					'fields' => array(
						'heading_text' => array(
							'type'        => 'text',
							'label'       => __( 'Heading', 'helpmate-ai-chatbot' ),
							'default'     => '',
							'placeholder' => __( 'Schedule an Appointment', 'helpmate-ai-chatbot' ),
						),
						'text_align'   => array(
							'type'    => 'select',
							'label'   => __( 'Alignment', 'helpmate-ai-chatbot' ),
							'default' => '',
							'options' => array(
								''       => __( 'Default', 'helpmate-ai-chatbot' ),
								'left'   => __( 'Left', 'helpmate-ai-chatbot' ),
								'center' => __( 'Center', 'helpmate-ai-chatbot' ),
								'right'  => __( 'Right', 'helpmate-ai-chatbot' ),
							),
						),
					),
				),
			),
		),
	)
);
