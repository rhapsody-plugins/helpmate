<?php

/**
 * The file that defines the chat helpers functionality of the plugin
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

/**
 * The chat helpers functionality of the plugin.
 *
 * This class handles all utility and helper operations for chat functionality:
 * - URL content processing
 * - Message preparation and formatting
 * - Context handling
 * - Various utility methods
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Chat_Helpers
{
    /**
     * The helpmate instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * The database instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      HelpMate_Chat_Database    $database    The database instance.
     */
    private $database;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(HelpMate $helpmate, HelpMate_Chat_Database $database)
    {
        $this->helpmate = $helpmate;
        $this->database = $database;
    }

    /**
     * Convert a URL to text.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request.
     * @return WP_REST_Response The response.
     */
    public function url_content_to_text($request)
    {
        $url = $request->get_param('url');

        if (empty($url)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('URL is required', 'helpmate')
            ], 400);
        }

        // Check if URL has http/https protocol, add if missing
        if (!preg_match('/^https?:\/\//', $url)) {
            $url = 'https://' . $url;
        }

        // Fetch the URL content with modified headers and options
        $response = wp_remote_get($url, [
            'timeout' => 30,
            'headers' => [
                'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language' => 'en-US,en;q=0.9',
                'Accept-Encoding' => 'gzip, deflate', // Simplified encoding acceptance
            ],
            'sslverify' => false, // Disable SSL verification if needed
            'redirection' => 5, // Allow up to 5 redirects
            'blocking' => true,
            'compress' => true,
        ]);

        if (is_wp_error($response)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Error fetching URL: ', 'helpmate') . $response->get_error_message()
            ], 500);
        }

        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Failed to fetch URL. Response code: ', 'helpmate') . $response_code
            ], 500);
        }

        $html = wp_remote_retrieve_body($response);
        if (empty($html)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Could not fetch URL content', 'helpmate')
            ], 500);
        }

        // Create a DOMDocument instance with error handling
        $dom = new DOMDocument();
        libxml_use_internal_errors(true); // Enable error handling
        @$dom->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors(); // Clear any errors

        // Get the title
        $title = '';
        $titleElements = $dom->getElementsByTagName('title');
        if ($titleElements->length > 0) {
            $title = trim($titleElements->item(0)->textContent);
        }

        // Remove unwanted elements
        $elementsToRemove = ['script', 'style', 'noscript', 'iframe', 'meta', 'link'];
        foreach ($elementsToRemove as $tag) {
            $elements = $dom->getElementsByTagName($tag);
            while ($elements->length > 0) {
                $element = $elements->item(0);
                if ($element && $element->parentNode) {
                    $element->parentNode->removeChild($element);
                }
            }
        }

        // Get the main content area
        $mainContent = null;
        $possibleContainers = ['main', 'article', '.content', '#content', '.main', '#main'];
        foreach ($possibleContainers as $selector) {
            $elements = $dom->getElementsByTagName($selector);
            if ($elements->length > 0) {
                $mainContent = $elements->item(0);
                break;
            }
        }

        if (!$mainContent) {
            $mainContent = $dom->getElementsByTagName('body')->item(0);
        }

        if (!$mainContent) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Could not find main content area', 'helpmate')
            ], 500);
        }

        // Extract links
        $links = [];
        $anchorTags = $mainContent->getElementsByTagName('a');
        foreach ($anchorTags as $a) {
            $href = $a->getAttribute('href');
            $text = trim($a->textContent);
            if ($href && $text) {
                // Convert relative URLs to absolute
                if (!preg_match('/^https?:\/\//i', $href)) {
                    $href = rtrim($url, '/') . '/' . ltrim($href, '/');
                }
                $links[] = "$text: $href";
            }
        }

        // Get important content
        $content = '';
        $importantTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code'];
        foreach ($importantTags as $tag) {
            $elements = $mainContent->getElementsByTagName($tag);
            foreach ($elements as $element) {
                $content .= $element->textContent . "\n";
            }
        }

        // Add links to content
        if (!empty($links)) {
            $content .= "\n\nLinks:\n" . implode("\n", $links);
        }

        // Check credits before processing any documents
        $credits_check = $this->helpmate->get_license()->check_credits_before_operation(HELPMATE_FEATURES[1], 1);
        if ($credits_check instanceof WP_REST_Response) {
            return $credits_check;
        }

        // Process with OpenAI
        try {
            $response = $this->helpmate->get_chat()->get_chat_response(
                $content,
                [],
                '',
                "Extract and format the web page content in a clean, structured markup format.
                        For each web page, include:
                        # Title: The main title or headline of the page
                        ## Meta Description: The page\'s description if available

                        ## Main Content
                        Break the content into logical sections based on headings (h1, h2, h3, etc.)
                        Format each section with appropriate heading levels

                        ## Key Information
                        - URL: {$url}
                        - Date: " . gmdate('Y-m-d H:i:s') . "
                        - Author: [if available]

                        ## Important Links
                        List any important links with their text

                        ## FAQs and Highlights
                        - Extract and list any FAQs
                        - Include bullet points of key highlights

                        Strip away navigation menus, ads, cookie banners, and other non-content elements.
                        Use proper markdown formatting for headings, lists, and emphasis.
        "
            );


            if (isset($response['error']) && $response['error']) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => $response['message']
                ], 500);
            }

            $text = $response['response']['message'] ?? '';

            return new WP_REST_Response([
                'error' => false,
                'title' => $title,
                'content' => $text
            ]);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Error processing content: ', 'helpmate') . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get the context.
     *
     * @since 1.0.0
     * @param array $context The context.
     * @return array The context.
     */
    public function get_context($context)
    {
        $contextText = '';

        $contextText = implode("\n\n", array_map(function ($doc) {
            $type = isset($doc['document_type']) ? "Type: {$doc['document_type']}\n" : '';
            $title = isset($doc['title']) ? "Title: {$doc['title']}\n" : '';
            $content = isset($doc['content']) ? "Content: " . (is_array($doc['content']) ? implode("\n\n", $doc['content']) : $doc['content']) . "\n" : '';
            $similarity = isset($doc['similarity']) ? "Similarity Score: {$doc['similarity']}\n" : '';
            return $type . $title . $content . $similarity;
        }, $context));

        if ($contextText) {
            return ['role' => 'system', 'content' => $contextText];
        }

        return [];
    }

    /**
     * Prepare the messages.
     *
     * @since 1.0.0
     * @param array $messages The messages.
     * @param string $session_id The session ID.
     * @param array $extra_system_message The extra system message.
     * @return array The prepared messages.
     */
    public function prepare_messages($messages, $session_id, $extra_system_message)
    {
        // Always add system messages first
        foreach ($extra_system_message as $extra_message) {
            array_unshift($messages, $extra_message);
        }
        // array_unshift($messages, ['role' => 'system', 'content' => $this->system_message]);

        // Add chat history if session_id is provided and exists
        if (!empty($session_id)) {
            try {
                $chat_history = $this->database->get_chat_history_data($session_id, 10);

                if (!empty($chat_history)) {
                    foreach ($chat_history as $message) {
                        $messages[] = [
                            'role' => $message['role'],
                            'content' => $message['message']
                        ];
                    }
                }
            } catch (Exception $e) {
                $session_id = '';
            }
        }

        return $messages;
    }

    /**
     * Store the messages.
     *
     * @since 1.0.0
     * @param string $session_id The session ID.
     * @param string $prompt The prompt.
     * @param string $assistant_response The assistant response.
     * @param object $response The response.
     * @param array $metadata The metadata.
     * @return array The message IDs.
     */
    public function store_messages($session_id, $prompt, $assistant_response, $response, $metadata = [])
    {
        // Store messages with the session_id
        try {
            // Store user message
            $user_message_id = $this->database->store_chat_message($session_id, $prompt, 'user', [
                'timestamp' => time()
            ]);
            // Store assistant response
            $assistant_message_id = $this->database->store_chat_message($session_id, $assistant_response, 'assistant', [
                'timestamp' => time(),
                'tokens' => $response->usage->totalTokens ?? null,
                'metadata' => $metadata
            ]);
        } catch (Exception $e) {
            $user_message_id = false;
            $assistant_message_id = false;
        }

        return [
            'user' => $user_message_id,
            'assistant' => $assistant_message_id
        ];
    }

    /**
     * Get the extra system message.
     *
     * @since 1.0.0
     * @return array The extra system message.
     */
    public function get_extra_system_message()
    {
        $extra_system_message = [];
        return $extra_system_message;
    }

    /**
     * Handle the embedding.
     *
     * @since 1.0.0
     * @param array $prompt The prompt.
     * @param string $type The type of embedding create | update | delete.
     * @return array The embedding.
     */
    public function handle_embedding($prompt, $type)
    {
        try {
            $api_key = $GLOBALS['helpmate']->get_license()->get_api_key();
            $last_sync = $GLOBALS['helpmate']->get_license()->get_last_sync();
            $license_key = $GLOBALS['helpmate']->get_license()->get_license_key();

            $timestamp = time();
            $nonce = bin2hex(random_bytes(8));
            $dataToSign = json_encode($prompt) . '|' . $timestamp . '|' . $nonce . '|' . $last_sync;
            $signature = hash_hmac('sha256', $dataToSign, $api_key);

            // Call the AI API
            $response = wp_remote_post($this->helpmate->get_license()->get_license_server() . '/wp-json/rp/v1/proxy', [
                'method' => 'POST',
                'headers' => [
                    'Content-Type' => 'application/json',
                ],
                'body' => json_encode([
                    "prompt" => json_encode($prompt),
                    "timestamp" => $timestamp,
                    "last_sync" => $last_sync,
                    "nonce" => $nonce,
                    "license_key" => $license_key,
                    "api_key" => $api_key,
                    "signature" => $signature,
                    "embedding_type" => $type,
                    "feature_slug" => 'data_source',
                ]),
                'timeout' => 30,
            ]);

            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);

            // Ai Response Debug
            // error_log(print_r($data, true));

            if (isset($data['error']) && $data['error']) {
                return [
                    'error' => true,
                    'message' => $data['message']
                ];
            }

            if (isset($data['status']) && $data['status'] === 'success') {
                return $data;
            } else {
                return [];
            }
        } catch (Exception $e) {
            return [];
        }
    }
}