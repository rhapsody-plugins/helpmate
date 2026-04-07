<?php

/**
 * Easy Digital Downloads integration helper.
 *
 * @package Helpmate
 */

if (!defined('ABSPATH')) {
    exit;
}

class Helpmate_EDD
{
    /**
     * Settings handler.
     *
     * @var Helpmate_Settings
     */
    private $settings;
    /**
     * Core plugin instance.
     *
     * @var Helpmate|null
     */
    private $helpmate;

    public function __construct($settings, $helpmate = null)
    {
        $this->settings = $settings;
        $this->helpmate = $helpmate;
    }

    /**
     * Get EDD downloads by keyword.
     */
    public function get_products_by_keywords(string $keywords, int $limit = 10): array
    {
        $search = sanitize_text_field($keywords);
        if ($search === '') {
            return [];
        }

        $query = new WP_Query([
            'post_type' => 'download',
            'post_status' => 'publish',
            'posts_per_page' => $limit,
            's' => $search,
            'orderby' => 'date',
            'order' => 'DESC',
        ]);

        $results = [];
        foreach ($query->posts as $post) {
            $results[] = $this->format_download_summary($post->ID);
        }

        return array_values(array_filter($results));
    }

    /**
     * Get EDD download details.
     */
    public function get_product_info(int $product_id): ?array
    {
        if (get_post_type($product_id) !== 'download') {
            return null;
        }
        return $this->format_download_details($product_id);
    }

    /**
     * Show downloads payload for chat.
     */
    public function show_products($params): string
    {
        $recent = !empty($params['recent']);
        $discounted = !empty($params['discounted']);

        $query = new WP_Query([
            'post_type' => 'download',
            'post_status' => 'publish',
            'posts_per_page' => 10,
            'orderby' => $recent ? 'date' : 'title',
            'order' => 'DESC',
        ]);

        $products = [];
        foreach ($query->posts as $post) {
            $details = $this->format_download_summary($post->ID);
            if (!$details) {
                continue;
            }
            if ($discounted && empty($details['is_on_sale'])) {
                continue;
            }
            $products[] = $details;
        }

        if (empty($products)) {
            return json_encode([
                'type' => 'text',
                'text' => 'No products found related to the keywords you provided',
            ]);
        }

        return json_encode([
            'type' => 'product-carousel',
            'text' => 'Here are some products that matches your query:',
            'data' => ['products' => $products],
        ]);
    }

    /**
     * Show downloads by keywords payload for chat.
     */
    public function show_products_by_keywords($params): string
    {
        $keywords = isset($params['keywords']) ? (string) $params['keywords'] : '';
        $products = $this->get_products_by_keywords($keywords, 10);
        return json_encode([
            'type' => 'product-carousel',
            'text' => 'Here are the products related to the keywords you provided:',
            'data' => ['products' => $products],
        ]);
    }

    /**
     * On-sale downloads for admin proactive sales (Woo-shaped rows for REST).
     *
     * @return array<int, array<string, mixed>>
     */
    public function get_discounted_downloads_for_admin(): array
    {
        if (!function_exists('edd_get_download_price')) {
            return [];
        }

        $query = new WP_Query([
            'post_type' => 'download',
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
            'fields' => 'ids',
            'no_found_rows' => true,
        ]);

        $products = [];
        foreach ($query->posts as $post_id) {
            $post_id = (int) $post_id;
            $title = get_the_title($post_id);
            if (!$title) {
                continue;
            }

            $pricing = $this->get_download_pricing($post_id);
            if (empty($pricing['is_on_sale'])) {
                continue;
            }

            $regular = $pricing['regular'];
            $sale = $pricing['sale'];
            $discount_pct = $regular > 0
                ? (int) round((($regular - $sale) / $regular) * 100)
                : 0;

            $image_url = get_the_post_thumbnail_url($post_id, 'full');
            if (empty($image_url)) {
                $image_url = $this->get_product_placeholder_url();
            }

            $categories = wp_get_post_terms($post_id, 'download_category', ['fields' => 'names']);

            $products[] = [
                'id' => $post_id,
                'name' => $title,
                'regular_price' => $this->format_edd_price($regular),
                'sale_price' => $this->format_edd_price($sale),
                'discount_percentage' => $discount_pct,
                'stock_status' => 'instock',
                'stock_quantity' => null,
                'image_url' => $image_url,
                'categories' => is_wp_error($categories) ? [] : $categories,
                'date_on_sale_from' => '',
                'date_on_sale_to' => '',
                'type' => 'download',
                'sku' => (string) get_post_meta($post_id, '_sku', true),
            ];
        }

        return $products;
    }

    /**
     * Public URL for the product placeholder image.
     */
    public function get_product_placeholder_url(): string
    {
        if (defined('HELPMATE_URL')) {
            return HELPMATE_URL . 'assets/images/product-placeholder.svg';
        }

        return '';
    }

    /**
     * Regular / sale amounts and on-sale flag (matches chat carousel logic).
     *
     * @return array{regular: float, sale: float, is_on_sale: bool}
     */
    private function get_download_pricing(int $post_id): array
    {
        $regular = function_exists('edd_get_download_price')
            ? (float) edd_get_download_price($post_id)
            : 0.0;
        $sale = function_exists('edd_get_lowest_price_option')
            ? (float) edd_get_lowest_price_option($post_id)
            : $regular;

        return [
            'regular' => $regular,
            'sale' => $sale,
            'is_on_sale' => $sale < $regular,
        ];
    }

    /**
     * Format amount for display (admin HTML column).
     */
    private function format_edd_price(float $amount): string
    {
        if (function_exists('edd_currency_filter') && function_exists('edd_format_amount')) {
            return edd_currency_filter(edd_format_amount($amount));
        }

        return (string) $amount;
    }

    private function format_download_summary(int $post_id): ?array
    {
        $title = get_the_title($post_id);
        if (!$title) {
            return null;
        }

        $pricing = $this->get_download_pricing($post_id);
        $price = $pricing['regular'];
        $sale_price = $pricing['sale'];

        $image_url = get_the_post_thumbnail_url($post_id, 'medium');
        if (empty($image_url)) {
            $image_url = $this->get_product_placeholder_url();
        }

        return [
            'id' => $post_id,
            'name' => $title,
            'price' => $this->format_edd_price($price),
            'regular_price' => (string) $price,
            'sale_price' => (string) $sale_price,
            'permalink' => get_permalink($post_id),
            'image' => $image_url,
            'stock_status' => 'in_stock',
            'is_on_sale' => $pricing['is_on_sale'],
            'currency_symbol' => function_exists('edd_currency_filter') ? edd_currency_filter('') : '',
        ];
    }

    private function format_download_details(int $post_id): array
    {
        $summary = $this->format_download_summary($post_id);
        if (!$summary) {
            return [];
        }

        return array_merge($summary, [
            'sku' => get_post_meta($post_id, '_sku', true),
            'description' => (string) get_post_field('post_content', $post_id),
            'short_description' => (string) get_post_field('post_excerpt', $post_id),
            'categories' => wp_get_post_terms($post_id, 'download_category', ['fields' => 'names']),
            'tags' => wp_get_post_terms($post_id, 'download_tag', ['fields' => 'names']),
            'type' => 'download',
        ]);
    }

    /**
     * Sync EDD customers into CRM (one-way, email keyed).
     *
     * @return array{created:int,updated:int,skipped_no_email:int,truncated:bool,errors:array<int, array{email:string,message:string}>}
     */
    public function sync_all_customers_to_crm(): array
    {
        $summary = array(
            'created' => 0,
            'updated' => 0,
            'skipped_no_email' => 0,
            'truncated' => false,
            'errors' => array(),
        );

        if (!function_exists('edd_get_customers') || !$this->helpmate || !method_exists($this->helpmate, 'get_crm')) {
            return $summary;
        }

        $crm = $this->helpmate->get_crm();
        $limit = 5000;
        $processed = 0;
        $offset = 0;
        $batch_size = 200;

        while ($processed < $limit) {
            $remaining = $limit - $processed;
            $number = min($batch_size, $remaining);
            $customers = edd_get_customers(array(
                'number' => $number,
                'offset' => $offset,
                'orderby' => 'id',
                'order' => 'ASC',
            ));

            if (empty($customers) || !is_array($customers)) {
                break;
            }

            foreach ($customers as $customer) {
                if ($processed >= $limit) {
                    $summary['truncated'] = true;
                    break 2;
                }
                ++$processed;

                $data = $this->map_edd_customer_to_contact_data($customer);
                if (null === $data) {
                    ++$summary['skipped_no_email'];
                    continue;
                }

                $result = $crm->upsert_contact_from_commerce_sync($data);
                if (is_wp_error($result)) {
                    $summary['errors'][] = array(
                        'email' => $data['email'],
                        'message' => $result->get_error_message(),
                    );
                    continue;
                }
                if (!empty($result['created'])) {
                    ++$summary['created'];
                } elseif (!empty($result['updated'])) {
                    ++$summary['updated'];
                }
            }

            $offset += count($customers);
            if (count($customers) < $number) {
                break;
            }
        }

        return $summary;
    }

    /**
     * Map EDD customer fields to CRM payload.
     *
     * @param mixed $customer EDD_Customer row/model.
     * @return array<string, mixed>|null
     */
    private function map_edd_customer_to_contact_data($customer): ?array
    {
        if (!is_object($customer)) {
            return null;
        }

        $email = sanitize_email((string) ($customer->email ?? ''));
        if ('' === $email) {
            return null;
        }

        $name = sanitize_text_field((string) ($customer->name ?? ''));
        $first = '';
        $last = '';
        if ('' !== $name) {
            $parts = preg_split('/\s+/', trim($name));
            if (is_array($parts) && !empty($parts)) {
                $first = sanitize_text_field((string) array_shift($parts));
                $last = sanitize_text_field((string) implode(' ', $parts));
            }
        }

        return array(
            'email' => $email,
            'first_name' => $first,
            'last_name' => $last,
            'phone' => '',
            'address_line_1' => '',
            'address_line_2' => '',
            'city' => '',
            'state' => '',
            'zip_code' => '',
            'country' => '',
            'wp_user_id' => isset($customer->user_id) ? (int) $customer->user_id : 0,
            'status' => 'subscribed',
        );
    }
}
