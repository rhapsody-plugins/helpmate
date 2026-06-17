<?php
/**
 * WCFM Marketplace multivendor integration helpers (optional).
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_WCFM
 */
class Helpmate_WCFM {

	/**
	 * Helpmate instance.
	 *
	 * @var Helpmate
	 */
	private $helpmate;

	/**
	 * Constructor.
	 *
	 * @param Helpmate $helpmate Helpmate instance.
	 */
	public function __construct( $helpmate ) {
		$this->helpmate = $helpmate;
	}

	/**
	 * Whether WCFM runtime is loaded and helper APIs are available.
	 *
	 * @return bool
	 */
	public function is_active() {
		return class_exists( 'WCFMmp', false )
			&& function_exists( 'wcfm_get_vendor_id_by_post' )
			&& function_exists( 'wcfm_get_vendor_store_name' );
	}

	/**
	 * Merged wcfm_integration settings with defaults.
	 *
	 * @return array{show_vendor_in_orders_tab:bool,show_vendor_in_training_products:bool,show_vendor_in_product_lists:bool}
	 */
	public function get_integration_settings() {
		$defaults = array(
			'show_vendor_in_orders_tab'        => false,
			'show_vendor_in_training_products' => false,
			'show_vendor_in_product_lists'     => false,
		);
		$settings = $this->helpmate->get_settings()->get_setting( 'wcfm_integration' );
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}
		return array_merge( $defaults, $settings );
	}

	/**
	 * Whether vendor enrichment for CRM orders is enabled.
	 *
	 * @return bool
	 */
	public function should_enrich_orders() {
		if ( ! $this->is_active() ) {
			return false;
		}
		$s = $this->get_integration_settings();
		return ! empty( $s['show_vendor_in_orders_tab'] );
	}

	/**
	 * Whether vendor enrichment for product lists is enabled.
	 *
	 * @return bool
	 */
	public function should_enrich_product_lists() {
		if ( ! $this->is_active() ) {
			return false;
		}
		$s = $this->get_integration_settings();
		return ! empty( $s['show_vendor_in_product_lists'] );
	}

	/**
	 * REST overview for integrations UI.
	 *
	 * @return array{active:bool,vendor_count:int}
	 */
	public function get_rest_status() {
		if ( ! $this->is_active() ) {
			return array(
				'active'       => false,
				'vendor_count' => 0,
			);
		}
		return array(
			'active'       => true,
			'vendor_count' => count( $this->get_vendor_user_ids() ),
		);
	}

	/**
	 * Vendor user ids from role + capability checks.
	 *
	 * @return int[]
	 */
	public function get_vendor_user_ids() {
		$ids = array();
		$raw = get_users(
			array(
				'role'   => 'wcfm_vendor',
				'fields' => 'ID',
				'number' => -1,
			)
		);
		if ( is_array( $raw ) ) {
			foreach ( $raw as $user_id ) {
				$user_id = absint( $user_id );
				if ( $user_id <= 0 ) {
					continue;
				}
				if ( function_exists( 'wcfm_is_vendor' ) && ! wcfm_is_vendor( $user_id ) ) {
					continue;
				}
				$ids[] = $user_id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Vendor list for REST filters.
	 *
	 * @return array<int, array{id:int, store_name:string, email:string}>
	 */
	public function get_vendors_for_rest() {
		$out = array();
		if ( ! $this->is_active() ) {
			return $out;
		}

		foreach ( $this->get_vendor_user_ids() as $user_id ) {
			$user = get_userdata( $user_id );
			if ( ! $user ) {
				continue;
			}
			$out[] = array(
				'id'         => (int) $user_id,
				'store_name' => $this->get_store_name_for_vendor( $user_id ),
				'email'      => (string) $user->user_email,
			);
		}

		usort(
			$out,
			function ( $a, $b ) {
				return strcasecmp( $a['store_name'], $b['store_name'] );
			}
		);

		return $out;
	}

	/**
	 * Store display name for vendor id.
	 *
	 * @param int $vendor_id Vendor user id.
	 * @return string
	 */
	public function get_store_name_for_vendor( $vendor_id ) {
		$vendor_id = absint( $vendor_id );
		if ( $vendor_id <= 0 ) {
			return '';
		}
		if ( function_exists( 'wcfm_get_vendor_store_name' ) ) {
			$name = wcfm_get_vendor_store_name( $vendor_id );
			if ( is_string( $name ) && '' !== trim( $name ) ) {
				return $name;
			}
		}
		$user = get_userdata( $vendor_id );
		return $user ? (string) $user->display_name : '';
	}

	/**
	 * Resolve vendor for Woo product.
	 *
	 * @param int $product_id Product post id.
	 * @return int
	 */
	public function resolve_vendor_id_for_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return 0;
		}

		if ( function_exists( 'wcfm_get_vendor_id_by_post' ) ) {
			$vendor_id = absint( wcfm_get_vendor_id_by_post( $product_id ) );
			if ( $vendor_id > 0 ) {
				return $vendor_id;
			}
		}

		$author_id = (int) get_post_field( 'post_author', $product_id );
		if ( $author_id > 0 && function_exists( 'wcfm_is_vendor' ) && wcfm_is_vendor( $author_id ) ) {
			return $author_id;
		}

		return 0;
	}

	/**
	 * Build vendor display data for Woo order line items.
	 *
	 * @param WC_Order $order Woo order object.
	 * @return array{vendor_summary:string,vendor_lines:array<int, array{product_label:string,vendor_store_name:string,vendor_id:int}>}
	 */
	public function get_vendor_display_for_order( $order ) {
		$result = array(
			'vendor_summary' => '',
			'vendor_lines'   => array(),
		);
		if ( ! $this->is_active() || ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
			return $result;
		}

		$items   = $order->get_items( 'line_item' );
		$vendors = array();
		$lines   = array();
		foreach ( $items as $item ) {
			if ( ! is_object( $item ) ) {
				continue;
			}
			$product_id = method_exists( $item, 'get_product_id' ) ? (int) $item->get_product_id() : 0;
			$vendor_id  = $this->resolve_vendor_id_for_product( $product_id );
			$store_name = $this->get_store_name_for_vendor( $vendor_id );
			if ( $vendor_id > 0 && '' !== $store_name ) {
				$vendors[ $vendor_id ] = $store_name;
			}
			$label = method_exists( $item, 'get_name' ) ? (string) $item->get_name() : '';
			$lines[] = array(
				'product_label'     => $label,
				'vendor_store_name' => $store_name,
				'vendor_id'         => $vendor_id,
			);
		}

		$result['vendor_lines']   = $lines;
		$result['vendor_summary'] = implode( ', ', array_values( array_unique( array_filter( array_values( $vendors ) ) ) ) );
		return $result;
	}

	/**
	 * Map WCFM vendor profile into CRM payload.
	 *
	 * @param WP_User $user User.
	 * @return array<string, mixed>|null
	 */
	public function map_user_to_vendor_contact_data( WP_User $user ) {
		$email = sanitize_email( (string) $user->user_email );
		if ( '' === $email ) {
			return null;
		}

		$profile = get_user_meta( $user->ID, 'wcfmmp_profile_settings', true );
		$profile = is_array( $profile ) ? $profile : array();

		$store_name = $this->scalar_text( isset( $profile['store_name'] ) ? $profile['store_name'] : '' );
		$first      = '';
		$last       = '';
		if ( '' !== $store_name ) {
			$parts = preg_split( '/\s+/', trim( $store_name ), 2 );
			$first = isset( $parts[0] ) ? $parts[0] : '';
			$last  = isset( $parts[1] ) ? $parts[1] : '';
		}
		if ( '' === $first && '' === $last ) {
			$first = $this->scalar_text( $user->first_name );
			$last  = $this->scalar_text( $user->last_name );
		}
		if ( '' === $first && '' === $last ) {
			$first = $this->scalar_text( $user->display_name );
		}

		$phone = $this->scalar_text( isset( $profile['phone'] ) ? $profile['phone'] : '' );

		$addr1   = '';
		$addr2   = '';
		$city    = '';
		$state   = '';
		$zip     = '';
		$country = '';
		if ( isset( $profile['address'] ) && is_array( $profile['address'] ) ) {
			$address = $profile['address'];
			$addr1   = $this->scalar_text( isset( $address['street_1'] ) ? $address['street_1'] : '' );
			$addr2   = $this->scalar_text( isset( $address['street_2'] ) ? $address['street_2'] : '' );
			$city    = $this->scalar_text( isset( $address['city'] ) ? $address['city'] : '' );
			$state   = $this->scalar_text( isset( $address['state'] ) ? $address['state'] : '' );
			$zip     = $this->scalar_text( isset( $address['zip'] ) ? $address['zip'] : '' );
			$country = $this->scalar_text( isset( $address['country'] ) ? $address['country'] : '' );
		}

		return array(
			'email'          => $email,
			'first_name'     => $first,
			'last_name'      => $last,
			'phone'          => $phone,
			'address_line_1' => $addr1,
			'address_line_2' => $addr2,
			'city'           => $city,
			'state'          => $state,
			'zip_code'       => $zip,
			'country'        => $country,
			'wp_user_id'     => (int) $user->ID,
			'status'         => 'subscribed',
		);
	}

	/**
	 * Sync all WCFM vendors into CRM.
	 *
	 * @return array{created:int,updated:int,skipped_no_email:int,errors:array<int, array{email:string,message:string}>}
	 */
	public function sync_all_vendors_to_crm() {
		$summary = array(
			'created'          => 0,
			'updated'          => 0,
			'skipped_no_email' => 0,
			'errors'           => array(),
		);
		if ( ! $this->is_active() ) {
			return $summary;
		}

		$crm = $this->helpmate->get_crm();
		foreach ( $this->get_vendor_user_ids() as $user_id ) {
			$user = get_userdata( $user_id );
			if ( ! $user instanceof WP_User ) {
				continue;
			}
			$data = $this->map_user_to_vendor_contact_data( $user );
			if ( null === $data ) {
				++$summary['skipped_no_email'];
				continue;
			}
			$result = $crm->upsert_contact_from_wcfm_vendor( $data );
			if ( is_wp_error( $result ) ) {
				$summary['errors'][] = array(
					'email'   => $data['email'],
					'message' => $result->get_error_message(),
				);
				continue;
			}
			if ( ! empty( $result['created'] ) ) {
				++$summary['created'];
			} elseif ( ! empty( $result['updated'] ) ) {
				++$summary['updated'];
			}
			$crm->add_contact_sync_source( (int) $result['id'], 'wcfm' );
		}

		return $summary;
	}

	/**
	 * Append vendor fields to a Woo discounted-product row when enabled.
	 *
	 * @param array<string, mixed> $row      Product row.
	 * @param int                  $post_id  Product post id.
	 * @return array<string, mixed>
	 */
	public function maybe_enrich_product_row( array $row, $post_id ) {
		if ( ! $this->should_enrich_product_lists() ) {
			return $row;
		}
		$vendor_id = $this->resolve_vendor_id_for_product( (int) $post_id );
		$row['vendor_id']         = $vendor_id;
		$row['vendor_store_name'] = $vendor_id > 0 ? $this->get_store_name_for_vendor( $vendor_id ) : '';
		return $row;
	}

	/**
	 * Normalize unknown scalar to safe text field.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private function scalar_text( $value ) {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}
		return sanitize_text_field( (string) $value );
	}
}
