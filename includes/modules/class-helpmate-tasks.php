<?php

/**
 * The Tasks module for the Helpmate plugin.
 *
 * Handles task management, contact associations, and custom fields.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.1.7
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

class Helpmate_Tasks
{
    /**
     * The helpmate instance.
     *
     * @since    1.1.7
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * The settings instance.
     *
     * @since    1.1.7
     * @access   private
     * @var      Helpmate_Settings    $settings    The settings instance.
     */
    private $settings;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.1.7
     * @param    Helpmate    $helpmate    The helpmate instance.
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
        $this->settings = $helpmate->get_settings();

        // Register cron job for overdue task reminders
        add_action('helpmate_check_overdue_tasks', [$this, 'check_and_send_overdue_reminders']);
        add_action('init', [$this, 'schedule_overdue_task_check']);
    }

    /**
     * Schedule daily cron job for overdue task reminders.
     *
     * @since    1.3.0
     */
    public function schedule_overdue_task_check()
    {
        if (!wp_next_scheduled('helpmate_check_overdue_tasks')) {
            wp_schedule_event(time(), 'daily', 'helpmate_check_overdue_tasks');
        }
    }

    /**
     * Check for overdue tasks and send reminder emails.
     *
     * @since    1.3.0
     */
    public function check_and_send_overdue_reminders()
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // Get all overdue tasks that are assigned and not completed
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $sql = "SELECT DISTINCT t.id
                FROM {$tasks_table} t
                WHERE t.assigned_to IS NOT NULL
                AND t.due_date IS NOT NULL
                AND t.due_date < %s
                AND NOT EXISTS (
                    SELECT 1 FROM {$field_values_table} fv
                    INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                    WHERE fv.task_id = t.id
                    AND cf.field_name = 'status'
                    AND (fv.field_value = %s OR fv.field_value = %s)
                )";

        $current_time = current_time('mysql');
        $done_status = json_encode('Done');
        $completed_status = json_encode('Completed');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $overdue_task_ids = $wpdb->get_col(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared here
            $wpdb->prepare($sql, $current_time, $done_status, $completed_status)
        );

        if (empty($overdue_task_ids)) {
            return;
        }

        // Track last reminder sent to avoid spam - use task meta or a simple approach
        // For now, we'll send reminders daily (this cron runs daily)
        // In the future, we could add a last_reminder_sent column to track per-task

        foreach ($overdue_task_ids as $task_id) {
            $this->send_overdue_task_reminder((int) $task_id);
        }
    }

    /**
     * Check if Tasks module is enabled.
     *
     * @since    1.1.7
     * @return   bool    Whether Tasks is enabled.
     */
    public function is_enabled(): bool
    {
        $modules = $this->settings->get_setting('modules');
        return isset($modules[HELPMATE_MODULE_CRM]) && $modules[HELPMATE_MODULE_CRM] === true;
    }

    /**
     * Get tasks with filters, search, and pagination.
     *
     * @since    1.1.7
     * @param    array    $filters    Filter options (status, priority, assigned_to, search, etc.).
     * @param    int      $page       Page number.
     * @param    int      $per_page   Items per page.
     * @return   array    The tasks with pagination.
     */
    public function get_tasks(array $filters = [], int $page = 1, int $per_page = 20): array
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');
        $offset = ($page - 1) * $per_page;

        // Build WHERE clause incrementally
        $where_sql = '1=1';
        $params = [];

        // Status filter (via custom field)
        if (!empty($filters['status'])) {
            $where_sql .= " AND EXISTS (
                SELECT 1 FROM {$field_values_table} fv
                INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                WHERE fv.task_id = t.id
                AND cf.field_name = 'status'
                AND fv.field_value = %s
            )";
            $params[] = json_encode(sanitize_text_field($filters['status']));
        }

        // Priority filter (via custom field)
        if (!empty($filters['priority'])) {
            $where_sql .= " AND EXISTS (
                SELECT 1 FROM {$field_values_table} fv
                INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                WHERE fv.task_id = t.id
                AND cf.field_name = 'priority'
                AND fv.field_value = %s
            )";
            $params[] = json_encode(sanitize_text_field($filters['priority']));
        }

        // Assigned to filter
        if (!empty($filters['assigned_to'])) {
            if ($filters['assigned_to'] === 'me') {
                $where_sql .= ' AND t.assigned_to = %d';
                $params[] = get_current_user_id();
            } elseif ($filters['assigned_to'] === 'unassigned') {
                $where_sql .= ' AND t.assigned_to IS NULL';
            } else {
                $where_sql .= ' AND t.assigned_to = %d';
                $params[] = absint($filters['assigned_to']);
            }
        }

        // Search filter (title, description)
        if (!empty($filters['search'])) {
            $where_sql .= ' AND (t.title LIKE %s OR t.description LIKE %s)';
            $search_term = '%' . $wpdb->esc_like(sanitize_text_field($filters['search'])) . '%';
            $params[] = $search_term;
            $params[] = $search_term;
        }

        // Due date range filters
        if (!empty($filters['due_date_from'])) {
            $where_sql .= ' AND t.due_date >= %s';
            $params[] = sanitize_text_field($filters['due_date_from']);
        }

        if (!empty($filters['due_date_to'])) {
            $where_sql .= ' AND t.due_date <= %s';
            $params[] = sanitize_text_field($filters['due_date_to']);
        }

        // Overdue filter
        if (isset($filters['overdue']) && $filters['overdue']) {
            $where_sql .= ' AND t.due_date < %s';
            $params[] = current_time('mysql');
        }

        // Has contacts filter
        if (isset($filters['has_contacts'])) {
            if ($filters['has_contacts']) {
                $where_sql .= " AND EXISTS (SELECT 1 FROM {$task_contacts_table} WHERE task_id = t.id)";
            } else {
                $where_sql .= " AND NOT EXISTS (SELECT 1 FROM {$task_contacts_table} WHERE task_id = t.id)";
            }
        }

        // Get total count
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $count_sql = "SELECT COUNT(*) FROM {$tasks_table} t WHERE {$where_sql}";
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- Direct query necessary; caching not appropriate for frequently changing data; Query is prepared conditionally below
        $total_count = $wpdb->get_var(!empty($params) ? $wpdb->prepare($count_sql, ...$params) : $count_sql); // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared

        // Get tasks
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $sql = "SELECT t.*,
                u1.display_name as assigned_to_name,
                u2.display_name as created_by_name
                FROM {$tasks_table} t
                LEFT JOIN {$wpdb->users} u1 ON t.assigned_to = u1.ID
                LEFT JOIN {$wpdb->users} u2 ON t.created_by = u2.ID
                WHERE {$where_sql}
                ORDER BY t.created_at DESC
                LIMIT %d OFFSET %d";

        $params[] = $per_page;
        $params[] = $offset;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Direct query necessary; caching not appropriate for frequently changing data
        $tasks = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared here
            $wpdb->prepare($sql, ...$params),
            ARRAY_A
        );

        // Enhance each task with custom fields and contacts
        foreach ($tasks as &$task) {
            $task['custom_fields'] = $this->get_task_custom_field_values($task['id']);
            $task['contacts'] = $this->get_task_contacts($task['id']);
            $task['is_overdue'] = !empty($task['due_date']) && strtotime($task['due_date']) < time();
        }

        return [
            'tasks' => $tasks,
            'pagination' => [
                'total' => intval($total_count),
                'page' => $page,
                'per_page' => $per_page,
                'total_pages' => ceil($total_count / $per_page)
            ]
        ];
    }

    /**
     * Get a single task by ID.
     *
     * @since    1.1.7
     * @param    int     $task_id    The task ID.
     * @return   array|null          The task data or null if not found.
     */
    public function get_task(int $task_id): ?array
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $sql = "SELECT t.*,
                u1.display_name as assigned_to_name,
                u2.display_name as created_by_name
                FROM {$tasks_table} t
                LEFT JOIN {$wpdb->users} u1 ON t.assigned_to = u1.ID
                LEFT JOIN {$wpdb->users} u2 ON t.created_by = u2.ID
                WHERE t.id = %d";

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $task = $wpdb->get_row(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared here
            $wpdb->prepare($sql, $task_id),
            ARRAY_A
        );

        if (!$task) {
            return null;
        }

        // Enhance with custom fields and contacts
        $task['custom_fields'] = $this->get_task_custom_field_values($task['id']);
        $task['contacts'] = $this->get_task_contacts($task['id']);
        $task['is_overdue'] = !empty($task['due_date']) && strtotime($task['due_date']) < time();

        return $task;
    }

    /**
     * Create a new task.
     *
     * @since    1.1.7
     * @param    array    $data    The task data.
     * @return   int|false         The task ID on success, false on failure.
     */
    public function create_task(array $data)
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');

        // Prepare core task data
        $task_data = [
            'title' => sanitize_text_field($data['title']),
            'description' => isset($data['description']) ? sanitize_textarea_field($data['description']) : null,
            'due_date' => !empty($data['due_date']) ? sanitize_text_field($data['due_date']) : null,
            'assigned_to' => !empty($data['assigned_to']) ? intval($data['assigned_to']) : null,
            'created_by' => get_current_user_id(),
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql'),
        ];

        // Insert task
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $result = $wpdb->insert($tasks_table, $task_data);

        if (!$result) {
            return false;
        }

        $task_id = $wpdb->insert_id;

        // Ensure default task custom fields exist (lazy initialization)
        $database = $this->helpmate->get_database();
        if ($database) {
            $database->initialize_task_custom_fields();
        }

        // Save custom field values if provided
        if (!empty($data['custom_fields'])) {
            $this->save_task_custom_field_values($task_id, $data['custom_fields']);
        } else {
            // Set default status if not provided
            $status_field = $this->get_custom_field_by_name('status', 'task');
            if ($status_field) {
                $this->save_task_custom_field_values($task_id, [
                    $status_field['id'] => 'To Do'
                ]);
            }
        }

        // Create contact associations if provided
        if (!empty($data['contact_ids']) && is_array($data['contact_ids'])) {
            $this->update_task_contacts($task_id, $data['contact_ids']);
        }

        // Send assignment email if task is assigned
        if (!empty($data['assigned_to'])) {
            $this->send_task_assignment_email($task_id, $data['assigned_to'], get_current_user_id());
        }

        // In-app notification for assignee (so team member sees it in header / Tasks badge)
        if (!empty($data['assigned_to'])) {
            $notifications = $this->helpmate->get_notifications();
            if ($notifications) {
                $task_title = isset($task_data['title']) ? $task_data['title'] : '';
                $notifications->create(
                    (int) $data['assigned_to'],
                    'task',
                    __('New task assigned', 'helpmate-ai-chatbot'),
                    $task_title,
                    admin_url('admin.php?page=helpmate&tab=crm&subtab=tasks'),
                    array(),
                    'task',
                    $task_id
                );
            }
        }

        return $task_id;
    }

    /**
     * Update an existing task.
     *
     * @since    1.1.7
     * @param    int      $task_id    The task ID.
     * @param    array    $data       The task data to update.
     * @return   bool                 True on success, false on failure.
     */
    public function update_task(int $task_id, array $data): bool
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');

        // Get old task data for comparison
        $old_task = $this->get_task($task_id);
        if (!$old_task) {
            return false;
        }

        // Prepare update data
        $update_data = ['updated_at' => current_time('mysql')];

        if (isset($data['title'])) {
            $update_data['title'] = sanitize_text_field($data['title']);
        }

        if (isset($data['description'])) {
            $update_data['description'] = sanitize_textarea_field($data['description']);
        }

        if (isset($data['due_date'])) {
            $update_data['due_date'] = !empty($data['due_date']) ? sanitize_text_field($data['due_date']) : null;
        }

        if (isset($data['assigned_to'])) {
            $update_data['assigned_to'] = !empty($data['assigned_to']) ? intval($data['assigned_to']) : null;
        }

        // Update task
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
        $result = $wpdb->update(
            $tasks_table,
            $update_data,
            ['id' => $task_id],
            null,
            ['%d']
        );

        // Update custom field values if provided
        if (isset($data['custom_fields'])) {
            $this->save_task_custom_field_values($task_id, $data['custom_fields']);
        }

        // Update contact associations if provided
        if (isset($data['contact_ids']) && is_array($data['contact_ids'])) {
            $this->update_task_contacts($task_id, $data['contact_ids']);
        }

        // Send email notifications for important changes
        if ($result !== false) {
            // Check for assignment changes
            if (isset($data['assigned_to'])) {
                $old_assigned_to = !empty($old_task['assigned_to']) ? (int) $old_task['assigned_to'] : null;
                $new_assigned_to = !empty($data['assigned_to']) ? (int) $data['assigned_to'] : null;

                if ($old_assigned_to != $new_assigned_to) {
                    $this->send_task_reassignment_email(
                        $task_id,
                        $new_assigned_to,
                        $old_assigned_to,
                        get_current_user_id()
                    );
                }
            }

            // Check for due date changes
            if (isset($data['due_date'])) {
                $old_due_date = !empty($old_task['due_date']) ? $old_task['due_date'] : null;
                $new_due_date = !empty($data['due_date']) ? $data['due_date'] : null;

                if ($old_due_date != $new_due_date && !empty($old_task['assigned_to'])) {
                    $this->send_task_due_date_changed_email($task_id, $old_due_date, $new_due_date);
                }
            }
        }

        return $result !== false;
    }

    /**
     * Delete a task.
     *
     * @since    1.1.7
     * @param    int     $task_id    The task ID.
     * @return   bool                True on success, false on failure.
     */
    public function delete_task(int $task_id): bool
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');

        // Delete contact associations
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $wpdb->delete($task_contacts_table, ['task_id' => $task_id], ['%d']);

        // Delete custom field values
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $wpdb->delete($field_values_table, ['task_id' => $task_id], ['%d']);

        // Delete task
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $result = $wpdb->delete($tasks_table, ['id' => $task_id], ['%d']);

        return $result !== false;
    }

    /**
     * Get contacts associated with a task.
     *
     * @since    1.1.7
     * @param    int     $task_id    The task ID.
     * @return   array               Array of contacts.
     */
    public function get_task_contacts(int $task_id): array
    {
        global $wpdb;
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $sql = "SELECT c.*
                FROM {$contacts_table} c
                INNER JOIN {$task_contacts_table} tc ON c.id = tc.contact_id
                WHERE tc.task_id = %d
                ORDER BY tc.created_at DESC";

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        return $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared here
            $wpdb->prepare($sql, $task_id),
            ARRAY_A
        ) ?: [];
    }

    /**
     * Add a contact to a task.
     *
     * @since    1.1.7
     * @param    int     $task_id      The task ID.
     * @param    int     $contact_id   The contact ID.
     * @return   bool                  True on success, false on failure.
     */
    public function add_task_contact(int $task_id, int $contact_id): bool
    {
        global $wpdb;
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $result = $wpdb->insert(
            $task_contacts_table,
            [
                'task_id' => $task_id,
                'contact_id' => $contact_id,
                'created_at' => current_time('mysql')
            ],
            ['%d', '%d', '%s']
        );

        return $result !== false;
    }

    /**
     * Remove a contact from a task.
     *
     * @since    1.1.7
     * @param    int     $task_id      The task ID.
     * @param    int     $contact_id   The contact ID.
     * @return   bool                  True on success, false on failure.
     */
    public function remove_task_contact(int $task_id, int $contact_id): bool
    {
        global $wpdb;
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $result = $wpdb->delete(
            $task_contacts_table,
            [
                'task_id' => $task_id,
                'contact_id' => $contact_id
            ],
            ['%d', '%d']
        );

        return $result !== false;
    }

    /**
     * Update all contacts for a task (replace existing).
     *
     * @since    1.1.7
     * @param    int      $task_id       The task ID.
     * @param    array    $contact_ids   Array of contact IDs.
     * @return   bool                    True on success, false on failure.
     */
    public function update_task_contacts(int $task_id, array $contact_ids): bool
    {
        global $wpdb;
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');

        // Delete existing associations
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Delete operation doesn't require caching
        $wpdb->delete($task_contacts_table, ['task_id' => $task_id], ['%d']);

        // Add new associations
        foreach ($contact_ids as $contact_id) {
            if (!empty($contact_id)) {
                $this->add_task_contact($task_id, intval($contact_id));
            }
        }

        return true;
    }

    /**
     * Get tasks for a specific contact.
     *
     * @since    1.1.7
     * @param    int      $contact_id   The contact ID.
     * @param    array    $filters      Filter options.
     * @return   array                  Array of tasks.
     */
    public function get_contact_tasks(int $contact_id, array $filters = []): array
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // Build WHERE clause incrementally
        $where_sql = 'tc.contact_id = %d';
        $params = [$contact_id];

        // Status filter
        if (!empty($filters['status'])) {
            $where_sql .= " AND EXISTS (
                SELECT 1 FROM {$field_values_table} fv
                INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                WHERE fv.task_id = t.id
                AND cf.field_name = 'status'
                AND fv.field_value = %s
            )";
            $params[] = json_encode(sanitize_text_field($filters['status']));
        }

        // Priority filter
        if (!empty($filters['priority'])) {
            $where_sql .= " AND EXISTS (
                SELECT 1 FROM {$field_values_table} fv
                INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                WHERE fv.task_id = t.id
                AND cf.field_name = 'priority'
                AND fv.field_value = %s
            )";
            $params[] = json_encode(sanitize_text_field($filters['priority']));
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $sql = "SELECT t.*,
                u1.display_name as assigned_to_name,
                u2.display_name as created_by_name
                FROM {$tasks_table} t
                INNER JOIN {$task_contacts_table} tc ON t.id = tc.task_id
                LEFT JOIN {$wpdb->users} u1 ON t.assigned_to = u1.ID
                LEFT JOIN {$wpdb->users} u2 ON t.created_by = u2.ID
                WHERE {$where_sql}
                ORDER BY t.created_at DESC";

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Direct query necessary; caching not appropriate for frequently changing data
        $tasks = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared here
            $wpdb->prepare($sql, ...$params),
            ARRAY_A
        );

        // Enhance each task with custom fields
        foreach ($tasks as &$task) {
            $task['custom_fields'] = $this->get_task_custom_field_values($task['id']);
            $task['is_overdue'] = !empty($task['due_date']) && strtotime($task['due_date']) < time();
        }

        return $tasks;
    }

    /**
     * Get custom field values for a task.
     *
     * @since    1.1.7
     * @param    int     $task_id    The task ID.
     * @return   array               Array of custom field values keyed by field_id.
     */
    public function get_task_custom_field_values(int $task_id): array
    {
        global $wpdb;
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $sql = "SELECT fv.*, cf.field_name, cf.field_label, cf.field_type
                FROM {$field_values_table} fv
                INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                WHERE fv.task_id = %d
                ORDER BY cf.display_order ASC";

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $results = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared here
            $wpdb->prepare($sql, $task_id),
            ARRAY_A
        );

        $values = [];
        foreach ($results as $row) {
            $decoded_value = json_decode($row['field_value'], true);
            $values[$row['field_id']] = [
                'field_id' => $row['field_id'],
                'field_name' => $row['field_name'],
                'field_label' => $row['field_label'],
                'field_type' => $row['field_type'],
                'value' => $decoded_value !== null ? $decoded_value : $row['field_value']
            ];
        }

        return $values;
    }

    /**
     * Save custom field values for a task.
     *
     * @since    1.1.7
     * @param    int      $task_id   The task ID.
     * @param    array    $values    Array of field values keyed by field_id.
     * @return   bool                True on success, false on failure.
     */
    public function save_task_custom_field_values(int $task_id, array $values): bool
    {
        global $wpdb;
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');

        foreach ($values as $field_id => $value) {
            // Skip empty values
            if ($value === '' || $value === null) {
                continue;
            }

            // Encode value as JSON
            $encoded_value = is_array($value) || is_object($value) ? json_encode($value) : json_encode($value);

            // Check if value exists
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM {$field_values_table} WHERE task_id = %d AND field_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $task_id,
                $field_id
            ));

            if ($existing) {
                // Update existing value
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
                $wpdb->update(
                    $field_values_table,
                    [
                        'field_value' => $encoded_value,
                        'updated_at' => current_time('mysql')
                    ],
                    [
                        'task_id' => $task_id,
                        'field_id' => $field_id
                    ],
                    ['%s', '%s'],
                    ['%d', '%d']
                );
            } else {
                // Insert new value
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
                $wpdb->insert(
                    $field_values_table,
                    [
                        'task_id' => $task_id,
                        'field_id' => $field_id,
                        'field_value' => $encoded_value,
                        'created_at' => current_time('mysql'),
                        'updated_at' => current_time('mysql')
                    ],
                    ['%d', '%d', '%s', '%s', '%s']
                );
            }
        }

        return true;
    }

    /**
     * Get a custom field by field name and entity type.
     *
     * @since    1.1.7
     * @param    string    $field_name    The field name.
     * @param    string    $entity_type   The entity type.
     * @return   array|null               The custom field or null if not found.
     */
    private function get_custom_field_by_name(string $field_name, string $entity_type = 'task'): ?array
    {
        global $wpdb;
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
        $sql = "SELECT * FROM {$custom_fields_table} WHERE field_name = %s AND entity_type = %s LIMIT 1";
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $result = $wpdb->get_row(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is prepared here
            $wpdb->prepare($sql, $field_name, $entity_type),
            ARRAY_A
        );

        return $result ?: null;
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
     * Send task assignment email to team member.
     *
     * @since    1.3.0
     * @param    int      $task_id            Task ID.
     * @param    int      $assigned_to_user_id User ID of assignee.
     * @param    int      $assigned_by_user_id User ID who assigned the task.
     * @return   bool     True on success, false on failure.
     */
    public function send_task_assignment_email($task_id, $assigned_to_user_id, $assigned_by_user_id)
    {
        $task = $this->get_task($task_id);
        if (!$task) {
            return false;
        }

        $assigned_to_user = get_userdata($assigned_to_user_id);
        if (!$assigned_to_user || !$assigned_to_user->user_email) {
            return false;
        }

        $assigned_by_user = get_userdata($assigned_by_user_id);
        $assigned_by_name = $assigned_by_user ? $assigned_by_user->display_name : __('System', 'helpmate-ai-chatbot');

        $shop_name = get_bloginfo('name');
        $first_name = get_user_meta($assigned_to_user_id, 'first_name', true) ?: $assigned_to_user->display_name;
        $task_url = admin_url('admin.php?page=helpmate&tab=crm&subtab=tasks&task_id=' . $task_id);

        // Get task details
        $status = 'To Do';
        $priority = '';
        $due_date_text = '';
        $description_text = '';

        if (!empty($task['custom_fields'])) {
            foreach ($task['custom_fields'] as $field) {
                if ($field['field_name'] === 'status') {
                    $status = is_array($field['value']) ? implode(', ', $field['value']) : (string) $field['value'];
                }
                if ($field['field_name'] === 'priority') {
                    $priority = is_array($field['value']) ? implode(', ', $field['value']) : (string) $field['value'];
                }
            }
        }

        if (!empty($task['due_date'])) {
            $due_date_text = gmdate('F j, Y', strtotime($task['due_date']));
        }

        if (!empty($task['description'])) {
            $description_text = wp_trim_words(wp_strip_all_tags($task['description']), 50);
        }

        // Build body text
        $body_text = sprintf(
            /* translators: %s: Name of the person who assigned the task */
            __('A new task has been assigned to you by %s.', 'helpmate-ai-chatbot'),
            esc_html($assigned_by_name)
        );

        // Build task details
        $priority_html = $priority ? '<strong>' . __('Priority:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($priority) . '<br>' : '';
        $due_date_html = $due_date_text ? '<strong>' . __('Due Date:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($due_date_text) . '<br>' : '';
        $description_html = $description_text ? '<strong>' . __('Description:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($description_text) . '<br>' : '';

        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Task Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Title:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($task['title']) . '<br>
                            <strong>' . __('Status:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($status) . '<br>
                            ' . $priority_html . '
                            ' . $due_date_html . '
                            ' . $description_html . '
                        </div>
                    </div>';

        // Build button
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($task_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Task', 'helpmate-ai-chatbot') . '</a>
                </div>';

        /* translators: %s: Task title */
        $email_title = sprintf(__('New Task Assigned: %s', 'helpmate-ai-chatbot'), esc_html($task['title']));

        // Build email HTML
        $body = $this->build_email_html(
            $first_name,
            $email_title,
            $body_text,
            $box_content,
            $button_html
        );

        /* translators: %s: Task title */
        $subject = sprintf(__('New Task Assigned: %s', 'helpmate-ai-chatbot'), $task['title']);

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        return wp_mail($assigned_to_user->user_email, $subject, $body, $headers);
    }

    /**
     * Send task reassignment email notifications.
     *
     * @since    1.3.0
     * @param    int      $task_id            Task ID.
     * @param    int      $new_assignee_id     User ID of new assignee.
     * @param    int      $old_assignee_id     User ID of previous assignee (can be null).
     * @param    int      $updated_by_id       User ID who made the change.
     * @return   bool     True on success, false on failure.
     */
    public function send_task_reassignment_email($task_id, $new_assignee_id, $old_assignee_id, $updated_by_id)
    {
        $task = $this->get_task($task_id);
        if (!$task) {
            return false;
        }

        $shop_name = get_bloginfo('name');
        $task_url = admin_url('admin.php?page=helpmate&tab=crm&subtab=tasks&task_id=' . $task_id);
        $updated_by_user = get_userdata($updated_by_id);
        $updated_by_name = $updated_by_user ? $updated_by_user->display_name : __('System', 'helpmate-ai-chatbot');

        $result = true;

        // Email to new assignee
        $new_assignee = get_userdata($new_assignee_id);
        if ($new_assignee && $new_assignee->user_email) {
            $first_name = get_user_meta($new_assignee_id, 'first_name', true) ?: $new_assignee->display_name;

            $body_text = sprintf(
                /* translators: %s: Name of the person who reassigned the task */
                __('This task has been reassigned to you by %s.', 'helpmate-ai-chatbot'),
                esc_html($updated_by_name)
            );

            $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                            <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Task Details', 'helpmate-ai-chatbot') . '</div>
                            <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                                <strong>' . __('Title:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($task['title']) . '
                            </div>
                        </div>';

            $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                        <a href="' . esc_url($task_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Task', 'helpmate-ai-chatbot') . '</a>
                    </div>';

            /* translators: %s: Task title */
            $email_title = sprintf(__('New Task Assigned: %s', 'helpmate-ai-chatbot'), esc_html($task['title']));

            $body = $this->build_email_html(
                $first_name,
                $email_title,
                $body_text,
                $box_content,
                $button_html
            );

            /* translators: %s: Task title */
            $subject = sprintf(__('New Task Assigned: %s', 'helpmate-ai-chatbot'), $task['title']);
            $headers = ['Content-Type: text/html; charset=UTF-8'];

            $result = wp_mail($new_assignee->user_email, $subject, $body, $headers) && $result;
        }

        // Email to old assignee (if exists and different from new)
        if ($old_assignee_id && $old_assignee_id != $new_assignee_id) {
            $old_assignee = get_userdata($old_assignee_id);
            if ($old_assignee && $old_assignee->user_email) {
                $first_name = get_user_meta($old_assignee_id, 'first_name', true) ?: $old_assignee->display_name;

                $body_text = sprintf(
                    /* translators: 1: Task title, 2: Name of the person who reassigned the task */
                    __('The task "%1$s" has been reassigned to another team member by %2$s.', 'helpmate-ai-chatbot'),
                    esc_html($task['title']),
                    esc_html($updated_by_name)
                );

                $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                            <a href="' . esc_url($task_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Task', 'helpmate-ai-chatbot') . '</a>
                        </div>';

                /* translators: %s: Task title */
                $email_title = sprintf(__('Task Reassigned: %s', 'helpmate-ai-chatbot'), esc_html($task['title']));

                $body = $this->build_email_html(
                    $first_name,
                    $email_title,
                    $body_text,
                    '',
                    $button_html
                );

                /* translators: %s: Task title */
                $subject = sprintf(__('Task Reassigned: %s', 'helpmate-ai-chatbot'), $task['title']);
                $headers = ['Content-Type: text/html; charset=UTF-8'];

                $result = wp_mail($old_assignee->user_email, $subject, $body, $headers) && $result;
            }
        }

        return $result;
    }

    /**
     * Send task due date changed email notification.
     *
     * @since    1.3.0
     * @param    int      $task_id        Task ID.
     * @param    string   $old_due_date   Old due date.
     * @param    string   $new_due_date   New due date.
     * @return   bool     True on success, false on failure.
     */
    public function send_task_due_date_changed_email($task_id, $old_due_date, $new_due_date)
    {
        $task = $this->get_task($task_id);
        if (!$task || !$task['assigned_to']) {
            return false;
        }

        $assigned_to_user = get_userdata($task['assigned_to']);
        if (!$assigned_to_user || !$assigned_to_user->user_email) {
            return false;
        }

        $shop_name = get_bloginfo('name');
        $first_name = get_user_meta($task['assigned_to'], 'first_name', true) ?: $assigned_to_user->display_name;
        $task_url = admin_url('admin.php?page=helpmate&tab=crm&subtab=tasks&task_id=' . $task_id);

        $old_date_text = $old_due_date ? gmdate('F j, Y', strtotime($old_due_date)) : __('Not set', 'helpmate-ai-chatbot');
        $new_date_text = $new_due_date ? gmdate('F j, Y', strtotime($new_due_date)) : __('Not set', 'helpmate-ai-chatbot');

        // Build body text
        $body_text = __('The due date for your assigned task has been updated.', 'helpmate-ai-chatbot');

        // Build details box
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Due Date Change', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Task:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($task['title']) . '<br>
                            <strong>' . __('Previous Due Date:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($old_date_text) . '<br>
                            <strong>' . __('New Due Date:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($new_date_text) . '
                        </div>
                    </div>';

        // Build button
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($task_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Task', 'helpmate-ai-chatbot') . '</a>
                </div>';

        /* translators: %s: Task title */
        $email_title = sprintf(__('Task Due Date Updated: %s', 'helpmate-ai-chatbot'), esc_html($task['title']));

        // Build email HTML
        $body = $this->build_email_html(
            $first_name,
            $email_title,
            $body_text,
            $box_content,
            $button_html
        );

        /* translators: %s: Task title */
        $subject = sprintf(__('Task Due Date Updated: %s', 'helpmate-ai-chatbot'), $task['title']);

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        return wp_mail($assigned_to_user->user_email, $subject, $body, $headers);
    }

    /**
     * Send overdue task reminder email.
     *
     * @since    1.3.0
     * @param    int      $task_id    Task ID.
     * @return   bool     True on success, false on failure.
     */
    public function send_overdue_task_reminder($task_id)
    {
        $task = $this->get_task($task_id);
        if (!$task || !$task['assigned_to'] || empty($task['due_date'])) {
            return false;
        }

        // Check if task is actually overdue
        if (!$task['is_overdue']) {
            return false;
        }

        // Check if task is completed (status = 'Done')
        $status = 'To Do';
        if (!empty($task['custom_fields'])) {
            foreach ($task['custom_fields'] as $field) {
                if ($field['field_name'] === 'status') {
                    $status = is_array($field['value']) ? implode(', ', $field['value']) : (string) $field['value'];
                    if (strtolower($status) === 'done' || strtolower($status) === 'completed') {
                        return false; // Don't send reminder for completed tasks
                    }
                }
            }
        }

        $assigned_to_user = get_userdata($task['assigned_to']);
        if (!$assigned_to_user || !$assigned_to_user->user_email) {
            return false;
        }

        $shop_name = get_bloginfo('name');
        $first_name = get_user_meta($task['assigned_to'], 'first_name', true) ?: $assigned_to_user->display_name;
        $task_url = admin_url('admin.php?page=helpmate&tab=crm&subtab=tasks&task_id=' . $task_id);

        // Calculate days overdue
        $due_timestamp = strtotime($task['due_date']);
        $now_timestamp = time();
        $days_overdue = floor(($now_timestamp - $due_timestamp) / DAY_IN_SECONDS);

        // Get priority
        $priority = '';
        if (!empty($task['custom_fields'])) {
            foreach ($task['custom_fields'] as $field) {
                if ($field['field_name'] === 'priority') {
                    $priority = is_array($field['value']) ? implode(', ', $field['value']) : (string) $field['value'];
                }
            }
        }

        // Build body text
        /* translators: %d: Number of days */
        $days_text = $days_overdue === 1 ? __('1 day', 'helpmate-ai-chatbot') : sprintf(__('%d days', 'helpmate-ai-chatbot'), $days_overdue);
        $body_text = sprintf(
            /* translators: %s: Number of days overdue */
            __('This task is overdue by %s. Please review and update the status.', 'helpmate-ai-chatbot'),
            esc_html($days_text)
        );

        // Build task details
        $priority_html = $priority ? '<strong>' . __('Priority:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($priority) . '<br>' : '';
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #dc3545;">
                        <div style="color: #dc3545; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Task Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Title:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($task['title']) . '<br>
                            <strong>' . __('Due Date:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html(gmdate('F j, Y', strtotime($task['due_date']))) . '<br>
                            <strong>' . __('Days Overdue:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($days_text) . '<br>
                            ' . $priority_html . '
                        </div>
                    </div>';

        // Build button (red for overdue)
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($task_url) . '" style="display: inline-block; background-color: #dc3545; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('View Task', 'helpmate-ai-chatbot') . '</a>
                </div>';

        /* translators: %s: Task title */
        $email_title = sprintf(__('Overdue Task Reminder: %s', 'helpmate-ai-chatbot'), esc_html($task['title']));

        // Build email HTML (red colors for overdue)
        $body = $this->build_email_html(
            $first_name,
            $email_title,
            $body_text,
            $box_content,
            $button_html,
            '#dc3545',
            '#dc3545'
        );

        /* translators: %s: Task title */
        $subject = sprintf(__('Overdue Task Reminder: %s', 'helpmate-ai-chatbot'), $task['title']);

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        return wp_mail($assigned_to_user->user_email, $subject, $body, $headers);
    }
}
