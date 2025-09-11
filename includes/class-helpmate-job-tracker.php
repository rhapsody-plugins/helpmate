<?php

/**
 * The job tracker class for the HelpMate plugin.
 *
 * Handles tracking and management of background job metadata.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) {
    exit;
}

class HelpMate_Job_Tracker
{
    /**
     * The database table name.
     *
     * @since 1.0.0
     * @access private
     * @var string
     */
    private $table_name;

    /**
     * Construct the job tracker.
     *
     * @since 1.0.0
     */
    public function __construct()
    {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'helpmate_jobs';
    }

    /**
     * Create the jobs table.
     *
     * @since 1.0.0
     */
    public function create_table()
    {
        global $wpdb;

        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$this->table_name} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            job_id varchar(255) NOT NULL,
            user_id bigint(20) NOT NULL,
            total_documents int(11) NOT NULL DEFAULT 0,
            processed_documents int(11) NOT NULL DEFAULT 0,
            successful_documents int(11) NOT NULL DEFAULT 0,
            failed_documents int(11) NOT NULL DEFAULT 0,
            status varchar(50) NOT NULL DEFAULT 'scheduled',
            documents longtext,
            errors longtext,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            completed_at datetime NULL,
            PRIMARY KEY (id),
            UNIQUE KEY job_id (job_id),
            KEY user_id (user_id),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    /**
     * Create a new job.
     *
     * @since 1.0.0
     * @param array $job_data Job data.
     * @return bool True on success, false on failure.
     */
    public function create_job($job_data)
    {
        global $wpdb;

        $data = [
            'job_id' => $job_data['job_id'],
            'user_id' => $job_data['user_id'],
            'total_documents' => $job_data['total_documents'],
            'processed_documents' => $job_data['processed_documents'] ?? 0,
            'successful_documents' => $job_data['successful_documents'] ?? 0,
            'failed_documents' => $job_data['failed_documents'] ?? 0,
            'status' => $job_data['status'],
            'documents' => json_encode($job_data['documents']),
            'errors' => json_encode($job_data['errors'] ?? []),
            'created_at' => $job_data['created_at'],
            'updated_at' => current_time('mysql')
        ];

        $result = $wpdb->insert($this->table_name, $data); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $result !== false;
    }

    /**
     * Get a job by ID.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @return array|false Job data or false if not found.
     */
    public function get_job($job_id)
    {
        global $wpdb;

        $job = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}helpmate_jobs WHERE job_id = %s",
                $job_id
            ),
            ARRAY_A
        );

        if (!$job) {
            return false;
        }

        // Decode JSON fields
        $job['documents'] = json_decode($job['documents'], true) ?: [];
        $job['errors'] = json_decode($job['errors'], true) ?: [];

        return $job;
    }

    /**
     * Update job status.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @param string $status New status.
     * @return bool True on success, false on failure.
     */
    public function update_job_status($job_id, $status)
    {
        global $wpdb;

        $data = [
            'status' => $status,
            'updated_at' => current_time('mysql')
        ];

        if (in_array($status, ['completed', 'failed', 'cancelled'])) {
            $data['completed_at'] = current_time('mysql');
        }

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $this->table_name,
            $data,
            ['job_id' => $job_id],
            ['%s', '%s', '%s'],
            ['%s']
        );

        return $result !== false;
    }

    /**
     * Update job progress.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @param int $processed Number of processed documents.
     * @param int $successful Number of successful documents.
     * @param int $failed Number of failed documents.
     * @param array $errors Array of errors.
     * @return bool True on success, false on failure.
     */
    public function update_job_progress($job_id, $processed, $successful, $failed, $errors = [])
    {
        global $wpdb;

        $data = [
            'processed_documents' => $processed,
            'successful_documents' => $successful,
            'failed_documents' => $failed,
            'errors' => json_encode($errors),
            'updated_at' => current_time('mysql')
        ];

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $this->table_name,
            $data,
            ['job_id' => $job_id],
            ['%d', '%d', '%d', '%s', '%s'],
            ['%s']
        );

        return $result !== false;
    }

    /**
     * Clean up completed jobs older than specified days.
     *
     * @since 1.0.0
     * @param int $days_old Number of days old completed jobs to clean up.
     * @return int Number of jobs deleted.
     */
    public function cleanup_completed_jobs($days_old = 7)
    {
        global $wpdb;

        $cutoff_date = gmdate('Y-m-d H:i:s', strtotime("-{$days_old} days"));

        $result = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$wpdb->prefix}helpmate_jobs
                 WHERE status IN ('completed', 'failed', 'cancelled')
                 AND completed_at < %s",
                $cutoff_date
            )
        );


        return $result;
    }

    /**
     * Clean up a specific completed job immediately.
     *
     * @since 1.0.0
     * @param string $job_id Job ID to clean up.
     * @return bool True on success, false on failure.
     */
    public function cleanup_job_immediately($job_id)
    {
        global $wpdb;

        $result = $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $this->table_name,
            [
                'job_id' => $job_id,
                'status' => 'completed'
            ],
            ['%s', '%s']
        );

        return $result !== false;
    }


    /**
     * Delete a job.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @return bool True on success, false on failure.
     */
    public function delete_job($job_id)
    {
        global $wpdb;

        $result = $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $this->table_name,
            ['job_id' => $job_id],
            ['%s']
        );

        return $result !== false;
    }

    /**
     * Get jobs for a user.
     *
     * @since 1.0.0
     * @param int $user_id User ID.
     * @param int $limit Number of jobs to retrieve.
     * @param int $offset Offset for pagination.
     * @return array Array of jobs.
     */
    public function get_user_jobs($user_id, $limit = 10, $offset = 0)
    {
        global $wpdb;

        $jobs = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}helpmate_jobs
                 WHERE user_id = %d
                 ORDER BY created_at DESC
                 LIMIT %d OFFSET %d",
                $user_id,
                $limit,
                $offset
            ),
            ARRAY_A
        );

        // Decode JSON fields for each job
        foreach ($jobs as &$job) {
            $job['documents'] = json_decode($job['documents'], true) ?: [];
            $job['errors'] = json_decode($job['errors'], true) ?: [];
        }

        return $jobs;
    }

    /**
     * Get jobs by status.
     *
     * @since 1.0.0
     * @param string $status Job status.
     * @param int $limit Number of jobs to retrieve.
     * @return array Array of jobs.
     */
    public function get_jobs_by_status($status, $limit = 10)
    {
        global $wpdb;

        $jobs = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}helpmate_jobs
                 WHERE status = %s
                 ORDER BY created_at DESC
                 LIMIT %d",
                $status,
                $limit
            ),
            ARRAY_A
        );

        // Decode JSON fields for each job
        foreach ($jobs as &$job) {
            $job['documents'] = json_decode($job['documents'], true) ?: [];
            $job['errors'] = json_decode($job['errors'], true) ?: [];
        }

        return $jobs;
    }

    /**
     * Clean up old completed jobs.
     *
     * @since 1.0.0
     * @param int $days Number of days to keep completed jobs.
     * @return int Number of jobs deleted.
     */
    public function cleanup_old_jobs($days = 7)
    {
        global $wpdb;

        $cutoff_date = gmdate('Y-m-d H:i:s', strtotime("-{$days} days"));

        $result = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "DELETE FROM {$wpdb->prefix}helpmate_jobs
                 WHERE status IN ('completed', 'failed', 'cancelled')
                 AND completed_at < %s",
                $cutoff_date
            )
        );

        return $result;
    }

    /**
     * Get job statistics.
     *
     * @since 1.0.0
     * @param int $user_id User ID (optional).
     * @return array Job statistics.
     */
    public function get_job_statistics($user_id = null)
    {
        global $wpdb;

        if ($user_id) {
            $stats = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT
                        COUNT(*) as total_jobs,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
                        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_jobs,
                        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_jobs,
                        SUM(successful_documents) as total_successful_documents,
                        SUM(failed_documents) as total_failed_documents
                     FROM {$wpdb->prefix}helpmate_jobs
                     WHERE user_id = %d",
                    $user_id
                ),
                ARRAY_A
            );
        } else {
            $stats = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                "SELECT
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
                    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_jobs,
                    SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_jobs,
                    SUM(successful_documents) as total_successful_documents,
                    SUM(failed_documents) as total_failed_documents
                 FROM {$wpdb->prefix}helpmate_jobs",
                ARRAY_A
            );
        }

        return $stats ?: [
            'total_jobs' => 0,
            'completed_jobs' => 0,
            'failed_jobs' => 0,
            'processing_jobs' => 0,
            'scheduled_jobs' => 0,
            'total_successful_documents' => 0,
            'total_failed_documents' => 0
        ];
    }

    /**
     * Check if job exists.
     *
     * @since 1.0.0
     * @param string $job_id Job ID.
     * @return bool True if job exists.
     */
    public function job_exists($job_id)
    {
        global $wpdb;

        $count = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_jobs WHERE job_id = %s",
                $job_id
            )
        );

        return (int) $count > 0;
    }
}
