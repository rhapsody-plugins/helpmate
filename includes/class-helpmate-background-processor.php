<?php

/**
 * The background processor class for the Helpmate plugin.
 *
 * Handles background processing of bulk document operations using Action Scheduler
 * with WordPress cron fallback.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) {
    exit;
}

class Helpmate_Background_Processor
{
    /**
     * The document handler instance.
     *
     * @since 1.0.0
     * @access private
     * @var Helpmate_Document_Handler
     */
    private $document_handler;

    /**
     * The chat instance.
     *
     * @since 1.0.0
     * @access private
     * @var Helpmate_Chat
     */
    private $chat;

    /**
     * The job tracker instance.
     *
     * @since 1.0.0
     * @access private
     * @var Helpmate_Job_Tracker
     */
    private $job_tracker;

    /**
     * Whether Action Scheduler is available.
     *
     * @since 1.0.0
     * @access private
     * @var bool
     */
    private $action_scheduler_available;

    /**
     * Construct the background processor.
     *
     * @since 1.0.0
     * @param Helpmate_Document_Handler $document_handler The document handler instance.
     * @param Helpmate_Chat $chat The chat instance.
     * @param Helpmate_Job_Tracker $job_tracker The job tracker instance.
     */
    public function __construct($document_handler, $chat, $job_tracker)
    {
        $this->document_handler = $document_handler;
        $this->chat = $chat;
        $this->job_tracker = $job_tracker;
        $this->action_scheduler_available = class_exists('ActionScheduler');

        $this->init_hooks();
    }

    /**
     * Initialize hooks.
     *
     * @since 1.0.0
     */
    private function init_hooks()
    {
        // Always register both hooks to ensure they're available
        add_action('helpmate_process_bulk_documents', [$this, 'process_bulk_documents_action_scheduler'], 10, 1);
        add_action('helpmate_process_bulk_documents_cron', [$this, 'process_bulk_documents_cron'], 10, 1);

        // Admin notices
        add_action('admin_notices', [$this, 'display_job_notices']);

        // AJAX handler for immediate processing
        add_action('wp_ajax_helpmate_process_bulk_job', [$this, 'ajax_process_bulk_job']);
        add_action('wp_ajax_nopriv_helpmate_process_bulk_job', [$this, 'ajax_process_bulk_job']);

        // Fallback handler for stuck jobs
        add_action('helpmate_fallback_process', [$this, 'fallback_process_job']);

        // Cleanup handler for completed jobs
        add_action('helpmate_cleanup_completed_job', [$this, 'cleanup_completed_job_handler']);

        // Add a fallback to process jobs on admin_init (for testing)
        add_action('admin_init', [$this, 'process_pending_jobs']);
    }

    /**
     * Process pending jobs (fallback for testing).
     *
     * @since 1.0.0
     */
    public function process_pending_jobs()
    {
        // Only run this occasionally to avoid performance issues
        // if (wp_rand(1, 100) > 5) { // 5% chance
        //     return;
        // }

        $job_tracker = $this->job_tracker;
        $pending_jobs = $job_tracker->get_jobs_by_status('scheduled', 5);

        foreach ($pending_jobs as $job) {
            // Check if job is older than 30 seconds (to avoid processing too early)
            $created_time = strtotime($job['created_at']);
            if (time() - $created_time > 30) {
                $this->process_bulk_documents($job['job_id']);
            }
        }

        // ALSO check stuck processing jobs
        $processing_jobs = $job_tracker->get_jobs_by_status('processing', 5);
        foreach ($processing_jobs as $job) {
            // If processing but no documents processed and older than 30 seconds
            if ($job['processed_documents'] == 0) {
                $created_time = strtotime($job['created_at']);
                if (time() - $created_time > 30) {
                    $this->process_bulk_documents($job['job_id']);
                }
            }
        }
    }

    /**
     * Schedule bulk document processing.
     *
     * @since 1.0.0
     * @param array $bulk_data Array containing post_ids, post_types, titles, and document_type.
     * @param int $user_id User ID who initiated the job.
     * @return string|false Job ID on success, false on failure.
     */
    public function schedule_bulk_processing($bulk_data, $user_id = null)
    {
        if (empty($bulk_data) || !is_array($bulk_data) || !isset($bulk_data['post_ids'])) {
            return false;
        }

        $user_id = $user_id ?: get_current_user_id();
        $job_id = $this->generate_job_id();

        // Create job record with minimal data
        $job_data = [
            'job_id' => $job_id,
            'user_id' => $user_id,
            'total_documents' => count($bulk_data['post_ids']),
            'processed_documents' => 0,
            'successful_documents' => 0,
            'failed_documents' => 0,
            'status' => 'scheduled',
            'created_at' => current_time('mysql'),
            'documents' => $bulk_data, // Store only post IDs and basic info
            'errors' => []
        ];

        $this->job_tracker->create_job($job_data);

        // Start processing immediately
        $this->job_tracker->update_job_status($job_id, 'processing');

        // Process the job immediately in a separate process
        $this->spawn_immediate_processing($job_id);

        return $job_id;
    }

    /**
     * Process bulk documents using Action Scheduler.
     *
     * @since 1.0.0
     * @param array $args Arguments containing job_id.
     */
    public function process_bulk_documents_action_scheduler($args)
    {

        $job_id = $args['job_id'] ?? null;
        if (!$job_id) {
            return;
        }

        $this->process_bulk_documents($job_id);
    }

    /**
     * Process bulk documents using WordPress cron.
     *
     * @since 1.0.0
     * @param array $args Arguments containing job_id.
     */
    public function process_bulk_documents_cron($args)
    {
        // Handle both array and string arguments
        if (is_array($args)) {
            $job_id = $args['job_id'] ?? null;
        } else {
            $job_id = $args; // If args is just the job_id string
        }

        if (!$job_id) {
            return;
        }

        $this->process_bulk_documents($job_id);
    }

    /**
     * Process bulk documents.
     *
     * @since 1.0.0
     * @param string $job_id The job ID.
     */
    private function process_bulk_documents($job_id)
    {
        $job = $this->job_tracker->get_job($job_id);
        if (!$job) {
            return;
        }

        $this->job_tracker->update_job_status($job_id, 'processing');

        // Add a small delay to ensure the status update is visible
        sleep(1);

        $bulk_data = $job['documents'] ?? [];
        $post_ids = $bulk_data['post_ids'] ?? [];
        $post_types = $bulk_data['post_types'] ?? [];
        $titles = $bulk_data['titles'] ?? [];
        $document_type = $bulk_data['document_type'] ?? 'post';

        $batch_size = 5; // Process 5 documents per batch
        $processed = 0;
        $successful = 0;
        $failed = 0;
        $errors = [];

        foreach (array_chunk($post_ids, $batch_size) as $batch) {
            foreach ($batch as $index => $post_id) {
                try {
                    // Fetch post data from WordPress
                    $post_data = $this->fetch_post_data($post_id, $post_types[$index] ?? 'post');

                    if (!$post_data) {
                        $failed++;
                        $errors[] = [
                            'document_title' => $titles[$index] ?? "Post ID: $post_id",
                            'error' => 'Post not found or inaccessible'
                        ];
                        continue;
                    }

                    // Create document object for processing
                    $document = [
                        'document_type' => $document_type,
                        'title' => $post_data['title'],
                        'content' => $post_data['content'],
                        'metadata' => ['post_id' => $post_id]
                    ];

                    $result = $this->process_single_document($document);
                    if ($result['success']) {
                        $successful++;
                    } else {
                        $failed++;
                        $errors[] = [
                            'document_title' => $post_data['title'],
                            'error' => $result['error']
                        ];

                        // Check if this is a credits limit error - if so, stop processing
                        if (
                            isset($result['error']) &&
                            (strpos($result['error'], 'embedding credits limit') !== false ||
                                strpos($result['error'], 'credits limit') !== false)
                        ) {

                            // Mark remaining documents as failed due to credits limit
                            $remaining = count($post_ids) - $processed;
                            for ($i = $processed; $i < count($post_ids); $i++) {
                                $errors[] = [
                                    'document_title' => $titles[$i] ?? "Post ID: " . $post_ids[$i],
                                    'error' => 'Processing stopped due to embedding credits limit'
                                ];
                            }

                            $failed += $remaining;
                            $processed = count($post_ids); // Mark all as processed

                            // Update job status and break out of processing
                            $this->job_tracker->update_job_progress($job_id, $processed, $successful, $failed, $errors);
                            break 2; // Break out of both inner and outer loops
                        }
                    }
                } catch (Exception $e) {
                    $failed++;
                    $errors[] = [
                        'document_title' => $titles[$index] ?? "Post ID: $post_id",
                        'error' => $e->getMessage()
                    ];

                    // Check if this is a credits limit error in the exception
                    if (
                        strpos($e->getMessage(), 'embedding credits limit') !== false ||
                        strpos($e->getMessage(), 'credits limit') !== false
                    ) {

                        // Mark remaining documents as failed due to credits limit
                        $remaining = count($post_ids) - $processed;
                        for ($i = $processed; $i < count($post_ids); $i++) {
                            $errors[] = [
                                'document_title' => $titles[$i] ?? "Post ID: " . $post_ids[$i],
                                'error' => 'Processing stopped due to embedding credits limit'
                            ];
                        }

                        $failed += $remaining;
                        $processed = count($post_ids); // Mark all as processed

                        // Update job status and break out of processing
                        $this->job_tracker->update_job_progress($job_id, $processed, $successful, $failed, $errors);
                        break 2; // Break out of both inner and outer loops
                    }
                }

                $processed++;
                $this->job_tracker->update_job_progress($job_id, $processed, $successful, $failed, $errors);

                // Add delay to make progress visible and prevent overwhelming the server
                sleep(1); // 1 second delay between documents
            }
        }

        // Mark job as completed
        $final_status = $failed === 0 ? 'completed' : ($successful === 0 ? 'failed' : 'partial');

        // Check if processing was stopped due to credits limit
        $credits_limit_reached = false;
        foreach ($errors as $error) {
            if (
                strpos($error['error'], 'embedding credits limit') !== false ||
                strpos($error['error'], 'credits limit') !== false ||
                strpos($error['error'], 'Processing stopped due to embedding credits limit') !== false
            ) {
                $credits_limit_reached = true;
                break;
            }
        }

        if ($credits_limit_reached) {
            $final_status = 'failed'; // Mark as failed when credits limit is reached
        }

        $this->job_tracker->update_job_status($job_id, $final_status);

        // Add a small delay to ensure the final status update is visible
        sleep(2);

        // Schedule admin notice
        $this->schedule_admin_notice($job_id, $final_status, $successful, $failed, $errors);

        // Schedule cleanup of completed job after 5 minutes
        if ($final_status === 'completed') {
            wp_schedule_single_event(
                time() + 300, // 5 minutes from now
                'helpmate_cleanup_completed_job',
                ['job_id' => $job_id]
            );
        }
    }

    /**
     * Fetch post data from WordPress.
     *
     * @since 1.0.0
     * @param int $post_id Post ID.
     * @param string $post_type Post type.
     * @return array|false Post data or false if not found.
     */
    private function fetch_post_data($post_id, $post_type = 'post')
    {
        // Get the post
        $post = get_post($post_id);

        if (!$post || $post->post_status !== 'publish') {
            return false;
        }

        // Use the same logic as get_posts method in backend routes
        $metadata = [
            'featured_image' => get_the_post_thumbnail_url($post_id, 'full'),
            'excerpt' => get_the_excerpt($post),
            'modified_date' => $post->post_modified,
            'permalink' => get_permalink($post_id),
            'categories' => wp_get_post_terms($post_id, 'category', ['fields' => 'names']),
            'tags' => wp_get_post_terms($post_id, 'post_tag', ['fields' => 'names']),
        ];

        // Add WooCommerce product data if post type is product
        if ($post_type === 'product') {
            $product = wc_get_product($post_id);
            if ($product) {
                // Get all product meta
                $product_meta = get_post_meta($post_id);

                // Get product attributes
                $attributes = [];
                $product_attributes = $product->get_attributes();
                foreach ($product_attributes as $attribute) {
                    $attributes[$attribute->get_name()] = [
                        'name' => $attribute->get_name(),
                        'options' => $attribute->get_options(),
                        'visible' => $attribute->get_visible(),
                        'variation' => $attribute->get_variation(),
                    ];
                }

                // Get product gallery images
                $gallery_ids = $product->get_gallery_image_ids();
                $gallery_images = [];
                foreach ($gallery_ids as $gallery_id) {
                    $gallery_images[] = wp_get_attachment_url($gallery_id);
                }

                // Get product tags
                $product_tags = wp_get_post_terms($post_id, 'product_tag', ['fields' => 'names']);

                // Get product categories with full data
                $product_categories = wp_get_post_terms($post_id, 'product_cat', ['fields' => 'all']);
                $categories_data = [];
                foreach ($product_categories as $category) {
                    $categories_data[] = [
                        'id' => $category->term_id,
                        'name' => $category->name,
                        'slug' => $category->slug,
                        'description' => $category->description,
                    ];
                }

                $metadata['product'] = [
                    // Basic product info
                    'name' => $product->get_name(),
                    'description' => $product->get_description(),
                    'short_description' => $product->get_short_description(),
                    'sku' => $product->get_sku(),
                    'type' => $product->get_type(),

                    // Pricing
                    'price' => $product->get_price(),
                    'regular_price' => $product->get_regular_price(),
                    'sale_price' => $product->get_sale_price(),
                    'price_html' => $product->get_price_html(),

                    // Stock
                    'stock_status' => $product->get_stock_status(),
                    'stock_quantity' => $product->get_stock_quantity(),
                    'manage_stock' => $product->get_manage_stock(),
                    'backorders' => $product->get_backorders(),

                    // Status flags
                    'is_on_sale' => $product->is_on_sale(),
                    'is_featured' => $product->is_featured(),
                    'is_visible' => $product->is_visible(),
                    'is_purchasable' => $product->is_purchasable(),
                    'is_in_stock' => $product->is_in_stock(),
                    'is_virtual' => $product->is_virtual(),
                    'is_downloadable' => $product->is_downloadable(),

                    // Ratings
                    'rating_count' => $product->get_rating_count(),
                    'average_rating' => $product->get_average_rating(),

                    // Categories and tags
                    'categories' => $categories_data,
                    'tags' => $product_tags,

                    // Attributes
                    'attributes' => $attributes,

                    // Images
                    'gallery_images' => $gallery_images,

                    // Dimensions and weight
                    'weight' => $product->get_weight(),
                    'dimensions' => [
                        'length' => $product->get_length(),
                        'width' => $product->get_width(),
                        'height' => $product->get_height(),
                    ],

                    // Shipping
                    'shipping_class' => $product->get_shipping_class(),
                    'shipping_class_id' => $product->get_shipping_class_id(),

                    // Sales
                    'total_sales' => $product->get_total_sales(),
                    'date_on_sale_from' => $product->get_date_on_sale_from(),
                    'date_on_sale_to' => $product->get_date_on_sale_to(),

                    // All product meta
                    'meta' => $product_meta,

                    // Additional WooCommerce data
                    'cross_sell_ids' => $product->get_cross_sell_ids(),
                    'upsell_ids' => $product->get_upsell_ids(),
                    'related_ids' => wc_get_related_products($product->get_id()),
                    'downloads' => $product->get_downloads(),
                    'download_limit' => $product->get_download_limit(),
                    'download_expiry' => $product->get_download_expiry(),
                ];
            }
        }

        // For products, use product name and description as title and content
        if ($post_type === 'product' && isset($metadata['product'])) {
            $title = $metadata['product']['name'];
            $content = $metadata['product']['description'] ?: $post->post_content;
        } else {
            $title = get_the_title($post);
            $content = $post->post_content;
        }

        // Format content with metadata
        $formatted_content = $content . "\n\nMetadata:\n" . json_encode($metadata, JSON_PRETTY_PRINT);

        return [
            'title' => $title,
            'content' => $formatted_content,
            'metadata' => $metadata
        ];
    }

    /**
     * Process a single document.
     *
     * @since 1.0.0
     * @param array $document Document data.
     * @return array Result with success status and error message.
     */
    private function process_single_document($document)
    {
        try {
            $title = $document['title'] ?? '';
            $content = $document['content'] ?? '';
            $document_type = $document['document_type'] ?? 'post';
            $metadata = $document['metadata'] ?? [];

            // Generate embedding
            // Set feature_slug to 'product' only for product document type, otherwise use default
            $feature_slug = ($document_type === 'product') ? 'product' : 'data_source';
            $vector = $this->chat->handle_embedding(['title' => $title, 'content' => $content], 'create', $feature_slug);

            if (empty($vector) || !isset($vector['data']) || !isset($vector['data']['id'])) {
                return [
                    'success' => false,
                    'error' => $vector['message'] ?? 'Failed to generate embedding'
                ];
            }

            // Store in database
            $success = $this->document_handler->store_in_database(
                $title,
                $content,
                $vector['data']['id'],
                $document_type,
                $metadata
            );

            if (!$success) {
                return [
                    'success' => false,
                    'error' => 'Failed to store document in database'
                ];
            }

            return ['success' => true, 'error' => null];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Schedule admin notice for job completion.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @param string $status Job status.
     * @param int $successful Number of successful documents.
     * @param int $failed Number of failed documents.
     * @param array $errors Array of errors.
     */
    private function schedule_admin_notice($job_id, $status, $successful, $failed, $errors)
    {
        $notice_data = [
            'job_id' => $job_id,
            'status' => $status,
            'successful' => $successful,
            'failed' => $failed,
            'errors' => $errors,
            'timestamp' => current_time('mysql')
        ];

        // Store notice data in user meta
        $job = $this->job_tracker->get_job($job_id);
        $user_id = $job['user_id'] ?? get_current_user_id();

        $notices = get_user_meta($user_id, 'helpmate_job_notices', true) ?: [];
        $notices[] = $notice_data;
        update_user_meta($user_id, 'helpmate_job_notices', $notices);
    }

    /**
     * Display job completion notices.
     *
     * @since 1.0.0
     */
    public function display_job_notices()
    {
        $user_id = get_current_user_id();
        $notices = get_user_meta($user_id, 'helpmate_job_notices', true) ?: [];

        if (empty($notices)) {
            return;
        }

        foreach ($notices as $index => $notice) {
            $this->render_admin_notice($notice);
        }

        // Clear notices after displaying
        delete_user_meta($user_id, 'helpmate_job_notices');
    }

    /**
     * Render admin notice.
     *
     * @since 1.0.0
     * @param array $notice Notice data.
     */
    private function render_admin_notice($notice)
    {
        $status = $notice['status'];
        $successful = $notice['successful'];
        $failed = $notice['failed'];
        $errors = $notice['errors'];

        $class = 'notice notice-' . ($status === 'completed' ? 'success' : ($status === 'failed' ? 'error' : 'warning'));
        $title = 'Helpmate Bulk Processing';

        if ($status === 'completed') {
            $message = sprintf(
                // translators: %d is the number of successfully processed documents
                __('Successfully processed %d documents.', 'helpmate-ai-chatbot'),
                $successful
            );
        } elseif ($status === 'failed') {
            $message = sprintf(
                // translators: %d is the number of failed documents
                __('Failed to process all %d documents.', 'helpmate-ai-chatbot'),
                $failed
            );
        } else {
            $message = sprintf(
                // translators: %1$d is the number of successfully processed documents, %2$d is the total number of documents, %3$d is the number of failed documents
                __('Processed %1$d of %2$d documents successfully. %3$d failed.', 'helpmate-ai-chatbot'),
                $successful,
                $successful + $failed,
                $failed
            );
        }

        echo '<div class="' . esc_attr($class) . ' is-dismissible">';
        echo '<p><strong>' . esc_html($title) . ':</strong> ' . esc_html($message) . '</p>';

        if (!empty($errors) && ($status === 'failed' || $status === 'partial')) {
            echo '<details style="margin-top: 10px;">';
            echo '<summary style="cursor: pointer; font-weight: bold;">View Error Details</summary>';
            echo '<ul style="margin: 10px 0 0 20px;">';
            foreach ($errors as $error) {
                echo '<li><strong>' . esc_html($error['document_title']) . ':</strong> ' . esc_html($error['error']) . '</li>';
            }
            echo '</ul>';
            echo '</details>';
        }

        echo '</div>';
    }

    /**
     * Get job status.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @return array|false Job data or false if not found.
     */
    public function get_job_status($job_id)
    {
        return $this->job_tracker->get_job($job_id);
    }

    /**
     * Cancel a job.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @return bool True if cancelled successfully.
     */
    public function cancel_job($job_id)
    {
        if ($this->action_scheduler_available) {
            // Cancel Action Scheduler job
            as_unschedule_action('helpmate_process_bulk_documents', ['job_id' => $job_id], 'helpmate-bulk-processing');
        } else {
            // Cancel WordPress cron job
            wp_clear_scheduled_hook('helpmate_process_bulk_documents_cron', ['job_id' => $job_id]);
        }

        $this->job_tracker->update_job_status($job_id, 'cancelled');
        return true;
    }

    /**
     * Generate unique job ID.
     *
     * @since 1.0.0
     * @return string Unique job ID.
     */
    private function generate_job_id()
    {
        return 'helpmate_bulk_' . uniqid() . '_' . time();
    }

    /**
     * Check if Action Scheduler is available.
     *
     * @since 1.0.0
     * @return bool True if Action Scheduler is available.
     */
    public function is_action_scheduler_available()
    {
        return $this->action_scheduler_available;
    }

    /**
     * Debug function to check job status and scheduling.
     *
     * @since 1.0.0
     * @param string $job_id Job ID to debug.
     * @return array Debug information.
     */
    public function debug_job($job_id)
    {
        $job = $this->job_tracker->get_job($job_id);

        $debug_info = [
            'job_exists' => $job !== false,
            'job_data' => $job,
            'action_scheduler_available' => $this->action_scheduler_available,
            'wp_cron_disabled' => defined('DISABLE_WP_CRON') && DISABLE_WP_CRON,
        ];

        if ($this->action_scheduler_available) {
            // Check if Action Scheduler job exists
            $scheduled_actions = as_get_scheduled_actions([
                'hook' => 'helpmate_process_bulk_documents',
                'args' => ['job_id' => $job_id],
                'group' => 'helpmate-bulk-processing'
            ]);

            $debug_info['action_scheduler_jobs'] = $scheduled_actions;
            $debug_info['action_scheduler_job_count'] = count($scheduled_actions);
        } else {
            // Check WordPress cron
            $cron_jobs = wp_get_scheduled_event('helpmate_process_bulk_documents_cron', ['job_id' => $job_id]);
            $debug_info['wp_cron_job'] = $cron_jobs;
        }

        return $debug_info;
    }

    /**
     * Cleanup completed job handler.
     *
     * @since 1.0.0
     * @param array $args Arguments containing job_id.
     */
    public function cleanup_completed_job_handler($args)
    {
        $job_id = is_array($args) ? ($args['job_id'] ?? null) : $args;

        if (!$job_id) {
            return;
        }

        $this->job_tracker->cleanup_job_immediately($job_id);
    }

    /**
     * Spawn immediate processing in a separate process.
     *
     * @since 1.0.0
     * @param string $job_id Job ID to process.
     */
    private function spawn_immediate_processing($job_id)
    {
        // Use wp_remote_post to trigger processing in a separate request
        $admin_url = admin_url('admin-ajax.php');
        $nonce = wp_create_nonce('helpmate_bulk_process_nonce');

        $response = wp_remote_post($admin_url, [
            'body' => [
                'action' => 'helpmate_process_bulk_job',
                'job_id' => $job_id,
                'nonce' => $nonce
            ],
            'blocking' => false, // Don't wait for response
            'timeout' => 10, // Very short timeout
            'sslverify' => false, // Skip SSL verification for local development
        ]);

        if (is_wp_error($response)) {
            // Fallback: process directly
            $this->process_bulk_documents($job_id);
        } else {
            // Add a fallback timer - if job doesn't start processing within 10 seconds, process directly
            wp_schedule_single_event(time() + 10, 'helpmate_fallback_process', ['job_id' => $job_id]);
        }
    }

    /**
     * AJAX handler for immediate bulk job processing.
     *
     * @since 1.0.0
     */
    public function ajax_process_bulk_job()
    {
        // Verify nonce
        $nonce = sanitize_text_field(wp_unslash($_POST['nonce'] ?? ''));
        if (!wp_verify_nonce($nonce, 'helpmate_bulk_process_nonce')) {
            wp_die('Security check failed');
        }

        $job_id = sanitize_text_field(wp_unslash($_POST['job_id'] ?? ''));

        if (empty($job_id)) {
            wp_die('Job ID required');
        }


        // Process the job
        $this->process_bulk_documents($job_id);

        // Return success (though client won't wait for it)
        wp_die('OK');
    }

    /**
     * Fallback process job (for stuck jobs).
     *
     * @since 1.0.0
     * @param array $args Arguments containing job_id.
     */
    public function fallback_process_job($args)
    {
        $job_id = is_array($args) ? ($args['job_id'] ?? null) : $args;

        if (!$job_id) {
            return;
        }

        $job = $this->job_tracker->get_job($job_id);

        if (!$job) {
            return;
        }

        // Only process if still in processing status (stuck)
        if ($job['status'] === 'processing' && $job['processed_documents'] == 0) {
            $this->process_bulk_documents($job_id);
        } else {
        }
    }

    /**
     * Manually trigger job processing (for debugging).
     *
     * @since 1.0.0
     * @param string $job_id Job ID to process.
     * @return bool True if processing started.
     */
    public function manual_process_job($job_id)
    {
        $job = $this->job_tracker->get_job($job_id);

        if (!$job) {
            return false;
        }

        if ($job['status'] !== 'scheduled') {
            return false;
        }

        // Update status to processing
        $this->job_tracker->update_job_status($job_id, 'processing');

        // Process the job
        $this->process_bulk_documents($job_id);

        return true;
    }
}
