<?php
/**
 * Plugin overview, install, and activate helpers for the Integrations admin UI.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Integration_Plugins
 */
class Helpmate_Integration_Plugins {

	/**
	 * Registry: id => [ 'candidates' => string[], 'wp_org_slug' => string|null, 'is_core' => bool ].
	 *
	 * @return array<string, array{candidates?: string[], wp_org_slug?: string|null, is_core?: bool}>
	 */
	private static function get_definitions() {
		return array(
			'cf7'                   => array(
				'candidates'    => array( 'contact-form-7/wp-contact-form-7.php' ),
				'wp_org_slug'   => 'contact-form-7',
			),
			'forminator'            => array(
				'candidates'    => array( 'forminator/forminator.php' ),
				'wp_org_slug'   => 'forminator',
			),
			'ninja_forms'           => array(
				'candidates'    => array( 'ninja-forms/ninja-forms.php' ),
				'wp_org_slug'   => 'ninja-forms',
			),
			'wpforms'               => array(
				'candidates'    => array( 'wpforms/wpforms.php', 'wpforms-lite/wpforms.php' ),
				'wp_org_slug'   => 'wpforms-lite',
			),
			'formidable_forms'      => array(
				'candidates'    => array( 'formidable/formidable.php', 'formidable-forms/formidable.php' ),
				'wp_org_slug'   => 'formidable',
			),
			'woocommerce'           => array(
				'candidates'    => array( 'woocommerce/woocommerce.php' ),
				'wp_org_slug'   => 'woocommerce',
			),
			'easy_digital_downloads' => array(
				'candidates'    => array( 'easy-digital-downloads/easy-digital-downloads.php' ),
				'wp_org_slug'   => 'easy-digital-downloads',
			),
			'surecart'              => array(
				'candidates'    => array( 'surecart/surecart.php' ),
				'wp_org_slug'   => 'surecart',
			),
			'dokan'                 => array(
				'candidates'    => array(
					'dokan-lite/dokan.php',
					'dokan-pro/dokan-pro.php',
				),
				'wp_org_slug'   => 'dokan-lite',
			),
			'wcfm'                  => array(
				'candidates'    => array(
					'wc-multivendor-marketplace/wc-multivendor-marketplace.php',
				),
				'wp_org_slug'   => 'wc-multivendor-marketplace',
			),
			'learnpress'            => array(
				'candidates'    => array(
					'learnpress/learnpress.php',
				),
				'wp_org_slug'   => 'learnpress',
			),
			'tutor'                 => array(
				'candidates'    => array(
					'tutor/tutor.php',
				),
				'wp_org_slug'   => 'tutor',
			),
			'lifterlms'            => array(
				'candidates'    => array(
					'lifterlms/lifterlms.php',
				),
				'wp_org_slug'   => 'lifterlms',
			),
			'ultimate_member'      => array(
				'candidates'    => array(
					'ultimate-member/ultimate-member.php',
				),
				'wp_org_slug'   => 'ultimate-member',
			),
			'members'             => array(
				'candidates'    => array(
					'members/members.php',
					'members-pro/members.php',
					'members-pro/members-pro.php',
				),
				'wp_org_slug'   => 'members',
			),
			'user_registration'   => array(
				'candidates'    => array(
					'user-registration/user-registration.php',
					'user-registration-pro/user-registration.php',
					'user-registration-pro/user-registration-pro.php',
				),
				'wp_org_slug'   => 'user-registration',
			),
			'elementor'             => array(
				'candidates'    => array( 'elementor/elementor.php' ),
				'wp_org_slug'   => 'elementor',
			),
			'beaver_builder'        => array(
				'candidates'    => array(
					'beaver-builder-lite-version/fl-builder.php',
					'bb-plugin/fl-builder.php',
				),
				'wp_org_slug'   => 'beaver-builder-lite',
			),
			'gutenberg'             => array(
				'is_core'       => true,
				'candidates'    => array(),
				'wp_org_slug'   => null,
			),
		);
	}

	/**
	 * Load plugin API helpers.
	 *
	 * @return void
	 */
	private static function ensure_plugin_functions_loaded() {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
	}

	/**
	 * Whether a plugin is active on this site or network-wide.
	 *
	 * @param string $plugin_file Plugin basename.
	 * @return bool
	 */
	private static function is_effectively_active( $plugin_file ) {
		self::ensure_plugin_functions_loaded();
		if ( is_plugin_active( $plugin_file ) ) {
			return true;
		}
		if ( is_multisite() && function_exists( 'is_plugin_active_for_network' ) && is_plugin_active_for_network( $plugin_file ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Resolve present file and flags for one registry entry.
	 *
	 * @param array{candidates?: string[], is_core?: bool} $def Definition row.
	 * @return array{present: bool, active: bool, plugin_file: ?string}
	 */
	private static function resolve_entry( $def ) {
		if ( ! empty( $def['is_core'] ) ) {
			return array(
				'present'      => true,
				'active'       => true,
				'plugin_file'  => null,
			);
		}
		self::ensure_plugin_functions_loaded();
		$all = get_plugins();
		foreach ( $def['candidates'] as $candidate ) {
			if ( isset( $all[ $candidate ] ) ) {
				return array(
					'present'      => true,
					'active'       => self::is_effectively_active( $candidate ),
					'plugin_file'  => $candidate,
				);
			}
		}
		return array(
			'present'      => false,
			'active'       => false,
			'plugin_file'  => null,
		);
	}

	/**
	 * REST: full overview for Integrations page.
	 *
	 * @return WP_REST_Response
	 */
	public function rest_plugin_overview() {
		$defs  = self::get_definitions();
		$out   = array();
		foreach ( $defs as $id => $def ) {
			$resolved = self::resolve_entry( $def );
			$out[ $id ] = array(
				'present'      => $resolved['present'],
				'active'       => $resolved['active'],
				'plugin_file'  => $resolved['plugin_file'],
				'wp_org_slug'  => isset( $def['wp_org_slug'] ) ? $def['wp_org_slug'] : null,
				'is_core'      => ! empty( $def['is_core'] ),
			);
		}
		return new WP_REST_Response(
			array(
				'error'         => false,
				'capabilities'  => array(
					'install_plugins'   => current_user_can( 'install_plugins' ),
					'activate_plugins'  => current_user_can( 'activate_plugins' ),
				),
				'plugins'       => $out,
			),
			200
		);
	}

	/**
	 * All plugin basenames we may activate (Helpmate integrations only).
	 *
	 * @return string[]
	 */
	private static function get_allowed_plugin_basenames() {
		$allowed = array();
		foreach ( self::get_definitions() as $def ) {
			if ( ! empty( $def['is_core'] ) ) {
				continue;
			}
			foreach ( $def['candidates'] as $c ) {
				$allowed[] = $c;
			}
		}
		return array_values( array_unique( $allowed ) );
	}

	/**
	 * Validate plugin basename: safe characters and in allowlist and installed.
	 *
	 * @param string $plugin Plugin basename.
	 * @return true|WP_Error
	 */
	private static function validate_activate_target( $plugin ) {
		if ( ! is_string( $plugin ) || '' === $plugin ) {
			return new WP_Error( 'invalid_plugin', __( 'Invalid plugin.', 'helpmate-ai-chatbot' ) );
		}
		if ( strlen( $plugin ) > 200 || false !== strpos( $plugin, '..' ) || false !== strpos( $plugin, "\0" ) ) {
			return new WP_Error( 'invalid_plugin', __( 'Invalid plugin.', 'helpmate-ai-chatbot' ) );
		}
		if ( ! preg_match( '/^[a-zA-Z0-9][a-zA-Z0-9_-]*\/[a-zA-Z0-9._-]+\.php$/', $plugin ) ) {
			return new WP_Error( 'invalid_plugin', __( 'Invalid plugin.', 'helpmate-ai-chatbot' ) );
		}
		$allowed = self::get_allowed_plugin_basenames();
		if ( ! in_array( $plugin, $allowed, true ) ) {
			return new WP_Error( 'invalid_plugin', __( 'This plugin cannot be activated from Helpmate.', 'helpmate-ai-chatbot' ) );
		}
		self::ensure_plugin_functions_loaded();
		$all = get_plugins();
		if ( ! isset( $all[ $plugin ] ) ) {
			return new WP_Error( 'not_installed', __( 'Plugin is not installed.', 'helpmate-ai-chatbot' ) );
		}
		return true;
	}

	/**
	 * REST: activate a plugin.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function rest_activate_plugin( $request ) {
		$plugin = $request->get_param( 'plugin' );
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => __( 'You are not allowed to activate plugins.', 'helpmate-ai-chatbot' ),
				),
				403
			);
		}
		$valid = self::validate_activate_target( $plugin );
		if ( is_wp_error( $valid ) ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => $valid->get_error_message(),
				),
				400
			);
		}
		self::ensure_plugin_functions_loaded();
		$result = activate_plugin( $plugin );
		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => $result->get_error_message(),
				),
				500
			);
		}
		return new WP_REST_Response(
			array(
				'error'    => false,
				'success'  => true,
				'plugin'   => $plugin,
			),
			200
		);
	}

	/**
	 * Map wp.org slug to registry id.
	 *
	 * @param string $slug Slug.
	 * @return string|null
	 */
	private static function integration_id_from_install_slug( $slug ) {
		foreach ( self::get_definitions() as $id => $def ) {
			if ( ! empty( $def['is_core'] ) ) {
				continue;
			}
			if ( isset( $def['wp_org_slug'] ) && $def['wp_org_slug'] === $slug ) {
				return $id;
			}
		}
		return null;
	}

	/**
	 * REST: install plugin from wordpress.org.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function rest_install_plugin( $request ) {
		if ( ! current_user_can( 'install_plugins' ) ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => __( 'You are not allowed to install plugins.', 'helpmate-ai-chatbot' ),
				),
				403
			);
		}
		$slug = sanitize_key( (string) $request->get_param( 'slug' ) );
		if ( '' === $slug ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => __( 'Invalid slug.', 'helpmate-ai-chatbot' ),
				),
				400
			);
		}
		$integration_id = self::integration_id_from_install_slug( $slug );
		if ( null === $integration_id ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => __( 'Unknown plugin slug.', 'helpmate-ai-chatbot' ),
				),
				400
			);
		}
		if ( defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => __( 'File modifications are disabled on this site.', 'helpmate-ai-chatbot' ),
				),
				400
			);
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/class-plugin-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';

		$api = plugins_api(
			'plugin_information',
			array(
				'slug'   => $slug,
				'fields' => array(
					'sections' => false,
				),
			)
		);
		if ( is_wp_error( $api ) ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => $api->get_error_message(),
				),
				500
			);
		}
		if ( empty( $api->download_link ) ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => __( 'No download URL for this plugin.', 'helpmate-ai-chatbot' ),
				),
				500
			);
		}

		$skin     = new Automatic_Upgrader_Skin();
		$upgrader = new Plugin_Upgrader( $skin );
		$result   = $upgrader->install( $api->download_link );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => $result->get_error_message(),
				),
				500
			);
		}
		if ( false === $result ) {
			return new WP_REST_Response(
				array(
					'error'   => true,
					'message' => __( 'Installation failed.', 'helpmate-ai-chatbot' ),
				),
				500
			);
		}

		if ( function_exists( 'wp_clean_plugins_cache' ) ) {
			wp_clean_plugins_cache();
		}

		self::ensure_plugin_functions_loaded();
		$defs     = self::get_definitions();
		$def      = $defs[ $integration_id ];
		$resolved = self::resolve_entry( $def );
		$installed_file = $resolved['plugin_file'];

		return new WP_REST_Response(
			array(
				'error'                  => false,
				'success'                => true,
				'slug'                   => $slug,
				'installed_plugin_file'  => $installed_file,
			),
			200
		);
	}
}
