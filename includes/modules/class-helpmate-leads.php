<?php

/**
 * The leads database handler for the Helpmate plugin.
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

class Helpmate_Leads
{

    /**
     * Get all leads with pagination.
     *
     * @since 1.0.0
     * @param int $page The page number (1-based).
     * @param int $per_page Number of items per page.
     * @return WP_REST_Response The response containing leads and pagination info.
     */
    public function get_all_leads($page = 1, $per_page = 10)
    {
        global $wpdb;

        try {
            // Calculate offset
            $offset = ($page - 1) * $per_page;

            // Get total count
            $total_count = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_leads"
            );

            // Get paginated leads
            $leads = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT id, name, timestamp, metadata, contact_id, source
                    FROM {$wpdb->prefix}helpmate_leads
                    ORDER BY timestamp DESC
                    LIMIT %d OFFSET %d",
                    $per_page,
                    $offset
                ),
                ARRAY_A
            );

            foreach ($leads as &$lead) {
                $lead['metadata'] = json_decode($lead['metadata'], true);
                $lead['timestamp'] = gmdate('Y-m-d H:i:s', $lead['timestamp']);
            }

            return new WP_REST_Response([
                'error' => false,
                'leads' => $leads,
                'pagination' => [
                    'total' => (int) $total_count,
                    'per_page' => (int) $per_page,
                    'current_page' => (int) $page,
                    'total_pages' => ceil($total_count / $per_page)
                ]
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a new lead in the database.
     *
     * @since 1.0.0
     * @param array $params The request object containing lead data.
     * @return WP_REST_Response The response containing the created lead data or error message.
     */
    public function create_lead($params)
    {
        global $wpdb;

        try {
            // Validate required fields
            if (empty($params['name'])) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => __('Name is required', 'helpmate-ai-chatbot')
                ], 400);
            }

            // Prepare the lead data
            $name = $params['name'];
            $metadata = isset($params['metadata']) ? $params['metadata'] : [];
            $source = isset($params['source']) ? sanitize_text_field($params['source']) : 'chatbot';

            // Insert into leads table (no automatic contact creation)
            $insert_data = [
                'name' => $name,
                'timestamp' => time(),
                'metadata' => json_encode($metadata),
                'source' => $source,
            ];

            $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_leads',
                $insert_data,
                ['%s', '%d', '%s', '%s']
            );

            if ($result === false) {
                throw new Exception(__('Failed to create lead', 'helpmate-ai-chatbot'));
            }

            $lead_id = $wpdb->insert_id;

            // Send notification email to admin and managers
            $this->send_new_lead_notification_email($lead_id, $name, $source, $metadata);

            if (isset($GLOBALS['helpmate'])) {
                $notifications = $GLOBALS['helpmate']->get_notifications();
                if ($notifications) {
                    $notifications->create(
                        0,
                        'lead',
                        __('New lead', 'helpmate-ai-chatbot'),
                        $name,
                        admin_url('admin.php?page=helpmate&tab=crm&subtab=leads'),
                        [],
                        'lead',
                        $lead_id
                    );
                }
            }

            return new WP_REST_Response([
                'error' => false,
                'lead' => true
            ], 201);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Failed to create lead', 'helpmate-ai-chatbot')
            ], 500);
        }
    }

    /**
     * Get a specific lead by ID.
     *
     * @since 1.0.0
     * @param int $lead_id The ID of the lead to retrieve.
     * @return array|null The lead data or null if not found.
     */
    public function get_lead_by_id($lead_id)
    {
        global $wpdb;

        $lead = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT id, name, timestamp, metadata, contact_id, source
                FROM {$wpdb->prefix}helpmate_leads
                WHERE id = %d",
                $lead_id
            ),
            ARRAY_A
        );

        if ($lead) {
            $lead['metadata'] = json_decode($lead['metadata'], true);
            $lead['timestamp'] = gmdate('Y-m-d H:i:s', $lead['timestamp']);
            $lead['contact_id'] = !empty($lead['contact_id']) ? (int) $lead['contact_id'] : null;
        }

        return $lead;
    }

    /**
     * Update a lead's information.
     *
     * @since 1.0.0
     * @param int $lead_id The ID of the lead to update.
     * @param array $data The data to update.
     * @return bool True on success, false on failure.
     */
    public function update_lead($lead_id, $data)
    {
        global $wpdb;

        try {
            $update_data = [];
            $format = [];

            if (isset($data['name'])) {
                $update_data['name'] = sanitize_text_field($data['name']);
                $format[] = '%s';
            }

            if (isset($data['metadata'])) {
                $update_data['metadata'] = json_encode($data['metadata']);
                $format[] = '%s';
            }

            if (isset($data['contact_id'])) {
                $update_data['contact_id'] = !empty($data['contact_id']) ? (int) $data['contact_id'] : null;
                $format[] = '%d';
            }

            if (isset($data['source'])) {
                $update_data['source'] = sanitize_text_field($data['source']);
                $format[] = '%s';
            }

            if (empty($update_data)) {
                return false;
            }

            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_leads',
                $update_data,
                ['id' => $lead_id],
                $format,
                ['%d']
            );

            return $result !== false;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Delete a lead from the database.
     *
     * @since 1.0.0
     * @param int $lead_id The ID of the lead to delete.
     * @return bool True on success, false on failure.
     */
    public function delete_lead($lead_id)
    {
        try {
            global $wpdb;

            $result = $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_leads',
                ['id' => $lead_id],
                ['%d']
            );

            return $result !== false;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Assign a contact to a lead.
     *
     * @since 1.0.0
     * @param int $lead_id The lead ID.
     * @param int $contact_id The contact ID.
     * @return bool True on success, false on failure.
     */
    public function assign_contact($lead_id, $contact_id)
    {
        global $wpdb;

        try {
            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_leads',
                ['contact_id' => (int) $contact_id],
                ['id' => (int) $lead_id],
                ['%d'],
                ['%d']
            );

            return $result !== false;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Auto-assign contact by email (find or create).
     *
     * @since 1.0.0
     * @param string $email The email address.
     * @param string $name The name.
     * @return int|null The contact ID or null on failure.
     */
    private function auto_assign_contact_by_email($email, $name = '')
    {
        if (empty($email) || !isset($GLOBALS['helpmate'])) {
            return null;
        }

        $helpmate = $GLOBALS['helpmate'];
        $crm = $helpmate->get_crm();

        if (!$crm) {
            return null;
        }

        // Split name into first and last
        $name_parts = explode(' ', $name, 2);
        $first_name = $name_parts[0] ?? '';
        $last_name = $name_parts[1] ?? '';

        $contact_id = $crm->find_or_create_contact_by_email($email, [
            'first_name' => $first_name,
            'last_name' => $last_name,
            'name' => $name,
        ]);

        return $contact_id ? (int) $contact_id : null;
    }

    /**
     * Auto-assign contact to a lead by email.
     *
     * @since 1.0.0
     * @param int $lead_id The lead ID.
     * @return bool True on success, false on failure.
     */
    public function auto_assign_contact($lead_id)
    {
        $lead = $this->get_lead_by_id($lead_id);
        if (!$lead || empty($lead['metadata']['email'])) {
            return false;
        }

        $contact_id = $this->auto_assign_contact_by_email($lead['metadata']['email'], $lead['name']);
        if (!$contact_id) {
            return false;
        }

        return $this->assign_contact($lead_id, $contact_id);
    }

    /**
     * Create a contact from a lead.
     *
     * @since 1.0.0
     * @param int $lead_id The lead ID.
     * @param array $contact_data Additional contact data to override lead data.
     * @return int|false The contact ID on success, false on failure.
     */
    public function create_contact_from_lead($lead_id, $contact_data = [])
    {
        if (!isset($GLOBALS['helpmate'])) {
            return false;
        }

        $lead = $this->get_lead_by_id($lead_id);
        if (!$lead) {
            return false;
        }

        // Check if lead already has a contact
        if (!empty($lead['contact_id'])) {
            return (int) $lead['contact_id'];
        }

        $helpmate = $GLOBALS['helpmate'];
        $crm = $helpmate->get_crm();

        if (!$crm) {
            return false;
        }

        // Extract email from metadata (optional - can be added later)
        $email = $contact_data['email'] ?? $lead['metadata']['email'] ?? '';

        // Split name into first and last
        $name = $contact_data['name'] ?? $lead['name'] ?? '';
        $name_parts = explode(' ', $name, 2);
        $first_name = $contact_data['first_name'] ?? $name_parts[0] ?? '';
        $last_name = $contact_data['last_name'] ?? $name_parts[1] ?? '';

        // Prepare contact data
        $contact_insert_data = [
            'first_name' => sanitize_text_field($first_name),
            'last_name' => sanitize_text_field($last_name),
            'status' => $contact_data['status'] ?? 'Lead',
        ];

        // Only add email if provided
        if (!empty($email)) {
            $contact_insert_data['email'] = sanitize_email($email);
        }

        // Add phone if available in lead metadata
        if (!empty($lead['metadata']['phone'])) {
            $contact_insert_data['phone'] = sanitize_text_field($lead['metadata']['phone']);
        }

        // Merge with any additional contact data provided (but don't override email, first_name, last_name)
        foreach ($contact_data as $key => $value) {
            if (!in_array($key, ['email', 'first_name', 'last_name', 'status', 'phone'])) {
                $contact_insert_data[$key] = $value;
            }
        }

        // Check if contact already exists with this email (only if email is provided)
        if (!empty($email)) {
            $existing_contact = $crm->get_contact_by_email($email);
            if ($existing_contact) {
                // Contact already exists, just assign it to the lead
                $contact_id = (int) $existing_contact['id'];
                $this->assign_contact($lead_id, $contact_id);
                return $contact_id;
            }
        }

        // Check contact limit for non-Pro users before creating
        $is_pro = $helpmate->is_helpmate_pro_active();
        if (!$is_pro) {
            global $wpdb;
            $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
            $contact_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$contacts_table}"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Direct query necessary; caching not appropriate for frequently changing data; table name is safe, uses wpdb->prefix
            if ($contact_count >= 50) {
                return false;
            }
        }

        // Create new contact
        $contact_id = $crm->create_contact($contact_insert_data);

        // Handle WP_Error (duplicate email case)
        if (is_wp_error($contact_id)) {
            // If duplicate, try to get the existing contact
            $existing_contact = $crm->get_contact_by_email($email);
            if ($existing_contact) {
                $contact_id = (int) $existing_contact['id'];
            } else {
                return false;
            }
        }

        if ($contact_id && is_numeric($contact_id)) {
            // Assign the newly created contact to the lead
            $this->assign_contact($lead_id, (int) $contact_id);
            return (int) $contact_id;
        }

        return false;
    }

    /**
     * Create a task from a lead.
     *
     * @since 1.0.0
     * @param int $lead_id The lead ID.
     * @param array $task_data Additional task data.
     * @return int|false The task ID on success, false on failure.
     */
    public function create_task_from_lead($lead_id, $task_data = [])
    {
        if (!isset($GLOBALS['helpmate'])) {
            return false;
        }

        $lead = $this->get_lead_by_id($lead_id);
        if (!$lead) {
            return false;
        }

        $helpmate = $GLOBALS['helpmate'];
        $tasks = $helpmate->get_tasks();

        if (!$tasks) {
            return false;
        }

        // Prepare task data from lead
        $default_task_data = [
            // translators: %s: Lead name
            'title' => sprintf(__('Follow up with %s', 'helpmate-ai-chatbot'), $lead['name']),
            'description' => !empty($lead['metadata']['message']) ? $lead['metadata']['message'] : '',
        ];

        // Add contact if assigned
        if (!empty($lead['contact_id'])) {
            $default_task_data['contact_ids'] = [(int) $lead['contact_id']];
        }

        $task_data = array_merge($default_task_data, $task_data);

        return $tasks->create_task($task_data);
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

        /* translators: %s: Recipient's name */
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
     * Send notification email to admin and managers about new lead.
     *
     * @since    1.3.0
     * @param    int      $lead_id    Lead ID.
     * @param    string   $name       Lead name.
     * @param    string   $source     Lead source.
     * @param    array    $metadata   Lead metadata.
     * @return   bool     True on success, false on failure.
     */
    private function send_new_lead_notification_email($lead_id, $name, $source, $metadata)
    {
        // Get all team members with admin or manager roles from Helpmate
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
            return false;
        }

        $shop_name = get_bloginfo('name');
        $lead_url = admin_url('admin.php?page=helpmate&tab=crm&subtab=leads');

        // Build body text
        $body_text = __('A new lead has been created in the CRM system.', 'helpmate-ai-chatbot');

        // Build lead details
        $email_html = !empty($metadata['email']) ? '<strong>' . __('Email:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($metadata['email']) . '<br>' : '';
        $phone_html = !empty($metadata['phone']) ? '<strong>' . __('Phone:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($metadata['phone']) . '<br>' : '';
        $message_html = !empty($metadata['message']) ? '<strong>' . __('Message:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(wp_trim_words(wp_strip_all_tags($metadata['message']), 30)) . '<br>' : '';

        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Lead Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Name:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($name) . '<br>
                            <strong>' . __('Source:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(ucfirst($source)) . '<br>
                            ' . $email_html . '
                            ' . $phone_html . '
                            ' . $message_html . '
                        </div>
                    </div>';

        // Build button
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($lead_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Leads', 'helpmate-ai-chatbot') . '</a>
                </div>';

        /* translators: %s: Lead name */
        $subject = sprintf(__('New Lead: %s', 'helpmate-ai-chatbot'), esc_html($name));
        $headers = ['Content-Type: text/html; charset=UTF-8'];

        $result = true;
        foreach ($recipients as $recipient) {
            $body = $this->build_email_html(
                $recipient['name'],
                $subject,
                $body_text,
                $box_content,
                $button_html
            );

            $result = wp_mail($recipient['email'], $subject, $body, $headers) && $result;
        }

        return $result;
    }
}