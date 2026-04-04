<?php

if (!defined('ABSPATH')) {
	exit;
}

interface CommerceProviderAdapter
{
	public function get_provider_key(): string;

	public function list_products(string $keywords = '', int $limit = 10): array;

	public function get_product(int $product_id): ?array;

	public function list_orders_by_contact(array $contact): array;

	public function get_order_by_id(string $order_id): ?array;

	public function list_coupons(): array;
}
