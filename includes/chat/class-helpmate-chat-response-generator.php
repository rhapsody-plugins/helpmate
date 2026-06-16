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
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
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
     * @param string $image_url The image URL.
     * @param bool $debug Whether to enable debug mode.
     * @return array The chat response.
     */
    public function get_chat_response($prompt, $messages, $session_id, $custom_system_message = '', $image_url = '', $debug = false)
    {

        $website_title = get_bloginfo('name');
        $website_url = helpmate_get_site_url();
        $api_key = $this->helpmate->get_api()->get_key();
        $validation_key = $this->helpmate->get_api()->get_validation_key();
        $tone = $this->helpmate->get_settings()->get_setting('ai')['tone'];
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

        // Get user's OpenAI API key if available
        $user_openai_key = $this->helpmate->get_api()->get_openai_key();

        // Prepare request body
        $body_data = [
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
            'modules' => $this->modules_in_use(),
            'debug' => $debug
        ];

        // Include handover for social only when Pro license + Pro plugin
        $is_social = is_string($session_id) && strpos($session_id, 'social_') === 0;
        $can_use_handover = $this->helpmate->get_product_slug() !== 'helpmate-free'
            && $this->helpmate->is_helpmate_pro_active();
        if ($is_social && $can_use_handover) {
            $body_data['include_handover_for_social'] = true;
        }

        // Only add user OpenAI key if it exists
        if (!empty($user_openai_key)) {
            $body_data['user_openai_api_key'] = $user_openai_key;
        }

        // Call the AI API
        $response = wp_remote_post($this->helpmate->get_api()->get_api_server() . '/wp-json/rp/v1/proxy', [
            'method' => 'POST',
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode($body_data),
            'timeout' => 60,
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
     * @param bool $debug Whether to enable debug mode.
     * @return array The response with session_id.
     */
    public function generate_response(string $prompt, array $context = [], string $session_id = '', string $image_url = '', $product_id = '', $helpers = null, $debug = false): array
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

        $data = $this->get_chat_response($prompt, $messages, $session_id, '', $image_url, $debug);

        $data = $this->execute_tool_call($data, $session_id);

        if (empty($data)) {
            return [
                'response' => [
                    'type' => 'text',
                    'text' => 'Sorry, I\'m having trouble processing your request. Please try again later.'
                ],
                'session_id' => $session_id,
                'rag_context' => '',
                'training_instructions' => ''
            ];
        }

        if (isset($data['error']) && $data['error']) {
            return [
                'response' => [
                    'type' => 'text',
                    'text' => $data['message']
                ],
                'session_id' => $session_id,
                'rag_context' => isset($data['rag_context']) ? $data['rag_context'] : '',
                'training_instructions' => isset($data['training_instructions']) ? $data['training_instructions'] : ''
            ];
        }

        if (isset($data['status']) && $data['status'] == 'success') {
            if (isset($data['tool_results']) && !empty($data['tool_results'])) {
                $reply = $this->decode_tool_result($data['tool_results'][0]['result']);
                $reply = $this->normalize_tool_reply($reply);
            } else {
                $reply = [
                    'type' => 'text',
                    'text' => $data['response']['message']
                ];
            }

            return [
                'response' => $reply,
                'session_id' => $session_id,
                'rag_context' => isset($data['rag_context']) ? $data['rag_context'] : '',
                'training_instructions' => isset($data['training_instructions']) ? $data['training_instructions'] : ''
            ];
        } else {
            return [
                'response' => [
                    'type' => 'text',
                    'text' => $data['message']
                ],
                'session_id' => $session_id,
                'rag_context' => isset($data['rag_context']) ? $data['rag_context'] : '',
                'training_instructions' => isset($data['training_instructions']) ? $data['training_instructions'] : ''
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
        $provider = method_exists($this->helpmate, 'get_primary_commerce_provider')
            ? $this->helpmate->get_primary_commerce_provider()
            : '';
        if (empty($provider)) {
            return [];
        }
        if ($provider === 'easy_digital_downloads' && method_exists($this->helpmate, 'get_edd')) {
            $product_info = $this->helpmate->get_edd()->get_product_info($product_id);
        } elseif ($provider === 'surecart' && method_exists($this->helpmate, 'get_surecart')) {
            $product_info = $this->helpmate->get_surecart()->get_product_info($product_id);
        } elseif ($provider === 'woocommerce' && method_exists($this->helpmate, 'get_woocommerce')) {
            $product_info = $this->helpmate->get_woocommerce()->get_product_info($product_id);
        } else {
            $product_info = [];
        }
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
        if ($this->helpmate->get_product_slug() !== 'helpmate-free' && !$this->helpmate->is_helpmate_pro_active()) {
            $modules_in_use[] = 'show_handover_to_human';
        }
        if (
            !empty($modules[HELPMATE_MODULE_IMAGE_SEARCH])
            && method_exists($this->helpmate, 'is_image_search_operational')
            && $this->helpmate->is_image_search_operational()
        ) {
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
        $active_providers = method_exists($this->helpmate, 'get_active_commerce_providers')
            ? $this->helpmate->get_active_commerce_providers()
            : [];
        if (empty($active_providers)) {
            $modules_in_use[] = 'show_products';
            $modules_in_use[] = 'show_products_by_keywords';
        }
        return $modules_in_use;
    }

    /**
     * Execute the tool call.
     *
     * @param array  $data        The data.
     * @param string $session_id  The chat session ID.
     * @return array The data.
     */
    private function execute_tool_call($data, $session_id = '')
    {
        if (isset($data['status']) && $data['status'] == 'success') {
            if (isset($data['tool_results']) && !empty($data['tool_results'])) {
                $tool = $data['tool_results'][0]['tool_name'];
                switch ($tool) {
                    case 'show_ticket_options':
                        $data['tool_results'][0]['result'] = $this->helpmate->get_ticket()->show_ticket_options();
                        break;
                    case 'show_handover_to_human':
                        $data['tool_results'][0]['result'] = $this->helpmate->get_general_tools()->show_handover_to_human($session_id);
                        break;
                    case 'show_products':
                        $provider = method_exists($this->helpmate, 'get_primary_commerce_provider')
                            ? $this->helpmate->get_primary_commerce_provider()
                            : '';
                        if (empty($provider)) {
                            $data['tool_results'][0]['result'] = [
                                'type' => 'text',
                                'text' => 'Select a commerce provider in Integrations first.'
                            ];
                            break;
                        }
                        if ($provider === 'easy_digital_downloads' && method_exists($this->helpmate, 'get_edd')) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_edd()->show_products($data['tool_results'][0]['parameters']);
                        } elseif ($provider === 'surecart' && method_exists($this->helpmate, 'get_surecart')) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_surecart()->show_products($data['tool_results'][0]['parameters']);
                        } elseif ($provider === 'woocommerce' && method_exists($this->helpmate, 'get_woocommerce')) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_woocommerce()->show_products($data['tool_results'][0]['parameters']);
                        } else {
                            $data['tool_results'][0]['result'] = [
                                'type' => 'text',
                                'text' => 'eCommerce features are not available. Please try again later.'
                            ];
                        }
                        break;
                    case 'show_products_by_keywords':
                        $provider = method_exists($this->helpmate, 'get_primary_commerce_provider')
                            ? $this->helpmate->get_primary_commerce_provider()
                            : '';
                        if (empty($provider)) {
                            $data['tool_results'][0]['result'] = [
                                'type' => 'text',
                                'text' => 'Select a commerce provider in Integrations first.'
                            ];
                            break;
                        }
                        if ($provider === 'easy_digital_downloads' && method_exists($this->helpmate, 'get_edd')) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_edd()->show_products_by_keywords($data['tool_results'][0]['parameters']);
                        } elseif ($provider === 'surecart' && method_exists($this->helpmate, 'get_surecart')) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_surecart()->show_products_by_keywords($data['tool_results'][0]['parameters']);
                        } elseif ($provider === 'woocommerce' && method_exists($this->helpmate, 'get_woocommerce')) {
                            $data['tool_results'][0]['result'] = $this->helpmate->get_woocommerce()->show_products_by_keywords($data['tool_results'][0]['parameters']);
                        } else {
                            $data['tool_results'][0]['result'] = [
                                'type' => 'text',
                                'text' => 'eCommerce features are not available. Please try again later.'
                            ];
                        }
                        break;
                    case 'show_order_tracker_options':
                        $data['tool_results'][0]['result'] = $this->resolve_pro_tool_result(
                            'show_order_tracker_options',
                            function () {
                                return $GLOBALS['helpmate_pro']->get_order_tracker()->show_order_tracker_options();
                            }
                        );
                        break;
                    case 'show_refund_return_options':
                        $data['tool_results'][0]['result'] = $this->resolve_pro_tool_result(
                            'show_refund_return_options',
                            function () {
                                return $GLOBALS['helpmate_pro']->get_refund_return()->show_refund_return_options();
                            }
                        );
                        break;
                    case 'show_coupon_delivery':
                        $data['tool_results'][0]['result'] = $this->resolve_pro_tool_result(
                            'show_coupon_delivery',
                            function () {
                                return $GLOBALS['helpmate_pro']->get_coupon_delivery()->show_coupon_delivery();
                            }
                        );
                        break;
                    case 'show_image_search':
                        $image_search_params = $data['tool_results'][0]['parameters'] ?? [];
                        $data['tool_results'][0]['result'] = $this->resolve_pro_tool_result(
                            'show_image_search',
                            function () use ($image_search_params) {
                                return $GLOBALS['helpmate_pro']->get_image_search()->show_image_search($image_search_params);
                            }
                        );
                        break;
                    default:
                        return $data;
                }
            }
        }

        return $data;
    }

    /**
     * Decode a tool result (JSON string or array) into an object for the widget.
     *
     * @param mixed $raw Raw tool result.
     * @return object|null
     */
    private function decode_tool_result($raw)
    {
        if (is_string($raw)) {
            return json_decode($raw);
        }
        if (is_array($raw)) {
            return json_decode(wp_json_encode($raw));
        }
        return null;
    }

    /**
     * Ensure tool reply has displayable text; attach admin feature_error when Pro plugin is inactive.
     *
     * @param object|null $reply Decoded tool reply.
     * @return object|array
     */
    private function normalize_tool_reply($reply)
    {
        $text = '';
        if (is_object($reply) && isset($reply->text) && is_string($reply->text)) {
            $text = trim($reply->text);
        } elseif (is_array($reply) && isset($reply['text']) && is_string($reply['text'])) {
            $text = trim($reply['text']);
        }

        if ($text !== '') {
            return $reply;
        }

        return $this->build_empty_tool_fallback_reply();
    }

    /**
     * Encode assistant response for chat history storage (never persists literal null).
     *
     * @param mixed $response Response from generate_response.
     * @return string JSON string for DB.
     */
    public function encode_response_for_storage($response)
    {
        return wp_json_encode($this->normalize_response_for_storage($response));
    }

    /**
     * Fallback when a tool returns no usable payload (avoids storing literal "null").
     *
     * @return object
     */
    private function build_empty_tool_fallback_reply()
    {
        return json_decode(wp_json_encode($this->build_empty_tool_fallback_array()));
    }

    /**
     * @return array<string, mixed>
     */
    private function build_empty_tool_fallback_array()
    {
        $payload = [
            'type' => 'text',
            'text' => $this->helpmate->get_pro_tool_customer_unavailable_message(),
        ];

        if ($this->helpmate->is_pro_license_plugin_mismatch()) {
            $payload['feature_error'] = [
                'code' => 'pro_plugin_inactive',
                'admin_message' => $this->helpmate->get_pro_plugin_inactive_admin_message(),
            ];
        }

        return $payload;
    }

    /**
     * @param mixed $response Response object or array.
     * @return array<string, mixed>
     */
    private function normalize_response_for_storage($response)
    {
        if ($response === null) {
            return $this->build_empty_tool_fallback_array();
        }

        $encoded = wp_json_encode($response);
        if ($encoded === 'null' || $encoded === false) {
            return $this->build_empty_tool_fallback_array();
        }

        $arr = json_decode($encoded, true);
        if (! is_array($arr)) {
            return $this->build_empty_tool_fallback_array();
        }

        $text = isset($arr['text']) && is_string($arr['text']) ? trim($arr['text']) : '';
        if ($text === '') {
            return $this->build_empty_tool_fallback_array();
        }

        return $arr;
    }

    /**
     * Run a Pro tool handler or return inactive-plugin fallback JSON.
     *
     * @param string   $tool_name Tool identifier for admin metadata.
     * @param callable $handler   Callable that returns the Pro module JSON string.
     * @return string JSON-encoded tool result.
     */
    private function resolve_pro_tool_result(string $tool_name, callable $handler)
    {
        if ($this->helpmate->is_pro_available()) {
            return $handler();
        }

        if ($this->helpmate->is_pro_license_plugin_mismatch()) {
            return $this->build_pro_plugin_inactive_tool_result($tool_name);
        }

        return '';
    }

    /**
     * JSON tool result when Pro license is active but Helpmate Pro plugin is not.
     *
     * @param string $tool_name Tool name for admin diagnostics.
     * @return string
     */
    private function build_pro_plugin_inactive_tool_result(string $tool_name)
    {
        return wp_json_encode([
            'type' => 'text',
            'text' => $this->helpmate->get_pro_tool_customer_unavailable_message(),
            'feature_error' => [
                'code' => 'pro_plugin_inactive',
                'admin_message' => $this->helpmate->get_pro_plugin_inactive_admin_message(),
                'tool' => $tool_name,
            ],
        ]);
    }
}