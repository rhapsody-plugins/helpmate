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
    private $api_server = WP_HELPMATE_API_SERVER;

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
        if (!get_option('helpmate_install_id')) {
            add_option('helpmate_install_id', wp_generate_uuid4());
        }
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

    public function get_install_id()
    {
        $install_id = get_option('helpmate_install_id');
        if (empty($install_id)) {
            $install_id = wp_generate_uuid4();
            update_option('helpmate_install_id', $install_id, false);
        }
        return $install_id;
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

        $domain = helpmate_get_site_domain();

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
            $old_key = $this->get_key();
            $new_key = isset($data['api_key']) ? (string) $data['api_key'] : '';

            // Store the api data including API key
            $settings = $this->settings->get_setting('api');
            $settings['api_key'] = $this->encrypt_data($data['api_key']);
            $settings['validation_key'] = $this->encrypt_data($data['validation_key']);
            $settings['product_slug'] = $this->encrypt_data($data['product_slug']);
            $settings['credits'] = $this->encrypt_data($data['credits']);
            $settings['last_sync'] = $this->encrypt_data($data['last_sync']);
            $settings['customer_id'] = $this->encrypt_data($data['customer_id']);
            $this->settings->set_setting('api', $settings);

            $documents = array(
                'action' => 'none',
                'imported' => 0,
                'skipped_quick_train' => false,
            );
            if ($new_key !== '' && isset($GLOBALS['helpmate']) && $GLOBALS['helpmate'] instanceof Helpmate) {
                $documents = $GLOBALS['helpmate']->get_tools()->orchestrate_documents_after_api_key_save($old_key, $new_key);
            }

            return new WP_REST_Response([
                'success' => true,
                'message' => __('Free api key registered successfully', 'helpmate-ai-chatbot'),
                'documents' => $documents,
            ], 200);
        }

        return new WP_REST_Response([
            'success' => false,
            'message' => isset($data['message']) ? $data['message'] : __('Failed to register free api key', 'helpmate-ai-chatbot'),
        ], 200);
    }

    /**
     * Validate the plugin api key.
     *
     * @return array
     */
    public function rp_validate_plugin_api_key()
    {
        $domain = helpmate_get_site_domain();
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
        $old_key = $this->get_key();
        $result = $this->rp_activate_api_key($api_key, $this->plugin_slug);

        if ($result['success']) {
            $new_key = isset($result['api_key']) ? (string) $result['api_key'] : '';
            $settings = $this->settings->get_setting('api');
            $settings['api_key'] = $this->encrypt_data($result['api_key']);
            $settings['validation_key'] = $this->encrypt_data($result['validation_key']);
            $settings['credits'] = $this->encrypt_data($result['credits']);
            $settings['last_sync'] = $this->encrypt_data($result['last_sync']);
            $settings['customer_id'] = $this->encrypt_data($result['customer_id']);
            $settings['product_slug'] = $this->encrypt_data($result['product_slug']);
            $this->settings->set_setting('api', $settings);

            $documents = array(
                'action' => 'none',
                'imported' => 0,
                'skipped_quick_train' => false,
            );
            if ($new_key !== '' && isset($GLOBALS['helpmate']) && $GLOBALS['helpmate'] instanceof Helpmate) {
                $documents = $GLOBALS['helpmate']->get_tools()->orchestrate_documents_after_api_key_save($old_key, $new_key);
            }

            return new WP_REST_Response([
                'success' => true,
                'message' => esc_html__('Api key activated successfully', 'helpmate-ai-chatbot'),
                'documents' => $documents,
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
        $domain = helpmate_get_site_domain();

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

        if (!isset($data['customer_id'])) {
            return array(
                'success' => false,
                'error' => __('Api key is not activated. Please contact support.', 'helpmate-ai-chatbot'),
                'code' => 'customer_id_not_found'
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

    public function get_localhost_sources()
    {
        $api_key = $this->get_key();
        if (empty($api_key)) {
            return array('error' => true, 'message' => __('API key not found', 'helpmate-ai-chatbot'));
        }
        $response = wp_remote_post($this->api_server . '/wp-json/rp/v1/tenants/localhost-sources', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode(array('api_key' => $api_key)),
            'timeout' => 60,
            'sslverify' => true,
        ));
        if (is_wp_error($response)) {
            return array('error' => true, 'message' => $response->get_error_message());
        }
        return json_decode(wp_remote_retrieve_body($response), true);
    }

    public function promote_localhost($target_domain, $install_ids = array(), $force_merge = false)
    {
        $api_key = $this->get_key();
        if (empty($api_key)) {
            return array('error' => true, 'message' => __('API key not found', 'helpmate-ai-chatbot'));
        }
        $response = wp_remote_post($this->api_server . '/wp-json/rp/v1/tenants/promote-localhost', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode(array(
                'api_key' => $api_key,
                'target_domain' => sanitize_text_field($target_domain),
                'wordpress_url' => helpmate_get_site_url(),
                'install_ids' => array_map('sanitize_text_field', is_array($install_ids) ? $install_ids : array()),
                'force_merge' => (bool) $force_merge,
            )),
            'timeout' => 300,
            'sslverify' => true,
        ));
        if (is_wp_error($response)) {
            return array(
                'error' => true,
                'message' => $response->get_error_message(),
                'http_status' => 500,
            );
        }

        $status_code = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($body)) {
            return array(
                'error' => true,
                'message' => __('Invalid response from license server', 'helpmate-ai-chatbot'),
                'http_status' => $status_code > 0 ? $status_code : 502,
            );
        }

        if ($status_code >= 400 || !empty($body['error'])) {
            $message = isset($body['message']) ? (string) $body['message'] : __('Promotion failed', 'helpmate-ai-chatbot');
            $detail = isset($body['detail']) && is_array($body['detail']) ? $body['detail'] : array();
            if (empty($message) && isset($detail['message'])) {
                $message = (string) $detail['message'];
            }
            return array(
                'error' => true,
                'message' => $message,
                'http_status' => $status_code > 0 ? $status_code : 400,
                'code' => isset($body['code']) ? (string) $body['code'] : (isset($detail['code']) ? (string) $detail['code'] : ''),
                'detail' => $detail,
            );
        }

        return $body;
    }

    public function get_localhost_migration_status()
    {
        return get_option('helpmate_localhost_migration_status', 'pending');
    }

    public function set_localhost_migration_status($status)
    {
        update_option('helpmate_localhost_migration_status', sanitize_text_field($status), false);
    }

    /**
     * Build signed request body for license-server tools endpoints.
     *
     * @param string $prompt Signed prompt payload (use empty string for tools without prompt).
     * @param array  $extra  Additional body fields.
     * @return array
     */
    private function build_signed_tools_body($prompt, array $extra = array())
    {
        $api_key = $this->get_key();
        $validation_key = $this->get_validation_key();
        $timestamp = time();
        $nonce = bin2hex(random_bytes(8));
        $signature = hash_hmac('sha256', $prompt . '|' . $timestamp . '|' . $nonce, $validation_key);

        return array_merge(
            array(
                'prompt' => $prompt,
                'timestamp' => $timestamp,
                'nonce' => $nonce,
                'api_key' => $api_key,
                'validation_key' => $validation_key,
                'signature' => $signature,
                'wordpress_url' => helpmate_get_site_url(),
            ),
            $extra
        );
    }

    /**
     * Fetch paginated Qdrant sync-list for this site.
     *
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function fetch_qdrant_sync_list($limit = 100, $offset = 0)
    {
        if (empty($this->get_key())) {
            return array('error' => true, 'message' => __('API key not found', 'helpmate-ai-chatbot'));
        }
        if (empty($this->get_validation_key())) {
            return array('error' => true, 'message' => __('API validation key not found. Re-save your API key in Helpmate.', 'helpmate-ai-chatbot'));
        }

        $body = $this->build_signed_tools_body('', array(
            'limit' => (int) $limit,
            'offset' => (int) $offset,
        ));

        $response = wp_remote_post($this->api_server . '/wp-json/rp/v1/documents/sync-list', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode($body),
            'timeout' => 120,
            'sslverify' => true,
        ));

        if (is_wp_error($response)) {
            return array('error' => true, 'message' => $response->get_error_message());
        }

        $decoded = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($decoded)) {
            return array('error' => true, 'message' => __('Invalid response from license server.', 'helpmate-ai-chatbot'));
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status >= 400) {
            $message = $decoded['message'] ?? $decoded['detail'] ?? __('Request failed.', 'helpmate-ai-chatbot');
            if (is_array($message)) {
                $message = wp_json_encode($message);
            }
            if ($status === 404) {
                $message = __('Sync-list API not found. Deploy the latest rag-ai-server and restart the AI service.', 'helpmate-ai-chatbot');
            }
            return array(
                'error' => true,
                'message' => $message,
            );
        }

        return $decoded;
    }

    /**
     * Patch Qdrant sync payload fields (no re-embed).
     *
     * @param string $document_id Qdrant document UUID.
     * @param array  $fields      title, document_type, plugin_metadata, full_content.
     * @return array
     */
    public function patch_qdrant_sync_payload($document_id, array $fields)
    {
        if (empty($this->get_key())) {
            return array('error' => true, 'message' => __('API key not found', 'helpmate-ai-chatbot'));
        }
        if (empty($this->get_validation_key())) {
            return array('error' => true, 'message' => __('API validation key not found. Re-save your API key in Helpmate.', 'helpmate-ai-chatbot'));
        }

        $body = $this->build_signed_tools_body('', array_merge(
            array('document_id' => $document_id),
            $fields
        ));

        $response = wp_remote_post($this->api_server . '/wp-json/rp/v1/documents/sync-payload', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode($body),
            'timeout' => 120,
            'sslverify' => true,
        ));

        if (is_wp_error($response)) {
            return array('error' => true, 'message' => $response->get_error_message());
        }

        $decoded = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($decoded)) {
            return array('error' => true, 'message' => __('Invalid response from license server.', 'helpmate-ai-chatbot'));
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status >= 400) {
            return array(
                'error' => true,
                'message' => $decoded['message'] ?? $decoded['detail'] ?? __('Request failed.', 'helpmate-ai-chatbot'),
            );
        }

        return $decoded;
    }

    /**
     * Save OpenAI API key (encrypted).
     *
     * @since 1.0.0
     * @param string $openai_key The OpenAI API key to save.
     * @return array
     */
    public function save_openai_key($openai_key)
    {
        if (empty($openai_key)) {
            return array(
                'success' => false,
                'message' => __('OpenAI API key is required', 'helpmate-ai-chatbot')
            );
        }

        // Validate OpenAI key format (should start with sk-)
        if (strpos($openai_key, 'sk-') !== 0) {
            return array(
                'success' => false,
                'message' => __('Invalid OpenAI API key format. Key must start with "sk-"', 'helpmate-ai-chatbot')
            );
        }

        // Encrypt and save the key
        $encrypted_key = $this->encrypt_data($openai_key);
        $this->settings->set_setting('openai_api_key', $encrypted_key);

        return array(
            'success' => true,
            'message' => __('OpenAI API key saved successfully', 'helpmate-ai-chatbot')
        );
    }

    /**
     * Get OpenAI API key (decrypted).
     *
     * @since 1.0.0
     * @return string|null
     */
    public function get_openai_key()
    {
        $encrypted_key = $this->settings->get_setting('openai_api_key');
        if (empty($encrypted_key)) {
            return null;
        }
        return $this->decrypt_data($encrypted_key);
    }

    /**
     * Delete OpenAI API key.
     *
     * @since 1.0.0
     * @return array
     */
    public function delete_openai_key()
    {
        $this->settings->delete_setting('openai_api_key');
        return array(
            'success' => true,
            'message' => __('OpenAI API key removed successfully', 'helpmate-ai-chatbot')
        );
    }
}