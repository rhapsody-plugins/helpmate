<?php

/**
 * The ticket system class.
 *
 * This is used to handle ticket creation and management.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Ticket
{

    /**
     * The settings instance.
     *
     * @since 1.0.0
     * @access private
     * @var Helpmate_Settings
     */
    private $settings;

    /**
     * Whether the ticket system is enabled.
     *
     * @since    1.0.0
     * @access   private
     * @var      bool    $is_enabled    Whether the ticket system is enabled.
     */
    private $is_enabled = false;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     * @param    Helpmate_Settings    $settings    The settings instance.
     */
    public function __construct($settings)
    {
        $this->settings = $settings;
        $this->is_enabled = $this->is_enabled();
    }

    public function is_enabled()
    {
        $settings = $this->settings->get_setting('modules');
        if ($settings && isset($settings[HELPMATE_MODULE_TICKET_SYSTEM])) {
            return $settings[HELPMATE_MODULE_TICKET_SYSTEM];
        }
        return false;
    }

    /**
     * Show the ticket options.
     *
     * @since 1.0.0
     * @return string The ticket options.
     */
    public function show_ticket_options(): string
    {
        return json_encode([
            'type' => 'ticket',
            'text' => 'Please fill the form to create a new ticket.',
            'data' => [
                'submitted' => false,
            ]
        ]);
    }

    /**
     * Store a new ticket in the database.
     *
     * @since 1.0.0
     * @param array $ticket_data The ticket data including subject, message, email, etc.
     * @return int|false The ticket ID on success, false on failure.
     */
    public function store_ticket($ticket_data)
    {
        try {
            global $wpdb;
            $table = $wpdb->prefix . 'helpmate_tickets';

            // Generate a unique ticket ID
            $ticket_id = uniqid('ticket_', true);

            // Prepare metadata
            $metadata = [
                'email' => $ticket_data['email'],
                'name' => $ticket_data['name'] ?? '',
                'priority' => $ticket_data['priority'] ?? 'normal'
            ];

            $user_id = 0; // Default for guest users
            if (is_user_logged_in()) {
                $user_id = get_current_user_id();
            }

            $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $table,
                [
                    'ticket_id' => $ticket_id,
                    'subject' => $ticket_data['subject'],
                    'message' => $ticket_data['message'],
                    'role' => 'user',
                    'status' => $ticket_data['status'],
                    'user_id' => $user_id,
                    'timestamp' => time(),
                    'metadata' => json_encode($metadata)
                ],
                ['%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s']
            );

            if ($result === false) {
                throw new Exception('Failed to insert ticket');
            }

            return $wpdb->insert_id;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Get ticket data for a specific ticket ID.
     *
     * @since 1.0.0
     * @param string $ticket_id The ticket ID.
     * @return array|null The ticket data or null if not found.
     */
    public function get_ticket_data($ticket_id)
    {
        global $wpdb;

        $messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}helpmate_tickets
                WHERE ticket_id = %s
                ORDER BY timestamp ASC",
                $ticket_id
            ),
            ARRAY_A
        );

        foreach ($messages as &$message) {
            $message['metadata'] = json_decode($message['metadata'], true);
        }

        return $messages;
    }

    /**
     * Add a reply to an existing ticket.
     *
     * @since 1.0.0
     * @param string $ticket_id The ticket ID.
     * @param string $message The reply message.
     * @param string $role The role of the sender (user/admin).
     * @param array $metadata Optional metadata about the reply.
     * @return bool|int The message ID on success, false on failure.
     */
    public function add_ticket_reply($ticket_id, $message, $role, $metadata = [])
    {
        try {
            global $wpdb;

            // Get the original ticket to copy subject
            $ticket = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT subject, user_id
                    FROM {$wpdb->prefix}helpmate_tickets
                    WHERE ticket_id = %s
                    LIMIT 1",
                    $ticket_id
                ),
                ARRAY_A
            );

            if (!$ticket) {
                throw new Exception('Ticket not found');
            }

            $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_tickets',
                [
                    'ticket_id' => $ticket_id,
                    'subject' => $ticket['subject'],
                    'message' => $message,
                    'role' => $role,
                    'user_id' => $ticket['user_id'],
                    'timestamp' => time(),
                    'metadata' => json_encode($metadata)
                ],
                ['%s', '%s', '%s', '%s', '%d', '%d', '%s']
            );

            if ($result === false) {
                throw new Exception('Failed to insert ticket reply');
            }

            return $wpdb->insert_id;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Get all tickets (only the initial ticket message for each ticket_id).
     *
     * @since 1.0.0
     * @param int $page The page number.
     * @param int $per_page The number of tickets per page.
     * @return WP_REST_Response List of tickets with id, ticket_id, timestamp, and subject.
     */
    public function get_all_tickets($page, $per_page)
    {
        global $wpdb;

        try {
            // Validate input
            $page = max(1, (int) $page);
            $per_page = max(1, (int) $per_page);
            $offset = ($page - 1) * $per_page;

            $tickets = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT MIN(id) as id, ticket_id, MIN(timestamp) as timestamp, subject, status
                    FROM {$wpdb->prefix}helpmate_tickets
                    WHERE role = 'user'
                    GROUP BY ticket_id
                    ORDER BY timestamp DESC
                    LIMIT %d OFFSET %d",
                    $per_page,
                    $offset
                ),
                ARRAY_A
            );

            if ($tickets === null) {
                throw new Exception('Failed to execute query: ' . $wpdb->last_error);
            }

            $total = count($tickets);
            $total_pages = ceil($total / $per_page);
            $result = array_map(function ($ticket) {
                return [
                    'id' => $ticket['id'],
                    'ticket_id' => $ticket['ticket_id'],
                    'datetime' => gmdate('Y-m-d H:i:s', $ticket['timestamp']),
                    'subject' => $ticket['subject'],
                    'status' => $ticket['status'],
                ];
            }, $tickets);
            try {
                return new WP_REST_Response([
                    'error' => false,
                    'tickets' => $result,
                    'pagination' => [
                        'total' => $total,
                        'per_page' => $per_page,
                        'current_page' => $page,
                        'total_pages' => $total_pages
                    ]
                ], 200);
            } catch (Exception $e) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $e->getMessage()
                ], 500);
            }

        } catch (Exception $e) {
            throw $e;
        }
    }

    /**
     * Get the total number of tickets.
     *
     * @since 1.0.0
     * @return int The total number of tickets.
     */
    public function get_total_tickets()
    {
        global $wpdb;

        return (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_tickets WHERE role = 'user'"
        );
    }

    /**
     * Update the status of a ticket.
     *
     * @since 1.0.0
     * @param string $ticket_id The ticket ID.
     * @param string $new_status The new status to set.
     * @return bool True on success, false on failure.
     */
    public function update_ticket_status($ticket_id, $new_status)
    {
        try {
            global $wpdb;

            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_tickets', // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                ['status' => $new_status],
                ['ticket_id' => $ticket_id],
                ['%s'],
                ['%s']
            );

            return $result !== false;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Create a new ticket.
     *
     * @since    1.0.0
     * @param    array    $params    The request object.
     * @return   WP_REST_Response
     */
    public function create_ticket($params)
    {
        try {
            // Validate required fields
            $required_fields = ['subject', 'message', 'email'];
            foreach ($required_fields as $field) {
                if (empty($params[$field])) {
                    return new WP_REST_Response([
                        'error' => true,
                        /* translators: %s: The name of the required field that is missing */
                        'message' => sprintf(__('Missing required field: %s', 'helpmate-ai-chatbot'), $field)
                    ], 400);
                }
            }

            // Sanitize input
            $ticket_data = [
                'subject' => $params['subject'],
                'message' => $params['message'],
                'email' => $params['email'],
                'name' => isset($params['name']) ? $params['name'] : '',
                'priority' => isset($params['priority']) ? $params['priority'] : 'normal',
                'status' => 'open' // Status is only stored in the initial ticket message
            ];

            // Store ticket in database
            $ticket_id = $this->store_ticket($ticket_data);

            if (!$ticket_id) {
                throw new Exception(__('Failed to create ticket', 'helpmate-ai-chatbot'));
            }

            // Send notification email to admin
            $this->send_admin_notification($ticket_data);

            return new WP_REST_Response([
                'error' => false,
                'message' => __('Ticket created successfully', 'helpmate-ai-chatbot'),
                'ticket_id' => $ticket_id
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send notification email to admin about new ticket.
     *
     * @since    1.0.0
     * @param    array    $ticket_data    The ticket data.
     */
    private function send_admin_notification($ticket_data)
    {
        $admin_email = get_option('admin_email');
        $site_name = get_bloginfo('name');

        /* translators: 1: Site name, 2: Ticket subject */
        $subject = sprintf(__('[%1$s] New Support Ticket: %2$s', 'helpmate-ai-chatbot'), $site_name, $ticket_data['subject']);

        $message = sprintf(
            /* translators: 1: Ticket subject, 2: Sender name or email, 3: Sender email, 4: Priority, 5: Status, 6: Message content */
            __("A new support ticket has been created:\n\nSubject: %1\$s\nFrom: %2\$s (%3\$s)\nPriority: %4\$s\nStatus: %5\$s\n\nMessage:\n%6\$s", 'helpmate-ai-chatbot'),
            $ticket_data['subject'],
            $ticket_data['name'] ?: $ticket_data['email'],
            $ticket_data['email'],
            $ticket_data['priority'],
            $ticket_data['status'],
            $ticket_data['message']
        );

        wp_mail($admin_email, $subject, $message);
    }

    /**
     * Reply to an existing ticket.
     *
     * @since    1.0.0
     * @param    array    $params    The request object.
     * @return   WP_REST_Response
     */
    public function reply_to_ticket($params)
    {
        try {
            // Validate required fields
            $required_fields = ['ticket_id', 'message'];
            foreach ($required_fields as $field) {
                if (empty($params[$field])) {
                    return new WP_REST_Response([
                        'error' => true,
                        /* translators: %s: The name of the required field that is missing */
                        'message' => sprintf(__('Missing required field: %s', 'helpmate-ai-chatbot'), $field)
                    ], 400);
                }
            }

            // Sanitize input
            $ticket_id = $params['ticket_id'];
            $message = $params['message'];
            $role = isset($params['is_admin']) && $params['is_admin'] ? 'admin' : 'user';

            // Add the reply
            $reply_id = $this->add_ticket_reply($ticket_id, $message, $role);

            if (!$reply_id) {
                throw new Exception(__('Failed to add reply', 'helpmate-ai-chatbot'));
            }

            // Update ticket status to pending if reply is from user
            if ($role === 'user') {
                $this->update_ticket_status($ticket_id, 'pending');
            } else {
                $this->update_ticket_status($ticket_id, 'resolved');
            }

            // Send notification email
            $this->send_reply_notification($ticket_id, $message, $role);

            return new WP_REST_Response([
                'error' => false,
                'message' => __('Reply added successfully', 'helpmate-ai-chatbot')
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send notification email about ticket reply.
     *
     * @since    1.0.0
     * @param    string    $ticket_id    The ticket ID.
     * @param    string    $message      The reply message.
     * @param    string    $role         The role of the sender (user/admin).
     */
    private function send_reply_notification($ticket_id, $message, $role)
    {
        // Get ticket details
        $ticket_data = $this->get_ticket_data($ticket_id);
        if (empty($ticket_data)) {
            return;
        }

        $first_message = $ticket_data[0];
        $site_name = get_bloginfo('name');
        $admin_email = get_option('admin_email');

        if ($role === 'admin') {
            // Notify user
            if (isset($first_message['metadata']['email'])) {
                /* translators: 1: Site name, 2: Ticket subject */
                $subject = sprintf(__('[%1$s] Reply to your ticket: %2$s', 'helpmate-ai-chatbot'), $site_name, $first_message['subject']);
                $recipient = $first_message['metadata']['email'];
            }
        } else {
            // Notify admin
            /* translators: 1: Site name, 2: Ticket subject */
            $subject = sprintf(__('[%1$s] New reply to ticket: %2$s', 'helpmate-ai-chatbot'), $site_name, $first_message['subject']);
            $recipient = $admin_email;
        }

        $message_content = sprintf(
            /* translators: 1: Ticket ID, 2: Ticket subject, 3: Sender name or email, 4: Ticket status, 5: Reply message */
            __("A new reply has been added to ticket #%1\$s:\n\nSubject: %2\$s\nFrom: %3\$s\nStatus: %4\$s\n\nMessage:\n%5\$s", 'helpmate-ai-chatbot'),
            $ticket_id,
            $first_message['subject'],
            $role === 'admin' ? 'Admin' : ($first_message['metadata']['name'] ?: $first_message['metadata']['email']),
            $first_message['status'],
            $message
        );

        wp_mail($recipient, $subject, $message_content);
    }

    /**
     * Get all messages for a single ticket.
     *
     * @since 1.0.0
     * @param string $ticket_id The ticket ID.
     * @return WP_REST_Response
     */
    public function get_ticket_messages($request)
    {
        try {
            $params = $request->get_params();
            $ticket_id = sanitize_text_field($params['ticket_id']);
            $messages = $this->get_ticket_data($ticket_id);

            if (empty($messages)) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => __('Ticket not found', 'helpmate-ai-chatbot')
                ], 404);
            }

            // Get the first message to extract ticket details
            $first_message = $messages[0];

            // Get user details if available
            $user_details = null;
            if ($first_message['user_id']) {
                $user = get_userdata($first_message['user_id']);
                if ($user) {
                    $user_details = [
                        'id' => $user->ID,
                        'name' => $user->display_name,
                        'email' => $user->user_email
                    ];
                }
            }

            $result = array_map(function ($msg) {
                return [
                    'id' => $msg['id'],
                    'datetime' => gmdate('Y-m-d H:i:s', $msg['timestamp']),
                    'role' => $msg['role'],
                    'message' => $msg['message'],
                    'metadata' => $msg['metadata'],
                    'status' => $msg['status'],
                    'user_id' => $msg['user_id']
                ];
            }, $messages);

            return new WP_REST_Response([
                'error' => false,
                'ticket' => [
                    'id' => $ticket_id,
                    'subject' => $first_message['subject'],
                    'status' => $first_message['status'],
                    'created_at' => gmdate('Y-m-d H:i:s', $first_message['timestamp']),
                    'user' => $user_details,
                    'priority' => $first_message['metadata']['priority'] ?? 'normal'
                ],
                'messages' => $result
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

}