<?php

/**
 * The CRM Order Meta Box class.
 * Handles the Helpmate CRM Contact metabox in WooCommerce order pages.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) exit;

class Helpmate_Crm_Order_Metabox
{
    /**
     * The CRM instance.
     *
     * @since    1.3.0
     * @access   private
     * @var      Helpmate_CRM    $crm    The CRM instance.
     */
    private $crm;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.3.0
     * @param    Helpmate_CRM    $crm    The CRM instance.
     */
    public function __construct(Helpmate_CRM $crm)
    {
        $this->crm = $crm;
        $this->init_hooks();
    }

    /**
     * Initialize hooks.
     *
     * @since    1.3.0
     */
    private function init_hooks()
    {
        // Hook into WooCommerce order screens - this handles both COT and legacy
        add_action('add_meta_boxes', [$this, 'add_meta_box'], 20);

        // Enqueue scripts and styles
        add_action('admin_enqueue_scripts', [$this, 'enqueue_scripts']);

        // AJAX handlers
        add_action('wp_ajax_helpmate_get_contact_details', [$this, 'ajax_get_contact_details']);
        add_action('wp_ajax_helpmate_create_contact_from_order', [$this, 'ajax_create_contact_from_order']);
    }

    /**
     * Add meta box for WooCommerce orders.
     * This handles both COT and legacy order screens.
     *
     * @since    1.3.0
     * @param    string      $screen_id_or_post_type    Screen ID (for COT) or post type (for legacy).
     * @param    WC_Order|WP_Post    $order_or_post      Order object (for COT) or post object (for legacy).
     */
    public function add_meta_box($screen_id_or_post_type = null, $order_or_post = null)
    {
        $screen = get_current_screen();
        if (!$screen) {
            return;
        }

        $current_screen_id = $screen->id;
        $is_cot = false;
        $target_screen_id = null;

        // Check if COT is enabled
        if (class_exists('Automattic\WooCommerce\Utilities\OrderUtil')) {
            $is_cot = \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
        }

        if ($is_cot) {
            // COT orders - screen ID contains 'wc-orders'
            if (strpos($current_screen_id, 'wc-orders') === false) {
                return;
            }
            $target_screen_id = $current_screen_id;
        } else {
            // Legacy post-based orders
            if ($current_screen_id !== 'shop_order') {
                return;
            }
            $target_screen_id = 'shop_order';
        }

        // Prepare callback args - pass order if available (for COT)
        $callback_args = [];
        if ($is_cot && $order_or_post instanceof \WC_Order) {
            $callback_args = ['order' => $order_or_post];
        }

        add_meta_box(
            'helpmate_crm_contact',
            __('Helpmate CRM Contact', 'helpmate-ai-chatbot'),
            [$this, 'render_meta_box_content'],
            $target_screen_id,
            'side',
            'default',
            $callback_args
        );
    }

    /**
     * Render meta box content.
     * Called by WordPress meta box system.
     *
     * @since    1.3.0
     * @param    WP_Post|WC_Order    $post_or_order    The post or order object.
     * @param    array               $callback_args     Additional arguments from add_meta_box (7th parameter).
     */
    public function render_meta_box_content($post_or_order, $callback_args = [])
    {
        $order = null;

        // Try to get order from callback args first (for COT)
        if (isset($callback_args['order']) && $callback_args['order'] instanceof \WC_Order) {
            $order = $callback_args['order'];
        } elseif ($post_or_order instanceof \WC_Order) {
            // COT: order passed directly (fallback)
            $order = $post_or_order;
        } elseif ($post_or_order instanceof \WP_Post) {
            // Legacy: get order from post
            $order = wc_get_order($post_or_order->ID);
        }

        if (!$order) {
            return;
        }

        $this->render_metabox_content($order);
    }

    /**
     * Render meta box content.
     *
     * @since    1.3.0
     * @param    WC_Order    $order    The order object.
     */
    private function render_metabox_content($order)
    {
        $order_id = $order->get_id();
        $billing_email = $order->get_billing_email();
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Checking admin action parameter for UI display only, not processing form data
        $is_new_order = $order->get_status() === 'auto-draft' || (isset($_GET['action']) && $_GET['action'] === 'new');

        // Check if contact exists for this order
        $contact = null;
        if ($billing_email) {
            $contact = $this->crm->get_contact_by_email($billing_email);
        }

        wp_nonce_field('helpmate_crm_order_metabox', 'helpmate_crm_order_metabox_nonce');

        if ($is_new_order) {
            // New order - show contact selector
            $this->render_new_order_content();
        } else {
            // Existing order - show contact info or create button
            $this->render_existing_order_content($order, $contact);
        }
    }

    /**
     * Render content for new order page.
     *
     * @since    1.3.0
     */
    private function render_new_order_content()
    {
        ?>
        <div class="helpmate-crm-order-metabox">
            <p class="form-field">
                <label for="helpmate_crm_contact_select"><?php esc_html_e('Select Contact', 'helpmate-ai-chatbot'); ?></label>
                <select id="helpmate_crm_contact_select" class="helpmate-crm-contact-select" style="width: 100%;">
                    <option value=""><?php esc_html_e('Search for a contact...', 'helpmate-ai-chatbot'); ?></option>
                </select>
                <span class="description"><?php esc_html_e('Select a contact to populate billing information.', 'helpmate-ai-chatbot'); ?></span>
            </p>
        </div>
        <?php
    }

    /**
     * Render content for existing order page.
     *
     * @since    1.3.0
     * @param    WC_Order    $order    The order object.
     * @param    array|null  $contact  The contact data or null.
     */
    private function render_existing_order_content($order, $contact)
    {
        ?>
        <div class="helpmate-crm-order-metabox">
            <?php if ($contact): ?>
                <div class="helpmate-crm-contact-info">
                    <p><strong><?php esc_html_e('Contact:', 'helpmate-ai-chatbot'); ?></strong></p>
                    <p>
                        <?php
                        $name = trim(($contact['first_name'] ?? '') . ' ' . ($contact['last_name'] ?? ''));
                        if (empty($name)) {
                            $name = $contact['email'] ?? __('Unknown', 'helpmate-ai-chatbot');
                        } else {
                            $name .= ' (' . esc_html($contact['email'] ?? '') . ')';
                        }
                        echo esc_html($name);
                        ?>
                    </p>
                    <p>
                        <a href="#"
                           class="button button-secondary helpmate-view-contact"
                           data-contact-id="<?php echo esc_attr($contact['id']); ?>"
                           target="_blank">
                            <?php esc_html_e('View Contact Details', 'helpmate-ai-chatbot'); ?>
                        </a>
                    </p>
                </div>
            <?php else: ?>
                <div class="helpmate-crm-no-contact">
                    <p><?php esc_html_e('No CRM contact found for this order.', 'helpmate-ai-chatbot'); ?></p>
                    <?php if ($order->get_billing_email()): ?>
                        <p>
                            <button type="button"
                                    class="button button-primary helpmate-create-contact"
                                    data-order-id="<?php echo esc_attr($order->get_id()); ?>">
                                <?php esc_html_e('Create Contact from Order', 'helpmate-ai-chatbot'); ?>
                            </button>
                        </p>
                    <?php else: ?>
                        <p class="description"><?php esc_html_e('Add billing email to create a contact.', 'helpmate-ai-chatbot'); ?></p>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Enqueue scripts and styles.
     *
     * @since    1.3.0
     */
    public function enqueue_scripts($hook)
    {
        // Check if we're on an order edit page
        $is_order_screen = false;

        if (class_exists('Automattic\WooCommerce\Utilities\OrderUtil')) {
            if (\Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled()) {
                $screen = get_current_screen();
                if ($screen && $screen->id === wc_get_page_screen_id('shop-order')) {
                    $is_order_screen = true;
                }
            } else {
                if ($hook === 'post.php' || $hook === 'post-new.php') {
                    $screen = get_current_screen();
                    if ($screen && $screen->id === 'shop_order') {
                        $is_order_screen = true;
                    }
                }
            }
        } else {
            // Fallback for older WooCommerce
            if ($hook === 'post.php' || $hook === 'post-new.php') {
                $screen = get_current_screen();
                if ($screen && $screen->id === 'shop_order') {
                    $is_order_screen = true;
                }
            }
        }

        if (!$is_order_screen) {
            return;
        }

        // Enqueue Select2/SelectWoo (WooCommerce includes it)
        wp_enqueue_script('selectWoo');
        wp_enqueue_style('select2');

        // Enqueue our scripts
        wp_enqueue_script(
            'helpmate-crm-order-metabox',
            HELPMATE_URL . 'admin/js/helpmate-crm-order-metabox.js',
            ['jquery', 'selectWoo'],
            defined('HELPMATE_VERSION') ? HELPMATE_VERSION : '1.0.0',
            true
        );

        wp_enqueue_style(
            'helpmate-crm-order-metabox',
            HELPMATE_URL . 'admin/css/helpmate-crm-order-metabox.css',
            [],
            defined('HELPMATE_VERSION') ? HELPMATE_VERSION : '1.0.0'
        );

        // Localize script
        wp_localize_script('helpmate-crm-order-metabox', 'helpmateCrmOrderMetabox', [
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('helpmate_crm_order_metabox'),
            'restUrl' => rest_url('helpmate/v1/crm/contacts'),
            'restNonce' => wp_create_nonce('wp_rest'),
            'contactDetailsUrl' => admin_url('admin.php?page=helpmate&tab=crm&subtab=contacts'),
            'i18n' => [
                'searching' => __('Searching...', 'helpmate-ai-chatbot'),
                'noResults' => __('No contacts found', 'helpmate-ai-chatbot'),
                'error' => __('An error occurred. Please try again.', 'helpmate-ai-chatbot'),
                'contactCreated' => __('Contact created successfully!', 'helpmate-ai-chatbot'),
                'contactCreatedError' => __('Failed to create contact.', 'helpmate-ai-chatbot'),
                'confirmOverwrite' => __('Billing information already exists. Do you want to overwrite it with the selected contact information?', 'helpmate-ai-chatbot'),
            ]
        ]);
    }

    /**
     * AJAX handler to get contact details.
     *
     * @since    1.3.0
     */
    public function ajax_get_contact_details()
    {
        check_ajax_referer('helpmate_crm_order_metabox', 'nonce');

        if (!current_user_can('edit_shop_orders')) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action.', 'helpmate-ai-chatbot')]);
        }

        $contact_id = isset($_POST['contact_id']) ? intval($_POST['contact_id']) : 0;
        if (!$contact_id) {
            wp_send_json_error(['message' => __('Invalid contact ID.', 'helpmate-ai-chatbot')]);
        }

        $contact = $this->crm->get_contact($contact_id);
        if (!$contact) {
            wp_send_json_error(['message' => __('Contact not found.', 'helpmate-ai-chatbot')]);
        }

        wp_send_json_success($contact);
    }

    /**
     * AJAX handler to create contact from order.
     *
     * @since    1.3.0
     */
    public function ajax_create_contact_from_order()
    {
        check_ajax_referer('helpmate_crm_order_metabox', 'nonce');

        if (!current_user_can('edit_shop_orders')) {
            wp_send_json_error(['message' => __('You do not have permission to perform this action.', 'helpmate-ai-chatbot')]);
        }

        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        if (!$order_id) {
            wp_send_json_error(['message' => __('Invalid order ID.', 'helpmate-ai-chatbot')]);
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            wp_send_json_error(['message' => __('Order not found.', 'helpmate-ai-chatbot')]);
        }

        // Map order billing fields to contact data
        $contact_data = [
            'first_name' => $order->get_billing_first_name(),
            'last_name' => $order->get_billing_last_name(),
            'email' => $order->get_billing_email(),
            'phone' => $order->get_billing_phone(),
            'address_line_1' => $order->get_billing_address_1(),
            'address_line_2' => $order->get_billing_address_2(),
            'city' => $order->get_billing_city(),
            'state' => $order->get_billing_state(),
            'zip_code' => $order->get_billing_postcode(),
            'country' => $order->get_billing_country(),
            'status' => 'Subscribed',
        ];

        // Check if contact already exists
        if (!empty($contact_data['email'])) {
            $existing = $this->crm->get_contact_by_email($contact_data['email']);
            if ($existing) {
                wp_send_json_error(['message' => __('A contact with this email already exists.', 'helpmate-ai-chatbot'), 'contact' => $existing]);
            }
        }

        $contact_id = $this->crm->create_contact($contact_data);
        if (is_wp_error($contact_id)) {
            wp_send_json_error(['message' => $contact_id->get_error_message()]);
        }

        if (!$contact_id) {
            wp_send_json_error(['message' => __('Failed to create contact.', 'helpmate-ai-chatbot')]);
        }

        $contact = $this->crm->get_contact($contact_id);
        wp_send_json_success(['contact' => $contact, 'message' => __('Contact created successfully!', 'helpmate-ai-chatbot')]);
    }

}

