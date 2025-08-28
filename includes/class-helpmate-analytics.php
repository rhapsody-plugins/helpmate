<?php

/**
 * The analytics handler for the HelpMate plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Analytics
{
    /**
     * Store an analytics event in the database.
     *
     * @since 1.0.0
     * @param string $event_type The type of the event.
     * @param array $event_data The data associated with the event.
     * @return bool|int The event ID on success, false on failure.
     */
    public function store_analytics_event(string $event_type, array $event_data)
    {
        global $wpdb;

        // Sanitize and prepare the data
        $event_type = sanitize_text_field($event_type);
        $event_data = wp_json_encode($event_data);
        $timestamp = time();

        $data = array(
            'event_type' => $event_type,
            'event_data' => $event_data,
            'timestamp' => $timestamp
        );

        $format = array('%s', '%s', '%d');

        $result = $wpdb->insert($wpdb->prefix . 'helpmate_analytics', $data, $format); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

        if ($result !== false) {
            return $wpdb->insert_id;
        }

        return false;
    }

    /**
     * Update an analytics event in the database.
     *
     * @since 1.0.0
     * @param int $id The ID of the event to update.
     * @param string|null $event_type Optional. The new event type.
     * @param array|null $event_data Optional. The new event data.
     * @param int|null $timestamp Optional. The new timestamp.
     * @return bool True on success, false on failure.
     */
    public function update_analytics_event(int $id, ?string $event_type = null, ?array $event_data = null, ?int $timestamp = null)
    {
        global $wpdb;

        $data = array();
        $format = array();

        if ($event_type !== null) {
            $data['event_type'] = sanitize_text_field($event_type);
            $format[] = '%s';
        }
        if ($event_data !== null) {
            $data['event_data'] = wp_json_encode($event_data);
            $format[] = '%s';
        }
        if ($timestamp !== null) {
            $data['timestamp'] = absint($timestamp);
            $format[] = '%d';
        }

        if (empty($data)) {
            return false;
        }

        // Use wpdb->update with prepared data
        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prefix . 'helpmate_analytics',
            $data,
            array('id' => absint($id)),
            $format,
            array('%d')
        );

        return $result !== false;
    }

    /**
     * Get a specific analytics event by its type.
     *
     * @since 1.0.0
     * @param string $event_type The type of the event.
     * @return array|null The event data (id, event_type, event_data, timestamp) or null if not found.
     */
    public function get_analytics_event_by_type(string $event_type)
    {
        global $wpdb;

        // Sanitize the event type
        $event_type = sanitize_text_field($event_type);

        // Use prepared statement with proper table name escaping
        $result = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}helpmate_analytics WHERE event_type = %s LIMIT 1",
                $event_type
            ),
            ARRAY_A
        );

        if ($result) {
            $result['event_data'] = json_decode($result['event_data'], true);
            return $result;
        }
        return null;
    }
}