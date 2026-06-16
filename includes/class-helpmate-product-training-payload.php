<?php

/**
 * Central builder for product knowledge-base training payloads.
 *
 * @package Helpmate
 */

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_Product_Training_Payload
{
	/**
	 * @var Helpmate
	 */
	private $helpmate;

	public function __construct($helpmate)
	{
		$this->helpmate = $helpmate;
	}

	/**
	 * Build metadata wrapper for a commerce product post (list / preview).
	 *
	 * @param int    $post_id   Post ID.
	 * @param string $post_type Post type (product, download, sc_product).
	 * @return array<string, mixed>|null
	 */
	public function build_metadata_for_post(int $post_id, string $post_type): ?array
	{
		$post = get_post($post_id);
		if (!$post || 'publish' !== $post->post_status) {
			return null;
		}

		$metadata = $this->base_post_metadata($post);

		if ('product' === $post_type && function_exists('wc_get_product')) {
			$block = $this->helpmate->get_woocommerce()->get_training_product_block($post_id);
			if ($block) {
				$metadata['product'] = $block;
			}
		} elseif ('download' === $post_type && method_exists($this->helpmate, 'get_edd')) {
			$block = $this->helpmate->get_edd()->get_training_download_block($post_id);
			if ($block) {
				$metadata['download'] = $block;
			}
		} elseif ('sc_product' === $post_type && method_exists($this->helpmate, 'get_surecart')) {
			$block = $this->helpmate->get_surecart()->get_training_product_block($post_id);
			if ($block) {
				$metadata['surecart_product'] = $block;
			}
		}

		return $metadata;
	}

	/**
	 * Build training document payload (background bulk + formatted content).
	 *
	 * @param int    $post_id   Post ID.
	 * @param string $post_type Post type.
	 * @return array{title:string,content:string,metadata:array<string,mixed>}|null
	 */
	public function build_training_document(int $post_id, string $post_type): ?array
	{
		$post = get_post($post_id);
		if (!$post || 'publish' !== $post->post_status) {
			return null;
		}

		$metadata = $this->build_metadata_for_post($post_id, $post_type);
		if (!$metadata) {
			return null;
		}

		$title_content = $this->resolve_title_and_body($post, $metadata);
		$formatted_content = $this->format_training_content($title_content['body'], $metadata);

		return array(
			'title' => $title_content['title'],
			'content' => $formatted_content,
			'metadata' => $metadata,
		);
	}

	/**
	 * Build a get_posts() list entry for commerce product types.
	 *
	 * @param WP_Post $post Post object.
	 * @return array<string, mixed>|null
	 */
	public function build_post_list_entry(WP_Post $post): ?array
	{
		$metadata = $this->build_metadata_for_post((int) $post->ID, $post->post_type);
		if (!$metadata) {
			return null;
		}

		$title_content = $this->resolve_title_and_body($post, $metadata);

		return array(
			'id' => $post->ID,
			'title' => $title_content['title'],
			'type' => $post->post_type,
			'status' => $post->post_status,
			'date' => $post->post_date,
			'content' => $this->prepend_commerce_summary($title_content['body'], $metadata),
			'author' => get_the_author_meta('display_name', $post->post_author),
			'author_id' => (int) $post->post_author,
			'metadata' => $metadata,
		);
	}

	/**
	 * Prepend human-readable variant and attribute lines for training payloads.
	 *
	 * @param string               $body     Description or post content.
	 * @param array<string, mixed> $metadata Metadata wrapper.
	 * @return string
	 */
	private function prepend_commerce_summary(string $body, array $metadata): string
	{
		$product_block = Helpmate_Product_Variant_Normalizer::find_product_block($metadata);
		if (!$product_block) {
			return $body;
		}

		$summary_parts = array();
		$variant_text = Helpmate_Product_Variant_Normalizer::format_variants_text($product_block);
		if ($variant_text !== '') {
			$summary_parts[] = rtrim($variant_text);
		}
		$attribute_text = Helpmate_Product_Variant_Normalizer::format_attributes_text($product_block);
		if ($attribute_text !== '') {
			$summary_parts[] = rtrim($attribute_text);
		}

		if (empty($summary_parts)) {
			return $body;
		}

		return implode("\n\n", $summary_parts) . "\n\n" . trim($body);
	}

	/**
	 * @param WP_Post $post Post.
	 * @return array<string, mixed>
	 */
	private function base_post_metadata(WP_Post $post): array
	{
		return array(
			'featured_image' => get_the_post_thumbnail_url($post->ID, 'full'),
			'excerpt' => get_the_excerpt($post),
			'modified_date' => $post->post_modified,
			'permalink' => get_permalink($post->ID),
			'categories' => wp_get_post_terms($post->ID, 'category', array('fields' => 'names')),
			'tags' => wp_get_post_terms($post->ID, 'post_tag', array('fields' => 'names')),
		);
	}

	/**
	 * @param WP_Post              $post     Post.
	 * @param array<string, mixed> $metadata Training metadata.
	 * @return array{title:string,body:string}
	 */
	private function resolve_title_and_body(WP_Post $post, array $metadata): array
	{
		if ('product' === $post->post_type && !empty($metadata['product']['name'])) {
			return array(
				'title' => (string) $metadata['product']['name'],
				'body' => !empty($metadata['product']['description'])
					? (string) $metadata['product']['description']
					: (string) $post->post_content,
			);
		}

		if ('download' === $post->post_type && !empty($metadata['download']['name'])) {
			return array(
				'title' => (string) $metadata['download']['name'],
				'body' => (string) $post->post_content,
			);
		}

		if ('sc_product' === $post->post_type && !empty($metadata['surecart_product']['name'])) {
			return array(
				'title' => (string) $metadata['surecart_product']['name'],
				'body' => !empty($metadata['surecart_product']['description'])
					? (string) $metadata['surecart_product']['description']
					: (string) $post->post_content,
			);
		}

		return array(
			'title' => get_the_title($post),
			'body' => (string) $post->post_content,
		);
	}

	/**
	 * Format body + variant summary + JSON metadata for Qdrant embedding.
	 *
	 * @param string               $body     Product description / post content.
	 * @param array<string, mixed> $metadata Full metadata wrapper.
	 * @return string
	 */
	public function format_training_content(string $body, array $metadata): string
	{
		$parts = array();
		$body_with_variants = $this->prepend_commerce_summary($body, $metadata);
		if (trim($body_with_variants) !== '') {
			$parts[] = trim($body_with_variants);
		}
		$parts[] = 'Metadata:';
		$parts[] = wp_json_encode($metadata, JSON_PRETTY_PRINT);

		return implode("\n\n", $parts);
	}
}
