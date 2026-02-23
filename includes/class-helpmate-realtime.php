<?php

/**
 * The real-time messaging functionality of the plugin.
 *
 * Handles Server-Sent Events (SSE) for real-time message updates.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) exit;

class Helpmate_Realtime
{
    /**
     * The helpmate instance.
     *
     * @since    1.3.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.3.0
     * @param    Helpmate    $helpmate    The helpmate instance.
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Handle SSE connection for real-time messages.
     *
     * @since    1.3.0
     * @param    string    $conversation_id    The conversation ID (can be numeric or website_xxx).
     * @return   void
     */
    public function handle_sse_messages($conversation_id)
    {
        if (ob_get_level()) {
            ob_end_clean();
        }
        // Release session lock so other same-session requests are not blocked
        if (session_status() === PHP_SESSION_NONE) {
            @session_start(); // phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged -- Avoid blocking other requests
        }
        session_write_close();

        // Set headers for SSE
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Disable buffering in nginx

        // Disable time limit for long-running connection
        // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- Necessary for SSE long-running connections
        set_time_limit(0);
        ignore_user_abort(false);

        // Send initial connection message
        $this->send_sse_message('connected', ['conversation_id' => $conversation_id]);

        $last_check = time();
        $last_message_id = 0;

        // Keep connection alive for up to 5 minutes
        $timeout = 300;
        $start_time = time();

        while ((time() - $start_time) < $timeout) {
            // Check if client disconnected
            if (connection_aborted()) {
                break;
            }

            // Check for new messages every 2 seconds
            if (time() - $last_check >= 2) {
                $new_messages = $this->get_new_messages($conversation_id, $last_message_id);

                if (!empty($new_messages)) {
                    foreach ($new_messages as $message) {
                        $this->send_sse_message('message', $message);
                        $last_message_id = max($last_message_id, (int) $message['id']);
                    }
                }

                // Send heartbeat to keep connection alive
                $this->send_sse_message('heartbeat', ['timestamp' => time()]);

                $last_check = time();
            }

            // Flush output
            if (ob_get_level() > 0) {
                ob_flush();
            }
            flush();
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_write_close();
            }

            // Sleep to avoid CPU spinning
            usleep(500000); // 0.5 seconds
        }
    }

    /**
     * Get new messages since last check.
     *
     * @since    1.3.0
     * @param    string    $conversation_id    The conversation ID.
     * @param    int       $last_message_id    The last message ID seen.
     * @return   array    Array of new messages.
     */
    private function get_new_messages($conversation_id, $last_message_id)
    {
        // Check if this is a website conversation
        if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
            return $this->get_website_new_messages($conversation_id, $last_message_id);
        }

        // Social conversation messages
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_messages');

        $messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table}
                WHERE conversation_id = %d AND id > %d
                ORDER BY id ASC
                LIMIT 50"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                (int) $conversation_id,
                $last_message_id
            ),
            ARRAY_A
        );

        // Add user info for human messages
        foreach ($messages as &$message) {
            if ($message['sent_by'] === 'human' && !empty($message['user_id'])) {
                $user = get_userdata((int) $message['user_id']);
                if ($user) {
                    $message['user_name'] = $user->display_name;
                    $message['user_avatar'] = get_avatar_url((int) $message['user_id'], ['size' => 32]);
                }
            }
            if (!empty($message['meta_data'])) {
                $message['meta_data'] = json_decode($message['meta_data'], true);
            }
        }

        return $messages;
    }

    /**
     * Single-shot poll: return new messages since last_id (for admin realtime; avoids holding a PHP worker).
     *
     * @since    1.3.0
     * @param    string    $conversation_id    The conversation ID.
     * @param    int       $last_message_id    Last message ID client has.
     * @return   array    { messages: array }
     */
    public function get_new_messages_poll($conversation_id, $last_message_id = 0)
    {
        $messages = $this->get_new_messages($conversation_id, (int) $last_message_id);
        return ['messages' => $messages];
    }

    /**
     * Get new website chat messages since last check.
     *
     * @since    1.3.0
     * @param    string    $virtual_id         The virtual conversation ID.
     * @param    int       $last_message_id    The last message ID seen.
     * @return   array    Array of new messages.
     */
    private function get_website_new_messages($virtual_id, $last_message_id)
    {
        $social_chat = $this->helpmate->get_social_chat();
        $session_id = $social_chat->get_session_id_from_virtual_id($virtual_id);

        if (!$session_id) {
            return [];
        }

        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        $messages_data = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT id, message, role, timestamp, metadata
                FROM {$table}
                WHERE session_id = %s AND id > %d
                ORDER BY id ASC
                LIMIT 50"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $session_id,
                $last_message_id
            ),
            ARRAY_A
        );

        // Convert to social message format
        $messages = [];
        foreach ($messages_data as $msg) {
            $metadata = json_decode($msg['metadata'], true);
            if (!is_array($metadata)) {
                $metadata = [];
            }

            $sent_by = 'customer';
            if ($msg['role'] === 'system') {
                $sent_by = 'system';
            } elseif ($msg['role'] === 'assistant') {
                $sent_by = isset($metadata['sent_by_human']) && $metadata['sent_by_human'] ? 'human' : 'ai';
            }

            $content = $msg['message'];
            if ($msg['role'] === 'assistant') {
                $parsed = json_decode($content, true);
                if (is_array($parsed) && isset($parsed['text'])) {
                    $content = $parsed['text'];
                }
            }

            $message = [
                'id' => $msg['id'],
                'conversation_id' => $virtual_id,
                'external_id' => null,
                'direction' => $msg['role'] === 'user' ? 'inbound' : 'outbound',
                'content' => $content,
                'message_type' => 'text',
                'sent_by' => $sent_by,
                'user_id' => isset($metadata['user_id']) ? (int) $metadata['user_id'] : null,
                'error_message' => null,
                'meta_data' => $metadata,
                'created_at' => gmdate('Y-m-d H:i:s', (int) $msg['timestamp']),
            ];

            // For system messages with user_id (join notifications)
            if ($sent_by === 'system' && !empty($metadata['user_id'])) {
                $user = get_userdata((int) $metadata['user_id']);
                if ($user) {
                    $message['user_name'] = $user->display_name;
                    $message['user_avatar'] = get_avatar_url((int) $metadata['user_id'], ['size' => 32]);
                    $message['first_name'] = $user->first_name ?: $user->display_name;
                }
            }

            // For human (team) messages
            if ($sent_by === 'human' && !empty($message['user_id'])) {
                $user = get_userdata($message['user_id']);
                if ($user) {
                    $message['user_name'] = $user->display_name;
                    $message['user_avatar'] = get_avatar_url($message['user_id'], ['size' => 32]);
                    $message['first_name'] = $user->first_name ?: $user->display_name;
                }
            }

            $messages[] = $message;
        }

        return $messages;
    }

    /**
     * Send SSE message.
     *
     * @since    1.3.0
     * @param    string    $event    The event type.
     * @param    array     $data     The data to send.
     * @return   void
     */
    private function send_sse_message($event, $data)
    {
        echo "event: " . esc_html($event) . "\n";
        echo "data: " . wp_json_encode($data) . "\n\n";
    }

    /**
     * Single-shot poll: return events since last_* for public chat widget (avoids holding a PHP worker).
     *
     * @since    1.3.0
     * @param    string    $session_id         The chat session ID.
     * @param    int       $last_message_id    Last message ID client has.
     * @param    bool|null $last_handoff       Last handoff state (optional).
     * @param    bool|null $last_ai_disabled   Last ai_disabled state (optional).
     * @param    bool|null $last_admin_typing  Last admin_typing state (optional).
     * @param    bool|null $last_review        Last review_requested state (optional).
     * @return   array    Array of { type, data } events.
     */
    public function get_chat_stream_events($session_id, $last_message_id = 0, $last_handoff = null, $last_ai_disabled = null, $last_admin_typing = null, $last_review = null)
    {
        $events = [];
        $virtual_id = 'website_' . md5($session_id);
        $new_messages = $this->get_website_new_messages($virtual_id, (int) $last_message_id);
        foreach ($new_messages as $msg) {
            $role = $msg['direction'] === 'inbound' ? 'user' : ($msg['sent_by'] === 'system' ? 'system' : 'assistant');
            $ts = isset($msg['created_at']) ? strtotime($msg['created_at']) : time();
            $events[] = [
                'type' => 'message',
                'data' => [
                    'id' => (int) $msg['id'],
                    'message' => $msg['content'],
                    'role' => $role,
                    'timestamp' => $ts,
                    'metadata' => array_merge(
                        isset($msg['meta_data']) ? $msg['meta_data'] : [],
                        [
                            'user_avatar' => $msg['user_avatar'] ?? null,
                            'user_name' => $msg['user_name'] ?? null,
                            'first_name' => $msg['first_name'] ?? null,
                        ]
                    ),
                ],
            ];
        }

        $social_chat = $this->helpmate->get_social_chat();
        $is_handoff = $social_chat ? $social_chat->get_website_handoff_status($session_id) : false;
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
        
        $ai_settings = $this->helpmate->get_settings()->get_setting('ai', []);
        $ai_enabled = isset($ai_settings['ai_enabled']) ? (bool) $ai_settings['ai_enabled'] : true;
        $ai_disabled = !$ai_enabled;
        $review_requested = get_transient('helpmate_review_request_' . $session_id) !== false;

        if ($last_handoff !== $is_handoff) {
            $events[] = ['type' => 'handoff', 'data' => ['is_human_handoff' => $is_handoff]];
        }
        if ($last_ai_disabled !== $ai_disabled) {
            $events[] = ['type' => 'ai_disabled', 'data' => ['ai_disabled' => $ai_disabled]];
        }
        if ($last_admin_typing !== $is_admin_typing) {
            $events[] = ['type' => 'admin_typing', 'data' => [
                'is_admin_typing' => $is_admin_typing,
                'user_avatar' => $typing_user_avatar,
                'user_name' => $typing_user_name,
            ]];
        }
        if ($last_review !== $review_requested && $review_requested) {
            $events[] = ['type' => 'review_requested', 'data' => ['review_requested' => true]];
        }

        $events[] = ['type' => 'heartbeat', 'data' => ['ts' => time()]];
        return $events;
    }

    /**
     * Handle SSE connection for public chat widget (messages, handoff, ai_disabled, admin_typing, review_requested).
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @return   void
     */
    public function handle_sse_chat_stream($session_id)
    {
        if (empty($session_id)) {
            status_header(400);
            echo wp_json_encode(['error' => true, 'message' => __('Session ID is required', 'helpmate-ai-chatbot')]);
            exit;
        }

        $session_id = sanitize_text_field($session_id);
        if (ob_get_level()) {
            ob_end_clean();
        }
        // Release session lock immediately so other same-session requests (e.g. send message, history) are not blocked
        if (session_status() === PHP_SESSION_NONE) {
            @session_start(); // phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged -- Avoid blocking other requests
        }
        session_write_close();
        // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- Necessary for SSE long-running connections
        set_time_limit(0);
        ignore_user_abort(true);

        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');

        $virtual_id = 'website_' . md5($session_id);
        $last_message_id = 0;
        $last_handoff = null;
        $last_ai_disabled = null;
        $last_admin_typing = null;
        $last_review = null;
        $timeout = 300;
        $start = time();
        $heartbeat_interval = 18;
        $last_heartbeat = time();
        $social_chat = $this->helpmate->get_social_chat();
        $ai_settings = $this->helpmate->get_settings()->get_setting('ai', []);
        $this->send_sse_message('connected', ['session_id' => $session_id]);

        while ((time() - $start) < $timeout) {
            if (connection_aborted()) {
                break;
            }

            $new_messages = $this->get_website_new_messages($virtual_id, $last_message_id);
            foreach ($new_messages as $msg) {
                $role = $msg['direction'] === 'inbound' ? 'user' : ($msg['sent_by'] === 'system' ? 'system' : 'assistant');
                $content = $msg['content'];
                $ts = isset($msg['created_at']) ? strtotime($msg['created_at']) : time();
                $payload = [
                    'id' => (int) $msg['id'],
                    'message' => $content,
                    'role' => $role,
                    'timestamp' => $ts,
                    'metadata' => isset($msg['meta_data']) ? $msg['meta_data'] : [],
                ];
                $this->send_sse_message('message', $payload);
                $last_message_id = max($last_message_id, (int) $msg['id']);
            }

            $is_handoff = $social_chat ? $social_chat->get_website_handoff_status($session_id) : false;
            $admin_typing_key = 'helpmate_typing_website_' . $session_id . '_admin';
            $is_admin_typing = get_transient($admin_typing_key) !== false;
            $ai_enabled = isset($ai_settings['ai_enabled']) ? (bool) $ai_settings['ai_enabled'] : true;
            $ai_disabled = !$ai_enabled;
            $review_requested = get_transient('helpmate_review_request_' . $session_id) !== false;

            if ($last_handoff !== $is_handoff) {
                $this->send_sse_message('handoff', ['is_human_handoff' => $is_handoff]);
                $last_handoff = $is_handoff;
            }
            if ($last_ai_disabled !== $ai_disabled) {
                $this->send_sse_message('ai_disabled', ['ai_disabled' => $ai_disabled]);
                $last_ai_disabled = $ai_disabled;
            }
            if ($last_admin_typing !== $is_admin_typing) {
                $this->send_sse_message('admin_typing', ['is_admin_typing' => $is_admin_typing]);
                $last_admin_typing = $is_admin_typing;
            }
            if ($last_review !== $review_requested && $review_requested) {
                $this->send_sse_message('review_requested', ['review_requested' => true]);
                $last_review = $review_requested;
            }

            if (time() - $last_heartbeat >= $heartbeat_interval) {
                $this->send_sse_message('heartbeat', ['ts' => time()]);
                $last_heartbeat = time();
            }

            if (ob_get_level()) {
                ob_flush();
            }
            flush();
            // Release session again in case any code in the loop started it (e.g. plugin hooks)
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_write_close();
            }
            usleep(1000000);
        }
        exit;
    }
}

