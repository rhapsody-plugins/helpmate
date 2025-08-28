<?php

/**
 * The sales notification functionality of the plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes/modules
 */

/**
 * The sales notification class.
 *
 * This is used to handle sales notifications and related functionality.
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Sales_Notification
{

    /**
     * The settings instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate_Settings    $settings    The settings handler instance.
     */
    private $settings;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     * @param    HelpMate_Settings    $settings    The settings handler instance.
     */
    public function __construct($settings)
    {
        $this->settings = $settings;
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
     * Get a random notification based on enabled settings.
     *
     * @since    1.0.0
     */
    public function get_notification()
    {
        if ($GLOBALS['helpmate']->is_woocommerce_active() === false) {
            wp_send_json((object) []);
            return;
        }

        $sales_notifications = $this->settings->get_setting('sales_notifications');

        // If no notifications are enabled, return empty
        if (
            !isset($sales_notifications['sales_notification']) &&
            !isset($sales_notifications['download']) &&
            !isset($sales_notifications['review'])
        ) {
            wp_send_json((object) []);
            return;
        }

        // Create array of enabled notification types
        $enabled_types = [];
        if (isset($sales_notifications['sales_notification']) && $sales_notifications['sales_notification']) {
            $enabled_types[] = 'sale';
        }
        if (isset($sales_notifications['download']) && $sales_notifications['download']) {
            $enabled_types[] = 'download';
        }
        if (isset($sales_notifications['review']) && $sales_notifications['review']) {
            $enabled_types[] = 'review';
        }

        // If no types are enabled, return empty
        if (empty($enabled_types)) {
            wp_send_json((object) []);
            return;
        }

        // Shuffle enabled types to try them in random order
        shuffle($enabled_types);

        // Try each notification type until we get valid data
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

            // If we got valid data, return it
            if (!empty($data) && (is_array($data) ? count($data) > 0 : true)) {
                wp_send_json($data);
                return;
            }
        }

        // If all types failed, return empty
        wp_send_json((object) []);
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

        // Shuffle orders to get random selection
        shuffle($orders);

        // Try each order until we find one with valid items
        foreach ($orders as $order) {
            $items = $order->get_items();

            if (empty($items)) {
                continue;
            }

            $first_item = reset($items);
            $product = $first_item->get_product();

            if (!$product || !$product->is_visible()) {
                continue;
            }

            $image_id = $product->get_image_id();
            $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'thumbnail') : '';

            return [
                'type' => 'sale',
                'customer_name' => $order->get_billing_first_name(),
                'product_name' => $first_item->get_name(),
                'time' => $order->get_date_created()->format('M d, Y g:i A'),
                'product_url' => $product->get_permalink(),
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