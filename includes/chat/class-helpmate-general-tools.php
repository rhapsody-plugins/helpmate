<?php

/**
 * The general tools functionality of the plugin.
 *
 * This class handles general tools including:
 * - FAQ options tool
 * - Handover to human tool
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/chat
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

class Helpmate_General_Tools
{

    /**
     * The helpmate instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Show the handover to human.
     *
     * @since 1.0.0
     * @return string The response.
     */
    public function show_handover_to_human()
    {
        $settings = $this->helpmate->get_settings()->get_setting('behavior');
        $human_handover = $settings['human_handover'];
        $show_ticket_creation_option = $settings['show_ticket_creation_option'];

        $available_handovers = [];
        foreach ($human_handover as $handover) {
            if ($handover['enabled']) {
                if ($handover['title'] && $handover['value']) {
                    $available_handovers[] = [
                        'title' => $handover['title'],
                        'value' => $handover['value']
                    ];
                }
            }
        }

        if (empty($available_handovers) && !$show_ticket_creation_option) {
            return json_encode([
                'type' => 'text',
                'text' => 'Sorry, I am not able to contact the support team at the moment. Please try again later.'
            ]);
        }

        return json_encode([
            'type' => 'handover',
            'text' => 'Here is how you can contact the support team: ',
            'data' => [
                'handover' => $available_handovers,
                'submitted' => false,
            ]
        ]);
    }
}