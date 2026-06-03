<?php

/**
 * Admin maintenance tools for Helpmate.
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 */

if (!defined('ABSPATH')) {
    exit;
}

class Helpmate_Tools
{
    /** @var Helpmate */
    private $helpmate;

    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Whether current user may run admin tools.
     */
    public static function current_user_can_run_tools(): bool
    {
        if (!is_user_logged_in() || !current_user_can('manage_options')) {
            return false;
        }
        $roles = Helpmate_Permissions::get_user_roles(get_current_user_id());
        return is_array($roles) && in_array('admin', $roles, true);
    }

    /**
     * Full database + settings reset.
     *
     * @return array|WP_Error
     */
    public function reset_database_and_settings()
    {
        global $wpdb;

        $this->clear_scheduled_hooks();
        $this->cancel_processing_jobs();

        foreach ($this->get_tables_truncation_order() as $suffix) {
            $table = esc_sql($wpdb->prefix . $suffix);
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Admin reset; table name uses wpdb->prefix
            $wpdb->query("TRUNCATE TABLE {$table}");
        }

        $this->helpmate->get_database()->reset_settings_to_defaults();
        $this->helpmate->get_database()->initialize_task_custom_fields();
        $this->helpmate->create_default_email_templates();

        if (function_exists('wp_cache_flush_group')) {
            wp_cache_flush_group('helpmate');
        }

        flush_rewrite_rules(false);

        return array(
            'success' => true,
            'message' => __('Helpmate data and settings have been reset to defaults.', 'helpmate-ai-chatbot'),
        );
    }

    /**
     * Reset default email templates and re-wire module settings.
     *
     * @return array|WP_Error
     */
    public function reset_default_email_templates()
    {
        $crm = $this->helpmate->get_crm();
        if (!$crm) {
            return new WP_Error('crm_unavailable', __('CRM module is not available.', 'helpmate-ai-chatbot'));
        }
        return $crm->reset_default_email_templates(true);
    }

    /**
     * Orchestrate local knowledge base after API key is saved.
     *
     * @param string|null $old_key Previous plaintext API key (null if none).
     * @param string      $new_key New plaintext API key from license server.
     * @return array{action: string, imported: int, skipped_quick_train: bool, error?: string}
     */
    public function orchestrate_documents_after_api_key_save(?string $old_key, string $new_key): array
    {
        $is_key_change = $old_key !== null && $old_key !== '' && $old_key !== $new_key;

        if ($is_key_change) {
            $sync_result = $this->sync_documents_from_qdrant(true);
            return $this->build_orchestration_response($sync_result, true, false);
        }

        if ($this->has_qdrant_general_document()) {
            $sync_result = $this->sync_documents_from_qdrant(true);
            return $this->build_orchestration_response($sync_result, false, true);
        }

        return array(
            'action' => 'none',
            'imported' => 0,
            'skipped_quick_train' => false,
        );
    }

    /**
     * Preview Qdrant sync state.
     *
     * @return array|WP_Error
     */
    public function preview_qdrant_documents_sync()
    {
        $api = $this->helpmate->get_api();
        if (empty($api->get_key())) {
            return new WP_Error('missing_api_key', __('API key is required to access the cloud.', 'helpmate-ai-chatbot'));
        }

        global $wpdb;
        $mysql_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_documents"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        $fetch = $this->fetch_all_qdrant_sync_documents();
        if (is_wp_error($fetch)) {
            return $fetch;
        }

        $all_docs = $fetch['documents'];
        $stats = $fetch['stats'];
        $sample = array_slice($all_docs, 0, 3);

        return array(
            'success' => true,
            'mysql_count' => $mysql_count,
            'qdrant_count' => (int) ($stats['total'] ?? count($all_docs)),
            'stats' => $stats,
            'sample_documents' => $sample,
            'can_backfill' => $mysql_count > 0,
            'warnings' => $this->build_sync_warnings($stats, $mysql_count),
        );
    }

    /**
     * Backfill Qdrant payloads from MySQL catalog.
     *
     * @return array|WP_Error
     */
    public function backfill_qdrant_from_mysql()
    {
        $api = $this->helpmate->get_api();
        if (empty($api->get_key())) {
            return new WP_Error('missing_api_key', __('API key is required.', 'helpmate-ai-chatbot'));
        }

        global $wpdb;
        $rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT id, title, content, vector, document_type, metadata FROM {$wpdb->prefix}helpmate_documents WHERE vector IS NOT NULL AND vector != ''",
            ARRAY_A
        );

        $updated = 0;
        $skipped = 0;
        $errors = array();

        foreach ($rows as $row) {
            $vector = $row['vector'];
            if (empty($vector)) {
                $skipped++;
                continue;
            }
            $metadata = json_decode($row['metadata'] ?? '{}', true);
            if (!is_array($metadata)) {
                $metadata = array();
            }
            $result = $api->patch_qdrant_sync_payload($vector, array(
                'title' => $row['title'],
                'document_type' => $row['document_type'],
                'plugin_metadata' => $metadata,
                'full_content' => $row['content'],
            ));
            if (isset($result['error']) && $result['error']) {
                $errors[] = array('id' => (int) $row['id'], 'message' => $result['message'] ?? 'Unknown error');
                continue;
            }
            $updated++;
        }

        return array(
            'success' => true,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
        );
    }

    /**
     * Sync helpmate_documents from Qdrant (one-way).
     *
     * @param bool $skip_job_check Skip bulk-job guard (after cancel in clear_local_documents).
     * @return array|WP_Error
     */
    public function sync_documents_from_qdrant(bool $skip_job_check = false)
    {
        $api = $this->helpmate->get_api();
        if (empty($api->get_key())) {
            return new WP_Error('missing_api_key', __('API key is required to sync from the cloud.', 'helpmate-ai-chatbot'));
        }

        if (!$skip_job_check && $this->has_processing_bulk_job()) {
            return new WP_Error('job_in_progress', __('A bulk knowledge-base job is still running. Please wait and try again.', 'helpmate-ai-chatbot'));
        }

        // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- Large sync may take time
        set_time_limit(300);

        $this->clear_local_documents();

        $fetch = $this->fetch_all_qdrant_sync_documents();
        if (is_wp_error($fetch)) {
            return $fetch;
        }

        $handler = $this->helpmate->get_document_handler();
        $inserted = 0;

        foreach ($fetch['documents'] as $doc) {
            if (!is_array($doc)) {
                continue;
            }
            $doc_id = $doc['document_id'] ?? '';
            if ($doc_id === '') {
                continue;
            }
            $title = $doc['title'] ?? '';
            $content = $doc['content'] ?? '';
            $document_type = $doc['document_type'] ?? 'general';
            $plugin_metadata = $doc['plugin_metadata'] ?? array();
            if (!is_array($plugin_metadata)) {
                $plugin_metadata = array();
            }
            $last_updated = time();
            if (!empty($doc['updated_at'])) {
                $ts = is_numeric($doc['updated_at']) ? (int) $doc['updated_at'] : strtotime($doc['updated_at']);
                if ($ts) {
                    $last_updated = $ts;
                }
            }
            if ($handler->insert_synced_document($title, $content, $doc_id, $document_type, $plugin_metadata, $last_updated)) {
                $inserted++;
            }
        }

        return array(
            'success' => true,
            'inserted' => $inserted,
            'message' => sprintf(
                /* translators: %d: number of documents imported */
                __('%d documents imported from the cloud.', 'helpmate-ai-chatbot'),
                $inserted
            ),
        );
    }

    /**
     * Fetch all Qdrant documents for sync (paginated).
     *
     * @return array{documents: array, stats: array}|WP_Error
     */
    public function fetch_all_qdrant_sync_documents()
    {
        $api = $this->helpmate->get_api();
        if (empty($api->get_key())) {
            return new WP_Error('missing_api_key', __('API key is required to access the cloud.', 'helpmate-ai-chatbot'));
        }

        $all_docs = array();
        $offset = 0;
        $limit = 100;
        $stats = array('total' => 0, 'complete' => 0, 'legacy' => 0);

        do {
            $page = $api->fetch_qdrant_sync_list($limit, $offset);
            if (isset($page['error']) && $page['error']) {
                return new WP_Error('qdrant_error', $page['message'] ?? __('Failed to fetch cloud documents.', 'helpmate-ai-chatbot'));
            }
            if (!empty($page['stats']) && is_array($page['stats'])) {
                $stats = $page['stats'];
            }
            $batch = isset($page['data']) && is_array($page['data']) ? $page['data'] : array();
            foreach ($batch as $row) {
                $all_docs[] = $row;
            }
            $offset += $limit;
        } while (count($batch) >= $limit && $offset < 10000);

        return array(
            'documents' => $all_docs,
            'stats' => $stats,
        );
    }

    /**
     * Whether Qdrant has at least one general document for the current license.
     */
    public function has_qdrant_general_document(): bool
    {
        $fetch = $this->fetch_all_qdrant_sync_documents();
        if (is_wp_error($fetch)) {
            return false;
        }

        foreach ($fetch['documents'] as $doc) {
            if (!is_array($doc)) {
                continue;
            }
            $document_type = $doc['document_type'] ?? 'general';
            if ($document_type === 'general') {
                return true;
            }
        }

        return false;
    }

    /**
     * Truncate local documents and cancel in-flight bulk jobs.
     */
    public function clear_local_documents(): void
    {
        $this->cancel_processing_jobs();

        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_documents');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Admin sync reset
        $wpdb->query("TRUNCATE TABLE {$table}");
    }

    /**
     * @param array|WP_Error $sync_result
     * @param bool           $is_key_change
     * @param bool           $is_setup_restore
     * @return array{action: string, imported: int, skipped_quick_train: bool, error?: string}
     */
    private function build_orchestration_response($sync_result, bool $is_key_change, bool $is_setup_restore): array
    {
        if (is_wp_error($sync_result)) {
            $response = array(
                'action' => 'none',
                'imported' => 0,
                'skipped_quick_train' => false,
                'error' => $sync_result->get_error_message(),
            );
            return $response;
        }

        $imported = (int) ($sync_result['inserted'] ?? 0);

        return array(
            'action' => 'synced_all',
            'imported' => $imported,
            'skipped_quick_train' => $is_setup_restore,
        );
    }

    private function build_sync_warnings(array $stats, int $mysql_count): array
    {
        $warnings = array();
        $legacy = (int) ($stats['legacy'] ?? 0);
        if ($legacy > 0) {
            if ($mysql_count > 0) {
                $warnings[] = __('Some cloud documents are missing sync metadata. Run Backfill before sync for best results.', 'helpmate-ai-chatbot');
            } else {
                $warnings[] = __('Some cloud documents are legacy entries; they will import as general type with reconstructed content.', 'helpmate-ai-chatbot');
            }
        }
        return $warnings;
    }

    private function has_processing_bulk_job(): bool
    {
        global $wpdb;
        $jobs_table = esc_sql($wpdb->prefix . 'helpmate_jobs');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$jobs_table} WHERE status = 'processing'");
        return $count > 0;
    }

    private function cancel_processing_jobs(): void
    {
        global $wpdb;
        $jobs_table = esc_sql($wpdb->prefix . 'helpmate_jobs');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query("UPDATE {$jobs_table} SET status = 'cancelled' WHERE status = 'processing'");
    }

    private function clear_scheduled_hooks(): void
    {
        wp_clear_scheduled_hook('helpmate_process_bulk_documents_cron');
        wp_clear_scheduled_hook('helpmate_send_scheduled_campaign');
        wp_clear_scheduled_hook('helpmate_check_banner_expiration');
        wp_clear_scheduled_hook('helpmate_check_overdue_tasks');
        wp_clear_scheduled_hook('helpmate_integration_events_cleanup');
        wp_clear_scheduled_hook('helpmate_cleanup_completed_job');
    }

    /**
     * Child tables first.
     *
     * @return string[]
     */
    private function get_tables_truncation_order(): array
    {
        return array(
            'helpmate_crm_email_tracking',
            'helpmate_crm_email_sequence_contacts',
            'helpmate_crm_email_sequence_steps',
            'helpmate_crm_task_field_values',
            'helpmate_crm_task_contacts',
            'helpmate_crm_contact_field_values',
            'helpmate_crm_contact_notes',
            'helpmate_crm_emails',
            'helpmate_crm_email_failures',
            'helpmate_crm_campaigns',
            'helpmate_crm_recurring_campaigns',
            'helpmate_crm_email_sequences',
            'helpmate_social_messages',
            'helpmate_conversation_participants',
            'helpmate_social_lead_campaigns_state',
            'helpmate_crm_tasks',
            'helpmate_crm_manual_orders',
            'helpmate_social_conversations',
            'helpmate_chat_reviews',
            'helpmate_chat_history',
            'helpmate_abandoned_carts',
            'helpmate_tickets',
            'helpmate_leads',
            'helpmate_returns_refunds',
            'helpmate_schedules',
            'helpmate_notifications',
            'helpmate_integration_events',
            'helpmate_jobs',
            'helpmate_analytics',
            'helpmate_promo_banners',
            'helpmate_social_accounts',
            'helpmate_crm_segments',
            'helpmate_crm_email_templates',
            'helpmate_crm_custom_fields',
            'helpmate_crm_contacts',
            'helpmate_team_members',
            'helpmate_documents',
        );
    }
}
