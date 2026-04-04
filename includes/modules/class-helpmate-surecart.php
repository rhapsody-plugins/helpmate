<?php

/**
 * SureCart integration helper.
 *
 * @package Helpmate
 */

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_SureCart
{
	/**
	 * Settings handler.
	 *
	 * @var Helpmate_Settings
	 */
	private $settings;

	public function __construct($settings)
	{
		$this->settings = $settings;
	}

	public function get_products_by_keywords(string $keywords, int $limit = 10): array
	{
		$search = sanitize_text_field($keywords);
		if ($search === '') {
			return [];
		}

		$query = new WP_Query([
			'post_type' => 'sc_product',
			'post_status' => 'publish',
			'posts_per_page' => $limit,
			's' => $search,
			'orderby' => 'date',
			'order' => 'DESC',
		]);

		$results = [];
		foreach ($query->posts as $post) {
			$results[] = $this->format_product_summary((int) $post->ID);
		}

		return array_values(array_filter($results));
	}

	public function get_product_info(int $product_id): ?array
	{
		if (get_post_type($product_id) !== 'sc_product') {
			return null;
		}

		return $this->format_product_details($product_id);
	}

	/**
	 * Show products payload for chat (parity with Woo/EDD tool shape).
	 */
	public function show_products($params): string
	{
		$recent = !empty($params['recent']);
		$discounted = !empty($params['discounted']);

		$query = new WP_Query([
			'post_type' => 'sc_product',
			'post_status' => 'publish',
			'posts_per_page' => 10,
			'orderby' => $recent ? 'date' : 'title',
			'order' => 'DESC',
		]);

		$products = [];
		foreach ($query->posts as $post) {
			$details = $this->format_product_summary((int) $post->ID);
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
	 * Show products by keywords payload for chat.
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
	 * On-sale products for admin proactive sales (Woo-shaped rows for REST).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_discounted_products_for_admin(): array
	{
		$query = new WP_Query([
			'post_type' => 'sc_product',
			'post_status' => 'publish',
			'posts_per_page' => -1,
			'orderby' => 'date',
			'order' => 'DESC',
			'fields' => 'ids',
			'no_found_rows' => true,
		]);

		$products = [];
		foreach ($query->posts as $post_id) {
			$details = $this->format_product_details((int) $post_id);
			if (empty($details) || empty($details['is_on_sale'])) {
				continue;
			}

			$regular = (float) ($details['regular_price_raw'] ?? 0);
			$sale = (float) ($details['sale_price_raw'] ?? 0);
			$discount_pct = $regular > 0 ? (int) round((($regular - $sale) / $regular) * 100) : 0;

			$products[] = [
				'id' => (int) $post_id,
				'name' => (string) ($details['name'] ?? ''),
				'regular_price' => (string) ($details['regular_price'] ?? ''),
				'sale_price' => (string) ($details['sale_price'] ?? ''),
				'discount_percentage' => $discount_pct,
				'stock_status' => (string) ($details['stock_status'] ?? 'in_stock'),
				'stock_quantity' => null,
				'image_url' => (string) ($details['image'] ?? ''),
				'categories' => [],
				'date_on_sale_from' => '',
				'date_on_sale_to' => '',
				'type' => 'surecart_product',
				'sku' => (string) ($details['sku'] ?? ''),
			];
		}

		return $products;
	}

	private function format_product_summary(int $post_id): ?array
	{
		$title = get_the_title($post_id);
		if (!$title) {
			return null;
		}

		$product = $this->get_product_meta_object($post_id);
		$pricing = $this->extract_product_pricing($product);
		$image_url = get_the_post_thumbnail_url($post_id, 'medium');

		return [
			'id' => $post_id,
			'name' => $title,
			'price' => $pricing['display_price'],
			'regular_price' => $pricing['regular_display'],
			'sale_price' => $pricing['sale_display'],
			'permalink' => get_permalink($post_id),
			'image' => $image_url ?: '',
			'stock_status' => !empty($product->in_stock) ? 'in_stock' : 'out_of_stock',
			'is_on_sale' => $pricing['is_on_sale'],
			'currency_symbol' => (string) ($pricing['currency_symbol'] ?? '$'),
		];
	}

	private function format_product_details(int $post_id): array
	{
		$summary = $this->format_product_summary($post_id);
		if (!$summary) {
			return [];
		}

		$product = $this->get_product_meta_object($post_id);
		$pricing = $this->extract_product_pricing($product);

		return array_merge($summary, [
			'sku' => (string) get_post_meta($post_id, '_sku', true),
			'description' => (string) get_post_field('post_content', $post_id),
			'short_description' => (string) get_post_field('post_excerpt', $post_id),
			'categories' => [],
			'tags' => [],
			'type' => 'surecart_product',
			'is_in_stock' => !empty($product->in_stock),
			'average_rating' => (float) ($product->average_rating ?? 0),
			'rating_count' => (int) ($product->total_reviews ?? 0),
			'regular_price_raw' => $pricing['regular_raw'],
			'sale_price_raw' => $pricing['sale_raw'],
		]);
	}

	private function get_product_meta_object(int $post_id): object
	{
		$product_meta = get_post_meta($post_id, 'product', true);
		if (is_string($product_meta)) {
			$decoded = json_decode($product_meta);
			if (is_object($decoded)) {
				return $decoded;
			}
		}
		if (is_array($product_meta)) {
			return (object) $product_meta;
		}
		if (is_object($product_meta)) {
			return $product_meta;
		}
		return (object) [];
	}

	/**
	 * @return array{regular_raw: float, sale_raw: float, regular_display: string, sale_display: string, display_price: string, is_on_sale: bool, currency_symbol: string}
	 */
	private function extract_product_pricing(object $product): array
	{
		$product_array = (array) $product;
		$initial_price = isset($product->initial_price) && is_object($product->initial_price) ? $product->initial_price : (object) [];
		$metrics = isset($product->metrics) && is_object($product->metrics) ? $product->metrics : (object) [];
		$metrics_currency = isset($metrics->currency) ? (string) $metrics->currency : '';
		$metrics_min_amount = isset($metrics->min_price_amount) ? (float) $metrics->min_price_amount : null;
		$metrics_max_amount = isset($metrics->max_price_amount) ? (float) $metrics->max_price_amount : null;
		$display_amount = isset($product_array['display_amount']) ? (string) $product_array['display_amount'] : '';
		$range_display_amount = isset($product_array['range_display_amount']) ? (string) $product_array['range_display_amount'] : '';
		$currency = (string) ($initial_price->currency ?? ($metrics_currency !== '' ? $metrics_currency : 'USD'));
		$currency_symbol = $this->currency_symbol($currency);

		$regular_raw = isset($initial_price->scratch_amount) ? ((float) $initial_price->scratch_amount / 100) : 0.0;
		$sale_raw = isset($initial_price->amount) ? ((float) $initial_price->amount / 100) : 0.0;

		// Fallback for synced SureCart post meta where initial_price/prices are missing.
		if ($sale_raw <= 0 && $metrics_min_amount !== null && $metrics_min_amount > 0) {
			$sale_raw = $metrics_min_amount / 100;
		}
		if ($regular_raw <= 0 && $metrics_max_amount !== null && $metrics_max_amount > 0) {
			$regular_raw = $metrics_max_amount / 100;
		}

		// Final fallback for synced SureCart payloads that only contain display strings.
		if ($sale_raw <= 0 && $display_amount !== '') {
			$sale_raw = $this->parse_price_string_to_float($display_amount);
		}
		if ($regular_raw <= 0 && $range_display_amount !== '') {
			$regular_raw = $this->parse_last_price_from_range($range_display_amount);
		}
		if ($regular_raw <= 0 && $sale_raw > 0) {
			$regular_raw = $sale_raw;
		}
		$is_on_sale = !empty($initial_price->is_on_sale) || ($regular_raw > 0 && $sale_raw > 0 && $sale_raw < $regular_raw);

		if (!$is_on_sale) {
			$regular_raw = $sale_raw;
		}

		$regular_display = $currency_symbol . number_format($regular_raw, 2, '.', '');
		$sale_display = $currency_symbol . number_format($sale_raw, 2, '.', '');

		return [
			'regular_raw' => $regular_raw,
			'sale_raw' => $sale_raw,
			'regular_display' => $regular_display,
			'sale_display' => $sale_display,
			'display_price' => $is_on_sale ? $sale_display : $regular_display,
			'is_on_sale' => $is_on_sale,
			'currency_symbol' => $currency_symbol,
		];
	}

	private function parse_price_string_to_float(string $value): float
	{
		if ($value === '') {
			return 0.0;
		}

		if (preg_match('/-?\d+(?:\.\d+)?/', $value, $matches) === 1) {
			return (float) $matches[0];
		}

		return 0.0;
	}

	private function parse_last_price_from_range(string $value): float
	{
		if ($value === '') {
			return 0.0;
		}

		preg_match_all('/-?\d+(?:\.\d+)?/', $value, $matches);
		if (!empty($matches[0])) {
			$last = end($matches[0]);
			return $last !== false ? (float) $last : 0.0;
		}

		return 0.0;
	}

	private function currency_symbol(string $currency): string
	{
		$map = [
			'USD' => '$',
			'EUR' => 'EUR ',
			'GBP' => 'GBP ',
		];

		return $map[$currency] ?? ($currency . ' ');
	}
}
