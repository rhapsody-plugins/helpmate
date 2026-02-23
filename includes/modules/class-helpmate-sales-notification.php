<?php

/**
 * The sales notification class.
 *
 * This is used to handle sales notifications and related functionality.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Sales_Notification
{

    /**
     * The settings instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate_Settings    $settings    The settings handler instance.
     */
    private $settings;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     * @param    Helpmate_Settings    $settings    The settings handler instance.
     */
    public function __construct($settings)
    {
        $this->settings = $settings;

        add_action('wp_ajax_helpmate_sales_notification', array($this, 'get_notification'));
        add_action('wp_ajax_nopriv_helpmate_sales_notification', array($this, 'get_notification'));
    }

    /**
     * Check if sales notification is enabled.
     *
     * @since 1.0.0
     * @return bool True if sales notification is enabled, false otherwise.
     */
    public function is_enabled(): bool
    {
        $settings = $this->settings->get_setting('modules');
        if ($settings && isset($settings[HELPMATE_MODULE_SALES_NOTIFICATIONS])) {
            return $settings[HELPMATE_MODULE_SALES_NOTIFICATIONS];
        } else {
            return false;
        }
    }

    /**
     * Get a random notification based on enabled settings (returns data for REST/ajax).
     *
     * @since    1.0.0
     * @return   array|object Notification data or empty object.
     */
    public function get_notification_data()
    {
        if ($GLOBALS['helpmate']->is_woocommerce_active() === false) {
            return (object) [];
        }

        $sales_notifications = is_array($this->settings->get_setting('sales_notifications')) ? $this->settings->get_setting('sales_notifications') : [];

        // Module is already enabled when this runs; always show order notifications (sale). Download/review are opt-in.
        $enabled_types = array('sale');
        if (!empty($sales_notifications['download'])) {
            $enabled_types[] = 'download';
        }
        if (!empty($sales_notifications['review'])) {
            $enabled_types[] = 'review';
        }

        if (empty($enabled_types)) {
            return (object) [];
        }

        shuffle($enabled_types);

        foreach ($enabled_types as $selected_type) {
            switch ($selected_type) {
                case 'sale':
                    $data = $this->get_sale_notification();
                    break;
                case 'download':
                    $data = $this->get_download_notification();
                    break;
                case 'review':
                    $data = $this->get_review_notification();
                    break;
                default:
                    $data = (object) [];
            }

            if (!empty($data) && (is_array($data) ? count($data) > 0 : true)) {
                return $data;
            }
        }

        return (object) [];
    }

    /**
     * Get a random notification (sends JSON for wp_ajax).
     *
     * @since    1.0.0
     */
    public function get_notification()
    {
        wp_send_json($this->get_notification_data());
    }

    /**
     * Enqueue frontend assets when module is enabled.
     *
     * @since    1.0.0
     */
    /**
     * Sales notification is rendered inside the React public app (helpmate-root shadow DOM),
     * so we do not enqueue standalone JS/CSS here. The React app fetches /sales-notification
     * and displays toasts with app styles. This method is a no-op for frontend assets.
     */
    public function enqueue_assets(): void
    {
        // No-op: sales notifications are shown by the public React app inside shadow DOM.
    }

    /**
     * Get a random sale notification.
     *
     * @since    1.0.0
     * @return   array    The sale notification data.
     */
    private function get_sale_notification()
    {
        $args = [
            'limit' => 20,
            'orderby' => 'date',
            'order' => 'DESC',
            'status' => ['completed', 'processing'],
        ];
        $orders = wc_get_orders($args);

        if (empty($orders)) {
            return [];
        }

        shuffle($orders);

        foreach ($orders as $order) {
            $items = $order->get_items();

            if (empty($items)) {
                continue;
            }

            $first_item = reset($items);
            $product_name = $first_item->get_name();
            if (empty($product_name)) {
                continue;
            }

            $product = $first_item->get_product();
            $product_url = '';
            $image_url = '';
            if ($product) {
                $product_url = $product->get_permalink();
                $image_id = $product->get_image_id();
                $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'thumbnail') : '';
            }

            return [
                'type' => 'sale',
                'customer_name' => $order->get_billing_first_name(),
                'product_name' => $product_name,
                'time' => $order->get_date_created()->format('M d, Y g:i A'),
                'product_url' => $product_url,
                'product_image' => $image_url,
            ];
        }

        return [];
    }

    /**
     * Get a random download notification.
     *
     * @since    1.0.0
     * @return   array    The download notification data.
     */
    private function get_download_notification()
    {
        $args = [
            'limit' => 20,
            'orderby' => 'date',
            'order' => 'DESC',
            'status' => 'completed',
        ];
        $orders = wc_get_orders($args);

        if (empty($orders)) {
            return [];
        }

        // Shuffle orders to get random selection
        shuffle($orders);

        // Try each order until we find one with downloadable items
        foreach ($orders as $order) {
            $items = $order->get_items();
            $downloadable_items = [];

            foreach ($items as $item) {
                $product = $item->get_product();
                if ($product && $product->is_downloadable() && $product->is_visible()) {
                    $downloadable_items[] = $item;
                }
            }

            if (!empty($downloadable_items)) {
                $item = $downloadable_items[array_rand($downloadable_items)];
                $product = $item->get_product();
                $image_id = $product->get_image_id();
                $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'thumbnail') : '';

                return [
                    'type' => 'download',
                    'customer_name' => $order->get_billing_first_name(),
                    'product_name' => $item->get_name(),
                    'time' => $order->get_date_created()->format('M d, Y g:i A'),
                    'product_url' => $product->get_permalink(),
                    'product_image' => $image_url,
                ];
            }
        }

        return [];
    }

    /**
     * Get a random review notification.
     *
     * @since    1.0.0
     * @return   array    The review notification data.
     */
    private function get_review_notification()
    {
        $args = [
            'status' => 'approve',
            'number' => 20,
            'orderby' => 'date',
            'order' => 'DESC',
            'type' => 'review',
        ];
        $reviews = get_comments($args);

        if (empty($reviews)) {
            return [];
        }

        // Shuffle reviews to get random selection
        shuffle($reviews);

        // Try each review until we find one with a valid product
        foreach ($reviews as $review) {
            $product_id = $review->comment_post_ID;
            $product = wc_get_product($product_id);

            if ($product && $product->is_visible()) {
                $image_id = $product->get_image_id();
                $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'thumbnail') : '';

                return [
                    'type' => 'review',
                    'customer_name' => $review->comment_author,
                    'product_name' => $product->get_name(),
                    'time' => gmdate('M d, Y g:i A', strtotime($review->comment_date_gmt)),
                    'product_url' => $product->get_permalink(),
                    'product_image' => $image_url,
                    'rating' => get_comment_meta($review->comment_ID, 'rating', true),
                    'review_text' => wp_trim_words($review->comment_content, 20),
                ];
            }
        }

        return [];
    }
}