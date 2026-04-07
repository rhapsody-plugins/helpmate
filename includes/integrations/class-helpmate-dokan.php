<?php
/**
 * Dokan multivendor integration helpers (optional; does not alter core Woo flows).
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Dokan
 */
class Helpmate_Dokan {

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
	 * Whether Dokan is loaded (WeDevs Dokan).
	 *
	 * @return bool
	 */
	public function is_active() {
		return class_exists( 'WeDevs_Dokan', false );
	}

	/**
	 * Merged dokan_integration settings with defaults (all booleans default false).
	 *
	 * @return array{show_vendor_in_orders_tab:bool,show_vendor_in_training_products:bool,show_vendor_in_product_lists:bool}
	 */
	public function get_integration_settings() {
		$defaults = array(
			'show_vendor_in_orders_tab'       => false,
			'show_vendor_in_training_products' => false,
			'show_vendor_in_product_lists'    => false,
		);
		$settings = $this->helpmate->get_settings()->get_setting( 'dokan_integration' );
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
	 * Whether discounted / product list payloads may include vendor fields.
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
	 * User IDs with Dokan selling enabled.
	 *
	 * @return int[]
	 */
	public function get_vendor_user_ids() {
		if ( ! $this->is_active() ) {
			return array();
		}

		$query = new WP_User_Query(
			array(
				'fields'     => 'ID',
				'number'     => -1,
				'meta_key'   => 'dokan_enable_selling',
				'meta_value' => 'yes',
			)
		);

		$ids = $query->get_results();
		return array_map( 'absint', is_array( $ids ) ? $ids : array() );
	}

	/**
	 * Vendor list for admin filters (id = WP user id).
	 *
	 * @return array<int, array{id:int, store_name:string, email:string}>
	 */
	public function get_vendors_for_rest() {
		if ( ! $this->is_active() ) {
			return array();
		}

		$out = array();
		$ids = $this->get_vendor_user_ids();

		foreach ( $ids as $user_id ) {
			$user = get_userdata( $user_id );
			if ( ! $user ) {
				continue;
			}
			$email = $user->user_email;
			if ( function_exists( 'dokan_get_store_info' ) ) {
				$store = dokan_get_store_info( $user_id );
				$store = is_array( $store ) ? $store : array();
			} else {
				$store = get_user_meta( $user_id, 'dokan_profile_settings', true );
				$store = is_array( $store ) ? $store : array();
			}
			$store_name = isset( $store['store_name'] ) ? (string) $store['store_name'] : '';
			if ( '' === $store_name ) {
				$store_name = $user->display_name;
			}
			$out[] = array(
				'id'         => (int) $user_id,
				'store_name' => $store_name,
				'email'      => $email,
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
	 * Store display name for a vendor user id.
	 *
	 * @param int $vendor_id WP user ID.
	 * @return string
	 */
	public function get_store_name_for_vendor( $vendor_id ) {
		$vendor_id = absint( $vendor_id );
		if ( $vendor_id <= 0 || ! $this->is_active() ) {
			return '';
		}
		if ( function_exists( 'dokan_get_store_info' ) ) {
			$store = dokan_get_store_info( $vendor_id );
			$store = is_array( $store ) ? $store : array();
		} else {
			$store = get_user_meta( $vendor_id, 'dokan_profile_settings', true );
			$store = is_array( $store ) ? $store : array();
		}
		if ( ! empty( $store['store_name'] ) ) {
			return (string) $store['store_name'];
		}
		$user = get_userdata( $vendor_id );
		return $user ? (string) $user->display_name : '';
	}

	/**
	 * Build vendor rows from a WC_Order (line-item meta; Dokan uses _dokan_vendor_id on items).
	 *
	 * @param WC_Order $order Order object.
	 * @return array{vendor_summary:string,vendor_lines:array<int, array{product_label:string, vendor_store_name:string, vendor_id:int}>}
	 */
	public function get_vendor_display_for_order( $order ) {
		$result = array(
			'vendor_summary' => '',
			'vendor_lines'   => array(),
		);

		if ( ! $this->is_active() || ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
			return $result;
		}

		$items    = $order->get_items( 'line_item' );
		$vendors = array();
		$lines   = array();

		foreach ( $items as $item ) {
			if ( ! is_object( $item ) || ! method_exists( $item, 'get_meta' ) ) {
				continue;
			}
			// Dokan stores vendor id on order line items.
			$vid = $item->get_meta( '_dokan_vendor_id', true );
			if ( '' === $vid || null === $vid ) {
				$vid = $item->get_meta( '_vendor_id', true );
			}
			$vid = absint( $vid );
			if ( $vid <= 0 ) {
				$product_id = $item->get_product_id();
				if ( $product_id ) {
					$vid = (int) get_post_field( 'post_author', $product_id );
				}
			}
			$name = $this->get_store_name_for_vendor( $vid );
			if ( $vid > 0 && '' !== $name ) {
				$vendors[ $vid ] = $name;
			}
			$label = method_exists( $item, 'get_name' ) ? $item->get_name() : '';
			$lines[] = array(
				'product_label'       => (string) $label,
				'vendor_store_name'   => $name,
				'vendor_id'           => $vid,
			);
		}

		$unique_names = array_values( array_unique( array_filter( array_values( $vendors ) ) ) );
		$result['vendor_lines']   = $lines;
		$result['vendor_summary'] = implode( ', ', $unique_names );

		return $result;
	}

	/**
	 * Map a WP_User + Dokan profile to CRM contact fields for sync.
	 *
	 * @param WP_User $user User.
	 * @return array<string, mixed>|null Null if unusable.
	 */
	public function map_user_to_vendor_contact_data( WP_User $user ) {
		$email = sanitize_email( $user->user_email );
		if ( empty( $email ) ) {
			return null;
		}

		if ( function_exists( 'dokan_get_store_info' ) ) {
			$profile = dokan_get_store_info( $user->ID );
			$profile = is_array( $profile ) ? $profile : array();
		} else {
			$profile = get_user_meta( $user->ID, 'dokan_profile_settings', true );
			$profile = is_array( $profile ) ? $profile : array();
		}

		$first = '';
		$last  = '';
		if ( ! empty( $profile['store_name'] ) ) {
			$parts = preg_split( '/\s+/', trim( (string) $profile['store_name'] ), 2 );
			$first = isset( $parts[0] ) ? $parts[0] : '';
			$last  = isset( $parts[1] ) ? $parts[1] : '';
		}
		if ( '' === $first && '' === $last ) {
			$first = $user->first_name;
			$last  = $user->last_name;
		}
		if ( '' === $first && '' === $last ) {
			$first = $user->display_name;
		}

		$phone = isset( $profile['phone'] ) ? sanitize_text_field( (string) $profile['phone'] ) : '';

		$addr1 = '';
		$addr2 = '';
		$city  = '';
		$state = '';
		$zip   = '';
		$country = '';
		if ( ! empty( $profile['address'] ) && is_array( $profile['address'] ) ) {
			$a       = $profile['address'];
			$addr1   = isset( $a['street_1'] ) ? sanitize_text_field( (string) $a['street_1'] ) : '';
			$addr2   = isset( $a['street_2'] ) ? sanitize_text_field( (string) $a['street_2'] ) : '';
			$city    = isset( $a['city'] ) ? sanitize_text_field( (string) $a['city'] ) : '';
			$state   = isset( $a['state'] ) ? sanitize_text_field( (string) $a['state'] ) : '';
			$zip     = isset( $a['zip'] ) ? sanitize_text_field( (string) $a['zip'] ) : '';
			$country = isset( $a['country'] ) ? sanitize_text_field( (string) $a['country'] ) : '';
		}

		$selling = get_user_meta( $user->ID, 'dokan_enable_selling', true );
		$status  = ( 'yes' === $selling ) ? 'subscribed' : 'unsubscribed';

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
			'status'         => $status,
		);
	}

	/**
	 * Sync all Dokan vendors into CRM (one-way).
	 *
	 * @return array{created:int,updated:int,skipped_no_email:int,errors:array<int, array{email:string,message:string}>}
	 */
	public function sync_all_vendors_to_crm() {
		$summary = array(
			'created'           => 0,
			'updated'           => 0,
			'skipped_no_email'  => 0,
			'errors'            => array(),
		);

		if ( ! $this->is_active() ) {
			return $summary;
		}

		$crm = $this->helpmate->get_crm();
		$ids = $this->get_vendor_user_ids();

		foreach ( $ids as $user_id ) {
			$user = get_userdata( $user_id );
			if ( ! $user instanceof WP_User ) {
				continue;
			}
			$data = $this->map_user_to_vendor_contact_data( $user );
			if ( null === $data ) {
				++$summary['skipped_no_email'];
				continue;
			}

			$result = $crm->upsert_contact_from_dokan_vendor( $data );
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
			$crm->add_contact_sync_source( (int) $result['id'], 'dokan' );
		}

		return $summary;
	}

	/**
	 * Append vendor fields to a Woo discounted-product array when enabled.
	 *
	 * @param array<string, mixed> $row   Product row.
	 * @param int                  $post_id Product post ID.
	 * @return array<string, mixed>
	 */
	public function maybe_enrich_product_row( array $row, $post_id ) {
		if ( ! $this->should_enrich_product_lists() ) {
			return $row;
		}
		$author_id = (int) get_post_field( 'post_author', $post_id );
		if ( $author_id <= 0 ) {
			$row['vendor_id']         = 0;
			$row['vendor_store_name'] = '';
			return $row;
		}
		$row['vendor_id']         = $author_id;
		$row['vendor_store_name'] = $this->get_store_name_for_vendor( $author_id );
		return $row;
	}
}
