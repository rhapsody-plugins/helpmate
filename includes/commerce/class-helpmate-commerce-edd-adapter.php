<?php

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_Commerce_EDD_Adapter implements CommerceProviderAdapter
{
	private $helpmate;

	public function __construct($helpmate)
	{
		$this->helpmate = $helpmate;
	}

	public function get_provider_key(): string
	{
		return 'easy_digital_downloads';
	}

	public function list_products(string $keywords = '', int $limit = 10): array
	{
		return $this->helpmate->get_edd()->get_products_by_keywords($keywords, $limit);
	}

	public function get_product(int $product_id): ?array
	{
		$product = $this->helpmate->get_edd()->get_product_info($product_id);
		return is_array($product) ? $product : null;
	}

	public function list_orders_by_contact(array $contact): array
	{
		return [];
	}

	public function get_order_by_id(string $order_id): ?array
	{
		return null;
	}

	public function list_coupons(): array
	{
		return [];
	}
}
