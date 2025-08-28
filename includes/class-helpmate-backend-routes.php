<?php

/**
 * The backend routes class.
 *
 * This class handles all the backend/admin routes for the plugin.
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Backend_Routes
{
    /**
     * The helpmate instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     * @param    HelpMate    $helpmate    The helpmate instance.
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
        add_action('init', function() {
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
        /*                 License                 */
        /* --------------------------------------- */

        register_rest_route('helpmate/v1', '/feature-usage', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_license()->sync_with_server(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/activate-license', array(
            'methods' => 'POST',
            'callback' => fn($request) => $this->helpmate->get_license()->handle_license_activation($request->get_param('license_key')),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/pro', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active(),
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/license', array(
            'methods' => 'GET',
            'callback' => function () {
                $license = $this->helpmate->get_license();
                return [
                    'license_key' => $license->get_license_key(),
                    'local_credits' => $license->get_local_credits(),
                    'last_sync' => $license->get_last_sync(),
                    'product_slug' => $license->get_product_slug(),
                    'customer_id' => $license->get_customer_id(),
                    'social_credits' => $license->get_social_credits(),
                    'signup_credits' => $license->get_signup_credits(),
                ];
            },
            'permission_callback' => fn() => is_user_logged_in() && current_user_can('manage_options')
        ));

        register_rest_route('helpmate/v1', '/claim-credits', array(
            'methods' => 'POST',
            'callback' => fn() => $this->helpmate->get_license()->claim_credits(),
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

        $args = [
            'post_type' => $post_type ? $post_type : get_post_types([
                'public' => true,
                'show_in_rest' => true,
            ], 'names'),
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
                    $metadata['product'] = [
                        'price' => $product->get_price(),
                        'regular_price' => $product->get_regular_price(),
                        'sale_price' => $product->get_sale_price(),
                        'stock_status' => $product->get_stock_status(),
                        'stock_quantity' => $product->get_stock_quantity(),
                        'sku' => $product->get_sku(),
                        'type' => $product->get_type(),
                        'categories' => wp_get_post_terms($post->ID, 'product_cat', ['fields' => 'names']),
                        'attributes' => $product->get_attributes(),
                        'is_on_sale' => $product->is_on_sale(),
                        'is_featured' => $product->is_featured(),
                        'is_visible' => $product->is_visible(),
                        'rating_count' => $product->get_rating_count(),
                        'average_rating' => $product->get_average_rating(),
                    ];
                }
            }

            $posts[] = [
                'id' => $post->ID,
                'title' => get_the_title($post),
                'type' => $post->post_type,
                'status' => $post->post_status,
                'date' => $post->post_date,
                'content' => $post->post_content,
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
            return $post_type->name !== 'attachment';
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


}