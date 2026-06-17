<?php

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_Commerce_Adapter_Registry
{
	private $helpmate;

	public function __construct($helpmate)
	{
		$this->helpmate = $helpmate;
	}

	public function get_adapter(string $provider)
	{
		if ($provider === 'easy_digital_downloads') {
			return new Helpmate_Commerce_EDD_Adapter($this->helpmate);
		}
		if ($provider === 'woocommerce') {
			return new Helpmate_Commerce_WooCommerce_Adapter($this->helpmate);
		}
		if ($provider === 'surecart') {
			return new Helpmate_Commerce_SureCart_Adapter($this->helpmate);
		}
		return null;
	}
}
