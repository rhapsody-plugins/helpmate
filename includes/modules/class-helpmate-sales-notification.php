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
        $hm = $GLOBALS['helpmate'];
        if (!method_exists($hm, 'is_sales_notification_commerce_active') || !$hm->is_sales_notification_commerce_active()) {
            return (object) [];
        }
        $active_providers = method_exists($hm, 'get_active_commerce_providers')
            ? $hm->get_active_commerce_providers()
            : array();
        if (empty($active_providers)) {
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
        $provider = method_exists($GLOBALS['helpmate'], 'get_primary_commerce_provider')
            ? $GLOBALS['helpmate']->get_primary_commerce_provider()
            : '';
        if ($provider === '') {
            return [];
        }
        if ($provider === 'easy_digital_downloads') {
            return $this->get_edd_sale_notification();
        }
        if ($provider === 'surecart') {
            return $this->get_surecart_sale_notification();
        }

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

            $product = method_exists($first_item, 'get_product') ? $first_item->get_product() : null;
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
        $provider = method_exists($GLOBALS['helpmate'], 'get_primary_commerce_provider')
            ? $GLOBALS['helpmate']->get_primary_commerce_provider()
            : '';
        if ($provider === '') {
            return [];
        }
        if ($provider === 'easy_digital_downloads') {
            return $this->get_edd_download_notification();
        }
        if ($provider === 'surecart') {
            return $this->get_surecart_download_notification();
        }

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
                $product = method_exists($item, 'get_product') ? $item->get_product() : null;
                if ($product && $product->is_downloadable() && $product->is_visible()) {
                    $downloadable_items[] = $item;
                }
            }

            if (!empty($downloadable_items)) {
                $item = $downloadable_items[array_rand($downloadable_items)];
                $product = method_exists($item, 'get_product') ? $item->get_product() : null;
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
        $provider = method_exists($GLOBALS['helpmate'], 'get_primary_commerce_provider')
            ? $GLOBALS['helpmate']->get_primary_commerce_provider()
            : '';
        if ($provider === '') {
            return [];
        }
        if ($provider === 'easy_digital_downloads') {
            return $this->get_edd_review_notification();
        }
        if ($provider === 'surecart') {
            return $this->get_surecart_review_notification();
        }

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

    /**
     * Download (product) post ID from an EDD 3 order item object.
     *
     * @param object $item Order item from edd_get_order_items().
     * @return int Download post ID or 0.
     */
    private function edd_order_item_download_id($item)
    {
        if (!is_object($item)) {
            return 0;
        }
        foreach (array('product_id', 'download_id') as $prop) {
            if (isset($item->{$prop})) {
                $id = (int) $item->{$prop};
                if ($id > 0) {
                    return $id;
                }
            }
        }

        return 0;
    }

    /**
     * Format EDD order date for sale toasts (same pattern as Woo: site-local display).
     *
     * @param object $order Order from edd_get_orders().
     * @return string
     */
    private function format_edd_order_time_for_sale_notification($order)
    {
        $format = 'M d, Y g:i A';
        if (isset($order->date_created_gmt) && $order->date_created_gmt !== '') {
            $dt = date_create_immutable((string) $order->date_created_gmt, new \DateTimeZone('UTC'));
            if ($dt instanceof \DateTimeImmutable) {
                return wp_date($format, $dt->getTimestamp());
            }
        }
        if (isset($order->date_created) && $order->date_created !== '') {
            $dt = date_create_immutable((string) $order->date_created, wp_timezone());
            if ($dt instanceof \DateTimeImmutable) {
                return wp_date($format, $dt->getTimestamp());
            }
        }

        return '';
    }

    /**
     * Read a scalar field from an EDD order object (property or get_* getter).
     *
     * @param object $order Order from edd_get_orders().
     * @param string $field Field name e.g. first_name.
     * @return string
     */
    private function edd_order_string_field($order, $field)
    {
        if (!is_object($order)) {
            return '';
        }
        if (isset($order->{$field})) {
            return trim((string) $order->{$field});
        }
        $getter = 'get_' . $field;
        if (method_exists($order, $getter)) {
            $value = $order->{$getter}();
            if ($value === null || false === $value) {
                return '';
            }

            return trim((string) $value);
        }

        return '';
    }

    /**
     * WordPress user ID from an EDD order (property or getter).
     *
     * @param object $order Order from edd_get_orders().
     * @return int
     */
    private function edd_order_user_id($order)
    {
        if (!is_object($order)) {
            return 0;
        }
        if (isset($order->user_id)) {
            return (int) $order->user_id;
        }
        if (method_exists($order, 'get_user_id')) {
            return (int) $order->get_user_id();
        }

        return 0;
    }

    /**
     * Customer label for EDD sale notification: prefer real names over email.
     *
     * @param object $order Order from edd_get_orders().
     * @return string
     */
    private function edd_order_customer_display_name($order)
    {
        $first = $this->edd_order_string_field($order, 'first_name');
        $last = $this->edd_order_string_field($order, 'last_name');
        $full = trim($first . ' ' . $last);
        if ($full !== '') {
            return $full;
        }

        $legacy = $this->edd_order_string_field($order, 'name');
        if ($legacy !== '') {
            return $legacy;
        }

        $uid = $this->edd_order_user_id($order);
        if ($uid > 0) {
            $user = get_userdata($uid);
            if ($user instanceof \WP_User) {
                $display = trim((string) $user->display_name);
                if ($display !== '') {
                    return $display;
                }
                $from_user = trim($user->first_name . ' ' . $user->last_name);
                if ($from_user !== '') {
                    return $from_user;
                }
            }
        }

        $email = $this->edd_order_string_field($order, 'email');
        if ($email !== '') {
            return $email;
        }

        return '';
    }

    /**
     * Featured image URL for a download post, or the plugin product placeholder.
     *
     * @param int $download_id EDD download post ID (0 if unknown).
     * @return string
     */
    private function edd_product_image_url_with_placeholder($download_id)
    {
        $download_id = (int) $download_id;
        if ($download_id > 0) {
            $thumb = wp_get_attachment_image_url(get_post_thumbnail_id($download_id), 'thumbnail');
            if (is_string($thumb) && $thumb !== '') {
                return $thumb;
            }
        }

        $helpmate = isset($GLOBALS['helpmate']) ? $GLOBALS['helpmate'] : null;
        if ($helpmate && method_exists($helpmate, 'get_edd')) {
            $edd = $helpmate->get_edd();
            if ($edd && method_exists($edd, 'get_product_placeholder_url')) {
                return $edd->get_product_placeholder_url();
            }
        }

        if (defined('HELPMATE_URL')) {
            return HELPMATE_URL . 'assets/images/product-placeholder.svg';
        }

        return '';
    }

    private function get_edd_sale_notification()
    {
        if (!function_exists('edd_get_orders')) {
            return [];
        }
        $orders = edd_get_orders(
            array(
                'number' => 20,
                'status' => 'complete',
                'orderby' => 'date_created',
                'order' => 'DESC',
            )
        );
        if (!is_array($orders) || empty($orders)) {
            return [];
        }

        shuffle($orders);
        foreach ($orders as $order) {
            $order_id = (int) ($order->id ?? 0);
            if ($order_id <= 0) {
                continue;
            }

            $product_name = '';
            $download_id = 0;

            if (function_exists('edd_get_order_items')) {
                $order_items = edd_get_order_items(
                    array(
                        'order_id' => $order_id,
                        'number' => 20,
                    )
                );
                if (is_array($order_items)) {
                    foreach ($order_items as $oi) {
                        $qty = isset($oi->quantity) ? (int) $oi->quantity : 0;
                        if ($qty < 1) {
                            continue;
                        }
                        $name = isset($oi->product_name) ? (string) $oi->product_name : '';
                        if ($name === '') {
                            continue;
                        }
                        $product_name = $name;
                        $download_id = $this->edd_order_item_download_id($oi);
                        break;
                    }
                }
            }

            if ($product_name === '' && isset($order->cart_details) && is_array($order->cart_details)) {
                foreach ($order->cart_details as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $qty = isset($row['quantity']) ? (int) $row['quantity'] : 1;
                    if ($qty < 1) {
                        $qty = 1;
                    }
                    $name = isset($row['name']) ? (string) $row['name'] : '';
                    if ($name === '') {
                        continue;
                    }
                    $product_name = $name;
                    $download_id = isset($row['id']) ? (int) $row['id'] : 0;
                    break;
                }
            }

            if ($product_name === '') {
                continue;
            }

            return [
                'type' => 'sale',
                'customer_name' => $this->edd_order_customer_display_name($order),
                'product_name' => $product_name,
                'time' => $this->format_edd_order_time_for_sale_notification($order),
                'product_url' => $download_id > 0 ? get_permalink($download_id) : '',
                'product_image' => $this->edd_product_image_url_with_placeholder($download_id),
            ];
        }

        return [];
    }

    private function get_edd_download_notification()
    {
        return $this->get_edd_sale_notification();
    }

    private function get_edd_review_notification()
    {
        $reviews = get_comments([
            'status' => 'approve',
            'number' => 20,
            'orderby' => 'date',
            'order' => 'DESC',
            'post_type' => 'download',
        ]);
        if (empty($reviews)) {
            return [];
        }
        shuffle($reviews);
        foreach ($reviews as $review) {
            $download_id = (int) $review->comment_post_ID;
            if (get_post_type($download_id) !== 'download') {
                continue;
            }
            return [
                'type' => 'review',
                'customer_name' => $review->comment_author,
                'product_name' => get_the_title($download_id),
                'time' => gmdate('M d, Y g:i A', strtotime($review->comment_date_gmt)),
                'product_url' => get_permalink($download_id),
                'product_image' => $this->edd_product_image_url_with_placeholder($download_id),
                'rating' => get_comment_meta($review->comment_ID, 'rating', true),
                'review_text' => wp_trim_words($review->comment_content, 20),
            ];
        }
        return [];
    }

    private function get_surecart_sale_notification()
    {
        if (!class_exists('\SureCart\Models\Order')) {
            return [];
        }

        try {
            $orders = \SureCart\Models\Order::where([
                'status' => ['paid', 'processing']
            ])->with(['checkout.customer', 'checkout.purchases', 'checkout.purchases.product'])->paginate([
                'per_page' => 20,
                'page' => 1,
            ]);
        } catch (\Throwable $e) {
            return [];
        }

        $order_list = $this->surecart_extract_collection($orders);
        if (empty($order_list)) {
            return [];
        }

        shuffle($order_list);

        foreach ($order_list as $order) {
            if (!is_object($order)) {
                continue;
            }

            $checkout = isset($order->checkout) && is_object($order->checkout) ? $order->checkout : null;
            if (!$checkout) {
                continue;
            }

            $purchases = $this->surecart_extract_collection($checkout->purchases ?? []);
            if (empty($purchases)) {
                continue;
            }

            $purchase = is_object($purchases[0]) ? $purchases[0] : null;
            $product = ($purchase && isset($purchase->product) && is_object($purchase->product)) ? $purchase->product : null;
            if (!$product) {
                continue;
            }

            $product_name = isset($product->name) ? (string) $product->name : '';
            if ($product_name === '') {
                continue;
            }

            $post_id = isset($product->post) && is_object($product->post) && !empty($product->post->ID)
                ? (int) $product->post->ID
                : 0;
            $customer_name = '';
            if (isset($checkout->customer) && is_object($checkout->customer)) {
                $customer_name = (string) ($checkout->customer->name ?? $checkout->customer->email ?? '');
            }
            $image_url = $post_id > 0 ? get_the_post_thumbnail_url($post_id, 'thumbnail') : '';

            return [
                'type' => 'sale',
                'customer_name' => $customer_name,
                'product_name' => $product_name,
                'time' => !empty($order->created_at) ? gmdate('M d, Y g:i A', strtotime((string) $order->created_at)) : '',
                'product_url' => $post_id > 0 ? get_permalink($post_id) : (string) ($product->permalink ?? ''),
                'product_image' => $image_url ?: '',
            ];
        }

        return [];
    }

    private function get_surecart_download_notification()
    {
        return $this->get_surecart_sale_notification();
    }

    private function get_surecart_review_notification()
    {
        $reviews = get_comments([
            'status' => 'approve',
            'number' => 20,
            'orderby' => 'date',
            'order' => 'DESC',
            'post_type' => 'sc_product',
        ]);

        if (empty($reviews)) {
            return [];
        }

        shuffle($reviews);

        foreach ($reviews as $review) {
            $product_id = (int) $review->comment_post_ID;
            if (get_post_type($product_id) !== 'sc_product') {
                continue;
            }

            return [
                'type' => 'review',
                'customer_name' => $review->comment_author,
                'product_name' => get_the_title($product_id),
                'time' => gmdate('M d, Y g:i A', strtotime($review->comment_date_gmt)),
                'product_url' => get_permalink($product_id),
                'product_image' => get_the_post_thumbnail_url($product_id, 'thumbnail') ?: '',
                'rating' => get_comment_meta($review->comment_ID, 'rating', true),
                'review_text' => wp_trim_words($review->comment_content, 20),
            ];
        }

        return [];
    }

    private function surecart_extract_collection($value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_wp_error($value) || !is_object($value)) {
            return [];
        }
        $raw = null;
        if (method_exists($value, 'getAttribute')) {
            $raw = $value->getAttribute('data');
        }
        if (!is_array($raw)) {
            $raw = $value->data ?? null;
        }

        return is_array($raw) ? $raw : [];
    }
}