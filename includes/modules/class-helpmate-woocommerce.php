<?php

/**
 * The WooCommerce integration class.
 *
 * This class handles all WooCommerce related functionality.
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

class Helpmate_WooCommerce
{

    /**
     * The settings handler instance.
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
    }

    /**
     * Get WooCommerce products by keywords.
     *
     * @since 1.0.0
     * @param string $keywords The search keywords.
     * @param int $limit The maximum number of products to return.
     * @return array Array of product data.
     */
    public function get_products_by_keywords(string $keywords, int $limit = 10): array
    {

        // Split keywords into array and clean them
        $search_terms = array_map('trim', explode(',', $keywords));
        $search_terms = array_filter($search_terms);

        // First, try exact matches
        $exact_args = array(
            'status' => 'publish',
            'limit' => -1, // Get all matching products
            'orderby' => 'relevance',
            'order' => 'DESC',
            'search' => implode(' ', $search_terms),
            'return' => 'objects',
            'search_exact' => true,
            'search_sku' => true,
            'search_attributes' => true,
            'search_custom_fields' => true
        );

        // Then, try partial matches
        $partial_args = array(
            'status' => 'publish',
            'limit' => -1,
            'orderby' => 'relevance',
            'order' => 'DESC',
            'search' => implode(' ', $search_terms),
            'return' => 'objects',
            'search_exact' => false,
            'search_sku' => true,
            'search_attributes' => true,
            'search_custom_fields' => true
        );

        // Get both exact and partial matches
        $exact_products = wc_get_products($exact_args);
        $partial_products = wc_get_products($partial_args);

        // Combine and score products
        $scored_products = array();
        $processed_ids = array();

        // Score exact matches higher
        foreach ($exact_products as $product) {
            $score = $this->calculate_product_relevance_score($product, $search_terms, true);
            $scored_products[$product->get_id()] = array(
                'product' => $product,
                'score' => $score
            );
            $processed_ids[] = $product->get_id();
        }

        // Add partial matches with lower scores
        foreach ($partial_products as $product) {
            if (!in_array($product->get_id(), $processed_ids)) {
                $score = $this->calculate_product_relevance_score($product, $search_terms, false);
                $scored_products[$product->get_id()] = array(
                    'product' => $product,
                    'score' => $score
                );
            }
        }

        // Sort by score
        uasort($scored_products, function ($a, $b) {
            return $b['score'] <=> $a['score'];
        });

        // Take top results
        $scored_products = array_slice($scored_products, 0, $limit, true);

        $formatted_products = array();
        foreach ($scored_products as $scored_product) {
            $product = $scored_product['product'];
            $formatted_products[] = array(
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'price' => $product->get_price_html(),
                'permalink' => $product->get_permalink(),
                'image' => wp_get_attachment_url($product->get_image_id()),
                'stock_status' => $product->get_stock_status(),
                'relevance_score' => $scored_product['score'] // For debugging
            );
        }

        return $formatted_products;
    }

    /**
     * Calculate relevance score for a product based on search terms.
     *
     * @param WC_Product $product The product to score
     * @param array $search_terms Array of search terms
     * @param bool $is_exact Whether this is an exact match
     * @return float The relevance score
     */
    private function calculate_product_relevance_score($product, $search_terms, $is_exact): float
    {
        $score = 0;
        $product_name = strtolower($product->get_name());
        $product_description = strtolower($product->get_description());
        $product_short_description = strtolower($product->get_short_description());

        // Get product categories and tags
        $categories = wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names'));
        $tags = wp_get_post_terms($product->get_id(), 'product_tag', array('fields' => 'names'));

        foreach ($search_terms as $term) {
            $term = strtolower($term);

            // Exact match bonus
            if ($is_exact) {
                $score += 10;
            }

            // Title matches (highest weight)
            if (strpos($product_name, $term) !== false) {
                $score += 5;
            }

            // Category matches
            foreach ($categories as $category) {
                if (strpos(strtolower($category), $term) !== false) {
                    $score += 3;
                }
            }

            // Tag matches
            foreach ($tags as $tag) {
                if (strpos(strtolower($tag), $term) !== false) {
                    $score += 2;
                }
            }

            // Description matches
            if (strpos($product_description, $term) !== false) {
                $score += 1;
            }

            // Short description matches
            if (strpos($product_short_description, $term) !== false) {
                $score += 1;
            }

            // SKU match
            if (strpos(strtolower($product->get_sku()), $term) !== false) {
                $score += 4;
            }
        }

        return $score;
    }

    /**
     * Get WooCommerce product information by ID.
     *
     * @since 1.0.0
     * @param int $product_id The product ID.
     * @return array|null Array of product data or null if product not found.
     */
    public function get_product_info(int $product_id): ?array
    {
        $product = wc_get_product($product_id);

        if (!$product) {
            return null;
        }

        return [
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'price' => $product->get_price_html(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'permalink' => $product->get_permalink(),
            'image' => wp_get_attachment_url($product->get_image_id()),
            'gallery_images' => array_map(function ($image_id) {
                return wp_get_attachment_url($image_id);
            }, $product->get_gallery_image_ids()),
            'stock_status' => $product->get_stock_status(),
            'stock_quantity' => $product->get_stock_quantity(),
            'sku' => $product->get_sku(),
            'description' => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'categories' => wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'names']),
            'tags' => wp_get_post_terms($product->get_id(), 'product_tag', ['fields' => 'names']),
            'attributes' => $product->get_attributes(),
            'is_on_sale' => $product->is_on_sale(),
            'is_in_stock' => $product->is_in_stock(),
            'rating_count' => $product->get_rating_count(),
            'average_rating' => $product->get_average_rating(),
            'type' => $product->get_type()
        ];
    }

    /**
     * Add proactive sales action to product list table.
     *
     * @since    1.0.0
     * @param    array     $actions    The row actions.
     * @param    WP_Post   $post       The post object.
     * @return   array     The modified row actions.
     */

    /**
     * Get detailed product information for the most relevant product matching the keyword.
     *
     * @since 1.0.0
     * @param string $keyword The search keyword.
     * @return array Detailed product information for the most relevant match, or null if no matches found.
     */
    public function get_product_info_by_keyword(string $keyword): ?array
    {
        // Get only the most relevant product
        $products = $this->get_products_by_keywords($keyword, 1);

        if (empty($products)) {
            return [];
        }

        // Get detailed info for the most relevant product
        return $this->get_product_info($products[0]['id']);
    }

    /**
     * Get products based on specified criteria.
     *
     * @since 1.0.0
     * @param bool $recent Whether to show recent products.
     * @param bool $discounted Whether to show discounted products.
     * @return array JSON encoded response with products data.
     */
    public function get_products(bool $recent = false, bool $discounted = false): array
    {
        $args = array(
            'status' => 'publish',
            'limit' => 10,
            'return' => 'objects',
        );

        // Add ordering for recent products
        if ($recent) {
            $args['orderby'] = 'date';
            $args['order'] = 'DESC';
        }

        // Get products
        $products = wc_get_products($args);

        // Filter for discounted products if needed
        if ($discounted) {
            $products = array_filter($products, function ($product) {
                return $product->is_on_sale();
            });
        }

        // Format products for response
        $formatted_products = array();
        foreach ($products as $product) {
            $formatted_products[] = array(
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'price' => $product->get_price_html(),
                'permalink' => $product->get_permalink(),
                'image' => wp_get_attachment_url($product->get_image_id()),
                'stock_status' => $product->get_stock_status(),
                'is_on_sale' => $product->is_on_sale(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'currency_symbol' => get_woocommerce_currency_symbol()
            );
        }

        if (empty($formatted_products)) {
            return [
                'type' => 'no-products',
                'text' => 'No products found related to the keywords you provided'
            ];
        }

        return [
            'type' => $recent ? 'recent-products' : ($discounted ? 'discounted-products' : 'products'),
            'text' => $recent ? 'tell users that you have recent products:' : ($discounted ? 'tell users that you have discounted products:' : 'tell users that you have products:'),
            'data' => array(
                'products' => $formatted_products
            )
        ];
    }

    /**
     * Show products based on specified criteria.
     * If no products are found, return a text message.
     * If products are found, return a product carousel.
     *
     * @since 1.0.0
     * @param array $params The parameters.
     * @return string The products response.
     */
    public function show_products($params)
    {
        $recent = $params['recent'] ?? false;
        $discounted = $params['discounted'] ?? false;

        $products_response = $this->get_products($recent, $discounted);
        if ($products_response['type'] === 'no-products') {
            return json_encode([
                'type' => 'text',
                'text' => $products_response['text']
            ]);
        } else {
            return json_encode([
                'type' => 'product-carousel',
                'text' => $products_response['text'],
                'data' => ['products' => $products_response['data']['products']]
            ]);
        }
    }

    /**
     * Show products based on specified keywords.
     *
     * @since 1.0.0
     * @param array $params The parameters.
     * @return string The products response.
     */
    public function show_products_by_keywords($params)
    {
        $keywords = $params['keywords'] ?? '';
        $products_response = $this->get_products_by_keywords($keywords);
        return json_encode([
            'type' => 'product-carousel',
            'text' => 'Here are the products related to the keywords you provided',
            'data' => ['products' => $products_response]
        ]);
    }

    /**
     * Show product information based on specified keywords.
     * If no product is found, return a text message.
     * If a product is found, return a text message with the product information.
     *
     * @since 1.0.0
     * @param array $params The parameters.
     * @return string The product information response.
     */
    public function show_product_info($params)
    {
        $product_info_response = $this->get_product_info_by_keyword($params['keywords']);
        if (empty($product_info_response)) {
            return json_encode([
                'type' => 'text',
                'text' => 'No product found related to the keywords you provided.'
            ]);
        } else {
            return json_encode([
                'type' => 'text',
                'text' => 'Product information: ' . json_encode($product_info_response)
            ]);
        }
    }
}