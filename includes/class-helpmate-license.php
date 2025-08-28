<?php

/**
 * License class for HelpMate plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

/**
 * License class for HelpMate plugin.
 *
 * This class defines all code necessary to run during the plugin's license checks.
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_License
{
    /**
     * The plugin slug.
     *
     * @var string
     */
    private $plugin_slug;
    /**
     * The settings instance.
     *
     * @var HelpMate_Settings
     */
    private $settings;
    /**
     * The license key.
     *
     * @var string
     */
    private $license_key;
    /**
     * The API key.
     *
     * @var string
     */
    private $api_key;
    /**
     * The local credits.
     *
     * @var array
     */
    private $local_credits;
    /**
     * The last sync.
     *
     * @var int
     */
    private $last_sync;
    /**
     * The product slug.
     *
     * @var string
     */
    private $product_slug;
    /**
     * The customer ID.
     *
     * @var string
     */
    private $customer_id;
    /**
     * The validation ID.
     *
     * @var string
     */
    private $validation_id;
    /**
     * The sync interval.
     *
     * @var int
     */
    private $sync_interval = 86400;
    /**
     * The social credits.
     *
     * @var boolean
     */
    private $social_credits;
    /**
     * The signup credits.
     *
     * @var boolean
     */
    private $signup_credits;
    /**
     * The encryption key.
     *
     * @var string
     */
    private $encryption_key;
    /**
     * The license server.
     *
     * @var string
     */
    private $license_server = 'http://localhost:10024';

    /**
     * Constructor
     *
     * @param HelpMate_Settings $settings The settings instance.
     * @param string $plugin_slug The plugin slug.
     */
    public function __construct(HelpMate_Settings $settings, $plugin_slug)
    {
        $this->plugin_slug = $plugin_slug;
        $this->settings = $settings;
        $this->encryption_key = $this->get_encryption_key();
        $this->license_key = $this->get_license_key();
        $this->api_key = $this->get_api_key();
        $this->local_credits = $this->get_local_credits();
        $this->last_sync = $this->get_last_sync();
        $this->product_slug = $this->get_product_slug();
        $this->customer_id = $this->get_customer_id();
        $this->validation_id = $this->get_validation_id();
        $this->social_credits = $this->get_social_credits();
        $this->signup_credits = $this->get_signup_credits();

        // Schedule daily sync if not already scheduled
        if (!wp_next_scheduled('helpmate_daily_sync')) {
            wp_schedule_event(time(), 'daily', 'helpmate_daily_sync');
        }

        // Add sync handler
        add_action('helpmate_daily_sync', array($this, 'sync_with_server'));

        // Add credit check before critical operations
        add_action('helpmate_critical_operation', array($this, 'check_credits_before_operation'));

        // Add license validation on plugin load
        // add_action('plugins_loaded', array($this, 'validate_license_on_load'));
    }

    /**
     * Disable the plugin.
     */
    public function disable_plugin()
    {
        deactivate_plugins('helpmate/helpmate.php');
        add_action('admin_notices', function () {
            echo '<div class="error"><p>' . esc_html__('Helpmate has been disabled due to security concerns. Try to turn on again. If the issue persists, please contact support.', 'helpmate') . '</p></div>';
        });
    }

    /**
     * Get the encryption key.
     *
     * @return string
     */
    private function get_encryption_key(): string
    {
        $key = $this->settings->get_setting('encryption_key');
        if (!$key) {
            // Generate a secure random key using PHP's built-in functions
            $key = bin2hex(random_bytes(32)); // 64 characters (32 bytes)
            $this->settings->set_setting('encryption_key', $key);
        }
        return $key;
    }

    /**
     * Encrypt data.
     *
     * @param array|string $data The data to encrypt.
     * @return array|string
     */
    private function encrypt_data($data)
    {
        if (empty($data))
            return '';
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = openssl_encrypt(json_encode($data), 'aes-256-cbc', $this->encryption_key, 0, $iv);
        return base64_encode($iv . $encrypted);
    }

    /**
     * Decrypt data.
     *
     * @param array|string $encrypted_data The encrypted data.
     * @return array|string
     */
    private function decrypt_data($encrypted_data)
    {
        if (empty($encrypted_data))
            return null;
        $data = base64_decode($encrypted_data);
        $iv_length = openssl_cipher_iv_length('aes-256-cbc');
        $iv = substr($data, 0, $iv_length);
        $encrypted = substr($data, $iv_length);
        $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $this->encryption_key, 0, $iv);
        return json_decode($decrypted, true);
    }

    /**
     * Get the license server.
     *
     * @return string
     */
    public function get_license_server()
    {
        return $this->license_server;
    }

    /**
     * Get the license key.
     *
     * @return string
     */
    public function get_license_key()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['license_key'])) {
            return $this->decrypt_data($license['license_key']);
        }
        return null;
    }

    /**
     * Get the local credits.
     *
     * @return array
     */
    public function get_local_credits()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['credits'])) {
            return $this->decrypt_data($license['credits']);
        }
        return array();
    }

    /**
     * Get the last sync.
     *
     * @return int
     */
    public function get_last_sync()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['last_sync'])) {
            return (int) $this->decrypt_data($license['last_sync']);
        }
        return 0;
    }

    /**
     * Get the API key.
     *
     * @return string
     */
    public function get_api_key()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['api_key'])) {
            return $this->decrypt_data($license['api_key']);
        }
        return null;
    }

    /**
     * Get the product slug.
     *
     * @return string
     */
    public function get_product_slug()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['product_slug'])) {
            return $this->decrypt_data($license['product_slug']);
        }
        return null;
    }

    /**
     * Get the social credits.
     *
     * @return boolean
     */
    public function get_social_credits()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['social_credits'])) {
            return $this->decrypt_data($license['social_credits']) === true;
        }
        return false;
    }

    /**
     * Get the signup credits.
     *
     * @return boolean
     */
    public function get_signup_credits()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['signup_credits'])) {
            return $this->decrypt_data($license['signup_credits']) === true;
        }
        return false;
    }

    /**
     * Get the customer ID.
     *
     * @return string
     */
    public function get_customer_id()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['customer_id'])) {
            return $this->decrypt_data($license['customer_id']);
        }
        return null;
    }

    /**
     * Get the validation ID.
     *
     * @return string
     */
    public function get_validation_id()
    {
        $license = $this->settings->get_setting('license');
        if (isset($license['validation_id'])) {
            return $this->decrypt_data($license['validation_id']);
        }
        return null;
    }

    /**
     * Validate the license on load.
     */
    public function validate_license_on_load()
    {
        if (!$this->license_key) {
            $this->log_security_event('license_missing');
            add_action('admin_notices', function () {
                echo '<div class="error"><p>' . esc_html__('Helpmate requires a valid license key to function. Please enter your license key in the settings.', 'helpmate') . '</p></div>';
            });
            return;
        }

        // Force sync if last sync was more than 24 hours ago
        if (time() - $this->last_sync > $this->sync_interval) {
            $this->sync_with_server();
        }

        // Validate license on every page load
        $validation = $this->rp_validate_plugin_license();
        if (!$validation['valid']) {
            $this->log_security_event('license_validation_failed', array(
                'status' => $validation['status'],
                'message' => $validation['message']
            ));
            add_action('admin_notices', function () use ($validation) {
                echo '<div class="error"><p>' . esc_html($validation['message']) . '</p></div>';
            });
        }
    }

    /**
     * Check the credits before operation.
     *
     * @param string $feature_slug The feature slug.
     * @param int $operation_count The number of operations.
     * @return WP_REST_Response|null Returns WP_REST_Response with error if credits are insufficient, null if credits are sufficient.
     */
    public function check_credits_before_operation($feature_slug, $operation_count = 1)
    {
        if (empty($feature_slug)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Feature slug is required for credit check.', 'helpmate')
            ], 400);
        }

        if ($operation_count < 1) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Operation count must be at least 1.', 'helpmate')
            ], 400);
        }

        // First check if we need to sync
        if (time() - $this->last_sync > $this->sync_interval) {
            $this->sync_with_server();
        }

        // Ensure local_credits is an array
        if (!is_array($this->local_credits)) {
            $this->local_credits = array();
        }

        // Special handling for data_source feature
        if ($feature_slug === 'data_source') {

            // Calculate available credits by subtracting used documents from total credits
            $feature_credits = $this->local_credits[1];

            // Check if we have enough credits for the operation
            if ($feature_credits['credits'] <= $feature_credits['usages'] + $operation_count) {
                $this->log_security_event('insufficient_credits', array(
                    'feature' => $feature_slug,
                    'available' => $feature_credits['credits'],
                    'requested' => $operation_count
                ));
                return new WP_REST_Response([
                    'error' => true,
                    'message' => sprintf(
                        /* translators: 1: Available credits, 2: Requested credits */
                        __('You have reached the maximum number of documents for this feature. Available credits: %1$d, Requested: %2$d. Please purchase more credits to continue.', 'helpmate'),
                        $feature_credits['credits'],
                        $operation_count
                    )
                ], 403);
            }
        } else {

            // Calculate available credits by subtracting used documents from total credits
            $feature_credits = $this->local_credits[0];

            // For other features, check if we have enough credits
            if ($feature_credits['credits'] <= $feature_credits['usages'] + $operation_count) {
                $this->log_security_event('insufficient_credits', array(
                    'feature' => $feature_slug,
                    'available' => $feature_credits['credits'],
                    'requested' => $operation_count
                ));
                return new WP_REST_Response([
                    'error' => true,
                    'message' => sprintf(
                        /* translators: 1: Feature name, 2: Available credits, 3: Requested credits */
                        __('Insufficient credits for feature "%1$s". Available: %2$d, Requested: %3$d. Please purchase more credits to continue.', 'helpmate'),
                        $feature_slug,
                        $feature_credits['credits'],
                        $operation_count
                    )
                ], 403);
            }
        }

        // If credits are getting low for any feature, trigger a sync
        $low_credits = false;
        foreach ($this->local_credits as $credits) {
            if ($credits['credits'] - $credits['usages'] <= 5) {
                $low_credits = true;
                break;
            }
        }
        if ($low_credits) {
            $this->sync_with_server();
        }

        return null; // Return null if credits are sufficient
    }

    /**
     * Sync with the server.
     */
    public function sync_with_server()
    {
        if (!$this->license_key) {
            return;
        }

        $validation = $this->rp_validate_plugin_license();

        if ($validation['valid']) {
            // Update local credits with server values
            $previous_settings = $this->settings->get_setting('license');
            $previous_settings['last_sync'] = $this->encrypt_data(time());
            $previous_settings['product_slug'] = $this->encrypt_data($this->product_slug);
            $previous_settings['credits'] = $this->encrypt_data($validation['credits']);
            $previous_settings['api_key'] = $this->encrypt_data($validation['api_key']);
            $previous_settings['signup_credits'] = $this->encrypt_data($validation['signup_credits']);
            $previous_settings['social_credits'] = $this->encrypt_data($validation['social_credits']);
            if (isset($validation['validation_id'])) {
                $previous_settings['validation_id'] = $this->encrypt_data($validation['validation_id']);
                $this->validation_id = $validation['validation_id'];
            }
            $this->settings->set_setting('license', $previous_settings);
        } else {
            $this->log_security_event('license_sync_failed', array(
                'status' => $validation['status'],
                'message' => $validation['message']
            ));
        }
    }

    /**
     * Helper function for client plugins to register for a free license
     */
    public function rp_register_free_license($plugin_slug)
    {
        $domain = wp_parse_url(get_site_url(), PHP_URL_HOST);

        $response = wp_remote_post($this->license_server . '/wp-json/rp/v1/register-free-client', array(
            'body' => array(
                'domain' => $domain,
                'plugin_slug' => $plugin_slug
            )
        ));

        $data = json_decode(wp_remote_retrieve_body($response), true);

        if (isset($data['data']['status']) && $data['data']['status'] === 500) {
            add_action('admin_notices', function () use ($data) {
                echo '<div class="error"><p>' . esc_html($data['message']) . '</p></div>';
            });
            return false;
        }

        if (isset($data['success']) && $data['success']) {
            // Store the license data including API key
            $settings = $this->settings->get_setting('license');
            $settings['license_key'] = $this->encrypt_data($data['license_key']);
            $settings['api_key'] = $this->encrypt_data($data['api_key']);
            $settings['product_slug'] = $this->encrypt_data($data['product_slug']);
            $settings['credits'] = $this->encrypt_data($data['credits']);
            $settings['last_sync'] = $this->encrypt_data($data['last_sync']);
            $settings['customer_id'] = $this->encrypt_data($data['customer_id']);
            $settings['validation_id'] = $this->encrypt_data($data['validation_id']);
            $this->settings->set_setting('license', $settings);
        }

        return $data;
    }

    /**
     * Validate the plugin license.
     *
     * @return array
     */
    public function rp_validate_plugin_license()
    {
        $domain = wp_parse_url(get_site_url(), PHP_URL_HOST);
        $timestamp = time();
        $nonce = wp_create_nonce('helpmate_license_validation');

        $response = wp_remote_post($this->license_server . '/wp-json/rp/v1/validate-license', array(
            'body' => array(
                'license_key' => $this->license_key,
                'plugin_slug' => $this->plugin_slug,
                'domain' => $domain,
                'timestamp' => $timestamp,
                'nonce' => $nonce,
                'api_key' => $this->api_key,
                'validation_id' => $this->validation_id,
            ),
            'timeout' => 15,
            'sslverify' => true
        ));


        if (is_wp_error($response)) {
            $this->log_security_event('license_validation_error', array(
                'error' => $response->get_error_message()
            ));
            return array(
                'valid' => false,
                'status' => 'error',
                'message' => $response->get_error_message()
            );
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        // Verify response signature
        if (isset($body['valid']) && $body['valid']) {
            return $body;
        }

        $this->log_security_event('invalid_response_format', $body);
        return $body;
    }

    /**
     * Handle the license activation.
     *
     * @param string $license_key The license key.
     * @return WP_REST_Response
     */
    public function handle_license_activation($license_key)
    {
        $result = $this->rp_activate_license($license_key, $this->plugin_slug);

        if ($result['success']) {
            $settings = $this->settings->get_setting('license');
            $settings['license_key'] = $this->encrypt_data($result['license_key']);
            $settings['api_key'] = $this->encrypt_data($result['api_key']);
            $settings['credits'] = $this->encrypt_data($result['credits']);
            $settings['last_sync'] = $this->encrypt_data($result['last_sync']);
            $settings['customer_id'] = $this->encrypt_data($result['customer_id']);
            $settings['validation_id'] = $this->encrypt_data($result['validation_id']);
            $settings['product_slug'] = $this->encrypt_data($result['product_slug']);
            $this->settings->set_setting('license', $settings);
            return new WP_REST_Response([
                'success' => true,
                'message' => esc_html__('License activated successfully', 'helpmate')
            ], 200);
        }

        // Handle specific error cases
        $error_message = isset($result['error']) ? $result['error'] : __('Failed to activate license', 'helpmate');
        $status_code = 400;

        // Map specific error codes to appropriate HTTP status codes
        if (isset($result['code'])) {
            switch ($result['code']) {
                case 'domain_limit':
                    $status_code = 403; // Forbidden
                    break;
                case 'invalid_license':
                    $status_code = 400; // Bad Request
                    break;
                case 'invalid_response':
                    $status_code = 502; // Bad Gateway
                    break;
            }
        }

        return new WP_REST_Response([
            'success' => false,
            'error' => $error_message,
            'code' => $result['code'] ?? 'unknown_error'
        ], $status_code);
    }

    /**
     * Activate the license.
     *
     * @param string $license_key The license key.
     * @param string $plugin_slug The plugin slug.
     * @return array
     */
    public function rp_activate_license($license_key, $plugin_slug)
    {
        $domain = wp_parse_url(get_site_url(), PHP_URL_HOST);

        $response = wp_remote_post($this->license_server . '/wp-json/rp/v1/activate-license', array(
            'body' => array(
                'license_key' => $license_key,
                'plugin_slug' => $plugin_slug,
                'domain' => $domain
            )
        ));

        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => $response->get_error_message()
            );
        }

        $body = wp_remote_retrieve_body($response);

        $data = json_decode($body, true);

        // Check for error response from server
        if (isset($data['code']) && isset($data['message'])) {
            return array(
                'success' => false,
                'error' => $data['message'],
                'code' => $data['code']
            );
        }

        // If we have a successful response with all required fields
        if (
            isset($data['success']) && $data['success'] &&
            isset($data['license_key']) &&
            isset($data['api_key']) &&
            isset($data['credits']) &&
            isset($data['last_sync']) &&
            isset($data['customer_id']) &&
            isset($data['validation_id']) &&
            isset($data['product_slug'])
        ) {

            return array(
                'success' => true,
                'license_key' => $data['license_key'],
                'api_key' => $data['api_key'],
                'credits' => $data['credits'],
                'last_sync' => $data['last_sync'],
                'customer_id' => $data['customer_id'],
                'validation_id' => $data['validation_id'],
                'product_slug' => $data['product_slug']
            );
        }

        // If we get here, something unexpected happened
        return array(
            'success' => false,
            'error' => __('Invalid response from license server', 'helpmate'),
            'code' => 'invalid_response'
        );
    }

    /**
     * Claim credits.
     *
     * @return WP_REST_Response
     */
    public function claim_credits()
    {
        $license_key = $this->get_license_key();
        $api_key = $this->get_api_key();

        $response = wp_remote_post($this->license_server . '/wp-json/rp/v1/claim-credits', array(
            'body' => array(
                'license_key' => $license_key,
                'api_key' => $api_key
            )
        ));

        if (is_wp_error($response)) {
            return new WP_REST_Response([
                'success' => false,
                'error' => $response->get_error_message()
            ], 400);
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (isset($body['success']) && $body['success']) {
            $previous_settings = $this->settings->get_setting('license');
            $previous_settings['social_credits'] = $this->encrypt_data(true);
            $this->settings->set_setting('license', $previous_settings);
            return new WP_REST_Response([
                'success' => true,
                'message' => __('Credits claimed successfully', 'helpmate')
            ], 200);
        }

        return new WP_REST_Response([
            'success' => false,
            'error' => __('Failed to claim credits', 'helpmate')
        ], 400);
    }

    /**
     * Log a security event.
     *
     * @param string $type The event type.
     * @param array $data The event data.
     */
    private function log_security_event($type, $data = array())
    {
        if (isset($GLOBALS['helpmate']) && method_exists($GLOBALS['helpmate'], 'get_security')) {
            $GLOBALS['helpmate']->get_security()->log_security_event($type, $data);
        }
    }
}