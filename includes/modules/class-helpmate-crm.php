<?php

/**
 * The CRM module for the Helpmate plugin.
 *
 * Handles contact management, custom fields, notes, and orders.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

class Helpmate_CRM
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
     * The settings instance.
     *
     * @since    1.3.0
     * @access   private
     * @var      Helpmate_Settings    $settings    The settings instance.
     */
    private $settings;

    /**
     * Default contact statuses.
     *
     * @since    1.3.0
     * @access   private
     * @var      array    $default_statuses    Default contact statuses.
     */
    private $default_statuses = ['Lead', 'Customer', 'Subscribed', 'Unsubscribed', 'Bounced'];

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.3.0
     * @param    Helpmate    $helpmate    The helpmate instance.
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
        $this->settings = $helpmate->get_settings();
        $this->init_hooks();
    }

    /**
     * Initialize hooks for segments, campaigns, and cron jobs.
     *
     * @since    1.3.0
     */
    private function init_hooks()
    {
        // Note: Segment, recurring campaigns, and email sequences cron hooks are now in pro plugin
        // Register action hook for scheduled campaigns
        add_action('helpmate_send_scheduled_campaign', [$this, 'handle_scheduled_campaign_send'], 10, 1);
    }

    /**
     * Check if CRM module is enabled.
     *
     * @since    1.3.0
     * @return   bool    Whether CRM is enabled.
     */
    public function is_enabled(): bool
    {
        $modules = $this->settings->get_setting('modules');
        return isset($modules[HELPMATE_MODULE_CRM]) && $modules[HELPMATE_MODULE_CRM] === true;
    }

    /**
     * Get contacts with filters, search, and pagination.
     *
     * @since    1.3.0
     * @param    array    $filters    Filter options (status, search, date_from, date_to, etc.).
     * @param    int      $page       Page number.
     * @param    int      $per_page   Items per page.
     * @return   array    The contacts with pagination.
     */
    public function get_contacts(array $filters = [], int $page = 1, int $per_page = 20): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');
        $offset = ($page - 1) * $per_page;

        $where = ['1=1'];
        $params = [];

        // Status filter
        if (!empty($filters['status'])) {
            $where[] = 'c.status = %s';
            $params[] = $filters['status'];
        }

        // Date range filter
        if (!empty($filters['date_from'])) {
            $where[] = 'c.created_at >= %s';
            $params[] = $filters['date_from'];
        }
        if (!empty($filters['date_to'])) {
            $where[] = 'c.created_at <= %s';
            $params[] = $filters['date_to'];
        }

        // Search filter (searches name, email, phone, address, and custom fields)
        if (!empty($filters['search'])) {
            $search_term = '%' . $wpdb->esc_like($filters['search']) . '%';
            $where[] = '(c.first_name LIKE %s OR c.last_name LIKE %s OR c.email LIKE %s OR c.phone LIKE %s OR c.city LIKE %s OR c.state LIKE %s OR c.country LIKE %s)';
            $params[] = $search_term;
            $params[] = $search_term;
            $params[] = $search_term;
            $params[] = $search_term;
            $params[] = $search_term;
            $params[] = $search_term;
            $params[] = $search_term;

            // Also search in custom field values
            $custom_field_search = $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "OR EXISTS (
                    SELECT 1 FROM {$field_values_table} fv
                    INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                    WHERE fv.contact_id = c.id AND fv.field_value LIKE %s
                )"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $search_term
            );
            $where[count($where) - 1] = substr($where[count($where) - 1], 0, -1) . $custom_field_search . ')';
        }

        // Address filters
        if (!empty($filters['city'])) {
            $where[] = 'c.city = %s';
            $params[] = $filters['city'];
        }
        if (!empty($filters['state'])) {
            $where[] = 'c.state = %s';
            $params[] = $filters['state'];
        }
        if (!empty($filters['country'])) {
            $where[] = 'c.country = %s';
            $params[] = $filters['country'];
        }

        $where_clause = implode(' AND ', $where);

        // Get total count
        $count_query = sprintf("SELECT COUNT(*) FROM %s c WHERE %s", $table, $where_clause);
        if (!empty($params)) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            $count_query = $wpdb->prepare($count_query, ...$params);
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built with safe placeholders and prepared with wpdb->prepare(); direct query necessary for contact listing
        $total = (int) $wpdb->get_var($count_query);

        // Get contacts
        $query = sprintf("SELECT c.* FROM %s c WHERE %s ORDER BY c.created_at DESC LIMIT %%d OFFSET %%d", $table, $where_clause);
        $params[] = $per_page;
        $params[] = $offset;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built with safe placeholders and prepared with wpdb->prepare(); direct query necessary; caching not appropriate
        $contacts = $wpdb->get_results(
            $wpdb->prepare($query, ...$params), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            ARRAY_A
        );

        // Get custom field values for each contact and cast wp_user_id
        foreach ($contacts as &$contact) {
            // Ensure wp_user_id is properly cast (null or integer)
            if (isset($contact['wp_user_id'])) {
                $contact['wp_user_id'] = !empty($contact['wp_user_id']) ? (int) $contact['wp_user_id'] : null;
            }
            $contact['custom_fields'] = $this->get_contact_custom_field_values($contact['id']);
        }

        return [
            'contacts' => $contacts,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Check if there are any contacts in the CRM.
     *
     * @since    1.0.0
     * @return   bool    True if at least one contact exists, false otherwise.
     */
    public function has_contacts(): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Direct query necessary; table name is safe, uses wpdb->prefix
        $count = $wpdb->get_var("SELECT COUNT(*) FROM {$table}");
        return (int) $count > 0;
    }

    /**
     * Get a single contact by ID.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @return   array|null    The contact data or null.
     */
    public function get_contact(int $contact_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for contact retrieval; caching not appropriate for frequently changing data
        $contact = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $contact_id
            ),
            ARRAY_A
        );

        if (!$contact) {
            return null;
        }

        // Ensure wp_user_id is properly cast (null or integer)
        if (isset($contact['wp_user_id'])) {
            $contact['wp_user_id'] = !empty($contact['wp_user_id']) ? (int) $contact['wp_user_id'] : null;
        }

        // Get custom field values
        $contact['custom_fields'] = $this->get_contact_custom_field_values($contact_id);

        return $contact;
    }

    /**
     * Create a new contact.
     *
     * @since    1.3.0
     * @param    array    $data    The contact data.
     * @return   int|false|WP_Error    The contact ID or false on failure.
     */
    public function create_contact(array $data)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // Check contact limit for non-Pro users
        $is_pro = $this->helpmate->is_helpmate_pro_active();
        if (!$is_pro) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Direct query necessary; table name is safe, uses wpdb->prefix
            $contact_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table}");
            if ($contact_count >= 50) {
                return new WP_Error('contact_limit_exceeded', 'Non-Pro users are limited to 50 contacts. Upgrade to Pro for unlimited contacts.');
            }
        }

        // Check for duplicate email
        if (!empty($data['email'])) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for duplicate check; caching not appropriate
            $existing = $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT id FROM {$table} WHERE email = %s"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $data['email']
                )
            );
            if ($existing) {
                return new WP_Error('duplicate_email', 'A contact with this email already exists.');
            }
        }

        $insert_data = [
            'prefix' => isset($data['prefix']) ? sanitize_text_field($data['prefix']) : null,
            'first_name' => isset($data['first_name']) ? sanitize_text_field($data['first_name']) : null,
            'last_name' => isset($data['last_name']) ? sanitize_text_field($data['last_name']) : null,
            'email' => !empty($data['email']) ? sanitize_email($data['email']) : null,
            'phone' => isset($data['phone']) ? sanitize_text_field($data['phone']) : null,
            'date_of_birth' => isset($data['date_of_birth']) ? sanitize_text_field($data['date_of_birth']) : null,
            'address_line_1' => isset($data['address_line_1']) ? sanitize_text_field($data['address_line_1']) : null,
            'address_line_2' => isset($data['address_line_2']) ? sanitize_text_field($data['address_line_2']) : null,
            'city' => isset($data['city']) ? sanitize_text_field($data['city']) : null,
            'state' => isset($data['state']) ? sanitize_text_field($data['state']) : null,
            'zip_code' => isset($data['zip_code']) ? sanitize_text_field($data['zip_code']) : null,
            'country' => isset($data['country']) ? sanitize_text_field($data['country']) : null,
            'wp_user_id' => isset($data['wp_user_id']) ? (int) $data['wp_user_id'] : null,
            'status' => isset($data['status']) ? sanitize_text_field($data['status']) : 'subscribed',
            'avatar_url' => isset($data['avatar_url']) ? esc_url_raw($data['avatar_url']) : null,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql')
        ];

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $result = $wpdb->insert($table, $insert_data);

        if ($result) {
            $contact_id = $wpdb->insert_id;

            // Save custom field values if provided
            if (isset($data['custom_fields']) && is_array($data['custom_fields'])) {
                $this->save_contact_custom_field_values($contact_id, $data['custom_fields']);
            }

            // Schedule segment count refresh
            $this->schedule_segment_count_refresh();

            return $contact_id;
        }

        return false;
    }

    /**
     * Update a contact.
     *
     * @since    1.3.0
     * @param    int       $contact_id    The contact ID.
     * @param    array     $data          The contact data.
     * @return   bool    Whether the update was successful.
     */
    public function update_contact(int $contact_id, array $data): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // Check for duplicate email (excluding current contact)
        if (!empty($data['email'])) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for duplicate check; caching not appropriate
            $existing = $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT id FROM {$table} WHERE email = %s AND id != %d"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $data['email'],
                    $contact_id
                )
            );
            if ($existing) {
                return false;
            }
        }

        $update_data = [
            'updated_at' => current_time('mysql')
        ];

        $allowed_fields = [
            'prefix',
            'first_name',
            'last_name',
            'email',
            'phone',
            'date_of_birth',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'zip_code',
            'country',
            'wp_user_id',
            'status',
            'avatar_url'
        ];

        foreach ($allowed_fields as $field) {
            // Use array_key_exists for wp_user_id to allow null values
            if ($field === 'wp_user_id' && array_key_exists($field, $data)) {
                $update_data[$field] = !empty($data[$field]) ? (int) $data[$field] : null;
            } elseif (isset($data[$field])) {
                if ($field === 'email') {
                    $update_data[$field] = sanitize_email($data[$field]);
                } elseif ($field === 'avatar_url') {
                    $update_data[$field] = esc_url_raw($data[$field]);
                } else {
                    $update_data[$field] = sanitize_text_field($data[$field]);
                }
            }
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $table,
            $update_data,
            ['id' => $contact_id]
        );

        // Update custom field values if provided
        if (isset($data['custom_fields']) && is_array($data['custom_fields'])) {
            $this->save_contact_custom_field_values($contact_id, $data['custom_fields']);
        }

        // Schedule segment count refresh
        if ($result !== false) {
            $this->schedule_segment_count_refresh();
        }

        return $result !== false;
    }

    /**
     * Delete a contact.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @return   bool    Whether the deletion was successful.
     */
    public function delete_contact(int $contact_id): bool
    {
        global $wpdb;
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');
        $notes_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_notes');
        $leads_table = esc_sql($wpdb->prefix . 'helpmate_leads');
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');

        // Delete custom field values
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $wpdb->delete($field_values_table, ['contact_id' => $contact_id], ['%d']);

        // Delete notes
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $wpdb->delete($notes_table, ['contact_id' => $contact_id], ['%d']);

        // Clear contact_id from leads
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $wpdb->update(
            $leads_table,
            ['contact_id' => null],
            ['contact_id' => $contact_id],
            ['%s'],
            ['%d']
        );

        // Clear contact_id from tickets
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $wpdb->update(
            $tickets_table,
            ['contact_id' => null],
            ['contact_id' => $contact_id],
            ['%s'],
            ['%d']
        );

        // Delete task-contact associations
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $wpdb->delete($task_contacts_table, ['contact_id' => $contact_id], ['%d']);

        // Delete contact (manual orders are preserved with contact_id for historical records)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $result = $wpdb->delete($contacts_table, ['id' => $contact_id], ['%d']);

        // Schedule segment count refresh
        if ($result !== false) {
            $this->schedule_segment_count_refresh();
        }

        return $result !== false;
    }

    /**
     * Get available contact statuses (defaults + custom).
     *
     * @since    1.3.0
     * @return   array    The available statuses.
     */
    public function get_contact_statuses(): array
    {
        $custom_statuses = $this->settings->get_setting('helpmate_crm_custom_statuses') ?? [];
        return array_merge($this->default_statuses, $custom_statuses);
    }

    /**
     * Add a custom contact status.
     *
     * @since    1.3.0
     * @param    string    $status    The status to add.
     * @return   bool    Whether the addition was successful.
     */
    public function add_contact_status(string $status): bool
    {
        $status = sanitize_text_field($status);
        if (empty($status) || in_array($status, $this->default_statuses, true)) {
            return false;
        }

        $custom_statuses = $this->settings->get_setting('helpmate_crm_custom_statuses') ?? [];
        if (!in_array($status, $custom_statuses, true)) {
            $custom_statuses[] = $status;
            $this->settings->set_setting('helpmate_crm_custom_statuses', $custom_statuses);
        }

        return true;
    }

    /**
     * Remove a custom contact status.
     *
     * @since    1.3.0
     * @param    string    $status    The status to remove.
     * @return   bool    Whether the removal was successful.
     */
    public function remove_contact_status(string $status): bool
    {
        if (in_array($status, $this->default_statuses, true)) {
            return false; // Cannot remove default statuses
        }

        $custom_statuses = $this->settings->get_setting('helpmate_crm_custom_statuses') ?? [];
        $custom_statuses = array_filter($custom_statuses, fn($s) => $s !== $status);
        $this->settings->set_setting('helpmate_crm_custom_statuses', array_values($custom_statuses));

        return true;
    }

    /**
     * Get custom fields.
     *
     * @since    1.3.0
     * @param    string    $entity_type    The entity type (default: 'contact').
     * @return   array    The custom fields.
     */
    public function get_custom_fields(string $entity_type = 'contact'): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for custom fields listing; caching not appropriate for frequently changing data
        $fields = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE entity_type = %s ORDER BY display_order ASC, id ASC"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $entity_type
            ),
            ARRAY_A
        );

        // Decode JSON options
        foreach ($fields as &$field) {
            if (!empty($field['field_options'])) {
                $field['field_options'] = json_decode($field['field_options'], true);
            }
        }

        return $fields;
    }

    /**
     * Get a single custom field.
     *
     * @since    1.3.0
     * @param    int    $field_id    The field ID.
     * @return   array|null    The field data or null.
     */
    public function get_custom_field(int $field_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for custom field retrieval; caching not appropriate for frequently changing data
        $field = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $field_id
            ),
            ARRAY_A
        );

        if ($field && !empty($field['field_options'])) {
            $field['field_options'] = json_decode($field['field_options'], true);
        }

        return $field;
    }

    /**
     * Create a custom field.
     *
     * @since    1.3.0
     * @param    array    $data    The field data.
     * @return   int|false    The field ID or false on failure.
     */
    public function create_custom_field(array $data)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // Generate field_name from field_label if not provided
        if (empty($data['field_name']) && !empty($data['field_label'])) {
            $data['field_name'] = sanitize_title($data['field_label']);
        }

        // Check for duplicate field_name
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for duplicate check; caching not appropriate
        $existing = $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT id FROM {$table} WHERE field_name = %s"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $data['field_name']
            )
        );
        if ($existing) {
            return false;
        }

        $insert_data = [
            'field_name' => sanitize_text_field($data['field_name']),
            'field_label' => sanitize_text_field($data['field_label']),
            'field_type' => sanitize_text_field($data['field_type']),
            'field_options' => isset($data['field_options']) ? json_encode($data['field_options']) : null,
            'is_required' => isset($data['is_required']) ? (int) $data['is_required'] : 0,
            'entity_type' => isset($data['entity_type']) ? sanitize_text_field($data['entity_type']) : 'contact',
            'display_order' => isset($data['display_order']) ? (int) $data['display_order'] : 0,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql')
        ];

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $result = $wpdb->insert($table, $insert_data);

        return $result ? $wpdb->insert_id : false;
    }

    /**
     * Update a custom field.
     *
     * @since    1.3.0
     * @param    int       $field_id    The field ID.
     * @param    array     $data        The field data.
     * @return   bool    Whether the update was successful.
     */
    public function update_custom_field(int $field_id, array $data): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        $update_data = [
            'updated_at' => current_time('mysql')
        ];

        $allowed_fields = ['field_label', 'field_type', 'field_options', 'is_required', 'entity_type', 'display_order'];

        foreach ($allowed_fields as $field) {
            if (isset($data[$field])) {
                if ($field === 'field_options') {
                    $update_data[$field] = json_encode($data[$field]);
                } elseif ($field === 'is_required' || $field === 'display_order') {
                    $update_data[$field] = (int) $data[$field];
                } else {
                    $update_data[$field] = sanitize_text_field($data[$field]);
                }
            }
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $table,
            $update_data,
            ['id' => $field_id]
        );

        return $result !== false;
    }

    /**
     * Delete a custom field.
     *
     * @since    1.3.0
     * @param    int    $field_id    The field ID.
     * @return   bool    Whether the deletion was successful.
     */
    public function delete_custom_field(int $field_id): bool
    {
        global $wpdb;
        $fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');
        $contact_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');
        $task_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');

        // Get the field to check if it's a default task field
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for field retrieval; caching not appropriate for frequently changing data
        $field = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT field_name, entity_type FROM {$fields_table} WHERE id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $field_id
            ),
            ARRAY_A
        );

        if (!$field) {
            return false;
        }

        // Prevent deletion of default task fields
        $default_task_fields = ['priority', 'status', 'task_type'];
        if (
            $field['entity_type'] === 'task' &&
            in_array($field['field_name'], $default_task_fields, true)
        ) {
            return false;
        }

        // Delete all field values based on entity type
        if ($field['entity_type'] === 'task') {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
            $wpdb->delete($task_values_table, ['field_id' => $field_id]);
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
            $wpdb->delete($contact_values_table, ['field_id' => $field_id]);
        }

        // Delete the field
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $result = $wpdb->delete($fields_table, ['id' => $field_id]);

        return $result !== false;
    }

    /**
     * Get custom field values for a contact.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @return   array    The field values keyed by field_id.
     */
    public function get_contact_custom_field_values(int $contact_id): array
    {
        global $wpdb;
        $values_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');
        $fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for field values retrieval; caching not appropriate for frequently changing data
        $values = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "SELECT fv.*, cf.field_name, cf.field_label, cf.field_type
                FROM {$values_table} fv
                INNER JOIN {$fields_table} cf ON fv.field_id = cf.id
                WHERE fv.contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $contact_id
            ),
            ARRAY_A
        );

        $result = [];
        foreach ($values as $value) {
            // Decode JSON values
            $decoded = json_decode($value['field_value'], true);
            $result[$value['field_id']] = [
                'field_id' => (int) $value['field_id'],
                'field_name' => $value['field_name'],
                'field_label' => $value['field_label'],
                'field_type' => $value['field_type'],
                'value' => $decoded !== null ? $decoded : $value['field_value']
            ];
        }

        return $result;
    }

    /**
     * Save custom field values for a contact.
     *
     * @since    1.3.0
     * @param    int       $contact_id    The contact ID.
     * @param    array     $values        The field values (keyed by field_id).
     * @return   bool    Whether the save was successful.
     */
    public function save_contact_custom_field_values(int $contact_id, array $values): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');

        foreach ($values as $field_id => $value) {
            $field_id = (int) $field_id;

            // Encode arrays/objects as JSON
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value);
            } else {
                $value = sanitize_text_field($value);
            }

            // Check if value exists
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for duplicate check; caching not appropriate
            $existing = $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT id FROM {$table} WHERE contact_id = %d AND field_id = %d"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $contact_id,
                    $field_id
                )
            );

            if ($existing) {
                // Update
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
                $wpdb->update(
                    $table,
                    [
                        'field_value' => $value,
                        'updated_at' => current_time('mysql')
                    ],
                    [
                        'contact_id' => $contact_id,
                        'field_id' => $field_id
                    ]
                );
            } else {
                // Insert
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
                $wpdb->insert(
                    $table,
                    [
                        'contact_id' => $contact_id,
                        'field_id' => $field_id,
                        'field_value' => $value,
                        'created_at' => current_time('mysql'),
                        'updated_at' => current_time('mysql')
                    ]
                );
            }
        }

        return true;
    }

    /**
     * Get notes for a contact.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @param    int    $page          Page number.
     * @param    int    $per_page      Items per page.
     * @return   array    The notes with pagination.
     */
    public function get_contact_notes(int $contact_id, int $page = 1, int $per_page = 50): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_notes');
        $offset = ($page - 1) * $per_page;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for notes count; caching not appropriate for frequently changing data
        $total = (int) $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COUNT(*) FROM {$table} WHERE contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $contact_id
            )
        );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for notes listing; caching not appropriate for frequently changing data
        $notes = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT n.*, u.display_name as created_by_name
                FROM {$table} n
                LEFT JOIN {$wpdb->users} u ON n.created_by = u.ID
                WHERE n.contact_id = %d
                ORDER BY n.created_at DESC
                LIMIT %d OFFSET %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $contact_id,
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        return [
            'notes' => $notes,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Create a note for a contact.
     *
     * @since    1.3.0
     * @param    int       $contact_id    The contact ID.
     * @param    string    $content      The note content.
     * @param    int       $user_id       The WordPress user ID.
     * @return   int|false    The note ID or false on failure.
     */
    public function create_note(int $contact_id, string $content, int $user_id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_notes');

        $insert_data = [
            'contact_id' => $contact_id,
            'note_content' => sanitize_textarea_field($content),
            'created_by' => $user_id,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql')
        ];

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $result = $wpdb->insert($table, $insert_data);

        return $result ? $wpdb->insert_id : false;
    }

    /**
     * Update a note.
     *
     * @since    1.3.0
     * @param    int       $note_id    The note ID.
     * @param    string    $content    The note content.
     * @return   bool    Whether the update was successful.
     */
    public function update_note(int $note_id, string $content): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_notes');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $table,
            [
                'note_content' => sanitize_textarea_field($content),
                'updated_at' => current_time('mysql')
            ],
            ['id' => $note_id]
        );

        return $result !== false;
    }

    /**
     * Delete a note.
     *
     * @since    1.3.0
     * @param    int    $note_id    The note ID.
     * @return   bool    Whether the deletion was successful.
     */
    public function delete_note(int $note_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_notes');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $result = $wpdb->delete($table, ['id' => $note_id]);

        return $result !== false;
    }

    /**
     * Get orders for a contact (WooCommerce + EDD + SureCart + manual).
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @return   array    The orders.
     */
    public function get_contact_orders(int $contact_id): array
    {
        $contact = $this->get_contact($contact_id);
        if (!$contact) {
            return [];
        }

        $orders = [];

        $primary = method_exists($this->helpmate, 'get_primary_commerce_provider')
            ? $this->helpmate->get_primary_commerce_provider()
            : '';

        // Provider-specific orders: only list the active primary commerce (avoid Woo rows on SureCart-primary sites).
        $include_woo = ('' === $primary || 'woocommerce' === $primary) && class_exists('WooCommerce');
        $include_edd = ('' === $primary || 'easy_digital_downloads' === $primary) && function_exists('edd_get_orders');
        $include_sc = ('' === $primary || 'surecart' === $primary) && class_exists('\SureCart\Models\Order');

        if ($include_woo) {
            $woo_orders = $this->get_woocommerce_orders_by_contact($contact_id);
            foreach ($woo_orders as $order) {
                $orders[] = array_merge($order, ['order_type' => 'woocommerce']);
            }
        }

        if ($include_edd) {
            $edd_orders = $this->get_edd_orders_by_contact($contact_id);
            foreach ($edd_orders as $order) {
                $orders[] = array_merge($order, ['order_type' => 'easy_digital_downloads']);
            }
        }

        if ($include_sc) {
            $sc_orders = $this->get_surecart_orders_by_contact($contact_id);
            foreach ($sc_orders as $order) {
                $orders[] = array_merge($order, ['order_type' => 'surecart']);
            }
        }

        // Get manual orders
        $manual_orders = $this->get_manual_orders($contact_id);
        foreach ($manual_orders as $order) {
            $orders[] = array_merge($order, ['order_type' => 'manual']);
        }

        // Sort by date (newest first)
        usort($orders, function ($a, $b) {
            $date_a = $a['order_date'] ?? $a['date_created'] ?? '';
            $date_b = $b['order_date'] ?? $b['date_created'] ?? '';
            return strtotime($date_b) - strtotime($date_a);
        });

        return $orders;
    }

    /**
     * Get WooCommerce orders for a contact.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @return   array    The WooCommerce orders.
     */
    public function get_woocommerce_orders_by_contact(int $contact_id): array
    {
        if (!class_exists('WooCommerce')) {
            return [];
        }

        $contact = $this->get_contact($contact_id);
        if (!$contact) {
            return [];
        }

        $orders = [];

        // Primary strategy: Match by WP user ID
        if (!empty($contact['wp_user_id'])) {
            $customer_orders = wc_get_orders([
                'customer_id' => $contact['wp_user_id'],
                'limit' => -1,
                'orderby' => 'date',
                'order' => 'DESC'
            ]);

            foreach ($customer_orders as $order) {
                $orders[] = [
                    'id' => $order->get_id(),
                    'order_number' => $order->get_order_number(),
                    'status' => $order->get_status(),
                    'total' => $order->get_total(),
                    'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
                    'edit_url' => admin_url('post.php?post=' . $order->get_id() . '&action=edit')
                ];
            }
        }

        // Fallback: Match by email (if no WP user ID or no orders found)
        if (empty($orders) && !empty($contact['email'])) {
            $customer_orders = wc_get_orders([
                'billing_email' => $contact['email'],
                'limit' => -1,
                'orderby' => 'date',
                'order' => 'DESC'
            ]);

            foreach ($customer_orders as $order) {
                // Avoid duplicates if already found by user ID
                $exists = false;
                foreach ($orders as $existing) {
                    if ($existing['id'] === $order->get_id()) {
                        $exists = true;
                        break;
                    }
                }

                if (!$exists) {
                    $orders[] = [
                        'id' => $order->get_id(),
                        'order_number' => $order->get_order_number(),
                        'status' => $order->get_status(),
                        'total' => $order->get_total(),
                        'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
                        'edit_url' => admin_url('post.php?post=' . $order->get_id() . '&action=edit')
                    ];
                }
            }
        }

        return $orders;
    }

    /**
     * Build a short plain-text line summary for CRM orders table (EDD).
     *
     * @since    2.0.3
     * @param    int    $order_id    EDD order ID.
     * @param    object $order       Order object from edd_get_orders.
     * @return   string Summary or empty string.
     */
    private function format_edd_order_product_summary(int $order_id, $order): string
    {
        $lines = [];

        $order_items = [];
        if (is_object($order) && method_exists($order, 'get_items')) {
            $order_items = $order->get_items();
        } elseif ($order_id > 0 && function_exists('edd_get_order_items')) {
            $order_items = edd_get_order_items(
                [
                    'order_id' => $order_id,
                    'number' => 200,
                    'orderby' => 'cart_index',
                    'order' => 'ASC',
                    'no_found_rows' => true,
                ]
            );
        }

        if (is_array($order_items)) {
            foreach ($order_items as $item) {
                $type = isset($item->type) ? (string) $item->type : '';
                if (in_array($type, ['fee', 'discount'], true)) {
                    continue;
                }
                $quantity = isset($item->quantity) ? (int) $item->quantity : 0;
                $product_id = isset($item->product_id) ? (int) $item->product_id : 0;
                if ($quantity < 1 && $product_id > 0) {
                    $quantity = 1;
                }
                if ($quantity < 1) {
                    continue;
                }
                $name = isset($item->product_name) ? (string) $item->product_name : '';
                $lines[] = [
                    'name' => $name,
                    'qty' => $quantity,
                ];
            }
        }

        if (empty($lines) && isset($order->cart_details) && is_array($order->cart_details)) {
            foreach ($order->cart_details as $row) {
                $name = isset($row['name']) ? (string) $row['name'] : '';
                $quantity = isset($row['quantity']) ? (int) $row['quantity'] : 1;
                if ($quantity < 1) {
                    $quantity = 1;
                }
                $lines[] = [
                    'name' => $name,
                    'qty' => $quantity,
                ];
            }
        }

        if (empty($lines)) {
            if ($order_id > 0 && function_exists('edd_count_order_items')) {
                $item_count = (int) edd_count_order_items(
                    [
                        'order_id' => $order_id,
                        'type__in' => ['download'],
                    ]
                );
                if ($item_count < 1) {
                    $item_count = (int) edd_count_order_items(
                        [
                            'order_id' => $order_id,
                        ]
                    );
                }
                if ($item_count > 0) {
                    return sprintf(
                        /* translators: %d: number of line items in the order */
                        _n('%d item', '%d items', $item_count, 'helpmate-ai-chatbot'),
                        $item_count
                    );
                }
            }
            return '';
        }

        $max_show = 3;
        $parts = [];
        $slice = array_slice($lines, 0, $max_show);
        foreach ($slice as $line) {
            $label = $line['name'] !== ''
                ? wp_strip_all_tags($line['name'])
                : __('Product', 'helpmate-ai-chatbot');
            $parts[] = sprintf(
                /* translators: 1: product name, 2: quantity */
                __('%1$s × %2$d', 'helpmate-ai-chatbot'),
                $label,
                $line['qty']
            );
        }

        $remaining = count($lines) - count($slice);
        if ($remaining > 0) {
            $parts[] = sprintf(
                /* translators: %d: number of additional order line items not shown */
                __('+%d more', 'helpmate-ai-chatbot'),
                $remaining
            );
        }

        $summary = implode(', ', $parts);
        $total_units = 0;
        foreach ($lines as $line) {
            $total_units += (int) $line['qty'];
        }
        $line_count = count($lines);

        if ($line_count > 1) {
            $summary .= ' — ' . sprintf(
                /* translators: 1: number of distinct line items, 2: sum of quantities */
                __('%1$d products, %2$d total qty', 'helpmate-ai-chatbot'),
                $line_count,
                $total_units
            );
        }

        return $summary;
    }

    /**
     * Get Easy Digital Downloads orders for a contact.
     *
     * @since    2.0.3
     * @param    int    $contact_id    The contact ID.
     * @return   array    The EDD orders.
     */
    public function get_edd_orders_by_contact(int $contact_id): array
    {
        if (!function_exists('edd_get_orders')) {
            return [];
        }

        $contact = $this->get_contact($contact_id);
        if (!$contact) {
            return [];
        }

        $orders = [];

        $crm = $this;
        $collect_orders = function (array $args) use (&$orders, $crm) {
            $query_args = array_merge([
                'number' => 200,
                'orderby' => 'date_created',
                'order' => 'DESC',
            ], $args);

            $fetched_orders = edd_get_orders($query_args);
            if (!is_array($fetched_orders)) {
                return;
            }

            foreach ($fetched_orders as $order) {
                $order_id = (int) ($order->id ?? 0);
                if ($order_id <= 0) {
                    continue;
                }

                $already_added = false;
                foreach ($orders as $existing) {
                    if ((int) ($existing['id'] ?? 0) === $order_id) {
                        $already_added = true;
                        break;
                    }
                }
                if ($already_added) {
                    continue;
                }

                $total = '';
                if (isset($order->total) && $order->total !== null) {
                    $total = (string) $order->total;
                } elseif (isset($order->subtotal) && $order->subtotal !== null) {
                    $total = (string) $order->subtotal;
                }

                $status = isset($order->status) ? (string) $order->status : '';
                $currency = isset($order->currency) ? (string) $order->currency : '';
                $date_created = isset($order->date_created) ? (string) $order->date_created : '';
                if (empty($date_created) && isset($order->date_created_gmt)) {
                    $date_created = (string) $order->date_created_gmt;
                }

                $orders[] = [
                    'id' => $order_id,
                    'order_number' => (string) ($order->number ?? $order_id),
                    'status' => $status,
                    'total' => $total,
                    'currency' => $currency,
                    'date_created' => $date_created,
                    'edit_url' => admin_url('edit.php?post_type=download&page=edd-payment-history&view=view-order-details&id=' . $order_id),
                    'product_summary' => $crm->format_edd_order_product_summary($order_id, $order),
                ];
            }
        };

        // Primary strategy: Match by WP user ID.
        if (!empty($contact['wp_user_id'])) {
            $collect_orders(['user_id' => (int) $contact['wp_user_id']]);
        }

        // Fallback: Match by email.
        if (!empty($contact['email'])) {
            $collect_orders(['email' => $contact['email']]);
        }

        return $orders;
    }

    /**
     * Rows from SureCart Order::paginate() (Collection uses __get('data') without __isset).
     *
     * @param mixed $page_result Paginate result or list.
     * @return array<int, mixed>
     */
    private function crm_surecart_extract_paginate_list($page_result): array
    {
        if (is_wp_error($page_result)) {
            return array();
        }
        if (is_array($page_result)) {
            return $page_result;
        }
        if (!is_object($page_result)) {
            return array();
        }
        $raw = null;
        if (method_exists($page_result, 'getAttribute')) {
            $raw = $page_result->getAttribute('data');
        }
        if (!is_array($raw)) {
            $raw = $page_result->data;
        }

        return is_array($raw) ? $raw : array();
    }

    /**
     * Get SureCart orders for a contact (WP user or email → customer id).
     *
     * @since 2.0.5
     * @param int $contact_id Contact ID.
     * @return array<int, array<string, mixed>>
     */
    public function get_surecart_orders_by_contact(int $contact_id): array
    {
        if (!class_exists('\SureCart\Models\Order')) {
            return [];
        }

        $contact = $this->get_contact($contact_id);
        if (!$contact) {
            return [];
        }

        $customer_ids = array();

        if (!empty($contact['wp_user_id']) && class_exists('\SureCart\Models\User')) {
            try {
                $sc_user = \SureCart\Models\User::find((int) $contact['wp_user_id']);
                if (!is_wp_error($sc_user) && is_object($sc_user)) {
                    $customer_ids = array_values(
                        array_filter(
                            (array) $sc_user->customerIds(),
                            static function ($id) {
                                return null !== $id && '' !== $id;
                            }
                        )
                    );
                    if (empty($customer_ids)) {
                        $linked = $sc_user->getOrCreateLiveCustomerId();
                        if (!is_wp_error($linked) && !empty($linked)) {
                            $customer_ids = array_values(
                                array_filter(
                                    (array) $sc_user->customerIds(),
                                    static function ($id) {
                                        return null !== $id && '' !== $id;
                                    }
                                )
                            );
                        }
                    }
                }
            } catch (\Throwable $e) {
                $customer_ids = array();
            }
        }

        if (empty($customer_ids) && !empty($contact['email']) && class_exists('\SureCart\Models\Customer')) {
            try {
                $email_lower = strtolower(trim((string) $contact['email']));
                $c = \SureCart\Models\Customer::where(
                    array(
                        'email' => $email_lower,
                        'live_mode' => true,
                    )
                )->first();
                if ((is_wp_error($c) || !is_object($c) || empty($c->id)) && $email_lower !== '') {
                    $c = \SureCart\Models\Customer::where(
                        array(
                            'email' => $email_lower,
                            'live_mode' => false,
                        )
                    )->first();
                }
                if (!is_wp_error($c) && is_object($c) && !empty($c->id)) {
                    $customer_ids[] = $c->id;
                }
            } catch (\Throwable $e) {
                $customer_ids = array();
            }
        }

        $customer_ids = array_values(
            array_unique(
                array_filter(
                    array_map('strval', $customer_ids),
                    static function ($v) {
                        return $v !== '';
                    }
                )
            )
        );

        if (empty($customer_ids)) {
            return array();
        }

        $out = array();
        $seen = array();

        try {
            $page = 1;
            $per_page = 100;
            $max_pages = 25;
            while ($page <= $max_pages) {
                $query = \SureCart\Models\Order::where(
                    array(
                        'customer_ids' => $customer_ids,
                    )
                )->with(array('checkout'));

                $page_result = $query->paginate(
                    array(
                        'per_page' => $per_page,
                        'page' => $page,
                    )
                );

                if (is_wp_error($page_result)) {
                    break;
                }

                $list = $this->crm_surecart_extract_paginate_list($page_result);

                if (empty($list)) {
                    break;
                }

                foreach ($list as $order) {
                    if (!is_object($order)) {
                        continue;
                    }
                    $oid = isset($order->id) ? (string) $order->id : '';
                    if ($oid === '' || isset($seen[ $oid ])) {
                        continue;
                    }
                    $seen[ $oid ] = true;

                    $number = isset($order->number) && (string) $order->number !== ''
                        ? (string) $order->number
                        : $oid;
                    $status = isset($order->status) ? (string) $order->status : '';
                    $date_created = '';
                    if (!empty($order->created_at_date)) {
                        $date_created = (string) $order->created_at_date;
                    } elseif (!empty($order->created_at)) {
                        $ts = (int) $order->created_at;
                        if ($ts > 0) {
                            $date_created = gmdate('Y-m-d H:i:s', $ts);
                        }
                    }

                    $checkout = (isset($order->checkout) && is_object($order->checkout)) ? $order->checkout : null;
                    $currency = $checkout && isset($checkout->currency) ? (string) $checkout->currency : '';
                    $minor = $checkout && isset($checkout->total_amount) ? (int) $checkout->total_amount : 0;
                    $zd = $checkout && !empty($checkout->is_zero_decimal);
                    $total_float = $zd ? (float) $minor : (float) round($minor / 100, 2);
                    $total = (string) $total_float;

                    $edit_url = add_query_arg(
                        array(
                            'page' => 'sc-orders',
                            'action' => 'edit',
                            'id' => $oid,
                        ),
                        admin_url('admin.php')
                    );

                    $out[] = array(
                        'id' => $oid,
                        'order_number' => $number,
                        'status' => $status,
                        'total' => $total,
                        'currency' => $currency,
                        'date_created' => $date_created,
                        'edit_url' => $edit_url,
                        'product_summary' => '',
                    );
                }

                if (count($list) < $per_page) {
                    break;
                }
                ++$page;
            }
        } catch (\Throwable $e) {
            return array();
        }

        return $out;
    }

    /**
     * Get manual orders for a contact.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @return   array    The manual orders.
     */
    public function get_manual_orders(int $contact_id): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_manual_orders');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for orders listing; caching not appropriate for frequently changing data
        $orders = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT o.*, u.display_name as created_by_name
                FROM {$table} o
                LEFT JOIN {$wpdb->users} u ON o.created_by = u.ID
                WHERE o.contact_id = %d
                ORDER BY o.order_date DESC",
                $contact_id
            ),
            ARRAY_A
        );

        // Decode JSON customer_info
        foreach ($orders as &$order) {
            if (!empty($order['customer_info'])) {
                $order['customer_info'] = json_decode($order['customer_info'], true);
            }
        }

        return $orders;
    }

    /**
     * Create a manual order.
     *
     * @since    1.3.0
     * @param    int       $contact_id    The contact ID.
     * @param    array     $data          The order data.
     * @return   int|false    The order ID or false on failure.
     */
    public function create_manual_order(int $contact_id, array $data)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_manual_orders');

        // Auto-generate order number if not provided
        if (empty($data['order_number'])) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Direct query necessary for order number generation; table name is safe, uses wpdb->prefix
            $last_order = $wpdb->get_var(
                "SELECT order_number FROM {$table} WHERE order_number LIKE 'MO-%' ORDER BY id DESC LIMIT 1"
            );

            if ($last_order) {
                $last_num = (int) str_replace('MO-', '', $last_order);
                $data['order_number'] = 'MO-' . str_pad($last_num + 1, 3, '0', STR_PAD_LEFT);
            } else {
                $data['order_number'] = 'MO-001';
            }
        }

        // Check for duplicate order number
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for duplicate check; caching not appropriate
        $existing = $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT id FROM {$table} WHERE order_number = %s"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $data['order_number']
            )
        );
        if ($existing) {
            return false;
        }

        $insert_data = [
            'contact_id' => $contact_id,
            'order_number' => sanitize_text_field($data['order_number']),
            'product_name' => sanitize_text_field($data['product_name']),
            'quantity' => isset($data['quantity']) ? (int) $data['quantity'] : 1,
            'price' => isset($data['price']) ? (float) $data['price'] : 0,
            'order_date' => isset($data['order_date']) ? sanitize_text_field($data['order_date']) : current_time('mysql'),
            'status' => isset($data['status']) ? sanitize_text_field($data['status']) : 'pending',
            'notes' => isset($data['notes']) ? sanitize_textarea_field($data['notes']) : null,
            'customer_info' => isset($data['customer_info']) ? json_encode($data['customer_info']) : null,
            'created_by' => get_current_user_id(),
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql')
        ];

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $result = $wpdb->insert($table, $insert_data);

        return $result ? $wpdb->insert_id : false;
    }

    /**
     * Update a manual order.
     *
     * @since    1.3.0
     * @param    int       $order_id    The order ID.
     * @param    array     $data        The order data.
     * @return   bool    Whether the update was successful.
     */
    public function update_manual_order(int $order_id, array $data): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_manual_orders');

        $update_data = [
            'updated_at' => current_time('mysql')
        ];

        $allowed_fields = ['order_number', 'product_name', 'quantity', 'price', 'order_date', 'status', 'notes', 'customer_info'];

        foreach ($allowed_fields as $field) {
            if (isset($data[$field])) {
                if ($field === 'quantity') {
                    $update_data[$field] = (int) $data[$field];
                } elseif ($field === 'price') {
                    $update_data[$field] = (float) $data[$field];
                } elseif ($field === 'customer_info') {
                    $update_data[$field] = json_encode($data[$field]);
                } elseif ($field === 'notes') {
                    $update_data[$field] = sanitize_textarea_field($data[$field]);
                } else {
                    $update_data[$field] = sanitize_text_field($data[$field]);
                }
            }
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $table,
            $update_data,
            ['id' => $order_id]
        );

        return $result !== false;
    }

    /**
     * Delete a manual order.
     *
     * @since    1.3.0
     * @param    int    $order_id    The order ID.
     * @return   bool    Whether the deletion was successful.
     */
    public function delete_manual_order(int $order_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_manual_orders');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->delete($table, ['id' => $order_id]);

        return $result !== false;
    }

    /**
     * Search WordPress users.
     *
     * @since    1.3.0
     * @param    string    $search    Search query.
     * @param    int       $limit     Maximum number of results.
     * @return   array     Array of user data.
     */
    public function search_wp_users(string $search = '', int $limit = 50): array
    {
        $args = [
            'number' => $limit,
            'orderby' => 'display_name',
            'order' => 'ASC',
        ];

        if (!empty($search)) {
            $args['search'] = '*' . esc_attr($search) . '*';
            $args['search_columns'] = ['user_login', 'user_nicename', 'user_email', 'display_name'];
        }

        $users = get_users($args);

        $result = [];
        foreach ($users as $user) {
            $result[] = [
                'id' => $user->ID,
                'username' => $user->user_login,
                'display_name' => $user->display_name,
                'email' => $user->user_email,
            ];
        }

        return $result;
    }

    /**
     * Find a contact by email or create a new one.
     *
     * @since    1.3.0
     * @param    string    $email    The email address.
     * @param    array     $data     Additional contact data (name, phone, etc.).
     * @return   int|false           The contact ID or false on failure.
     */
    public function find_or_create_contact_by_email(string $email, array $data = [])
    {
        if (empty($email)) {
            return false;
        }

        // Search for existing contact by email
        $contact = $this->get_contact_by_email($email);
        if ($contact) {
            return $contact['id'];
        }

        // Create new contact
        $contact_data = [
            'email' => $email,
            'first_name' => $data['first_name'] ?? $data['name'] ?? '',
            'last_name' => $data['last_name'] ?? '',
            'phone' => $data['phone'] ?? null,
            'status' => 'Lead',
        ];

        return $this->create_contact($contact_data);
    }

    /**
     * Get a contact by email address.
     *
     * @since    1.3.0
     * @param    string    $email    The email address.
     * @return   array|null          The contact data or null if not found.
     */
    public function get_contact_by_email(string $email): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $contact = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE email = %s LIMIT 1"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $email
            ),
            ARRAY_A
        );

        if (!$contact) {
            return null;
        }

        // Ensure wp_user_id is properly cast
        if (isset($contact['wp_user_id'])) {
            $contact['wp_user_id'] = !empty($contact['wp_user_id']) ? (int) $contact['wp_user_id'] : null;
        }

        // Get custom field values
        $contact['custom_fields'] = $this->get_contact_custom_field_values($contact['id']);

        return $contact;
    }

    /**
     * Search contacts by email (partial match).
     *
     * @since    1.3.0
     * @param    string    $email    The email to search for.
     * @param    int       $limit    Maximum number of results.
     * @return   array               Array of contacts.
     */
    public function get_contacts_by_email(string $email, int $limit = 10): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for contact search; caching not appropriate for frequently changing data
        $contacts = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE email LIKE %s ORDER BY created_at DESC LIMIT %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                '%' . $wpdb->esc_like($email) . '%',
                $limit
            ),
            ARRAY_A
        );

        foreach ($contacts as &$contact) {
            if (isset($contact['wp_user_id'])) {
                $contact['wp_user_id'] = !empty($contact['wp_user_id']) ? (int) $contact['wp_user_id'] : null;
            }
            $contact['custom_fields'] = $this->get_contact_custom_field_values($contact['id']);
        }

        return $contacts;
    }

    /**
     * Get all email templates.
     *
     * @since    1.3.0
     * @return   array    Array of email templates.
     */
    public function get_email_templates(): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for templates listing; caching not appropriate for frequently changing data
        $templates = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT * FROM {$table} ORDER BY created_at DESC",
            ARRAY_A
        );

        foreach ($templates as &$template) {
            $template['id'] = (int) $template['id'];
        }

        return $templates;
    }

    /**
     * Get a single email template by ID.
     *
     * @since    1.3.0
     * @param    int    $template_id    The template ID.
     * @return   array|null             The template data or null if not found.
     */
    public function get_email_template(int $template_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $template = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE id = %d LIMIT 1"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $template_id
            ),
            ARRAY_A
        );

        if (!$template) {
            return null;
        }

        $template['id'] = (int) $template['id'];
        return $template;
    }

    /**
     * Create a new email template.
     *
     * @since    1.3.0
     * @param    array    $data    Template data (name, subject, body).
     * @return   int|false         The template ID on success, false on failure.
     */
    public function create_email_template(array $data)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');

        $name = sanitize_text_field($data['name'] ?? '');
        $subject = wp_kses_post($data['subject'] ?? '');
        $body = wp_kses_post($data['body'] ?? '');
        $is_default = isset($data['is_default']) ? (int) $data['is_default'] : 0;
        $original_subject = isset($data['original_subject']) ? wp_kses_post($data['original_subject']) : null;
        $original_body = isset($data['original_body']) ? wp_kses_post($data['original_body']) : null;

        if (empty($name) || empty($subject) || empty($body)) {
            return false;
        }

        $insert_data = [
            'name' => $name,
            'subject' => $subject,
            'body' => $body,
            'is_default' => $is_default,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql'),
        ];
        $format = ['%s', '%s', '%s', '%d', '%s', '%s'];

        if ($original_subject !== null) {
            $insert_data['original_subject'] = $original_subject;
            $format[] = '%s';
        }

        if ($original_body !== null) {
            $insert_data['original_body'] = $original_body;
            $format[] = '%s';
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $result = $wpdb->insert(
            $table,
            $insert_data,
            $format
        );

        if ($result === false) {
            return false;
        }

        return $wpdb->insert_id;
    }

    /**
     * Update an email template.
     *
     * @since    1.3.0
     * @param    int      $template_id    The template ID.
     * @param    array    $data          Template data (name, subject, body).
     * @return   bool                    Whether the update was successful.
     */
    public function update_email_template(int $template_id, array $data): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');

        $update_data = [];
        $format = [];

        if (isset($data['name'])) {
            $update_data['name'] = sanitize_text_field($data['name']);
            $format[] = '%s';
        }

        if (isset($data['subject'])) {
            $update_data['subject'] = wp_kses_post($data['subject']);
            $format[] = '%s';
        }

        if (isset($data['body'])) {
            $update_data['body'] = wp_kses_post($data['body']);
            $format[] = '%s';
        }

        if (empty($update_data)) {
            return false;
        }

        $update_data['updated_at'] = current_time('mysql');
        $format[] = '%s';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $table,
            $update_data,
            ['id' => $template_id],
            $format,
            ['%d']
        );

        return $result !== false;
    }

    /**
     * Delete an email template.
     *
     * @since    1.3.0
     * @param    int    $template_id    The template ID.
     * @return   bool|WP_Error          Whether the deletion was successful, or WP_Error if default template.
     */
    public function delete_email_template(int $template_id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');

        // Check if template is a default template
        $template = $this->get_email_template($template_id);
        if ($template && isset($template['is_default']) && (int) $template['is_default'] === 1) {
            return new WP_Error('default_template', 'Cannot delete default email templates.');
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $result = $wpdb->delete(
            $table,
            ['id' => $template_id],
            ['%d']
        );

        return $result !== false;
    }

    /**
     * Restore a default email template to its original content.
     *
     * @since    1.3.0
     * @param    int    $template_id    The template ID.
     * @return   bool|WP_Error          Whether the restore was successful, or WP_Error if not a default template or missing original content.
     */
    public function restore_default_email_template(int $template_id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');

        // Get the template
        $template = $this->get_email_template($template_id);
        if (!$template) {
            return new WP_Error('template_not_found', 'Template not found.');
        }

        // Check if template is a default template
        if (!isset($template['is_default']) || (int) $template['is_default'] !== 1) {
            return new WP_Error('not_default_template', 'This is not a default template.');
        }

        // Check if original content exists
        if (empty($template['original_subject']) || empty($template['original_body'])) {
            return new WP_Error('missing_original', 'Original template content not found.');
        }

        // Restore original content
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->update(
            $table,
            [
                'subject' => $template['original_subject'],
                'body' => $template['original_body'],
                'updated_at' => current_time('mysql'),
            ],
            ['id' => $template_id],
            ['%s', '%s', '%s'],
            ['%d']
        );

        return $result !== false;
    }

    /**
     * Get default transactional email template HTML.
     *
     * @since    1.3.0
     * @return   string    The default transactional email template HTML.
     */
    public function get_default_transactional_email_template(): string
    {
        return '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                    Hello {first_name},
                </div>
                <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                    Email Title
                </div>
                <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                    Your email content goes here. You can use variables like {first_name}, {last_name}, {email}, and {shop_name}.
                </div>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Details</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.5;">
                            Add your content here with variables.
                        </div>
                    </div>
                </div>
                <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                    Best regards,<br>
                    {shop_name}
                </div>
            </div>
        </div>';
    }

    /**
     * Create default smart schedule email templates.
     *
     * @since    1.3.0
     * @return   array    Array of created template IDs.
     */
    public function create_default_smart_schedule_templates(): array
    {
        $templates = [];

        // Check if templates already exist
        $existing_templates = $this->get_email_templates();
        $existing_names = array_column($existing_templates, 'name');

        $pending_exists = in_array('Schedule Pending Confirmation', $existing_names);
        $confirmed_exists = in_array('Schedule Confirmed', $existing_names);
        $cancelled_exists = in_array('Schedule Cancelled', $existing_names);

        // Pending template
        if (!$pending_exists) {
            $pending_subject = 'Your appointment request has been received';
            $pending_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                        Hello {name},
                    </div>
                    <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                        Appointment Request Received
                    </div>
                    <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                        Thank you for scheduling an appointment with us. We have received your request and will confirm it shortly.
                    </div>
                    <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                            <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">Appointment Details</div>
                            <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                                <strong>Date:</strong> {date}<br>
                                <strong>Time:</strong> {time}<br>
                                <strong>Phone:</strong> {phone}<br>
                                <strong>Message:</strong> {message}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                        Best regards,<br>
                        {shop_name}
                    </div>
                </div>
            </div>';
            $pending_id = $this->create_email_template([
                'name' => 'Schedule Pending Confirmation',
                'subject' => $pending_subject,
                'body' => $pending_body,
                'is_default' => 1,
                'original_subject' => $pending_subject,
                'original_body' => $pending_body,
            ]);
            if ($pending_id) {
                $templates['pending'] = $pending_id;
            }
        } else {
            // Find existing template ID
            foreach ($existing_templates as $template) {
                if ($template['name'] === 'Schedule Pending Confirmation') {
                    $templates['pending'] = (int) $template['id'];
                    break;
                }
            }
        }

        // Confirmed template
        if (!$confirmed_exists) {
            $confirmed_subject = 'Your appointment has been confirmed';
            $confirmed_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                        Hello {name},
                    </div>
                    <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                        Appointment Confirmed
                    </div>
                    <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                        Great news! Your appointment has been confirmed. We look forward to seeing you.
                    </div>
                    <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                            <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">Appointment Details</div>
                            <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                                <strong>Date:</strong> {date}<br>
                                <strong>Time:</strong> {time}<br>
                                <strong>Phone:</strong> {phone}<br>
                                <strong>Message:</strong> {message}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                        Best regards,<br>
                        {shop_name}
                    </div>
                </div>
            </div>';
            $confirmed_id = $this->create_email_template([
                'name' => 'Schedule Confirmed',
                'subject' => $confirmed_subject,
                'body' => $confirmed_body,
                'is_default' => 1,
                'original_subject' => $confirmed_subject,
                'original_body' => $confirmed_body,
            ]);
            if ($confirmed_id) {
                $templates['confirmed'] = $confirmed_id;
            }
        } else {
            // Find existing template ID
            foreach ($existing_templates as $template) {
                if ($template['name'] === 'Schedule Confirmed') {
                    $templates['confirmed'] = (int) $template['id'];
                    break;
                }
            }
        }

        // Cancelled template
        if (!$cancelled_exists) {
            $cancelled_subject = 'Your appointment has been cancelled';
            $cancelled_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                        Hello {name},
                    </div>
                    <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                        Appointment Cancelled
                    </div>
                    <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                        Your appointment has been cancelled. If you would like to reschedule, please contact us.
                    </div>
                    <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                            <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">Cancelled Appointment</div>
                            <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                                <strong>Date:</strong> {date}<br>
                                <strong>Time:</strong> {time}<br>
                                <strong>Phone:</strong> {phone}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                        Best regards,<br>
                        {shop_name}
                    </div>
                </div>
            </div>';
            $cancelled_id = $this->create_email_template([
                'name' => 'Schedule Cancelled',
                'subject' => $cancelled_subject,
                'body' => $cancelled_body,
                'is_default' => 1,
                'original_subject' => $cancelled_subject,
                'original_body' => $cancelled_body,
            ]);
            if ($cancelled_id) {
                $templates['cancelled'] = $cancelled_id;
            }
        } else {
            // Find existing template ID
            foreach ($existing_templates as $template) {
                if ($template['name'] === 'Schedule Cancelled') {
                    $templates['cancelled'] = (int) $template['id'];
                    break;
                }
            }
        }

        return $templates;
    }

    /**
     * Create default abandoned cart follow-up email templates.
     *
     * @since 1.0.0
     * @return array Array of template IDs keyed by slot (first, second, third)
     */
    public function create_default_abandoned_cart_followup_templates(): array
    {
        $templates = [];
        $existing_templates = $this->get_email_templates();

        $default_template_names = [
            'first' => 'Abandoned Cart - 2nd Reminder',
            'second' => 'Abandoned Cart - 3rd Reminder',
            'third' => 'Abandoned Cart - Final Reminder',
        ];

        foreach ($default_template_names as $key => $name) {
            $found_template = array_filter($existing_templates, fn($t) => $t['name'] === $name);
            if (!empty($found_template)) {
                $templates[$key] = reset($found_template)['id'];
                continue;
            }

            // Full inline HTML per template (no str_replace pattern)
            $custom_body = '';
            if ($key === 'first') {
                $custom_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                            Hello {customer_name},
                        </div>
                        <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                            You Left Items in Your Cart!
                        </div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                            We noticed you left some items in your cart at <strong>{shop_name}</strong>. Don\'t worry, we\'ve saved them for you!
                        </div>
                        <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                            <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                                <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Cart Details</div>
                                <div style="color: #666666; font-size: 14px; line-height: 1.5;">
                                    {cart_items}
                                </div>
                            </div>
                        </div>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="{cart_url}" style="background-color: #455CFE; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-size: 14px; display: inline-block;">Complete Your Purchase</a>
                        </div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 20px; text-align: center;">
                            Complete your purchase now and get back to where you left off. If you have any questions, feel free to reply to this email.
                        </div>
                        <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                            Best regards,<br>
                            {shop_name}
                        </div>
                    </div>
                </div>';
            } elseif ($key === 'second') {
                $custom_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                            Hello {customer_name},
                        </div>
                        <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                            Your Cart Is Waiting – Special Offer Inside!
                        </div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                            Your cart items are still waiting for you at <strong>{shop_name}</strong>! As a special thank you, we\'d like to offer you a discount to complete your purchase.
                        </div>
                        <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                            <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                                <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Cart Details</div>
                                <div style="color: #666666; font-size: 14px; line-height: 1.5;">
                                    {cart_items}
                                </div>
                            </div>
                        </div>
                        {coupon_section}
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="{cart_url}" style="background-color: #455CFE; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-size: 14px; display: inline-block;">Complete Your Purchase</a>
                        </div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 20px; text-align: center;">
                            This offer expires in 48 hours. If you have any questions, feel free to reply to this email.
                        </div>
                        <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                            Best regards,<br>
                            {shop_name}
                        </div>
                    </div>
                </div>';
            } else {
                $custom_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                            Hello {customer_name},
                        </div>
                        <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                            Last Chance – Your Cart Expires Soon
                        </div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                            This is your last reminder! Your cart will expire soon and these items might go out of stock.
                        </div>
                        <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                            <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                                <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Cart Details</div>
                                <div style="color: #666666; font-size: 14px; line-height: 1.5;">
                                    {cart_items}
                                </div>
                            </div>
                        </div>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="{cart_url}" style="background-color: #455CFE; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-size: 14px; display: inline-block;">Complete Your Purchase Now</a>
                        </div>
                        <div style="color: #dc3545; font-size: 14px; line-height: 1.5; margin-bottom: 20px; text-align: center; font-weight: bold;">
                            Don\'t miss out on these items!
                        </div>
                        <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                            Best regards,<br>
                            {shop_name}
                        </div>
                    </div>
                </div>';
            }

            $template_subject = $key === 'first' ? 'You left items in your cart!' : ($key === 'second' ? 'Your cart is waiting - Special offer inside!' : 'Last chance - Your cart expires soon');
            $template_id = $this->create_email_template([
                'name' => $name,
                'subject' => $template_subject,
                'body' => $custom_body,
                'is_default' => 1,
                'original_subject' => $template_subject,
                'original_body' => $custom_body,
            ]);

            if ($template_id) {
                $templates[$key] = $template_id;
            }
        }

        return $templates;
    }

    /**
     * Create default refund return email template.
     *
     * @since 1.0.0
     * @return int|null Template ID if created, null otherwise
     */
    public function create_default_refund_return_template(): ?int
    {
        $existing_templates = $this->get_email_templates();
        $existing_names = array_column($existing_templates, 'name');

        if (in_array('Refund/Return Request Update', $existing_names)) {
            // Find existing template ID
            foreach ($existing_templates as $template) {
                if ($template['name'] === 'Refund/Return Request Update') {
                    return (int) $template['id'];
                }
            }
        }

        $custom_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                    Hello {customer_name},
                </div>
                <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                    Refund/Return Request Update
                </div>
                <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                    We have an update regarding your refund/return request at <strong>{shop_name}</strong>.<br>
                    Please review the details below:
                </div>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                    <div style="background: #455CFE; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 14px; margin-bottom: 15px;">{status}</div>
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">Request Details</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>Order Number:</strong> {order_number}<br>
                            <strong>Type:</strong> {return_refund_type}<br>
                            <strong>Status:</strong> {return_refund_status}<br>
                            <strong>Reason:</strong> {return_refund_reason}<br>
                            <strong>Amount:</strong> {return_refund_amount}<br>
                            <strong>Items:</strong> {return_refund_items}
                        </div>
                    </div>
                </div>
                <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 20px; text-align: center;">
                    If you have any questions, feel free to reply to this email.
                </div>
                <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                    Best regards,<br>
                    {shop_name}
                </div>
            </div>
        </div>';

        $refund_subject = 'Your Refund/Return Request';
        $template_id = $this->create_email_template([
            'name' => 'Refund/Return Request Update',
            'subject' => $refund_subject,
            'body' => $custom_body,
            'is_default' => 1,
            'original_subject' => $refund_subject,
            'original_body' => $custom_body,
        ]);

        return $template_id ? $template_id : null;
    }

    /**
     * Create default abandoned cart initial email template.
     *
     * @since 1.0.0
     * @return int|null Template ID if created, null otherwise
     */
    public function create_default_abandoned_cart_template(): ?int
    {
        $existing_templates = $this->get_email_templates();
        $existing_names = array_column($existing_templates, 'name');

        if (in_array('Abandoned Cart - 1st Email', $existing_names)) {
            // Find existing template ID
            foreach ($existing_templates as $template) {
                if ($template['name'] === 'Abandoned Cart - 1st Email') {
                    return (int) $template['id'];
                }
            }
        }

        $custom_body = '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">
                    Hello {customer_name},
                </div>
                <div style="color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">
                    You Left Something Behind
                </div>
                <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                    We noticed that you added some great items to your cart at <strong>{shop_name}</strong> but didn\'t complete your purchase.
                    Don\'t worry — your cart is still saved and waiting for you!
                </div>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 400px; border: 2px solid #455CFE;">
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Cart Details</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.5;">
                            {cart_items}
                        </div>
                    </div>
                </div>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{cart_url}" style="background-color: #455CFE; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-size: 14px; display: inline-block;">Complete Your Purchase</a>
                </div>
                {coupon_section}
                <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 20px; text-align: center;">
                    Hurry back before your items go out of stock. If you have any questions, feel free to reply to this email.
                </div>
                <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                    Best regards,<br>
                    {shop_name}
                </div>
            </div>
        </div>';

        $abandoned_subject = 'You left something behind?';
        $template_id = $this->create_email_template([
            'name' => 'Abandoned Cart - 1st Email',
            'subject' => $abandoned_subject,
            'body' => $custom_body,
            'is_default' => 1,
            'original_subject' => $abandoned_subject,
            'original_body' => $custom_body,
        ]);

        return $template_id ? $template_id : null;
    }

    /**
     * Migrate existing default templates to mark them as default and store original content.
     *
     * @since    1.3.0
     * @return   void
     */
    public function migrate_existing_default_templates(): void
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');

        // Rename abandoned cart templates from old to new names (one-time migration for existing installs).
        $abandoned_cart_name_migrations = [
            'Abandoned Cart - Initial Email' => 'Abandoned Cart - 1st Email',
            'Abandoned Cart - First Reminder' => 'Abandoned Cart - 2nd Reminder',
            'Abandoned Cart - Second Reminder' => 'Abandoned Cart - 3rd Reminder',
        ];
        foreach ($abandoned_cart_name_migrations as $old_name => $new_name) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Rename migration doesn't require caching
            $wpdb->update(
                $table,
                ['name' => $new_name],
                ['name' => $old_name],
                ['%s'],
                ['%s']
            );
        }

        // List of default template names (after rename)
        $default_template_names = [
            'Schedule Pending Confirmation',
            'Schedule Confirmed',
            'Schedule Cancelled',
            'Abandoned Cart - 1st Email',
            'Abandoned Cart - 2nd Reminder',
            'Abandoned Cart - 3rd Reminder',
            'Abandoned Cart - Final Reminder',
            'Refund/Return Request Update',
        ];

        // Get all templates
        $templates = $this->get_email_templates();

        foreach ($templates as $template) {
            // Check if this is a default template by name
            if (in_array($template['name'], $default_template_names, true)) {
                // Check if already migrated
                if (isset($template['is_default']) && (int) $template['is_default'] === 1) {
                    continue;
                }

                // Mark as default and store original content
                $update_data = [
                    'is_default' => 1,
                    'updated_at' => current_time('mysql'),
                ];
                $format = ['%d', '%s'];

                // Store original content if not already stored
                if (empty($template['original_subject'])) {
                    $update_data['original_subject'] = $template['subject'];
                    $format[] = '%s';
                }
                if (empty($template['original_body'])) {
                    $update_data['original_body'] = $template['body'];
                    $format[] = '%s';
                }

                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
                $wpdb->update(
                    $table,
                    $update_data,
                    ['id' => $template['id']],
                    $format,
                    ['%d']
                );
            }
        }
    }

    /**
     * Replace email variables with contact data.
     *
     * @since    1.3.0
     * @param    string    $subject_or_body    The subject or body template with variables.
     * @param    array     $contact           The contact data.
     * @return   string                       The replaced string.
     */
    public function replace_email_variables(string $subject_or_body, array $contact): string
    {
        // Get custom field values for this contact
        $custom_fields = $this->get_contact_custom_field_values($contact['id']);

        // Build full name
        $first_name = $contact['first_name'] ?? '';
        $last_name = $contact['last_name'] ?? '';
        $full_name = trim($first_name . ' ' . $last_name);

        // Build replacements array
        $replacements = [
            '{first_name}' => esc_html($first_name),
            '{last_name}' => esc_html($last_name),
            '{name}' => esc_html($full_name),
            '{email}' => esc_html($contact['email'] ?? ''),
            '{phone}' => esc_html($contact['phone'] ?? ''),
            '{address_line_1}' => esc_html($contact['address_line_1'] ?? ''),
            '{address_line_2}' => esc_html($contact['address_line_2'] ?? ''),
            '{city}' => esc_html($contact['city'] ?? ''),
            '{state}' => esc_html($contact['state'] ?? ''),
            '{zip_code}' => esc_html($contact['zip_code'] ?? ''),
            '{country}' => esc_html($contact['country'] ?? ''),
            '{shop_name}' => get_bloginfo('name'),
        ];

        // Add custom field variables
        foreach ($custom_fields as $field) {
            $field_name = $field['field_name'];
            $value = $field['value'];

            // Handle different field types
            if (is_array($value)) {
                $value = implode(', ', $value);
            } elseif ($value === null) {
                $value = '';
            } else {
                $value = (string) $value;
            }

            $replacements['{' . $field_name . '}'] = esc_html($value);
        }

        // Replace all variables
        $result = str_replace(array_keys($replacements), array_values($replacements), $subject_or_body);

        return $result;
    }

    /**
     * Get list of available email variables for contact context.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID to get custom fields for.
     * @return   array                 Array of available variable names (without braces).
     */
    public function get_available_contact_variables(int $contact_id): array
    {
        $base_variables = [
            'first_name',
            'last_name',
            'name',
            'email',
            'phone',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'zip_code',
            'country',
            'shop_name',
        ];

        // Add custom field variables
        $custom_fields = $this->get_contact_custom_field_values($contact_id);
        foreach ($custom_fields as $field) {
            $base_variables[] = $field['field_name'];
        }

        return $base_variables;
    }

    /**
     * Get unreplaceable variables from email content.
     *
     * Extracts all {variable} patterns from the content and checks which ones
     * cannot be replaced in the current context.
     *
     * @since    1.3.0
     * @param    string    $subject          The email subject.
     * @param    string    $body             The email body.
     * @param    int       $contact_id       The contact ID.
     * @return   array                       Array of unreplaceable variable names (without braces).
     */
    public function get_unreplaceable_variables(string $subject, string $body, int $contact_id): array
    {
        $content = $subject . ' ' . $body;

        // Extract all {variable} patterns
        preg_match_all('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', $content, $matches);

        if (empty($matches[1])) {
            return [];
        }

        $used_variables = array_unique($matches[1]);
        $available_variables = $this->get_available_contact_variables($contact_id);

        // Find variables that are used but not available
        $unreplaceable = array_diff($used_variables, $available_variables);

        return array_values($unreplaceable);
    }

    /**
     * Get variables that exist but have empty values for the contact.
     *
     * @since    1.3.0
     * @param    string    $subject          The email subject.
     * @param    string    $body             The email body.
     * @param    array     $contact          The contact data.
     * @return   array                       Array of variable names with empty values (without braces).
     */
    public function get_empty_variables(string $subject, string $body, array $contact): array
    {
        $content = $subject . ' ' . $body;

        // Extract all {variable} patterns
        preg_match_all('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', $content, $matches);

        if (empty($matches[1])) {
            return [];
        }

        $used_variables = array_unique($matches[1]);

        // Get custom field values
        $custom_fields = $this->get_contact_custom_field_values($contact['id']);
        $custom_field_values = [];
        foreach ($custom_fields as $field) {
            $value = $field['value'];
            if (is_array($value)) {
                $value = implode(', ', $value);
            }
            $custom_field_values[$field['field_name']] = $value;
        }

        // Build full name
        $first_name = $contact['first_name'] ?? '';
        $last_name = $contact['last_name'] ?? '';
        $full_name = trim($first_name . ' ' . $last_name);

        // Map variables to their values
        $variable_values = [
            'first_name' => $first_name,
            'last_name' => $last_name,
            'name' => $full_name,
            'email' => $contact['email'] ?? '',
            'phone' => $contact['phone'] ?? '',
            'address_line_1' => $contact['address_line_1'] ?? '',
            'address_line_2' => $contact['address_line_2'] ?? '',
            'city' => $contact['city'] ?? '',
            'state' => $contact['state'] ?? '',
            'zip_code' => $contact['zip_code'] ?? '',
            'country' => $contact['country'] ?? '',
            'shop_name' => get_bloginfo('name'),
        ];

        // Add custom field values
        foreach ($custom_field_values as $field_name => $value) {
            $variable_values[$field_name] = $value;
        }

        // Find variables that are empty
        $empty_variables = [];
        foreach ($used_variables as $var) {
            if (isset($variable_values[$var]) && trim((string) $variable_values[$var]) === '') {
                $empty_variables[] = $var;
            }
        }

        return $empty_variables;
    }

    /**
     * Send email to a contact.
     *
     * @since    1.3.0
     * @param    int      $contact_id            The contact ID.
     * @param    int|null $template_id           The template ID (optional, if provided will use template subject/body).
     * @param    string   $subject               The email subject (required if no template_id).
     * @param    string   $body                  The email body (required if no template_id).
     * @param    int      $user_id               The WordPress user ID who is sending.
     * @param    int|null $campaign_id           Optional campaign ID for tracking.
     * @param    int|null $recurring_campaign_id Optional recurring campaign ID for tracking.
     * @param    int|null $sequence_id           Optional sequence ID for tracking.
     * @param    int|null $sequence_step_id       Optional sequence step ID for tracking.
     * @return   bool|WP_Error                   True on success, false on failure, or WP_Error with details.
     */
    public function send_email_to_contact(int $contact_id, ?int $template_id, string $subject, string $body, int $user_id, ?int $campaign_id = null, ?int $recurring_campaign_id = null, ?int $sequence_id = null, ?int $sequence_step_id = null)
    {
        global $wpdb;

        // Get contact
        $contact = $this->get_contact($contact_id);
        if (!$contact) {
            return new WP_Error('contact_not_found', __('Contact not found.', 'helpmate-ai-chatbot'));
        }

        // Validate email address
        if (empty($contact['email']) || !is_email($contact['email'])) {
            return new WP_Error('invalid_email', __('Contact does not have a valid email address.', 'helpmate-ai-chatbot'));
        }

        // Get template content if template_id is provided and subject/body are empty
        // If user has edited the subject/body, use their version instead
        $raw_subject = $subject;
        $raw_body = $body;
        if ($template_id) {
            $template = $this->get_email_template($template_id);
            if ($template) {
                // Only use template content if provided content is empty
                if (empty($subject)) {
                    $raw_subject = $template['subject'];
                }
                if (empty($body)) {
                    $raw_body = $template['body'];
                }
            }
        }

        // Validate variables before replacement - check for unavailable variables
        $unreplaceable = $this->get_unreplaceable_variables($raw_subject, $raw_body, $contact_id);
        if (!empty($unreplaceable)) {
            $vars_list = implode(', ', array_map(function ($var) {
                return '{' . $var . '}';
            }, $unreplaceable));

            $error_message = sprintf(
                /* translators: %s: List of variable names that cannot be replaced */
                __('Cannot send email - the following variables are not available in this context: %s. These variables are only available for Smart Schedule emails.', 'helpmate-ai-chatbot'),
                $vars_list
            );

            // Store failed email record
            $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
            $wpdb->insert(
                $emails_table,
                [
                    'contact_id' => $contact_id,
                    'template_id' => $template_id,
                    'subject' => $raw_subject,
                    'body' => $raw_body,
                    'sent_by' => $user_id,
                    'sent_at' => current_time('mysql'),
                    'status' => 'failed',
                    'error_message' => $error_message,
                    'campaign_id' => $campaign_id,
                    'recurring_campaign_id' => $recurring_campaign_id,
                    'sequence_id' => $sequence_id,
                    'sequence_step_id' => $sequence_step_id,
                ],
                ['%d', '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%d', '%d', '%d', '%d']
            );

            return new WP_Error('unreplaceable_variables', $error_message);
        }

        // Validate variables have non-empty values
        $empty_variables = $this->get_empty_variables($raw_subject, $raw_body, $contact);
        if (!empty($empty_variables)) {
            $vars_list = implode(', ', array_map(function ($var) {
                return '{' . $var . '}';
            }, $empty_variables));

            $error_message = sprintf(
                /* translators: %s: List of variable names that have empty values */
                __('Cannot send email - the following variables have empty values for this contact: %s. Please update the contact information or use a different template.', 'helpmate-ai-chatbot'),
                $vars_list
            );

            // Store failed email record
            $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
            $wpdb->insert(
                $emails_table,
                [
                    'contact_id' => $contact_id,
                    'template_id' => $template_id,
                    'subject' => $raw_subject,
                    'body' => $raw_body,
                    'sent_by' => $user_id,
                    'sent_at' => current_time('mysql'),
                    'status' => 'failed',
                    'error_message' => $error_message,
                    'campaign_id' => $campaign_id,
                    'recurring_campaign_id' => $recurring_campaign_id,
                    'sequence_id' => $sequence_id,
                    'sequence_step_id' => $sequence_step_id,
                ],
                ['%d', '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%d', '%d', '%d', '%d']
            );

            return new WP_Error('empty_variables', $error_message);
        }

        // Replace variables in content
        $subject = $this->replace_email_variables($raw_subject, $contact);
        $body = $this->replace_email_variables($raw_body, $contact);

        // Store in email history first to get email_id for tracking
        $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $email_inserted = $wpdb->insert(
            $emails_table,
            [
                'contact_id' => $contact_id,
                'template_id' => $template_id,
                'subject' => $subject,
                'body' => $body, // Will update with tracking after
                'sent_by' => $user_id,
                'sent_at' => current_time('mysql'),
                'status' => 'pending',
                'error_message' => null,
                'campaign_id' => $campaign_id,
                'recurring_campaign_id' => $recurring_campaign_id,
                'sequence_id' => $sequence_id,
                'sequence_step_id' => $sequence_step_id,
            ],
            ['%d', '%d', '%s', '%s', '%d', '%s', '%s', '%s', '%d', '%d', '%d', '%d']
        );

        if (!$email_inserted) {
            return false;
        }

        $email_id = $wpdb->insert_id;

        // Add unsubscribe link to body
        $unsubscribe_url = home_url('/helpmate-unsubscribe/?email_id=' . $email_id . '&contact_id=' . $contact_id);

        // Add unsubscribe link at the bottom
        $unsubscribe_link = '<p style="font-size: 12px; color: #999; margin-top: 20px;"><a href="' . esc_url($unsubscribe_url) . '" style="color: #999;">Unsubscribe</a></p>';

        // Append unsubscribe to body
        $body_with_unsubscribe = $body . $unsubscribe_link;

        // Update email body with unsubscribe link
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $wpdb->update(
            $emails_table,
            ['body' => $body_with_unsubscribe],
            ['id' => $email_id],
            ['%s'],
            ['%d']
        );

        // Send email
        $headers = ['Content-Type: text/html; charset=UTF-8'];
        $to = $contact['email'];
        $mail_error_message = null;

        try {
            $mail_sent = wp_mail($to, $subject, $body_with_unsubscribe, $headers);
            if (!$mail_sent) {
                global $phpmailer;
                if (isset($phpmailer) && is_object($phpmailer) && !empty($phpmailer->ErrorInfo)) {
                    $mail_error_message = $phpmailer->ErrorInfo;
                } else {
                    $mail_error_message = __('Email sending failed', 'helpmate-ai-chatbot');
                }
            }
        } catch (Exception $e) {
            $mail_sent = false;
            $mail_error_message = $e->getMessage();
        }

        // Update email status
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $wpdb->update(
            $emails_table,
            [
                'status' => $mail_sent ? 'sent' : 'failed',
                'error_message' => $mail_sent ? null : ($mail_error_message ?: __('Email sending failed', 'helpmate-ai-chatbot')),
            ],
            ['id' => $email_id],
            ['%s', '%s'],
            ['%d']
        );

        // Create tracking record
        if ($mail_sent) {
            $tracking_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
            $wpdb->insert(
                $tracking_table,
                [
                    'email_id' => $email_id,
                    'campaign_id' => $campaign_id,
                    'recurring_campaign_id' => $recurring_campaign_id,
                    'sequence_id' => $sequence_id,
                    'sequence_step_id' => $sequence_step_id,
                    'contact_id' => $contact_id,
                    'created_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql'),
                ],
                ['%d', '%d', '%d', '%d', '%d', '%d', '%s', '%s']
            );
        }

        return $mail_sent;
    }

    /**
     * Get email history for a contact.
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @param    int    $page          Page number.
     * @param    int    $per_page      Items per page.
     * @return   array                 Array with emails and pagination data.
     */
    public function get_contact_emails(int $contact_id, int $page = 1, int $per_page = 50): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
        $offset = ($page - 1) * $per_page;

        // Get total count
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for email count; caching not appropriate for frequently changing data
        $total = $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COUNT(*) FROM {$table} WHERE contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $contact_id
            )
        );

        // Get emails
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for emails listing; caching not appropriate for frequently changing data
        $emails = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT e.*, u.display_name as sent_by_name
                FROM {$table} e
                LEFT JOIN {$wpdb->users} u ON e.sent_by = u.ID
                WHERE e.contact_id = %d
                ORDER BY e.sent_at DESC
                LIMIT %d OFFSET %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $contact_id,
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        foreach ($emails as &$email) {
            $email['id'] = (int) $email['id'];
            $email['contact_id'] = (int) $email['contact_id'];
            $email['template_id'] = !empty($email['template_id']) ? (int) $email['template_id'] : null;
            $email['sent_by'] = (int) $email['sent_by'];
        }

        return [
            'emails' => $emails,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => (int) $total,
                'total_pages' => (int) ceil($total / $per_page),
            ],
        ];
    }

    // ============================================================================
    // SEGMENTS METHODS
    // ============================================================================

    /**
     * Create a new segment.
     *
     * @since    1.3.0
     * @param    array    $data    Segment data (name, conditions).
     * @return   int|false          Segment ID on success, false on failure.
     */
    public function create_segment(array $data)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_segments');

        $conditions_json = json_encode($data['conditions'] ?? []);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->insert(
            $table,
            [
                'name' => $data['name'],
                'conditions' => $conditions_json,
                'contact_count' => 0,
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql'),
            ],
            ['%s', '%s', '%d', '%s', '%s']
        );

        if ($result === false) {
            return false;
        }

        $segment_id = $wpdb->insert_id;
        $this->calculate_segment_count($segment_id);

        return $segment_id;
    }

    /**
     * Update a segment.
     *
     * @since    1.3.0
     * @param    int      $segment_id    The segment ID.
     * @param    array    $data          Segment data to update.
     * @return   bool                    True on success, false on failure.
     */
    public function update_segment(int $segment_id, array $data): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_segments');

        $update_data = ['updated_at' => current_time('mysql')];
        $format = ['%s'];

        if (isset($data['name'])) {
            $update_data['name'] = $data['name'];
            $format[] = '%s';
        }

        if (isset($data['conditions'])) {
            $update_data['conditions'] = json_encode($data['conditions']);
            $format[] = '%s';
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->update(
            $table,
            $update_data,
            ['id' => $segment_id],
            $format,
            ['%d']
        );

        if ($result !== false && isset($data['conditions'])) {
            $this->calculate_segment_count($segment_id);
        }

        return $result !== false;
    }

    /**
     * Delete a segment.
     *
     * @since    1.3.0
     * @param    int    $segment_id    The segment ID.
     * @return   bool                  True on success, false on failure.
     */
    public function delete_segment(int $segment_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_segments');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->delete($table, ['id' => $segment_id], ['%d']);

        return $result !== false;
    }

    /**
     * Get all segments.
     *
     * @since    1.3.0
     * @return   array    Array of segments.
     */
    public function get_segments(): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_segments');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $segments = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT * FROM {$table} ORDER BY created_at DESC",
            ARRAY_A
        );

        foreach ($segments as &$segment) {
            $segment['id'] = (int) $segment['id'];
            $segment['contact_count'] = (int) $segment['contact_count'];
            $segment['conditions'] = json_decode($segment['conditions'], true) ?: [];
        }

        return $segments;
    }

    /**
     * Get a single segment by ID.
     *
     * @since    1.3.0
     * @param    int    $segment_id    The segment ID.
     * @return   array|null            The segment data or null if not found.
     */
    public function get_segment(int $segment_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_segments');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $segment = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $segment_id
            ),
            ARRAY_A
        );

        if (!$segment) {
            return null;
        }

        $segment['id'] = (int) $segment['id'];
        $segment['contact_count'] = (int) $segment['contact_count'];
        $segment['conditions'] = json_decode($segment['conditions'], true) ?: [];

        return $segment;
    }

    /**
     * Get contacts matching a segment.
     *
     * @since    1.3.0
     * @param    int    $segment_id    The segment ID.
     * @param    int    $page          Page number.
     * @param    int    $per_page      Items per page.
     * @return   array                 Array with contacts and pagination data.
     */
    public function get_segment_contacts(int $segment_id, int $page = 1, int $per_page = 20): array
    {
        $segment = $this->get_segment($segment_id);
        if (!$segment) {
            return ['contacts' => [], 'pagination' => ['page' => $page, 'per_page' => $per_page, 'total' => 0, 'total_pages' => 0]];
        }

        $conditions = $segment['conditions'];
        $where_clause = $this->build_segment_query($conditions);

        return $this->get_contacts_by_query($where_clause['where'], $where_clause['params'], $page, $per_page);
    }

    /**
     * Calculate and cache segment contact count.
     *
     * @since    1.3.0
     * @param    int    $segment_id    The segment ID.
     * @return   int                   The contact count.
     */
    public function calculate_segment_count(int $segment_id): int
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_segments');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        $segment = $this->get_segment($segment_id);
        if (!$segment) {
            return 0;
        }

        $conditions = $segment['conditions'];
        $where_clause = $this->build_segment_query($conditions);

        $count_query = sprintf("SELECT COUNT(*) FROM %s c WHERE %s", $contacts_table, $where_clause['where']);
        if (!empty($where_clause['params'])) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            $count_query = $wpdb->prepare($count_query, ...$where_clause['params']);
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built by build_segment_query() with safe placeholders and prepared with wpdb->prepare(); direct query necessary; caching not appropriate
        $count = (int) $wpdb->get_var($count_query);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $wpdb->update(
            $table,
            ['contact_count' => $count, 'updated_at' => current_time('mysql')],
            ['id' => $segment_id],
            ['%d', '%s'],
            ['%d']
        );

        return $count;
    }

    /**
     * Build SQL WHERE clause from segment conditions.
     *
     * @since    1.3.0
     * @param    array    $conditions    Segment conditions structure.
     * @return   array                   Array with 'where' clause and 'params' array.
     */
    public function build_segment_query(array $conditions): array
    {
        global $wpdb;
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        $where_parts = [];
        $params = [];

        // Always exclude unsubscribed contacts
        $where_parts[] = "c.status != 'unsubscribed'";

        if (empty($conditions) || empty($conditions['groups'])) {
            return ['where' => implode(' AND ', $where_parts), 'params' => $params];
        }

        $top_level_logic = $conditions['logic'] ?? 'AND';
        $groups = $conditions['groups'] ?? [];

        $group_conditions = [];

        foreach ($groups as $group) {
            $group_logic = $group['logic'] ?? 'AND';
            $group_conditions_parts = [];

            foreach ($group['conditions'] ?? [] as $condition) {
                $field = $condition['field'] ?? '';
                $operator = $condition['operator'] ?? 'equals';
                $value = $condition['value'] ?? '';

                $condition_sql = $this->build_condition_sql($field, $operator, $value, $params);
                if ($condition_sql) {
                    $group_conditions_parts[] = $condition_sql;
                }
            }

            if (!empty($group_conditions_parts)) {
                $group_condition = '(' . implode(' ' . $group_logic . ' ', $group_conditions_parts) . ')';
                $group_conditions[] = $group_condition;
            }
        }

        if (!empty($group_conditions)) {
            $where_parts[] = '(' . implode(' ' . $top_level_logic . ' ', $group_conditions) . ')';
        }

        return ['where' => implode(' AND ', $where_parts), 'params' => $params];
    }

    /**
     * Build SQL condition for a single field/operator/value.
     *
     * @since    1.3.0
     * @param    string    $field      Field name.
     * @param    string    $operator   Operator (equals, contains, etc.).
     * @param    mixed     $value      Value to compare.
     * @param    array     &$params    Reference to params array (will be modified).
     * @return   string|null           SQL condition or null if invalid.
     */
    private function build_condition_sql(string $field, string $operator, $value, array &$params): ?string
    {
        global $wpdb;
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // Check if it's a standard contact field
        $standard_fields = ['first_name', 'last_name', 'email', 'phone', 'city', 'state', 'country', 'zip_code', 'status', 'date_of_birth'];
        $is_standard_field = in_array($field, $standard_fields);

        if ($is_standard_field) {
            $field_ref = 'c.' . $field;
        } else {
            // Custom field - need to join
            $field_ref = "fv.field_value";
            // We'll handle this in a subquery
        }

        switch ($operator) {
            case 'equals':
                if ($is_standard_field) {
                    $params[] = $value;
                    return "{$field_ref} = %s";
                } else {
                    // Custom field
                    $params[] = $field;
                    $params[] = $value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND fv.field_value = %s)";
                }

            case 'not_equals':
                if ($is_standard_field) {
                    $params[] = $value;
                    return "{$field_ref} != %s";
                } else {
                    $params[] = $field;
                    $params[] = $value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "NOT EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND fv.field_value = %s)";
                }

            case 'contains':
                $search_value = '%' . $wpdb->esc_like($value) . '%';
                if ($is_standard_field) {
                    $params[] = $search_value;
                    return "{$field_ref} LIKE %s";
                } else {
                    $params[] = $field;
                    $params[] = $search_value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND fv.field_value LIKE %s)";
                }

            case 'not_contains':
                $search_value = '%' . $wpdb->esc_like($value) . '%';
                if ($is_standard_field) {
                    $params[] = $search_value;
                    return "{$field_ref} NOT LIKE %s";
                } else {
                    $params[] = $field;
                    $params[] = $search_value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "NOT EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND fv.field_value LIKE %s)";
                }

            case 'starts_with':
                $search_value = $wpdb->esc_like($value) . '%';
                if ($is_standard_field) {
                    $params[] = $search_value;
                    return "{$field_ref} LIKE %s";
                } else {
                    $params[] = $field;
                    $params[] = $search_value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND fv.field_value LIKE %s)";
                }

            case 'ends_with':
                $search_value = '%' . $wpdb->esc_like($value);
                if ($is_standard_field) {
                    $params[] = $search_value;
                    return "{$field_ref} LIKE %s";
                } else {
                    $params[] = $field;
                    $params[] = $search_value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND fv.field_value LIKE %s)";
                }

            case 'greater_than':
                if ($is_standard_field) {
                    $params[] = $value;
                    return "{$field_ref} > %s";
                } else {
                    $params[] = $field;
                    $params[] = $value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND CAST(fv.field_value AS SIGNED) > %d)";
                }

            case 'less_than':
                if ($is_standard_field) {
                    $params[] = $value;
                    return "{$field_ref} < %s";
                } else {
                    $params[] = $field;
                    $params[] = $value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND CAST(fv.field_value AS SIGNED) < %d)";
                }

            case 'greater_equal':
                if ($is_standard_field) {
                    $params[] = $value;
                    return "{$field_ref} >= %s";
                } else {
                    $params[] = $field;
                    $params[] = $value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND CAST(fv.field_value AS SIGNED) >= %d)";
                }

            case 'less_equal':
                if ($is_standard_field) {
                    $params[] = $value;
                    return "{$field_ref} <= %s";
                } else {
                    $params[] = $field;
                    $params[] = $value;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND CAST(fv.field_value AS SIGNED) <= %d)";
                }

            case 'is_empty':
                if ($is_standard_field) {
                    return "({$field_ref} IS NULL OR {$field_ref} = '')";
                } else {
                    $params[] = $field;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "NOT EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s)";
                }

            case 'is_not_empty':
                if ($is_standard_field) {
                    return "({$field_ref} IS NOT NULL AND {$field_ref} != '')";
                } else {
                    $params[] = $field;
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix; query will be prepared later
                    return "EXISTS (SELECT 1 FROM {$field_values_table} fv
                        INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                        WHERE fv.contact_id = c.id AND cf.field_name = %s AND fv.field_value IS NOT NULL AND fv.field_value != '')";
                }

            default:
                return null;
        }
    }

    /**
     * Get contacts by custom query (helper for segments).
     *
     * @since    1.3.0
     * @param    string    $where_clause    WHERE clause.
     * @param    array     $params          Query parameters.
     * @param    int       $page            Page number.
     * @param    int       $per_page        Items per page.
     * @return   array                      Array with contacts and pagination.
     */
    private function get_contacts_by_query(string $where_clause, array $params, int $page = 1, int $per_page = 20): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $offset = ($page - 1) * $per_page;

        // Get total count
        $count_query = sprintf("SELECT COUNT(*) FROM %s c WHERE %s", $table, $where_clause);
        if (!empty($params)) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            $count_query = $wpdb->prepare($count_query, ...$params);
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause passed from build_segment_query() with safe placeholders and prepared with wpdb->prepare(); direct query necessary; caching not appropriate
        $total = (int) $wpdb->get_var($count_query);

        // Get contacts
        $query = sprintf("SELECT c.* FROM %s c WHERE %s ORDER BY c.created_at DESC LIMIT %%d OFFSET %%d", $table, $where_clause);
        $query_params = array_merge($params, [$per_page, $offset]);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause passed from build_segment_query() with safe placeholders and prepared with wpdb->prepare(); direct query necessary; caching not appropriate
        $contacts = $wpdb->get_results(
            $wpdb->prepare($query, ...$query_params), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            ARRAY_A
        );

        // Get custom field values for each contact
        foreach ($contacts as &$contact) {
            if (isset($contact['wp_user_id'])) {
                $contact['wp_user_id'] = !empty($contact['wp_user_id']) ? (int) $contact['wp_user_id'] : null;
            }
            $contact['custom_fields'] = $this->get_contact_custom_field_values($contact['id']);
        }

        return [
            'contacts' => $contacts,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Refresh segment count manually.
     *
     * @since    1.3.0
     * @param    int    $segment_id    The segment ID.
     * @return   int                   The updated contact count.
     */
    public function refresh_segment_count(int $segment_id): int
    {
        return $this->calculate_segment_count($segment_id);
    }

    /**
     * Schedule segment count refresh for all segments (async).
     * Note: The cron hook is registered in pro plugin, but we can still schedule the event here.
     *
     * @since    1.3.0
     */
    private function schedule_segment_count_refresh()
    {
        // Schedule a single event to refresh all segments (debounced)
        // The cron hook is registered in pro plugin
        if (!wp_next_scheduled('helpmate_refresh_segment_counts')) {
            wp_schedule_single_event(time() + 30, 'helpmate_refresh_segment_counts');
        }
    }

    /**
     * Refresh all segment counts (called by cron).
     *
     * @since    1.3.0
     */
    public function refresh_all_segment_counts()
    {
        $segments = $this->get_segments();
        foreach ($segments as $segment) {
            $this->calculate_segment_count($segment['id']);
        }
    }

    // ============================================================================
    // CAMPAIGNS METHODS
    // ============================================================================

    /**
     * Create a new campaign.
     *
     * @since    1.3.0
     * @param    array    $data    Campaign data.
     * @return   int|false          Campaign ID on success, false on failure.
     */
    public function create_campaign(array $data)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');

        // Calculate total_contacts from segment if provided
        $total_contacts = 0;
        if (!empty($data['segment_id'])) {
            $segment = $this->get_segment($data['segment_id']);
            if ($segment) {
                $total_contacts = $segment['contact_count'];
            }
        }

        // Before setting status, check if scheduled_at is set
        $status = $data['status'] ?? 'draft';
        $type = $data['type'] ?? 'one_time';

        // Normalize scheduled_at datetime format (convert from datetime-local format "T" to MySQL format " ")
        // Frontend now converts browser local time to WordPress site timezone before sending
        $scheduled_at = null;
        if (!empty($data['scheduled_at'])) {
            // Convert "2026-01-18T12:29:00" to "2026-01-18 12:29:00" for MySQL
            $scheduled_at = str_replace('T', ' ', trim($data['scheduled_at']));
            // The datetime is now in WordPress site timezone (converted by frontend)
            // get_gmt_from_date() will convert it from site timezone to GMT for cron scheduling
        }

        if ($type === 'one_time' && !empty($scheduled_at) && $status === 'draft') {
            $status = 'scheduled';
        }

        // Calculate next_run_at for recurring campaigns
        $next_run_at = null;
        if ($type === 'recurring' && !empty($data['interval_value']) && !empty($data['interval_unit'])) {
            $interval = $data['interval_value'];
            $unit = $data['interval_unit'];
            $next_run_at = gmdate('Y-m-d H:i:s', strtotime("+{$interval} {$unit}"));
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->insert(
            $table,
            [
                'name' => $data['name'],
                'template_id' => $data['template_id'],
                'segment_id' => $data['segment_id'] ?? null,
                'subject_override' => $data['subject_override'] ?? null,
                'body_override' => $data['body_override'] ?? null,
                'type' => $type,
                'status' => $status,
                'scheduled_at' => $scheduled_at,
                'total_contacts' => $total_contacts,
                'sent_count' => 0,
                'failed_count' => 0,
                'recurring_campaign_id' => $data['recurring_campaign_id'] ?? null,
                'interval_value' => $data['interval_value'] ?? null,
                'interval_unit' => $data['interval_unit'] ?? null,
                'send_time' => $data['send_time'] ?? null,
                'next_run_at' => $next_run_at,
                'last_run_at' => null,
                'is_active' => $data['is_active'] ?? 1,
                'created_by' => $data['created_by'] ?? get_current_user_id(),
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql'),
            ],
            ['%s', '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s']
        );

        if ($result === false) {
            return false;
        }

        $campaign_id = $wpdb->insert_id;

        // Schedule cron job if campaign is scheduled for future
        // schedule_scheduled_campaign_cron() will handle timezone conversion and time checking
        if ($type === 'one_time' && !empty($scheduled_at)) {
            $this->schedule_scheduled_campaign_cron($campaign_id);
        }

        return $campaign_id;
    }

    /**
     * Update a campaign.
     *
     * @since    1.3.0
     * @param    int      $campaign_id    The campaign ID.
     * @param    array    $data           Campaign data to update.
     * @return   bool                     True on success, false on failure.
     */
    public function update_campaign(int $campaign_id, array $data): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');

        $update_data = ['updated_at' => current_time('mysql')];
        $format = ['%s'];

        // If segment_id is being updated, recalculate total_contacts
        if (isset($data['segment_id']) && !empty($data['segment_id'])) {
            $segment = $this->get_segment($data['segment_id']);
            if ($segment) {
                $data['total_contacts'] = $segment['contact_count'];
            }
        }

        // If scheduled_at is being set/updated and status is draft, set to scheduled
        if (isset($data['scheduled_at']) && !empty($data['scheduled_at'])) {
            // Normalize scheduled_at datetime format (convert from datetime-local format "T" to MySQL format " ")
            $data['scheduled_at'] = str_replace('T', ' ', trim($data['scheduled_at']));

            // Get current status directly from database to avoid modified status from get_campaign
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $current_status = $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT status FROM {$table} WHERE id = %d"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $campaign_id
                )
            );
            if ($current_status === 'draft') {
                $data['status'] = 'scheduled';
            }
        }

        // Handle next_run_at calculation for recurring campaigns
        if (isset($data['type']) && $data['type'] === 'recurring') {
            if (isset($data['interval_value']) && isset($data['interval_unit'])) {
                $interval = $data['interval_value'];
                $unit = $data['interval_unit'];
                $data['next_run_at'] = gmdate('Y-m-d H:i:s', strtotime("+{$interval} {$unit}"));
            }
        }

        $allowed_fields = ['name', 'template_id', 'segment_id', 'subject_override', 'body_override', 'type', 'status', 'scheduled_at', 'total_contacts', 'sent_count', 'failed_count', 'recurring_campaign_id', 'interval_value', 'interval_unit', 'send_time', 'next_run_at', 'last_run_at', 'is_active'];
        foreach ($allowed_fields as $field) {
            if (isset($data[$field])) {
                $update_data[$field] = $data[$field];
                if (in_array($field, ['template_id', 'segment_id', 'total_contacts', 'sent_count', 'failed_count', 'interval_value', 'is_active'])) {
                    $format[] = '%d';
                } else {
                    $format[] = '%s';
                }
            }
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->update(
            $table,
            $update_data,
            ['id' => $campaign_id],
            $format,
            ['%d']
        );

        if ($result !== false) {
            // Handle cron job scheduling for scheduled campaigns
            if (isset($data['scheduled_at']) || isset($data['type']) || isset($data['status'])) {
                $this->schedule_scheduled_campaign_cron($campaign_id);
            }
        }

        return $result !== false;
    }

    /**
     * Delete a campaign.
     *
     * @since    1.3.0
     * @param    int    $campaign_id    The campaign ID.
     * @return   bool                  True on success, false on failure.
     */
    public function delete_campaign(int $campaign_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->delete($table, ['id' => $campaign_id], ['%d']);

        return $result !== false;
    }

    /**
     * Get campaigns with filters and pagination.
     *
     * @since    1.3.0
     * @param    array    $filters    Filter options.
     * @param    int      $page       Page number.
     * @param    int      $per_page   Items per page.
     * @return   array                Array with campaigns and pagination.
     */
    public function get_campaigns(array $filters = [], int $page = 1, int $per_page = 20): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');
        $offset = ($page - 1) * $per_page;

        $where = ['1=1'];
        $params = [];

        // Exclude recurring campaign instances by default (unless explicitly included)
        if (!isset($filters['include_recurring']) || !$filters['include_recurring']) {
            $where[] = 'recurring_campaign_id IS NULL';
        }

        if (!empty($filters['status'])) {
            $where[] = 'status = %s';
            $params[] = $filters['status'];
        }

        if (!empty($filters['type'])) {
            $where[] = 'type = %s';
            $params[] = $filters['type'];
        }

        if (!empty($filters['created_by'])) {
            $where[] = 'created_by = %d';
            $params[] = $filters['created_by'];
        }

        $where_clause = implode(' AND ', $where);

        // Get total count
        $count_query = sprintf("SELECT COUNT(*) FROM %s WHERE %s", $table, $where_clause);
        if (!empty($params)) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            $count_query = $wpdb->prepare($count_query, ...$params);
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built with safe placeholders and prepared with wpdb->prepare(); direct query necessary; caching not appropriate
        $total = (int) $wpdb->get_var($count_query);

        // Get campaigns
        $query = sprintf("SELECT * FROM %s WHERE %s ORDER BY created_at DESC LIMIT %%d OFFSET %%d", $table, $where_clause);
        $query_params = array_merge($params, [$per_page, $offset]);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built with safe placeholders and prepared with wpdb->prepare(); direct query necessary; caching not appropriate
        $campaigns = $wpdb->get_results(
            $wpdb->prepare($query, ...$query_params), // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            ARRAY_A
        );

        foreach ($campaigns as &$campaign) {
            $campaign['id'] = (int) $campaign['id'];
            $campaign['template_id'] = (int) $campaign['template_id'];
            $campaign['segment_id'] = !empty($campaign['segment_id']) ? (int) $campaign['segment_id'] : null;
            $campaign['total_contacts'] = (int) $campaign['total_contacts'];
            $campaign['sent_count'] = (int) $campaign['sent_count'];
            $campaign['failed_count'] = (int) $campaign['failed_count'];
            $campaign['recurring_campaign_id'] = !empty($campaign['recurring_campaign_id']) ? (int) $campaign['recurring_campaign_id'] : null;
            $campaign['interval_value'] = !empty($campaign['interval_value']) ? (int) $campaign['interval_value'] : null;
            $campaign['is_active'] = isset($campaign['is_active']) ? (int) $campaign['is_active'] : 1;
            $campaign['created_by'] = (int) $campaign['created_by'];
            // Ensure status is correct based on scheduled_at
            if (!empty($campaign['scheduled_at']) && $campaign['status'] === 'draft') {
                $campaign['status'] = 'scheduled';
            }
        }

        return [
            'campaigns' => $campaigns,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Get a single campaign by ID.
     *
     * @since    1.3.0
     * @param    int    $campaign_id    The campaign ID.
     * @return   array|null             The campaign data or null if not found.
     */
    public function get_campaign(int $campaign_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $campaign = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $campaign_id
            ),
            ARRAY_A
        );

        if (!$campaign) {
            return null;
        }

        $campaign['id'] = (int) $campaign['id'];
        $campaign['template_id'] = (int) $campaign['template_id'];
        $campaign['segment_id'] = !empty($campaign['segment_id']) ? (int) $campaign['segment_id'] : null;
        $campaign['total_contacts'] = (int) $campaign['total_contacts'];
        $campaign['sent_count'] = (int) $campaign['sent_count'];
        $campaign['failed_count'] = (int) $campaign['failed_count'];
        $campaign['recurring_campaign_id'] = !empty($campaign['recurring_campaign_id']) ? (int) $campaign['recurring_campaign_id'] : null;
        $campaign['created_by'] = (int) $campaign['created_by'];

        // Ensure status is correct based on scheduled_at
        if (!empty($campaign['scheduled_at']) && $campaign['status'] === 'draft') {
            $campaign['status'] = 'scheduled';
        }

        return $campaign;
    }

    /**
     * Schedule campaign sending via background processor.
     *
     * @since    1.3.0
     * @param    int    $campaign_id    The campaign ID.
     * @return   string|false           Job ID on success, false on failure.
     */
    public function send_campaign(int $campaign_id)
    {
        $campaign = $this->get_campaign($campaign_id);
        if (!$campaign) {
            return false;
        }

        // Check if scheduled for future
        if (!empty($campaign['scheduled_at'])) {
            $scheduled_time = strtotime($campaign['scheduled_at']);
            if ($scheduled_time > time()) {
                // Update status to scheduled
                $this->update_campaign($campaign_id, ['status' => 'scheduled']);
                return 'scheduled';
            }
        }

        // Get contacts from segment
        $contact_ids = [];
        if (!empty($campaign['segment_id'])) {
            $segment_contacts = $this->get_segment_contacts($campaign['segment_id'], 1, 10000);
            $contact_ids = array_column($segment_contacts['contacts'], 'id');
        }

        if (empty($contact_ids)) {
            return false;
        }

        // Recalculate total_contacts from segment (in case segment was updated)
        $segment = $this->get_segment($campaign['segment_id']);
        $total_contacts = $segment ? $segment['contact_count'] : count($contact_ids);

        // Update campaign status and total contacts
        $this->update_campaign($campaign_id, [
            'status' => 'sending',
            'total_contacts' => $total_contacts
        ]);

        // For immediate sends (no scheduled_at), process synchronously
        if (empty($campaign['scheduled_at'])) {
            // Increase execution time for immediate email processing
            // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- Necessary for synchronous email sending
            @set_time_limit(300); // 5 minutes

            try {
                $result = $this->process_campaign_emails($campaign_id, $contact_ids);
                if ($result && isset($result['sent']) && $result['sent'] > 0) {
                    return 'sent';
                }
                // If processing failed, fall through to background processor
            } catch (Exception $e) {
                // Log error and fall through to background processor
                // error_log('Helpmate: Immediate campaign send failed: ' . $e->getMessage());
            }
        }

        // For scheduled sends or if immediate send failed, use background processor
        $processor = null;

        // Check if pro plugin is active and has the processor
        if (class_exists('Helpmate_Pro') && isset($GLOBALS['helpmate_pro'])) {
            $helpmate_pro = $GLOBALS['helpmate_pro'];
            if (method_exists($helpmate_pro, 'get_email_campaign_processor')) {
                $processor = $helpmate_pro->get_email_campaign_processor();
            }
        }

        // Fallback: try to get from free plugin (for backwards compatibility during migration)
        if (!$processor && method_exists($this->helpmate, 'get_email_campaign_processor')) {
            $processor = $this->helpmate->get_email_campaign_processor();
        }

        if ($processor) {
            return $processor->schedule_campaign_sending($campaign_id, $contact_ids, $campaign['created_by']);
        }

        return false;
    }

    /**
     * Schedule campaign for future sending.
     *
     * @since    1.3.0
     * @param    int       $campaign_id    The campaign ID.
     * @param    string    $scheduled_at   Scheduled datetime.
     * @return   bool                      True on success, false on failure.
     */
    public function schedule_campaign(int $campaign_id, string $scheduled_at): bool
    {
        return $this->update_campaign($campaign_id, [
            'status' => 'scheduled',
            'scheduled_at' => $scheduled_at
        ]);
    }

    /**
     * Handle scheduled campaign send (called by cron).
     *
     * @since    1.3.0
     * @param    int|array    $campaign_id_or_args    Campaign ID or array with campaign_id.
     * @return   void
     */
    public function handle_scheduled_campaign_send($campaign_id_or_args)
    {
        $campaign_id = is_array($campaign_id_or_args) ? ($campaign_id_or_args['campaign_id'] ?? 0) : (int) $campaign_id_or_args;

        if (!$campaign_id) {
            return;
        }

        $campaign = $this->get_campaign($campaign_id);
        if (!$campaign) {
            return;
        }

        // Only send if still scheduled and scheduled_at has passed
        if ($campaign['status'] === 'scheduled' && !empty($campaign['scheduled_at'])) {
            // Convert scheduled_at from site timezone to GMT Unix timestamp for comparison
            $scheduled_datetime = $campaign['scheduled_at'];

            // Use WordPress function to convert from site timezone to GMT
            $gmt_datetime = get_gmt_from_date($scheduled_datetime, 'Y-m-d H:i:s');

            // Convert GMT datetime string to Unix timestamp
            $datetime = DateTime::createFromFormat('Y-m-d H:i:s', $gmt_datetime, new DateTimeZone('UTC'));

            if ($datetime === false) {
                return; // Invalid date format
            }

            $scheduled_time = $datetime->getTimestamp();

            // Compare with current GMT time
            $current_gmt_time = time(); // time() returns GMT/UTC timestamp
            if ($scheduled_time <= $current_gmt_time) {
                $this->send_campaign($campaign_id);
            }
        }
    }

    /**
     * Schedule or unschedule cron job for a scheduled campaign.
     *
     * @since    1.3.0
     * @param    int    $campaign_id    The campaign ID.
     * @return   void
     */
    private function schedule_scheduled_campaign_cron(int $campaign_id)
    {
        $campaign = $this->get_campaign($campaign_id);
        if (!$campaign) {
            return;
        }

        // Unschedule existing cron job for this campaign
        $args = ['campaign_id' => $campaign_id];
        $existing_timestamp = wp_next_scheduled('helpmate_send_scheduled_campaign', $args);
        if ($existing_timestamp) {
            wp_unschedule_event($existing_timestamp, 'helpmate_send_scheduled_campaign', $args);
        }

        // Schedule new cron job if scheduled_at is in the future
        if (!empty($campaign['scheduled_at']) && $campaign['type'] === 'one_time' && $campaign['status'] === 'scheduled') {
            // Convert scheduled_at from site timezone to GMT Unix timestamp
            // scheduled_at is stored in MySQL datetime format (assumed to be in site timezone)
            $scheduled_datetime = $campaign['scheduled_at'];

            // Use WordPress function to convert from site timezone to GMT
            // get_gmt_from_date() expects date in site timezone and returns GMT
            $gmt_datetime = get_gmt_from_date($scheduled_datetime, 'Y-m-d H:i:s');

            // Convert GMT datetime string to Unix timestamp
            // Parse as UTC since get_gmt_from_date returns UTC
            $datetime = DateTime::createFromFormat('Y-m-d H:i:s', $gmt_datetime, new DateTimeZone('UTC'));

            if ($datetime === false) {
                return; // Invalid date format
            }

            $scheduled_time = $datetime->getTimestamp();

            // Only schedule if it's in the future
            $current_gmt_time = time(); // time() returns GMT/UTC timestamp
            if ($scheduled_time > $current_gmt_time) {
                wp_schedule_single_event($scheduled_time, 'helpmate_send_scheduled_campaign', $args);
            }
        }
    }

    /**
     * Get campaign statistics.
     *
     * @since    1.3.0
     * @param    int    $campaign_id    The campaign ID.
     * @return   array                  Campaign statistics.
     */
    public function get_campaign_stats(int $campaign_id): array
    {
        global $wpdb;
        $tracking_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');
        $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');

        $campaign = $this->get_campaign($campaign_id);
        if (!$campaign) {
            return [];
        }

        // Get email IDs for this campaign
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $email_ids = $wpdb->get_col(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "SELECT id FROM {$emails_table} WHERE contact_id IN (
                    SELECT contact_id FROM {$tracking_table} WHERE campaign_id = %d
                )"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $campaign_id
            )
        );

        if (empty($email_ids)) {
            return [
                'total_sent' => $campaign['sent_count'],
                'total_failed' => $campaign['failed_count'],
                'total_bounced' => 0,
                'total_unsubscribed' => 0,
                'bounce_rate' => 0
            ];
        }

        $email_ids_placeholders = implode(',', array_fill(0, count($email_ids), '%d'));
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Table name is safe, uses wpdb->prefix; placeholders are dynamically generated
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $tracking_stats = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT
                    COUNT(*) as total_tracked,
                    SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as total_bounced,
                    SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as total_unsubscribed
                FROM {$tracking_table}
                WHERE email_id IN ($email_ids_placeholders)",
                ...$email_ids
            ),
            ARRAY_A
        );
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

        $total_sent = $campaign['sent_count'];
        $total_bounced = (int) ($tracking_stats['total_bounced'] ?? 0);
        $total_unsubscribed = (int) ($tracking_stats['total_unsubscribed'] ?? 0);

        return [
            'total_sent' => $total_sent,
            'total_failed' => $campaign['failed_count'],
            'total_bounced' => $total_bounced,
            'total_unsubscribed' => $total_unsubscribed,
            'bounce_rate' => $total_sent > 0 ? round(($total_bounced / $total_sent) * 100, 2) : 0
        ];
    }

    /**
     * Get failed emails for a campaign with contact and error details.
     *
     * @since    1.3.0
     * @param    int   $campaign_id    The campaign ID.
     * @param    int   $limit          Max results (default 200).
     * @return   array                 Array of { contact_id, contact_email, contact_name, error_message, source }.
     */
    public function get_campaign_failed_emails(int $campaign_id, int $limit = 200): array
    {
        global $wpdb;
        $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
        $failures_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_failures');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        $results = [];

        // From emails table (failed with campaign_id)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $email_failures = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "SELECT e.contact_id, c.email as contact_email,
                    TRIM(CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,''))) as contact_name,
                    e.error_message, 'email_record' as source
                FROM {$emails_table} e
                LEFT JOIN {$contacts_table} c ON e.contact_id = c.id
                WHERE e.status = 'failed' AND e.campaign_id = %d
                ORDER BY e.sent_at DESC
                LIMIT %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $campaign_id,
                $limit
            ),
            ARRAY_A
        );

        foreach ($email_failures as $row) {
            $contact_name = !empty(trim($row['contact_name'] ?? '')) ? trim($row['contact_name']) : ($row['contact_email'] ?? '');
            $results[] = [
                'contact_id' => (int) $row['contact_id'],
                'contact_email' => $row['contact_email'],
                'contact_name' => $contact_name ?: sprintf(/* translators: %d: Contact ID */ __('Contact #%d', 'helpmate-ai-chatbot'), $row['contact_id']),
                'error_message' => $row['error_message'],
                'source' => 'email_record',
            ];
        }

        $remaining = $limit - count($results);
        if ($remaining <= 0) {
            return array_slice($results, 0, $limit);
        }

        // From failures table
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $failure_records = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "SELECT f.contact_id, c.email as contact_email,
                    TRIM(CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,''))) as contact_name,
                    f.error_message
                FROM {$failures_table} f
                LEFT JOIN {$contacts_table} c ON f.contact_id = c.id
                WHERE f.campaign_id = %d
                ORDER BY f.created_at DESC
                LIMIT %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $campaign_id,
                $remaining
            ),
            ARRAY_A
        );

        foreach ($failure_records as $row) {
            $contact_name = !empty(trim($row['contact_name'] ?? '')) ? trim($row['contact_name']) : ($row['contact_email'] ?? '');
            $results[] = [
                'contact_id' => (int) $row['contact_id'],
                'contact_email' => $row['contact_email'],
                'contact_name' => $contact_name ?: sprintf(/* translators: %d: Contact ID */ __('Contact #%d', 'helpmate-ai-chatbot'), $row['contact_id']),
                'error_message' => $row['error_message'],
                'source' => 'failure_record',
            ];
        }

        return array_slice($results, 0, $limit);
    }

    /**
     * Process batch of emails for campaign (used by background processor).
     *
     * @since    1.3.0
     * @param    int      $campaign_id    The campaign ID.
     * @param    array    $contact_ids    Array of contact IDs to send to.
     * @return   array                    Results with sent/failed counts.
     */
    public function process_campaign_emails(int $campaign_id, array $contact_ids): array
    {
        $campaign = $this->get_campaign($campaign_id);
        if (!$campaign) {
            return ['sent' => 0, 'failed' => 0, 'errors' => []];
        }

        $template = $this->get_email_template($campaign['template_id']);
        if (!$template) {
            return ['sent' => 0, 'failed' => 0, 'errors' => ['Template not found']];
        }

        $subject = $campaign['subject_override'] ?? $template['subject'];
        $body = $campaign['body_override'] ?? $template['body'];

        $sent = 0;
        $failed = 0;
        $errors = [];

        global $wpdb;
        $failures_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_failures');

        foreach ($contact_ids as $contact_id) {
            $contact = $this->get_contact($contact_id);
            if (!$contact || $contact['status'] === 'unsubscribed') {
                $failed++;
                $error_msg = "Contact {$contact_id}: Unsubscribed or not found";
                $errors[] = $error_msg;
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
                $wpdb->insert(
                    $failures_table,
                    [
                        'campaign_id' => $campaign_id,
                        'contact_id' => $contact_id,
                        'error_message' => $error_msg,
                        'created_at' => current_time('mysql'),
                    ],
                    ['%d', '%d', '%s', '%s']
                );
                continue;
            }

            $result = $this->send_email_to_contact(
                $contact_id,
                $campaign['template_id'],
                $subject,
                $body,
                $campaign['created_by'],
                $campaign_id, // campaign_id
                null, // recurring_campaign_id
                null, // sequence_id
                null  // sequence_step_id
            );

            if (is_wp_error($result)) {
                $failed++;
                $errors[] = "Contact {$contact_id}: " . $result->get_error_message();
            } elseif ($result === true) {
                $sent++;
            } else {
                $failed++;
                $error_msg = "Contact {$contact_id}: Failed to send";
                $errors[] = $error_msg;
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
                $wpdb->insert(
                    $failures_table,
                    [
                        'campaign_id' => $campaign_id,
                        'contact_id' => $contact_id,
                        'error_message' => $error_msg,
                        'created_at' => current_time('mysql'),
                    ],
                    ['%d', '%d', '%s', '%s']
                );
            }
        }

        // Update campaign counts
        $current_sent = $campaign['sent_count'] + $sent;
        $current_failed = $campaign['failed_count'] + $failed;
        $new_status = ($current_sent + $current_failed >= $campaign['total_contacts']) ? 'sent' : 'sending';

        $table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $wpdb->update(
            $table,
            [
                'sent_count' => $current_sent,
                'failed_count' => $current_failed,
                'status' => $new_status,
                'sent_at' => $new_status === 'sent' ? current_time('mysql') : null,
                'updated_at' => current_time('mysql')
            ],
            ['id' => $campaign_id],
            ['%d', '%d', '%s', '%s', '%s'],
            ['%d']
        );

        return ['sent' => $sent, 'failed' => $failed, 'errors' => $errors];
    }

    // ============================================================================
    // EMAIL SEQUENCES METHODS
    // ============================================================================

    /**
     * Create an email sequence with steps.
     *
     * @since    1.3.0
     * @param    array    $data    Sequence data including steps.
     * @return   int|false          Sequence ID on success, false on failure.
     */
    public function create_email_sequence(array $data)
    {
        global $wpdb;
        $sequences_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequences');
        $steps_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_steps');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $wpdb->query('START TRANSACTION');

        try {
            // Create sequence
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $result = $wpdb->insert(
                $sequences_table,
                [
                    'name' => $data['name'],
                    'segment_id' => $data['segment_id'],
                    'is_active' => $data['is_active'] ?? 1,
                    'created_by' => $data['created_by'] ?? get_current_user_id(),
                    'created_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql'),
                ],
                ['%s', '%d', '%d', '%d', '%s', '%s']
            );

            if ($result === false) {
                throw new Exception('Failed to create sequence');
            }

            $sequence_id = $wpdb->insert_id;

            // Create steps
            $steps = $data['steps'] ?? [];
            foreach ($steps as $step_order => $step) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
                $wpdb->insert(
                    $steps_table,
                    [
                        'sequence_id' => $sequence_id,
                        'step_order' => $step_order + 1,
                        'template_id' => $step['template_id'],
                        'subject_override' => $step['subject_override'] ?? null,
                        'body_override' => $step['body_override'] ?? null,
                        'delay_days' => $step['delay_days'] ?? 0,
                        'delay_hours' => $step['delay_hours'] ?? 0,
                        'created_at' => current_time('mysql'),
                        'updated_at' => current_time('mysql'),
                    ],
                    ['%d', '%d', '%d', '%s', '%s', '%d', '%d', '%s', '%s']
                );
            }

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $wpdb->query('COMMIT');

            // Add segment contacts when segment_id is set (triggers immediate send if first step 0 delay).
            if (!empty($data['segment_id'])) {
                $this->add_segment_to_sequence($sequence_id, (int) $data['segment_id']);
            }

            return $sequence_id;
        } catch (Exception $e) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $wpdb->query('ROLLBACK');
            return false;
        }
    }

    /**
     * Update an email sequence.
     *
     * @since    1.3.0
     * @param    int      $sequence_id    The sequence ID.
     * @param    array    $data           Sequence data to update.
     * @return   bool                     True on success, false on failure.
     */
    public function update_email_sequence(int $sequence_id, array $data): bool
    {
        global $wpdb;
        $sequences_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequences');
        $steps_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_steps');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $wpdb->query('START TRANSACTION');

        try {
            // Update sequence
            $update_data = ['updated_at' => current_time('mysql')];
            $format = ['%s'];

            if (isset($data['name'])) {
                $update_data['name'] = $data['name'];
                $format[] = '%s';
            }
            if (isset($data['segment_id'])) {
                $update_data['segment_id'] = $data['segment_id'];
                $format[] = '%d';
            }
            if (isset($data['is_active'])) {
                $update_data['is_active'] = $data['is_active'];
                $format[] = '%d';
            }

            if (count($update_data) > 1) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
                $wpdb->update(
                    $sequences_table,
                    $update_data,
                    ['id' => $sequence_id],
                    $format,
                    ['%d']
                );
            }

            // Update steps if provided
            if (isset($data['steps'])) {
                // Delete existing steps
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
                $wpdb->delete($steps_table, ['sequence_id' => $sequence_id], ['%d']);

                // Insert new steps
                foreach ($data['steps'] as $step_order => $step) {
                    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
                    $wpdb->insert(
                        $steps_table,
                        [
                            'sequence_id' => $sequence_id,
                            'step_order' => $step_order + 1,
                            'template_id' => $step['template_id'],
                            'subject_override' => $step['subject_override'] ?? null,
                            'body_override' => $step['body_override'] ?? null,
                            'delay_days' => $step['delay_days'] ?? 0,
                            'delay_hours' => $step['delay_hours'] ?? 0,
                            'created_at' => current_time('mysql'),
                            'updated_at' => current_time('mysql'),
                        ],
                        ['%d', '%d', '%d', '%s', '%s', '%d', '%d', '%s', '%s']
                    );
                }
            }

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control doesn't require caching
            $wpdb->query('COMMIT');

            // Add segment contacts when segment_id is set (triggers immediate send if first step 0 delay).
            if (isset($data['segment_id']) && !empty($data['segment_id'])) {
                $this->add_segment_to_sequence($sequence_id, (int) $data['segment_id']);
            }

            return true;
        } catch (Exception $e) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control doesn't require caching
            $wpdb->query('ROLLBACK');
            return false;
        }
    }

    /**
     * Delete an email sequence.
     *
     * @since    1.3.0
     * @param    int    $sequence_id    The sequence ID.
     * @return   bool                   True on success, false on failure.
     */
    public function delete_email_sequence(int $sequence_id): bool
    {
        global $wpdb;
        $sequences_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequences');
        $steps_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_steps');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control doesn't require caching
        $wpdb->query('START TRANSACTION');

        try {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
            $wpdb->delete($contacts_table, ['sequence_id' => $sequence_id], ['%d']);
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
            $wpdb->delete($steps_table, ['sequence_id' => $sequence_id], ['%d']);
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
            $wpdb->delete($sequences_table, ['id' => $sequence_id], ['%d']);

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control doesn't require caching
            $wpdb->query('COMMIT');
            return true;
        } catch (Exception $e) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $wpdb->query('ROLLBACK');
            return false;
        }
    }

    /**
     * Get all email sequences.
     *
     * @since    1.3.0
     * @return   array    Array of email sequences.
     */
    public function get_email_sequences(): array
    {
        global $wpdb;
        $sequences_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequences');
        $steps_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_steps');
        $tracking_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');
        $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
        $failures_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_failures');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $sequences = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT * FROM {$sequences_table} ORDER BY created_at DESC",
            ARRAY_A
        );

        foreach ($sequences as &$sequence) {
            $sequence['id'] = (int) $sequence['id'];
            $sequence['segment_id'] = (int) $sequence['segment_id'];
            $sequence['is_active'] = (int) $sequence['is_active'];
            $sequence['created_by'] = (int) $sequence['created_by'];

            // Get sent_count from tracking
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $sequence['sent_count'] = (int) $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT COUNT(*) FROM {$tracking_table} WHERE sequence_id = %d"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $sequence['id']
                )
            );

            // Get failed_count from emails + failures
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $emails_failed = (int) $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT COUNT(*) FROM {$emails_table} WHERE status = 'failed' AND sequence_id = %d"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $sequence['id']
                )
            );
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $failures_count = (int) $wpdb->get_var(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT COUNT(*) FROM {$failures_table} WHERE sequence_id = %d"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $sequence['id']
                )
            );
            $sequence['failed_count'] = $emails_failed + $failures_count;

            // Get steps for each sequence
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $steps = $wpdb->get_results(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT * FROM {$steps_table} WHERE sequence_id = %d ORDER BY step_order ASC"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $sequence['id']
                ),
                ARRAY_A
            );

            foreach ($steps as &$step) {
                $step['id'] = (int) $step['id'];
                $step['sequence_id'] = (int) $step['sequence_id'];
                $step['step_order'] = (int) $step['step_order'];
                $step['template_id'] = (int) $step['template_id'];
                $step['delay_days'] = (int) $step['delay_days'];
                $step['delay_hours'] = (int) $step['delay_hours'];
            }

            $sequence['steps'] = $steps;
        }

        return $sequences;
    }

    /**
     * Get a single email sequence with steps.
     *
     * @since    1.3.0
     * @param    int    $sequence_id    The sequence ID.
     * @return   array|null             The sequence data with steps or null if not found.
     */
    public function get_email_sequence(int $sequence_id): ?array
    {
        global $wpdb;
        $sequences_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequences');
        $steps_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_steps');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $sequence = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$sequences_table} WHERE id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id
            ),
            ARRAY_A
        );

        if (!$sequence) {
            return null;
        }

        $sequence['id'] = (int) $sequence['id'];
        $sequence['segment_id'] = (int) $sequence['segment_id'];
        $sequence['is_active'] = (int) $sequence['is_active'];
        $sequence['created_by'] = (int) $sequence['created_by'];

        // Get steps
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $steps = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$steps_table} WHERE sequence_id = %d ORDER BY step_order ASC"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id
            ),
            ARRAY_A
        );

        foreach ($steps as &$step) {
            $step['id'] = (int) $step['id'];
            $step['sequence_id'] = (int) $step['sequence_id'];
            $step['step_order'] = (int) $step['step_order'];
            $step['template_id'] = (int) $step['template_id'];
            $step['delay_days'] = (int) $step['delay_days'];
            $step['delay_hours'] = (int) $step['delay_hours'];
        }

        $sequence['steps'] = $steps;

        // Add sent_count and failed_count
        $tracking_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');
        $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
        $failures_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_failures');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $sequence['sent_count'] = (int) $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COUNT(*) FROM {$tracking_table} WHERE sequence_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id
            )
        );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $emails_failed = (int) $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COUNT(*) FROM {$emails_table} WHERE status = 'failed' AND sequence_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id
            )
        );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $failures_count = (int) $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COUNT(*) FROM {$failures_table} WHERE sequence_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id
            )
        );
        $sequence['failed_count'] = $emails_failed + $failures_count;

        return $sequence;
    }

    /**
     * Get failed emails for a sequence with contact and error details.
     *
     * @since    1.3.0
     * @param    int   $sequence_id    The sequence ID.
     * @param    int   $limit          Max results (default 200).
     * @return   array                 Array of { contact_id, contact_email, contact_name, error_message, source }.
     */
    public function get_sequence_failed_emails(int $sequence_id, int $limit = 200): array
    {
        global $wpdb;
        $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
        $failures_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_failures');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        $results = [];

        // From emails table
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $email_failures = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "SELECT e.contact_id, c.email as contact_email,
                    TRIM(CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,''))) as contact_name,
                    e.error_message
                FROM {$emails_table} e
                LEFT JOIN {$contacts_table} c ON e.contact_id = c.id
                WHERE e.status = 'failed' AND e.sequence_id = %d
                ORDER BY e.sent_at DESC
                LIMIT %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id,
                $limit
            ),
            ARRAY_A
        );

        foreach ($email_failures as $row) {
            $contact_name = !empty(trim($row['contact_name'] ?? '')) ? trim($row['contact_name']) : ($row['contact_email'] ?? '');
            $results[] = [
                'contact_id' => (int) $row['contact_id'],
                'contact_email' => $row['contact_email'],
                'contact_name' => $contact_name ?: sprintf(/* translators: %d: Contact ID */ __('Contact #%d', 'helpmate-ai-chatbot'), $row['contact_id']),
                'error_message' => $row['error_message'],
                'source' => 'email_record',
            ];
        }

        $remaining = $limit - count($results);
        if ($remaining <= 0) {
            return array_slice($results, 0, $limit);
        }

        // From failures table
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $failure_records = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "SELECT f.contact_id, c.email as contact_email,
                    TRIM(CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,''))) as contact_name,
                    f.error_message
                FROM {$failures_table} f
                LEFT JOIN {$contacts_table} c ON f.contact_id = c.id
                WHERE f.sequence_id = %d
                ORDER BY f.created_at DESC
                LIMIT %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id,
                $remaining
            ),
            ARRAY_A
        );

        foreach ($failure_records as $row) {
            $contact_name = !empty(trim($row['contact_name'] ?? '')) ? trim($row['contact_name']) : ($row['contact_email'] ?? '');
            $results[] = [
                'contact_id' => (int) $row['contact_id'],
                'contact_email' => $row['contact_email'],
                'contact_name' => $contact_name ?: sprintf(/* translators: %d: Contact ID */ __('Contact #%d', 'helpmate-ai-chatbot'), $row['contact_id']),
                'error_message' => $row['error_message'],
                'source' => 'failure_record',
            ];
        }

        return array_slice($results, 0, $limit);
    }

    /**
     * Add a contact to an email sequence.
     *
     * @since    1.3.0
     * @param    int    $sequence_id    The sequence ID.
     * @param    int    $contact_id     The contact ID.
     * @return   bool                   True on success, false on failure.
     */
    public function add_contact_to_sequence(int $sequence_id, int $contact_id): bool
    {
        $contact = $this->get_contact($contact_id);
        if (!$contact || $contact['status'] === 'unsubscribed') {
            return false;
        }

        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_contacts');

        // Check if already exists
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $exists = $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COUNT(*) FROM {$table} WHERE sequence_id = %d AND contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $sequence_id,
                $contact_id
            )
        );

        if ($exists > 0) {
            return true; // Already added
        }

        // Get first step to calculate next_send_at
        $sequence = $this->get_email_sequence($sequence_id);
        if (!$sequence || empty($sequence['steps'])) {
            return false;
        }

        $first_step = $sequence['steps'][0];
        $delay_seconds = ($first_step['delay_days'] * 24 * 60 * 60) + ($first_step['delay_hours'] * 60 * 60);
        $next_send_at = gmdate('Y-m-d H:i:s', time() + $delay_seconds);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->insert(
            $table,
            [
                'sequence_id' => $sequence_id,
                'contact_id' => $contact_id,
                'current_step' => 0,
                'next_send_at' => $next_send_at,
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql'),
            ],
            ['%d', '%d', '%d', '%s', '%s', '%s']
        );

        return $result !== false;
    }

    /**
     * Add all segment contacts to a sequence.
     *
     * @since    1.3.0
     * @param    int    $sequence_id    The sequence ID.
     * @param    int    $segment_id      The segment ID.
     * @return   int                     Number of contacts added.
     */
    public function add_segment_to_sequence(int $sequence_id, int $segment_id): int
    {
        $segment_contacts = $this->get_segment_contacts($segment_id, 1, 10000);
        $contact_ids = array_column($segment_contacts['contacts'], 'id');

        $added = 0;
        foreach ($contact_ids as $contact_id) {
            if ($this->add_contact_to_sequence($sequence_id, $contact_id)) {
                $added++;
            }
        }

        if ($added > 0) {
            $this->maybe_process_sequence_immediately($sequence_id);
        }

        return $added;
    }

    /**
     * Process first step immediately when delay is 0 days and 0 hours.
     *
     * @since    1.3.0
     * @param    int    $sequence_id    The sequence ID.
     * @return   void
     */
    public function maybe_process_sequence_immediately(int $sequence_id): void
    {
        $sequence = $this->get_email_sequence($sequence_id);
        if (!$sequence || empty($sequence['steps']) || !$sequence['is_active']) {
            return;
        }

        $first_step = $sequence['steps'][0];
        if ((int) $first_step['delay_days'] !== 0 || (int) $first_step['delay_hours'] !== 0) {
            return;
        }

        // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- Necessary for synchronous email sending
        @set_time_limit(300);

        $this->process_email_sequences($sequence_id, 1000);
    }

    /**
     * Process due email sequences (cron job).
     *
     * @since    1.3.0
     * @param    int|null    $sequence_id    Optional. Limit to this sequence ID.
     * @param    int|null    $limit          Optional. Max contacts to process (default 50).
     * @return   int                         Number of emails sent.
     */
    public function process_email_sequences(?int $sequence_id = null, ?int $limit = null): int
    {
        global $wpdb;
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_contacts');
        $sequences_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequences');

        // next_send_at is stored via gmdate() (UTC); use GMT for comparison to avoid timezone mismatch.
        $now = current_time('mysql', true);

        $limit_sql = $limit !== null ? ' LIMIT ' . (int) $limit : ' LIMIT 50';

        // Get contacts with due emails (next_send_at <= now, not paused, not completed). Explicit branches to avoid dynamic WHERE.
        if ($sequence_id !== null) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $contacts = $wpdb->get_results(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT sc.*, s.created_by
                    FROM {$contacts_table} sc
                    INNER JOIN {$sequences_table} s ON sc.sequence_id = s.id
                    WHERE sc.next_send_at <= %s AND sc.paused_at IS NULL AND sc.completed_at IS NULL AND s.is_active = 1 AND sc.sequence_id = %d
                    ORDER BY sc.next_send_at ASC
                    {$limit_sql}"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $now,
                    $sequence_id
                ),
                ARRAY_A
            );
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $contacts = $wpdb->get_results(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT sc.*, s.created_by
                    FROM {$contacts_table} sc
                    INNER JOIN {$sequences_table} s ON sc.sequence_id = s.id
                    WHERE sc.next_send_at <= %s AND sc.paused_at IS NULL AND sc.completed_at IS NULL AND s.is_active = 1
                    ORDER BY sc.next_send_at ASC
                    {$limit_sql}"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $now
                ),
                ARRAY_A
            );
        }

        $sent = 0;

        foreach ($contacts as $contact_seq) {
            $sequence = $this->get_email_sequence($contact_seq['sequence_id']);
            if (!$sequence || empty($sequence['steps'])) {
                continue;
            }

            $current_step_index = (int) $contact_seq['current_step'];
            if ($current_step_index >= count($sequence['steps'])) {
                // Mark as completed
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $wpdb->update(
                    $contacts_table,
                    ['completed_at' => current_time('mysql'), 'updated_at' => current_time('mysql')],
                    ['id' => $contact_seq['id']],
                    ['%s', '%s'],
                    ['%d']
                );
                continue;
            }

            $step = $sequence['steps'][$current_step_index];
            $contact = $this->get_contact($contact_seq['contact_id']);

            if (!$contact || $contact['status'] === 'unsubscribed') {
                // Pause sequence for unsubscribed
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $wpdb->update(
                    $contacts_table,
                    ['paused_at' => current_time('mysql'), 'updated_at' => current_time('mysql')],
                    ['id' => $contact_seq['id']],
                    ['%s', '%s'],
                    ['%d']
                );
                continue;
            }

            $template = $this->get_email_template($step['template_id']);
            if (!$template) {
                continue;
            }

            $subject = $step['subject_override'] ?? $template['subject'];
            $body = $step['body_override'] ?? $template['body'];

            // Send email
            $email_sent = $this->send_email_to_contact(
                $contact_seq['contact_id'],
                $step['template_id'],
                $subject,
                $body,
                $sequence['created_by'],
                null, // campaign_id
                null, // recurring_campaign_id
                $sequence['id'], // sequence_id
                $step['id']  // sequence_step_id
            );

            // Check for success (true) - WP_Error or false means failure
            if ($email_sent === true) {
                $sent++;

                // Update to next step
                $next_step_index = $current_step_index + 1;
                if ($next_step_index < count($sequence['steps'])) {
                    $next_step = $sequence['steps'][$next_step_index];
                    $delay_seconds = ($next_step['delay_days'] * 24 * 60 * 60) + ($next_step['delay_hours'] * 60 * 60);
                    $next_send_at = gmdate('Y-m-d H:i:s', time() + $delay_seconds);
                } else {
                    $next_send_at = null; // Will mark as completed
                }

                $update_data = [
                    'current_step' => $next_step_index,
                    'updated_at' => current_time('mysql')
                ];

                if ($next_send_at) {
                    $update_data['next_send_at'] = $next_send_at;
                } else {
                    $update_data['completed_at'] = current_time('mysql');
                }

                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
                $wpdb->update(
                    $contacts_table,
                    $update_data,
                    ['id' => $contact_seq['id']],
                    $next_send_at ? ['%d', '%s', '%s'] : ['%d', '%s', '%s'],
                    ['%d']
                );
            } elseif ($email_sent === false) {
                // Insert into failures only when false (no email record created). WP_Error failures are already in emails table.
                $failures_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_failures');
                $error_msg = 'Contact ' . $contact_seq['contact_id'] . ': Failed to send';
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
                $wpdb->insert(
                    $failures_table,
                    [
                        'sequence_id' => $sequence['id'],
                        'sequence_step_id' => $step['id'],
                        'contact_id' => $contact_seq['contact_id'],
                        'error_message' => $error_msg,
                        'created_at' => current_time('mysql'),
                    ],
                    ['%d', '%d', '%d', '%s', '%s']
                );
            }
        }

        return $sent;
    }

    /**
     * Process due recurring campaigns (cron job).
     *
     * @since    1.3.0
     * @return   int    Number of campaigns processed.
     */
    public function process_recurring_campaigns(): int
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');

        $now = current_time('mysql');

        // Get active recurring campaigns that are due to run (next_run_at <= now)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $campaigns = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table}
                WHERE type = 'recurring'
                AND is_active = 1
                AND next_run_at IS NOT NULL
                AND next_run_at <= %s
                ORDER BY next_run_at ASC
                LIMIT 50"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $now
            ),
            ARRAY_A
        );

        $processed = 0;

        foreach ($campaigns as $campaign) {
            $campaign_id = (int) $campaign['id'];

            // Send the campaign
            $this->send_campaign($campaign_id);

            // Update next_run_at and last_run_at regardless of send result
            if (!empty($campaign['interval_value']) && !empty($campaign['interval_unit'])) {
                $interval = (int) $campaign['interval_value'];
                $unit = $campaign['interval_unit'];

                // Calculate next run time
                $last_run_at = current_time('mysql');
                $next_run_at = gmdate('Y-m-d H:i:s', strtotime("+{$interval} {$unit}", strtotime($last_run_at)));

                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
                $wpdb->update(
                    $table,
                    [
                        'next_run_at' => $next_run_at,
                        'last_run_at' => $last_run_at,
                        'updated_at' => current_time('mysql')
                    ],
                    ['id' => $campaign_id],
                    ['%s', '%s', '%s'],
                    ['%d']
                );

                $processed++;
            }
        }

        return $processed;
    }

    /**
     * Pause a contact's sequence.
     *
     * @since    1.3.0
     * @param    int    $sequence_id    The sequence ID.
     * @param    int    $contact_id     The contact ID.
     * @return   bool                   True on success, false on failure.
     */
    public function pause_sequence_contact(int $sequence_id, int $contact_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $table,
            ['paused_at' => current_time('mysql'), 'updated_at' => current_time('mysql')],
            ['sequence_id' => $sequence_id, 'contact_id' => $contact_id],
            ['%s', '%s'],
            ['%d', '%d']
        );

        return $result !== false;
    }

    /**
     * Resume a contact's sequence.
     *
     * @since    1.3.0
     * @param    int    $sequence_id    The sequence ID.
     * @param    int    $contact_id     The contact ID.
     * @return   bool                   True on success, false on failure.
     */
    public function resume_sequence_contact(int $sequence_id, int $contact_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $table,
            ['paused_at' => null, 'updated_at' => current_time('mysql')],
            ['sequence_id' => $sequence_id, 'contact_id' => $contact_id],
            [null, '%s'],
            ['%d', '%d']
        );

        return $result !== false;
    }

    // ============================================================================
    // EMAIL TRACKING METHODS
    // ============================================================================

    /**
     * Track email open.
     *
     * @since    1.3.0
     * @param    int    $email_id     The email ID.
     * @param    int    $contact_id   The contact ID.
     * @return   bool                 True on success, false on failure.
     */
    public function track_email_open(int $email_id, int $contact_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');

        // Check if tracking record exists
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $tracking = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE email_id = %d AND contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $email_id,
                $contact_id
            ),
            ARRAY_A
        );

        if ($tracking) {
            // Update existing
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
            $result = $wpdb->update(
                $table,
                [
                    'opened_at' => $tracking['opened_at'] ?: current_time('mysql'),
                    'opened_count' => $tracking['opened_count'] + 1,
                    'updated_at' => current_time('mysql')
                ],
                ['id' => $tracking['id']],
                ['%s', '%d', '%s'],
                ['%d']
            );
        } else {
            // Create new
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
            $result = $wpdb->insert(
                $table,
                [
                    'email_id' => $email_id,
                    'contact_id' => $contact_id,
                    'opened_at' => current_time('mysql'),
                    'opened_count' => 1,
                    'created_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql'),
                ],
                ['%d', '%d', '%s', '%d', '%s', '%s']
            );
        }

        return $result !== false;
    }

    /**
     * Track email click.
     *
     * @since    1.3.0
     * @param    int    $email_id     The email ID.
     * @param    int    $contact_id   The contact ID.
     * @param    string $url          The clicked URL.
     * @return   bool                 True on success, false on failure.
     */
    public function track_email_click(int $email_id, int $contact_id, string $url): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');

        // Check if tracking record exists
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $tracking = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE email_id = %d AND contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $email_id,
                $contact_id
            ),
            ARRAY_A
        );

        if ($tracking) {
            // Update existing
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
            $result = $wpdb->update(
                $table,
                [
                    'clicked_at' => $tracking['clicked_at'] ?: current_time('mysql'),
                    'clicked_count' => $tracking['clicked_count'] + 1,
                    'updated_at' => current_time('mysql')
                ],
                ['id' => $tracking['id']],
                ['%s', '%d', '%s'],
                ['%d']
            );
        } else {
            // Create new
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
            $result = $wpdb->insert(
                $table,
                [
                    'email_id' => $email_id,
                    'contact_id' => $contact_id,
                    'clicked_at' => current_time('mysql'),
                    'clicked_count' => 1,
                    'created_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql'),
                ],
                ['%d', '%d', '%s', '%d', '%s', '%s']
            );
        }

        return $result !== false;
    }

    /**
     * Track email bounce.
     *
     * @since    1.3.0
     * @param    int    $email_id     The email ID.
     * @param    int    $contact_id   The contact ID.
     * @param    string $reason       Bounce reason.
     * @return   bool                 True on success, false on failure.
     */
    public function track_email_bounce(int $email_id, int $contact_id, string $reason): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');

        // Check if tracking record exists
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $tracking = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE email_id = %d AND contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $email_id,
                $contact_id
            ),
            ARRAY_A
        );

        if ($tracking) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
            $result = $wpdb->update(
                $table,
                [
                    'bounced_at' => current_time('mysql'),
                    'bounce_reason' => $reason,
                    'updated_at' => current_time('mysql')
                ],
                ['id' => $tracking['id']],
                ['%s', '%s', '%s'],
                ['%d']
            );
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
            $result = $wpdb->insert(
                $table,
                [
                    'email_id' => $email_id,
                    'contact_id' => $contact_id,
                    'bounced_at' => current_time('mysql'),
                    'bounce_reason' => $reason,
                    'created_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql'),
                ],
                ['%d', '%d', '%s', '%s', '%s', '%s']
            );
        }

        return $result !== false;
    }

    /**
     * Track unsubscribe and update contact status.
     *
     * @since    1.3.0
     * @param    int    $email_id     The email ID.
     * @param    int    $contact_id   The contact ID.
     * @return   bool                 True on success, false on failure.
     */
    public function track_unsubscribe(int $email_id, int $contact_id): bool
    {
        global $wpdb;
        $tracking_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // Update contact status
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $wpdb->update(
            $contacts_table,
            ['status' => 'Unsubscribed', 'updated_at' => current_time('mysql')],
            ['id' => $contact_id],
            ['%s', '%s'],
            ['%d']
        );

        // Track unsubscribe
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $tracking = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$tracking_table} WHERE email_id = %d AND contact_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $email_id,
                $contact_id
            ),
            ARRAY_A
        );

        if ($tracking) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $result = $wpdb->update(
                $tracking_table,
                [
                    'unsubscribed_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql')
                ],
                ['id' => $tracking['id']],
                ['%s', '%s'],
                ['%d']
            );
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
            $result = $wpdb->insert(
                $tracking_table,
                [
                    'email_id' => $email_id,
                    'contact_id' => $contact_id,
                    'unsubscribed_at' => current_time('mysql'),
                    'created_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql'),
                ],
                ['%d', '%d', '%s', '%s', '%s']
            );
        }

        return $result !== false;
    }

    /**
     * Resubscribe a contact (set status back to subscribed).
     *
     * @since    1.3.0
     * @param    int    $contact_id    The contact ID.
     * @return   bool                  True on success, false on failure.
     */
    public function resubscribe_contact(int $contact_id): bool
    {
        global $wpdb;
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update/Insert/Delete operation doesn't require caching
        $result = $wpdb->update(
            $contacts_table,
            ['status' => 'subscribed', 'updated_at' => current_time('mysql')],
            ['id' => $contact_id],
            ['%s', '%s'],
            ['%d']
        );

        return $result !== false;
    }

    /**
     * Get tracking data for an email.
     *
     * @since    1.3.0
     * @param    int    $email_id    The email ID.
     * @return   array               Tracking data.
     */
    public function get_email_tracking(int $email_id): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $tracking = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} WHERE email_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $email_id
            ),
            ARRAY_A
        );

        foreach ($tracking as &$track) {
            $track['id'] = (int) $track['id'];
            $track['email_id'] = (int) $track['email_id'];
            $track['contact_id'] = (int) $track['contact_id'];
            $track['opened_count'] = (int) $track['opened_count'];
            $track['clicked_count'] = (int) $track['clicked_count'];
        }

        return $tracking;
    }

    /**
     * Get aggregated tracking for a campaign.
     *
     * @since    1.3.0
     * @param    int    $campaign_id    The campaign ID.
     * @return   array                  Aggregated tracking data.
     */
    public function get_campaign_tracking(int $campaign_id): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $stats = $wpdb->get_row(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT
                    COUNT(*) as total_tracked,
                    SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
                    SUM(opened_count) as total_opens,
                    SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as total_clicked,
                    SUM(clicked_count) as total_clicks,
                    SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as total_bounced,
                    SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as total_unsubscribed
                FROM {$table}
                WHERE campaign_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $campaign_id
            ),
            ARRAY_A
        );

        return $stats ?: [
            'total_tracked' => 0,
            'total_opened' => 0,
            'total_opens' => 0,
            'total_clicked' => 0,
            'total_clicks' => 0,
            'total_bounced' => 0,
            'total_unsubscribed' => 0
        ];
    }
}
