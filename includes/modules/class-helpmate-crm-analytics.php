<?php

/**
 * The CRM Analytics module for the Helpmate plugin.
 *
 * Handles CRM analytics data aggregation with role-based filtering.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) exit;

class Helpmate_Crm_Analytics
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
     * Get date range for filter.
     *
     * @since    1.3.0
     * @param    string    $date_filter    The date filter.
     * @return   array                     Array with start and end timestamps.
     */
    private function get_date_range($date_filter)
    {
        $end_date = current_time('timestamp', true);
        $start_date = 0;

        switch ($date_filter) {
            case 'today':
                $start_date = strtotime('today', $end_date);
                break;
            case 'yesterday':
                $start_date = strtotime('yesterday', $end_date);
                $end_date = strtotime('today', $end_date) - 1;
                break;
            case 'last_week':
                $start_date = strtotime('-7 days', $end_date);
                break;
            case 'last_month':
                $start_date = strtotime('-30 days', $end_date);
                break;
            case 'last_year':
                $start_date = strtotime('-365 days', $end_date);
                break;
            default:
                $start_date = strtotime('today', $end_date);
        }

        return [
            'start' => $start_date,
            'end' => $end_date,
            'start_mysql' => gmdate('Y-m-d H:i:s', $start_date),
            'end_mysql' => gmdate('Y-m-d H:i:s', $end_date),
        ];
    }

    /**
     * Get previous period date range for comparison.
     *
     * @since    1.3.0
     * @param    string    $date_filter    The date filter.
     * @param    int       $current_start  Current period start timestamp.
     * @return   array                     Array with start and end timestamps.
     */
    private function get_previous_period_range($date_filter, $current_start)
    {
        $period_length = current_time('timestamp', true) - $current_start;
        $previous_end = $current_start - 1;
        $previous_start = $previous_end - $period_length;

        return [
            'start' => $previous_start,
            'end' => $previous_end,
            'start_mysql' => gmdate('Y-m-d H:i:s', $previous_start),
            'end_mysql' => gmdate('Y-m-d H:i:s', $previous_end),
        ];
    }

    /**
     * Calculate percentage change.
     *
     * @since    1.3.0
     * @param    float    $current    Current value.
     * @param    float    $previous   Previous value.
     * @return   float                Percentage change.
     */
    private function calculate_percentage_change($current, $previous)
    {
        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }
        return (($current - $previous) / $previous) * 100;
    }

    /**
     * Check if user is admin.
     *
     * @since    1.3.0
     * @param    int    $user_id    User ID.
     * @return   bool               True if admin.
     */
    private function is_admin($user_id)
    {
        if (user_can($user_id, 'manage_options')) {
            return true;
        }
        $roles = Helpmate_Permissions::get_user_roles($user_id);
        return in_array('admin', $roles, true);
    }

    /**
     * Get CRM analytics data.
     *
     * @since    1.3.0
     * @param    string    $date_filter    Date filter.
     * @param    int|null  $user_id        Optional user ID for filtering (null = current user).
     * @return   array                     Analytics data.
     */
    public function get_analytics($date_filter = 'today', $user_id = null)
    {
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }

        $is_admin = $this->is_admin($user_id);
        $date_range = $this->get_date_range($date_filter);
        $previous_range = $this->get_previous_period_range($date_filter, $date_range['start']);

        $data = [
            'tasks' => $this->get_tasks_analytics($date_range, $previous_range, $is_admin ? null : $user_id),
            'contacts' => $this->get_contacts_analytics($date_range, $previous_range, $is_admin ? null : $user_id),
            'leads' => $this->get_leads_analytics($date_range, $previous_range, $is_admin ? null : $user_id),
            'tickets' => $this->get_tickets_analytics($date_range, $previous_range, $is_admin ? null : $user_id),
            'emails' => $this->get_emails_analytics($date_range, $previous_range, $is_admin ? null : $user_id),
            'activity_timeline' => $this->get_activity_timeline($date_range, $is_admin ? null : $user_id),
        ];

        if ($is_admin) {
            $data['team_performance'] = $this->get_team_performance($date_range, $previous_range);
        }

        return $data;
    }

    /**
     * Get tasks analytics.
     *
     * @since    1.3.0
     * @param    array      $date_range      Current period date range.
     * @param    array      $previous_range  Previous period date range.
     * @param    int|null   $user_id         Optional user ID filter.
     * @return   array                       Tasks analytics data.
     */
    public function get_tasks_analytics($date_range, $previous_range, $user_id = null)
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');
        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // Current period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $current_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$tasks_table} t WHERE t.created_at >= %s AND t.created_at <= %s AND (t.created_by = %d OR t.assigned_to = %d)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql'],
                $user_id,
                $user_id
            ));
        } else {
            $current_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$tasks_table} t WHERE t.created_at >= %s AND t.created_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql']
            ));
        }

        // Get completed tasks (status = 'Done' or 'Completed')
        // Note: field_value is stored as JSON-encoded string
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $current_completed = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(DISTINCT t.id) FROM {$tasks_table} t
                    INNER JOIN {$field_values_table} fv ON t.id = fv.task_id
                    INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                    WHERE cf.field_name = 'status'
                    AND (fv.field_value LIKE %s OR fv.field_value LIKE %s OR fv.field_value LIKE %s)
                    AND t.updated_at >= %s AND t.updated_at <= %s
                    AND (t.created_by = %d OR t.assigned_to = %d)"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    '%"Done"%',
                    '%"Completed"%',
                    '%"Resolved"%',
                    $date_range['start_mysql'],
                    $date_range['end_mysql'],
                    $user_id,
                    $user_id
                )
            );
        } else {
            $current_completed = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(DISTINCT t.id) FROM {$tasks_table} t
                    INNER JOIN {$field_values_table} fv ON t.id = fv.task_id
                    INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                    WHERE cf.field_name = 'status'
                    AND (fv.field_value LIKE %s OR fv.field_value LIKE %s OR fv.field_value LIKE %s)
                    AND t.updated_at >= %s AND t.updated_at <= %s"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    '%"Done"%',
                    '%"Completed"%',
                    '%"Resolved"%',
                    $date_range['start_mysql'],
                    $date_range['end_mysql']
                )
            );
        }

        // Overdue tasks
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $current_overdue = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(*) FROM {$tasks_table} t
                    WHERE t.due_date IS NOT NULL
                    AND t.due_date < %s
                    AND t.id NOT IN (
                        SELECT DISTINCT t2.id FROM {$tasks_table} t2
                        INNER JOIN {$field_values_table} fv2 ON t2.id = fv2.task_id
                        INNER JOIN {$custom_fields_table} cf2 ON fv2.field_id = cf2.id
                        WHERE cf2.field_name = 'status'
                        AND (fv2.field_value LIKE %s OR fv2.field_value LIKE %s OR fv2.field_value LIKE %s)
                    )
                    AND (t.created_by = %d OR t.assigned_to = %d)"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $date_range['end_mysql'],
                    '%"Done"%',
                    '%"Completed"%',
                    '%"Resolved"%',
                    $user_id,
                    $user_id
                )
            );
        } else {
            $current_overdue = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(*) FROM {$tasks_table} t
                    WHERE t.due_date IS NOT NULL
                    AND t.due_date < %s
                    AND t.id NOT IN (
                        SELECT DISTINCT t2.id FROM {$tasks_table} t2
                        INNER JOIN {$field_values_table} fv2 ON t2.id = fv2.task_id
                        INNER JOIN {$custom_fields_table} cf2 ON fv2.field_id = cf2.id
                        WHERE cf2.field_name = 'status'
                        AND (fv2.field_value LIKE %s OR fv2.field_value LIKE %s OR fv2.field_value LIKE %s)
                    )"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $date_range['end_mysql'],
                    '%"Done"%',
                    '%"Completed"%',
                    '%"Resolved"%'
                )
            );
        }

        // Previous period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $previous_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$tasks_table} t WHERE t.created_at >= %s AND t.created_at <= %s AND (t.created_by = %d OR t.assigned_to = %d)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql'],
                $user_id,
                $user_id
            ));
        } else {
            $previous_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$tasks_table} t WHERE t.created_at >= %s AND t.created_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql']
            ));
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $previous_completed = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(DISTINCT t.id) FROM {$tasks_table} t
                    INNER JOIN {$field_values_table} fv ON t.id = fv.task_id
                    INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                    WHERE cf.field_name = 'status'
                    AND (fv.field_value LIKE %s OR fv.field_value LIKE %s OR fv.field_value LIKE %s)
                    AND t.updated_at >= %s AND t.updated_at <= %s
                    AND (t.created_by = %d OR t.assigned_to = %d)"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    '%"Done"%',
                    '%"Completed"%',
                    '%"Resolved"%',
                    $previous_range['start_mysql'],
                    $previous_range['end_mysql'],
                    $user_id,
                    $user_id
                )
            );
        } else {
            $previous_completed = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(DISTINCT t.id) FROM {$tasks_table} t
                    INNER JOIN {$field_values_table} fv ON t.id = fv.task_id
                    INNER JOIN {$custom_fields_table} cf ON fv.field_id = cf.id
                    WHERE cf.field_name = 'status'
                    AND (fv.field_value LIKE %s OR fv.field_value LIKE %s OR fv.field_value LIKE %s)
                    AND t.updated_at >= %s AND t.updated_at <= %s"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    '%"Done"%',
                    '%"Completed"%',
                    '%"Resolved"%',
                    $previous_range['start_mysql'],
                    $previous_range['end_mysql']
                )
            );
        }

        $completion_rate = $current_created > 0 ? ($current_completed / $current_created) * 100 : 0;
        $previous_completion_rate = $previous_created > 0 ? ($previous_completed / $previous_created) * 100 : 0;

        return [
            'created' => $current_created,
            'completed' => $current_completed,
            'overdue' => $current_overdue,
            'completion_rate' => round($completion_rate, 2),
            'comparison' => [
                'created_change' => round($this->calculate_percentage_change($current_created, $previous_created), 2),
                'completed_change' => round($this->calculate_percentage_change($current_completed, $previous_completed), 2),
                'completion_rate_change' => round($completion_rate - $previous_completion_rate, 2),
            ],
        ];
    }

    /**
     * Get contacts analytics.
     *
     * @since    1.3.0
     * @param    array      $date_range      Current period date range.
     * @param    array      $previous_range  Previous period date range.
     * @param    int|null   $user_id         Optional user ID filter.
     * @return   array                       Contacts analytics data.
     */
    public function get_contacts_analytics($date_range, $previous_range, $user_id = null)
    {
        global $wpdb;
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // Note: Contacts don't have created_by field, so we can't filter by user
        // For non-admin users, we'll return empty/zero data or filter by wp_user_id if available
        $filter_by_user = ($user_id && !$this->is_admin($user_id));

        // Current period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($filter_by_user) {
            $current_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.created_at >= %s AND c.created_at <= %s AND c.wp_user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql'],
                $user_id
            ));
        } else {
            $current_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.created_at >= %s AND c.created_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql']
            ));
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($filter_by_user) {
            $current_updated = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.updated_at >= %s AND c.updated_at <= %s AND c.updated_at != c.created_at AND c.wp_user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql'],
                $user_id
            ));
        } else {
            $current_updated = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.updated_at >= %s AND c.updated_at <= %s AND c.updated_at != c.created_at", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql']
            ));
        }

        if ($filter_by_user) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $current_total = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.wp_user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    $user_id
                )
            );
        } else {
            $current_total = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COUNT(*) FROM {$contacts_table} c"
            );
        }

        // Previous period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($filter_by_user) {
            $previous_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.created_at >= %s AND c.created_at <= %s AND c.wp_user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql'],
                $user_id
            ));
        } else {
            $previous_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.created_at >= %s AND c.created_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql']
            ));
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($filter_by_user) {
            $previous_updated = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.updated_at >= %s AND c.updated_at <= %s AND c.updated_at != c.created_at AND c.wp_user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql'],
                $user_id
            ));
        } else {
            $previous_updated = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$contacts_table} c WHERE c.updated_at >= %s AND c.updated_at <= %s AND c.updated_at != c.created_at", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql']
            ));
        }

        return [
            'created' => $current_created,
            'updated' => $current_updated,
            'total' => $current_total,
            'comparison' => [
                'created_change' => round($this->calculate_percentage_change($current_created, $previous_created), 2),
                'updated_change' => round($this->calculate_percentage_change($current_updated, $previous_updated), 2),
            ],
        ];
    }

    /**
     * Get leads analytics.
     *
     * @since    1.3.0
     * @param    array      $date_range      Current period date range.
     * @param    array      $previous_range  Previous period date range.
     * @param    int|null   $user_id         Optional user ID filter.
     * @return   array                       Leads analytics data.
     */
    public function get_leads_analytics($date_range, $previous_range, $user_id = null)
    {
        global $wpdb;
        $leads_table = esc_sql($wpdb->prefix . 'helpmate_leads');

        // Leads don't have user_id field, so we can't filter by user
        // For non-admin users, return limited data
        $user_filter = '';
        if ($user_id && !$this->is_admin($user_id)) {
            // Leads are typically not user-specific, return empty for non-admins
            return [
                'created' => 0,
                'converted' => 0,
                'conversion_rate' => 0,
                'by_source' => [],
                'comparison' => [
                    'created_change' => 0,
                    'converted_change' => 0,
                    'conversion_rate_change' => 0,
                ],
            ];
        }

        // Current period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $current_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*) FROM {$leads_table} WHERE timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            $date_range['start'],
            $date_range['end']
        ));

        // Get leads by source
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $leads_by_source = $wpdb->get_results($wpdb->prepare(
            "SELECT source, COUNT(*) as count FROM {$leads_table} WHERE timestamp >= %d AND timestamp <= %d GROUP BY source", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            $date_range['start'],
            $date_range['end']
        ), ARRAY_A);

        $by_source = [];
        foreach ($leads_by_source as $row) {
            $source = $row['source'] ?? 'unknown';
            $by_source[$source] = (int) $row['count'];
        }

        // Check if leads table has contact_id column to determine conversions
        // A lead is considered "converted" if it has a contact_id (linked to a contact)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $current_converted = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$leads_table} WHERE contact_id IS NOT NULL AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            $date_range['start'],
            $date_range['end']
        ));

        // Previous period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $previous_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*) FROM {$leads_table} WHERE timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            $previous_range['start'],
            $previous_range['end']
        ));

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $previous_converted = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$leads_table} WHERE contact_id IS NOT NULL AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            $previous_range['start'],
            $previous_range['end']
        ));

        $conversion_rate = $current_created > 0 ? ($current_converted / $current_created) * 100 : 0;
        $previous_conversion_rate = $previous_created > 0 ? ($previous_converted / $previous_created) * 100 : 0;

        return [
            'created' => $current_created,
            'converted' => $current_converted,
            'conversion_rate' => round($conversion_rate, 2),
            'by_source' => $by_source,
            'comparison' => [
                'created_change' => round($this->calculate_percentage_change($current_created, $previous_created), 2),
                'converted_change' => round($this->calculate_percentage_change($current_converted, $previous_converted), 2),
                'conversion_rate_change' => round($conversion_rate - $previous_conversion_rate, 2),
            ],
        ];
    }

    /**
     * Get tickets analytics.
     *
     * @since    1.3.0
     * @param    array      $date_range      Current period date range.
     * @param    array      $previous_range  Previous period date range.
     * @param    int|null   $user_id         Optional user ID filter.
     * @return   array                       Tickets analytics data.
     */
    public function get_tickets_analytics($date_range, $previous_range, $user_id = null)
    {
        global $wpdb;
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');

        // Current period - created (role = 'user')
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $current_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user' AND timestamp >= %d AND timestamp <= %d AND user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end'],
                $user_id
            ));
        } else {
            $current_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user' AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end']
            ));
        }

        // Current period - resolved
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $current_resolved = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE status = 'resolved' AND timestamp >= %d AND timestamp <= %d AND user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end'],
                $user_id
            ));
        } else {
            $current_resolved = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE status = 'resolved' AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end']
            ));
        }

        // Get tickets by source (only for non-user-filtered queries)
        $by_source = [];
        if (!$user_id) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $tickets_by_source = $wpdb->get_results($wpdb->prepare(
                "SELECT source, COUNT(DISTINCT ticket_id) as count FROM {$tickets_table} WHERE role = 'user' AND timestamp >= %d AND timestamp <= %d GROUP BY source", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end']
            ), ARRAY_A);

            foreach ($tickets_by_source as $row) {
                $source = $row['source'] ?? 'unknown';
                $by_source[$source] = (int) $row['count'];
            }
        }

        // Get CRM-linked tickets (tickets with contact_id)
        if ($user_id) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $crm_linked = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user' AND contact_id IS NOT NULL AND timestamp >= %d AND timestamp <= %d AND user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end'],
                $user_id
            ));
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $crm_linked = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user' AND contact_id IS NOT NULL AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end']
            ));
        }

        $crm_link_rate = $current_created > 0 ? (($crm_linked / $current_created) * 100) : 0;

        // Current period - open
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $current_open = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} t1
                    WHERE t1.status IN ('open', 'in_progress')
                    AND t1.ticket_id NOT IN (
                        SELECT DISTINCT ticket_id FROM {$tickets_table} t2
                        WHERE t2.status = 'resolved' AND t2.timestamp >= %d
                    )
                    AND t1.user_id = %d"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $date_range['start'],
                    $user_id
                )
            );
        } else {
            $current_open = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                    "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} t1
                    WHERE t1.status IN ('open', 'in_progress')
                    AND t1.ticket_id NOT IN (
                        SELECT DISTINCT ticket_id FROM {$tickets_table} t2
                        WHERE t2.status = 'resolved' AND t2.timestamp >= %d
                    )"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $date_range['start']
                )
            );
        }

        // Average resolution time (in hours)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $resolution_times = $wpdb->get_results($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT t1.ticket_id, MIN(CASE WHEN t1.role = 'user' THEN t1.timestamp END) as created_time, MIN(CASE WHEN t1.status = 'resolved' THEN t1.timestamp END) as resolved_time FROM {$tickets_table} t1 WHERE t1.timestamp >= %d AND t1.timestamp <= %d AND t1.user_id = %d GROUP BY t1.ticket_id HAVING created_time IS NOT NULL AND resolved_time IS NOT NULL", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end'],
                $user_id
            ), ARRAY_A);
        } else {
            $resolution_times = $wpdb->get_results($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT t1.ticket_id, MIN(CASE WHEN t1.role = 'user' THEN t1.timestamp END) as created_time, MIN(CASE WHEN t1.status = 'resolved' THEN t1.timestamp END) as resolved_time FROM {$tickets_table} t1 WHERE t1.timestamp >= %d AND t1.timestamp <= %d GROUP BY t1.ticket_id HAVING created_time IS NOT NULL AND resolved_time IS NOT NULL", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end']
            ), ARRAY_A);
        }

        $total_resolution_time = 0;
        $resolved_count = 0;
        foreach ($resolution_times as $ticket) {
            if ($ticket['created_time'] && $ticket['resolved_time']) {
                $total_resolution_time += ($ticket['resolved_time'] - $ticket['created_time']) / 3600; // Convert to hours
                $resolved_count++;
            }
        }
        $current_avg_resolution_time = $resolved_count > 0 ? $total_resolution_time / $resolved_count : 0;

        // Previous period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $previous_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user' AND timestamp >= %d AND timestamp <= %d AND user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start'],
                $previous_range['end'],
                $user_id
            ));
        } else {
            $previous_created = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE role = 'user' AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start'],
                $previous_range['end']
            ));
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $previous_resolved = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE status = 'resolved' AND timestamp >= %d AND timestamp <= %d AND user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start'],
                $previous_range['end'],
                $user_id
            ));
        } else {
            $previous_resolved = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE status = 'resolved' AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start'],
                $previous_range['end']
            ));
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $previous_resolution_times = $wpdb->get_results($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT t1.ticket_id, MIN(CASE WHEN t1.role = 'user' THEN t1.timestamp END) as created_time, MIN(CASE WHEN t1.status = 'resolved' THEN t1.timestamp END) as resolved_time FROM {$tickets_table} t1 WHERE t1.timestamp >= %d AND t1.timestamp <= %d AND t1.user_id = %d GROUP BY t1.ticket_id HAVING created_time IS NOT NULL AND resolved_time IS NOT NULL", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start'],
                $previous_range['end'],
                $user_id
            ), ARRAY_A);
        } else {
            $previous_resolution_times = $wpdb->get_results($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT t1.ticket_id, MIN(CASE WHEN t1.role = 'user' THEN t1.timestamp END) as created_time, MIN(CASE WHEN t1.status = 'resolved' THEN t1.timestamp END) as resolved_time FROM {$tickets_table} t1 WHERE t1.timestamp >= %d AND t1.timestamp <= %d GROUP BY t1.ticket_id HAVING created_time IS NOT NULL AND resolved_time IS NOT NULL", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start'],
                $previous_range['end']
            ), ARRAY_A);
        }

        $previous_total_resolution_time = 0;
        $previous_resolved_count = 0;
        foreach ($previous_resolution_times as $ticket) {
            if ($ticket['created_time'] && $ticket['resolved_time']) {
                $previous_total_resolution_time += ($ticket['resolved_time'] - $ticket['created_time']) / 3600;
                $previous_resolved_count++;
            }
        }
        $previous_avg_resolution_time = $previous_resolved_count > 0 ? $previous_total_resolution_time / $previous_resolved_count : 0;

        return [
            'created' => $current_created,
            'resolved' => $current_resolved,
            'open' => $current_open,
            'avg_resolution_time' => round($current_avg_resolution_time, 2),
            'by_source' => $by_source,
            'crm_linked' => $crm_linked,
            'crm_link_rate' => round($crm_link_rate, 2),
            'comparison' => [
                'created_change' => round($this->calculate_percentage_change($current_created, $previous_created), 2),
                'resolved_change' => round($this->calculate_percentage_change($current_resolved, $previous_resolved), 2),
                'resolution_time_change' => round($this->calculate_percentage_change($current_avg_resolution_time, $previous_avg_resolution_time), 2),
            ],
        ];
    }

    /**
     * Get emails analytics.
     *
     * @since    1.3.0
     * @param    array      $date_range      Current period date range.
     * @param    array      $previous_range  Previous period date range.
     * @param    int|null   $user_id         Optional user ID filter.
     * @return   array                       Emails analytics data.
     */
    public function get_emails_analytics($date_range, $previous_range, $user_id = null)
    {
        global $wpdb;
        $emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');

        // Current period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $current_sent = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$emails_table} WHERE sent_at >= %s AND sent_at <= %s AND sent_by = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql'],
                $user_id
            ));
        } else {
            $current_sent = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$emails_table} WHERE sent_at >= %s AND sent_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start_mysql'],
                $date_range['end_mysql']
            ));
        }

        // Previous period
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $previous_sent = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$emails_table} WHERE sent_at >= %s AND sent_at <= %s AND sent_by = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql'],
                $user_id
            ));
        } else {
            $previous_sent = (int) $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT COUNT(*) FROM {$emails_table} WHERE sent_at >= %s AND sent_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $previous_range['start_mysql'],
                $previous_range['end_mysql']
            ));
        }

        return [
            'sent' => $current_sent,
            'comparison' => [
                'sent_change' => round($this->calculate_percentage_change($current_sent, $previous_sent), 2),
            ],
        ];
    }

    /**
     * Get team performance (admin only).
     *
     * @since    1.3.0
     * @param    array    $date_range      Current period date range.
     * @param    array    $previous_range  Previous period date range.
     * @return   array                     Team performance data.
     */
    public function get_team_performance($date_range, $previous_range)
    {
        global $wpdb;
        $team_table = esc_sql($wpdb->prefix . 'helpmate_team_members');
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // Get all team members
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $team_members = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT DISTINCT user_id FROM {$team_table}",
            ARRAY_A
        );

        $performance = [];

        foreach ($team_members as $member) {
            $user_id = (int) $member['user_id'];
            $user = get_userdata($user_id);
            if (!$user) {
                continue;
            }

            // Tasks
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $tasks_created = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$tasks_table} WHERE created_by = %d AND created_at >= %s AND created_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $user_id,
                $date_range['start_mysql'],
                $date_range['end_mysql']
            ));

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $tasks_completed = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$tasks_table} WHERE assigned_to = %d AND updated_at >= %s AND updated_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $user_id,
                $date_range['start_mysql'],
                $date_range['end_mysql']
            ));

            // Tickets resolved
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $tickets_resolved = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT ticket_id) FROM {$tickets_table} WHERE user_id = %d AND status = 'resolved' AND timestamp >= %d AND timestamp <= %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $user_id,
                $date_range['start'],
                $date_range['end']
            ));

            // Contacts created (via wp_user_id)
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $contacts_created = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$contacts_table} WHERE wp_user_id = %d AND created_at >= %s AND created_at <= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $user_id,
                $date_range['start_mysql'],
                $date_range['end_mysql']
            ));

            $performance[] = [
                'user_id' => $user_id,
                'display_name' => $user->display_name,
                'email' => $user->user_email,
                'tasks_created' => $tasks_created,
                'tasks_completed' => $tasks_completed,
                'tickets_resolved' => $tickets_resolved,
                'contacts_created' => $contacts_created,
            ];
        }

        return $performance;
    }

    /**
     * Get activity timeline.
     *
     * @since    1.3.0
     * @param    array      $date_range    Date range.
     * @param    int|null   $user_id       Optional user ID filter.
     * @return   array                     Activity timeline data.
     */
    public function get_activity_timeline($date_range, $user_id = null)
    {
        global $wpdb;
        $tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $leads_table = esc_sql($wpdb->prefix . 'helpmate_leads');

        $activities = [];

        // Tasks created
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $tasks = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT id, title, created_at, created_by FROM {$tasks_table} WHERE created_at >= %s AND created_at <= %s AND (created_by = %d OR assigned_to = %d) ORDER BY created_at DESC LIMIT 20", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    $date_range['start_mysql'],
                    $date_range['end_mysql'],
                    $user_id,
                    $user_id
                ),
                ARRAY_A
            );
        } else {
            $tasks = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT id, title, created_at, created_by FROM {$tasks_table} WHERE created_at >= %s AND created_at <= %s ORDER BY created_at DESC LIMIT 20", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    $date_range['start_mysql'],
                    $date_range['end_mysql']
                ),
                ARRAY_A
            );
        }

        foreach ($tasks as $task) {
            $user = get_userdata($task['created_by']);
            $activities[] = [
                'type' => 'task_created',
                'id' => $task['id'],
                'title' => $task['title'],
                'timestamp' => strtotime($task['created_at']),
                'user' => $user ? $user->display_name : 'Unknown',
            ];
        }

        // Tickets created
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id) {
            $tickets = $wpdb->get_results($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT DISTINCT ticket_id, subject, timestamp, user_id FROM {$tickets_table} WHERE role = 'user' AND timestamp >= %d AND timestamp <= %d AND user_id = %d ORDER BY timestamp DESC LIMIT 20", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end'],
                $user_id
            ), ARRAY_A);
        } else {
            $tickets = $wpdb->get_results($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT DISTINCT ticket_id, subject, timestamp, user_id FROM {$tickets_table} WHERE role = 'user' AND timestamp >= %d AND timestamp <= %d ORDER BY timestamp DESC LIMIT 20", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $date_range['start'],
                $date_range['end']
            ), ARRAY_A);
        }

        foreach ($tickets as $ticket) {
            $user = $ticket['user_id'] ? get_userdata($ticket['user_id']) : null;
            $activities[] = [
                'type' => 'ticket_created',
                'id' => $ticket['ticket_id'],
                'title' => $ticket['subject'],
                'timestamp' => $ticket['timestamp'],
                'user' => $user ? $user->display_name : 'Guest',
            ];
        }

        // Contacts created
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        if ($user_id && !$this->is_admin($user_id)) {
            $contacts = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT id, CONCAT(first_name, ' ', last_name) as name, created_at FROM {$contacts_table} WHERE created_at >= %s AND created_at <= %s AND wp_user_id = %d ORDER BY created_at DESC LIMIT 20", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    $date_range['start_mysql'],
                    $date_range['end_mysql'],
                    $user_id
                ),
                ARRAY_A
            );
        } else {
            $contacts = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT id, CONCAT(first_name, ' ', last_name) as name, created_at FROM {$contacts_table} WHERE created_at >= %s AND created_at <= %s ORDER BY created_at DESC LIMIT 20", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    $date_range['start_mysql'],
                    $date_range['end_mysql']
                ),
                ARRAY_A
            );
        }

        foreach ($contacts as $contact) {
            $activities[] = [
                'type' => 'contact_created',
                'id' => $contact['id'],
                'title' => $contact['name'] ?: 'Unnamed Contact',
                'timestamp' => strtotime($contact['created_at']),
                'user' => 'System',
            ];
        }

        // Sort by timestamp descending
        usort($activities, function ($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });

        return array_slice($activities, 0, 30); // Return top 30 activities
    }
}

