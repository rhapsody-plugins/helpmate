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

            // Auto-assign contact by email if available (only for initial user message)
            $contact_id = null;
            $source = isset($ticket_data['source']) ? sanitize_text_field($ticket_data['source']) : 'chatbot';

            // If contact_id is already provided, use it and skip auto-creation
            if (!empty($ticket_data['contact_id'])) {
                $contact_id = (int) $ticket_data['contact_id'];
            } elseif (!empty($ticket_data['email']) && empty($ticket_data['skip_auto_create_contact']) && isset($GLOBALS['helpmate'])) {
                // Only auto-create if no contact_id is provided and skip_auto_create_contact is not set
                $helpmate = $GLOBALS['helpmate'];
                $crm = $helpmate->get_crm();
                if ($crm) {
                    $name = $ticket_data['name'] ?? '';
                    $name_parts = explode(' ', $name, 2);
                    $contact_id = $crm->find_or_create_contact_by_email($ticket_data['email'], [
                        'first_name' => $name_parts[0] ?? '',
                        'last_name' => $name_parts[1] ?? '',
                        'name' => $name,
                    ]);
                }
            }

            $insert_data = [
                'ticket_id' => $ticket_id,
                'subject' => $ticket_data['subject'],
                'message' => $ticket_data['message'],
                'role' => 'user',
                'status' => $ticket_data['status'],
                'user_id' => $user_id,
                'timestamp' => time(),
                'metadata' => json_encode($metadata),
                'source' => $source,
            ];

            if ($contact_id) {
                $insert_data['contact_id'] = (int) $contact_id;
            }

            $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $table,
                $insert_data,
                $contact_id ? ['%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%d'] : ['%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s']
            );

            if ($result === false) {
                throw new Exception('Failed to insert ticket');
            }

            // Increment unread count for new ticket (initial user message)
            if (isset($GLOBALS['helpmate'])) {
                $helpmate = $GLOBALS['helpmate'];
                $social_chat = $helpmate->get_social_chat();
                if ($social_chat) {
                    $social_chat->increment_ticket_unread($ticket_id);
                }
                $notifications = $helpmate->get_notifications();
                if ($notifications) {
                    $subject = is_string($ticket_data['subject']) ? $ticket_data['subject'] : '';
                    $notifications->create(
                        0,
                        'ticket',
                        __('New ticket', 'helpmate-ai-chatbot'),
                        $subject,
                        admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox&ticket_id=' . rawurlencode($ticket_id)),
                        [],
                        'ticket',
                        $wpdb->insert_id
                    );
                }
            }

            return $ticket_id;

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

            // Increment unread count only for user replies (not admin replies)
            if ($role === 'user' && isset($GLOBALS['helpmate'])) {
                $helpmate = $GLOBALS['helpmate'];
                $social_chat = $helpmate->get_social_chat();
                if ($social_chat) {
                    $social_chat->increment_ticket_unread($ticket_id);
                }
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
    public function get_all_tickets($page, $per_page, $contact_id = null)
    {
        global $wpdb;

        try {
            // Validate input
            $page = max(1, (int) $page);
            $per_page = max(1, (int) $per_page);
            $offset = ($page - 1) * $per_page;

            // Build queries with explicit conditional branches
            $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');

            // Get total count for pagination
            if ($contact_id !== null) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $total = (int) $wpdb->get_var(
                    $wpdb->prepare(
                        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses esc_sql()
                        "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user' AND contact_id = %d"
                        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        ,
                        (int) $contact_id
                    )
                );
            } else {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $total = (int) $wpdb->get_var(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses esc_sql()
                    "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user'"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                );
            }

            // Build main query with explicit conditional branches
            if ($contact_id !== null) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $tickets = $wpdb->get_results(
                    $wpdb->prepare(
                        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses esc_sql()
                        "SELECT MIN(id) as id, ticket_id, MIN(timestamp) as timestamp, subject, status,
                        MAX(contact_id) as contact_id, MAX(source) as source
                        FROM {$tickets_table}
                        WHERE role = 'user' AND contact_id = %d
                        GROUP BY ticket_id
                        ORDER BY timestamp DESC
                        LIMIT %d OFFSET %d"
                        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        ,
                        (int) $contact_id,
                        $per_page,
                        $offset
                    ),
                    ARRAY_A
                );
            } else {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $tickets = $wpdb->get_results(
                    $wpdb->prepare(
                        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses esc_sql()
                        "SELECT MIN(id) as id, ticket_id, MIN(timestamp) as timestamp, subject, status,
                        MAX(contact_id) as contact_id, MAX(source) as source
                        FROM {$tickets_table}
                        WHERE role = 'user'
                        GROUP BY ticket_id
                        ORDER BY timestamp DESC
                        LIMIT %d OFFSET %d"
                        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        ,
                        $per_page,
                        $offset
                    ),
                    ARRAY_A
                );
            }

            if ($tickets === null) {
                throw new Exception('Failed to execute query: ' . $wpdb->last_error);
            }

            $total_pages = ceil($total / $per_page);
            $result = array_map(function ($ticket) {
                return [
                    'id' => $ticket['id'],
                    'ticket_id' => $ticket['ticket_id'],
                    'datetime' => gmdate('Y-m-d H:i:s', $ticket['timestamp']),
                    'subject' => $ticket['subject'],
                    'status' => $ticket['status'],
                    'contact_id' => !empty($ticket['contact_id']) ? (int) $ticket['contact_id'] : null,
                    'source' => $ticket['source'] ?? 'chatbot',
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

            // Get old status before update
            $ticket_data = $this->get_ticket_data($ticket_id);
            $old_status = !empty($ticket_data) ? $ticket_data[0]['status'] : null;

            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_tickets', // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                ['status' => $new_status],
                ['ticket_id' => $ticket_id],
                ['%s'],
                ['%s']
            );

            // Send email notification if status changed
            if ($result !== false && $old_status && $old_status !== $new_status) {
                $this->send_ticket_status_changed_email($ticket_id, $old_status, $new_status);
            }

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
                'status' => 'open', // Status is only stored in the initial ticket message
                'source' => isset($params['source']) ? $params['source'] : 'chatbot'
            ];

            // Pass contact_id if provided
            if (isset($params['contact_id'])) {
                $ticket_data['contact_id'] = (int) $params['contact_id'];
            }

            // Pass skip_auto_create_contact flag if explicitly requested
            if (isset($params['skip_auto_create_contact']) && $params['skip_auto_create_contact']) {
                $ticket_data['skip_auto_create_contact'] = true;
            }

            // Store ticket in database
            $ticket_id = $this->store_ticket($ticket_data);

            if (!$ticket_id) {
                throw new Exception(__('Failed to create ticket', 'helpmate-ai-chatbot'));
            }

            // Send notification email to admin/managers
            $ticket_data['ticket_id'] = $ticket_id;
            $this->send_admin_notification($ticket_data);

            // Send confirmation email to ticket creator
            $this->send_ticket_creator_confirmation($ticket_data);

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
     * Build email HTML structure.
     *
     * @since    1.3.0
     * @param    string   $name          Recipient name.
     * @param    string   $title         Email title.
     * @param    string   $body_text     Main body text.
     * @param    string   $box_content   Content for the main box.
     * @param    string   $button_html   Optional button HTML.
     * @param    string   $title_color   Optional title color (default: #455CFE).
     * @param    string   $border_color  Optional border color (default: #455CFE).
     * @return   string   Complete email HTML.
     */
    private function build_email_html($name, $title, $body_text, $box_content, $button_html = '', $title_color = '#455CFE', $border_color = '#455CFE')
    {
        $shop_name = get_bloginfo('name');

        /* translators: %s: Recipient name */
        $greeting = sprintf(__('Hello %s,', 'helpmate-ai-chatbot'), esc_html($name));

        return '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">' . $greeting . '</div>
                <div style="color: ' . esc_attr($title_color) . '; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">' . esc_html($title) . '</div>
                <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                    ' . esc_html($body_text) . '
                </div>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; box-shadow: 0 2px 6px rgba(0,0,0,0.08); max-width: 400px; border: 2px solid ' . esc_attr($border_color) . ';">
                    ' . $box_content . '
                    ' . $button_html . '
                </div>
                <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                    ' . __('Best regards,', 'helpmate-ai-chatbot') . '<br>
                    ' . esc_html($shop_name) . '
                </div>
            </div>
        </div>';
    }

    /**
     * Send notification email to admin and manager team members about new ticket.
     *
     * @since    1.0.0
     * @param    array    $ticket_data    The ticket data.
     */
    private function send_admin_notification($ticket_data)
    {
        // Get all team members with admin or manager roles
        $recipients = [];
        if (isset($GLOBALS['helpmate'])) {
            $helpmate = $GLOBALS['helpmate'];
            $team = $helpmate->get_team();
            if ($team) {
                $team_members = $team->get_team_members_by_roles(['admin', 'manager']);
                foreach ($team_members as $member) {
                    $recipients[] = [
                        'email' => $member['email'],
                        'name' => $member['first_name'],
                    ];
                }
            }
        }

        // Fallback to WordPress admin if no team members found
        if (empty($recipients)) {
            $admin_email = get_option('admin_email');
            if ($admin_email) {
                $admin_user = get_user_by('email', $admin_email);
                $recipients[] = [
                    'email' => $admin_email,
                    'name' => $admin_user ? $admin_user->display_name : __('Admin', 'helpmate-ai-chatbot'),
                ];
            }
        }

        // If still no recipients, return
        if (empty($recipients)) {
            return;
        }

        $site_name = get_bloginfo('name');
        $ticket_id_for_url = isset($ticket_data['ticket_id']) ? $ticket_data['ticket_id'] : '';
        $ticket_url = admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox' . ( $ticket_id_for_url ? '&ticket_id=' . rawurlencode($ticket_id_for_url) : '' ));

        /* translators: 1: Site name, 2: Ticket subject */
        $subject = sprintf(__('[%1$s] New Support Ticket: %2$s', 'helpmate-ai-chatbot'), $site_name, $ticket_data['subject']);

        // Build body text
        $body_text = __('A new support ticket has been created and requires your attention.', 'helpmate-ai-chatbot');

        // Build ticket details box
        $message_preview = wp_trim_words(wp_strip_all_tags($ticket_data['message']), 30);
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Ticket Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Subject:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($ticket_data['subject']) . '<br>
                            <strong>' . __('From:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($ticket_data['name'] ?: $ticket_data['email']) . ' (' . esc_html($ticket_data['email']) . ')<br>
                            <strong>' . __('Priority:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($ticket_data['priority'])) . '<br>
                            <strong>' . __('Status:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($ticket_data['status'])) . '<br>
                            <strong>' . __('Message:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($message_preview) . '
                        </div>
                    </div>';

        // Build button
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($ticket_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Ticket', 'helpmate-ai-chatbot') . '</a>
                </div>';

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        // Send personalized email to each recipient
        foreach ($recipients as $recipient) {
            $body = $this->build_email_html(
                $recipient['name'],
                /* translators: %s: Ticket subject */
                sprintf(__('New Support Ticket: %s', 'helpmate-ai-chatbot'), esc_html($ticket_data['subject'])),
                $body_text,
                $box_content,
                $button_html
            );

            wp_mail($recipient['email'], $subject, $body, $headers);
        }
    }

    /**
     * Send confirmation email to ticket creator.
     *
     * @since    1.3.0
     * @param    array    $ticket_data    The ticket data.
     */
    private function send_ticket_creator_confirmation($ticket_data)
    {
        // Check if we have an email to send to
        if (empty($ticket_data['email'])) {
            return;
        }

        $recipient_email = $ticket_data['email'];
        $recipient_name = !empty($ticket_data['name']) ? $ticket_data['name'] : $recipient_email;
        $site_name = get_bloginfo('name');

        /* translators: 1: Site name, 2: Ticket subject */
        $subject = sprintf(__('[%1$s] Ticket Received: %2$s', 'helpmate-ai-chatbot'), $site_name, $ticket_data['subject']);

        // Build body text
        $body_text = __('Thank you for contacting us. We have received your support ticket and will get back to you as soon as possible.', 'helpmate-ai-chatbot');

        // Build ticket details box
        $message_preview = wp_trim_words(wp_strip_all_tags($ticket_data['message']), 30);
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Your Ticket Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Subject:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($ticket_data['subject']) . '<br>
                            <strong>' . __('Priority:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($ticket_data['priority'])) . '<br>
                            <strong>' . __('Message:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($message_preview) . '
                        </div>
                    </div>';

        // Build email HTML
        $body = $this->build_email_html(
            $recipient_name,
            /* translators: %s: Ticket subject */
            sprintf(__('Ticket Received: %s', 'helpmate-ai-chatbot'), esc_html($ticket_data['subject'])),
            $body_text,
            $box_content
        );

        $headers = ['Content-Type: text/html; charset=UTF-8'];
        wp_mail($recipient_email, $subject, $body, $headers);
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
        $ticket_url = admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox&ticket_id=' . rawurlencode($ticket_id));

        if ($role === 'admin') {
            // Notify user
            if (!isset($first_message['metadata']['email'])) {
                return;
            }
            /* translators: 1: Site name, 2: Ticket subject */
            $subject = sprintf(__('[%1$s] Reply to your ticket: %2$s', 'helpmate-ai-chatbot'), $site_name, $first_message['subject']);
            $recipient_email = $first_message['metadata']['email'];
            $recipient_name = $first_message['metadata']['name'] ?: $first_message['metadata']['email'];
            $body_text = __('A new reply has been added to your support ticket.', 'helpmate-ai-chatbot');
        } else {
            // Notify admin
            $admin_user = get_user_by('email', $admin_email);
            $recipient_name = $admin_user ? $admin_user->display_name : __('Admin', 'helpmate-ai-chatbot');
            /* translators: 1: Site name, 2: Ticket subject */
            $subject = sprintf(__('[%1$s] New reply to ticket: %2$s', 'helpmate-ai-chatbot'), $site_name, $first_message['subject']);
            $recipient_email = $admin_email;
            $body_text = __('A new reply has been added to a support ticket.', 'helpmate-ai-chatbot');
        }

        // Build reply details box
        $message_preview = wp_trim_words(wp_strip_all_tags($message), 30);
        $sender_name = $role === 'admin' ? __('Admin', 'helpmate-ai-chatbot') : ($first_message['metadata']['name'] ?: $first_message['metadata']['email']);
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Reply Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Ticket:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($first_message['subject']) . '<br>
                            <strong>' . __('From:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($sender_name) . '<br>
                            <strong>' . __('Status:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($first_message['status'])) . '<br>
                            <strong>' . __('Reply:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($message_preview) . '
                        </div>
                    </div>';

        // Build button
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($ticket_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Ticket', 'helpmate-ai-chatbot') . '</a>
                </div>';

        // Build email HTML
        /* translators: %s: Ticket subject */
        $body = $this->build_email_html(
            $recipient_name,
            /* translators: %s: Ticket subject */
            $role === 'admin' ? sprintf(__('Reply to your ticket: %s', 'helpmate-ai-chatbot'), esc_html($first_message['subject'])) : sprintf(__('New reply to ticket: %s', 'helpmate-ai-chatbot'), esc_html($first_message['subject'])),
            $body_text,
            $box_content,
            $button_html
        );

        $headers = ['Content-Type: text/html; charset=UTF-8'];
        wp_mail($recipient_email, $subject, $body, $headers);
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
                    'user_id' => $msg['user_id'],
                    'contact_id' => !empty($msg['contact_id']) ? (int) $msg['contact_id'] : null,
                    'source' => $msg['source'] ?? 'chatbot',
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
                    'priority' => $first_message['metadata']['priority'] ?? 'normal',
                    'contact_id' => !empty($first_message['contact_id']) ? (int) $first_message['contact_id'] : null,
                    'source' => $first_message['source'] ?? 'chatbot',
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

    /**
     * Assign a contact to a ticket.
     *
     * @since    1.0.0
     * @param    string    $ticket_id    The ticket ID.
     * @param    int       $contact_id   The contact ID.
     * @return   bool                    True on success, false on failure.
     */
    public function assign_contact($ticket_id, $contact_id)
    {
        try {
            global $wpdb;

            // Update contact_id only on the initial user message (role='user')
            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_tickets',
                ['contact_id' => (int) $contact_id],
                [
                    'ticket_id' => $ticket_id,
                    'role' => 'user'
                ],
                ['%d'],
                ['%s', '%s']
            );

            return $result !== false;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Auto-assign contact to a ticket by email.
     *
     * @since    1.0.0
     * @param    string    $ticket_id    The ticket ID.
     * @return   bool                    True on success, false on failure.
     */
    public function auto_assign_contact($ticket_id)
    {
        try {
            global $wpdb;

            // Get the initial user message
            $ticket = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}helpmate_tickets
                    WHERE ticket_id = %s AND role = 'user'
                    ORDER BY timestamp ASC
                    LIMIT 1",
                    $ticket_id
                ),
                ARRAY_A
            );

            if (!$ticket || empty($ticket['metadata'])) {
                return false;
            }

            $metadata = json_decode($ticket['metadata'], true);
            if (empty($metadata['email']) || !isset($GLOBALS['helpmate'])) {
                return false;
            }

            $helpmate = $GLOBALS['helpmate'];
            $crm = $helpmate->get_crm();
            if (!$crm) {
                return false;
            }

            $name = $metadata['name'] ?? '';
            $name_parts = explode(' ', $name, 2);
            $contact_id = $crm->find_or_create_contact_by_email($metadata['email'], [
                'first_name' => $name_parts[0] ?? '',
                'last_name' => $name_parts[1] ?? '',
                'name' => $name,
            ]);

            if (!$contact_id) {
                return false;
            }

            return $this->assign_contact($ticket_id, $contact_id);
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Create a task from a ticket.
     *
     * @since    1.0.0
     * @param    string    $ticket_id    The ticket ID.
     * @param    array     $task_data    Additional task data.
     * @return   int|false              The task ID on success, false on failure.
     */
    public function create_task_from_ticket($ticket_id, $task_data = [])
    {
        if (!isset($GLOBALS['helpmate'])) {
            return false;
        }

        $ticket_data = $this->get_ticket_data($ticket_id);
        if (empty($ticket_data)) {
            return false;
        }

        $first_message = $ticket_data[0];
        $helpmate = $GLOBALS['helpmate'];
        $tasks = $helpmate->get_tasks();

        if (!$tasks) {
            return false;
        }

        // Get contact_id from first message
        $contact_id = !empty($first_message['contact_id']) ? (int) $first_message['contact_id'] : null;

        // Prepare task data from ticket
        $default_task_data = [
            // translators: %s: Ticket subject
            'title' => sprintf(__('Ticket: %s', 'helpmate-ai-chatbot'), $first_message['subject']),
            'description' => $first_message['message'],
        ];

        if ($contact_id) {
            $default_task_data['contact_ids'] = [$contact_id];
        }

        $task_data = array_merge($default_task_data, $task_data);

        return $tasks->create_task($task_data);
    }

    /**
     * Send email notification when ticket status changes.
     *
     * @since    1.3.0
     * @param    string   $ticket_id    The ticket ID.
     * @param    string   $old_status   The old status.
     * @param    string   $new_status   The new status.
     * @return   bool     True on success, false on failure.
     */
    private function send_ticket_status_changed_email($ticket_id, $old_status, $new_status)
    {
        $ticket_data = $this->get_ticket_data($ticket_id);
        if (empty($ticket_data)) {
            return false;
        }

        $first_message = $ticket_data[0];
        $site_name = get_bloginfo('name');
        $ticket_url = admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox&ticket_id=' . rawurlencode($ticket_id));

        // Notify admin
        $admin_email = get_option('admin_email');
        $admin_user = get_user_by('email', $admin_email);
        $admin_name = $admin_user ? $admin_user->display_name : __('Admin', 'helpmate-ai-chatbot');

        $body_text = __('The status of a support ticket has been updated.', 'helpmate-ai-chatbot');

        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Status Change', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Ticket:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($first_message['subject']) . '<br>
                            <strong>' . __('Previous Status:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($old_status)) . '<br>
                            <strong>' . __('New Status:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($new_status)) . '
                        </div>
                    </div>';

        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($ticket_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Ticket', 'helpmate-ai-chatbot') . '</a>
                </div>';

        /* translators: %s: Ticket subject */
        $subject = sprintf(__('Ticket Status Updated: %s', 'helpmate-ai-chatbot'), esc_html($first_message['subject']));
        $body = $this->build_email_html(
            $admin_name,
            $subject,
            $body_text,
            $box_content,
            $button_html
        );

        $headers = ['Content-Type: text/html; charset=UTF-8'];
        return wp_mail($admin_email, $subject, $body, $headers);
    }

    /**
     * Send email notification when ticket priority changes.
     *
     * @since    1.3.0
     * @param    string   $ticket_id    The ticket ID.
     * @param    string   $old_priority The old priority.
     * @param    string   $new_priority The new priority.
     * @return   bool     True on success, false on failure.
     */
    private function send_ticket_priority_changed_email($ticket_id, $old_priority, $new_priority)
    {
        $ticket_data = $this->get_ticket_data($ticket_id);
        if (empty($ticket_data)) {
            return false;
        }

        $first_message = $ticket_data[0];
        $site_name = get_bloginfo('name');
        $ticket_url = admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox&ticket_id=' . rawurlencode($ticket_id));

        // Notify admin
        $admin_email = get_option('admin_email');
        $admin_user = get_user_by('email', $admin_email);
        $admin_name = $admin_user ? $admin_user->display_name : __('Admin', 'helpmate-ai-chatbot');

        $body_text = __('The priority of a support ticket has been updated.', 'helpmate-ai-chatbot');

        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Priority Change', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Ticket:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($first_message['subject']) . '<br>
                            <strong>' . __('Previous Priority:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($old_priority)) . '<br>
                            <strong>' . __('New Priority:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($new_priority)) . '
                        </div>
                    </div>';

        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($ticket_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Ticket', 'helpmate-ai-chatbot') . '</a>
                </div>';

        /* translators: %s: Ticket subject */
        $subject = sprintf(__('Ticket Priority Updated: %s', 'helpmate-ai-chatbot'), esc_html($first_message['subject']));
        $body = $this->build_email_html(
            $admin_name,
            $subject,
            $body_text,
            $box_content,
            $button_html
        );

        $headers = ['Content-Type: text/html; charset=UTF-8'];
        return wp_mail($admin_email, $subject, $body, $headers);
    }

    /**
     * Send email notification when ticket is assigned to team member.
     *
     * @since    1.3.0
     * @param    string   $ticket_id      The ticket ID.
     * @param    int      $assigned_to_id  User ID of assignee.
     * @return   bool     True on success, false on failure.
     */
    private function send_ticket_assignment_email($ticket_id, $assigned_to_id)
    {
        $assigned_to_user = get_userdata($assigned_to_id);
        if (!$assigned_to_user || !$assigned_to_user->user_email) {
            return false;
        }

        $ticket_data = $this->get_ticket_data($ticket_id);
        if (empty($ticket_data)) {
            return false;
        }

        $first_message = $ticket_data[0];
        $first_name = get_user_meta($assigned_to_id, 'first_name', true) ?: $assigned_to_user->display_name;
        $ticket_url = admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox&ticket_id=' . rawurlencode($ticket_id));

        $body_text = __('A support ticket has been assigned to you.', 'helpmate-ai-chatbot');

        $priority = $first_message['metadata']['priority'] ?? 'normal';
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Ticket Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Subject:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($first_message['subject']) . '<br>
                            <strong>' . __('Status:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($first_message['status'])) . '<br>
                            <strong>' . __('Priority:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($priority)) . '
                        </div>
                    </div>';

        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($ticket_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Ticket', 'helpmate-ai-chatbot') . '</a>
                </div>';

        /* translators: %s: Ticket subject */
        $subject = sprintf(__('Ticket Assigned: %s', 'helpmate-ai-chatbot'), esc_html($first_message['subject']));
        $body = $this->build_email_html(
            $first_name,
            $subject,
            $body_text,
            $box_content,
            $button_html
        );

        $headers = ['Content-Type: text/html; charset=UTF-8'];
        return wp_mail($assigned_to_user->user_email, $subject, $body, $headers);
    }

}