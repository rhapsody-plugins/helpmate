<?php

/**
 * The database class for the HelpMate plugin.
 *
 * A class that handles the database operations for the HelpMate plugin.
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

class HelpMate_Database
{

    /**
     * Construct the database class.
     *
     * @since 1.0.0
     */
    public function __construct()
    {
        // Initialize database tables
        $this->create_tables();
    }

    /**
     * Create the tables.
     *
     * @since 1.0.0
     * @access private
     */
    private function create_tables()
    {
        global $wpdb;
        $documents_table = $wpdb->prefix . 'helpmate_documents';
        $chat_history_table = $wpdb->prefix . 'helpmate_chat_history';
        $settings_table = $wpdb->prefix . 'helpmate_settings';
        $analytics_table = $wpdb->prefix . 'helpmate_analytics';
        $abandoned_carts_table = $wpdb->prefix . 'helpmate_abandoned_carts';
        $tickets_table = $wpdb->prefix . 'helpmate_tickets';
        $leads_table = $wpdb->prefix . 'helpmate_leads';

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

        $charset_collate = $wpdb->get_charset_collate();

        // Documents table
        $sql = "CREATE TABLE IF NOT EXISTS {$documents_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            document_type varchar(50) NOT NULL,
            title text,
            content text,
            vector text,
            metadata text,
            last_updated bigint(20),
            PRIMARY KEY  (id),
            KEY document_type (document_type)
        ) $charset_collate;";
        dbDelta($sql);

        // Chat history table
        $sql = "CREATE TABLE IF NOT EXISTS {$chat_history_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            session_id varchar(255) NOT NULL,
            message text NOT NULL,
            role varchar(50) NOT NULL,
            timestamp bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY session_id (session_id),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Settings table
        $sql = "CREATE TABLE IF NOT EXISTS {$settings_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            setting_key varchar(255) NOT NULL,
            setting_value text NOT NULL,
            last_updated bigint(20) NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY setting_key (setting_key)
        ) $charset_collate;";
        dbDelta($sql);

        // Analytics table
        $sql = "CREATE TABLE IF NOT EXISTS {$analytics_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            event_type varchar(255) NOT NULL,
            event_data text NOT NULL,
            timestamp bigint(20) NOT NULL,
            PRIMARY KEY  (id),
            KEY event_type (event_type)
        ) $charset_collate;";
        dbDelta($sql);

        // Abandoned carts table
        $sql = "CREATE TABLE IF NOT EXISTS {$abandoned_carts_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            cart_data text NOT NULL,
            cart_status varchar(50) NOT NULL COMMENT 'Order Placed, Abandoned, Recovered',
            woocommerce_session_id varchar(255) NOT NULL,
            timestamp bigint(20) NOT NULL,
            mails_sent int(11) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Tickets table
        $sql = "CREATE TABLE IF NOT EXISTS {$tickets_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            ticket_id varchar(255) NOT NULL,
            subject text NOT NULL,
            message text NOT NULL,
            role varchar(50) NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'open' COMMENT 'open, in_progress, resolved, closed',
            user_id bigint(20),
            timestamp bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY ticket_id (ticket_id),
            KEY user_id (user_id),
            KEY status (status),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Leads table
        $sql = "CREATE TABLE IF NOT EXISTS {$leads_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            timestamp bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Promo banners table
        $promo_banners_table = $wpdb->prefix . 'helpmate_promo_banners';
        $sql = "CREATE TABLE IF NOT EXISTS {$promo_banners_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            title varchar(255) NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'active' COMMENT 'active, inactive',
            start_datetime bigint(20) NULL,
            end_datetime bigint(20) NULL,
            metadata text NOT NULL,
            created_at bigint(20) NOT NULL,
            updated_at bigint(20) NOT NULL,
            PRIMARY KEY  (id),
            KEY status (status),
            KEY start_datetime (start_datetime),
            KEY end_datetime (end_datetime)
        ) $charset_collate;";
        dbDelta($sql);

        // Returns and refunds table
        $returns_refunds_table = $wpdb->prefix . 'helpmate_returns_refunds';
        $sql = "CREATE TABLE IF NOT EXISTS {$returns_refunds_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            order_id bigint(20) NOT NULL,
            user_id bigint(20) NOT NULL,
            type varchar(50) NOT NULL COMMENT 'refund, return, or exchange',
            status varchar(50) NOT NULL DEFAULT 'pending' COMMENT 'pending, approved, rejected',
            reason text NOT NULL,
            amount decimal(10,2) NOT NULL,
            items text NOT NULL COMMENT 'JSON array of returned/refunded/exchanged items',
            created_at bigint(20) NOT NULL,
            updated_at bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY order_id (order_id),
            KEY user_id (user_id),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        $this->initialize_default_module_settings();
    }

    /**
     * Initialize default module settings if they don't exist.
     *
     * @since 1.0.0
     * @access private
     */
    private function initialize_default_module_settings()
    {
        global $wpdb;

        // Get all existing settings
        $existing_settings = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT setting_key FROM {$wpdb->prefix}helpmate_settings"
        );

        // Define all default settings
        $default_settings = [
            'modules' => HELPMATE_MODULE_DEFAULT_SETTINGS,
            'license' => [
                'license_key' => '',
                'api_key' => '',
                'credits' => [],
                'last_sync' => 0,
                'customer_id' => '',
                'validation_id' => '',
            ],
            'ai' => [
                'temperature' => 0.7,
                'tone' => 'friendly',
                'language' => 'default',
                'similarity_threshold' => 0.5,
                'consent' => false,
            ],
            'behavior' => [
                'welcome_message_sound' => true,
                'welcome_message' => ['Need Help?'],
                'show_ticket_creation_option' => true,
                'collect_lead' => false,
                'lead_form_fields' => ['name', 'email', 'message'],
                'human_handover' => [
                    [
                        'enabled' => false,
                        'title' => 'Call Us',
                        'value' => '',
                        'type' => 'phone'
                    ],
                    [
                        'enabled' => false,
                        'title' => 'Email Us',
                        'value' => '',
                        'type' => 'email'
                    ],
                    [
                        'enabled' => false,
                        'title' => 'Chat on WhatsApp',
                        'value' => '',
                        'type' => 'whatsapp'
                    ],
                    [
                        'enabled' => false,
                        'title' => 'Chat on Messenger',
                        'value' => '',
                        'type' => 'messenger'
                    ]
                ]
            ],
            'customization' => [
                'bot_name' => 'Helpmate',
                'bot_icon' => '',
                'primary_color' => '#455CFE',
                'primary_gradient' => 'linear-gradient(to top left,#748EFF,#455CFE)',
                'secondary_color' => '#748EFF',
                'secondary_gradient' => '',
                'font_size' => '1rem',
                'sound_effect' => 'notification-1.mp3',
                'icon' => '',
                'icon_size' => '60px',
                'position' => 'right',
                'icon_shape' => 'circle',
                'hide_on_mobile' => false,
            ],
            'order_tracker' => [
                'order_tracker_email_required' => true,
                'order_tracker_phone_required' => false,
            ],
            'refund_return' => [
                'policy_url' => '',
                'selected_email_template' => 1,
                'email_templates' => [
                    [
                        'id' => 1,
                        'refund_return_template_name' => 'Default Email Template',
                        'refund_return_email_subject' => 'Your Refund/Return Request',
                        'refund_return_email_body' => '
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Refund/Return Request Update</title>
                                <style>
                                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff; }
                                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                    .greeting { color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center; }
                                    .heading { color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center; }
                                    .description { color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center; }
                                    .status-card {
                                        background: #ffffff;
                                        border-radius: 8px;
                                        padding: 20px;
                                        margin: 20px auto;
                                        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                                        max-width: 400px;
                                        border: 2px solid #455CFE;
                                    }
                                    .status-badge {
                                        background: #455CFE;
                                        color: white;
                                        padding: 8px 16px;
                                        border-radius: 20px;
                                        display: inline-block;
                                        font-weight: bold;
                                        font-size: 14px;
                                        margin-bottom: 15px;
                                    }
                                    .order-info {
                                        background: #f8f9fa;
                                        border-radius: 8px;
                                        padding: 15px;
                                        margin: 15px 0;
                                        border-left: 4px solid #455CFE;
                                    }
                                    .order-id {
                                        color: #455CFE;
                                        font-weight: bold;
                                        font-size: 16px;
                                        margin-bottom: 5px;
                                    }
                                    .order-details {
                                        color: #666666;
                                        font-size: 14px;
                                        line-height: 1.5;
                                    }
                                    .cta-button {
                                        background: #455CFE;
                                        color: white;
                                        padding: 15px 30px;
                                        text-decoration: none;
                                        border-radius: 8px;
                                        display: inline-block;
                                        font-weight: bold;
                                        margin-top: 25px;
                                        text-align: center;
                                    }
                                    .cta-button:hover { background: #3748c7; }
                                    .footer { margin-top: 30px; color: #999999; font-size: 12px; text-align: center; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="greeting">Hello {customer_name},</div>

                                    <div class="heading">Refund/Return Request Update</div>

                                    <div class="description">
                                        We have an update regarding your refund/return request.<br>
                                        Please review the details below:
                                    </div>

                                    <div class="status-card">
                                        <div class="status-badge">{status}</div>
                                        <div class="order-info">
                                            <div class="order-id">Order ID: {order_id}</div>
                                            <div class="order-details">
                                                Your request has been processed and updated.<br>
                                                If you have any questions, please contact our support team.
                                            </div>
                                        </div>
                                    </div>

                                    <div style="text-align: center;">
                                        <a href="{order_url}" class="cta-button">View Order</a>
                                    </div>

                                    <div class="footer">
                                        Best regards,<br>
                                        {shop_name}
                                    </div>
                                </div>
                            </body>
                        </html>',
                    ]
                ],
                'reasons' => [
                    'Defective Product',
                    'Wrong Product Received',
                    'Wrong Size Received',
                    'Wrong Color Received',
                    'Wrong Quantity Received',
                    'Other',
                ],
            ],
            'abandoned_cart' => [
                'abandoned_cart_after' => '60',
                'delete_abandoned_cart_after' => '10080',
                'cart_recovery_button_text' => 'Recover Cart',
                'selected_email_template' => 1,
                'coupon_code' => '',
                'email_templates' => [
                    [
                        'id' => 1,
                        'abandoned_cart_template_name' => 'Default Email Template',
                        'abandoned_cart_email_subject' => 'You left something behind?',
                        'abandoned_cart_email_body' => '
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Your Cart is Waiting</title>
                                <style>
                                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff; }
                                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                    .greeting { color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center; }
                                    .heading { color: #455CFE; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center; }
                                    .description { color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center; }
                                            .product-card {
                                        background: #ffffff;
                                        border-radius: 8px;
                                        padding: 12px;
                                        margin: 10px auto;
                                        display: flex;
                                        align-items: center;
                                        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                                        max-width: 300px;
                                    }
                                    .cart-items-container {
                                        margin: 20px 0;
                                    }
                                    .product-image {
                                        width: 50px;
                                        height: 50px;
                                        border-radius: 6px;
                                        margin-right: 12px;
                                        overflow: hidden;
                                        background: #f8f9fa url({product_image}) center center no-repeat;
                                        background-size: cover;
                                    }
                                    .product-details { flex: 1; }
                                    .product-name { font-weight: bold; color: #333333; font-size: 14px; margin-bottom: 3px; }
                                    .product-color { color: #999999; font-size: 12px; margin-bottom: 3px; }
                                    .product-price { color: #455CFE; font-weight: bold; font-size: 16px; }
                                    .cta-button {
                                        background: #455CFE;
                                        color: white;
                                        padding: 15px 30px;
                                        text-decoration: none;
                                        border-radius: 8px;
                                        display: inline-block;
                                        font-weight: bold;
                                        margin-top: 25px;
                                        text-align: center;
                                    }
                                    .cta-button:hover { background: #3748c7; }
                                    .footer { margin-top: 30px; color: #999999; font-size: 12px; text-align: center; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="greeting">Hello {customer_name},</div>

                                    <div class="heading">You left something behind?</div>

                                    <div class="description">
                                        Looks like you didn\'t get a chance to complete your order.<br>
                                        Don\'t worry—we\'ve saved your cart for you.<br>
                                        Here\'s what\'s waiting for you:
                                    </div>

                                    {cart_items}

                                    <div style="text-align: center;">
                                        <a href="{cart_url}" class="cta-button">View cart</a>
                                    </div>

                                    <div style="text-align: center; margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border: 2px dashed #455CFE;">
                                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Special Offer!</div>
                                        <div style="color: #666666; font-size: 14px;">Use coupon code: <strong style="color: #455CFE;">{coupon_code}</strong></div>
                                    </div>

                                    <div class="footer">
                                        Best regards,<br>
                                        {shop_name}
                                    </div>
                                </div>
                            </body>
                        </html>',
                    ]
                ],
            ],
            'sales_notifications' => [
                "download" => false,
                "review" => false,
                "sales_notification" => true,
                "sales_notification_hide_frequency" => "0.08",
                "sales_notification_show_frequency" => "0.08",
                "sales_notification_template" => "1"
            ],
            'proactive_sales' => [
                "proactive_sales_hide_frequency" => "0.08",
                "proactive_sales_show_frequency" => "0.16",
                "proactive_sales_template" => "1",
                "products" => []
            ],
            'coupons' => [
                "coupons" => [],
                "exit_intent_coupon" => "",
                "ask_ai_coupon" => true,
                "specific_product_query_coupon" => true,
                "collect_lead" => false,
            ],
            'promo_banners' => []
        ];

        // Insert only missing settings
        foreach ($default_settings as $key => $value) {
            if (!in_array($key, $existing_settings)) {
                $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prefix . 'helpmate_settings',
                    [
                        'setting_key' => $key,
                        'setting_value' => json_encode($value),
                        'last_updated' => time()
                    ],
                    ['%s', '%s', '%d']
                );
            }
        }
    }
}
