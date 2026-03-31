<?php

/**
 * The backend routes class.
 *
 * This class handles all the backend/admin routes for the plugin.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

class Helpmate_Backend_Routes
{
    /**
     * The helpmate instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     * @param    Helpmate    $helpmate    The helpmate instance.
     */
    public function __construct($helpmate)
    {
        $this->helpmate = $helpmate;

        // Register hook for background profile fetch
        add_action('helpmate_fetch_social_profile', [$this, 'handle_fetch_social_profile'], 10, 4);
    }

    /**
     * Handle background fetch of social profile.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @param    array  $account            The account data.
     * @param    string $platform           The platform.
     * @param    string $participant_id     The participant ID.
     */
    public function handle_fetch_social_profile(int $conversation_id, array $account, string $platform, string $participant_id): void
    {
        $social_chat = $this->helpmate->get_social_chat();

        // Ensure account has access_token decrypted
        if (empty($account['access_token']) && !empty($account['access_token_encrypted'])) {
            $account['access_token'] = $social_chat->decrypt_value($account['access_token_encrypted']);
        }

        $profile = $social_chat->fetch_user_profile_from_meta($participant_id, $account, $platform);

        if ($profile && (!empty($profile['name']) || !empty($profile['profile_pic']))) {
            global $wpdb;
            $table = $wpdb->prefix . 'helpmate_social_conversations';

            $update_data = [];
            if (!empty($profile['name'])) {
                $update_data['participant_name'] = sanitize_text_field($profile['name']);
            }
            if (!empty($profile['profile_pic'])) {
                $update_data['participant_profile_pic'] = esc_url_raw($profile['profile_pic']);
            }

            if (!empty($update_data)) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
                $wpdb->update(
                    $table,
                    $update_data,
                    ['id' => $conversation_id]
                );
            }
        }
    }

    /**
     * Register all backend routes.
     *
     * @since    1.0.0
     */
    public function register_routes()
    {
        // Force refresh of REST routes by clearing cache
        add_action('init', function () {
            // Clear any cached REST routes
            if (function_exists('rest_get_server')) {
                $server = rest_get_server();
                if ($server) {
                    $server->get_routes();
                }
            }
        }, 1);
        /* --------------------------------------- */
        /*                 Helpers                 */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/url-content-to-text', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_chat()->url_content_to_text($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/quick-train-homepage', array(
            'methods' => 'POST',
            'callback' => fn() => $this->helpmate->get_chat()->quick_train_homepage(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/check-woocommerce', array(
            'methods' => 'GET',
            'callback' => function () {
                // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Using WordPress core filter
                $is_installed = in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')));
                try {
                    return new WP_REST_Response([
                        'error' => false,
                        'installed' => $is_installed
                    ], 200);
                } catch (Exception $e) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $e->getMessage()
                    ], 500);
                }
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        /* --------------------------------------- */
        /*                   API                   */
        /* --------------------------------------- */

        register_rest_route('helpmate/v1', '/feature-usage', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_api()->sync_with_server(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/activate-api-key', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_api()->handle_api_key_activation($request->get_param('api_key')),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/pro', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/api-key', array(
            'methods' => 'GET',
            'callback' => function () {
                $api_key = $this->helpmate->get_api();
                return [
                    'api_key' => $api_key->get_key(),
                    'local_credits' => $api_key->get_local_credits(),
                    'product_slug' => $api_key->get_product_slug(),
                ];
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/get-free-api-key', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_api()->rp_register_free_api_key($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/save-openai-key', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $openai_key = sanitize_text_field($request->get_param('openai_key'));
                $result = $this->helpmate->get_api()->save_openai_key($openai_key);
                return new WP_REST_Response($result, $result['success'] ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/get-openai-key', array(
            'methods' => 'GET',
            'callback' => function () {
                $openai_key = $this->helpmate->get_api()->get_openai_key();
                if (empty($openai_key)) {
                    return new WP_REST_Response(['openai_key' => null, 'key_prefix' => null], 200);
                }
                $len = strlen($openai_key);
                if ($len < 9) {
                    $masked = substr($openai_key, 0, 4) . '…';
                    $key_prefix = (strpos($openai_key, 'sk-proj') === 0) ? 'sk-proj' : null;
                } elseif (strpos($openai_key, 'sk-proj') === 0) {
                    $masked = 'sk-proj…' . substr($openai_key, -4);
                    $key_prefix = 'sk-proj';
                } else {
                    $masked = substr($openai_key, 0, 4) . '…' . substr($openai_key, -4);
                    $key_prefix = null;
                }
                return new WP_REST_Response([
                    'openai_key' => $masked,
                    'key_prefix' => $key_prefix
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/delete-openai-key', array(
            'methods' => 'POST',
            'callback' => function () {
                $result = $this->helpmate->get_api()->delete_openai_key();
                return new WP_REST_Response($result, $result['success'] ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/deactivate-feedback', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $reason = $request->get_param('reason') ?? '';
                $result = $this->helpmate->get_api()->send_deactivate_feedback($reason);
                return new WP_REST_Response([
                    'success' => $result['success'],
                    'message' => $result['message']
                ], 200);
            },
            'permission_callback' => '__return_true'
        ));

        /* --------------------------------------- */
        /*               Promo Banner              */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/promo-banners', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 10;
                return $this->helpmate->get_promo_banner()->get_all_banners($page, $per_page);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
            'args' => array(
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0;
                    }
                ),
                'per_page' => array(
                    'default' => 10,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0 && $param <= 100;
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/promo-banners', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_promo_banner()->create_banner($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/promo-banners/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_promo_banner()->update_banner($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
            'args' => array(
                'id' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0;
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/promo-banners/(?P<id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_promo_banner()->delete_banner($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
            'args' => array(
                'id' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0;
                    }
                )
            )
        ));

        /* --------------------------------------- */
        /*         Promo Banner Templates          */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/promo-banner-templates', array(
            'methods' => 'GET',
            'callback' => function () {
                return new \WP_REST_Response([
                    'error' => false,
                    'templates' => $this->helpmate->get_promo_banner()->get_all_templates()
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/promo-banner-templates/(?P<layout>[1-3])', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $layout = $request->get_param('layout');
                return new \WP_REST_Response([
                    'error' => false,
                    'template' => $this->helpmate->get_promo_banner()->get_default_template_styles($layout)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
            'args' => array(
                'layout' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return in_array($param, ['1', '2', '3']);
                    }
                )
            )
        ));

        /* --------------------------------------- */
        /*                Dashboard                */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/dashboard/statistics', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $date_filter = $request->get_param('date_filter');
                $user_id = $request->get_param('user_id') ? (int) $request->get_param('user_id') : null;
                return $this->helpmate->get_dashboard()->get_dashboard_data($date_filter, $user_id);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/dashboard/overview', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_dashboard()->get_dashboard_overview(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Review analytics endpoint
        register_rest_route('helpmate/v1', '/analytics/reviews', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $date_from = $request->get_param('date_from') ? sanitize_text_field($request->get_param('date_from')) : null;
                $date_to = $request->get_param('date_to') ? sanitize_text_field($request->get_param('date_to')) : null;
                $user_id = $request->get_param('user_id') ? (int) $request->get_param('user_id') : null;

                global $wpdb;
                $reviews_table = esc_sql($wpdb->prefix . 'helpmate_chat_reviews');

                // Build cache key based on query parameters
                $cache_key = 'helpmate_reviews_' . md5($date_from . $date_to);
                $reviews = wp_cache_get($cache_key, 'helpmate');

                if (false === $reviews) {
                    // Build query based on filters
                    if ($date_from && $date_to) {
                        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct query necessary for custom table
                        $reviews = $wpdb->get_results(
                            $wpdb->prepare(
                                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix and esc_sql
                                "SELECT * FROM {$reviews_table} WHERE created_at >= %s AND created_at <= %s ORDER BY created_at DESC",
                                $date_from . ' 00:00:00',
                                $date_to . ' 23:59:59'
                            ),
                            ARRAY_A
                        );
                    } elseif ($date_from) {
                        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct query necessary for custom table
                        $reviews = $wpdb->get_results(
                            $wpdb->prepare(
                                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix and esc_sql
                                "SELECT * FROM {$reviews_table} WHERE created_at >= %s ORDER BY created_at DESC",
                                $date_from . ' 00:00:00'
                            ),
                            ARRAY_A
                        );
                    } elseif ($date_to) {
                        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct query necessary for custom table
                        $reviews = $wpdb->get_results(
                            $wpdb->prepare(
                                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix and esc_sql
                                "SELECT * FROM {$reviews_table} WHERE created_at <= %s ORDER BY created_at DESC",
                                $date_to . ' 23:59:59'
                            ),
                            ARRAY_A
                        );
                    } else {
                        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct query necessary for custom table
                        $reviews = $wpdb->get_results(
                            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix and esc_sql
                            "SELECT * FROM {$reviews_table} ORDER BY created_at DESC",
                            ARRAY_A
                        );
                    }
                    // Cache for 5 minutes
                    wp_cache_set($cache_key, $reviews, 'helpmate', 300);
                }

                // Calculate statistics
                $total_reviews = count($reviews);
                $average_rating = 0;
                if ($total_reviews > 0) {
                    $sum_ratings = array_sum(array_column($reviews, 'rating'));
                    $average_rating = round($sum_ratings / $total_reviews, 2);
                }

                // Format reviews list
                $reviews_list = array_map(function($review) {
                    return [
                        'id' => (int) $review['id'],
                        'session_id' => $review['session_id'],
                        'conversation_id' => $review['conversation_id'],
                        'rating' => (int) $review['rating'],
                        'message' => $review['message'],
                        'created_at' => $review['created_at'],
                    ];
                }, $reviews);

                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'average_rating' => $average_rating,
                        'total_reviews' => $total_reviews,
                        'reviews_this_period' => $total_reviews,
                        'reviews_list' => $reviews_list,
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        /* --------------------------------------- */
        /*      Document management endpoints      */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/save-documents', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->store_document($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/remove-documents', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->remove_documents($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts') && $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active()
        ));

        register_rest_route('helpmate/v1', '/get-documents', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->get_indexed_documents($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/documents/count', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_document_handler()->all_documents_count(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/update-documents', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->update_document($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts') && $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active()
        ));

        register_rest_route('helpmate/v1', '/extract-file-text', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->extract_file_text($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        /* --------------------------------------- */
        /*      Background processing endpoints    */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/bulk-job-status/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->get_bulk_job_status($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'job_id' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return !empty($param) && preg_match('/^[a-zA-Z0-9_-]+$/', $param);
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/bulk-job-cancel/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->cancel_bulk_job($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'job_id' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return !empty($param) && preg_match('/^[a-zA-Z0-9_-]+$/', $param);
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/bulk-jobs', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->get_user_bulk_jobs($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0;
                    }
                ),
                'per_page' => array(
                    'default' => 10,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0 && $param <= 100;
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/background-processing-status', array(
            'methods' => 'GET',
            'callback' => fn() => $this->get_background_processing_status(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/debug-job/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->debug_job($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'job_id' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return !empty($param) && preg_match('/^[a-zA-Z0-9_-]+$/', $param);
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/manual-process-job/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->manual_process_job($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'job_id' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return !empty($param) && preg_match('/^[a-zA-Z0-9_-]+$/', $param);
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/force-process-stuck-jobs', array(
            'methods' => 'POST',
            'callback' => fn() => $this->force_process_stuck_jobs(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/cleanup-completed-jobs', array(
            'methods' => 'POST',
            'callback' => fn() => $this->cleanup_completed_jobs(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/bulk-job-delete/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->delete_bulk_job($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'job_id' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return !empty($param) && preg_match('/^[a-zA-Z0-9_-]+$/', $param);
                    }
                )
            )
        ));

        /* --------------------------------------- */
        /*                   Chat                  */
        /* --------------------------------------- */

        register_rest_route('helpmate/v1', '/chat/all-sessions', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 10;
                return $this->helpmate->get_chat()->get_all_chat_sessions($page, $per_page);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0;
                    }
                ),
                'per_page' => array(
                    'default' => 10,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0 && $param <= 100;
                    }
                )
            )
        ));

        /* --------------------------------------- */
        /*      Dashboard checklist endpoint       */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/dashboard/checklist-status', array(
            'methods' => 'GET',
            'callback' => function () {
                $document_handler = $this->helpmate->get_document_handler();
                $chat_database = new Helpmate_Chat_Database();
                $settings = $this->helpmate->get_settings();
                $crm = $this->helpmate->get_crm();

                $has_knowledge_base = $document_handler->has_non_general_documents();
                $has_test_chat = $chat_database->has_test_chat_sessions();
                $has_customization = $settings->has_customization_changes();
                $has_business_hours_configured = $settings->has_business_hours_configured();
                $has_contacts = $crm ? $crm->has_contacts() : false;

                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'has_knowledge_base' => $has_knowledge_base,
                        'has_test_chat' => $has_test_chat,
                        'has_customization' => $has_customization,
                        'has_business_hours_configured' => $has_business_hours_configured,
                        'has_contacts' => $has_contacts,
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        /* --------------------------------------- */
        /*      Settings management endpoints      */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/settings/(?P<key>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $key = sanitize_text_field($request->get_param('key'));

                // Allow public access for smart_schedules with nonce verification
                if ($key === 'smart_schedules') {
                    $nonce = $request->get_header('x-wp-nonce');
                    if (!$nonce || !wp_verify_nonce(sanitize_key($nonce), 'wp_rest')) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Invalid security token'
                        ], 403);
                    }
                }

                return $this->helpmate->get_settings()->get_setting($key);
            },
            'permission_callback' => function ($request) {
                $key = sanitize_text_field($request->get_param('key'));
                // Allow public access for smart_schedules, require auth for others
                if ($key === 'smart_schedules') {
                    return true;
                }
                return is_user_logged_in() && current_user_can('edit_posts');
            },
            'args' => array(
                'key' => array(
                    'type' => 'string',
                    'required' => true,
                ),
            ),
        ));

        register_rest_route('helpmate/v1', '/settings', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);

                if (empty($body)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Request body is required'
                    ], 400);
                }

                // Live Chat (business hours) settings require Pro license.
                if (isset($body['behavior']) && is_array($body['behavior'])) {
                    $has_live_chat_keys = isset($body['behavior']['business_hours_enabled'])
                        || isset($body['behavior']['business_hours'])
                        || isset($body['behavior']['business_hours_timezone'])
                        || isset($body['behavior']['ai_takeover_after_seconds']);
                    $is_pro = $this->helpmate->get_product_slug() !== 'helpmate-free'
                        && $this->helpmate->is_helpmate_pro_active();
                    if ($has_live_chat_keys && !$is_pro) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => __('Live Chat settings require a Pro license.', 'helpmate-ai-chatbot'),
                        ], 403);
                    }
                }

                // Save the entire settings object under the key
                foreach ($body as $key => $value) {
                    if ($key === 'ai' && is_array($value)) {
                        unset($value['similarity_threshold']);
                    }
                    $this->helpmate->get_settings()->set_setting($key, $value);
                }

                try {
                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Settings updated successfully'
                    ], 200);
                } catch (Exception $e) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $e->getMessage()
                    ], 500);
                }
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/settings/(?P<key>[a-zA-Z0-9_-]+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $key = sanitize_text_field($request->get_param('key'));
                return $this->helpmate->get_settings()->delete_setting($key);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'key' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return preg_match('/^[a-zA-Z0-9_-]+$/', $param);
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/integrations/forminator/forms', array(
            'methods' => 'GET',
            'callback' => function () {
                return $this->helpmate->get_forminator_integration()->get_admin_forms_payload();
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));
        register_rest_route('helpmate/v1', '/integrations/wpforms/forms', array(
            'methods' => 'GET',
            'callback' => function () {
                return $this->helpmate->get_wpforms_integration()->get_admin_forms_payload();
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));
        register_rest_route('helpmate/v1', '/integrations/events', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                return $this->helpmate->get_integration_events()->get_events($request);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/integrations/cf7/forms', array(
            'methods' => 'GET',
            'callback' => function () {
                return $this->helpmate->get_cf7_integration()->get_admin_forms_payload();
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));
        // Create default abandoned cart follow-up email templates
        register_rest_route('helpmate/v1', '/crm/abandoned-cart/create-default-followup-templates', array(
            'methods' => 'POST',
            'callback' => function () {
                $templates = $this->helpmate->get_crm()->create_default_abandoned_cart_followup_templates();

                if (empty($templates)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create default templates'
                    ], 500);
                }

                // Get current abandoned cart settings
                $settings = $this->helpmate->get_settings()->get_setting('abandoned_cart');
                if (!$settings) {
                    $settings = [];
                }

                // Get existing follow-up emails or initialize empty array
                $follow_up_emails = isset($settings['follow_up_emails']) ? $settings['follow_up_emails'] : [];

                // Check if default follow-up emails already exist
                $existing_ids = array_column($follow_up_emails, 'id');
                $next_id = !empty($existing_ids) ? max($existing_ids) + 1 : 1;

                // Create default follow-up email entries if they don't exist
                $default_emails = [
                    [
                        'id' => $next_id++,
                        'delay' => 3,
                        'delayUnit' => 'hours',
                        'template_id' => $templates['first'] ?? null,
                        'enabled' => false, // Disabled by default
                    ],
                    [
                        'id' => $next_id++,
                        'delay' => 1,
                        'delayUnit' => 'days',
                        'template_id' => $templates['second'] ?? null,
                        'enabled' => false, // Disabled by default
                    ],
                    [
                        'id' => $next_id++,
                        'delay' => 3,
                        'delayUnit' => 'days',
                        'template_id' => $templates['third'] ?? null,
                        'enabled' => false, // Disabled by default
                    ],
                ];

                // Only add emails that don't already exist (check by template_id)
                $existing_template_ids = array_column($follow_up_emails, 'template_id');
                foreach ($default_emails as $default_email) {
                    if ($default_email['template_id'] && !in_array($default_email['template_id'], $existing_template_ids)) {
                        $follow_up_emails[] = $default_email;
                    }
                }

                // Update settings with new follow-up emails
                $settings['follow_up_emails'] = $follow_up_emails;
                $this->helpmate->get_settings()->set_setting('abandoned_cart', $settings);

                return new WP_REST_Response([
                    'error' => false,
                    'templates' => $templates,
                    'follow_up_emails' => $follow_up_emails,
                    'message' => 'Default templates and follow-up emails created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        // Create default refund return email template
        register_rest_route('helpmate/v1', '/crm/refund-return/create-default-template', array(
            'methods' => 'POST',
            'callback' => function () {
                $template_id = $this->helpmate->get_crm()->create_default_refund_return_template();

                if (!$template_id) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create default template'
                    ], 500);
                }

                // Update refund return settings to use this template as default
                $settings = $this->helpmate->get_settings()->get_setting('refund_return');
                if ($settings) {
                    // Always set the newly created template as selected
                    $settings['selected_email_template'] = $template_id;
                    $this->helpmate->get_settings()->set_setting('refund_return', $settings);
                } else {
                    // Create new settings with the template
                    $this->helpmate->get_settings()->set_setting('refund_return', [
                        'selected_email_template' => $template_id,
                        'policy_url' => '',
                        'reasons' => [],
                    ]);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'template_id' => $template_id,
                    'message' => 'Default template created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        // Create default abandoned cart initial email template
        register_rest_route('helpmate/v1', '/crm/abandoned-cart/create-default-template', array(
            'methods' => 'POST',
            'callback' => function () {
                $template_id = $this->helpmate->get_crm()->create_default_abandoned_cart_template();

                if (!$template_id) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create default template'
                    ], 500);
                }

                // Update abandoned cart settings to use this template as default
                $settings = $this->helpmate->get_settings()->get_setting('abandoned_cart');
                if ($settings) {
                    // Always set the newly created template as selected
                    $settings['selected_email_template'] = $template_id;
                    $this->helpmate->get_settings()->set_setting('abandoned_cart', $settings);
                } else {
                    // Create new settings with the template
                    $this->helpmate->get_settings()->set_setting('abandoned_cart', [
                        'selected_email_template' => $template_id,
                        'abandoned_cart_after' => '60',
                        'delete_abandoned_cart_after' => '10080',
                        'cart_recovery_button_text' => 'Recover Cart',
                        'coupon_code' => '',
                        'follow_up_emails' => [],
                    ]);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'template_id' => $template_id,
                    'message' => 'Default template created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        /* --------------------------------------- */
        /*      Post management endpoints          */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/posts', [
            'methods' => 'GET',
            'callback' => array($this, 'get_posts'),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'post_type' => array(
                    'required' => false,
                    'validate_callback' => function ($param) {
                        return empty($param) || post_type_exists($param);
                    }
                )
            )
        ]);

        register_rest_route('helpmate/v1', '/post-types', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_public_post_types'),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
        ));

        register_rest_route('helpmate/v1', '/discounted-products', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->is_woocommerce_active() ? $this->get_discounted_products() : new WP_REST_Response([
                'error' => true,
                'message' => 'WooCommerce is not active.'
            ], 200),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/products/names', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                if (!$this->helpmate->is_woocommerce_active()) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'WooCommerce is not active.'
                    ], 400);
                }

                $product_ids = $request->get_param('ids');
                if (empty($product_ids)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Product IDs are required.'
                    ], 400);
                }

                // Parse comma-separated IDs or handle as array
                if (is_string($product_ids)) {
                    $product_ids = array_map('intval', explode(',', $product_ids));
                } elseif (is_array($product_ids)) {
                    $product_ids = array_map('intval', $product_ids);
                } else {
                    $product_ids = array(intval($product_ids));
                }

                $names = array();
                $woocommerce = $this->helpmate->get_woocommerce();

                foreach ($product_ids as $product_id) {
                    if ($product_id > 0) {
                        $product_info = $woocommerce->get_product_info($product_id);
                        if ($product_info && isset($product_info['name'])) {
                            $names[$product_id] = $product_info['name'];
                        } else {
                            $names[$product_id] = null;
                        }
                    }
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $names
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'ids' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return !empty($param);
                    }
                )
            )
        ));

        /* --------------------------------------- */
        /*                  Leads                  */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/leads', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 10;
                return $this->helpmate->get_leads()->get_all_leads($page, $per_page);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0;
                    }
                ),
                'per_page' => array(
                    'default' => 10,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0 && $param <= 100;
                    }
                )
            )
        ));

        // Assign contact to lead
        register_rest_route('helpmate/v1', '/leads/(?P<id>\d+)/assign-contact', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $lead_id = (int) $request->get_param('id');
                $contact_id = (int) $request->get_param('contact_id');
                $result = $this->helpmate->get_leads()->assign_contact($lead_id, $contact_id);
                return new WP_REST_Response([
                    'error' => !$result,
                    'message' => $result ? __('Contact assigned successfully', 'helpmate-ai-chatbot') : __('Failed to assign contact', 'helpmate-ai-chatbot')
                ], $result ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Create contact from lead
        register_rest_route('helpmate/v1', '/leads/(?P<id>\d+)/create-contact', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $lead_id = (int) $request->get_param('id');
                $contact_data = $request->get_json_params() ?? [];
                $contact_id = $this->helpmate->get_leads()->create_contact_from_lead($lead_id, $contact_data);
                return new WP_REST_Response([
                    'error' => !$contact_id,
                    'contact_id' => $contact_id,
                    'message' => $contact_id ? __('Contact created successfully', 'helpmate-ai-chatbot') : __('Failed to create contact', 'helpmate-ai-chatbot')
                ], $contact_id ? 201 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Create task from lead
        register_rest_route('helpmate/v1', '/leads/(?P<id>\d+)/create-task', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $lead_id = (int) $request->get_param('id');
                $task_data = $request->get_json_params();
                $task_id = $this->helpmate->get_leads()->create_task_from_lead($lead_id, $task_data ?? []);
                return new WP_REST_Response([
                    'error' => !$task_id,
                    'task_id' => $task_id,
                    'message' => $task_id ? __('Task created successfully', 'helpmate-ai-chatbot') : __('Failed to create task', 'helpmate-ai-chatbot')
                ], $task_id ? 201 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Bulk create tasks from leads
        register_rest_route('helpmate/v1', '/leads/bulk-create-task', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $lead_ids = $request->get_param('lead_ids');
                $task_data = $request->get_json_params();
                if (!is_array($lead_ids)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Invalid lead IDs', 'helpmate-ai-chatbot')
                    ], 400);
                }
                $results = [];
                foreach ($lead_ids as $lead_id) {
                    $task_id = $this->helpmate->get_leads()->create_task_from_lead((int) $lead_id, $task_data ?? []);
                    $results[] = ['lead_id' => (int) $lead_id, 'task_id' => $task_id, 'success' => (bool) $task_id];
                }
                return new WP_REST_Response([
                    'error' => false,
                    'results' => $results
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        /* --------------------------------------- */
        /*         Ticket management endpoints      */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/ticket/all', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 10;
                $contact_id = $request->get_param('contact_id') ? (int) $request->get_param('contact_id') : null;
                return $this->helpmate->get_ticket()->get_all_tickets($page, $per_page, $contact_id);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0;
                    }
                ),
                'per_page' => array(
                    'default' => 10,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return is_numeric($param) && $param > 0 && $param <= 100;
                    }
                )
            )
        ));

        register_rest_route('helpmate/v1', '/ticket/messages', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->helpmate->get_ticket()->get_ticket_messages($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Manual ticket creation (admin only)
        register_rest_route('helpmate/v1', '/tickets/create', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $request->get_json_params();
                $params['source'] = 'manual';
                return $this->helpmate->get_ticket()->create_ticket($params);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Assign contact to ticket
        register_rest_route('helpmate/v1', '/tickets/(?P<id>[a-zA-Z0-9_\.]+)/assign-contact', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $ticket_id = $request->get_param('id');
                $contact_id = (int) $request->get_param('contact_id');
                $result = $this->helpmate->get_ticket()->assign_contact($ticket_id, $contact_id);
                return new WP_REST_Response([
                    'error' => !$result,
                    'message' => $result ? __('Contact assigned successfully', 'helpmate-ai-chatbot') : __('Failed to assign contact', 'helpmate-ai-chatbot')
                ], $result ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Create task from ticket
        register_rest_route('helpmate/v1', '/tickets/(?P<id>[a-zA-Z0-9_\.]+)/create-task', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $ticket_id = $request->get_param('id');
                $task_data = $request->get_json_params();
                $task_id = $this->helpmate->get_ticket()->create_task_from_ticket($ticket_id, $task_data ?? []);
                return new WP_REST_Response([
                    'error' => !$task_id,
                    'task_id' => $task_id,
                    'message' => $task_id ? __('Task created successfully', 'helpmate-ai-chatbot') : __('Failed to create task', 'helpmate-ai-chatbot')
                ], $task_id ? 201 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Bulk create tasks from tickets
        register_rest_route('helpmate/v1', '/tickets/bulk-create-task', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $ticket_ids = $request->get_param('ticket_ids');
                $task_data = $request->get_json_params();
                if (!is_array($ticket_ids)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Invalid ticket IDs', 'helpmate-ai-chatbot')
                    ], 400);
                }
                $results = [];
                foreach ($ticket_ids as $ticket_id) {
                    $task_id = $this->helpmate->get_ticket()->create_task_from_ticket($ticket_id, $task_data ?? []);
                    $results[] = ['ticket_id' => $ticket_id, 'task_id' => $task_id, 'success' => (bool) $task_id];
                }
                return new WP_REST_Response([
                    'error' => false,
                    'results' => $results
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        register_rest_route('helpmate/v1', '/ticket/status', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);

                if (!isset($body['ticket_id']) || !isset($body['status'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Ticket ID and status are required'
                    ], 400);
                }

                $ticket_id = sanitize_text_field($body['ticket_id']);
                $status = sanitize_text_field($body['status']);

                // Validate status
                $valid_statuses = ['open', 'closed', 'pending', 'resolved'];
                if (!in_array($status, $valid_statuses)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid status. Must be one of: ' . implode(', ', $valid_statuses)
                    ], 400);
                }

                $success = $this->helpmate->get_ticket()->update_ticket_status($ticket_id, $status);

                if ($success) {
                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Ticket status updated successfully'
                    ], 200);
                } else {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to update ticket status'
                    ], 500);
                }
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        /* --------------------------------------- */
        /*              Social Chat                */
        /* --------------------------------------- */

        // Social accounts list
        // Get list of connected accounts (Pro only - moved to pro plugin)
        register_rest_route('helpmate/v1', '/social/accounts', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                // Check if pro is active
                if (!$this->helpmate->is_helpmate_pro_active() || $this->helpmate->get_api()->get_product_slug() === 'helpmate-free') {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Pro license required to manage social connections'
                    ], 403);
                }

                // If pro is active, delegate to pro plugin
                if (isset($GLOBALS['helpmate_pro'])) {
                    $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                    $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 10;
                    $pro_connections = $GLOBALS['helpmate_pro']->get_social_connections();
                    if ($pro_connections) {
                        return new WP_REST_Response([
                            'error' => false,
                            'data' => $pro_connections->get_accounts($page, $per_page)
                        ], 200);
                    }
                }

                // Fallback: return empty
                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'accounts' => [],
                        'pagination' => [
                            'page' => 1,
                            'per_page' => 10,
                            'total' => 0,
                            'total_pages' => 0
                        ]
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 10, 'sanitize_callback' => 'absint')
            )
        ));

        // Process incoming webhook event (called by license-server)
        register_rest_route('helpmate/v1', '/social/process-event', array(
            'methods' => 'POST',
            'callback' => array($this, 'process_social_event'),
            'permission_callback' => '__return_true' // License-server sends license key in header
        ));

        // Conversations list
        register_rest_route('helpmate/v1', '/social/conversations', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $filters = [
                    'platform' => $request->get_param('platform'),
                    'status' => $request->get_param('status'),
                    'is_human_handoff' => $request->get_param('is_human_handoff'),
                    'account_id' => $request->get_param('account_id'),
                    'contact_id' => $request->get_param('contact_id'),
                    'search' => $request->get_param('search'),
                    'date_from' => $request->get_param('date_from'),
                    'date_to' => $request->get_param('date_to')
                ];
                $filters = array_filter($filters, fn($v) => $v !== null && $v !== '');

                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 20;

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_social_chat()->get_conversations($filters, $page, $per_page)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 20, 'sanitize_callback' => 'absint'),
                'platform' => array('sanitize_callback' => 'sanitize_text_field'),
                'status' => array('sanitize_callback' => 'sanitize_text_field'),
                'is_human_handoff' => array('sanitize_callback' => 'absint'),
                'account_id' => array('sanitize_callback' => 'absint'),
                'contact_id' => array('sanitize_callback' => 'absint'),
                'search' => array('sanitize_callback' => 'sanitize_text_field'),
                'date_from' => array('sanitize_callback' => 'sanitize_text_field'),
                'date_to' => array('sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Get messages for a conversation (supports both numeric IDs and website virtual IDs)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/messages', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 50;

                // Mark as read (handles all conversation types: social, website, tickets)
                $social_chat = $this->helpmate->get_social_chat();
                if (is_numeric($conversation_id)) {
                    $social_chat->mark_as_read((int) $conversation_id);
                } else {
                    $social_chat->mark_as_read($conversation_id);
                }

                $messages_data = $this->helpmate->get_social_chat()->get_messages($conversation_id, $page, $per_page);

                // Check if user (frontend) is typing for website chats
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $social_chat = $this->helpmate->get_social_chat();
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);
                    if ($session_id) {
                        $user_typing_key = 'helpmate_typing_website_' . $session_id . '_user';
                        $is_user_typing = get_transient($user_typing_key) !== false;
                        // Add typing status to the returned data array
                        $messages_data['is_user_typing'] = $is_user_typing;
                    } else {
                        $messages_data['is_user_typing'] = false;
                    }
                } else {
                    // For non-website chats, set to false
                    $messages_data['is_user_typing'] = false;
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $messages_data
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 50, 'sanitize_callback' => 'absint')
            )
        ));

        // Get conversation participants (team members who joined)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/participants', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                $social_chat = $this->helpmate->get_social_chat();

                $participants = $social_chat->get_conversation_participants($conversation_id);

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $participants
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Send manual reply (supports both numeric IDs and website virtual IDs)
        // Typing indicator endpoints
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/typing', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');

                // Store typing status in transient (expires in 5 seconds)
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $social_chat = $this->helpmate->get_social_chat();
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);
                    if ($session_id) {
                        $transient_key = 'helpmate_typing_website_' . $session_id . '_admin';
                        $user_id = get_current_user_id();
                        set_transient($transient_key, $user_id, 5);
                    }
                } else {
                    $transient_key = 'helpmate_typing_social_' . $conversation_id . '_admin';
                    $user_id = get_current_user_id();
                    set_transient($transient_key, $user_id, 5);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Typing status updated'
                ]);
            },
            'permission_callback' => '__return_true'
        ));

        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/reply', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $message = $body['message'] ?? '';

                if (empty($message)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Message is required'
                    ], 400);
                }

                // Live Chat manual reply requires Pro for website and social (tickets stay free)
                if (strpos($conversation_id, 'ticket_') !== 0) {
                    if (!apply_filters('helpmate_live_chat_reply_allowed', false)) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => __('Live Chat manual reply requires a Pro license.', 'helpmate-ai-chatbot'),
                        ], 403);
                    }
                }

                // Clear typing status when sending a message
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $social_chat = $this->helpmate->get_social_chat();
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);
                    if ($session_id) {
                        delete_transient('helpmate_typing_website_' . $session_id . '_admin');
                    }
                } else {
                    delete_transient('helpmate_typing_social_' . $conversation_id . '_admin');
                }

                // Check if this is a ticket
                if (is_string($conversation_id) && strpos($conversation_id, 'ticket_') === 0) {
                    $ticket_id = substr($conversation_id, 7); // Remove 'ticket_' prefix
                    $ticket_module = $this->helpmate->get_ticket();

                    // Add reply to ticket
                    $result = $ticket_module->add_ticket_reply($ticket_id, $message, 'admin');

                    if ($result === false) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Failed to send reply'
                        ], 400);
                    }

                    // Unarchive when replying to archived conversation
                    $ticket_module->update_ticket_status($ticket_id, 'open');

                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Reply sent successfully'
                    ], 200);
                }

                // Check if this is a website conversation
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $social_chat = $this->helpmate->get_social_chat();
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);

                    if (!$session_id) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Session not found'
                        ], 404);
                    }

                    // Send website chat reply
                    $chat = $this->helpmate->get_chat();
                    $result = $chat->send_website_reply($session_id, $message);

                    if (is_wp_error($result)) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => $result->get_error_message()
                        ], 400);
                    }

                    // Unarchive when replying to archived conversation
                    $social_chat->update_website_conversation_status($session_id, 'open');

                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Reply sent successfully'
                    ], 200);
                } else {
                    // Social conversation reply
                    $processor = new Helpmate_Social_Message_Processor($this->helpmate);
                    $result = $processor->send_manual_reply((int) $conversation_id, $message);

                    if (is_wp_error($result)) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => $result->get_error_message()
                        ], 400);
                    }

                    // Unarchive when replying to archived conversation
                    $social_chat = $this->helpmate->get_social_chat();
                    $social_chat->update_conversation_status((int) $conversation_id, 'open');

                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Reply sent successfully'
                    ], 200);
                }
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Update message reply ID (called by social-server after replying to comment)
        register_rest_route('helpmate/v1', '/social/messages/(?P<id>\d+)/reply-id', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $message_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $reply_id = $body['reply_id'] ?? '';

                if (empty($reply_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Reply ID is required'
                    ], 400);
                }

                global $wpdb;
                $messages_table = esc_sql($wpdb->prefix . 'helpmate_social_messages');

                // Get current meta_data
                $message = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        "SELECT meta_data FROM {$messages_table} WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        $message_id
                    ),
                    ARRAY_A
                );

                if (!$message) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Message not found'
                    ], 404);
                }

                // Update meta_data with reply_id
                $meta_data = !empty($message['meta_data']) ? json_decode($message['meta_data'], true) : [];
                $meta_data['reply_id'] = $reply_id;

                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
                $result = $wpdb->update(
                    $messages_table,
                    ['meta_data' => wp_json_encode($meta_data)],
                    ['id' => $message_id]
                );

                if ($result === false) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to update message'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Reply ID updated successfully'
                ], 200);
            },
            'permission_callback' => function ($request) {
                // Verify license key from header (same as webhook-forward)
                $license_key = $request->get_header('X-License-Key');
                return $license_key === $this->helpmate->get_api()->get_key();
            },
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Delete comment reply
        register_rest_route('helpmate/v1', '/social/messages/(?P<id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $message_id = (int) $request->get_param('id');

                global $wpdb;
                $messages_table = esc_sql($wpdb->prefix . 'helpmate_social_messages');
                $conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
                $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

                // Get message with conversation and account info
                $message = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        "SELECT m.*, c.platform, c.account_id, a.page_id, a.instagram_account_id, a.access_token_encrypted
                        FROM {$messages_table} m
                        INNER JOIN {$conversations_table} c ON m.conversation_id = c.id
                        INNER JOIN {$accounts_table} a ON c.account_id = a.id
                        WHERE m.id = %d AND m.direction = 'outbound'",
                        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        $message_id
                    ),
                    ARRAY_A
                );

                if (!$message) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Message not found or not deletable'
                    ], 404);
                }

                // Only allow deleting comment replies
                if (!in_array($message['platform'], ['fb_comment', 'ig_comment'], true)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Only comment replies can be deleted'
                    ], 400);
                }

                // Get reply ID from meta_data
                $meta_data = !empty($message['meta_data']) ? json_decode($message['meta_data'], true) : [];
                $reply_id = $meta_data['reply_id'] ?? $message['external_id'] ?? null;

                if (empty($reply_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Reply ID not found'
                    ], 400);
                }

                // Get access token
                $social_chat = $this->helpmate->get_social_chat();
                $access_token = $social_chat->decrypt_value($message['access_token_encrypted']);

                // Call social-server to delete comment
                $api_server = $this->helpmate->get_api()->get_api_server();
                if (empty($api_server)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'API server not configured'
                    ], 500);
                }

                $platform = $message['platform'] === 'fb_comment' ? 'facebook' : 'instagram';
                // Use license-server proxy endpoint which forwards to social-server
                $response = wp_remote_post($api_server . '/wp-json/rp/v1/social/comments/' . $reply_id . '/delete', [
                    'headers' => ['Content-Type' => 'application/json'],
                    'body' => wp_json_encode([
                        'access_token' => $access_token,
                        'platform' => $platform
                    ]),
                    'timeout' => 30
                ]);

                if (is_wp_error($response)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $response->get_error_message()
                    ], 500);
                }

                $response_code = wp_remote_retrieve_response_code($response);
                $response_body = wp_remote_retrieve_body($response);
                $result = json_decode($response_body, true);

                if ($response_code !== 200 || (isset($result['error']) && $result['error'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result['message'] ?? $result['details'] ?? 'Failed to delete comment',
                        'details' => $result
                    ], $response_code !== 200 ? $response_code : 500);
                }

                // Delete message from database
                $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $messages_table,
                    ['id' => $message_id],
                    ['%d']
                );

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Comment deleted successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Real-time messages: short-poll (returns immediately, avoids holding PHP worker)
        register_rest_route('helpmate/v1', '/realtime/messages/poll', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('conversation_id');
                $last_id = (int) $request->get_param('last_id');
                if (empty($conversation_id)) {
                    return new WP_REST_Response(['error' => true, 'message' => 'conversation_id is required'], 400);
                }
                $realtime = new Helpmate_Realtime($this->helpmate);
                $out = $realtime->get_new_messages_poll($conversation_id, $last_id);
                return new WP_REST_Response($out, 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'conversation_id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                'last_id' => array('default' => 0, 'sanitize_callback' => 'absint'),
            )
        ));

        // Real-time messages SSE endpoint (legacy; prefer /realtime/messages/poll to avoid worker starvation)
        register_rest_route('helpmate/v1', '/realtime/messages', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('conversation_id');

                if (empty($conversation_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'conversation_id is required'
                    ], 400);
                }

                $realtime = new Helpmate_Realtime($this->helpmate);
                $realtime->handle_sse_messages($conversation_id);
                exit; // Exit after sending SSE stream
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'conversation_id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        /* --------------------------------------- */
        /*              Notifications              */
        /* --------------------------------------- */

        $notifications = $this->helpmate->get_notifications();

        // Notifications short-poll (returns immediately, avoids holding PHP worker; prefer over stream)
        register_rest_route('helpmate/v1', '/notifications/poll', array(
            'methods' => 'GET',
            'callback' => function ($request) use ($notifications) {
                $last_id = (int) $request->get_param('last_id');
                $limit = min(50, max(1, (int) $request->get_param('limit')));
                $items = $notifications->get_new_since($last_id, $limit);
                $new_last = $last_id;
                if (!empty($items)) {
                    $new_last = (int) end($items)['id'];
                }
                return new WP_REST_Response(array(
                    'notifications' => $items,
                    'last_id' => $new_last,
                ), 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'last_id' => array('default' => 0, 'sanitize_callback' => 'absint'),
                'limit' => array('default' => 50, 'sanitize_callback' => 'absint'),
            )
        ));

        // Notifications SSE stream (legacy; prefer /notifications/poll to avoid worker starvation)
        register_rest_route('helpmate/v1', '/notifications/stream', array(
            'methods' => 'GET',
            'callback' => function ($request) use ($notifications) {
                if (ob_get_level()) {
                    ob_end_clean();
                }
                // Release session lock so other same-session requests (e.g. mark read, list) are not blocked
                if (session_status() === PHP_SESSION_NONE) {
                    @session_start(); // phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged -- Avoid blocking other requests
                }
                session_write_close();
                // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- Necessary for SSE long-running connections
                set_time_limit(0);
                ignore_user_abort(true);

                header('Content-Type: text/event-stream');
                header('Cache-Control: no-cache');
                header('Connection: keep-alive');
                header('X-Accel-Buffering: no');

                $last_id = (int) $request->get_param('last_id');
                $timeout = 300;
                $start = time();
                $heartbeat_interval = 18;
                $last_heartbeat = time();

                while ((time() - $start) < $timeout) {
                    if (connection_aborted()) {
                        break;
                    }

                    $new_items = $notifications->get_new_since($last_id, 50);
                    foreach ($new_items as $item) {
                        echo 'event: notification' . "\n";
                        echo 'data: ' . wp_json_encode($item) . "\n\n";
                    }
                    if (!empty($new_items)) {
                        $last_id = max($last_id, (int) end($new_items)['id']);
                    }

                    if (time() - $last_heartbeat >= $heartbeat_interval) {
                        echo 'event: heartbeat' . "\n";
                        echo 'data: ' . wp_json_encode(array('ts' => time())) . "\n\n";
                        $last_heartbeat = time();
                    }

                    if (ob_get_level()) {
                        ob_flush();
                    }
                    flush();
                    if (session_status() === PHP_SESSION_ACTIVE) {
                        session_write_close();
                    }
                    usleep(1000000);
                }
                exit;
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'last_id' => array('default' => 0, 'sanitize_callback' => 'absint')
            )
        ));

        // Notifications list (paginated)
        register_rest_route('helpmate/v1', '/notifications', array(
            'methods' => 'GET',
            'callback' => function ($request) use ($notifications) {
                $page = (int) $request->get_param('page');
                $per_page = (int) $request->get_param('per_page');
                $read = $request->get_param('read');
                $type = $request->get_param('type');
                $result = $notifications->get_list(
                    $page ?: 1,
                    $per_page ?: 20,
                    $read === 'read' || $read === 'unread' ? $read : null,
                    $type ? sanitize_text_field($type) : null
                );
                return new WP_REST_Response(array(
                    'data' => $result['items'],
                    'total' => $result['total'],
                ), 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 20, 'sanitize_callback' => 'absint'),
                'read' => array('sanitize_callback' => 'sanitize_text_field'),
                'type' => array('sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Mark single notification as read
        register_rest_route('helpmate/v1', '/notifications/(?P<id>\d+)/read', array(
            'methods' => 'POST',
            'callback' => function ($request) use ($notifications) {
                $ok = $notifications->mark_read((int) $request->get_param('id'));
                return new WP_REST_Response(array('success' => $ok), $ok ? 200 : 404);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array('id' => array('required' => true, 'validate_callback' => fn($p) => is_numeric($p) && $p > 0))
        ));

        // Mark notifications as read (bulk by IDs)
        register_rest_route('helpmate/v1', '/notifications/read-bulk', array(
            'methods' => 'POST',
            'callback' => function ($request) use ($notifications) {
                $body = json_decode($request->get_body(), true);
                $ids = isset($body['ids']) && is_array($body['ids']) ? $body['ids'] : array();
                $n = $notifications->mark_read_bulk($ids);
                return new WP_REST_Response(array('marked' => $n), 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Mark as read by entity (e.g. when opening a ticket)
        register_rest_route('helpmate/v1', '/notifications/mark-read-by-entity', array(
            'methods' => 'POST',
            'callback' => function ($request) use ($notifications) {
                $body = json_decode($request->get_body(), true);
                $entity_type = isset($body['entity_type']) ? sanitize_text_field($body['entity_type']) : '';
                $entity_id = isset($body['entity_id']) ? (int) $body['entity_id'] : 0;
                if ($entity_type === '' || $entity_id <= 0) {
                    return new WP_REST_Response(array('error' => true, 'message' => 'entity_type and entity_id required'), 400);
                }
                $n = $notifications->mark_read_by_entity($entity_type, $entity_id);
                return new WP_REST_Response(array('marked' => $n), 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Mark as read by type (e.g. when opening Appointments section)
        register_rest_route('helpmate/v1', '/notifications/mark-read-by-type', array(
            'methods' => 'POST',
            'callback' => function ($request) use ($notifications) {
                $body = json_decode($request->get_body(), true);
                $type = isset($body['type']) ? sanitize_text_field($body['type']) : '';
                if ($type === '') {
                    return new WP_REST_Response(array('error' => true, 'message' => 'type required'), 400);
                }
                $n = $notifications->mark_read_by_type($type);
                return new WP_REST_Response(array('marked' => $n), 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Unread counts (for badges)
        register_rest_route('helpmate/v1', '/notifications/unread-counts', array(
            'methods' => 'GET',
            'callback' => function () use ($notifications) {
                return new WP_REST_Response($notifications->get_unread_counts(), 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Delete single notification
        register_rest_route('helpmate/v1', '/notifications/(?P<id>\d+)', array(
            'methods' => 'DELETE',
            'callback' => function ($request) use ($notifications) {
                $ok = $notifications->delete_one((int) $request->get_param('id'));
                return new WP_REST_Response(array('success' => $ok), $ok ? 200 : 404);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array('id' => array('required' => true, 'validate_callback' => fn($p) => is_numeric($p) && $p > 0))
        ));

        // Clear all notifications (delete all visible to current user)
        register_rest_route('helpmate/v1', '/notifications/clear-all', array(
            'methods' => 'DELETE',
            'callback' => function () use ($notifications) {
                $n = $notifications->clear_all();
                return new WP_REST_Response(array('deleted' => $n), 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // POST fallback for clear-all (if DELETE is stripped)
        register_rest_route('helpmate/v1', '/notifications/clear-all', array(
            'methods' => 'POST',
            'callback' => function ($request) use ($notifications) {
                $body = json_decode($request->get_body(), true);
                if (isset($body['action']) && $body['action'] === 'clear_all') {
                    $n = $notifications->clear_all();
                    return new WP_REST_Response(array('deleted' => $n), 200);
                }
                return new WP_REST_Response(array('error' => true, 'message' => 'Invalid action'), 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Toggle human handoff (supports both numeric IDs and website virtual IDs)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/handoff', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $handoff = isset($body['handoff']) ? (bool) $body['handoff'] : true;

                // Live Chat handoff requires Pro for website and social (tickets stay free)
                if (strpos($conversation_id, 'ticket_') !== 0) {
                    if (!apply_filters('helpmate_live_chat_reply_allowed', false)) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => __('Live Chat handoff requires a Pro license.', 'helpmate-ai-chatbot'),
                        ], 403);
                    }
                }

                $social_chat = $this->helpmate->get_social_chat();

                // Check if this is a website conversation
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);

                    if (!$session_id) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Session not found'
                        ], 404);
                    }

                    $result = $social_chat->toggle_website_handoff($session_id, $handoff);
                } else {
                    $result = $social_chat->toggle_handoff((int) $conversation_id, $handoff);
                }

                return new WP_REST_Response([
                    'error' => !$result,
                    'message' => $result
                        ? ($handoff ? 'Human handoff activated' : 'Human handoff deactivated')
                        : 'Failed to update handoff status'
                ], $result ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Bulk toggle human handoff for all conversations of a platform
        register_rest_route('helpmate/v1', '/social/conversations/bulk-handoff', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $platform = isset($body['platform']) ? sanitize_text_field($body['platform']) : '';
                $handoff = isset($body['handoff']) ? (bool) $body['handoff'] : true;

                if (empty($platform)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Platform is required'
                    ], 400);
                }

                $social_chat = $this->helpmate->get_social_chat();
                $result = $social_chat->bulk_toggle_handoff_by_platform($platform, $handoff);

                if ($result === -1) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to update conversations'
                    ], 400);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => sprintf(
                        $handoff
                            ? 'Human handoff activated for %d conversation(s)'
                            : 'Human handoff deactivated for %d conversation(s)',
                        $result
                    ),
                    'updated_count' => $result
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Update conversation status (supports both numeric IDs, website virtual IDs, and ticket IDs)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/status', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $status = $body['status'] ?? '';

                $valid_statuses = ['open', 'resolved', 'archived'];
                if (!in_array($status, $valid_statuses)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid status. Must be one of: ' . implode(', ', $valid_statuses)
                    ], 400);
                }

                $social_chat = $this->helpmate->get_social_chat();

                // Check if this is a ticket
                if (is_string($conversation_id) && strpos($conversation_id, 'ticket_') === 0) {
                    $ticket_id = substr($conversation_id, 7); // Remove 'ticket_' prefix
                    $ticket_module = $this->helpmate->get_ticket();

                    // Map inbox status to ticket status
                    // 'archived' → 'closed', 'open' → 'open'
                    $ticket_status = ($status === 'archived') ? 'closed' : 'open';

                    $result = $ticket_module->update_ticket_status($ticket_id, $ticket_status);

                    return new WP_REST_Response([
                        'error' => !$result,
                        'message' => $result ? 'Status updated' : 'Failed to update status'
                    ], $result ? 200 : 400);
                }

                // Check if this is a website conversation
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);

                    if (!$session_id) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Session not found'
                        ], 404);
                    }

                    $result = $social_chat->update_website_conversation_status($session_id, $status);
                } else {
                    $result = $social_chat->update_conversation_status((int) $conversation_id, $status);
                }

                return new WP_REST_Response([
                    'error' => !$result,
                    'message' => $result ? 'Status updated' : 'Failed to update status'
                ], $result ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Get reviews for a conversation
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/reviews', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                global $wpdb;
                $reviews_table = esc_sql($wpdb->prefix . 'helpmate_chat_reviews');

                $reviews = $wpdb->get_results($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    "SELECT * FROM {$reviews_table} WHERE conversation_id = %s ORDER BY created_at DESC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    $conversation_id
                ), ARRAY_A);

                $user_ended_chat = false;
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $session_id = $this->helpmate->get_social_chat()->get_session_id_from_virtual_id($conversation_id);
                    if ($session_id) {
                        $user_ended_chat = get_transient('helpmate_review_request_' . $session_id) !== false;
                    }
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'reviews' => array_map(function($review) {
                            return [
                                'id' => (int) $review['id'],
                                'session_id' => $review['session_id'],
                                'conversation_id' => $review['conversation_id'],
                                'rating' => (int) $review['rating'],
                                'message' => $review['message'],
                                'created_at' => $review['created_at'],
                                'updated_at' => $review['updated_at'],
                            ];
                        }, $reviews),
                        'user_ended_chat' => $user_ended_chat,
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // End chat from admin (triggers review form for website conversations)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/end-chat', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                $social_chat = $this->helpmate->get_social_chat();

                // Check if this is a website conversation
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);

                    if (!$session_id) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Session not found'
                        ], 404);
                    }

                    // Set transient for review request (expires in 1 hour)
                    $transient_key = 'helpmate_review_request_' . $session_id;
                    set_transient($transient_key, true, 3600);

                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Chat ended successfully. Review form will be shown to the user.'
                    ], 200);
                } else {
                    // For non-website conversations, just return success
                    // (they don't have review functionality)
                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Chat ended successfully'
                    ], 200);
                }
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Link contact to conversation (supports both numeric and string IDs)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/link-contact', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $contact_id = isset($body['contact_id']) ? (int) $body['contact_id'] : null;

                if (!$contact_id || $contact_id <= 0) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Valid contact_id is required'
                    ], 400);
                }

                // Verify contact exists
                $contact = $this->helpmate->get_crm()->get_contact($contact_id);
                if (!$contact) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Contact not found'
                    ], 404);
                }

                // Check if this is a website conversation (string ID starting with 'website_')
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $result = $this->helpmate->get_social_chat()->link_contact_to_website_conversation($conversation_id, $contact_id);
                } elseif (is_numeric($conversation_id)) {
                    $result = $this->helpmate->get_social_chat()->link_contact_to_conversation((int) $conversation_id, $contact_id);
                } else {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid conversation ID'
                    ], 400);
                }

                return new WP_REST_Response([
                    'error' => !$result,
                    'message' => $result ? 'Contact linked successfully' : 'Failed to link contact'
                ], $result ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true)
            )
        ));

        // Get contact for conversation (supports both numeric and string IDs)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/contact', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');

                // Check if this is a website conversation (string ID starting with 'website_')
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $social_chat = $this->helpmate->get_social_chat();
                    $session_id = $social_chat->get_session_id_from_virtual_id($conversation_id);
                    if ($session_id) {
                        $contact_id = $social_chat->get_contact_id_for_website_conversation($session_id);
                        if ($contact_id) {
                            $contact = $this->helpmate->get_crm()->get_contact($contact_id);
                            return new WP_REST_Response([
                                'error' => false,
                                'data' => $contact
                            ], 200);
                        }
                    }
                    return new WP_REST_Response([
                        'error' => false,
                        'data' => null
                    ], 200);
                } elseif (is_numeric($conversation_id)) {
                    $contact = $this->helpmate->get_social_chat()->get_conversation_contact((int) $conversation_id);
                    return new WP_REST_Response([
                        'error' => false,
                        'data' => $contact
                    ], 200);
                } else {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid conversation ID'
                    ], 400);
                }
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true)
            )
        ));

        // Unlink contact from conversation (supports both numeric and string IDs)
        register_rest_route('helpmate/v1', '/social/conversations/(?P<id>[^/]+)/unlink-contact', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $conversation_id = $request->get_param('id');

                // Check if this is a website conversation (string ID starting with 'website_')
                if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
                    $result = $this->helpmate->get_social_chat()->unlink_contact_from_website_conversation($conversation_id);
                } elseif (is_numeric($conversation_id)) {
                    $result = $this->helpmate->get_social_chat()->unlink_contact_from_conversation((int) $conversation_id);
                } else {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid conversation ID'
                    ], 400);
                }

                return new WP_REST_Response([
                    'error' => !$result,
                    'message' => $result ? 'Contact unlinked successfully' : 'Failed to unlink contact'
                ], $result ? 200 : 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true)
            )
        ));

        // Edit comment reply
        register_rest_route('helpmate/v1', '/social/messages/(?P<id>\d+)/edit', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $message_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $new_content = $body['content'] ?? '';

                if (empty($new_content)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Content is required'
                    ], 400);
                }

                global $wpdb;
                $messages_table = esc_sql($wpdb->prefix . 'helpmate_social_messages');
                $conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
                $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

                // Get message with conversation and account info
                $message = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        "SELECT m.*, c.platform, c.account_id, a.page_id, a.instagram_account_id, a.access_token_encrypted
                        FROM {$messages_table} m
                        INNER JOIN {$conversations_table} c ON m.conversation_id = c.id
                        INNER JOIN {$accounts_table} a ON c.account_id = a.id
                        WHERE m.id = %d AND m.direction = 'outbound'",
                        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        $message_id
                    ),
                    ARRAY_A
                );

                if (!$message) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Message not found or not editable'
                    ], 404);
                }

                // Only allow editing comments
                if (!in_array($message['platform'], ['fb_comment', 'ig_comment'], true)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Only comment replies can be edited'
                    ], 400);
                }

                // Get reply ID from meta_data
                $meta_data = !empty($message['meta_data']) ? json_decode($message['meta_data'], true) : [];
                $reply_id = $meta_data['reply_id'] ?? $message['external_id'] ?? null;

                if (empty($reply_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Reply ID not found'
                    ], 400);
                }

                // Get access token
                $social_chat = $this->helpmate->get_social_chat();
                $access_token = $social_chat->decrypt_value($message['access_token_encrypted']);

                // Call social-server to update comment
                $api_server = $this->helpmate->get_api()->get_api_server();
                if (empty($api_server)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'API server not configured'
                    ], 500);
                }

                $platform = $message['platform'] === 'fb_comment' ? 'facebook' : 'instagram';
                // Use license-server proxy endpoint which forwards to social-server
                $response = wp_remote_post($api_server . '/wp-json/rp/v1/social/comments/' . $reply_id . '/edit', [
                    'headers' => ['Content-Type' => 'application/json'],
                    'body' => wp_json_encode([
                        'message' => $new_content,
                        'access_token' => $access_token,
                        'platform' => $platform
                    ]),
                    'timeout' => 30
                ]);

                if (is_wp_error($response)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $response->get_error_message()
                    ], 500);
                }

                $response_code = wp_remote_retrieve_response_code($response);
                $response_body = wp_remote_retrieve_body($response);
                $result = json_decode($response_body, true);

                if ($response_code !== 200 || (isset($result['error']) && $result['error'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result['message'] ?? $result['details'] ?? 'Failed to update comment',
                        'details' => $result
                    ], $response_code !== 200 ? $response_code : 500);
                }

                // Update message in database
                $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $messages_table,
                    ['content' => sanitize_textarea_field($new_content)],
                    ['id' => $message_id]
                );

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Comment updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Social chat analytics
        register_rest_route('helpmate/v1', '/social/analytics', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $date_filter = $request->get_param('date_filter') ?? '30d';
                $user_id = $request->get_param('user_id') ? (int) $request->get_param('user_id') : null;
                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_social_chat()->get_analytics($date_filter, $user_id)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'date_filter' => array('default' => '30d', 'sanitize_callback' => 'sanitize_text_field'),
                'user_id' => array('required' => false, 'type' => 'integer', 'sanitize_callback' => 'absint')
            )
        ));

        // Social chat settings (credentials)
        register_rest_route('helpmate/v1', '/social/settings', array(
            'methods' => 'GET',
            'callback' => function () {
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $behavior = $this->helpmate->get_settings()->get_setting('behavior', []);
                $social_chat = $this->helpmate->get_social_chat();

                // Don't expose decrypted secrets, just indicate if they're set
                return new WP_REST_Response([
                    'error' => false,
                    'settings' => [
                        'app_id_set' => !empty($settings['app_id']),
                        'app_secret_set' => !empty($settings['app_secret']),
                        'webhook_url' => $social_chat->get_webhook_url(),
                        'webhook_verify_token' => $settings['webhook_verify_token'] ?? '',
                        'enabled' => $settings['enabled'] ?? false,
                        'platforms' => $settings['platforms'] ?? [],
                        'leads_enabled' => $settings['leads_enabled'] ?? false,
                        'conversation_starters_enabled' => $settings['conversation_starters_enabled'] ?? false,
                        'collect_lead' => $behavior['collect_lead'] ?? false,
                        'lead_form_fields' => $behavior['lead_form_fields'] ?? ['name', 'email', 'message'],
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Update social chat settings
        register_rest_route('helpmate/v1', '/social/settings', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $social_chat = $this->helpmate->get_social_chat();

                // Update only provided fields
                if (isset($body['app_id'])) {
                    $settings['app_id'] = $social_chat->encrypt_value(sanitize_text_field($body['app_id']));
                }
                if (isset($body['app_secret'])) {
                    $settings['app_secret'] = $social_chat->encrypt_value(sanitize_text_field($body['app_secret']));
                }
                if (isset($body['enabled'])) {
                    $settings['enabled'] = (bool) $body['enabled'];
                }
                if (isset($body['platforms'])) {
                    // Track auto_reply changes before updating
                    $old_platforms = $settings['platforms'] ?? [];
                    $new_platforms = $body['platforms'];

                    // Check for auto_reply changes and trigger bulk handoff
                    $platform_keys = ['messenger', 'instagram_dm', 'whatsapp'];
                    foreach ($platform_keys as $platform_key) {
                        $old_auto_reply = $old_platforms[$platform_key]['auto_reply'] ?? true;
                        $new_auto_reply = $new_platforms[$platform_key]['auto_reply'] ?? true;

                        // If auto_reply changed, trigger bulk handoff
                        if ($old_auto_reply !== $new_auto_reply) {
                            $social_chat->bulk_toggle_handoff_by_platform($platform_key, !$new_auto_reply);
                        }
                    }

                    // If conversation_starters_enabled went from true to false for any platform, remove ice breakers
                    $meta_platform_map = ['messenger' => 'messenger', 'instagram_dm' => 'instagram'];
                    foreach ($meta_platform_map as $platform_key => $api_platform) {
                        $old_cs = $old_platforms[$platform_key]['conversation_starters_enabled'] ?? false;
                        $new_cs = $new_platforms[$platform_key]['conversation_starters_enabled'] ?? false;
                        if ($old_cs && !$new_cs) {
                            $accounts_result = $social_chat->get_accounts(1, 100);
                            $accounts = $accounts_result['accounts'] ?? [];
                            global $wpdb;
                            $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');
                            foreach ($accounts as $account) {
                                $account_platform = $account['platform'] ?? '';
                                if ($account_platform !== $api_platform) {
                                    continue;
                                }
                                $profile_id = ($api_platform === 'instagram' && !empty($account['instagram_account_id']))
                                    ? $account['instagram_account_id']
                                    : ($account['page_id'] ?? '');
                                $account_id = $account['id'] ?? 0;
                                if (empty($profile_id)) {
                                    continue;
                                }
                                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Sensitive data
                                $access_token_encrypted = $wpdb->get_var($wpdb->prepare(
                                    "SELECT access_token_encrypted FROM {$accounts_table} WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                                    $account_id
                                ));
                                if (empty($access_token_encrypted)) {
                                    continue;
                                }
                                $access_token = $social_chat->decrypt_value($access_token_encrypted);
                                if (!empty($access_token)) {
                                    $social_chat->update_messenger_profile_ice_breakers($profile_id, $access_token, [], $api_platform);
                                }
                            }
                        }
                    }

                    $settings['platforms'] = $new_platforms;
                }
                if (isset($body['leads_enabled'])) {
                    $settings['leads_enabled'] = (bool) $body['leads_enabled'];
                }
                if (isset($body['conversation_starters_enabled'])) {
                    $old_conversation_starters_enabled = $settings['conversation_starters_enabled'] ?? false;
                    $new_conversation_starters_enabled = (bool) $body['conversation_starters_enabled'];
                    $settings['conversation_starters_enabled'] = $new_conversation_starters_enabled;

                    // If conversation starters are being disabled, delete all ice breakers from Meta platforms
                    if ($old_conversation_starters_enabled && !$new_conversation_starters_enabled) {
                        $accounts_result = $social_chat->get_accounts(1, 100); // Get all accounts
                        $accounts = $accounts_result['accounts'] ?? [];

                        // Get access tokens from database directly
                        global $wpdb;
                        $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

                        foreach ($accounts as $account) {
                            $platform = $account['platform'] ?? '';

                            // Only process Messenger and Instagram accounts
                            if (in_array($platform, ['messenger', 'instagram'], true)) {
                                $profile_id = ($platform === 'instagram' && !empty($account['instagram_account_id']))
                                    ? $account['instagram_account_id']
                                    : ($account['page_id'] ?? '');
                                $account_id = $account['id'] ?? 0;

                                if (empty($profile_id)) {
                                    continue;
                                }

                                // Get access_token_encrypted directly from database
                                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Sensitive data that changes frequently, caching not appropriate
                                $access_token_encrypted = $wpdb->get_var($wpdb->prepare(
                                    "SELECT access_token_encrypted FROM {$accounts_table} WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                                    $account_id
                                ));

                                if (empty($access_token_encrypted)) {
                                    continue;
                                }

                                $access_token = $social_chat->decrypt_value($access_token_encrypted);

                                if (empty($access_token)) {
                                    continue;
                                }

                                // Remove ice breakers by passing empty array
                                $social_chat->update_messenger_profile_ice_breakers($profile_id, $access_token, [], $platform);
                            }
                        }
                    }
                }

                $this->helpmate->get_settings()->set_setting('social_chat', $settings);

                // Website lead capture (collect_lead, lead_form_fields) are stored in behavior
                if (array_key_exists('collect_lead', $body) || array_key_exists('lead_form_fields', $body)) {
                    $behavior = $this->helpmate->get_settings()->get_setting('behavior', []);
                    if (array_key_exists('collect_lead', $body)) {
                        $behavior['collect_lead'] = (bool) $body['collect_lead'];
                    }
                    if (array_key_exists('lead_form_fields', $body)) {
                        $behavior['lead_form_fields'] = array_map('sanitize_text_field', (array) $body['lead_form_fields']);
                    }
                    $this->helpmate->get_settings()->set_setting('behavior', $behavior);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Settings updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get unread/handoff counts for badge (inbox sidebar: unread = total, by_inbox = per-tab)
        register_rest_route('helpmate/v1', '/social/counts', array(
            'methods' => 'GET',
            'callback' => function () {
                $social_chat = $this->helpmate->get_social_chat();
                return new WP_REST_Response([
                    'error' => false,
                    'unread' => $social_chat->get_unread_count(),
                    'handoff_pending' => $social_chat->get_handoff_pending_count(),
                    'by_inbox' => $social_chat->get_inbox_unread_counts(),
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get social leads settings
        register_rest_route('helpmate/v1', '/social/leads-settings', array(
            'methods' => 'GET',
            'callback' => function () {
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $lead_keywords = $settings['lead_keywords'] ?? [
                    'messenger' => [],
                    'instagram_dm' => [],
                    'whatsapp' => []
                ];

                // Return only the three main platforms (comments use same keywords as their platforms)
                return new WP_REST_Response([
                    'error' => false,
                    'lead_keywords' => [
                        'messenger' => $lead_keywords['messenger'] ?? [],
                        'instagram_dm' => $lead_keywords['instagram_dm'] ?? [],
                        'whatsapp' => $lead_keywords['whatsapp'] ?? []
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get lead campaigns
        register_rest_route('helpmate/v1', '/social/lead-campaigns', array(
            'methods' => 'GET',
            'callback' => function () {
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $campaigns = $settings['lead_campaigns'] ?? [];

                // Add default values for backward compatibility
                foreach ($campaigns as $campaign_id => $campaign) {
                    if (!isset($campaign['campaign_type'])) {
                        $campaigns[$campaign_id]['campaign_type'] = 'lead';
                    }
                    if (!isset($campaign['comment_reply'])) {
                        $campaigns[$campaign_id]['comment_reply'] = '';
                    }
                    if (!isset($campaign['custom_message'])) {
                        $campaigns[$campaign_id]['custom_message'] = '';
                    }
                }

                return new WP_REST_Response([
                    'error' => false,
                    'campaigns' => array_values($campaigns)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Create lead campaign
        register_rest_route('helpmate/v1', '/social/lead-campaigns', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $campaigns = $settings['lead_campaigns'] ?? [];

                // Validate required fields
                if (empty($body['title']) || empty($body['keywords'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Title and keywords are required'
                    ], 400);
                }

                // Validate platform
                if (empty($body['platform']) || !in_array($body['platform'], ['facebook', 'instagram'], true)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Platform is required and must be "facebook" or "instagram"'
                    ], 400);
                }

                // Get campaign type (default to 'lead' for backward compatibility)
                $campaign_type = !empty($body['campaign_type']) && in_array($body['campaign_type'], ['lead', 'custom_message'], true)
                    ? $body['campaign_type']
                    : 'lead';

                // Require post_id for both campaign types (specific post only)
                if (empty($body['post_id']) || trim($body['post_id']) === '') {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Please select a post'
                    ], 400);
                }

                $post_scope = 'specific_post';

                // Validate based on campaign type
                if ($campaign_type === 'lead') {
                    // Validate at least one field to collect for lead campaigns
                    if (empty($body['collect_email']) && empty($body['collect_phone']) && empty($body['collect_address'])) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'At least one field (email, phone, or address) must be selected'
                        ], 400);
                    }
                } elseif ($campaign_type === 'custom_message') {
                    // Validate custom message is provided for custom message campaigns
                    if (empty($body['custom_message']) || trim($body['custom_message']) === '') {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Custom message is required for custom message campaigns'
                        ], 400);
                    }
                }

                // Get keywords
                $keywords = sanitize_text_field($body['keywords']);

                // Generate unique ID
                $campaign_id = 'campaign_' . uniqid();

                $campaign = [
                    'id' => $campaign_id,
                    'title' => sanitize_text_field($body['title']),
                    'description' => sanitize_textarea_field($body['description'] ?? ''),
                    'platform' => sanitize_text_field($body['platform']),
                    'keywords' => $keywords,
                    'campaign_type' => $campaign_type,
                    'post_scope' => $post_scope,
                    'post_id' => !empty($body['post_id']) ? sanitize_text_field($body['post_id']) : '',
                    'collect_email' => !empty($body['collect_email']),
                    'collect_phone' => !empty($body['collect_phone']),
                    'collect_address' => !empty($body['collect_address']),
                    'url' => esc_url_raw($body['url'] ?? ''),
                    'comment_reply' => sanitize_textarea_field($body['comment_reply'] ?? ''),
                    'custom_message' => sanitize_textarea_field($body['custom_message'] ?? ''),
                    'created_at' => time()
                ];

                $campaigns[$campaign_id] = $campaign;
                $settings['lead_campaigns'] = $campaigns;
                $this->helpmate->get_settings()->set_setting('social_chat', $settings);

                return new WP_REST_Response([
                    'error' => false,
                    'campaign' => $campaign,
                    'message' => 'Campaign created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Update lead campaign
        register_rest_route('helpmate/v1', '/social/lead-campaigns/(?P<id>[^/]+)', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $campaign_id = $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $campaigns = $settings['lead_campaigns'] ?? [];

                if (!isset($campaigns[$campaign_id])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Campaign not found'
                    ], 404);
                }

                // Validate required fields
                if (empty($body['title']) || empty($body['keywords'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Title and keywords are required'
                    ], 400);
                }

                // Validate platform (required on create, optional on update)
                if (!empty($body['platform']) && !in_array($body['platform'], ['facebook', 'instagram'], true)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Platform must be "facebook" or "instagram"'
                    ], 400);
                }

                // Get campaign type (default to existing type or 'lead' for backward compatibility)
                $existing_campaign = $campaigns[$campaign_id] ?? [];
                $campaign_type = !empty($body['campaign_type']) && in_array($body['campaign_type'], ['lead', 'custom_message'], true)
                    ? $body['campaign_type']
                    : ($existing_campaign['campaign_type'] ?? 'lead');

                // Require post_id for both campaign types (specific post only)
                $post_id = !empty($body['post_id']) ? trim($body['post_id']) : ($existing_campaign['post_id'] ?? '');
                if ($post_id === '') {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Please select a post'
                    ], 400);
                }

                $post_scope = 'specific_post';

                // Validate based on campaign type
                if ($campaign_type === 'lead') {
                    // Validate at least one field to collect for lead campaigns
                    if (empty($body['collect_email']) && empty($body['collect_phone']) && empty($body['collect_address'])) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'At least one field (email, phone, or address) must be selected'
                        ], 400);
                    }
                } elseif ($campaign_type === 'custom_message') {
                    // Validate custom message is provided for custom message campaigns
                    if (empty($body['custom_message']) || trim($body['custom_message']) === '') {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => 'Custom message is required for custom message campaigns'
                        ], 400);
                    }
                }

                // Get keywords
                $keywords = !empty($body['keywords']) ? sanitize_text_field($body['keywords']) : ($existing_campaign['keywords'] ?? '');

                $campaigns[$campaign_id] = [
                    'id' => $campaign_id,
                    'title' => sanitize_text_field($body['title']),
                    'description' => sanitize_textarea_field($body['description'] ?? ($existing_campaign['description'] ?? '')),
                    'platform' => !empty($body['platform']) ? sanitize_text_field($body['platform']) : ($existing_campaign['platform'] ?? 'facebook'),
                    'keywords' => $keywords,
                    'campaign_type' => $campaign_type,
                    'post_scope' => $post_scope,
                    'post_id' => sanitize_text_field($post_id),
                    'collect_email' => !empty($body['collect_email']),
                    'collect_phone' => !empty($body['collect_phone']),
                    'collect_address' => !empty($body['collect_address']),
                    'url' => esc_url_raw($body['url'] ?? ($existing_campaign['url'] ?? '')),
                    'comment_reply' => sanitize_textarea_field($body['comment_reply'] ?? ($existing_campaign['comment_reply'] ?? '')),
                    'custom_message' => sanitize_textarea_field($body['custom_message'] ?? ($existing_campaign['custom_message'] ?? '')),
                    'created_at' => $campaigns[$campaign_id]['created_at'] ?? time()
                ];

                $settings['lead_campaigns'] = $campaigns;
                $this->helpmate->get_settings()->set_setting('social_chat', $settings);

                return new WP_REST_Response([
                    'error' => false,
                    'campaign' => $campaigns[$campaign_id],
                    'message' => 'Campaign updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Delete lead campaign
        register_rest_route('helpmate/v1', '/social/lead-campaigns/(?P<id>[^/]+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $campaign_id = $request->get_param('id');
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $campaigns = $settings['lead_campaigns'] ?? [];

                if (!isset($campaigns[$campaign_id])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Campaign not found'
                    ], 404);
                }

                unset($campaigns[$campaign_id]);
                $settings['lead_campaigns'] = $campaigns;
                $this->helpmate->get_settings()->set_setting('social_chat', $settings);

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Campaign deleted successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get posts from a social account
        register_rest_route('helpmate/v1', '/social/posts', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $platform = $request->get_param('platform'); // 'facebook' or 'instagram'
                $account_id = (int) $request->get_param('account_id');
                $limit = (int) ($request->get_param('limit') ?? 3);
                $cursor = $request->get_param('cursor'); // Pagination cursor

                if (empty($platform) || !in_array($platform, ['facebook', 'instagram'], true)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid platform. Must be "facebook" or "instagram"'
                    ], 400);
                }

                if (empty($account_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'account_id is required'
                    ], 400);
                }

                $social_chat = $this->helpmate->get_social_chat();
                $account = $social_chat->get_account($account_id);

                if (!$account) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Account not found'
                    ], 404);
                }

                // Verify platform matches account platform
                $account_platform = $account['platform'] ?? '';
                if (($platform === 'facebook' && $account_platform !== 'messenger') ||
                    ($platform === 'instagram' && $account_platform !== 'instagram')) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Platform does not match account platform'
                    ], 400);
                }

                $access_token = $account['access_token'] ?? '';
                if (empty($access_token)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Access token not available for this account'
                    ], 400);
                }

                // Determine the page/account ID to use
                $page_id = $account['page_id'] ?? '';
                if ($platform === 'instagram') {
                    $page_id = $account['instagram_account_id'] ?? $page_id;
                }

                if (empty($page_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Page ID not available for this account'
                    ], 400);
                }

                // Call social-server via license-server proxy
                $api_server = $this->helpmate->get_api()->get_api_server();
                $proxy_url = $api_server . '/wp-json/rp/v1/social/posts';
                $params = array(
                    'page_id' => $page_id,
                    'platform' => $platform,
                    'limit' => $limit,
                );
                if ($cursor) {
                    $params['after'] = $cursor;
                }

                $response = wp_remote_get(add_query_arg($params, $proxy_url), array(
                    'timeout' => 15,
                    'headers' => array(
                        'Content-Type' => 'application/json',
                        'X-Access-Token' => $access_token, // Pass access token in header
                    ),
                ));

                if (is_wp_error($response)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to fetch posts: ' . $response->get_error_message()
                    ], 500);
                }

                $response_code = wp_remote_retrieve_response_code($response);
                $response_body = wp_remote_retrieve_body($response);
                $data = json_decode($response_body, true);

                if (is_wp_error($response)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to fetch posts: ' . $response->get_error_message()
                    ], 500);
                }

                if ($response_code !== 200 || (isset($data['error']) && $data['error'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $data['message'] ?? 'Failed to fetch posts'
                    ], $response_code !== 200 ? $response_code : 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'posts' => $data['posts'] ?? [],
                    'next_cursor' => $data['next_cursor'] ?? null
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Update social leads settings (deprecated - kept for backward compatibility)
        register_rest_route('helpmate/v1', '/social/leads-settings', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');

                if (isset($body['lead_keywords'])) {
                    $lead_keywords = $body['lead_keywords'];
                    $sanitized_keywords = [];

                    // Only three platforms: messenger, instagram_dm, whatsapp
                    // Comments use the same keywords as their parent platforms
                    $platforms = ['messenger', 'instagram_dm', 'whatsapp'];
                    foreach ($platforms as $platform) {
                        if (isset($lead_keywords[$platform]) && is_array($lead_keywords[$platform])) {
                            $sanitized_keywords[$platform] = array_map('sanitize_text_field', $lead_keywords[$platform]);
                        } else {
                            $sanitized_keywords[$platform] = [];
                        }
                    }

                    $settings['lead_keywords'] = $sanitized_keywords;
                }

                $this->helpmate->get_settings()->set_setting('social_chat', $settings);

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Lead keywords updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get conversation starters
        register_rest_route('helpmate/v1', '/social/conversation-starters', array(
            'methods' => 'GET',
            'callback' => function () {
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $conversation_starters = $settings['conversation_starters'] ?? [
                    'messenger' => [],
                    'instagram_dm' => [],
                    'whatsapp' => []
                ];

                // Get smart schedules settings for default appointment starter
                $smart_scheduling = $this->helpmate->get_settings()->get_setting('smart_schedules') ?? [];
                $smart_scheduling_enabled = !empty($smart_scheduling['enabled']);
                $smart_scheduling_button_text = $smart_scheduling['buttonText'] ?? 'Get Appointment';

                // Find page with shortcode
                $scheduling_page_url = null;
                if ($smart_scheduling_enabled) {
                    global $wpdb;
                    $shortcode_pattern = '%[helpmate_scheduling]%';
                    $cache_key = 'helpmate_scheduling_page_' . md5($shortcode_pattern);
                    $results = wp_cache_get($cache_key, 'helpmate');

                    if (false === $results) {
                        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct query necessary for custom shortcode search
                        $results = $wpdb->get_results($wpdb->prepare(
                            "SELECT ID, post_type FROM {$wpdb->posts}
                            WHERE post_status = 'publish'
                            AND (post_type = 'post' OR post_type = 'page')
                            AND post_content LIKE %s
                            ORDER BY post_date DESC
                            LIMIT 1",
                            $shortcode_pattern
                        ));
                        // Cache for 1 hour
                        wp_cache_set($cache_key, $results, 'helpmate', HOUR_IN_SECONDS);
                    }

                    if (!empty($results)) {
                        $post_id = $results[0]->ID;
                        $scheduling_page_url = get_permalink($post_id);
                    }
                }

                // Add default appointment starter if smart schedules is enabled
                $platforms = ['messenger', 'instagram_dm', 'whatsapp'];
                foreach ($platforms as $platform) {
                    $starters = $conversation_starters[$platform] ?? [];

                    // Check if appointment starter already exists
                    $has_appointment = false;
                    foreach ($starters as $starter) {
                        if (isset($starter['is_default']) && $starter['is_default'] === true) {
                            // Update text if smart schedules button text changed
                            if ($smart_scheduling_enabled && isset($starter['id']) && $starter['id'] === 'appointment') {
                                $starter['text'] = $smart_scheduling_button_text;
                            }
                            $has_appointment = true;
                            break;
                        }
                    }

                    // Add appointment starter if smart schedules is enabled and it doesn't exist
                    if ($smart_scheduling_enabled && !$has_appointment) {
                        array_unshift($starters, [
                            'id' => 'appointment',
                            'text' => $smart_scheduling_button_text,
                            'enabled' => true,
                            'is_default' => true
                        ]);
                    } elseif (!$smart_scheduling_enabled && $has_appointment) {
                        // Remove appointment starter if smart schedules is disabled
                        $starters = array_filter($starters, function($starter) {
                            return !(isset($starter['is_default']) && $starter['is_default'] === true);
                        });
                        $starters = array_values($starters); // Re-index array
                    }

                    $conversation_starters[$platform] = $starters;
                }

                return new WP_REST_Response([
                    'error' => false,
                    'conversation_starters' => [
                        'messenger' => $conversation_starters['messenger'] ?? [],
                        'instagram_dm' => $conversation_starters['instagram_dm'] ?? [],
                        'whatsapp' => $conversation_starters['whatsapp'] ?? []
                    ],
                    'smart_scheduling' => [
                        'enabled' => $smart_scheduling_enabled,
                        'page_url' => $scheduling_page_url,
                        'button_text' => $smart_scheduling_button_text
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Update conversation starters
        register_rest_route('helpmate/v1', '/social/conversation-starters', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $settings = $this->helpmate->get_settings()->get_setting('social_chat');
                $social_chat = $this->helpmate->get_social_chat();

                if (isset($body['conversation_starters'])) {
                    $conversation_starters = $body['conversation_starters'];
                    $sanitized_starters = [];

                    $platforms = ['messenger', 'instagram_dm', 'whatsapp'];
                    foreach ($platforms as $platform) {
                        if (isset($conversation_starters[$platform]) && is_array($conversation_starters[$platform])) {
                            $sanitized_starters[$platform] = [];
                            foreach ($conversation_starters[$platform] as $starter) {
                                // Preserve default appointment starter
                                if (isset($starter['is_default']) && $starter['is_default'] === true && isset($starter['id']) && $starter['id'] === 'appointment') {
                                    $sanitized_starters[$platform][] = [
                                        'id' => 'appointment',
                                        'text' => sanitize_text_field($starter['text'] ?? 'Get Appointment'),
                                        'enabled' => isset($starter['enabled']) ? (bool) $starter['enabled'] : true,
                                        'is_default' => true
                                    ];
                                } else {
                                    // Regular starter
                                    $id = isset($starter['id']) && $starter['id'] !== 'appointment' ? sanitize_text_field($starter['id']) : uniqid('starter_', true);
                                    $sanitized_starters[$platform][] = [
                                        'id' => $id,
                                        'text' => sanitize_text_field($starter['text'] ?? ''),
                                        'enabled' => isset($starter['enabled']) ? (bool) $starter['enabled'] : true,
                                        'is_default' => false
                                    ];
                                }
                            }
                        } else {
                            $sanitized_starters[$platform] = [];
                        }
                    }

                    $settings['conversation_starters'] = $sanitized_starters;
                    if (!isset($settings['platforms']) || !is_array($settings['platforms'])) {
                        $settings['platforms'] = [];
                    }
                    // Ensure conversation_starters_enabled is true for platforms that have starters (user had toggle on to add them)
                    $platform_keys = ['messenger', 'instagram_dm', 'whatsapp'];
                    foreach ($platform_keys as $pk) {
                        $has_enabled = !empty(array_filter($sanitized_starters[$pk] ?? [], function ($s) {
                            return !empty($s['enabled']);
                        }));
                        if ($has_enabled) {
                            if (!isset($settings['platforms'][$pk])) {
                                $settings['platforms'][$pk] = [];
                            }
                            $settings['platforms'][$pk]['conversation_starters_enabled'] = true;
                        }
                    }
                    $this->helpmate->get_settings()->set_setting('social_chat', $settings);

                    // Sync to Facebook Graph API for Messenger and Instagram (only when quick messages enabled for that platform)
                    $accounts_result = $social_chat->get_accounts(1, 100); // Get all accounts
                    $accounts = $accounts_result['accounts'] ?? [];

                    // Get access tokens from database directly (pro plugin's get_accounts doesn't include access_token_encrypted)
                    global $wpdb;
                    $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

                    foreach ($accounts as $account) {
                        $platform = $account['platform'] ?? '';
                        $platform_key = ($platform === 'messenger') ? 'messenger' : (($platform === 'instagram') ? 'instagram_dm' : null);

                        if ($platform_key && in_array($platform, ['messenger', 'instagram'], true)) {
                            $platform_settings = $settings['platforms'][$platform_key] ?? [];
                            $cs_enabled = $platform_settings['conversation_starters_enabled']
                                ?? $settings['conversation_starters_enabled']
                                ?? false;
                            $starters = $cs_enabled ? ($sanitized_starters[$platform_key] ?? []) : [];
                            // Filter only enabled starters and re-index array
                            $enabled_starters = array_values(array_filter($starters, function($s) {
                                return isset($s['enabled']) && $s['enabled'] === true;
                            }));
                            $enabled_starters = array_slice($enabled_starters, 0, 4);

                            // Use page_id for both: Page token can only modify messenger_profile on the Page.
                            // For Instagram linked to a Page, the platform=instagram in body targets the linked IG.
                            $profile_id = $account['page_id'] ?? '';
                            $account_id = $account['id'] ?? 0;

                            if (empty($profile_id)) {
                                continue;
                            }

                            // Get access_token_encrypted directly from database
                            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Sensitive data that changes frequently, caching not appropriate
                            $access_token_encrypted = $wpdb->get_var($wpdb->prepare(
                                "SELECT access_token_encrypted FROM {$accounts_table} WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                                $account_id
                            ));

                            if (empty($access_token_encrypted)) {
                                continue;
                            }

                            $access_token = $social_chat->decrypt_value($access_token_encrypted);

                            if (empty($access_token)) {
                                continue;
                            }

                            if (!empty($enabled_starters)) {
                                $ice_breakers = [];
                                foreach ($enabled_starters as $starter) {
                                    $question = substr($starter['text'], 0, 20); // Max 20 characters
                                    if (empty($question)) {
                                        continue; // Skip empty starters
                                    }
                                    $payload = isset($starter['id']) ? strtoupper(str_replace(['-', '_'], '', $starter['id'])) : 'STARTER_' . uniqid();
                                    // Ensure payload is not too long (Facebook has limits)
                                    $payload = substr($payload, 0, 1000);
                                    $ice_breakers[] = [
                                        'question' => $question,
                                        'payload' => $payload
                                    ];
                                }

                                if (!empty($ice_breakers)) {
                                    $social_chat->update_messenger_profile_ice_breakers($profile_id, $access_token, $ice_breakers, $platform);
                                }
                            } else {
                                // Remove ice breakers if none enabled
                                $social_chat->update_messenger_profile_ice_breakers($profile_id, $access_token, [], $platform);
                            }
                        }
                    }

                    return new WP_REST_Response([
                        'error' => false,
                        'message' => 'Conversation starters updated successfully'
                    ], 200);
                }

                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Invalid request data'
                ], 400);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        /* --------------------------------------- */
        /*                  CRM                    */
        /* --------------------------------------- */

        // Get contacts list
        register_rest_route('helpmate/v1', '/crm/contacts', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $filters = [
                    'status' => $request->get_param('status'),
                    'search' => $request->get_param('search'),
                    'date_from' => $request->get_param('date_from'),
                    'date_to' => $request->get_param('date_to'),
                    'city' => $request->get_param('city'),
                    'state' => $request->get_param('state'),
                    'country' => $request->get_param('country'),
                ];
                $filters = array_filter($filters, fn($v) => $v !== null && $v !== '');

                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 20;

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_crm()->get_contacts($filters, $page, $per_page)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 20, 'sanitize_callback' => 'absint'),
                'status' => array('sanitize_callback' => 'sanitize_text_field'),
                'search' => array('sanitize_callback' => 'sanitize_text_field'),
                'date_from' => array('sanitize_callback' => 'sanitize_text_field'),
                'date_to' => array('sanitize_callback' => 'sanitize_text_field'),
                'city' => array('sanitize_callback' => 'sanitize_text_field'),
                'state' => array('sanitize_callback' => 'sanitize_text_field'),
                'country' => array('sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Create contact
        register_rest_route('helpmate/v1', '/crm/contacts', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);

                // Validate required custom fields
                $validation_error = $this->validate_required_custom_fields($body, 'contact');
                if ($validation_error) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $validation_error
                    ], 400);
                }

                $result = $this->helpmate->get_crm()->create_contact($body);

                if (is_wp_error($result)) {
                    $status_code = $result->get_error_code() === 'contact_limit_exceeded' ? 403 : 400;
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result->get_error_message()
                    ], $status_code);
                }

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create contact'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'contact_id' => $result,
                    'message' => 'Contact created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get single contact
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $contact = $this->helpmate->get_crm()->get_contact($contact_id);

                if (!$contact) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Contact not found'
                    ], 404);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $contact
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Get contact by email
        register_rest_route('helpmate/v1', '/crm/contacts/by-email', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $email = $request->get_param('email');
                if (empty($email) || !is_email($email)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid email address'
                    ], 400);
                }

                $contact = $this->helpmate->get_crm()->get_contact_by_email($email);

                if (!$contact) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Contact not found'
                    ], 404);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $contact
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'email' => array(
                    'required' => true,
                    'validate_callback' => 'is_email',
                    'sanitize_callback' => 'sanitize_email'
                )
            )
        ));

        // Update contact
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);

                // Validate required custom fields
                $validation_error = $this->validate_required_custom_fields($body, 'contact');
                if ($validation_error) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $validation_error
                    ], 400);
                }

                $result = $this->helpmate->get_crm()->update_contact($contact_id, $body);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to update contact'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Contact updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Delete contact
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $result = $this->helpmate->get_crm()->delete_contact($contact_id);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to delete contact'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Contact deleted successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Get contact notes
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/notes', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 50;

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_crm()->get_contact_notes($contact_id, $page, $per_page)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0),
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 50, 'sanitize_callback' => 'absint')
            )
        ));

        // Create note
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/notes', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $content = $body['content'] ?? '';

                if (empty($content)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Note content is required'
                    ], 400);
                }

                $result = $this->helpmate->get_crm()->create_note($contact_id, $content, get_current_user_id());

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create note'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'note_id' => $result,
                    'message' => 'Note created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Update note
        register_rest_route('helpmate/v1', '/crm/notes/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $note_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $content = $body['content'] ?? '';

                if (empty($content)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Note content is required'
                    ], 400);
                }

                $result = $this->helpmate->get_crm()->update_note($note_id, $content);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to update note'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Note updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Delete note
        register_rest_route('helpmate/v1', '/crm/notes/(?P<id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $note_id = (int) $request->get_param('id');
                $result = $this->helpmate->get_crm()->delete_note($note_id);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to delete note'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Note deleted successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Get contact orders
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/orders', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_crm()->get_contact_orders($contact_id)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Create manual order
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/orders', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $result = $this->helpmate->get_crm()->create_manual_order($contact_id, $body);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create order'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'order_id' => $result,
                    'message' => 'Order created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Update manual order
        register_rest_route('helpmate/v1', '/crm/orders/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $order_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $result = $this->helpmate->get_crm()->update_manual_order($order_id, $body);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to update order'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Order updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Delete manual order
        register_rest_route('helpmate/v1', '/crm/orders/(?P<id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $order_id = (int) $request->get_param('id');
                $result = $this->helpmate->get_crm()->delete_manual_order($order_id);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to delete order'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Order deleted successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Get WooCommerce new order URL
        register_rest_route('helpmate/v1', '/crm/woocommerce/new-order-url', array(
            'methods' => 'GET',
            'callback' => function () {
                if (!class_exists('WooCommerce')) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'WooCommerce is not installed'
                    ], 404);
                }

                // Use WooCommerce's OrderUtil to get the new order URL
                if (class_exists('\Automattic\WooCommerce\Utilities\OrderUtil')) {
                    $url = \Automattic\WooCommerce\Utilities\OrderUtil::get_order_admin_new_url();
                } else {
                    // Fallback for older WooCommerce versions
                    $url = admin_url('post-new.php?post_type=shop_order');
                }

                return new WP_REST_Response([
                    'error' => false,
                    'url' => $url
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get contact statuses
        register_rest_route('helpmate/v1', '/crm/statuses', array(
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_crm()->get_contact_statuses()
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Add custom status
        register_rest_route('helpmate/v1', '/crm/statuses', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $status = $body['status'] ?? '';

                if (empty($status)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Status is required'
                    ], 400);
                }

                $result = $this->helpmate->get_crm()->add_contact_status($status);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to add status'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Status added successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Remove custom status
        register_rest_route('helpmate/v1', '/crm/statuses/(?P<status>[a-zA-Z0-9_-]+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $status = $request->get_param('status');
                $result = $this->helpmate->get_crm()->remove_contact_status($status);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to remove status'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Status removed successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'status' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Get email templates
        register_rest_route('helpmate/v1', '/crm/email-templates', array(
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_crm()->get_email_templates()
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get single email template
        register_rest_route('helpmate/v1', '/crm/email-templates/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $template_id = (int) $request->get_param('id');
                $template = $this->helpmate->get_crm()->get_email_template($template_id);

                if (!$template) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Template not found'
                    ], 404);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $template
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Create email template
        register_rest_route('helpmate/v1', '/crm/email-templates', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                if ($this->helpmate->get_product_slug() === 'helpmate-free' || !$this->helpmate->is_helpmate_pro_active()) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Pro license required to create email templates'
                    ], 403);
                }
                $body = json_decode($request->get_body(), true);
                $result = $this->helpmate->get_crm()->create_email_template($body);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create template'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'template_id' => $result,
                    'message' => 'Template created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Update email template
        register_rest_route('helpmate/v1', '/crm/email-templates/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $template_id = (int) $request->get_param('id');
                $template = $this->helpmate->get_crm()->get_email_template($template_id);
                $is_pro = $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active();
                if ($template && isset($template['is_default']) && (int) $template['is_default'] === 1 && !$is_pro) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Pro license required to edit default email templates'
                    ], 403);
                }
                $body = json_decode($request->get_body(), true);
                $result = $this->helpmate->get_crm()->update_email_template($template_id, $body);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to update template'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Template updated successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Delete email template
        register_rest_route('helpmate/v1', '/crm/email-templates/(?P<id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $template_id = (int) $request->get_param('id');
                $result = $this->helpmate->get_crm()->delete_email_template($template_id);

                if (is_wp_error($result)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result->get_error_message()
                    ], 400);
                }

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to delete template'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Template deleted successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Get default transactional email template
        register_rest_route('helpmate/v1', '/crm/email-templates/default', array(
            'methods' => 'GET',
            'callback' => function () {
                $template = $this->helpmate->get_crm()->get_default_transactional_email_template();
                return new WP_REST_Response([
                    'error' => false,
                    'data' => $template
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Restore default email template
        register_rest_route('helpmate/v1', '/crm/email-templates/(?P<id>\d+)/restore', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                if ($this->helpmate->get_product_slug() === 'helpmate-free' || !$this->helpmate->is_helpmate_pro_active()) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Pro license required to restore default email templates'
                    ], 403);
                }
                $template_id = (int) $request->get_param('id');
                $result = $this->helpmate->get_crm()->restore_default_email_template($template_id);

                if (is_wp_error($result)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result->get_error_message()
                    ], 400);
                }

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to restore template'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Template restored successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Upload image to media library
        register_rest_route('helpmate/v1', '/media/upload', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $nonce = $request->get_header('x-wp-nonce');
                if (!$nonce || !wp_verify_nonce(sanitize_key($nonce), 'wp_rest')) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid security token'
                    ], 403);
                }

                if (!function_exists('wp_handle_upload')) {
                    require_once(ABSPATH . 'wp-admin/includes/file.php');
                }
                if (!function_exists('media_handle_upload')) {
                    require_once(ABSPATH . 'wp-admin/includes/media.php');
                    require_once(ABSPATH . 'wp-admin/includes/image.php');
                }

                $files = $request->get_file_params();
                if (empty($files) || empty($files['file'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'No file uploaded'
                    ], 400);
                }

                $file = $files['file'];

                // Validate file type
                $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!in_array($file['type'], $allowed_types)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid file type. Only images are allowed.'
                    ], 400);
                }

                // Handle upload
                $upload_overrides = array('test_form' => false);
                $uploaded_file = wp_handle_upload($file, $upload_overrides);

                if (isset($uploaded_file['error'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $uploaded_file['error']
                    ], 400);
                }

                // Create attachment
                $attachment = array(
                    'post_mime_type' => $uploaded_file['type'],
                    'post_title' => sanitize_file_name(pathinfo($file['name'], PATHINFO_FILENAME)),
                    'post_content' => '',
                    'post_status' => 'inherit'
                );

                $attachment_id = wp_insert_attachment($attachment, $uploaded_file['file']);

                if (is_wp_error($attachment_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to create attachment'
                    ], 500);
                }

                // Generate attachment metadata
                $attachment_data = wp_generate_attachment_metadata($attachment_id, $uploaded_file['file']);
                wp_update_attachment_metadata($attachment_id, $attachment_data);

                return new WP_REST_Response([
                    'error' => false,
                    'url' => wp_get_attachment_url($attachment_id),
                    'id' => $attachment_id
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('upload_files')
        ));

        // Get contact emails (email history)
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/emails', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 50;

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_crm()->get_contact_emails($contact_id, $page, $per_page)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0),
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 50, 'sanitize_callback' => 'absint')
            )
        ));

        // Send email to contact
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/emails/send', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $template_id = isset($body['template_id']) && !empty($body['template_id']) ? (int) $body['template_id'] : null;
                $subject = $body['subject'] ?? '';
                $email_body = $body['body'] ?? '';
                $user_id = get_current_user_id();

                // Validate required fields
                if ($template_id === null && (empty($subject) || empty($email_body))) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Subject and body are required when no template is selected'
                    ], 400);
                }

                $result = $this->helpmate->get_crm()->send_email_to_contact(
                    $contact_id,
                    $template_id,
                    $subject,
                    $email_body,
                    $user_id
                );

                if (is_wp_error($result)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result->get_error_message()
                    ], 400);
                }

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to send email'
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Email sent successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Search WordPress users
        register_rest_route('helpmate/v1', '/crm/users/search', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $search = $request->get_param('search') ?? '';
                $limit = $request->get_param('limit') ? (int) $request->get_param('limit') : 50;

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_crm()->search_wp_users($search, $limit)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'search' => array('default' => '', 'sanitize_callback' => 'sanitize_text_field'),
                'limit' => array('default' => 50, 'sanitize_callback' => 'absint')
            )
        ));

        /* --------------------------------------- */
        /*              Team Management            */
        /* --------------------------------------- */

        // Get team members
        register_rest_route('helpmate/v1', '/team-members', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $filters = [
                    'role' => $request->get_param('role') ? sanitize_text_field($request->get_param('role')) : null,
                    'search' => $request->get_param('search') ? sanitize_text_field($request->get_param('search')) : null,
                ];
                $filters = array_filter($filters);

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_team()->get_team_members($filters)
                ], 200);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Allow read access for users with tasks permission (needed for task assignment)
                // Full team management (write operations) still requires admin role
                $user_id = get_current_user_id();
                return Helpmate_Permissions::can_access_feature($user_id, 'tasks') ||
                       Helpmate_Permissions::can_access_feature($user_id, 'crm_tasks') ||
                       Helpmate_Permissions::can_access_feature($user_id, 'team_management') ||
                       user_can($user_id, 'manage_options');
            },
        ));

        // Create new WP user and assign roles
        register_rest_route('helpmate/v1', '/team-members', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $username = sanitize_user($body['username'] ?? '');
                $email = sanitize_email($body['email'] ?? '');
                $password = $body['password'] ?? '';
                $first_name = sanitize_text_field($body['first_name'] ?? '');
                $last_name = sanitize_text_field($body['last_name'] ?? '');
                $roles = isset($body['roles']) && is_array($body['roles']) ? array_map('sanitize_text_field', $body['roles']) : [];

                // Validate
                if (empty($username) || empty($email) || empty($password) || empty($roles)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Username, email, password, and at least one role are required'
                    ], 400);
                }

                // Create user
                $user_id = wp_create_user($username, $password, $email);
                if (is_wp_error($user_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $user_id->get_error_message()
                    ], 400);
                }

                // Update user meta
                if (!empty($first_name)) {
                    update_user_meta($user_id, 'first_name', $first_name);
                }
                if (!empty($last_name)) {
                    update_user_meta($user_id, 'last_name', $last_name);
                }

                // Set WordPress user role to editor
                $user = new WP_User($user_id);
                $user->set_role('editor');

                // Assign roles
                $assigned_by = get_current_user_id();
                $result = $this->helpmate->get_team()->assign_roles($user_id, $roles, $assigned_by);
                if (is_wp_error($result)) {
                    wp_delete_user($user_id); // Clean up on failure
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result->get_error_message()
                    ], 400);
                }

                // Send welcome email
                $include_password = isset($body['include_password']) ? (bool) $body['include_password'] : false;
                $send_reset_link = isset($body['send_reset_link']) ? (bool) $body['send_reset_link'] : true;
                $this->helpmate->get_team()->send_team_member_welcome_email(
                    $user_id,
                    $roles,
                    $include_password ? $password : null,
                    $send_reset_link
                );

                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'user_id' => $user_id,
                        'roles' => $roles
                    ]
                ], 201);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Only admin role can access team management
                $user_id = get_current_user_id();
                $roles = $this->helpmate->get_team()->get_user_roles($user_id);
                return in_array('admin', $roles, true) || user_can($user_id, 'manage_options');
            },
        ));

        // Update user roles
        register_rest_route('helpmate/v1', '/team-members/(?P<user_id>\d+)', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $user_id = (int) $request->get_param('user_id');
                $body = json_decode($request->get_body(), true);
                $roles = isset($body['roles']) && is_array($body['roles']) ? array_map('sanitize_text_field', $body['roles']) : [];

                if (empty($roles)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'At least one role is required'
                    ], 400);
                }

                $assigned_by = get_current_user_id();

                // Check if user already had roles before assignment
                $existing_roles = $this->helpmate->get_team()->get_user_roles($user_id);
                $was_new_team_member = empty($existing_roles);

                $result = $this->helpmate->get_team()->assign_roles($user_id, $roles, $assigned_by);
                if (is_wp_error($result)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => $result->get_error_message()
                    ], 400);
                }

                // Send notification email if this is a new team member addition
                if ($was_new_team_member) {
                    $this->helpmate->get_team()->send_team_member_added_email($user_id, $roles);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'user_id' => $user_id,
                        'roles' => $roles
                    ]
                ], 200);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Only admin role can access team management
                $user_id = get_current_user_id();
                $roles = $this->helpmate->get_team()->get_user_roles($user_id);
                return in_array('admin', $roles, true) || user_can($user_id, 'manage_options');
            },
            'args' => array(
                'user_id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Add/remove specific roles
        register_rest_route('helpmate/v1', '/team-members/(?P<user_id>\d+)/roles', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $user_id = (int) $request->get_param('user_id');
                $body = json_decode($request->get_body(), true);
                $add_roles = isset($body['add']) && is_array($body['add']) ? array_map('sanitize_text_field', $body['add']) : [];
                $remove_roles = isset($body['remove']) && is_array($body['remove']) ? array_map('sanitize_text_field', $body['remove']) : [];

                $assigned_by = get_current_user_id();

                // Add roles
                foreach ($add_roles as $role) {
                    $result = $this->helpmate->get_team()->add_role($user_id, $role, $assigned_by);
                    if (is_wp_error($result)) {
                        return new WP_REST_Response([
                            'error' => true,
                            'message' => sprintf('Failed to add role %s: %s', $role, $result->get_error_message())
                        ], 400);
                    }
                }

                // Remove roles
                foreach ($remove_roles as $role) {
                    $this->helpmate->get_team()->remove_role($user_id, $role);
                }

                $current_roles = $this->helpmate->get_team()->get_user_roles($user_id);

                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'user_id' => $user_id,
                        'roles' => $current_roles
                    ]
                ], 200);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Only admin role can access team management
                $user_id = get_current_user_id();
                $roles = $this->helpmate->get_team()->get_user_roles($user_id);
                return in_array('admin', $roles, true) || user_can($user_id, 'manage_options');
            },
            'args' => array(
                'user_id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Remove user from team (all roles)
        register_rest_route('helpmate/v1', '/team-members/(?P<user_id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $user_id = (int) $request->get_param('user_id');
                $result = $this->helpmate->get_team()->remove_all_roles($user_id);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to remove team member'
                    ], 400);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Team member removed successfully'
                ], 200);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Only admin role can access team management
                $user_id = get_current_user_id();
                $roles = $this->helpmate->get_team()->get_user_roles($user_id);
                return in_array('admin', $roles, true) || user_can($user_id, 'manage_options');
            },
            'args' => array(
                'user_id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0)
            )
        ));

        // Remove specific role from user
        register_rest_route('helpmate/v1', '/team-members/(?P<user_id>\d+)/roles/(?P<role>[a-zA-Z_]+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $user_id = (int) $request->get_param('user_id');
                $role = sanitize_text_field($request->get_param('role'));
                $result = $this->helpmate->get_team()->remove_role($user_id, $role);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Failed to remove role'
                    ], 400);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Role removed successfully'
                ], 200);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Only admin role can access team management
                $user_id = get_current_user_id();
                $roles = $this->helpmate->get_team()->get_user_roles($user_id);
                return in_array('admin', $roles, true) || user_can($user_id, 'manage_options');
            },
            'args' => array(
                'user_id' => array('required' => true, 'validate_callback' => fn($param) => is_numeric($param) && $param > 0),
                'role' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field')
            )
        ));

        // Search existing WP users
        register_rest_route('helpmate/v1', '/team-members/search-users', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $search = $request->get_param('search') ?? '';
                $limit = $request->get_param('limit') ? (int) $request->get_param('limit') : 50;

                if (empty($search)) {
                    $users = get_users([
                        'orderby' => 'registered',
                        'order' => 'DESC',
                        'number' => 10,
                    ]);
                } else {
                    $users = get_users([
                        'search' => '*' . esc_attr($search) . '*',
                        'search_columns' => ['user_login', 'user_email', 'display_name'],
                        'number' => $limit,
                    ]);
                }

                $results = [];
                foreach ($users as $user) {
                    $results[] = [
                        'id' => $user->ID,
                        'login' => $user->user_login,
                        'email' => $user->user_email,
                        'display_name' => $user->display_name,
                        'first_name' => $user->first_name,
                        'last_name' => $user->last_name,
                    ];
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $results
                ], 200);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Only admin role can access team management
                $user_id = get_current_user_id();
                $roles = $this->helpmate->get_team()->get_user_roles($user_id);
                return in_array('admin', $roles, true) || user_can($user_id, 'manage_options');
            },
            'args' => array(
                'search' => array('default' => '', 'sanitize_callback' => 'sanitize_text_field'),
                'limit' => array('default' => 50, 'sanitize_callback' => 'absint')
            )
        ));

        // Get current user's permissions
        register_rest_route('helpmate/v1', '/team-members/permissions', array(
            'methods' => 'GET',
            'callback' => function () {
                $user_id = get_current_user_id();
                // Use Helpmate_Permissions to get roles (includes WordPress admin check)
                $roles = Helpmate_Permissions::get_user_roles($user_id);
                $permissions = $this->helpmate->get_team()->get_user_permissions($user_id);

                // Ensure arrays are always returned with sequential indices (safety check)
                $roles = is_array($roles) ? array_values($roles) : [];
                $permissions = is_array($permissions) ? array_values($permissions) : [];

                return new WP_REST_Response([
                    'error' => false,
                    'data' => [
                        'user_id' => $user_id,
                        'roles' => $roles,
                        'permissions' => $permissions
                    ]
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
        ));

        // Get available roles list
        register_rest_route('helpmate/v1', '/team-members/roles', array(
            'methods' => 'GET',
            'callback' => function () {
                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_team()->get_available_roles()
                ], 200);
            },
            'permission_callback' => function () {
                if (!is_user_logged_in() || !current_user_can('edit_posts')) {
                    return false;
                }
                // Only admin role can access team management
                $user_id = get_current_user_id();
                $roles = $this->helpmate->get_team()->get_user_roles($user_id);
                return in_array('admin', $roles, true) || user_can($user_id, 'manage_options');
            },
        ));

        /* --------------------------------------- */
        /*              CRM ANALYTICS              */
        /* --------------------------------------- */

        // Get CRM analytics
        register_rest_route('helpmate/v1', '/crm/analytics', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $date_filter = $request->get_param('date_filter') ?? 'today';
                $user_id = $request->get_param('user_id') ? intval($request->get_param('user_id')) : null;

                // Only allow user_id param for admins
                $current_user_id = get_current_user_id();
                if ($user_id && $user_id !== $current_user_id) {
                    $is_admin = user_can($current_user_id, 'manage_options') ||
                                in_array('admin', Helpmate_Permissions::get_user_roles($current_user_id), true);
                    if (!$is_admin) {
                        $user_id = null; // Reset to null for non-admins
                    }
                }

                $analytics = $this->helpmate->get_crm_analytics()->get_analytics($date_filter, $user_id);

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $analytics
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'date_filter' => array(
                    'default' => 'today',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => function ($param) {
                        return in_array($param, ['today', 'yesterday', 'last_week', 'last_month', 'last_year'], true);
                    }
                ),
                'user_id' => array(
                    'default' => null,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function ($param) {
                        return $param === null || ($param > 0 && is_numeric($param));
                    }
                )
            )
        ));

        // Get CRM analytics preferences
        register_rest_route('helpmate/v1', '/crm/analytics/preferences', array(
            'methods' => 'GET',
            'callback' => function () {
                $user_id = get_current_user_id();
                $preferences = get_user_meta($user_id, 'helpmate_crm_analytics_reports', true);

                // Default: all reports visible
                if (empty($preferences) || !is_array($preferences)) {
                    $preferences = [
                        'visible_reports' => ['tasks', 'contacts', 'leads', 'tickets', 'emails', 'team_performance', 'activity_timeline']
                    ];
                }

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $preferences
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
        ));

        // Save CRM analytics preferences
        register_rest_route('helpmate/v1', '/crm/analytics/preferences', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);
                $user_id = get_current_user_id();

                if (empty($body) || !isset($body['visible_reports']) || !is_array($body['visible_reports'])) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'Invalid request body. Expected { visible_reports: string[] }'
                    ], 400);
                }

                $preferences = [
                    'visible_reports' => array_map('sanitize_text_field', $body['visible_reports'])
                ];

                update_user_meta($user_id, 'helpmate_crm_analytics_reports', $preferences);

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Preferences saved successfully',
                    'data' => $preferences
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
        ));

        /* --------------------------------------- */
        /*              EMAIL TRACKING              */
        /* --------------------------------------- */

        // Track email open (pixel endpoint)
        register_rest_route('helpmate/v1', '/crm/email-tracking/open', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                // No longer tracking opens - just return pixel for backward compatibility
                // Return 1x1 transparent pixel
                header('Content-Type: image/gif');
                header('Cache-Control: no-cache, no-store, must-revalidate');
                header('Pragma: no-cache');
                header('Expires: 0');
                // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Binary image data, not HTML
                echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
                exit;
            },
            'permission_callback' => '__return_true' // Public endpoint for tracking pixel
        ));

        // Track email click (redirect endpoint)
        register_rest_route('helpmate/v1', '/crm/email-tracking/click', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                // No longer tracking clicks - just redirect for backward compatibility
                $url = urldecode($request->get_param('url') ?? '');

                if (!$url) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => 'URL is required'
                    ], 400);
                }

                // Redirect to the URL
                wp_safe_redirect($url);
                exit;
            },
            'permission_callback' => '__return_true' // Public endpoint for click tracking
        ));

        // Unsubscribe endpoint (legacy - now handled by virtual page)
        register_rest_route('helpmate/v1', '/crm/email-tracking/unsubscribe', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $email_id = (int) $request->get_param('email_id');
                $contact_id = (int) $request->get_param('contact_id');

                // Redirect to the new unsubscribe page
                $unsubscribe_url = home_url('/helpmate-unsubscribe/?email_id=' . $email_id . '&contact_id=' . $contact_id);
                wp_safe_redirect($unsubscribe_url);
                exit;
            },
            'permission_callback' => '__return_true' // Public endpoint
        ));

        // Resubscribe endpoint
        register_rest_route('helpmate/v1', '/crm/resubscribe', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $contact_id = (int) $request->get_param('contact_id');

                if (!$contact_id) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Contact ID is required', 'helpmate-ai-chatbot')
                    ], 400);
                }

                $result = $this->helpmate->get_crm()->resubscribe_contact($contact_id);

                if (!$result) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Failed to resubscribe', 'helpmate-ai-chatbot')
                    ], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'message' => __('Successfully resubscribed', 'helpmate-ai-chatbot')
                ], 200);
            },
            'permission_callback' => '__return_true' // Public endpoint
        ));

        /* --------------------------------------- */
        /*                  TASKS                  */
        /* --------------------------------------- */

        // Get tasks list
        register_rest_route('helpmate/v1', '/tasks', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $page = $request->get_param('page');
                $per_page = $request->get_param('per_page');
                $status = $request->get_param('status');
                $priority = $request->get_param('priority');
                $assigned_to = $request->get_param('assigned_to');
                $search = $request->get_param('search');
                $due_date_from = $request->get_param('due_date_from');
                $due_date_to = $request->get_param('due_date_to');
                $overdue = $request->get_param('overdue');
                $has_contacts = $request->get_param('has_contacts');

                $filters = array_filter([
                    'status' => $status,
                    'priority' => $priority,
                    'assigned_to' => $assigned_to,
                    'search' => $search,
                    'due_date_from' => $due_date_from,
                    'due_date_to' => $due_date_to,
                    'overdue' => $overdue,
                    'has_contacts' => $has_contacts
                ], fn($value) => !is_null($value) && $value !== '');

                return new WP_REST_Response([
                    'error' => false,
                    'data' => $this->helpmate->get_tasks()->get_tasks($filters, $page, $per_page)
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'page' => array('default' => 1, 'sanitize_callback' => 'absint'),
                'per_page' => array('default' => 20, 'sanitize_callback' => 'absint'),
                'status' => array('sanitize_callback' => 'sanitize_text_field'),
                'priority' => array('sanitize_callback' => 'sanitize_text_field'),
                'assigned_to' => array('sanitize_callback' => 'sanitize_text_field'),
                'search' => array('sanitize_callback' => 'sanitize_text_field'),
                'due_date_from' => array('sanitize_callback' => 'sanitize_text_field'),
                'due_date_to' => array('sanitize_callback' => 'sanitize_text_field'),
                'overdue' => array('sanitize_callback' => 'rest_sanitize_boolean'),
                'has_contacts' => array('sanitize_callback' => 'rest_sanitize_boolean')
            )
        ));

        // Create task
        register_rest_route('helpmate/v1', '/tasks', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $body = json_decode($request->get_body(), true);

                $task_id = $this->helpmate->get_tasks()->create_task($body);

                if (!$task_id) {
                    return new WP_REST_Response(['error' => true, 'message' => 'Failed to create task'], 500);
                }

                return new WP_REST_Response([
                    'error' => false,
                    'task_id' => $task_id,
                    'message' => 'Task created successfully'
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts')
        ));

        // Get single task
        register_rest_route('helpmate/v1', '/tasks/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $task_id = $request->get_param('id');
                $task = $this->helpmate->get_tasks()->get_task($task_id);

                if (!$task) {
                    return new WP_REST_Response(['error' => true, 'message' => 'Task not found'], 404);
                }

                return new WP_REST_Response(['error' => false, 'data' => $task], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('validate_callback' => fn($param) => is_numeric($param))
            )
        ));

        // Update task
        register_rest_route('helpmate/v1', '/tasks/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $task_id = $request->get_param('id');
                $body = json_decode($request->get_body(), true);

                $result = $this->helpmate->get_tasks()->update_task($task_id, $body);

                if (!$result) {
                    return new WP_REST_Response(['error' => true, 'message' => 'Failed to update task'], 500);
                }

                return new WP_REST_Response(['error' => false, 'message' => 'Task updated successfully'], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('validate_callback' => fn($param) => is_numeric($param))
            )
        ));

        // Delete task
        register_rest_route('helpmate/v1', '/tasks/(?P<id>\d+)/delete', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $task_id = $request->get_param('id');
                $result = $this->helpmate->get_tasks()->delete_task($task_id);

                if (!$result) {
                    return new WP_REST_Response(['error' => true, 'message' => 'Failed to delete task'], 500);
                }

                return new WP_REST_Response(['error' => false, 'message' => 'Task deleted successfully'], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('validate_callback' => fn($param) => is_numeric($param))
            )
        ));

        // Get task contacts
        register_rest_route('helpmate/v1', '/tasks/(?P<id>\d+)/contacts', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $task_id = $request->get_param('id');
                $contacts = $this->helpmate->get_tasks()->get_task_contacts($task_id);

                return new WP_REST_Response(['error' => false, 'data' => $contacts], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('validate_callback' => fn($param) => is_numeric($param))
            )
        ));

        // Update task contacts
        register_rest_route('helpmate/v1', '/tasks/(?P<id>\d+)/contacts', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $task_id = $request->get_param('id');
                $body = json_decode($request->get_body(), true);
                $contact_ids = $body['contact_ids'] ?? [];

                $result = $this->helpmate->get_tasks()->update_task_contacts($task_id, $contact_ids);

                if (!$result) {
                    return new WP_REST_Response(['error' => true, 'message' => 'Failed to update task contacts'], 500);
                }

                return new WP_REST_Response(['error' => false, 'message' => 'Task contacts updated successfully'], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('validate_callback' => fn($param) => is_numeric($param))
            )
        ));

        // Get tasks for a contact
        register_rest_route('helpmate/v1', '/crm/contacts/(?P<id>\d+)/tasks', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $contact_id = $request->get_param('id');
                $status = $request->get_param('status');
                $priority = $request->get_param('priority');

                $filters = array_filter([
                    'status' => $status,
                    'priority' => $priority
                ], fn($value) => !is_null($value) && $value !== '');

                $tasks = $this->helpmate->get_tasks()->get_contact_tasks($contact_id, $filters);

                return new WP_REST_Response(['error' => false, 'data' => $tasks], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'id' => array('validate_callback' => fn($param) => is_numeric($param)),
                'status' => array('sanitize_callback' => 'sanitize_text_field'),
                'priority' => array('sanitize_callback' => 'sanitize_text_field')
            )
        ));

        /* --------------------------------------- */
        /*          CRM CUSTOM FIELDS (Read-only)  */
        /* --------------------------------------- */

        /* --------------------------------------- */
        /*          CRM CUSTOM FIELDS (Read-only)  */
        /* --------------------------------------- */

        // Get custom fields (read-only endpoint for free plugin - allows reading default task fields)
        // Registered with high priority to run after pro plugin routes
        // This ensures our route takes precedence when pro route would block access
        register_rest_route('helpmate/v1', '/crm/custom-fields', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $entity_type = $request->get_param('entity_type') ?: 'contact';
                $crm = $this->helpmate->get_crm();

                // Ensure default task fields exist before fetching
                if ($entity_type === 'task') {
                    $database = $this->helpmate->get_database();
                    if ($database) {
                        $database->initialize_task_custom_fields();
                    }
                }

                $fields = $crm->get_custom_fields($entity_type);
                return new WP_REST_Response([
                    'error' => false,
                    'data' => $fields
                ], 200);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('edit_posts'),
            'args' => array(
                'entity_type' => array('default' => 'contact', 'sanitize_callback' => 'sanitize_text_field')
            )
        ));
    }

    /**
     * Get posts, optionally filtered by post type.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return array
     */
    public function get_posts($request)
    {
        $post_type = $request->get_param('post_type');

        // If no post_type specified, get all public post types except products
        if (!$post_type) {
            $all_post_types = get_post_types([
                'public' => true,
                'show_in_rest' => true,
            ], 'names');

            // Filter out product-related post types
            $post_types = array_filter($all_post_types, function ($type) {
                return $type !== 'product' &&
                    !strpos($type, 'product') &&
                    $type !== 'woocommerce';
            });
        } else {
            $post_types = $post_type;
        }

        $args = [
            'post_type' => $post_types,
            'post_status' => 'publish',
            'posts_per_page' => -1,
        ];

        $query = new WP_Query($args);

        $posts = [];

        foreach ($query->posts as $post) {
            $metadata = [
                'featured_image' => get_the_post_thumbnail_url($post->ID, 'full'),
                'excerpt' => get_the_excerpt($post),
                'modified_date' => $post->post_modified,
                'permalink' => get_permalink($post->ID),
                'categories' => wp_get_post_terms($post->ID, 'category', ['fields' => 'names']),
                'tags' => wp_get_post_terms($post->ID, 'post_tag', ['fields' => 'names']),
            ];

            // Add WooCommerce product data if post type is product
            if ($post->post_type === 'product') {
                $product = wc_get_product($post->ID);
                if ($product) {
                    // Get all product meta
                    $product_meta = get_post_meta($post->ID);

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
                    $product_tags = wp_get_post_terms($post->ID, 'product_tag', ['fields' => 'names']);

                    // Get product categories with full data
                    $product_categories = wp_get_post_terms($post->ID, 'product_cat', ['fields' => 'all']);
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
            if ($post->post_type === 'product' && isset($metadata['product'])) {
                $title = $metadata['product']['name'];
                $content = $metadata['product']['description'] ?: $post->post_content;
            } else {
                $title = get_the_title($post);
                $content = $post->post_content;
            }

            $posts[] = [
                'id' => $post->ID,
                'title' => $title,
                'type' => $post->post_type,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'content' => $content,
                'author' => get_the_author_meta('display_name', $post->post_author),
                'metadata' => $metadata
            ];
        }

        return $posts;
    }

    /**
     * Get all public post types that are visitable.
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function get_public_post_types()
    {
        $post_types = get_post_types([
            'public' => true,
            'show_in_rest' => true,
        ], 'objects');

        $post_types = array_filter($post_types, function ($post_type) {
            return $post_type->name !== 'attachment' &&
                $post_type->name !== 'product' &&
                strpos($post_type->name, 'product') === false &&
                $post_type->name !== 'woocommerce';
        });

        $formatted_post_types = [];
        foreach ($post_types as $post_type) {
            $formatted_post_types[] = [
                'name' => $post_type->name,
                'label' => $post_type->label,
                'description' => $post_type->description,
                'hierarchical' => $post_type->hierarchical,
                'has_archive' => $post_type->has_archive,
                'rest_base' => $post_type->rest_base,
            ];
        }

        // Sort post types with page, post at the top
        usort($formatted_post_types, function ($a, $b) {
            $priority_order = ['page', 'post'];

            $a_priority = array_search($a['name'], $priority_order);
            $b_priority = array_search($b['name'], $priority_order);

            // If both are in priority list, sort by priority order
            if ($a_priority !== false && $b_priority !== false) {
                return $a_priority - $b_priority;
            }

            // If only A is in priority list, A comes first
            if ($a_priority !== false && $b_priority === false) {
                return -1;
            }

            // If only B is in priority list, B comes first
            if ($a_priority === false && $b_priority !== false) {
                return 1;
            }

            // If neither is in priority list, sort alphabetically by name
            return strcmp($a['name'], $b['name']);
        });

        try {
            return new WP_REST_Response([
                'error' => false,
                'post_types' => $formatted_post_types
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get discounted products.
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function get_discounted_products()
    {
        try {
            $args = array(
                'status' => 'publish',
                'limit' => -1,
                'return' => 'objects',
                'orderby' => 'date',
                'order' => 'DESC'
            );

            $products = wc_get_products($args);
            $discounted_products = array();

            foreach ($products as $product) {
                if ($product->is_on_sale()) {
                    $discounted_products[] = array(
                        'id' => $product->get_id(),
                        'name' => $product->get_name(),
                        'regular_price' => wc_price($product->get_regular_price()),
                        'sale_price' => wc_price($product->get_sale_price()),
                        'discount_percentage' => $product->get_regular_price() ? round((($product->get_regular_price() - $product->get_sale_price()) / $product->get_regular_price()) * 100) : 0,
                        'stock_status' => $product->get_stock_status(),
                        'stock_quantity' => $product->get_stock_quantity(),
                        'image_url' => get_the_post_thumbnail_url($product->get_id(), 'full'),
                        'categories' => wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names')),
                        'date_on_sale_from' => $product->get_date_on_sale_from(),
                        'date_on_sale_to' => $product->get_date_on_sale_to(),
                        'type' => $product->get_type(),
                        'sku' => $product->get_sku()
                    );
                }
            }

            return new WP_REST_Response([
                'error' => false,
                'products' => $discounted_products
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get bulk job status.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response
     */
    public function get_bulk_job_status($request)
    {
        $job_id = $request->get_param('job_id');

        try {
            $background_processor = $this->helpmate->get_background_processor();

            if (!$background_processor) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Background processing not available'
                ], 503);
            }

            $job = $background_processor->get_job_status($job_id);

            if (!$job) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Job not found'
                ], 404);
            }

            // Calculate progress percentage
            $progress = $job['total_documents'] > 0
                ? round(($job['processed_documents'] / $job['total_documents']) * 100, 2)
                : 0;

            $response = new WP_REST_Response([
                'error' => false,
                'job' => [
                    'job_id' => $job['job_id'],
                    'status' => $job['status'],
                    'total_documents' => $job['total_documents'],
                    'processed_documents' => $job['processed_documents'],
                    'successful_documents' => $job['successful_documents'],
                    'failed_documents' => $job['failed_documents'],
                    'progress' => $progress,
                    'created_at' => $job['created_at'],
                    'updated_at' => $job['updated_at'],
                    'completed_at' => $job['completed_at'],
                    'errors' => $job['errors']
                ],
                'timestamp' => current_time('mysql')
            ], 200);

            // Add cache-busting headers
            $response->header('Cache-Control', 'no-cache, no-store, must-revalidate');
            $response->header('Pragma', 'no-cache');
            $response->header('Expires', '0');

            return $response;

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancel bulk job.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response
     */
    public function cancel_bulk_job($request)
    {
        $job_id = $request->get_param('job_id');

        try {
            $background_processor = $this->helpmate->get_background_processor();

            if (!$background_processor) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Background processing not available'
                ], 503);
            }

            $success = $background_processor->cancel_job($job_id);

            if (!$success) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Failed to cancel job'
                ], 500);
            }

            return new WP_REST_Response([
                'error' => false,
                'message' => 'Job cancelled successfully'
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get user bulk jobs.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response
     */
    public function get_user_bulk_jobs($request)
    {
        $page = $request->get_param('page');
        $per_page = $request->get_param('per_page');
        $offset = ($page - 1) * $per_page;

        try {
            $job_tracker = $this->helpmate->get_job_tracker();
            $jobs = $job_tracker->get_user_jobs(get_current_user_id(), $per_page, $offset);

            // Calculate progress for each job
            foreach ($jobs as &$job) {
                $job['progress'] = $job['total_documents'] > 0
                    ? round(($job['processed_documents'] / $job['total_documents']) * 100, 2)
                    : 0;
            }

            $response = new WP_REST_Response([
                'error' => false,
                'jobs' => $jobs,
                'pagination' => [
                    'page' => $page,
                    'per_page' => $per_page,
                    'total' => count($jobs)
                ],
                'timestamp' => current_time('mysql') // Add timestamp for cache busting
            ], 200);

            // Add cache-busting headers
            $response->header('Cache-Control', 'no-cache, no-store, must-revalidate');
            $response->header('Pragma', 'no-cache');
            $response->header('Expires', '0');

            return $response;

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get background processing status.
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function get_background_processing_status()
    {
        try {
            $background_processor = $this->helpmate->get_background_processor();

            if (!$background_processor) {
                return new WP_REST_Response([
                    'error' => false,
                    'available' => false,
                    'message' => 'Background processing not available. Using WordPress cron fallback.'
                ], 200);
            }

            $action_scheduler_available = $background_processor->is_action_scheduler_available();

            return new WP_REST_Response([
                'error' => false,
                'available' => true,
                'action_scheduler_available' => $action_scheduler_available,
                'message' => $action_scheduler_available
                    ? 'Action Scheduler is available for optimal performance.'
                    : 'Using WordPress cron fallback. Install Action Scheduler plugin for better performance.'
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Debug job status and scheduling.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response
     */
    public function debug_job($request)
    {
        $job_id = $request->get_param('job_id');

        try {
            $background_processor = $this->helpmate->get_background_processor();

            if (!$background_processor) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Background processing not available'
                ], 503);
            }

            $debug_info = $background_processor->debug_job($job_id);

            return new WP_REST_Response([
                'error' => false,
                'debug_info' => $debug_info
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Manually process a job (for debugging).
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response
     */
    public function manual_process_job($request)
    {
        $job_id = $request->get_param('job_id');

        try {
            $background_processor = $this->helpmate->get_background_processor();

            if (!$background_processor) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Background processing not available'
                ], 503);
            }

            $success = $background_processor->manual_process_job($job_id);

            if (!$success) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Failed to start manual processing'
                ], 500);
            }

            return new WP_REST_Response([
                'error' => false,
                'message' => 'Manual processing started successfully'
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Force process all stuck jobs.
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function force_process_stuck_jobs()
    {
        try {
            $background_processor = $this->helpmate->get_background_processor();

            if (!$background_processor) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Background processing not available'
                ], 503);
            }

            $job_tracker = $this->helpmate->get_job_tracker();
            $stuck_jobs = $job_tracker->get_jobs_by_status('processing', 10);

            $processed_count = 0;
            foreach ($stuck_jobs as $job) {
                if ($job['processed_documents'] == 0) {
                    $background_processor->manual_process_job($job['job_id']);
                    $processed_count++;
                }
            }

            return new WP_REST_Response([
                'error' => false,
                'message' => "Processed {$processed_count} stuck jobs",
                'processed_count' => $processed_count
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cleanup completed jobs.
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function cleanup_completed_jobs()
    {
        try {
            $job_tracker = $this->helpmate->get_job_tracker();
            $cleaned_count = $job_tracker->cleanup_completed_jobs(7); // Clean jobs older than 7 days

            return new WP_REST_Response([
                'error' => false,
                'message' => "Cleaned up $cleaned_count completed jobs",
                'cleaned_jobs' => $cleaned_count
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete bulk job.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response
     */
    public function delete_bulk_job($request)
    {
        $job_id = $request->get_param('job_id');

        try {
            $job_tracker = $this->helpmate->get_job_tracker();
            $success = $job_tracker->delete_job($job_id);

            if (!$success) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Failed to delete job'
                ], 500);
            }

            return new WP_REST_Response([
                'error' => false,
                'message' => 'Job deleted successfully'
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Extract text from uploaded file via license server API.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response|WP_Error
     */
    public function extract_file_text($request)
    {
        // Check if file was uploaded
        $files = $request->get_file_params();

        if (empty($files['file'])) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('No file uploaded', 'helpmate-ai-chatbot')
            ], 400);
        }

        $file = $files['file'];

        // Validate file size (5MB max)
        $is_pro = $this->helpmate->is_helpmate_pro_active();
        $product_slug = $this->helpmate->get_product_slug();
        $max_size = $is_pro && $product_slug !== 'helpmate-free' ? 500 * 1024 : 300 * 1024;
        $max_size_label = $is_pro && $product_slug !== 'helpmate-free' ? '500KB' : '300KB';
        if ($file['size'] > $max_size) {
            return new WP_REST_Response([
                'error' => true,
                /* translators: %s: maximum file size (e.g., 300KB or 500KB) */
                'message' => sprintf(__('File size exceeds %s limit', 'helpmate-ai-chatbot'), $max_size_label)
            ], 400);
        }

        // Validate file type
        $file_extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed_extensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

        if (!in_array($file_extension, $allowed_extensions)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Invalid file type. Only PDF, DOC, DOCX, XLS, and XLSX files are supported.', 'helpmate-ai-chatbot')
            ], 400);
        }

        try {
            // Get the license server URL from API settings
            $api_server = $this->helpmate->get_api()->get_api_server();
            $endpoint = $api_server . '/wp-json/rp/v1/extract-file-text';

            // Prepare file for upload to license server
            $boundary = wp_generate_password(24, false);
            $file_contents = file_get_contents($file['tmp_name']);

            // Build multipart form data
            $body = "--{$boundary}\r\n";
            $body .= 'Content-Disposition: form-data; name="file"; filename="' . $file['name'] . '"' . "\r\n";
            $body .= 'Content-Type: ' . $file['type'] . "\r\n\r\n";
            $body .= $file_contents . "\r\n";
            $body .= "--{$boundary}--\r\n";

            // Make request to license server
            $response = wp_remote_post($endpoint, array(
                'body' => $body,
                'headers' => array(
                    'Content-Type' => 'multipart/form-data; boundary=' . $boundary,
                ),
                'timeout' => 300,
                'sslverify' => false // Set to true in production with valid SSL
            ));

            // Check for WordPress errors
            if (is_wp_error($response)) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $response->get_error_message()
                ], 500);
            }

            // Get response body
            $response_body = wp_remote_retrieve_body($response);
            $response_code = wp_remote_retrieve_response_code($response);
            $data = json_decode($response_body, true);

            // Check if license server returned an error
            if ($response_code !== 200 || (isset($data['code']) && $data['code'] !== 'rest_no_route')) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $data['message'] ?? __('Failed to extract text from file', 'helpmate-ai-chatbot')
                ], $response_code);
            }

            // Return successful response
            return new WP_REST_Response([
                'error' => false,
                'text' => $data['text'] ?? '',
                'file_name' => $file['name']
            ], 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Process incoming social event from license-server.
     *
     * @since 1.2.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response
     */
    public function process_social_event($request)
    {
        if (function_exists('set_time_limit')) {
            // phpcs:ignore Squiz.PHP.DiscouragedFunctions.Discouraged -- Webhook processing may exceed 30s (Meta API, campaign flow)
            set_time_limit(60);
        }

        $body = json_decode($request->get_body(), true);
        $license_key = $request->get_header('X-License-Key');
        $page_id = $body['page_id'] ?? '';
        $event_data = $body['event_data'] ?? [];
        // Platform is sent inside event_data by social-server
        $platform = $event_data['platform'] ?? $body['platform'] ?? '';

        // Validate license key
        if ($license_key !== $this->helpmate->get_api()->get_key()) {
            return new WP_REST_Response([
                'error' => true,
                'message' => 'Invalid license key'
            ], 403);
        }

        try {
            $social_chat = $this->helpmate->get_social_chat();

            // Check if social chat is enabled
            $settings = $social_chat->get_social_chat_settings();
            if (empty($settings['enabled'])) {
                return new WP_REST_Response([
                    'error' => false,
                    'skip_response' => true,
                    'message' => 'Social chat is disabled'
                ], 200);
            }

            // Check if platform is enabled
            $platform_key_map = ['messenger' => 'messenger', 'instagram' => 'instagram_dm', 'whatsapp' => 'whatsapp', 'fb_comment' => 'comments', 'ig_comment' => 'comments'];
            $platform_key = $platform_key_map[$platform] ?? $platform;
            $platforms = $settings['platforms'] ?? [];

            // For comments, check if the parent platform (messenger/instagram_dm) is enabled
            if ($platform === 'fb_comment') {
                // Facebook comments require messenger platform to be enabled
                if (empty($platforms['messenger']['enabled'])) {
                    return new WP_REST_Response([
                        'error' => false,
                        'skip_response' => true,
                        'message' => 'Messenger platform is disabled, comments are disabled'
                    ], 200);
                }
            } elseif ($platform === 'ig_comment') {
                // Instagram comments require instagram_dm platform to be enabled
                if (empty($platforms['instagram_dm']['enabled'])) {
                    return new WP_REST_Response([
                        'error' => false,
                        'skip_response' => true,
                        'message' => 'Instagram DM platform is disabled, comments are disabled'
                    ], 200);
                }
            }

            // For non-comment platforms, check if platform is enabled
            // Comments are always received and saved to inbox, but automated responses respect settings
            if (!in_array($platform, ['fb_comment', 'ig_comment'], true) && empty($platforms[$platform_key]['enabled'])) {
                return new WP_REST_Response([
                    'error' => false,
                    'skip_response' => true,
                    'message' => 'Platform is disabled'
                ], 200);
            }

            // Get account by page_id (with platform and instagram_account_id to resolve correct account when multiple share page_id)
            $instagram_account_id = $event_data['instagram_account_id'] ?? $body['instagram_account_id'] ?? null;
            $account = $social_chat->get_account_by_page_id(
                $page_id,
                $platform ?: null,
                $instagram_account_id
            );
            if (!$account) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Account not connected'
                ], 404);
            }

            // Decrypt access token if needed for account operations
            if (empty($account['access_token']) && !empty($account['access_token_encrypted'])) {
                $account['access_token'] = $social_chat->decrypt_value($account['access_token_encrypted']);
            }

            // Extract event data
            $sender_id = $event_data['sender_id'] ?? '';
            $message = $event_data['message'] ?? '';
            $message_id = $event_data['message_id'] ?? '';
            $sender_name = $event_data['sender_name'] ?? '';
            $post_id = $event_data['post_id'] ?? null;
            $parent_id = $event_data['parent_id'] ?? null;
            $post_message = $event_data['post_message'] ?? null;
            $post_image_url = $event_data['post_image_url'] ?? null;
            $post_type = $event_data['post_type'] ?? null;
            $postback_payload = $event_data['postback_payload'] ?? $event_data['payload'] ?? null;

            // Fetch post details from Meta API if this is a comment and we have post_id
            if (in_array($platform, ['fb_comment', 'ig_comment'], true) && $post_id && empty($post_message) && empty($post_image_url)) {
                $access_token = $account['access_token'] ?? '';
                if (!empty($access_token)) {
                    $graph_version = 'v18.0';
                    $graph_base_url = 'https://graph.facebook.com';

                    try {
                        // Build API endpoint based on platform
                        if ($platform === 'ig_comment') {
                            // Instagram media endpoint
                            $url = "{$graph_base_url}/{$graph_version}/{$post_id}";
                            $params = [
                                'fields' => 'id,caption,media_type,media_url,thumbnail_url,timestamp',
                                'access_token' => $access_token,
                            ];
                        } else {
                            // Facebook post endpoint
                            $url = "{$graph_base_url}/{$graph_version}/{$post_id}";
                            $params = [
                                'fields' => 'id,message,story,attachments{media{image{src}},subattachments{media{image{src}}}}',
                                'access_token' => $access_token,
                            ];
                        }

                        $response = wp_remote_get(
                            add_query_arg($params, $url),
                            [
                                'timeout' => 10,
                                'headers' => [
                                    'Content-Type' => 'application/json',
                                ],
                            ]
                        );

                        if (!is_wp_error($response)) {
                            $body = wp_remote_retrieve_body($response);
                            $post_details = json_decode($body, true);

                            if (!isset($post_details['error'])) {
                                // Extract post message
                                if ($platform === 'ig_comment') {
                                    $post_message = $post_details['caption'] ?? null;
                                    $post_image_url = $post_details['media_url'] ?? $post_details['thumbnail_url'] ?? null;
                                    $post_type = $post_details['media_type'] ?? 'photo';
                                } else {
                                    $post_message = $post_details['message'] ?? $post_details['story'] ?? null;

                                    // Extract image URL from attachments
                                    if (isset($post_details['attachments']['data'][0]['media']['image']['src'])) {
                                        $post_image_url = $post_details['attachments']['data'][0]['media']['image']['src'];
                                    } elseif (isset($post_details['attachments']['data'][0]['subattachments']['data'][0]['media']['image']['src'])) {
                                        $post_image_url = $post_details['attachments']['data'][0]['subattachments']['data'][0]['media']['image']['src'];
                                    }

                                    // Determine post type
                                    if ($post_image_url) {
                                        $post_type = $post_message ? 'photo_with_text' : 'photo';
                                    } elseif ($post_message) {
                                        $post_type = 'text';
                                    } else {
                                        $post_type = 'post';
                                    }
                                }
                            }
                        }
                    } catch (Exception $e) {
                    }
                }
            }

            // Get or create conversation
            $conversation_data = [
                'account_id' => $account['id'],
                'platform' => $platform,
                'external_id' => $message_id,
                'participant_id' => $sender_id,
                'participant_name' => $sender_name
            ];

            // Add post metadata for comments
            if (in_array($platform, ['fb_comment', 'ig_comment'], true)) {
                if ($post_id) {
                    $conversation_data['post_id'] = $post_id;
                }
                if ($parent_id) {
                    $conversation_data['parent_comment_id'] = $parent_id;
                }
                if ($post_message) {
                    $conversation_data['post_message'] = $post_message;
                }
                if ($post_image_url) {
                    $conversation_data['post_image_url'] = $post_image_url;
                }
                if ($post_type) {
                    $conversation_data['post_type'] = $post_type;
                }
            }

            $conversation = $social_chat->get_or_create_conversation($conversation_data);

            // Schedule background fetch of user profile if name is empty, or for comments when profile pic is missing
            // (Webhooks send sender_name but never profile pic, so we must fetch for comments to get avatar)
            $needs_fetch = empty($conversation['participant_name']) ||
                (in_array($platform, ['fb_comment', 'ig_comment'], true) && empty($conversation['participant_profile_pic'] ?? ''));
            if ($needs_fetch) {
                $api_platform = ($platform === 'fb_comment') ? 'messenger' : (($platform === 'ig_comment') ? 'instagram' : $platform);
                if (in_array($api_platform, ['messenger', 'instagram'], true)) {
                    // Ensure account has access_token for the fetch
                    $account_for_fetch = $account;
                    if (empty($account_for_fetch['access_token']) && !empty($account_for_fetch['access_token_encrypted'])) {
                        $account_for_fetch['access_token'] = $social_chat->decrypt_value($account_for_fetch['access_token_encrypted']);
                    }

                    $social_chat->schedule_profile_fetch(
                        (int) $conversation['id'],
                        $account_for_fetch,
                        $api_platform,
                        $sender_id
                    );
                }
            }

            // Check if this is a postback from conversation starter (before saving message)
            $is_appointment_postback = false;
            $scheduling_page_url = null;
            $conversation_starter_text = null;

            if (!empty($postback_payload)) {
                // Get conversation starters to find the text for this payload
                $settings = $social_chat->get_social_chat_settings();
                $conversation_starters = $settings['conversation_starters'] ?? [];

                // Determine platform key for conversation starters
                $platform_key = ($platform === 'messenger') ? 'messenger' : (($platform === 'instagram') ? 'instagram_dm' : null);

                // Check if payload matches appointment (we convert id to uppercase and remove dashes/underscores)
                $normalized_payload = strtoupper(str_replace(['-', '_'], '', $postback_payload));
                if ($normalized_payload === 'APPOINTMENT' || strpos($normalized_payload, 'APPOINTMENT') !== false) {
                    $is_appointment_postback = true;

                    // Get scheduling page URL
                    $smart_scheduling = $this->helpmate->get_settings()->get_setting('smart_schedules') ?? [];
                    if (!empty($smart_scheduling['enabled'])) {
                        // Find page with shortcode
                        global $wpdb;
                        $shortcode_pattern = '%[helpmate_scheduling]%';
                        $cache_key = 'helpmate_scheduling_page_' . md5($shortcode_pattern);
                        $results = wp_cache_get($cache_key, 'helpmate');

                        if (false === $results) {
                            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Direct query necessary for custom shortcode search
                            $results = $wpdb->get_results($wpdb->prepare(
                                "SELECT ID, post_type FROM {$wpdb->posts}
                                WHERE post_status = 'publish'
                                AND (post_type = 'post' OR post_type = 'page')
                                AND post_content LIKE %s
                                ORDER BY post_date DESC
                                LIMIT 1",
                                $shortcode_pattern
                            ));
                            // Cache for 1 hour
                            wp_cache_set($cache_key, $results, 'helpmate', HOUR_IN_SECONDS);
                        }

                        if (!empty($results)) {
                            $post_id = $results[0]->ID;
                            $scheduling_page_url = get_permalink($post_id);
                        }
                    }
                } else {
                    // Not appointment - find the conversation starter text for this payload
                    if ($platform_key && isset($conversation_starters[$platform_key])) {
                        foreach ($conversation_starters[$platform_key] as $starter) {
                            // Generate the expected payload format (same as when we create it)
                            $starter_id = $starter['id'] ?? '';
                            $expected_payload = strtoupper(str_replace(['-', '_'], '', $starter_id));

                            // Check if payload matches (handle partial matches for longer payloads)
                            if ($normalized_payload === $expected_payload ||
                                strpos($normalized_payload, $expected_payload) !== false ||
                                strpos($expected_payload, $normalized_payload) !== false) {
                                $conversation_starter_text = $starter['text'] ?? '';
                                break;
                            }
                        }
                    }

                    // If we found the text, replace the message so AI can process it as text
                    if (!empty($conversation_starter_text)) {
                        $message = $conversation_starter_text;
                    }
                }
            }

            // Check for campaign lead collection state (for DM conversations)
            if (in_array($platform, ['messenger', 'instagram'], true)) {
                $processor = new Helpmate_Social_Message_Processor($this->helpmate);

                // Check for button postback for claim deal (handle before regular messages)
                if (!empty($postback_payload) && strpos($postback_payload, 'claim_deal_') === 0) {
                    $campaign_id = str_replace('claim_deal_', '', $postback_payload);
                    $settings = $social_chat->get_social_chat_settings();
                    $campaigns = $settings['lead_campaigns'] ?? [];
                    $campaign = $campaigns[$campaign_id] ?? null;

                    if ($campaign) {
                        // Get or create campaign state
                        $campaign_state = $social_chat->get_campaign_state((int) $conversation['id']);
                        if (!$campaign_state) {
                            $social_chat->create_campaign_state([
                                'conversation_id' => (int) $conversation['id'],
                                'campaign_id' => $campaign_id,
                                'state' => 'waiting_for_claim',
                                'dm_conversation_id' => (int) $conversation['id'],
                            ]);
                        }

                        // Save the postback as a message
                        $social_chat->save_message([
                            'conversation_id' => $conversation['id'],
                            'external_id' => $message_id,
                            'direction' => 'inbound',
                            'content' => 'Claim the Deal',
                            'message_type' => 'postback',
                            'sent_by' => 'customer'
                        ]);

                        // Trigger claim handling
                        $handled = $processor->handle_lead_collection([
                            'account_id' => $account['id'],
                            'platform' => $platform,
                            'message_id' => $message_id,
                            'sender_id' => $sender_id,
                            'sender_name' => $sender_name,
                            'content' => 'claim',
                            'message_type' => 'postback',
                        ], $conversation, $account);

                        if ($handled) {
                            return new WP_REST_Response([
                                'error' => false,
                                'skip_response' => true,
                                'message' => 'Claim button handled'
                            ], 200);
                        }
                    }
                }

                    // Check for regular lead collection (text messages during collection flow)
                // Only check if not a button postback
                if (empty($postback_payload) || strpos($postback_payload, 'claim_deal_') !== 0) {
                    // Save message first so we have a record
                    $message_to_save_for_lead = !empty($conversation_starter_text) ? $conversation_starter_text : $message;
                    $social_chat->save_message([
                        'conversation_id' => $conversation['id'],
                        'external_id' => $message_id,
                        'direction' => 'inbound',
                        'content' => $message_to_save_for_lead,
                        'message_type' => 'text',
                        'sent_by' => 'customer'
                    ]);

                    $handled = $processor->handle_lead_collection([
                        'account_id' => $account['id'],
                        'platform' => $platform,
                        'message_id' => $message_id,
                        'sender_id' => $sender_id,
                        'sender_name' => $sender_name,
                        'content' => $message,
                        'message_type' => 'text',
                    ], $conversation, $account);

                    if ($handled) {
                        return new WP_REST_Response([
                            'error' => false,
                            'skip_response' => true,
                            'message' => 'Lead collection handled'
                        ], 200);
                    }
                }
            }

            // Save incoming message (use conversation starter text if available, otherwise original message)
            // Skip if already saved (button postback for claim deal, or DM message already saved above)
            $message_already_saved = false;
            if (in_array($platform, ['messenger', 'instagram'], true)) {
                // Message was saved if it's a button postback or if it's a regular text message (saved above)
                if ((!empty($postback_payload) && strpos($postback_payload, 'claim_deal_') === 0) ||
                    (empty($postback_payload))) {
                    $message_already_saved = true;
                }
            }

            if (!$message_already_saved) {
                $message_to_save = !empty($conversation_starter_text) ? $conversation_starter_text : $message;
                $social_chat->save_message([
                    'conversation_id' => $conversation['id'],
                    'external_id' => $message_id,
                    'direction' => 'inbound',
                    'content' => $message_to_save,
                    'message_type' => $platform === 'fb_comment' || $platform === 'ig_comment' ? 'comment' : 'text',
                    'sent_by' => 'customer'
                ]);
            }

            // Check for campaign keywords and trigger campaign if match found (only for comments)
            // Only check campaigns if DM for Comments feature is enabled
            $campaign_matched = false;
            if (in_array($platform, ['fb_comment', 'ig_comment'], true) && !empty($platforms['comments']['enabled'])) {
                $processor = new Helpmate_Social_Message_Processor($this->helpmate);
                $campaign_matched = $processor->check_and_trigger_campaign([
                    'account_id' => $account['id'],
                    'platform' => $platform,
                    'message_id' => $message_id,
                    'sender_id' => $sender_id,
                    'sender_name' => $sender_name,
                    'content' => $message_to_save,
                    'message_type' => 'comment',
                    'post_id' => $post_id,
                    'parent_id' => $parent_id,
                    'post_message' => $post_message,
                    'post_image_url' => $post_image_url,
                    'post_type' => $post_type,
                ], $conversation, $account);
            }

            // If campaign matched, skip AI reply (campaign handles the response via DM)
            if ($campaign_matched) {
                return new WP_REST_Response([
                    'error' => false,
                    'skip_response' => true,
                    'message' => 'Campaign matched, DM sent'
                ], 200);
            }

            // Check if human handoff is active
            if ((int) ($conversation['is_human_handoff'] ?? 0) === 1) {
                return new WP_REST_Response([
                    'error' => false,
                    'skip_response' => true,
                    'message' => 'Human handoff active'
                ], 200);
            }

            // If appointment postback and we have URL, send URL button instead of text
            if ($is_appointment_postback && !empty($scheduling_page_url)) {
                // Save the postback as a message
                $social_chat->save_message([
                    'conversation_id' => $conversation['id'],
                    'external_id' => $message_id,
                    'direction' => 'inbound',
                    'content' => $message ?: 'Get Appointment',
                    'message_type' => 'postback',
                    'sent_by' => 'customer'
                ]);

                // Return response with URL button
                return new WP_REST_Response([
                    'error' => false,
                    'response_type' => 'url_button',
                    'response_text' => 'Click the button below to schedule an appointment:',
                    'url' => $scheduling_page_url,
                    'button_text' => 'Schedule Appointment',
                    'access_token' => $account['access_token']
                ], 200);
            }

            // If this post has any campaign, disable generic AI comment reply
            if (in_array($platform, ['fb_comment', 'ig_comment'], true) && !empty($post_id)) {
                $comment_platform = ($platform === 'fb_comment') ? 'facebook' : 'instagram';
                $campaigns = $settings['lead_campaigns'] ?? [];
                $post_has_campaign = false;
                foreach ($campaigns as $c) {
                    if (($c['post_id'] ?? '') === $post_id && ($c['platform'] ?? '') === $comment_platform) {
                        $post_has_campaign = true;
                        break;
                    }
                }
                if ($post_has_campaign) {
                    return new WP_REST_Response([
                        'error' => false,
                        'skip_response' => true,
                        'message' => 'Post has campaign, AI reply disabled'
                    ], 200);
                }
            }

            // Check if AI comment reply is enabled for this platform
            if (in_array($platform, ['fb_comment', 'ig_comment'], true)) {
                $parent_platform = ($platform === 'fb_comment') ? 'messenger' : 'instagram_dm';
                if (empty($platforms[$parent_platform]['comment_auto_reply'] ?? true)) {
                    return new WP_REST_Response([
                        'error' => false,
                        'skip_response' => true,
                        'message' => 'AI comment reply disabled'
                    ], 200);
                }
            }

            // Generate AI response (use conversation starter text if available)
            $message_for_ai = !empty($conversation_starter_text) ? $conversation_starter_text : $message;
            $processor = new Helpmate_Social_Message_Processor($this->helpmate);
            $ai_response = $processor->generate_ai_response_only($message_for_ai, $conversation);

            if (empty($ai_response)) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Failed to generate AI response'
                ], 500);
            }

            // Save outbound message
            $message_data = [
                'conversation_id' => $conversation['id'],
                'direction' => 'outbound',
                'content' => $ai_response,
                'message_type' => 'text',
                'sent_by' => 'ai'
            ];

            // Store comment reply metadata if this is a comment reply
            if (in_array($platform, ['fb_comment', 'ig_comment'], true)) {
                $message_data['meta_data'] = [
                    'comment_id' => $message_id,
                    'reply_id' => null // Will be set after reply is sent
                ];
            }

            $saved_message_id = $social_chat->save_message($message_data);

            // Return response with access token and message_id for comment replies
            $response_data = [
                'error' => false,
                'response_text' => $ai_response,
                'access_token' => $account['access_token']
            ];

            // Include message_id for comment replies so social-server can update it with reply_id
            if (in_array($platform, ['fb_comment', 'ig_comment'], true) && $saved_message_id) {
                $response_data['message_id'] = $saved_message_id;
            }

            // WhatsApp: include quick reply buttons (conversation starters) - WhatsApp has no profile-level ice breakers
            if ($platform === 'whatsapp') {
                $platform_settings = $settings['platforms']['whatsapp'] ?? [];
                $cs_enabled = $platform_settings['conversation_starters_enabled'] ?? $settings['conversation_starters_enabled'] ?? false;
                $starters = $cs_enabled ? ($settings['conversation_starters']['whatsapp'] ?? []) : [];
                $enabled_starters = array_values(array_filter($starters, function ($s) {
                    return isset($s['enabled']) && $s['enabled'] === true && !empty(trim($s['text'] ?? ''));
                }));
                $enabled_starters = array_slice($enabled_starters, 0, 3); // WhatsApp allows max 3 buttons
                if (!empty($enabled_starters)) {
                    $response_data['quick_reply_buttons'] = array_map(function ($s) {
                        $title = substr(sanitize_text_field($s['text'] ?? ''), 0, 20);
                        $id = isset($s['id']) ? strtoupper(str_replace(['-', '_'], '', $s['id'])) : 'STARTER_' . uniqid();
                        return ['id' => substr($id, 0, 256), 'title' => $title];
                    }, $enabled_starters);
                }
            }

            return new WP_REST_Response($response_data, 200);

        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validate required custom fields for contact or task.
     *
     * @since    1.3.0
     * @param    array     $body          The request body containing custom_fields.
     * @param    string    $entity_type   The entity type ('contact' or 'task').
     * @return   string|null               Error message if validation fails, null if passes.
     */
    private function validate_required_custom_fields($body, $entity_type = 'contact')
    {
        $custom_fields = $this->helpmate->get_crm()->get_custom_fields($entity_type);
        $required_fields = array_filter($custom_fields, function ($f) {
            return !empty($f['is_required']);
        });

        if (empty($required_fields)) {
            return null; // No required fields, validation passes
        }

        $custom = isset($body['custom_fields']) && is_array($body['custom_fields'])
            ? $body['custom_fields']
            : [];

        $missing = [];
        foreach ($required_fields as $field) {
            $field_id = $field['id'];
            $value = isset($custom[$field_id]) ? $custom[$field_id] : null;

            // Check if empty: missing, null, empty string, or empty array
            $is_empty = $value === null
                || $value === ''
                || (is_string($value) && trim($value) === '')
                || (is_array($value) && empty($value));

            if ($is_empty) {
                $missing[] = $field['field_label'];
            }
        }

        if (!empty($missing)) {
            return 'Required custom field(s) missing: ' . implode(', ', $missing);
        }

        return null; // Validation passes
    }

}