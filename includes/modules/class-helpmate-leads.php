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
                    "SELECT id, name, timestamp, metadata
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
            ]);
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

            // Insert into leads table
            $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prefix . 'helpmate_leads',
                [
                    'name' => $name,
                    'timestamp' => time(),
                    'metadata' => json_encode($metadata)
                ],
                ['%s', '%d', '%s']
            );

            if ($result === false) {
                throw new Exception(__('Failed to create lead', 'helpmate-ai-chatbot'));
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
                "SELECT id, name, timestamp, metadata
                FROM {$wpdb->prefix}helpmate_leads
                WHERE id = %d",
                $lead_id
            ),
            ARRAY_A
        );

        if ($lead) {
            $lead['metadata'] = json_decode($lead['metadata'], true);
            $lead['timestamp'] = gmdate('Y-m-d H:i:s', $lead['timestamp']);
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
}