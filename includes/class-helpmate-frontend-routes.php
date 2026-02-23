<?php

/**
 * The frontend routes class.
 *
 * This class handles all the public-facing routes for the plugin.
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

class Helpmate_Frontend_Routes
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
     * Verify nonce for security
     *
     * @param WP_REST_Request $request The request object.
     * @return bool True if nonce is valid, false otherwise.
     */
    public function verify_nonce($request)
    {
        $nonce = $request->get_header('x-wp-nonce');
        if (!$nonce || !wp_verify_nonce(sanitize_key($nonce), 'wp_rest')) {
            return false;
        }
        return true;
    }

    /**
     * Verify nonce from query string (for GET/EventSource where headers are not sent).
     *
     * @param WP_REST_Request $request The request object.
     * @return bool True if nonce is valid.
     */
    public function verify_nonce_query($request)
    {
        $nonce = $request->get_param('_wpnonce');
        if (!$nonce || !wp_verify_nonce(sanitize_key($nonce), 'wp_rest')) {
            return false;
        }
        return true;
    }

    /**
     * Sanitize request parameters
     *
     * @param WP_REST_Request $request The request object.
     * @param array $text_fields Array of field names to sanitize as text.
     * @param array $textarea_fields Array of field names to sanitize as textarea.
     * @param array $email_fields Array of field names to sanitize as email.
     * @return array Array of sanitized parameters.
     */
    private function sanitize_request($request, $text_fields = [], $textarea_fields = [], $email_fields = [])
    {
        $params = $request->get_params();

        // Sanitize text fields
        foreach ($text_fields as $field) {
            if (isset($params[$field])) {
                $params[$field] = sanitize_text_field($params[$field]);
            }
        }

        // Sanitize textarea fields
        foreach ($textarea_fields as $field) {
            if (isset($params[$field])) {
                $params[$field] = sanitize_textarea_field($params[$field]);
            }
        }

        // Sanitize email fields
        foreach ($email_fields as $field) {
            if (isset($params[$field])) {
                $params[$field] = sanitize_email($params[$field]);
            }
        }

        return $params;
    }

    /**
     * Register all frontend routes.
     *
     * @since    1.0.0
     */
    public function register_routes()
    {

        /* --------------------------------------- */
        /*                  Helpers                 */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/user/status', array(
            'methods' => 'GET',
            'callback' => fn() => new WP_REST_Response(['is_logged_in' => is_user_logged_in()], 200),
            'permission_callback' => array($this, 'verify_nonce')
        ));

        /* --------------------------------------- */
        /*            Settings endpoint            */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/bot-settings', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_bot_settings'),
            'permission_callback' => array($this, 'verify_nonce')
        ));

        /* --------------------------------------- */
        /*          Chat-related endpoints         */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/chat', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['image_url', 'product_id', 'session_id'], ['message']);
                return $this->helpmate->get_chat()->handle_chat_request($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        register_rest_route('helpmate/v1', '/chat/clear', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['session_id']);
                return $this->helpmate->get_chat()->clear_chat_history($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        register_rest_route('helpmate/v1', '/chat/history', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['session_id', 'limit']);
                return $this->helpmate->get_chat()->get_chat_history($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        // Public chat widget: short-poll endpoint (returns immediately, avoids holding PHP worker)
        register_rest_route('helpmate/v1', '/chat/poll', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $session_id = $request->get_param('session_id');
                $last_id = (int) $request->get_param('last_id');
                $last_handoff = $request->get_param('last_handoff');
                $last_ai_disabled = $request->get_param('last_ai_disabled');
                $last_admin_typing = $request->get_param('last_admin_typing');
                $last_review = $request->get_param('last_review');
                $realtime = new \Helpmate_Realtime($this->helpmate);
                $events = $realtime->get_chat_stream_events(
                    $session_id,
                    $last_id,
                    $last_handoff === null || $last_handoff === '' ? null : filter_var($last_handoff, FILTER_VALIDATE_BOOLEAN),
                    $last_ai_disabled === null || $last_ai_disabled === '' ? null : filter_var($last_ai_disabled, FILTER_VALIDATE_BOOLEAN),
                    $last_admin_typing === null || $last_admin_typing === '' ? null : filter_var($last_admin_typing, FILTER_VALIDATE_BOOLEAN),
                    $last_review === null || $last_review === '' ? null : filter_var($last_review, FILTER_VALIDATE_BOOLEAN)
                );
                return new \WP_REST_Response(['events' => $events], 200);
            },
            'permission_callback' => array($this, 'verify_nonce_query'),
            'args' => array(
                'session_id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                'last_id' => array('default' => 0, 'sanitize_callback' => 'absint'),
                'last_handoff' => array('required' => false),
                'last_ai_disabled' => array('required' => false),
                'last_admin_typing' => array('required' => false),
                'last_review' => array('required' => false),
                '_wpnonce' => array('required' => true),
            )
        ));

        // Public chat widget SSE stream (legacy; prefer /chat/poll to avoid worker starvation)
        register_rest_route('helpmate/v1', '/chat/stream', array(
            'methods' => 'GET',
            'callback' => function ($request) {
                $session_id = $request->get_param('session_id');
                $realtime = new \Helpmate_Realtime($this->helpmate);
                $realtime->handle_sse_chat_stream($session_id);
                exit;
            },
            'permission_callback' => array($this, 'verify_nonce_query'),
            'args' => array(
                'session_id' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                '_wpnonce' => array('required' => true),
            )
        ));

        register_rest_route('helpmate/v1', '/chat/metadata', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['id', 'key', 'value']);
                return $this->helpmate->get_chat()->update_chat_metadata($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        // Typing indicator endpoints
        register_rest_route('helpmate/v1', '/chat/typing', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['session_id']);
                $session_id = $params['session_id'] ?? '';

                if (empty($session_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Session ID is required', 'helpmate-ai-chatbot')
                    ], 400);
                }

                // Store typing status in transient (expires in 5 seconds)
                $transient_key = 'helpmate_typing_website_' . $session_id . '_user';
                set_transient($transient_key, true, 5);

                return new WP_REST_Response([
                    'error' => false,
                    'message' => 'Typing status updated'
                ]);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        register_rest_route('helpmate/v1', '/chat/typing-status', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['session_id']);
                $session_id = $params['session_id'] ?? '';

                if (empty($session_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Session ID is required', 'helpmate-ai-chatbot')
                    ], 400);
                }

                // Check if admin is typing
                $admin_typing_key = 'helpmate_typing_website_' . $session_id . '_admin';
                $is_admin_typing = get_transient($admin_typing_key) !== false;

                return new WP_REST_Response([
                    'error' => false,
                    'is_typing' => $is_admin_typing
                ]);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        // End chat endpoint
        register_rest_route('helpmate/v1', '/chat/end', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['session_id']);
                $session_id = $params['session_id'] ?? '';

                if (empty($session_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Session ID is required', 'helpmate-ai-chatbot')
                    ], 400);
                }

                // Set transient for review request (expires in 1 hour)
                $transient_key = 'helpmate_review_request_' . $session_id;
                set_transient($transient_key, true, 3600);

                return new WP_REST_Response([
                    'error' => false,
                    'message' => __('Chat ended successfully', 'helpmate-ai-chatbot')
                ], 200);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        // Submit review endpoint
        register_rest_route('helpmate/v1', '/chat/review', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['session_id', 'rating'], ['message']);
                $session_id = $params['session_id'] ?? '';
                $rating = isset($params['rating']) ? (int) $params['rating'] : 0;
                $message = $params['message'] ?? '';

                if (empty($session_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Session ID is required', 'helpmate-ai-chatbot')
                    ], 400);
                }

                if ($rating < 1 || $rating > 5) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Rating must be between 1 and 5', 'helpmate-ai-chatbot')
                    ], 400);
                }

                global $wpdb;
                $reviews_table = $wpdb->prefix . 'helpmate_chat_reviews';
                $conversation_id = 'website_' . md5($session_id);

                // Check if review already exists for this session
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Direct query necessary; caching not appropriate for frequently changing data; table name is safe, uses wpdb->prefix
                $existing_review = $wpdb->get_var($wpdb->prepare(
                    // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT id FROM {$reviews_table} WHERE session_id = %s",
                    $session_id
                ));

                if ($existing_review) {
                    // Update existing review
                    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Update operation doesn't require caching
                    $wpdb->update(
                        $reviews_table,
                        [
                            'rating' => $rating,
                            'message' => $message,
                            'updated_at' => current_time('mysql')
                        ],
                        ['id' => $existing_review],
                        ['%d', '%s', '%s'],
                        ['%d']
                    );
                } else {
                    // Insert new review
                    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Insert operation doesn't require caching
                    $wpdb->insert(
                        $reviews_table,
                        [
                            'session_id' => $session_id,
                            'conversation_id' => $conversation_id,
                            'rating' => $rating,
                            'message' => $message,
                            'created_at' => current_time('mysql'),
                            'updated_at' => current_time('mysql')
                        ],
                        ['%s', '%s', '%d', '%s', '%s', '%s']
                    );
                }

                // Clear review request transient
                delete_transient('helpmate_review_request_' . $session_id);

                return new WP_REST_Response([
                    'error' => false,
                    'message' => __('Review submitted successfully', 'helpmate-ai-chatbot')
                ], 200);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        // Check review request status
        register_rest_route('helpmate/v1', '/chat/review-request-status', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['session_id']);
                $session_id = $params['session_id'] ?? '';

                if (empty($session_id)) {
                    return new WP_REST_Response([
                        'error' => true,
                        'message' => __('Session ID is required', 'helpmate-ai-chatbot')
                    ], 400);
                }

                // Check if review request exists
                $transient_key = 'helpmate_review_request_' . $session_id;
                $review_requested = get_transient($transient_key) !== false;

                return new WP_REST_Response([
                    'error' => false,
                    'review_requested' => $review_requested
                ], 200);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        /* --------------------------------------- */
        /*              Ticket System              */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/ticket', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['subject', 'name', 'priority'], ['message'], ['email']);
                $params['source'] = 'chatbot';
                return $this->helpmate->get_ticket()->create_ticket($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        register_rest_route('helpmate/v1', '/ticket/reply', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['ticket_id', 'is_admin'], ['message']);
                return $this->helpmate->get_ticket()->reply_to_ticket($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        /* --------------------------------------- */
        /*                  Leads                  */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/leads', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['name']);
                $params['metadata'] = [
                    'email' => sanitize_email($request->get_param('metadata')['email']),
                    'phone' => sanitize_text_field($request->get_param('metadata')['phone']),
                    'website' => sanitize_url($request->get_param('metadata')['website']),
                    'message' => sanitize_textarea_field($request->get_param('metadata')['message'])
                ];
                $params['source'] = 'chatbot';
                return $this->helpmate->get_leads()->create_lead($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        /* --------------------------------------- */
        /*            Sales Notification           */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/sales-notification', array(
            'methods' => 'GET',
            'callback' => function () {
                $sales = $this->helpmate->get_sales_notification();
                if (!$sales || !$sales->is_enabled()) {
                    return new WP_REST_Response((object) [], 200);
                }
                return new WP_REST_Response($sales->get_notification_data(), 200);
            },
            'permission_callback' => '__return_true'
        ));
    }

    private function get_product_info($product_ids)
    {
        $products = [];

        foreach ($product_ids as $product_id) {
            $product = wc_get_product($product_id);
            if ($product) {
                $average_rating = $product->get_average_rating();
                $review_count = $product->get_review_count();

                $products[] = [
                    'id' => $product->get_id(),
                    'name' => $product->get_name(),
                    'price' => $product->get_price_html(),
                    'image' => get_the_post_thumbnail_url($product->get_id(), 'full'),
                    'regular_price' => wc_price($product->get_regular_price()),
                    'sale_price' => wc_price($product->get_sale_price()),
                    'discount_percentage' => $product->get_regular_price() ? round((($product->get_regular_price() - $product->get_sale_price()) / $product->get_regular_price()) * 100) : 0,
                    'stock_status' => $product->get_stock_status(),
                    'url' => $product->get_permalink(),
                    'average_rating' => $average_rating,
                    'review_count' => $review_count
                ];
            }
        }

        return $products;
    }

    /**
     * Get the bot settings.
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function get_bot_settings()
    {
        try {
            if ($this->helpmate->get_api()->get_key()) {
                $api = true;
            } else {
                $api = false;
            }
            $is_pro = $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active();
            $is_woocommerce_active = $this->helpmate->is_woocommerce_active();
            $settings = [];
            $customization = $this->helpmate->get_settings()->get_setting('customization') ?? [];
            $proactiveSales = $this->helpmate->get_settings()->get_setting('proactive_sales') ?? [];
            $orderTracker = $this->helpmate->get_settings()->get_setting('order_tracker') ?? [];
            $modules = $this->helpmate->get_settings()->get_setting('modules') ?? [];
            $behavior = $this->helpmate->get_settings()->get_setting('behavior') ?? [];
            $refundReturn = $this->helpmate->get_settings()->get_setting('refund_return') ?? [];
            $coupons = $this->helpmate->get_settings()->get_setting('coupons') ?? [];
            $smartScheduling = $this->helpmate->get_settings()->get_setting('smart_schedules') ?? [];
            $proactiveSalesProducts = [];
            $quickOptions = $this->helpmate->get_document_handler()->get_quick_option_qa_documents() ?? [];

            if ($refundReturn['reasons']) {
                $settings['refund_return_reasons'] = $refundReturn['reasons'];
            }

            if (isset($behavior['hide_on_mobile'])) {
                $settings['hide_on_mobile'] = $behavior['hide_on_mobile'];
            }
            if (isset($behavior['collect_lead'])) {
                $settings['collect_lead'] = $behavior['collect_lead'];
            }
            if (isset($behavior['lead_form_fields'])) {
                $settings['lead_form_fields'] = $behavior['lead_form_fields'];
            }
            if (isset($coupons['coupon_collect_lead'])) {
                $settings['coupon_collect_lead'] = $coupons['coupon_collect_lead'];
            }
            if (isset($behavior['welcome_message']) && isset($behavior['welcome_message_sound'])) {
                $settings['welcome_message'] = $behavior['welcome_message'];
                $settings['welcome_message_sound'] = $behavior['welcome_message_sound'];
            }
            $settings['business_hours_enabled'] = $behavior['business_hours_enabled'] ?? false;
            $settings['business_hours'] = $behavior['business_hours'] ?? [];
            $settings['business_hours_timezone'] = $behavior['business_hours_timezone'] ?? '';
            if (!$is_pro) {
                $settings['business_hours_enabled'] = false;
            }
            if ($proactiveSales['products'] && $is_woocommerce_active) {
                $proactiveSalesProducts = $this->get_product_info($proactiveSales['products']);
            }
            if ($this->helpmate->get_settings()->get_setting('coupons')['exit_intent_coupon']) {
                $settings['exit_intent_coupon'] = $this->helpmate->get_settings()->get_setting('coupons')['exit_intent_coupon'];
            }

            $withoutProducts = array_filter(
                $proactiveSales,
                fn($key) =>
                $key !== 'products'
                ,
                ARRAY_FILTER_USE_KEY
            );

            foreach ($withoutProducts as $key => $value) {
                $settings[$key] = $value;
            }

            if ($orderTracker) {
                foreach ($orderTracker as $key => $value) {
                    $settings[$key] = $value;
                }
            }

            $salesNotifications = $this->helpmate->get_settings()->get_setting('sales_notifications') ?? [];
            if (!empty($salesNotifications)) {
                if (isset($salesNotifications['sales_notification_show_frequency'])) {
                    $settings['sales_notification_show_frequency'] = (float) $salesNotifications['sales_notification_show_frequency'];
                }
                if (isset($salesNotifications['sales_notification_template'])) {
                    $settings['sales_notification_template'] = $salesNotifications['sales_notification_template'];
                }
            }

            // Add smart schedules settings if enabled
            $smartSchedulingSettings = [];
            if (!empty($smartScheduling) && !empty($smartScheduling['enabled'])) {
                $smartSchedulingSettings['enabled'] = true;
                $smartSchedulingSettings['buttonText'] = $smartScheduling['buttonText'] ?? 'Get Appointments';

                // Find first page with shortcode
                $schedulingPageUrl = $this->find_page_with_shortcode('[helpmate_scheduling]');
                if ($schedulingPageUrl) {
                    $smartSchedulingSettings['pageUrl'] = $schedulingPageUrl;
                }
            }

            // Expose live agents (team members who can do live chat). Pro only.
            $live_agents = [];
            if ($is_pro) {
                $members = $this->helpmate->get_team()->get_team_members_by_roles(['admin', 'manager', 'live_chat_agent']);
                $limit = 10;
                foreach (array_slice($members, 0, $limit) as $member) {
                    $user_id = (int) $member['user_id'];
                    $name = !empty($member['display_name']) ? $member['display_name'] : $member['first_name'];
                    $live_agents[] = [
                        'id' => $user_id,
                        'name' => $name ?: '',
                        'avatar_url' => get_avatar_url($user_id, ['size' => 64]),
                    ];
                }
            }

            return new WP_REST_Response([
                'error' => false,
                'api' => $api,
                'is_pro' => $is_pro,
                'is_woocommerce_active' => $is_woocommerce_active,
                'modules' => $modules,
                'customization' => $customization,
                'proactive_sales_products' => $proactiveSalesProducts,
                'quick_options' => $quickOptions,
                'settings' => $settings,
                'smart_scheduling' => $smartSchedulingSettings,
                'live_agents' => $live_agents,
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Find the first page/post that contains a specific shortcode.
     *
     * @since    1.3.0
     * @param    string    $shortcode    The shortcode to search for (e.g., '[helpmate_scheduling]').
     * @return   string|null    The URL of the first page found, or null if not found.
     */
    private function find_page_with_shortcode($shortcode)
    {
        // Search in posts
        $posts = get_posts(array(
            'post_type' => array('post', 'page'),
            'post_status' => 'publish',
            'posts_per_page' => -1,
            's' => $shortcode,
        ));

        foreach ($posts as $post) {
            if (has_shortcode($post->post_content, 'helpmate_scheduling')) {
                return get_permalink($post->ID);
            }
        }

        // Also search in post content directly (more reliable)
        global $wpdb;
        $shortcode_pattern = '%[helpmate_scheduling]%';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $results = $wpdb->get_results($wpdb->prepare(
            "SELECT ID, post_type FROM {$wpdb->posts}
            WHERE post_status = 'publish'
            AND (post_type = 'post' OR post_type = 'page')
            AND post_content LIKE %s
            ORDER BY post_date DESC
            LIMIT 1",
            $shortcode_pattern
        ));

        if (!empty($results)) {
            $post_id = $results[0]->ID;
            return get_permalink($post_id);
        }

        return null;
    }
}