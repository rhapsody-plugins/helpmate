<?php

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * The Helpmate post/page meta box class.
 * Handles the Helpmate meta box in the post/page details page.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

class Helpmate_Post_Meta_Box
{
    /** @var Helpmate */
    private $helpmate;

    /** @var Helpmate_Settings */
    private $settings;

    /** @var Helpmate_Document_Handler */
    private $document_handler;

    /**
     * Initialize the class and set its properties.
     *
     * @param Helpmate                   $helpmate          The main plugin instance.
     * @param Helpmate_Settings          $settings          The settings instance.
     * @param Helpmate_Document_Handler  $document_handler  The document handler instance.
     */
    public function __construct($helpmate, $settings, $document_handler)
    {
        $this->helpmate         = $helpmate;
        $this->settings         = $settings;
        $this->document_handler = $document_handler;

        // Meta box
        add_action('add_meta_boxes', [$this, 'add_meta_box']);

        // Row actions
        add_filter('post_row_actions', [$this, 'add_kb_row_action'], 10, 2);
        add_filter('page_row_actions', [$this, 'add_kb_row_action'], 10, 2);

        // AJAX handlers
        add_action('wp_ajax_helpmate_add_post_to_kb', [$this, 'handle_add_to_kb']);
        add_action('wp_ajax_helpmate_remove_post_from_kb', [$this, 'handle_remove_from_kb']);

        // Enqueue scripts
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_scripts']);
    }

    // --- Meta Box ---

    public function add_meta_box()
    {
        $post_types = ['post', 'page'];
        foreach ($post_types as $post_type) {
            add_meta_box(
                'helpmate_post_meta_box',
                __('Helpmate', 'helpmate-ai-chatbot'),
                [$this, 'render_meta_box'],
                $post_type,
                'side',
                'default'
            );
        }
    }

    public function render_meta_box($post)
    {
        $is_in_kb = $this->is_post_in_kb($post->ID);
        $is_pro   = $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active();
        $disable_remove = $is_in_kb && ! $is_pro;

        wp_nonce_field('helpmate_post_meta_box', 'helpmate_post_meta_box_nonce');
        ?>
        <div class="helpmate-post-meta-box">
            <p>
                <button type="button" class="button helpmate-kb-button"
                    data-post-id="<?php echo esc_attr($post->ID); ?>"
                    data-action="<?php echo esc_attr($is_in_kb ? 'remove' : 'add'); ?>"
                    <?php disabled($disable_remove); ?>>
                    <?php echo esc_html($is_in_kb ? __('Remove from Knowledge Base', 'helpmate-ai-chatbot') : __('Add to Knowledge Base', 'helpmate-ai-chatbot')); ?>
                </button>
            </p>
        </div>
        <?php
    }

    // --- Row Actions ---

    public function add_kb_row_action($actions, $post)
    {
        if (! in_array($post->post_type, ['post', 'page'])) {
            return $actions;
        }

        $is_in_kb = $this->is_post_in_kb($post->ID);
        $is_pro   = $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active();
        if ($is_in_kb && ! $is_pro) {
            return $actions;
        }

        $nonce    = wp_create_nonce('helpmate_post_meta_box');
        $actions['kb'] = sprintf(
            '<span class="kb-action" data-post-id="%d" data-action="%s" data-nonce="%s" style="cursor: pointer;">%s</span>',
            esc_attr($post->ID),
            esc_attr($is_in_kb ? 'remove' : 'add'),
            esc_attr($nonce),
            $is_in_kb ? esc_html__('Remove from Knowledge Base', 'helpmate-ai-chatbot') : esc_html__('Add to Knowledge Base', 'helpmate-ai-chatbot')
        );
        return $actions;
    }

    // --- Knowledge Base Methods ---

    private function is_post_in_kb($post_id)
    {
        $request = new WP_REST_Request('GET', '/helpmate/v1/documents');
        $request->set_param('document_type', 'post');
        $response = $this->document_handler->get_indexed_documents($request);
        if (is_wp_error($response)) return false;
        $documents = $response->get_data()['documents'];
        foreach ($documents as $document) {
            $metadata = json_decode($document['metadata'], true);
            if (isset($metadata['post_id']) && $metadata['post_id'] == $post_id) return true;
        }
        return false;
    }

    public function handle_add_to_kb()
    {
        if (!isset($_POST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'])), 'helpmate_post_meta_box')) {
            wp_send_json_error(['message' => 'Invalid security token']);
            return;
        }
        if (!current_user_can('edit_posts')) {
            wp_send_json_error(['message' => 'You do not have permission to perform this action']);
            return;
        }
        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(['message' => 'Invalid post ID']);
            return;
        }
        $post = get_post($post_id);
        if (!$post || !in_array($post->post_type, ['post', 'page'])) {
            wp_send_json_error(['message' => 'Post not found']);
            return;
        }

        // Build metadata matching WP Posts tab format
        $metadata = [
            'featured_image' => get_the_post_thumbnail_url($post_id, 'full'),
            'excerpt' => get_the_excerpt($post_id),
            'modified_date' => $post->post_modified,
            'permalink' => get_permalink($post_id),
            'categories' => wp_get_post_terms($post_id, 'category', ['fields' => 'names']),
            'tags' => wp_get_post_terms($post_id, 'post_tag', ['fields' => 'names']),
        ];

        $document = [
            'document_type' => 'post',
            'title' => get_the_title($post_id),
            'content' => $post->post_content . "\n\nMetadata:\n" . json_encode($metadata, JSON_PRETTY_PRINT),
            'metadata' => [
                'post_id' => $post_id
            ]
        ];
        $request = new WP_REST_Request('POST', '/helpmate/v1/save-documents');
        $request->set_body(json_encode($document));
        $result = $this->document_handler->store_document($request);

        // Check if result is a WP_REST_Response and extract error status
        if (is_a($result, 'WP_REST_Response')) {
            $data = $result->get_data();
            if (!empty($data['error'])) {
                wp_send_json_error(['message' => 'Unable to add to Knowledge Base. Server connection issue. Please try again in a moment.']);
                return;
            }
            wp_send_json_success();
        } elseif ($result) {
            wp_send_json_success();
        } else {
            wp_send_json_error(['message' => 'Unable to add to Knowledge Base. Please try again.']);
        }
    }

    public function handle_remove_from_kb()
    {
        if (! isset($_POST['nonce']) || ! wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'])), 'helpmate_post_meta_box')) {
            wp_send_json_error(['message' => 'Invalid security token']);
            return;
        }
        if (! current_user_can('edit_posts')) {
            wp_send_json_error(['message' => 'You do not have permission to perform this action']);
            return;
        }
        if ($this->helpmate->get_product_slug() === 'helpmate-free' || ! $this->helpmate->is_helpmate_pro_active()) {
            wp_send_json_error(['message' => __('Pro license and Pro plugin must be active to remove from knowledge base.', 'helpmate-ai-chatbot')]);
            return;
        }
        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(['message' => 'Invalid post ID']);
            return;
        }
        $request = new WP_REST_Request('GET', '/helpmate/v1/documents');
        $request->set_param('document_type', 'post');
        $response = $this->document_handler->get_indexed_documents($request);
        if (is_wp_error($response)) {
            wp_send_json_error(['message' => 'Failed to find post in knowledge base']);
            return;
        }
        $documents = $response->get_data()['documents'];
        $document_id = null;
        foreach ($documents as $document) {
            $metadata = json_decode($document['metadata'], true);
            if (isset($metadata['post_id']) && $metadata['post_id'] == $post_id) {
                $document_id = $document['id'];
                break;
            }
        }
        if (!$document_id) {
            wp_send_json_error(['message' => 'Post not found in knowledge base']);
            return;
        }
        $request = new WP_REST_Request('POST', '/helpmate/v1/remove-documents');
        $request->set_body(json_encode([
            'ids' => [$document_id],
            'type' => 'post'
        ]));
        $result = $this->document_handler->remove_documents($request);
        if ($result) {
            wp_send_json_success();
        } else {
            wp_send_json_error(['message' => 'Failed to remove post from knowledge base']);
        }
    }

    // --- Enqueue Scripts ---

    public function enqueue_admin_scripts()
    {
        $screen = get_current_screen();
        if (!$screen) {
            return;
        }

        $version = defined('HELPMATE_VERSION') ? HELPMATE_VERSION : '1.0.0';
        $plugin_url = defined('HELPMATE_URL') ? HELPMATE_URL : '';

        // Post/page list screens - enqueue row action script
        if (in_array($screen->id, ['edit-post', 'edit-page'], true)) {
            wp_enqueue_script(
                'helpmate-post-kb',
                $plugin_url . 'admin/js/post-kb.js',
                ['jquery'],
                $version,
                true
            );
            wp_localize_script('helpmate-post-kb', 'helpmatePostKB', [
                'nonce' => wp_create_nonce('helpmate_post_meta_box'),
            ]);
        }

        // Individual post/page edit screens - enqueue meta box assets
        if (in_array($screen->id, ['post', 'page'], true)) {
            wp_enqueue_style(
                'helpmate-post-meta-box',
                $plugin_url . 'admin/css/helpmate-post-meta-box.css',
                [],
                $version
            );

            wp_enqueue_script(
                'helpmate-post-meta-box',
                $plugin_url . 'admin/js/helpmate-post-meta-box.js',
                ['jquery'],
                $version,
                true
            );

            wp_localize_script('helpmate-post-meta-box', 'helpmatePostMetaBox', [
                'removeText' => __('Remove from Knowledge Base', 'helpmate-ai-chatbot'),
                'addText' => __('Add to Knowledge Base', 'helpmate-ai-chatbot'),
                'errorText' => __('An error occurred', 'helpmate-ai-chatbot'),
            ]);
        }
    }
}
