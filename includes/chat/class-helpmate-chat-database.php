<?php

/**
 * The file that defines the chat database functionality of the plugin
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

/**
 * The chat database functionality of the plugin.
 *
 * This class handles all database-related operations for chat functionality:
 * - Storing and retrieving chat messages
 * - Managing chat sessions
 * - Handling chat history and metadata
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Chat_Database
{
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
        global $wpdb;

        $messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT id, message, role, timestamp, metadata
                FROM {$wpdb->prefix}helpmate_chat_history
                WHERE session_id = %s
                ORDER BY timestamp DESC
                LIMIT %d",
                $session_id,
                $limit
            ),
            ARRAY_A
        );

        foreach ($messages as &$message) {
            $message['metadata'] = json_decode($message['metadata'], true);
        }

        return array_reverse($messages); // Return in chronological order
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
        try {
            global $wpdb;

            // Calculate offset
            $offset = ($page - 1) * $per_page;

            // Get total count
            $total_count = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT session_id) FROM {$wpdb->prefix}helpmate_chat_history"
            );

            // Get paginated sessions
            $sessions = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT
                        session_id,
                        COUNT(*) as message_count,
                        SUM(JSON_EXTRACT(metadata, '$.tokens')) as total_tokens,
                        MIN(timestamp) as start_time,
                        MAX(timestamp) as last_activity
                    FROM {$wpdb->prefix}helpmate_chat_history
                    GROUP BY session_id
                    ORDER BY last_activity DESC
                    LIMIT %d OFFSET %d",
                    $per_page,
                    $offset
                ),
                ARRAY_A
            );

            foreach ($sessions as &$session) {
                $session['start_time'] = gmdate('Y-m-d H:i:s', $session['start_time']);
                $session['last_activity'] = gmdate('Y-m-d H:i:s', $session['last_activity']);
                $session['message_count'] = (int) $session['message_count'];
                $session['total_tokens'] = (int) $session['total_tokens'];
            }

            return new WP_REST_Response([
                'error' => false,
                'sessions' => $sessions,
                'pagination' => [
                    'total' => (int) $total_count,
                    'per_page' => (int) $per_page,
                    'current_page' => (int) $page,
                    'total_pages' => ceil($total_count / $per_page)
                ]
            ]);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a chat message in the database.
     *
     * @since 1.0.0
     * @param string $session_id The chat session ID.
     * @param string $message The message content.
     * @param string $role The role (user/assistant).
     * @param array $metadata Optional metadata about the message.
     * @return bool|int The message ID on success, false on failure.
     */
    public function store_chat_message($session_id, $message, $role, $metadata = [])
    {
        global $wpdb;

        $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prefix . 'helpmate_chat_history',
            [
                'session_id' => $session_id,
                'message' => $message,
                'role' => $role,
                'timestamp' => time(),
                'metadata' => json_encode($metadata)
            ],
            ['%s', '%s', '%s', '%d', '%s']
        );

        if ($result !== false) {
            return $wpdb->insert_id;
        }
        return false;
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
        global $wpdb;

        return $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prefix . 'helpmate_chat_history',
            ['session_id' => $session_id],
            ['%s']
        ) !== false;
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
        global $wpdb;

        $id = isset($params['id']) ? (int) $params['id'] : 0;
        $key = isset($params['key']) ? $params['key'] : '';
        $value = isset($params['value']) ? $params['value'] : null;

        if (!$id || !$key || $value === null) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('ID, key, and value are required', 'helpmate')
            ], 400);
        }

        try {
            // First get the existing metadata
            $metadata = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT metadata FROM {$wpdb->prefix}helpmate_chat_history WHERE id = %d",
                    $id
                )
            );

            if (!$metadata) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => __('Chat message not found', 'helpmate')
                ], 404);
            }

            // Parse existing metadata or create new array
            $metadata = $metadata ? json_decode($metadata, true) : [];
            if (!is_array($metadata)) {
                $metadata = [];
            }

            // Update the specific key
            $metadata[$key] = $value;

            // Update the record with new metadata
            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_chat_history',
                ['metadata' => json_encode($metadata)],
                ['id' => $id],
                ['%s'],
                ['%d']
            );

            return new WP_REST_Response([
                'error' => false,
                'success' => $result !== false
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Failed to update chat metadata', 'helpmate')
            ], 500);
        }
    }
}