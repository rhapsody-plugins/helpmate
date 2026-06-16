<?php

/**
 * Normalized variant rows shared across commerce providers.
 *
 * @package Helpmate
 */

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_Product_Variant_Normalizer
{
	/**
	 * Build a normalized variant row.
	 *
	 * @param array<string, mixed> $args Expected keys: id, label, sku, price, regular_price, sale_price, stock_status, stock_quantity, in_stock, attributes, image.
	 * @return array<string, mixed>
	 */
	public static function row(array $args): array
	{
		return array(
			'id' => $args['id'] ?? '',
			'label' => (string) ($args['label'] ?? ''),
			'sku' => (string) ($args['sku'] ?? ''),
			'price' => (string) ($args['price'] ?? ''),
			'regular_price' => (string) ($args['regular_price'] ?? ''),
			'sale_price' => (string) ($args['sale_price'] ?? ''),
			'stock_status' => (string) ($args['stock_status'] ?? ''),
			'stock_quantity' => isset($args['stock_quantity']) ? $args['stock_quantity'] : null,
			'in_stock' => !empty($args['in_stock']),
			'attributes' => is_array($args['attributes'] ?? null) ? $args['attributes'] : array(),
			'image' => (string) ($args['image'] ?? ''),
		);
	}

	/**
	 * Merge variant fields onto a product block.
	 *
	 * @param array<string, mixed> $block Product/download/surecart block.
	 * @param array<string, mixed> $variant_data has_variants, variants, price_range.
	 * @return array<string, mixed>
	 */
	public static function apply_to_block(array $block, array $variant_data): array
	{
		$block['has_variants'] = !empty($variant_data['has_variants']);
		$block['variants'] = is_array($variant_data['variants'] ?? null) ? $variant_data['variants'] : array();
		if (!empty($variant_data['price_range']) && is_array($variant_data['price_range'])) {
			$block['price_range'] = $variant_data['price_range'];
		}
		return $block;
	}

	/**
	 * Plain-text variant summary for embedding (placed before JSON metadata).
	 *
	 * @param array<string, mixed> $block Product block with variants.
	 * @return string
	 */
	public static function format_variants_text(array $block): string
	{
		if (empty($block['has_variants']) || empty($block['variants']) || !is_array($block['variants'])) {
			return '';
		}

		$lines = array('Variants:');
		foreach ($block['variants'] as $variant) {
			if (!is_array($variant)) {
				continue;
			}
			$label = (string) ($variant['label'] ?? '');
			$price = (string) ($variant['regular_price'] ?? '');
			if ($price === '') {
				$sale_price = (string) ($variant['sale_price'] ?? '');
				$price = $sale_price !== '' ? $sale_price : wp_strip_all_tags((string) ($variant['price'] ?? ''));
			}
			$sku = (string) ($variant['sku'] ?? '');
			$stock = (string) ($variant['stock_status'] ?? '');
			$qty = $variant['stock_quantity'] ?? null;
			$stock_qty = ($qty !== null && $qty !== '') ? (string) $qty : '';

			$parts = array_filter(array($label, $price !== '' ? 'Price: ' . $price : '', $sku !== '' ? 'SKU: ' . $sku : ''));
			if ($stock !== '') {
				$parts[] = 'Stock: ' . $stock . ($stock_qty !== '' ? ' (' . $stock_qty . ')' : '');
			}
			if (!empty($parts)) {
				$lines[] = '- ' . implode(', ', $parts);
			}
		}

		return count($lines) > 1 ? implode("\n", $lines) . "\n\n" : '';
	}

	/**
	 * Plain-text attribute summary for embedding (parent-level options not shown on variant rows).
	 *
	 * @param array<string, mixed> $block Product block with attributes.
	 * @return string
	 */
	public static function format_attributes_text(array $block): string
	{
		if (empty($block['attributes']) || !is_array($block['attributes'])) {
			return '';
		}

		$segments = array();
		foreach ($block['attributes'] as $attr_key => $attr) {
			if (!is_array($attr)) {
				continue;
			}
			$options = $attr['options'] ?? array();
			if (!is_array($options) || empty($options)) {
				continue;
			}
			$option_labels = array_values(array_filter(array_map('strval', $options)));
			if (empty($option_labels)) {
				continue;
			}
			$display_name = !empty($attr['label'])
				? (string) $attr['label']
				: (string) ($attr['name'] ?? $attr_key);
			$segments[] = $display_name . ': ' . implode(', ', $option_labels);
		}

		if (empty($segments)) {
			return '';
		}

		return 'Attributes: ' . implode('; ', $segments) . "\n\n";
	}

	/**
	 * Locate the commerce product block inside training metadata.
	 *
	 * @param array<string, mixed> $metadata Wrapper metadata.
	 * @return array<string, mixed>|null
	 */
	public static function find_product_block(array $metadata): ?array
	{
		foreach (array('product', 'download', 'surecart_product') as $key) {
			if (!empty($metadata[ $key ]) && is_array($metadata[ $key ])) {
				return $metadata[ $key ];
			}
		}
		return null;
	}
}
