<?php

/**
 * The file that defines the chat functionality of the plugin
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

// Include the separated class files
require_once plugin_dir_path(__FILE__) . 'class-helpmate-chat-database.php';
require_once plugin_dir_path(__FILE__) . 'class-helpmate-chat-response-generator.php';
require_once plugin_dir_path(__FILE__) . 'class-helpmate-chat-helpers.php';

/**
 * The chat functionality of the plugin.
 *
 * This class handles all chat-related functionality including:
 * - Handling chat requests
 * - Managing chat sessions
 * - Retrieving chat history
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Chat
{

    /**
     * The database instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate    $helpmate    The helpmate instance.
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
     * The tone of the chat.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $tone    The tone.
     */
    private $tone = 'friendly';

    /**
     * The database handler instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate_Chat_Database    $database    The database handler instance.
     */
    private $database;

    /**
     * The response generator instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate_Chat_Response_Generator    $response_generator    The response generator instance.
     */
    private $response_generator;

    /**
     * The helpers instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate_Chat_Helpers    $helpers    The helpers instance.
     */
    private $helpers;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(HelpMate $helpmate)
    {
        $this->helpmate = $helpmate;
        $this->temperature = $this->helpmate->get_settings()->get_setting('ai')['temperature'];
        $this->tone = $this->helpmate->get_settings()->get_setting('ai')['tone'];

        // Initialize the component instances
        $this->database = new HelpMate_Chat_Database();
        $this->helpers = new HelpMate_Chat_Helpers($this->helpmate, $this->database);
        $this->response_generator = new HelpMate_Chat_Response_Generator($this->helpmate);
    }

    /**
     * Handle the chat request.
     *
     * @since 1.0.0
     * @param array $params The request.
     * @return WP_REST_Response The response.
     */
    public function handle_chat_request($params)
    {
        $session_id = $params['session_id'];
        $message = $params['message'];
        $image_url = $params['image_url'];
        $product_id = $params['product_id'];

        if (empty($message)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => 'Message is required'
            ], 400);
        }

        try {
            // Let the AI decide if it needs RAG context through the Two-Step Tool Call system
            $result = $this->response_generator->generate_response($message, [], $session_id, $image_url, $product_id, $this->helpers);

            // Store the messages using helpers
            $message_ids = $this->helpers->store_messages($result['session_id'], $message, json_encode($result['response']), (object) ['usage' => (object) ['totalTokens' => 0]], ['rag_context' => $result['rag_context']]);

            return new WP_REST_Response([
                'error' => false,
                'reply' => $result['response'],
                'message_ids' => $message_ids,
                'session_id' => $result['session_id']
            ]);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get chat history data for a specific session.
     *
     * @since 1.0.0
     * @param string $session_id The chat session ID.
     * @param int $limit Maximum number of messages to retrieve.
     * @return array The chat history.
     */
    public function get_chat_history_data($session_id, $limit = 1000)
    {
        return $this->database->get_chat_history_data($session_id, $limit);
    }

    /**
     * Get all chat history grouped by session_id and ordered by date.
     *
     * @since 1.0.0
     * @param int $page The page number (1-based).
     * @param int $per_page Number of items per page.
     * @return WP_REST_Response The response.
     */
    public function get_all_chat_sessions($page = 1, $per_page = 10)
    {
        return $this->database->get_all_chat_sessions($page, $per_page);
    }

    /**
     * Delete chat history for a specific session.
     *
     * @since 1.0.0
     * @param string $session_id The chat session ID.
     * @return bool True on success, false on failure.
     */
    public function delete_chat_history($session_id)
    {
        return $this->database->delete_chat_history($session_id);
    }

    /**
     * Update chat history metadata by ID.
     *
     * @since 1.0.0
     * @param array $params The request object.
     * @return WP_REST_Response The response.
     */
    public function update_chat_metadata($params)
    {
        return $this->database->update_chat_metadata($params);
    }

    /**
     * Handle the embedding.
     *
     * @since 1.0.0
     * @param array $prompt The prompt.
     * @param string $type The type of embedding.
     * @return array The embedding.
     */
    public function handle_embedding($prompt, $type)
    {
        return $this->helpers->handle_embedding($prompt, $type);
    }

    /**
     * Clear chat history for a session.
     *
     * @since 1.0.0
     * @param array $params The request.
     * @return WP_REST_Response The response.
     */
    public function clear_chat_history($params)
    {
        $session_id = $params['session_id'];

        if (empty($session_id)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Session ID is required', 'helpmate')
            ], 400);
        }

        try {
            $success = $this->delete_chat_history($session_id);
            return new WP_REST_Response([
                'error' => false,
                'success' => $success
            ]);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get chat history for a session.
     *
     * @since 1.0.0
     * @param array $params The request.
     * @return WP_REST_Response The response.
     */
    public function get_chat_history($params)
    {
        $session_id = $params['session_id'];
        $limit = isset($params['limit']) ? $params['limit'] : 1000;

        if (empty($session_id)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Session ID is required', 'helpmate')
            ], 400);
        }

        try {
            $history = $this->get_chat_history_data($session_id, $limit);

            return new WP_REST_Response([
                'error' => false,
                'history' => $history
            ]);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Convert a URL to text.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request.
     * @return WP_REST_Response The response.
     */
    public function url_content_to_text($request)
    {
        return $this->helpers->url_content_to_text($request);
    }

    /**
     * Quick train homepage.
     *
     * @since 1.0.0
     * @return WP_REST_Response The response.
     */
    public function quick_train_homepage()
    {
        return $this->helpers->quick_train_homepage();
    }

    /**
     * Get the context.
     *
     * @since 1.0.0
     * @param array $context The context.
     * @return array The context.
     */
    public function get_context($context)
    {
        return $this->helpers->get_context($context);
    }

    /**
     * Get the chat response.
     *
     * @since 1.0.0
     * @param string $prompt The prompt.
     * @param array $messages The messages.
     * @param string $session_id The session ID.
     * @param string $custom_system_message The custom system message.
     * @return array The chat response.
     */
    public function get_chat_response($prompt, $messages, $session_id, $custom_system_message = '')
    {
        return $this->response_generator->get_chat_response($prompt, $messages, $session_id, $custom_system_message);
    }
}