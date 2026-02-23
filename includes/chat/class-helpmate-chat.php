<?php

/**
 * The chat functionality of the plugin.
 *
 * This class handles all chat-related functionality including:
 * - Handling chat requests
 * - Managing chat sessions
 * - Retrieving chat history
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

// Include the separated class files
require_once plugin_dir_path(__FILE__) . 'class-helpmate-chat-database.php';
require_once plugin_dir_path(__FILE__) . 'class-helpmate-chat-response-generator.php';
require_once plugin_dir_path(__FILE__) . 'class-helpmate-chat-helpers.php';

class Helpmate_Chat
{

    /**
     * The database instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

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
     * @var      Helpmate_Chat_Database    $database    The database handler instance.
     */
    private $database;

    /**
     * The response generator instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate_Chat_Response_Generator    $response_generator    The response generator instance.
     */
    private $response_generator;

    /**
     * The helpers instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate_Chat_Helpers    $helpers    The helpers instance.
     */
    private $helpers;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
        $this->tone = $this->helpmate->get_settings()->get_setting('ai')['tone'];

        // Initialize the component instances
        $this->database = new Helpmate_Chat_Database();
        $this->helpers = new Helpmate_Chat_Helpers($this->helpmate, $this->database);
        $this->response_generator = new Helpmate_Chat_Response_Generator($this->helpmate);
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
        $debug = isset($params['debug']) ? $params['debug'] : false;

        if (empty($message)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => 'Message is required'
            ], 400);
        }

        // Build user message metadata: store image_url when delete_after_search is OFF
        $user_metadata = [];
        $image_search_settings = $this->helpmate->get_settings()->get_setting('image-search', []);
        $delete_after_search = !empty($image_search_settings['delete_after_search']);
        if (!empty($image_url) && !$delete_after_search) {
            $user_metadata['image_url'] = $image_url;
        }

        try {
            // Initialize session if needed
            if (empty($session_id)) {
                $session_id = uniqid('chat_', true);
            }

            // Check if AI is globally enabled
            $ai_settings = $this->helpmate->get_settings()->get_setting('ai', []);
            $ai_enabled = isset($ai_settings['ai_enabled']) ? (bool) $ai_settings['ai_enabled'] : true;

            if (!$ai_enabled) {
                // AI is globally disabled - store user message but don't generate AI response
                $user_message_id = $this->database->store_chat_message($session_id, $message, 'user', $user_metadata);

                // Increment unread count for website conversation
                $social_chat = $this->helpmate->get_social_chat();
                if ($social_chat && $user_message_id) {
                    $social_chat->increment_website_unread($session_id);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'reply' => null,
                    'message_ids' => [
                        'user' => $user_message_id ?: 0,
                        'assistant' => 0
                    ],
                    'session_id' => $session_id,
                    'ai_disabled' => true
                ]);
            }

            // Check if handoff is active - if so, either return without AI or switch to AI after timeout
            $social_chat = $this->helpmate->get_social_chat();
            if ($social_chat && $social_chat->get_website_handoff_status($session_id)) {
                $behavior = $this->helpmate->get_settings()->get_setting('behavior', []);
                $ai_takeover_after = isset($behavior['ai_takeover_after_seconds']) ? (int) $behavior['ai_takeover_after_seconds'] : 0;

                if ($ai_takeover_after > 0) {
                    $reference_ts = $social_chat->get_website_takeover_reference_timestamp($session_id);
                    if ($reference_ts !== null && (time() - $reference_ts) >= $ai_takeover_after) {
                        $social_chat->toggle_website_handoff($session_id, false);
                        // Fall through to generate AI response (user message will be stored by store_messages)
                    } else {
                        $user_message_id = $this->database->store_chat_message($session_id, $message, 'user', $user_metadata);
                        if ($user_message_id) {
                            $social_chat->increment_website_unread($session_id);
                        }
                        return new WP_REST_Response([
                            'error' => false,
                            'reply' => null,
                            'message_ids' => ['user' => $user_message_id ?: 0, 'assistant' => 0],
                            'session_id' => $session_id,
                            'handoff_active' => true
                        ]);
                    }
                } else {
                    $user_message_id = $this->database->store_chat_message($session_id, $message, 'user', $user_metadata);
                    if ($user_message_id) {
                        $social_chat->increment_website_unread($session_id);
                    }
                    return new WP_REST_Response([
                        'error' => false,
                        'reply' => null,
                        'message_ids' => ['user' => $user_message_id ?: 0, 'assistant' => 0],
                        'session_id' => $session_id,
                        'handoff_active' => true
                    ]);
                }
            }

            // Let the AI decide if it needs RAG context through the Two-Step Tool Call system
            $result = $this->response_generator->generate_response($message, [], $session_id, $image_url, $product_id, $this->helpers, $debug);

            // Prepare metadata (include image_url from user_metadata when delete_after_search is OFF)
            $metadata = array_merge($user_metadata, ['rag_context' => $result['rag_context']]);
            if (!empty($debug)) {
                $metadata['debug'] = true;
            }
            if (isset($result['training_instructions'])) {
                $metadata['training_instructions'] = $result['training_instructions'];
            }

            // Store the messages using helpers
            $message_ids = $this->helpers->store_messages($result['session_id'], $message, json_encode($result['response']), (object) ['usage' => (object) ['totalTokens' => 0]], $metadata);

            // Increment unread count for website conversation (user message creates unread)
            if ($social_chat && isset($message_ids['user']) && $message_ids['user']) {
                $social_chat->increment_website_unread($result['session_id']);
            }

            return new WP_REST_Response([
                'error' => false,
                'reply' => $result['response'],
                'message_ids' => $message_ids,
                'session_id' => $result['session_id'],
                'rag_context' => isset($result['rag_context']) ? $result['rag_context'] : '',
                'training_instructions' => isset($result['training_instructions']) ? $result['training_instructions'] : ''
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
     * @param string $feature_slug The feature slug.
     * @return array The embedding.
     */
    public function handle_embedding($prompt, $type, $feature_slug = 'data_source')
    {
        return $this->helpers->handle_embedding($prompt, $type, $feature_slug);
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
                'message' => __('Session ID is required', 'helpmate-ai-chatbot')
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
                'message' => __('Session ID is required', 'helpmate-ai-chatbot')
            ], 400);
        }

        try {
            $history = $this->get_chat_history_data($session_id, $limit);

            // Get handoff status
            $social_chat = $this->helpmate->get_social_chat();
            $is_handoff = $social_chat ? $social_chat->get_website_handoff_status($session_id) : false;

            // Check if AI is globally enabled
            $ai_settings = $this->helpmate->get_settings()->get_setting('ai', []);
            $ai_enabled = isset($ai_settings['ai_enabled']) ? (bool) $ai_settings['ai_enabled'] : true;

            // Check if admin is typing
            $admin_typing_key = 'helpmate_typing_website_' . $session_id . '_admin';
            $typing_user_id = get_transient($admin_typing_key);
            $is_admin_typing = $typing_user_id !== false;
            
            // Get typing user's avatar if typing
            $typing_user_avatar = null;
            $typing_user_name = null;
            if ($is_admin_typing && $typing_user_id) {
                $user = get_userdata((int) $typing_user_id);
                if ($user) {
                    $typing_user_avatar = get_avatar_url((int) $typing_user_id, ['size' => 32]);
                    $typing_user_name = $user->display_name;
                }
            }

            return new WP_REST_Response([
                'error' => false,
                'history' => $history,
                'is_human_handoff' => $is_handoff,
                'is_admin_typing' => $is_admin_typing,
                'typing_user_avatar' => $typing_user_avatar,
                'typing_user_name' => $typing_user_name,
                'ai_disabled' => !$ai_enabled
            ]);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send a manual reply for website chat (from human agent).
     *
     * @since 1.3.0
     * @param string $session_id The chat session ID.
     * @param string $message The message to send.
     * @return bool|WP_Error True on success, WP_Error on failure.
     */
    public function send_website_reply(string $session_id, string $message)
    {
        if (empty($message)) {
            return new WP_Error('empty_message', __('Message cannot be empty', 'helpmate-ai-chatbot'));
        }

        try {
            // Clear typing status when sending a message
            delete_transient('helpmate_typing_website_' . $session_id . '_admin');

            // Enable handoff for this session
            $social_chat = $this->helpmate->get_social_chat();
            if ($social_chat) {
                $social_chat->toggle_website_handoff($session_id, true);
            }

            // Get current WordPress user ID
            $user_id = get_current_user_id();

            // Get current timestamp - we'll use this to ensure join message comes before the actual message
            $current_timestamp = time();

            // Check if this is the user's first message in this conversation
            $social_chat = $this->helpmate->get_social_chat();
            $virtual_conversation_id = 'website_' . md5($session_id);

            if ($social_chat && !$social_chat->has_user_joined($virtual_conversation_id, $user_id)) {
                // Record the join
                $social_chat->record_team_member_join($virtual_conversation_id, 'website', $user_id);

                // Get user's first name for join notification
                $user = get_userdata($user_id);
                $user_first_name = $user && !empty($user->first_name) ? $user->first_name : ($user ? $user->display_name : __('Team member', 'helpmate-ai-chatbot'));

                // Create system message for join notification
                // Use timestamp - 1 to ensure it appears before the actual message
                // translators: %s: User's first name or display name
                $join_message = sprintf(__('%s joined the conversation', 'helpmate-ai-chatbot'), $user_first_name);
                $join_metadata = [
                    'system_event' => 'team_member_joined',
                    'user_id' => $user_id,
                    'first_name' => $user_first_name,
                ];

                $this->database->store_chat_message(
                    $session_id,
                    $join_message,
                    'system',
                    $join_metadata,
                    $current_timestamp - 1
                );
            }

            // Store as assistant message with metadata indicating it's from human
            $metadata = [
                'sent_by_human' => true,
                'user_id' => $user_id,
            ];

            // Format message as assistant response (similar to AI response format)
            $response_data = [
                'type' => 'text',
                'text' => $message,
            ];

            // Store the message with the current timestamp
            $message_id = $this->database->store_chat_message(
                $session_id,
                json_encode($response_data),
                'assistant',
                $metadata,
                $current_timestamp
            );

            if (!$message_id) {
                return new WP_Error('store_failed', __('Failed to store message', 'helpmate-ai-chatbot'));
            }

            return true;
        } catch (Exception $e) {
            return new WP_Error('exception', $e->getMessage());
        }
    }

    /**
     * Get the response generator instance.
     *
     * @since    1.2.0
     * @return   Helpmate_Chat_Response_Generator    The response generator instance.
     */
    public function get_response_generator()
    {
        return $this->response_generator;
    }

    /**
     * Get the helpers instance.
     *
     * @since    1.2.0
     * @return   Helpmate_Chat_Helpers    The helpers instance.
     */
    public function get_helpers()
    {
        return $this->helpers;
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
     * @param string $image_url The image URL.
     * @param bool $debug Whether to enable debug mode.
     * @return array The chat response.
     */
    public function get_chat_response($prompt, $messages, $session_id, $custom_system_message = '', $image_url = '', $debug = false)
    {
        return $this->response_generator->get_chat_response($prompt, $messages, $session_id, $custom_system_message, $image_url, $debug);
    }
}