<?php

/**
 * The document handler class for the HelpMate plugin.
 *
 * A class that handles all document-related operations for the HelpMate plugin.
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

class HelpMate_Document_Handler
{

    /**
     * The license instance.
     *
     * @since 1.0.0
     * @access private
     * @var HelpMate_License
     */
    private $license;

    /**
     * The chat helpers instance.
     *
     * @since 1.0.0
     * @access private
     * @var HelpMate_Chat
     */
    private $chat;

    /**
     * Construct the document handler.
     *
     * @since 1.0.0
     * @param HelpMate_License $license The license instance.
     */
    public function __construct(HelpMate_License $license, HelpMate_Chat $chat)
    {
        $this->license = $license;
        $this->chat = $chat;

        // Add custom 5-minute cron schedule
        add_filter('cron_schedules', function ($schedules) {
            $schedules['every_five_minutes'] = array(
                'interval' => 300,
                'display' => __('Every 5 Minutes', 'helpmate')
            );
            return $schedules;
        });
    }



    /**
     * Store a document in the database.
     *
     * @since 1.0.0
     * @param string $title The title.
     * @param string $content The content.
     * @param string $vector The vector.
     * @param string $documentType The document type. -- text, url, post, qa, file, general
     * @param array $metadata The metadata.
     * @return bool
     */
    public function store_in_database(string $title, string $content, ?string $vector, string $documentType = 'post', array $metadata = null): bool
    {
        global $wpdb;
        $table = $wpdb->prefix . 'helpmate_documents';

        $data = array(
            'document_type' => $documentType,
            'title' => $title,
            'content' => $content,
            'vector' => $vector,
            'last_updated' => time(),
            'metadata' => json_encode($metadata)
        );

        $format = array('%s', '%s', '%s', '%s', '%d', '%s');

        return $wpdb->insert($table, $data, $format) !== false; // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }

    /**
     * Update a document in the database.
     *
     * @since 1.0.0
     * @param string $id The document ID.
     * @param string $title The title.
     * @param string $content The content.
     * @param int $lastUpdated The last updated timestamp.
     * @return bool
     */
    public function update_in_database(string $id, string $title, string $content, int $lastUpdated = null, array $metadata = null): bool
    {
        global $wpdb;
        $table = $wpdb->prefix . 'helpmate_documents';

        $data = array(
            'title' => $title,
            'content' => $content,
            'last_updated' => $lastUpdated
        );

        $format = array('%s', '%s', '%s', '%d');

        if ($metadata !== null) {
            $data['metadata'] = json_encode($metadata);
            $format[] = '%s';
        }

        $where = array('id' => $id);
        $where_format = array('%d');

        return $wpdb->update($table, $data, $where, $format, $where_format) !== false; // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    }

    /**
     * Get indexed documents.
     *
     * @since 1.0.0
     * @param string|WP_REST_Request $document_type The type of documents to retrieve. If null, returns all documents. -- text, url, post, qa, file, general
     * @return WP_REST_Response
     */
    public function get_indexed_documents($document_type = null)
    {
        global $wpdb;

        // If document_type is a WP_REST_Request, extract the document_type from the request
        if ($document_type instanceof WP_REST_Request) {
            $request = $document_type;
            $document_type = $request->get_param('document_type');
        }

        // Validate document_type
        if ($document_type === null) {
            return new WP_REST_Response([
                'error' => false,
                'message' => __('Document type is required', 'helpmate')
            ], 400);
        }

        $documents = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare("SELECT id, title, content, vector, metadata, document_type, last_updated FROM {$wpdb->prefix}helpmate_documents WHERE document_type = %s ORDER BY last_updated DESC", $document_type),  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            ARRAY_A
        );

        return new WP_REST_Response([
            'error' => false,
            'documents' => $documents
        ], 200);
    }

    public function all_documents_count()
    {
        global $wpdb;
        $count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_documents"); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        return $count;
    }

    /**
     * Store a document in the database.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request.
     * @return WP_REST_Response
     */
    public function store_document($request)
    {
        $body = json_decode($request->get_body(), true);

        // Handle both single document and array of documents
        $documents = isset($body[0]) ? $body : [$body];

        // Check if this is a bulk operation (more than 1 document)
        if (count($documents) > 1) {
            return $this->handle_bulk_document_storage($documents);
        }

        // Single document processing (existing logic)
        $results = [];

        foreach ($documents as $document) {
            $title = $document['title'];
            $content = $document['content'];
            $documentType = $document['document_type'];
            $metadata = $document['metadata'] ?? [];

            try {
                // Set feature_slug to 'product' only for product document type, otherwise use default
                $feature_slug = ($documentType === 'product') ? 'product' : 'data_source';
                $vector = $this->chat->handle_embedding(['title' => $title, 'content' => $content], 'create', $feature_slug);
            } catch (Exception $e) {
                $results[] = false;
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $e->getMessage()
                ], 500);
            }

            if (empty($vector) || !isset($vector['data']) || !isset($vector['data']['id'])) {
                $results[] = false;
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $vector['message'] ?? __('Failed to store data. Please try again.', 'helpmate')
                ], 500);
            }

            $result = $this->store_in_database($title, $content, $vector['data']['id'], $documentType, $metadata);
            $results[] = $result;
        }

        $success = !in_array(false, $results, true);

        return new WP_REST_Response([
            'error' => !$success,
            'message' => $success ? __('Documents stored successfully', 'helpmate') : __('Failed to store some documents. Contact support if the issue persists.', 'helpmate'),
        ], $success ? 200 : 500);
    }

    /**
     * Handle bulk document storage with background processing.
     *
     * @since 1.0.0
     * @param array $documents Array of documents to process.
     * @return WP_REST_Response
     */
    private function handle_bulk_document_storage($documents)
    {
        // Get the background processor instance
        $background_processor = $this->get_background_processor();

        if (!$background_processor) {
            // Fallback to synchronous processing if background processor is not available
            return $this->process_documents_synchronously($documents);
        }

        // For bulk operations, we only store post IDs and basic info
        $bulk_data = [
            'post_ids' => array_column($documents, 'post_id'),
            'post_types' => array_column($documents, 'post_type'),
            'titles' => array_column($documents, 'title'),
            'document_type' => $documents[0]['document_type'] ?? 'post'
        ];

        // Schedule background job with minimal data
        $job_id = $background_processor->schedule_bulk_processing($bulk_data, get_current_user_id());

        if (!$job_id) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Failed to schedule background processing. Please try again.', 'helpmate')
            ], 500);
        }

        // Return immediate response with job ID
        return new WP_REST_Response([
            'error' => false,
            'message' => __('Bulk document processing started in the background.', 'helpmate'),
            'job_id' => $job_id,
            'total_documents' => count($documents),
            'status' => 'scheduled'
        ], 202); // 202 Accepted - processing started
    }

    /**
     * Process documents synchronously (fallback method).
     *
     * @since 1.0.0
     * @param array $documents Array of documents to process.
     * @return WP_REST_Response
     */
    private function process_documents_synchronously($documents)
    {
        $results = [];
        $successful = 0;
        $failed = 0;
        $errors = [];

        foreach ($documents as $document) {
            $title = $document['title'];
            $content = $document['content'];
            $documentType = $document['document_type'];
            $metadata = $document['metadata'] ?? [];

            try {
                // Set feature_slug to 'product' only for product document type, otherwise use default
                $feature_slug = ($documentType === 'product') ? 'product' : 'data_source';
                $vector = $this->chat->handle_embedding(['title' => $title, 'content' => $content], 'create', $feature_slug);
            } catch (Exception $e) {
                $failed++;
                $errors[] = [
                    'document_title' => $title,
                    'error' => $e->getMessage()
                ];
                continue;
            }

            if (empty($vector) || !isset($vector['data']) || !isset($vector['data']['id'])) {
                $failed++;
                $errors[] = [
                    'document_title' => $title,
                    'error' => $vector['message'] ?? 'Failed to generate embedding'
                ];
                continue;
            }

            $result = $this->store_in_database($title, $content, $vector['data']['id'], $documentType, $metadata);

            if ($result) {
                $successful++;
            } else {
                $failed++;
                $errors[] = [
                    'document_title' => $title,
                    'error' => 'Failed to store document in database'
                ];
            }
        }

        $total = count($documents);
        $success = $failed === 0;

        $message = $success
            // translators: %d is the number of successfully processed documents
            ? sprintf(__('Successfully processed %d documents.', 'helpmate'), $successful)
            // translators: %1$d is the number of successfully processed documents, %2$d is the total number of documents, %3$d is the number of failed documents
            : sprintf(__('Processed %1$d of %2$d documents successfully. %3$d failed.', 'helpmate'), $successful, $total, $failed);

        return new WP_REST_Response([
            'error' => !$success,
            'message' => $message,
            'successful' => $successful,
            'failed' => $failed,
            'total' => $total,
            'errors' => $errors
        ], $success ? 200 : 207); // 207 Multi-Status for partial success
    }

    /**
     * Get the background processor instance.
     *
     * @since 1.0.0
     * @return HelpMate_Background_Processor|null
     */
    private function get_background_processor()
    {
        // Access the global helpmate instance
        global $helpmate;

        if (isset($helpmate) && method_exists($helpmate, 'get_background_processor')) {
            return $helpmate->get_background_processor();
        }

        return null;
    }

    /**
     * Update a document in the database.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request.
     * @return WP_REST_Response
     */
    public function update_document($request)
    {
        $body = json_decode($request->get_body(), true);
        $id = $body['id'];
        $title = $body['title'];
        $content = $body['content'];
        $vector_id = $body['vector'];
        $metadata = $body['metadata'] ?? [];
        $lastUpdated = $body['last_updated'];

        // Get document type from database
        global $wpdb;
        $document_type = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT document_type FROM {$wpdb->prefix}helpmate_documents WHERE id = %d",
            $id
        ));

        try {
            // Set feature_slug to 'product' only for product document type, otherwise use default
            $feature_slug = ($document_type === 'product') ? 'product' : 'data_source';
            $vector = $this->chat->handle_embedding(['id' => $vector_id, 'title' => $title, 'content' => $content], 'update', $feature_slug);

            // error_log('Vector: ' . print_r($vector, true));

            if (empty($vector) || !isset($vector['data']) || !isset($vector['data']['id'])) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $vector['message'] ?? __('Failed to update data. Try again.', 'helpmate')
                ], 500);
            }

            $success = $this->update_in_database($id, $title, $content, $lastUpdated, $metadata);
            return new WP_REST_Response([
                'error' => !$success,
                'message' => $success ? __('Document updated successfully', 'helpmate') : __('Failed to update document', 'helpmate'),
            ], $success ? 200 : 500);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove documents from the database.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request.
     * @return WP_REST_Response
     */
    public function remove_documents($request)
    {
        global $wpdb;

        $body = json_decode($request->get_body(), true);

        // Handle both single ID and array of IDs
        $ids = isset($body['ids']) ? $body['ids'] : (isset($body['id']) ? [$body['id']] : []);

        if (empty($ids)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('No document IDs provided', 'helpmate')
            ], 400);
        }

        // Ensure all IDs are integers
        $ids = array_map('intval', $ids);

        $documents = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare("SELECT id, document_type, vector FROM {$wpdb->prefix}helpmate_documents WHERE id IN (" . implode(',', array_fill(0, count($ids), '%d')) . ")", $ids),  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            ARRAY_A
        );

        $results = [];

        foreach ($documents as $document) {
            $feature_slug = ($document['document_type'] === 'product') ? 'product' : 'data_source';
            $response = $this->chat->handle_embedding(['id' => $document['vector']], 'delete', $feature_slug);
            if (isset($response['status']) && $response['status'] !== 'success') {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $response['message'] ?? __('Failed to remove documents', 'helpmate')
                ], 500);
            }

            $results[] = $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}helpmate_documents WHERE id = %d", $document['id'])) !== false; // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        }

        $success = !in_array(false, $results, true);

        return new WP_REST_Response([
            'error' => !$success,
            'message' => $success ? __('Documents removed successfully', 'helpmate') : __('Failed to remove documents', 'helpmate'),
            'removed_count' => $success ? count($ids) : 0
        ], $success ? 200 : 500);
    }

    /**
     * Get QA documents that are marked as quick options.
     *
     * @since 1.0.0
     * @return array
     */
    public function get_quick_option_qa_documents()
    {
        global $wpdb;

        try {
            $documents = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT title
                    FROM {$wpdb->prefix}helpmate_documents
                    WHERE document_type = %s
                    AND JSON_EXTRACT(metadata, '$.show_as_quick_option') = true
                    ORDER BY last_updated DESC",
                    'qa'
                ),
                ARRAY_A
            ) ?: [];

            return $documents;
        } catch (Exception $e) {
            return [];
        }
    }
}