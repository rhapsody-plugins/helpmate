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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/quick-train-homepage', array(
            'methods' => 'POST',
            'callback' => fn() => $this->helpmate->get_chat()->quick_train_homepage(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/check-woocommerce', array(
            'methods' => 'GET',
            'callback' => function () {
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        /* --------------------------------------- */
        /*                   API                   */
        /* --------------------------------------- */

        register_rest_route('helpmate/v1', '/feature-usage', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_api()->sync_with_server(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/activate-api-key', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_api()->handle_api_key_activation($request->get_param('api_key')),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/pro', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/get-free-api-key', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_api()->rp_register_free_api_key($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
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

        // Register separate routes for each method to avoid conflicts
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

        // Register DELETE route using POST method (workaround for server issues)
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
                return new WP_REST_Response([
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
                return new WP_REST_Response([
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
            'callback' => fn($request) => $this->helpmate->get_dashboard()->get_dashboard_data($request->get_param('date_filter')),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        /* --------------------------------------- */
        /*      Document management endpoints      */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/save-documents', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->store_document($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/remove-documents', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->remove_documents($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/get-documents', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->get_indexed_documents($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/documents/count', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_document_handler()->all_documents_count(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/update-documents', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_document_handler()->update_document($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/extract-file-text', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->extract_file_text($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        /* --------------------------------------- */
        /*      Background processing endpoints    */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/bulk-job-status/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->get_bulk_job_status($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
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

        register_rest_route('helpmate/v1', '/background-processing-status', array(
            'methods' => 'GET',
            'callback' => fn() => $this->get_background_processing_status(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/debug-job/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->debug_job($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/cleanup-completed-jobs', array(
            'methods' => 'POST',
            'callback' => fn() => $this->cleanup_completed_jobs(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/bulk-job-delete/(?P<job_id>[a-zA-Z0-9_-]+)', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->delete_bulk_job($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
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

        /* --------------------------------------- */
        /*      Settings management endpoints      */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/settings/(?P<key>[a-zA-Z0-9_-]+)', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $key = sanitize_text_field($request->get_param('key'));
                return $this->helpmate->get_settings()->get_setting($key);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
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

                // Save the entire settings object under the key
                foreach ($body as $key => $value) {
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/settings/(?P<key>[a-zA-Z0-9_-]+)', array(
            'methods' => 'DELETE',
            'callback' => function ($request) {
                $key = sanitize_text_field($request->get_param('key'));
                return $this->helpmate->get_settings()->delete_setting($key);
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
            'args' => array(
                'key' => array(
                    'required' => true,
                    'validate_callback' => function ($param) {
                        return preg_match('/^[a-zA-Z0-9_-]+$/', $param);
                    }
                )
            )
        ));

        /* --------------------------------------- */
        /*      Post management endpoints          */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/posts', [
            'methods' => 'GET',
            'callback' => array($this, 'get_posts'),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options'),
        ));

        register_rest_route('helpmate/v1', '/discounted-products', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->is_woocommerce_active() ? $this->get_discounted_products() : new WP_REST_Response([
                'error' => true,
                'message' => 'WooCommerce is not active.'
            ], 200),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
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



        /* --------------------------------------- */
        /*         Ticket management endpoints      */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/ticket/all', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $page = $request->get_param('page') ? (int) $request->get_param('page') : 1;
                $per_page = $request->get_param('per_page') ? (int) $request->get_param('per_page') : 10;
                return $this->helpmate->get_ticket()->get_all_tickets($page, $per_page);
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

        register_rest_route('helpmate/v1', '/ticket/messages', array(
            'methods' => 'GET',
            'callback' => fn($request) => $this->helpmate->get_ticket()->get_ticket_messages($request),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
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
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
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


}