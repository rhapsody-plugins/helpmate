<?php

/**
 * The chat response generation functionality of the plugin.
 *
 * This class handles all AI response generation operations:
 * - Two-Step Tool Call system
 * - Message preparation and processing
 * - Tool request handling
 * - RAG context integration
 * - Final response generation
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/chat
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Chat_Response_Generator
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
     * The temperature of the chat.
     *
     * @since    1.0.0
     * @access   private
     * @var      float    $temperature    The temperature.
     */
    private $temperature = 0;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
        $this->temperature = $this->helpmate->get_settings()->get_setting('ai')['temperature'];
    }

    /**
     * Check if image search is enabled.
     *
     * @return bool True if image search is enabled.
     */
    private function is_image_search_enabled()
    {
        return isset($this->helpmate->get_settings()->get_setting('modules')[HELPMATE_MODULE_IMAGE_SEARCH]) &&
            $this->helpmate->get_settings()->get_setting('modules')[HELPMATE_MODULE_IMAGE_SEARCH] === true;
    }

    /**
     * Get the chat response.
     *
     * @since 1.0.0
     * @param string $prompt The prompt.
     * @param array $messages The messages.
     * @param string $session_id The session ID.
     * @param string $custom_system_message The custom system message.
     * @param array $rag_context The RAG context.
     * @param string $image_url The image URL.
     * @return array The chat response.
     */
    public function get_chat_response($prompt, $messages, $session_id, $custom_system_message = '', $image_url = '')
    {

        $website_title = get_bloginfo('name');
        $website_url = get_bloginfo('url');
        $api_key = $this->helpmate->get_api()->get_key();
        $validation_key = $this->helpmate->get_api()->get_validation_key();
        $tone = $this->helpmate->get_settings()->get_setting('ai')['tone'];
        $temperature = $this->helpmate->get_settings()->get_setting('ai')['temperature'];
        $similarity_threshold = $this->helpmate->get_settings()->get_setting('ai')['similarity_threshold'];
        $chatbot_name = $this->helpmate->get_settings()->get_setting('customization')['bot_name'];
        $language = $this->helpmate->get_settings()->get_setting('ai')['language'];

        if (empty($custom_system_message)) {
            $custom_system_message = 'You are ' . $chatbot_name . ', a ' . $tone . ', highly knowledgeable and efficient website assistant for "' . $website_title . '". You exist ONLY on this website and must never reference or suggest anything outside it.';
            if ($language) {
                $custom_system_message .= ' Always respond in ' . $language . '.';
            }
        }

        $timestamp = time();
        $nonce = bin2hex(random_bytes(8));
        $dataToSign = $prompt . '|' . $timestamp . '|' . $nonce;
        $signature = hash_hmac('sha256', $dataToSign, $validation_key);

        // Call the AI API
        $response = wp_remote_post($this->helpmate->get_api()->get_api_server() . '/wp-json/rp/v1/proxy', [
            'method' => 'POST',
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode([
                "prompt" => $prompt,
                "wordpress_url" => $website_url,
                "system_message" => $custom_system_message,
                "message_history" => json_encode($messages),
                "image_url" => $image_url,
                "session_id" => $session_id,
                "timestamp" => $timestamp,
                "nonce" => $nonce,
                "api_key" => $api_key,
                "validation_key" => $validation_key,
                "signature" => $signature,
                "feature_slug" => 'ai_response',
                'temperature' => $temperature,
                'similarity_threshold' => $similarity_threshold,
                'modules' => $this->modules_in_use()
            ]),
            'timeout' => 30,
        ]);

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        // Ai Response Debug
        // error_log(print_r($data, true));

        return $data;
    }

    /**
     * Generate a response using Two-Step Tool Call system.
     *
     * @since 1.0.0
     * @param string $prompt The prompt.
     * @param array $context The context.
     * @param string $model The model.
     * @param string $session_id Optional session ID for chat history.
     * @param string $image_url Optional image URL for image search.
     * @param string $product_id Optional product ID.
     * @param Helpmate_Chat_Helpers $helpers The helpers instance.
     * @return array The response with session_id.
     */
    public function generate_response(string $prompt, array $context = [], string $session_id = '', string $image_url = '', $product_id = '', $helpers = null): array
    {
        // Initialize session if needed
        if (empty($session_id)) {
            $session_id = uniqid('chat_', true);
        }

        // Prepare initial messages
        $messages = $this->prepare_initial_messages($prompt, $context, $session_id, $image_url, $helpers);

        if (isset($product_id) && !empty($product_id)) {
            $product_info = $this->prepare_product_info($product_id);
            if (!empty($product_info)) {
                $prompt = $prompt . ' Product information: ' . json_encode($product_info);
            }
        }

        $data = $this->get_chat_response($prompt, $messages, $session_id, '', $image_url);

        $data = $this->execute_tool_call($data);

        if (isset($data['error']) && $data['error']) {
            return [
                'response' => [
                    'type' => 'text',
                    'text' => $data['message']
                ],
                'session_id' => $session_id,
                'rag_context' => isset($data['rag_context']) ? $data['rag_context'] : ''
            ];
        }

        if (isset($data['status']) && $data['status'] == 'success') {
            if (isset($data['tool_results']) && !empty($data['tool_results'])) {
                $reply = json_decode($data['tool_results'][0]['result']);
                // if (isset($data['response']['message']) && !empty($data['response']['message'])) {
                //     $reply->text = $data['response']['message'];
                // }
            } else {
                $reply = [
                    'type' => 'text',
                    'text' => $data['response']['message']
                ];
            }

            return [
                'response' => $reply,
                'session_id' => $session_id,
                'rag_context' => isset($data['rag_context']) ? $data['rag_context'] : ''
            ];
        } else {
            return [
                'response' => [
                    'type' => 'text',
                    'text' => $data['message']
                ],
                'session_id' => $session_id,
                'rag_context' => isset($data['rag_context']) ? $data['rag_context'] : ''
            ];
        }
    }

    /**
     * Prepare initial messages for the conversation.
     *
     * @param string $prompt The user prompt.
     * @param array $context The context array.
     * @param string $session_id The session ID.
     * @param string $image_url Optional image URL.
     * @param Helpmate_Chat_Helpers $helpers The helpers instance.
     * @return array The prepared messages.
     */
    private function prepare_initial_messages($prompt, $context, $session_id, $image_url, $helpers)
    {
        $messages = [];
        $extra_system_message = $helpers ? $helpers->get_extra_system_message() : [];

        // Add system messages and chat history
        $messages = $helpers ? $helpers->prepare_messages($messages, $session_id, $extra_system_message) : $messages;

        // Add context if available
        if (!empty($context) && empty($image_url)) {
            $context_message = $helpers ? $helpers->get_context($context) : [];
            if (!empty($context_message)) {
                $messages[] = $context_message;
            }
        }

        return $messages;
    }

    /**
     * Prepare the product info.
     *
     * @param int $product_id The product ID.
     * @return array The product info.
     */
    private function prepare_product_info($product_id)
    {
        $product_info = $this->helpmate->get_woocommerce()->get_product_info($product_id);
        if (!empty($product_info)) {
            return $product_info;
        }
        return [];
    }

    /**
     * Get the modules in use.
     *
     * @return array The modules in use.
     */
    private function modules_in_use()
    {
        $modules = $this->helpmate->get_settings()->get_setting('modules') ?? [];
        $modules_in_use = [];
        if (!$this->helpmate->is_helpmate_pro_active()) {
            $modules_in_use[] = 'show_handover_to_human';
        }
        if (isset($modules['image-search']) && !$modules['image-search'] && !$this->helpmate->is_woocommerce_active()) {
            $modules_in_use[] = 'show_image_search';
        }
        if (isset($modules['ticket-system']) && !$modules['ticket-system']) {
            $modules_in_use[] = 'show_ticket_options';
        }
        if (isset($modules['order-tracker']) && !$modules['order-tracker']) {
            $modules_in_use[] = 'show_order_tracker_options';
        }
        if (isset($modules['refund-return']) && !$modules['refund-return']) {
            $modules_in_use[] = 'show_refund_return_options';
        }
        if (isset($modules['coupon-delivery']) && !$modules['coupon-delivery']) {
            $modules_in_use[] = 'show_coupon_delivery';
        }
        if (!$this->helpmate->is_woocommerce_active()) {
            $modules_in_use[] = 'show_products';
            $modules_in_use[] = 'show_products_by_keywords';
        }
        return $modules_in_use;
    }

    /**
     * Execute the tool call.
     *
     * @param array $data The data.
     * @return array The data.
     */
    private function execute_tool_call($data)
    {
        if (isset($data['status']) && $data['status'] == 'success') {
            if (isset($data['tool_results']) && !empty($data['tool_results'])) {
                $tool = $data['tool_results'][0]['tool_name'];
                switch ($tool) {
                    case 'show_ticket_options':
                        $data['tool_results'][0]['result'] = $this->helpmate->get_ticket()->show_ticket_options();
                        break;
                    case 'show_handover_to_human':
                        $data['tool_results'][0]['result'] = $this->helpmate->get_general_tools()->show_handover_to_human();
                        break;
                    case 'show_products':
                        if ($this->helpmate->is_woocommerce_active()) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_woocommerce()->show_products($data['tool_results'][0]['parameters']);
                        } else {
                            $data['tool_results'][0]['result'] = [
                                'type' => 'text',
                                'text' => 'eCommerce features are not available. Please try again later.'
                            ];
                        }
                        break;
                    case 'show_products_by_keywords':
                        if ($this->helpmate->is_woocommerce_active()) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_woocommerce()->show_products_by_keywords($data['tool_results'][0]['parameters']);
                        } else {
                            $data['tool_results'][0]['result'] = [
                                'type' => 'text',
                                'text' => 'eCommerce features are not available. Please try again later.'
                            ];
                        }
                        break;
                    case 'show_order_tracker_options':
                        if ($this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active()) {
                            $data['tool_results'][0]['result'] = $GLOBALS['helpmate_pro']->get_order_tracker()->show_order_tracker_options();
                        }
                        break;
                    case 'show_refund_return_options':
                        if ($this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active()) {
                            $data['tool_results'][0]['result'] = $GLOBALS['helpmate_pro']->get_refund_return()->show_refund_return_options();
                        }
                        break;
                    case 'show_coupon_delivery':
                        if ($this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active()) {
                            $data['tool_results'][0]['result'] = $GLOBALS['helpmate_pro']->get_coupon_delivery()->show_coupon_delivery();
                        }
                        break;
                    case 'show_image_search':
                        if ($this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active()) {
                            $data['tool_results'][0]['result'] = $GLOBALS['helpmate_pro']->get_image_search()->show_image_search($data['tool_results'][0]['parameters']);
                        }
                        break;
                    default:
                        return $data;
                }
            }
        }

        return $data;
    }
}