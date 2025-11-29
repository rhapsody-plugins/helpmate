<?php

/**
 * The chat helpers functionality of the plugin.
 *
 * This class handles all utility and helper operations for chat functionality:
 * - URL content processing
 * - Message preparation and formatting
 * - Context handling
 * - Various utility methods
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/chat
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

class Helpmate_Chat_Helpers
{
    /**
     * The helpmate instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * The database instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate_Chat_Database    $database    The database instance.
     */
    private $database;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(Helpmate $helpmate, Helpmate_Chat_Database $database)
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
                'message' => __('URL is required', 'helpmate-ai-chatbot')
            ], 400);
        }

        // Check if URL has http/https protocol, add if missing
        if (!preg_match('/^https?:\/\//', $url)) {
            $url = 'https://' . $url;
        }

        // Fetch the URL content with modified headers and options
        $response = wp_remote_get($url, [
            'timeout' => 60,
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
                'message' => __('Error fetching URL: ', 'helpmate-ai-chatbot') . $response->get_error_message()
            ], 500);
        }

        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Failed to fetch URL. Response code: ', 'helpmate-ai-chatbot') . $response_code
            ], 500);
        }

        $html = wp_remote_retrieve_body($response);
        if (empty($html)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Could not fetch URL content', 'helpmate-ai-chatbot')
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
            if (empty($title)) {
                $title = $url;
            }
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
                'message' => __('Could not find main content area', 'helpmate-ai-chatbot')
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

        // Process with OpenAI
        try {
            $response = $this->helpmate->get_chat()->get_chat_response(
                $content,
                [],
                '',
                "Extract and format the web page content in a clean, structured markup format.
                        For each web page, include:
                        # Title: The main title or headline of the page
                        ## Meta Description: The page\'s summary

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
                'message' => __('Error processing content: ', 'helpmate-ai-chatbot') . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Quick train homepage.
     *
     * @since 1.0.0
     * @return WP_REST_Response The response.
     */
    public function quick_train_homepage()
    {
        $url = get_site_url();

        if (empty($url)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('URL is required', 'helpmate-ai-chatbot')
            ], 400);
        }

        // Check if URL has http/https protocol, add if missing
        if (!preg_match('/^https?:\/\//', $url)) {
            $url = 'https://' . $url;
        }

        // Fetch the URL content with modified headers and options
        $response = wp_remote_get($url, [
            'timeout' => 60,
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
                'message' => __('Error fetching URL: ', 'helpmate-ai-chatbot') . $response->get_error_message()
            ], 500);
        }

        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Failed to fetch URL. Response code: ', 'helpmate-ai-chatbot') . $response_code
            ], 500);
        }

        $html = wp_remote_retrieve_body($response);
        if (empty($html)) {
            return new WP_REST_Response([
                'error' => true,
                'message' => __('Could not fetch URL content', 'helpmate-ai-chatbot')
            ], 500);
        }

        // Remove all inline and internal CSS and JavaScript
        $html = $this->remove_css_and_js($html);

        // Create a DOMDocument instance with error handling
        $dom = new DOMDocument();
        libxml_use_internal_errors(true); // Enable error handling
        @$dom->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors(); // Clear any errors

        // Get the title
        $title = "";
        $titleElements = $dom->getElementsByTagName('title');
        if ($titleElements->length > 0) {
            $title = trim($titleElements->item(0)->textContent);
            if (empty($title)) {
                $title = $url;
            }
        }

        // Process with OpenAI
        try {
            $response = $this->helpmate->get_chat()->get_chat_response(
                $html,
                [],
                '',
                'You are given the full HTML of a website homepage. Your task is to analyze it thoroughly and produce a structured document that captures all the information a customer or user might need when interacting with this website.

                The document should be clear, factual, and free from hallucinations. Use only what is explicitly present in the HTML. If something is not available, leave it out.

                <Steps_to_Follow>
                1. Extract Core Identity
                    - Website/brand name
                    - Tagline or main heading
                    - Description/what the site is about
                    - Industry/category (e.g., eCommerce, SaaS, portfolio, blog, services, etc.)

                2. Navigation & Structure
                    - List all visible menu items (Home, About, Shop, Services, Blog, Contact, etc.)
                    - Note dropdown items or sub-links if present.
                    - Capture footer links and important quick links.

                3. Main Offerings / Purpose
                    - Products, services, or features highlighted.
                    - Special categories (e.g., clothing types, SaaS features, blog topics).
                    - Unique selling points, guarantees, or core benefits.

                4. Content Highlights
                    - Extract visible text sections like hero banners, promotional texts, featured posts/products, testimonials, pricing sections, etc.
                    - Summarize images only if they contain relevant text (logos, banners with slogans).

                5. Customer-Facing Information
                    - Contact methods (phone, email, chat, forms).
                    - Location/addresses if available.
                    - Social media links.
                    - Policies (shipping, returns, privacy, terms).
                    - Calls to action (Sign up, Buy now, Book a demo, Subscribe, etc.).

                6. Questions Customers Might Ask
                    - Based on extracted content, create a list of possible realistic user questions and map them to answers from the homepage.
                        <Examples>
                        "What services do you offer?"
                        "How can I contact you?"
                        "Do you have a return policy?"
                        "What products are available?"
                        "Where is your company located?"
                        "How can I sign up or get started?"
                        "What makes your business unique?"
                        </Examples>

                7. Format Requirements
                    - Use Markdown with clear headings.
                    - Organize information into logical sections:
                        -- Website Overview
                        -- Navigation
                        -- Main Offerings
                        -- Content Highlights
                        -- Customer Information
                        -- Possible Questions & Answers
                    - Keep everything concise, structured, and directly based on HTML content.
                </Steps_to_Follow>
        '
            );

            if (!isset($response)) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => __('Timeout! The request took too long to complete. Try Again.', 'helpmate-ai-chatbot')
                ], 500);
            }

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
                'message' => __('Error processing content: ', 'helpmate-ai-chatbot') . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove all inline and internal CSS and JavaScript from HTML.
     *
     * @since 1.0.0
     * @param string $html The HTML content.
     * @return string The cleaned HTML content.
     */
    private function remove_css_and_js($html)
    {
        // Create a DOMDocument instance with error handling
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        @$dom->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();

        // Remove script tags (both internal and external)
        $scripts = $dom->getElementsByTagName('script');
        $scriptsToRemove = [];
        foreach ($scripts as $script) {
            $scriptsToRemove[] = $script;
        }
        foreach ($scriptsToRemove as $script) {
            if ($script->parentNode) {
                $script->parentNode->removeChild($script);
            }
        }

        // Remove style tags (internal CSS)
        $styles = $dom->getElementsByTagName('style');
        $stylesToRemove = [];
        foreach ($styles as $style) {
            $stylesToRemove[] = $style;
        }
        foreach ($stylesToRemove as $style) {
            if ($style->parentNode) {
                $style->parentNode->removeChild($style);
            }
        }

        // Remove link tags that reference CSS files
        $links = $dom->getElementsByTagName('link');
        $linksToRemove = [];
        foreach ($links as $link) {
            if ($link instanceof DOMElement) {
                $rel = $link->getAttribute('rel');
                if (strtolower($rel) === 'stylesheet' || strpos(strtolower($rel), 'stylesheet') !== false) {
                    $linksToRemove[] = $link;
                }
            }
        }
        foreach ($linksToRemove as $link) {
            if ($link->parentNode) {
                $link->parentNode->removeChild($link);
            }
        }

        // Remove inline styles from all elements
        $xpath = new DOMXPath($dom);
        $elementsWithStyle = $xpath->query('//*[@style]');
        foreach ($elementsWithStyle as $element) {
            $element->removeAttribute('style');
        }

        // Remove onclick, onload, and other event handler attributes
        $eventAttributes = [
            'onclick', 'onload', 'onchange', 'onsubmit', 'onmouseover', 'onmouseout',
            'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onkeypress', 'onmousedown',
            'onmouseup', 'onmousemove', 'onmouseenter', 'onmouseleave', 'oncontextmenu',
            'ondblclick', 'onresize', 'onscroll', 'onerror', 'onabort', 'onbeforeunload',
            'onunload', 'onhashchange', 'onpopstate', 'onpageshow', 'onpagehide'
        ];

        foreach ($eventAttributes as $attr) {
            $elementsWithEvent = $xpath->query('//*[@' . $attr . ']');
            foreach ($elementsWithEvent as $element) {
                $element->removeAttribute($attr);
            }
        }

        // Remove noscript tags
        $noscripts = $dom->getElementsByTagName('noscript');
        $noscriptsToRemove = [];
        foreach ($noscripts as $noscript) {
            $noscriptsToRemove[] = $noscript;
        }
        foreach ($noscriptsToRemove as $noscript) {
            if ($noscript->parentNode) {
                $noscript->parentNode->removeChild($noscript);
            }
        }

        // Get the cleaned HTML
        $cleanedHtml = $dom->saveHTML();

        // Additional regex cleanup for any remaining inline styles or scripts
        $cleanedHtml = preg_replace('/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi', '', $cleanedHtml);
        $cleanedHtml = preg_replace('/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/mi', '', $cleanedHtml);
        $cleanedHtml = preg_replace('/style\s*=\s*["\'][^"\']*["\']/', '', $cleanedHtml);
        $cleanedHtml = preg_replace('/on\w+\s*=\s*["\'][^"\']*["\']/', '', $cleanedHtml);

        return $cleanedHtml;
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
                $chat_history = $this->database->get_chat_history_data($session_id, 6);

                if (!empty($chat_history)) {
                    foreach ($chat_history as $message) {
                        $assistant_message = isset(json_decode($message['message'], true)['text']) ? json_decode($message['message'], true) : null;
                        $context = isset($message['metadata']['rag_context']) ? $message['metadata']['rag_context'] : '';
                        $messages[] = [
                            'role' => $message['role'],
                            'content' => $assistant_message ? $assistant_message['text'] . "\n\n[Tool Used: " . $assistant_message['type'] . "]" : (isset($context) ? '[RAG Context: ' . $context . '] User Asked: ' : '') . $message['message'],
                            'timestamp' => $message['timestamp'],
                            'id' => $message['id']
                        ];
                    }
                }
            } catch (Exception $e) {
                $session_id = '';
            }
        }

        // Sort messages using the same logic as the React component
        usort($messages, function ($a, $b) {
            // First sort by timestamp
            $a_timestamp = isset($a['timestamp']) ? $a['timestamp'] : 0;
            $b_timestamp = isset($b['timestamp']) ? $b['timestamp'] : 0;

            $time_diff = $a_timestamp - $b_timestamp;
            if ($time_diff !== 0) {
                return $time_diff;
            }

            // If same timestamp, user messages should come before assistant messages
            if (isset($a['role']) && isset($b['role'])) {
                if ($a['role'] === 'user' && $b['role'] === 'assistant') {
                    return -1;
                }
                if ($a['role'] === 'assistant' && $b['role'] === 'user') {
                    return 1;
                }
            }

            // If same role, sort by ID
            $a_id = isset($a['id']) ? $a['id'] : 0;
            $b_id = isset($b['id']) ? $b['id'] : 0;
            return $a_id - $b_id;
        });

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
            $metadata[] = [
                'timestamp' => time()
            ];
            // Store user message
            $user_message_id = $this->database->store_chat_message($session_id, $prompt, 'user', $metadata);
            // Store assistant response
            $assistant_message_id = $this->database->store_chat_message($session_id, $assistant_response, 'assistant', [
                'timestamp' => time(),
                'tokens' => $response->usage->totalTokens ?? null,
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
     * @param string $feature_slug The feature slug.
     * @return array The embedding.
     */
    public function handle_embedding($prompt, $type, $feature_slug = 'data_source')
    {
        try {
            $api_key = $GLOBALS['helpmate']->get_api()->get_key();
            $validation_key = $GLOBALS['helpmate']->get_api()->get_validation_key();

            $timestamp = time();
            $nonce = bin2hex(random_bytes(8));
            $dataToSign = json_encode($prompt) . '|' . $timestamp . '|' . $nonce;
            $signature = hash_hmac('sha256', $dataToSign, $validation_key);

            // Call the AI API
            $response = wp_remote_post($this->helpmate->get_api()->get_api_server() . '/wp-json/rp/v1/proxy', [
                'method' => 'POST',
                'headers' => [
                    'Content-Type' => 'application/json',
                ],
                'body' => json_encode([
                    "prompt" => json_encode($prompt),
                    "timestamp" => $timestamp,
                    "nonce" => $nonce,
                    "api_key" => $api_key,
                    "validation_key" => $validation_key,
                    "signature" => $signature,
                    "embedding_type" => $type,
                    "feature_slug" => $feature_slug,
                ]),
                'timeout' => 300,
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