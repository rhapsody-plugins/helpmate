<?php

/**
 * The file that defines the general tools functionality of the plugin
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

/**
 * The general tools functionality of the plugin.
 *
 * This class handles general tools including:
 * - FAQ options tool
 * - Handover to human tool
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_General_Tools
{

    /**
     * The helpmate instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(HelpMate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Show the faq options.
     *
     * @since 1.0.0
     * @return string The response.
     */
    public function show_faq_options()
    {
        $qa_documents = $this->helpmate->get_document_handler()->get_indexed_documents('qa');

        if (is_wp_error($qa_documents) || empty($qa_documents)) {
            return json_encode(array(
                'type' => 'text',
                'text' => 'No FAQs available'
            ));
        }

        $documents = $qa_documents->get_data()['documents'];
        $filtered_documents = array_filter($documents, function ($doc) {
            $metadata = is_string($doc['metadata']) ? json_decode($doc['metadata'], true) : $doc['metadata'];
            return isset($metadata['show']) && $metadata['show'] === true;
        });

        if (empty($filtered_documents)) {
            return json_encode(array(
                'type' => 'faq-options',
                'data' => []
            ));
        }

        return json_encode(array(
            'type' => 'faq-options',
            'text' => 'Here are the available FAQ options:',
            'data' => array_values($filtered_documents)
        ));
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

        if (empty($available_handovers)) {
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