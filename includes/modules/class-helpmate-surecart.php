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
		$block = $this->get_training_product_block($post_id);
		return $block ?? array();
	}

	/**
	 * Build SureCart product block for training metadata and get_product_info.
	 *
	 * @param int $post_id sc_product post ID.
	 * @return array<string, mixed>|null
	 */
	public function get_training_product_block(int $post_id): ?array
	{
		if (get_post_type($post_id) !== 'sc_product') {
			return null;
		}

		$summary = $this->format_product_summary($post_id);
		if (!$summary) {
			return null;
		}

		$product = $this->get_product_meta_object($post_id);
		$pricing = $this->extract_product_pricing($product);

		$block = array_merge($summary, array(
			'sku' => (string) get_post_meta($post_id, '_sku', true),
			'description' => (string) get_post_field('post_content', $post_id),
			'short_description' => (string) get_post_field('post_excerpt', $post_id),
			'categories' => array(),
			'tags' => array(),
			'type' => 'surecart_product',
			'is_in_stock' => !empty($product->in_stock),
			'average_rating' => (float) ($product->average_rating ?? 0),
			'rating_count' => (int) ($product->total_reviews ?? 0),
			'regular_price_raw' => $pricing['regular_raw'],
			'sale_price_raw' => $pricing['sale_raw'],
		));

		return Helpmate_Product_Variant_Normalizer::apply_to_block($block, $this->get_product_variant_data($post_id));
	}

	/**
	 * Normalized variant rows for SureCart variants and multi-price products.
	 *
	 * @param int $post_id sc_product post ID.
	 * @return array{has_variants:bool,variants:array<int,array<string,mixed>>,price_range:array<string,string>|null}
	 */
	public function get_product_variant_data(int $post_id): array
	{
		$sc_product = function_exists('sc_get_product') ? sc_get_product($post_id) : null;
		if ($sc_product) {
			return $this->get_variant_data_from_surecart_model($sc_product);
		}

		return $this->get_variant_data_from_meta_object($this->get_product_meta_object($post_id));
	}

	/**
	 * @param object $product SureCart Product model or decoded meta object.
	 * @return array{has_variants:bool,variants:array<int,array<string,mixed>>,price_range:array<string,string>|null}
	 */
	private function get_variant_data_from_surecart_model($product): array
	{
		$variants = array();
		$amounts = array();

		$variant_list = array();
		if (isset($product->variants) && is_object($product->variants) && !empty($product->variants->data)) {
			$variant_list = $product->variants->data;
		} elseif (isset($product->variants->data)) {
			$variant_list = $product->variants->data;
		}

		if (is_array($variant_list) && !empty($variant_list)) {
			foreach ($variant_list as $variant) {
				$row = $this->map_surecart_variant_row($variant);
				if ($row) {
					$variants[] = $row;
					$amount = $this->surecart_amount_to_float($variant->amount ?? 0);
					if ($amount > 0) {
						$amounts[] = $amount;
					}
				}
			}
		}

		if (empty($variants) && method_exists($product, 'getWithSortedPrices')) {
			$sorted = $product->getWithSortedPrices();
			$prices = isset($sorted->prices->data) ? $sorted->prices->data : array();
			foreach ($prices as $price) {
				if (!empty($price->archived)) {
					continue;
				}
				$row = $this->map_surecart_price_row($price);
				if ($row) {
					$variants[] = $row;
					$amount = $this->surecart_amount_to_float($price->amount ?? 0);
					if ($amount > 0) {
						$amounts[] = $amount;
					}
				}
			}
		} elseif (empty($variants) && !empty($product->active_prices) && is_array($product->active_prices)) {
			foreach ($product->active_prices as $price) {
				$row = $this->map_surecart_price_row($price);
				if ($row) {
					$variants[] = $row;
					$amount = $this->surecart_amount_to_float($price->amount ?? 0);
					if ($amount > 0) {
						$amounts[] = $amount;
					}
				}
			}
		}

		return $this->build_variant_result($variants, $amounts, $product);
	}

	/**
	 * @param object $product Decoded post meta product object.
	 * @return array{has_variants:bool,variants:array<int,array<string,mixed>>,price_range:array<string,string>|null}
	 */
	private function get_variant_data_from_meta_object(object $product): array
	{
		$variants = array();
		$amounts = array();

		$variant_data = null;
		if (isset($product->variants) && is_object($product->variants) && isset($product->variants->data)) {
			$variant_data = $product->variants->data;
		} elseif (isset($product->variants) && is_array($product->variants)) {
			$variant_data = $product->variants;
		}

		if (is_array($variant_data)) {
			foreach ($variant_data as $variant) {
				$variant_obj = is_array($variant) ? (object) $variant : $variant;
				$row = $this->map_surecart_variant_row($variant_obj);
				if ($row) {
					$variants[] = $row;
					$amount = $this->surecart_amount_to_float($variant_obj->amount ?? 0);
					if ($amount > 0) {
						$amounts[] = $amount;
					}
				}
			}
		}

		$prices_data = null;
		if (isset($product->prices) && is_object($product->prices) && isset($product->prices->data)) {
			$prices_data = $product->prices->data;
		}

		if (empty($variants) && is_array($prices_data)) {
			foreach ($prices_data as $price) {
				$price_obj = is_array($price) ? (object) $price : $price;
				if (!empty($price_obj->archived)) {
					continue;
				}
				$row = $this->map_surecart_price_row($price_obj);
				if ($row) {
					$variants[] = $row;
					$amount = $this->surecart_amount_to_float($price_obj->amount ?? 0);
					if ($amount > 0) {
						$amounts[] = $amount;
					}
				}
			}
		}

		return $this->build_variant_result($variants, $amounts, $product);
	}

	/**
	 * @param array<int, array<string, mixed>> $variants Normalized rows.
	 * @param array<int, float>                $amounts  Numeric amounts for range.
	 * @param object                           $product  Product model or meta.
	 * @return array{has_variants:bool,variants:array<int,array<string,mixed>>,price_range:array<string,string>|null}
	 */
	private function build_variant_result(array $variants, array $amounts, object $product): array
	{
		if (count($variants) <= 1 && empty($amounts)) {
			return array(
				'has_variants' => false,
				'variants' => array(),
				'price_range' => null,
			);
		}

		$currency = 'USD';
		if (isset($product->initial_price) && is_object($product->initial_price) && !empty($product->initial_price->currency)) {
			$currency = (string) $product->initial_price->currency;
		} elseif (isset($product->metrics->currency)) {
			$currency = (string) $product->metrics->currency;
		}
		$symbol = $this->currency_symbol($currency);

		$price_range = null;
		if (!empty($amounts)) {
			$min = min($amounts);
			$max = max($amounts);
			$price_range = array(
				'min' => $symbol . number_format($min, 2, '.', ''),
				'max' => $symbol . number_format($max, 2, '.', ''),
			);
		}

		return array(
			'has_variants' => count($variants) > 1,
			'variants' => $variants,
			'price_range' => $price_range,
		);
	}

	/**
	 * @param mixed $variant SureCart variant object.
	 * @return array<string, mixed>|null
	 */
	private function map_surecart_variant_row($variant): ?array
	{
		if (!is_object($variant)) {
			return null;
		}

		$label_parts = array_filter(array(
			isset($variant->option_1) ? (string) $variant->option_1 : '',
			isset($variant->option_2) ? (string) $variant->option_2 : '',
			isset($variant->option_3) ? (string) $variant->option_3 : '',
		));
		$label = !empty($label_parts) ? implode(' / ', $label_parts) : (string) ($variant->id ?? '');

		$amount = $this->surecart_amount_to_float($variant->amount ?? 0);
		$currency = (string) ($variant->currency ?? 'USD');
		$symbol = $this->currency_symbol($currency);
		$display = !empty($variant->display_amount)
			? (string) $variant->display_amount
			: ($amount > 0 ? $symbol . number_format($amount, 2, '.', '') : '');

		$in_stock = true;
		if (isset($variant->available_stock)) {
			$in_stock = (int) $variant->available_stock > 0 || (string) $variant->available_stock === 'unlimited';
		} elseif (isset($variant->in_stock)) {
			$in_stock = !empty($variant->in_stock);
		}

		return Helpmate_Product_Variant_Normalizer::row(array(
			'id' => (string) ($variant->id ?? ''),
			'label' => $label,
			'sku' => (string) ($variant->sku ?? ''),
			'price' => $display,
			'regular_price' => (string) $amount,
			'sale_price' => (string) $amount,
			'stock_status' => $in_stock ? 'in_stock' : 'out_of_stock',
			'stock_quantity' => isset($variant->available_stock) && is_numeric($variant->available_stock)
				? (int) $variant->available_stock
				: null,
			'in_stock' => $in_stock,
			'attributes' => array(),
			'image' => '',
		));
	}

	/**
	 * @param mixed $price SureCart price object.
	 * @return array<string, mixed>|null
	 */
	private function map_surecart_price_row($price): ?array
	{
		if (!is_object($price)) {
			return null;
		}

		$amount = $this->surecart_amount_to_float($price->amount ?? 0);
		$currency = (string) ($price->currency ?? 'USD');
		$symbol = $this->currency_symbol($currency);
		$display = $amount > 0 ? $symbol . number_format($amount, 2, '.', '') : '';
		$label = (string) ($price->name ?? $price->id ?? '');

		return Helpmate_Product_Variant_Normalizer::row(array(
			'id' => (string) ($price->id ?? ''),
			'label' => $label,
			'sku' => '',
			'price' => $display,
			'regular_price' => (string) $amount,
			'sale_price' => (string) $amount,
			'stock_status' => 'in_stock',
			'stock_quantity' => null,
			'in_stock' => true,
			'attributes' => array(),
			'image' => '',
		));
	}

	/**
	 * Convert SureCart amount (cents) to float dollars.
	 *
	 * @param mixed $amount Raw amount.
	 * @return float
	 */
	private function surecart_amount_to_float($amount): float
	{
		$value = (float) $amount;
		if ($value <= 0) {
			return 0.0;
		}
		return $value / 100;
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

	/**
	 * Sync SureCart live-mode customers into CRM (one-way, email keyed).
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

		if (
			!class_exists('\SureCart\Models\Customer') ||
			!class_exists('\SureCart\Models\User') ||
			!$this->helpmate ||
			!method_exists($this->helpmate, 'get_crm')
		) {
			return $summary;
		}

		$crm = $this->helpmate->get_crm();
		$limit = 5000;
		$processed = 0;
		$page = 1;
		$per_page = 200;
		$max_pages = 100;

		while ($processed < $limit && $page <= $max_pages) {
			$page_result = \SureCart\Models\Customer::where(
				array(
					'live_mode' => true,
				)
			)->paginate(
				array(
					'per_page' => $per_page,
					'page' => $page,
				)
			);

			if (is_wp_error($page_result)) {
				$summary['errors'][] = array(
					'email' => '',
					'message' => $page_result->get_error_message(),
				);
				break;
			}

			$list = $this->extract_surecart_paginate_list($page_result);
			if (empty($list)) {
				break;
			}

			foreach ($list as $customer) {
				if ($processed >= $limit) {
					$summary['truncated'] = true;
					break 2;
				}
				++$processed;

				$data = $this->map_surecart_customer_to_contact_data($customer);
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
				$crm->add_contact_sync_source((int) $result['id'], 'surecart');
			}

			if (count($list) < $per_page) {
				break;
			}
			++$page;
		}

		return $summary;
	}

	/**
	 * Extract customer rows from SureCart paginate response.
	 *
	 * @param mixed $page_result SureCart collection response.
	 * @return array<int, mixed>
	 */
	private function extract_surecart_paginate_list($page_result): array
	{
		if (is_array($page_result)) {
			return $page_result;
		}
		if (!is_object($page_result)) {
			return array();
		}
		$raw = null;
		if (method_exists($page_result, 'getAttribute')) {
			$raw = $page_result->getAttribute('data');
		}
		if (!is_array($raw) && isset($page_result->data)) {
			$raw = $page_result->data;
		}
		return is_array($raw) ? $raw : array();
	}

	/**
	 * Map SureCart customer fields to CRM payload.
	 *
	 * @param mixed $customer SureCart customer model.
	 * @return array<string, mixed>|null
	 */
	private function map_surecart_customer_to_contact_data($customer): ?array
	{
		if (!is_object($customer)) {
			return null;
		}

		$email = sanitize_email((string) ($customer->email ?? ''));
		if ('' === $email) {
			return null;
		}

		$first = sanitize_text_field((string) ($customer->first_name ?? ''));
		$last = sanitize_text_field((string) ($customer->last_name ?? ''));
		if ('' === $first && '' === $last) {
			$name = sanitize_text_field((string) ($customer->name ?? ''));
			if ('' !== $name) {
				$parts = preg_split('/\s+/', trim($name));
				if (is_array($parts) && !empty($parts)) {
					$first = sanitize_text_field((string) array_shift($parts));
					$last = sanitize_text_field((string) implode(' ', $parts));
				}
			}
		}

		$phone = sanitize_text_field((string) ($customer->phone ?? ''));
		$address = is_object($customer->billing_address ?? null) ? $customer->billing_address : (object) array();

		$wp_user_id = 0;
		if (!empty($customer->id)) {
			$sc_user = \SureCart\Models\User::findByCustomerId((string) $customer->id);
			if ($sc_user && method_exists($sc_user, 'getWPUser')) {
				$wp_user = $sc_user->getWPUser();
				if ($wp_user instanceof \WP_User) {
					$wp_user_id = (int) $wp_user->ID;
				}
			}
		}

		return array(
			'email' => $email,
			'first_name' => $first,
			'last_name' => $last,
			'phone' => $phone,
			'address_line_1' => sanitize_text_field((string) ($address->address ?? $address->line1 ?? '')),
			'address_line_2' => sanitize_text_field((string) ($address->address_2 ?? $address->line2 ?? '')),
			'city' => sanitize_text_field((string) ($address->city ?? '')),
			'state' => sanitize_text_field((string) ($address->state ?? '')),
			'zip_code' => sanitize_text_field((string) ($address->postal_code ?? $address->zip ?? '')),
			'country' => sanitize_text_field((string) ($address->country ?? '')),
			'wp_user_id' => $wp_user_id,
			'status' => 'subscribed',
		);
	}
}
