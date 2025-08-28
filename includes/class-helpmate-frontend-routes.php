<?php

/**
 * The frontend routes class.
 *
 * This class handles all the public-facing routes for the plugin.
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

class HelpMate_Frontend_Routes
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

        register_rest_route('helpmate/v1', '/chat/metadata', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['id', 'key', 'value']);
                return $this->helpmate->get_chat()->update_chat_metadata($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
        ));

        /* --------------------------------------- */
        /*          Sales notification endpoint     */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/sales-notification', array(
            'methods' => 'GET',
            'callback' => fn() => $this->helpmate->get_sales_notification()->get_notification(),
            'permission_callback' => array($this, 'verify_nonce')
        ));

        /* --------------------------------------- */
        /*              Ticket System              */
        /* --------------------------------------- */
        register_rest_route('helpmate/v1', '/ticket', array(
            'methods' => 'POST',
            'callback' => function ($request) {
                $params = $this->sanitize_request($request, ['subject', 'name', 'priority'], ['message'], ['email']);
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
                return $this->helpmate->get_leads()->create_lead($params);
            },
            'permission_callback' => array($this, 'verify_nonce')
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
            $is_pro = $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active();
            $is_woocommerce_active = $this->helpmate->is_woocommerce_active();
            $settings = [];
            $customization = $this->helpmate->get_settings()->get_setting('customization') ?? [];
            $proactiveSales = $this->helpmate->get_settings()->get_setting('proactive_sales') ?? [];
            $salesNotifications = $this->helpmate->get_settings()->get_setting('sales_notifications') ?? [];
            $orderTracker = $this->helpmate->get_settings()->get_setting('order_tracker') ?? [];
            $modules = $this->helpmate->get_settings()->get_setting('modules') ?? [];
            $aiSettings = $this->helpmate->get_settings()->get_setting('ai') ?? [];
            $behavior = $this->helpmate->get_settings()->get_setting('behavior') ?? [];
            $refundReturn = $this->helpmate->get_settings()->get_setting('refund_return') ?? [];
            $coupons = $this->helpmate->get_settings()->get_setting('coupons') ?? [];
            $proactiveSalesProducts = [];
            $quickOptions = $this->helpmate->get_document_handler()->get_quick_option_qa_documents() ?? [];

            if ($refundReturn['reasons']) {
                $settings['refund_return_reasons'] = $refundReturn['reasons'];
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
            if (isset($behavior['show_ticket_creation_option'])) {
                $settings['show_ticket_creation_option'] = $behavior['show_ticket_creation_option'];
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

            if ($salesNotifications) {
                foreach ($salesNotifications as $key => $value) {
                    $settings[$key] = $value;
                }
            }

            if ($orderTracker) {
                foreach ($orderTracker as $key => $value) {
                    $settings[$key] = $value;
                }
            }

            return new WP_REST_Response([
                'error' => false,
                'is_pro' => $is_pro,
                'is_woocommerce_active' => $is_woocommerce_active,
                'modules' => $modules,
                'customization' => $customization,
                'proactive_sales_products' => $proactiveSalesProducts,
                'quick_options' => $quickOptions,
                'settings' => $settings,
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }
}