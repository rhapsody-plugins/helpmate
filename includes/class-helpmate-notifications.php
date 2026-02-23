<?php

/**
 * Notifications for admin and team members (SSE-driven).
 *
 * Handles create, list, mark-read, delete, clear-all, and visibility (admin = global only, team = own only).
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) {
    exit;
}

class Helpmate_Notifications
{

    /**
     * Helpmate instance.
     *
     * @since 1.3.0
     * @var Helpmate
     */
    private $helpmate;

    /**
     * Constructor.
     *
     * @since 1.3.0
     * @param Helpmate $helpmate Helpmate instance.
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Whether current user is "admin" for notifications (sees only global user_id=0).
     * Requires both WordPress manage_options and Helpmate team role "admin".
     *
     * @since 1.3.0
     * @return bool
     */
    public function is_admin_for_notifications()
    {
        $user_id = get_current_user_id();
        if (!$user_id || !current_user_can('manage_options')) {
            return false;
        }
        $team = $this->helpmate->get_team();
        $roles = $team->get_user_roles($user_id);
        return is_array($roles) && in_array('admin', $roles, true);
    }

    /**
     * Build WHERE fragment and params for notifications visible to current user.
     * Global (user_id = 0) are visible to anyone with access; per-user only to that user.
     *
     * @since 1.3.0
     * @return array{where: string, params: array}
     */
    public function get_visible_where()
    {
        $user_id = get_current_user_id();
        if ($this->is_admin_for_notifications()) {
            return [
                'where' => ' user_id = 0 ',
                'params' => [],
            ];
        }
        // Show global (user_id=0) and own notifications so e.g. new ticket alerts appear for all staff
        if ($user_id) {
            return [
                'where' => ' ( user_id = 0 OR user_id = %d ) ',
                'params' => [ $user_id ],
            ];
        }
        return [
            'where' => ' user_id = 0 ',
            'params' => [],
        ];
    }

    /**
     * Create a notification.
     *
     * @since 1.3.0
     * @param int    $user_id     0 = global (admins only), else target user ID.
     * @param string $type        Type (e.g. conversation, message, ticket, lead).
     * @param string $title       Title.
     * @param string $body        Optional body.
     * @param string $link        Optional link URL.
     * @param array  $meta        Optional meta (stored as JSON).
     * @param string $entity_type Optional entity type for mark-read-by-entity.
     * @param int    $entity_id   Optional entity ID.
     * @return int|false Insert ID or false.
     */
    public function create($user_id, $type, $title, $body = '', $link = '', $meta = [], $entity_type = null, $entity_id = null)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');

        $user_id = (int) $user_id;
        $type = sanitize_text_field($type);
        $title = sanitize_text_field($title);
        $body = sanitize_textarea_field($body);
        $link = esc_url_raw($link);
        $meta_json = is_array($meta) ? wp_json_encode($meta) : '{}';
        $entity_type = $entity_type ? sanitize_text_field($entity_type) : null;
        $entity_id = $entity_id !== null ? (int) $entity_id : null;

        $now = current_time('mysql');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
        $r = $wpdb->insert(
            $table,
            [
                'user_id'      => $user_id,
                'type'         => $type,
                'title'        => $title,
                'body'         => $body,
                'link'         => $link,
                'meta'         => $meta_json,
                'read_at'      => null,
                'created_at'   => $now,
                'entity_type'  => $entity_type,
                'entity_id'    => $entity_id,
            ],
            [ '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d' ]
        );

        return $r ? (int) $wpdb->insert_id : false;
    }

    /**
     * Get paginated list of notifications visible to current user.
     *
     * @since 1.3.0
     * @param int         $page     Page (1-based).
     * @param int         $per_page Per page.
     * @param string|null $read     'read' | 'unread' | null for all.
     * @param string|null $type     Filter by type.
     * @return array{items: array, total: int}
     */
    public function get_list($page = 1, $per_page = 20, $read = null, $type = null)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $where = $visible['where'];
        $params = $visible['params'];

        if ($read === 'read') {
            $where .= ' AND read_at IS NOT NULL ';
        } elseif ($read === 'unread') {
            $where .= ' AND read_at IS NULL ';
        }

        if ($type !== null && $type !== '') {
            $where .= ' AND type = %s ';
            $params[] = sanitize_text_field($type);
        }

        $offset = max(0, ((int) $page) - 1) * max(1, (int) $per_page);
        $per_page = max(1, min(100, (int) $per_page));

        $count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where}";
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Count query; WHERE/params from same build and prepare(); get_visible_where() returns safe format
        $total = (int) $wpdb->get_var(
            $params ? $wpdb->prepare($count_sql, ...$params) : $count_sql // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query and params from same build; prepare() used when params non-empty
        );

        $order = ' ORDER BY created_at DESC LIMIT %d OFFSET %d ';
        $params[] = $per_page;
        $params[] = $offset;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- List query; WHERE/params from same build and prepare(); get_visible_where() returns safe format
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe; placeholders in $where and $order
                "SELECT id, user_id, type, title, body, link, meta, read_at, created_at, entity_type, entity_id FROM {$table} WHERE {$where}{$order}"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                , // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Placeholders in $where and $order
                ...$params
            ),
            ARRAY_A
        );

        $items = [];
        foreach ($rows as $row) {
            $row['meta'] = json_decode($row['meta'], true);
            if (!is_array($row['meta'])) {
                $row['meta'] = [];
            }
            $items[] = $row;
        }

        return [ 'items' => $items, 'total' => $total ];
    }

    /**
     * Get unread counts (total and by_type) for visible notifications.
     *
     * @since 1.3.0
     * @return array{total: int, by_type: array<string, int>}
     */
    public function get_unread_counts()
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $where = $visible['where'] . ' AND read_at IS NULL ';
        $params = $visible['params'];

        $total_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where}";
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Unread count; WHERE from get_visible_where() and prepare(); safe format
        $total = (int) $wpdb->get_var(
            $params ? $wpdb->prepare($total_sql, ...$params) : $total_sql // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query and params from same build; prepare() used when params non-empty
        );

        $by_type_sql = "SELECT type, COUNT(*) as cnt FROM {$table} WHERE {$where} GROUP BY type";
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Count query; WHERE from get_visible_where() and prepare(); safe format
        $rows = $wpdb->get_results(
            $params ? $wpdb->prepare($by_type_sql, ...$params) : $by_type_sql, // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query and params from same build; prepare() used when params non-empty
            ARRAY_A
        );

        $by_type = [];
        foreach ($rows as $row) {
            $by_type[ $row['type'] ] = (int) $row['cnt'];
        }

        return [ 'total' => $total, 'by_type' => $by_type ];
    }

    /**
     * Mark a single notification as read (only if visible to current user).
     *
     * @since 1.3.0
     * @param int $id Notification ID.
     * @return bool
     */
    public function mark_read($id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $params = array_merge([ current_time('mysql'), (int) $id ], $visible['params']);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Update; visible['where'] from get_visible_where() safe format, params via prepare()
        $n = $wpdb->query(
            $wpdb->prepare( // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Placeholder count varies by get_visible_where()
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe; placeholder count from get_visible_where()
                "UPDATE {$table} SET read_at = %s WHERE id = %d AND ({$visible['where']})"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                ...$params
            )
        );

        return $n > 0;
    }

    /**
     * Mark multiple notifications as read by ID (only visible ones).
     *
     * @since 1.3.0
     * @param array $ids Array of notification IDs.
     * @return int Number marked.
     */
    public function mark_read_bulk(array $ids)
    {
        if (empty($ids)) {
            return 0;
        }
        $ids = array_map('intval', $ids);
        $ids = array_filter($ids);
        if (empty($ids)) {
            return 0;
        }
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        $params = array_merge($ids, $visible['params']);
        $now = current_time('mysql');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Update; visible['where'] from get_visible_where() safe format, params via prepare()
        return (int) $wpdb->query(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Table name safe; placeholders dynamic
                "UPDATE {$table} SET read_at = %s WHERE id IN ($placeholders) AND ({$visible['where']})"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
                ,
                array_merge([ $now ], $params)
            )
        );
    }

    /**
     * Mark all notifications for an entity as read (only visible to current user).
     *
     * @since 1.3.0
     * @param string $entity_type Entity type (e.g. ticket, conversation).
     * @param int    $entity_id   Entity ID.
     * @return int Number marked.
     */
    public function mark_read_by_entity($entity_type, $entity_id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $where = $visible['where'] . ' AND entity_type = %s AND entity_id = %d AND read_at IS NULL ';
        $params = array_merge($visible['params'], [ sanitize_text_field($entity_type), (int) $entity_id ]);
        $now = current_time('mysql');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Update; where from get_visible_where() safe format, params via prepare()
        return (int) $wpdb->query(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe
                "UPDATE {$table} SET read_at = %s WHERE {$where}"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                array_merge([ $now ], $params)
            )
        );
    }

    /**
     * Mark all notifications of a given type as read (only visible to current user).
     * Used when opening a section with no per-item detail (e.g. Appointments).
     *
     * @since 1.3.0
     * @param string $type Notification type (e.g. appointment).
     * @return int Number marked.
     */
    public function mark_read_by_type($type)
    {
        $type = sanitize_text_field($type);
        if ($type === '') {
            return 0;
        }
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $where = $visible['where'] . ' AND type = %s AND read_at IS NULL ';
        $params = array_merge($visible['params'], [ $type ]);
        $now = current_time('mysql');

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Update; where from get_visible_where() safe format, params via prepare()
        return (int) $wpdb->query(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe
                "UPDATE {$table} SET read_at = %s WHERE {$where}"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                array_merge([ $now ], $params)
            )
        );
    }

    /**
     * Delete one notification (only if visible to current user).
     *
     * @since 1.3.0
     * @param int $id Notification ID.
     * @return bool True if deleted.
     */
    public function delete_one($id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $params = array_merge([ (int) $id ], $visible['params']);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Delete; visible['where'] from get_visible_where() safe format, params via prepare()
        $n = $wpdb->query(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe
                "DELETE FROM {$table} WHERE id = %d AND ({$visible['where']})"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $params
            )
        );

        return $n > 0;
    }

    /**
     * Delete all notifications visible to current user (clear all).
     *
     * @since 1.3.0
     * @return int Number deleted.
     */
    public function clear_all()
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $params = $visible['params'];

        $sql = "DELETE FROM {$table} WHERE {$visible['where']}";
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Delete; visible['where'] from get_visible_where() safe format, prepare() when params non-empty
        $n = $wpdb->query(
            $params ? $wpdb->prepare($sql, ...$params) : $sql // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query and params from same build; prepare() used when params non-empty
        );

        return is_numeric($n) ? (int) $n : 0;
    }

    /**
     * Get new notifications since last_id (for SSE stream). Only visible to current user.
     *
     * @since 1.3.0
     * @param int $last_id Last seen notification ID.
     * @param int $limit   Max rows.
     * @return array
     */
    public function get_new_since($last_id, $limit = 50)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $visible = $this->get_visible_where();
        $where = $visible['where'] . ' AND id > %d ';
        $params = array_merge($visible['params'], [ (int) $last_id ]);
        $limit = max(1, min(100, (int) $limit));

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Stream feed; where from get_visible_where() safe format, params via prepare()
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe
                "SELECT id, user_id, type, title, body, link, meta, read_at, created_at, entity_type, entity_id FROM {$table} WHERE {$where} ORDER BY id ASC LIMIT %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                array_merge($params, [ $limit ])
            ),
            ARRAY_A
        );

        $items = [];
        foreach ($rows as $row) {
            $row['meta'] = json_decode($row['meta'], true);
            if (!is_array($row['meta'])) {
                $row['meta'] = [];
            }
            $items[] = $row;
        }

        return $items;
    }
}
