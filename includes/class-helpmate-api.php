<?php

/**
 * Api class for Helpmate plugin.
 *
 * This class defines all code necessary to run during the plugin's api calls.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Api
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
     * @var Helpmate_Settings
     */
    private $settings;
    /**
     * The api key.
     *
     * @var string
     */
    private $api_key;
    /**
     * The validation key.
     *
     * @var string
     */
    private $validation_key;
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
     * The encryption key.
     *
     * @var string
     */
    private $encryption_key;
    /**
     * The api server.
     *
     * @var string
     */
    private $api_server = 'http://localhost:10024';

    /**
     * Constructor
     *
     * @param Helpmate_Settings $settings The settings instance.
     * @param string $plugin_slug The plugin slug.
     */
    public function __construct(Helpmate_Settings $settings, $plugin_slug)
    {
        $this->plugin_slug = $plugin_slug;
        $this->settings = $settings;
        $this->encryption_key = $this->get_encryption_key();
        $this->api_key = $this->get_key();
        $this->validation_key = $this->get_validation_key();
        $this->local_credits = $this->get_local_credits();
        $this->last_sync = $this->get_last_sync();
        $this->product_slug = $this->get_product_slug();
        $this->customer_id = $this->get_customer_id();
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
     * Get the api server.
     *
     * @return string
     */
    public function get_api_server()
    {
        return $this->api_server;
    }

    /**
     * Get the api key.
     *
     * @return string
     */
    public function get_key()
    {
        $api = $this->settings->get_setting('api');
        if (isset($api['api_key'])) {
            return $this->decrypt_data($api['api_key']);
        }
        return null;
    }

    /**
     * Get the API key.
     *
     * @return string
     */
    public function get_validation_key()
    {
        $api = $this->settings->get_setting('api');
        if (isset($api['validation_key'])) {
            return $this->decrypt_data($api['validation_key']);
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
        $api = $this->settings->get_setting('api');
        if (isset($api['credits'])) {
            return $this->decrypt_data($api['credits']);
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
        $api = $this->settings->get_setting('api');
        if (isset($api['last_sync'])) {
            return (int) $this->decrypt_data($api['last_sync']);
        }
        return 0;
    }

    /**
     * Get the product slug.
     *
     * @return string
     */
    public function get_product_slug()
    {
        $api = $this->settings->get_setting('api');
        if (isset($api['product_slug'])) {
            return $this->decrypt_data($api['product_slug']);
        }
        return null;
    }

    /**
     * Get the customer ID.
     *
     * @return string
     */
    public function get_customer_id()
    {
        $api = $this->settings->get_setting('api');
        if (isset($api['customer_id'])) {
            return $this->decrypt_data($api['customer_id']);
        }
        return null;
    }

    /**
     * Sync with the server.
     */
    public function sync_with_server()
    {
        if (!$this->api_key) {
            return;
        }

        $validation = $this->rp_validate_plugin_api_key();

        if ($validation['valid']) {
            // Update local credits with server values
            $previous_settings = $this->settings->get_setting('api');
            $previous_settings['last_sync'] = $this->encrypt_data(time());
            $previous_settings['product_slug'] = $this->encrypt_data($validation['product_slug']);
            $previous_settings['credits'] = $this->encrypt_data($validation['credits']);
            $previous_settings['validation_key'] = $this->encrypt_data($validation['validation_key']);
            $this->settings->set_setting('api', $previous_settings);
        }
    }

    /**
     * Helper function for client plugins to register for a free api key
     * @param $request The request object.
     * @return WP_REST_Response
     */
    public function rp_register_free_api_key($request)
    {
        $email = sanitize_email($request['email'] ?? '');
        $password = sanitize_text_field($request['password'] ?? '');

        $domain = wp_parse_url(get_site_url(), PHP_URL_HOST);

        $response = wp_remote_post($this->api_server . '/wp-json/rp/v1/register-free-client', array(
            'body' => array(
                'domain' => $domain,
                'plugin_slug' => HELPMATE_BASENAME,
                'email' => $email,
                'password' => $password
            )
        ));

        $data = json_decode(wp_remote_retrieve_body($response), true);

        if (isset($data['data']['status']) && $data['data']['status'] !== 200) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $data['message']
            ], 200);
        }

        if (isset($data['success']) && $data['success']) {
            // Store the api data including API key
            $settings = $this->settings->get_setting('api');
            $settings['api_key'] = $this->encrypt_data($data['api_key']);
            $settings['validation_key'] = $this->encrypt_data($data['validation_key']);
            $settings['product_slug'] = $this->encrypt_data($data['product_slug']);
            $settings['credits'] = $this->encrypt_data($data['credits']);
            $settings['last_sync'] = $this->encrypt_data($data['last_sync']);
            $settings['customer_id'] = $this->encrypt_data($data['customer_id']);
            $this->settings->set_setting('api', $settings);
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => __('Free api key registered successfully', 'helpmate-ai-chatbot')
        ], 200);
    }

    /**
     * Validate the plugin api key.
     *
     * @return array
     */
    public function rp_validate_plugin_api_key()
    {
        $domain = wp_parse_url(get_site_url(), PHP_URL_HOST);
        $timestamp = time();
        $nonce = wp_create_nonce('helpmate_api_key_validation');

        $response = wp_remote_post($this->api_server . '/wp-json/rp/v1/validate-api-key', array(
            'body' => array(
                'api_key' => $this->api_key,
                'validation_key' => $this->validation_key,
                'plugin_slug' => $this->plugin_slug,
                'domain' => $domain,
                'timestamp' => $timestamp,
                'nonce' => $nonce,
            ),
            'timeout' => 60,
            'sslverify' => true
        ));


        if (is_wp_error($response)) {
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

        return $body;
    }

    /**
     * Handle the api key activation.
     *
     * @param string $api_key The api key.
     * @return WP_REST_Response
     */
    public function handle_api_key_activation($api_key)
    {
        $result = $this->rp_activate_api_key($api_key, $this->plugin_slug);

        if ($result['success']) {
            $settings = $this->settings->get_setting('api');
            $settings['api_key'] = $this->encrypt_data($result['api_key']);
            $settings['validation_key'] = $this->encrypt_data($result['validation_key']);
            $settings['credits'] = $this->encrypt_data($result['credits']);
            $settings['last_sync'] = $this->encrypt_data($result['last_sync']);
            $settings['customer_id'] = $this->encrypt_data($result['customer_id']);
            $settings['product_slug'] = $this->encrypt_data($result['product_slug']);
            $this->settings->set_setting('api', $settings);
            return new WP_REST_Response([
                'success' => true,
                'message' => esc_html__('Api key activated successfully', 'helpmate-ai-chatbot')
            ], 200);
        }

        // Handle specific error cases
        $error_message = isset($result['error']) ? $result['error'] : __('Failed to activate api key', 'helpmate-ai-chatbot');
        $status_code = 400;

        // Map specific error codes to appropriate HTTP status codes
        if (isset($result['code'])) {
            switch ($result['code']) {
                case 'domain_limit':
                    $status_code = 403; // Forbidden
                    break;
                case 'invalid_api_key':
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
     * Activate the api key.
     *
     * @param string $api_key The api key.
     * @param string $plugin_slug The plugin slug.
     * @return array
     */
    public function rp_activate_api_key($api_key, $plugin_slug)
    {
        $domain = wp_parse_url(get_site_url(), PHP_URL_HOST);

        $response = wp_remote_post($this->api_server . '/wp-json/rp/v1/activate-api-key', array(
            'body' => array(
                'api_key' => $api_key,
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
            isset($data['api_key']) &&
            isset($data['validation_key']) &&
            isset($data['credits']) &&
            isset($data['last_sync']) &&
            isset($data['customer_id']) &&
            isset($data['product_slug'])
        ) {

            return array(
                'success' => true,
                'api_key' => $data['api_key'],
                'validation_key' => $data['validation_key'],
                'credits' => $data['credits'],
                'last_sync' => $data['last_sync'],
                'customer_id' => $data['customer_id'],
                'product_slug' => $data['product_slug']
            );
        }

        // If we get here, something unexpected happened
        return array(
            'success' => false,
            'error' => __('Invalid response from api server', 'helpmate-ai-chatbot'),
            'code' => 'invalid_response'
        );
    }

    /**
     * Send deactivate feedback to api server.
     *
     * @param string $reason Optional reason for deactivating.
     * @return array Always returns success to allow deactivation to proceed.
     */
    public function send_deactivate_feedback($reason = '')
    {
        $body = array();

        // Include api_key if available
        if ($this->api_key) {
            $body['api_key'] = $this->api_key;
        }

        // Include reason if provided
        if (!empty($reason)) {
            $body['reason'] = sanitize_textarea_field($reason);
        }

        // Send request to api server
        wp_remote_post($this->api_server . '/wp-json/rp/v1/deactivate-feedback', array(
            'body' => $body,
            'timeout' => 30,
            'sslverify' => true
        ));

        // Always return success, even if the request fails
        // This ensures deactivation can proceed regardless of server response
        return array(
            'success' => true,
            'message' => __('Feedback sent', 'helpmate-ai-chatbot')
        );
    }

    /**
     * Send activation feedback to api server.
     *
     * @return array Response from api server or success response on failure.
     */
    public function send_activate_feedback()
    {
        $body = array();

        // Include api_key if available
        if ($this->api_key) {
            $body['api_key'] = $this->api_key;
        }

        // Send request to api server
        wp_remote_post($this->api_server . '/wp-json/rp/v1/activate-feedback', array(
            'body' => $body,
            'timeout' => 30,
            'sslverify' => true
        ));

        // Always return success, even if the request fails
        // This ensures activation can proceed regardless of server response
        return array(
            'success' => true,
            'message' => __('Activation feedback sent', 'helpmate-ai-chatbot')
        );
    }
}