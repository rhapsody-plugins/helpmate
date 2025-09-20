<?php

/**
 * The promo banner module class.
 *
 * This is used to define all functionality related to promo banners.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class Helpmate_Promo_Banner
{
    /**
     * The plugin instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate_Settings    $settings    The settings instance.
     */
    private $settings;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     * @param    Helpmate_Settings    $settings    The settings instance.
     */
    public function __construct($settings)
    {
        $this->settings = $settings;

        // Register shortcode
        add_shortcode('helpmate_promo', array($this, 'promo_banner_shortcode'));

        // Add display action based on position
        add_action('wp_body_open', array($this, 'display_promo_banners_top'));
        add_action('wp_footer', array($this, 'display_promo_banners_bottom'));

        // Initialize cron job for banner expiration
        $this->init_cron_job();
    }

    /**
     * Initialize the cron job for checking banner expiration.
     *
     * @since 1.0.0
     */
    private function init_cron_job(): void
    {
        // Add custom cron schedule for banner expiration checks
        add_filter('cron_schedules', array($this, 'add_cron_schedule'));

        // Schedule the cron job if not already scheduled
        if (!wp_next_scheduled('helpmate_check_banner_expiration')) {
            wp_schedule_event(time(), 'helpmate_banner_expiration_interval', 'helpmate_check_banner_expiration');
        }

        // Add the cron job handler
        add_action('helpmate_check_banner_expiration', array($this, 'check_and_deactivate_expired_banners'));
    }

    /**
     * Add custom cron schedule for banner expiration checks.
     *
     * @since 1.0.0
     * @param array $schedules The existing cron schedules.
     * @return array The updated cron schedules.
     */
    public function add_cron_schedule($schedules): array
    {
        $schedules['helpmate_banner_expiration_interval'] = array(
            'interval' => 300, // 5 minutes
            'display' => __('Every 5 minutes', 'helpmate-ai-chatbot')
        );
        return $schedules;
    }

    /**
     * Check and deactivate expired banners.
     *
     * @since 1.0.0
     */
    public function check_and_deactivate_expired_banners(): void
    {
        global $wpdb;
        $current_time = time() * 1000; // Convert to milliseconds to match the stored format

        $expired_banners = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $wpdb->prepare(
                "SELECT id, title FROM {$wpdb->prefix}helpmate_promo_banners WHERE status = %s AND end_datetime IS NOT NULL AND end_datetime < %d",
                'active',
                $current_time
            ),
            ARRAY_A
        );

        if (empty($expired_banners)) {
            return;
        }

        // Deactivate expired banners
        $result = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $wpdb->prepare(
                "UPDATE {$wpdb->prefix}helpmate_promo_banners SET status = %s, updated_at = %d WHERE status = %s AND end_datetime IS NOT NULL AND end_datetime < %d",
                'inactive',
                time(),
                'active',
                $current_time
            )
        );
    }

    /**
     * Schedule expiration check for a specific banner.
     *
     * @since 1.0.0
     * @param int $banner_id The banner ID.
     * @param int $end_datetime The end datetime in milliseconds.
     */
    private function schedule_banner_expiration($banner_id, $end_datetime): void
    {
        if (!$end_datetime) {
            return;
        }

        // Convert milliseconds to seconds for WordPress cron
        $expiration_time = intval($end_datetime / 1000);

        // Schedule a single event for this banner's expiration
        $hook_name = 'helpmate_banner_expire_' . $banner_id;

        // Clear any existing expiration event for this banner
        wp_clear_scheduled_hook($hook_name);

        // Schedule the expiration event
        wp_schedule_single_event($expiration_time, $hook_name, array($banner_id));

        // Add the handler for this specific banner
        add_action($hook_name, array($this, 'deactivate_specific_banner'), 10, 1);
    }

    /**
     * Deactivate a specific banner.
     *
     * @since 1.0.0
     * @param int $banner_id The banner ID to deactivate.
     */
    public function deactivate_specific_banner($banner_id): void
    {
        global $wpdb;
        $table_name = $wpdb->prefix . 'helpmate_promo_banners';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $result = $wpdb->update(
            $table_name,
            array(
                'status' => 'inactive',
                'updated_at' => time()
            ),
            array('id' => $banner_id),
            array('%s', '%d'),
            array('%d')
        );
    }

    /**
     * Check if promo banner is enabled.
     *
     * @since 1.0.0
     * @return bool True if promo banner is enabled, false otherwise.
     */
    public function is_enabled(): bool
    {
        $settings = $this->settings->get_setting('modules');
        if ($settings && isset($settings[HELPMATE_MODULE_PROMO_BANNER])) {
            return $settings[HELPMATE_MODULE_PROMO_BANNER];
        } else {
            return false;
        }
    }

    /**
     * Enqueue promo banner assets.
     *
     * @since 1.0.0
     * @return void
     */
    public function enqueue_assets(): void
    {
        if (!$this->is_enabled()) {
            return;
        }

        // Enqueue styles
        wp_enqueue_style(
            'helpmate-promo-banner',
            HELPMATE_URL . 'public/css/promo-banner.css',
            array(),
            HELPMATE_VERSION,
            'all'
        );

        // Enqueue scripts
        wp_enqueue_script(
            'helpmate-promo-banner',
            HELPMATE_URL . 'public/js/promo-banner.js',
            array('jquery'),
            HELPMATE_VERSION,
            true // Load in footer
        );
    }

    /**
     * Generate a unique shortcode for a promo banner.
     *
     * @since 1.0.0
     * @return string The generated shortcode.
     */
    private function generate_shortcode(): string
    {
        global $wpdb;

        do {
            // Generate a random 8-character string
            $shortcode = 'helpmate_promo_' . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 8);

            // Check if the shortcode already exists
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $exists = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_promo_banners WHERE shortcode = %s",
                $shortcode
            ));
        } while ($exists > 0);

        return $shortcode;
    }

    /**
     * Get all promo banners.
     *
     * @since 1.0.0
     * @param int $page Page number (default: 1)
     * @param int $per_page Number of items per page (default: 10)
     * @return WP_REST_Response Response containing banners and pagination info.
     */
    public function get_all_banners(int $page = 1, int $per_page = 10): WP_REST_Response
    {
        try {
            global $wpdb;

            // Calculate offset
            $offset = ($page - 1) * $per_page;

            // Get total count
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total_items = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_promo_banners");

            // Get paginated results
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $banners = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$wpdb->prefix}helpmate_promo_banners ORDER BY created_at DESC LIMIT %d OFFSET %d",
                    $per_page,
                    $offset
                ),
                ARRAY_A
            );

            if (!$banners) {
                return new WP_REST_Response([
                    'error' => false,
                    'items' => [],
                    'pagination' => [
                        'total' => 0,
                        'per_page' => $per_page,
                        'current_page' => $page,
                        'total_pages' => 0,
                    ]
                ], 200);
            }

            $total_pages = ceil($total_items / $per_page);

            return new WP_REST_Response([
                'error' => false,
                'items' => array_map(function ($banner) {
                    $banner['metadata'] = json_decode($banner['metadata'], true);
                    return $banner;
                }, $banners),
                'pagination' => [
                    'total' => (int) $total_items,
                    'per_page' => $per_page,
                    'current_page' => $page,
                    'total_pages' => $total_pages,
                ]
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a new promo banner.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response The created banner or error.
     */
    public function create_banner($request): WP_REST_Response
    {
        try {
            global $wpdb;

            $body = json_decode($request->get_body(), true);

            if (!isset($body['title']) || !isset($body['metadata'])) {
                return new WP_REST_Response([
                    'error' => 'missing_required_fields',
                    'message' => 'Title and metadata are required'
                ], 400);
            }

            $data = [
                'title' => sanitize_text_field($body['title']),
                'status' => isset($body['status']) ? sanitize_text_field($body['status']) : 'active',
                'start_datetime' => isset($body['start_datetime']) ? (int) $body['start_datetime'] : null,
                'end_datetime' => isset($body['end_datetime']) ? (int) $body['end_datetime'] : null,
                'metadata' => json_encode($body['metadata']),
                'created_at' => time(),
                'updated_at' => time()
            ];

            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $result = $wpdb->insert($wpdb->prefix . 'helpmate_promo_banners', $data);

            if ($result === false) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Failed to create promo banner'
                ], 500);
            }

            $banner_id = $wpdb->insert_id;
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $banner = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d", $banner_id),
                ARRAY_A
            );

            $banner['metadata'] = json_decode($banner['metadata'], true);

            // Schedule expiration check if end_datetime is set
            if (isset($data['end_datetime']) && $data['end_datetime']) {
                $this->schedule_banner_expiration($banner_id, $data['end_datetime']);
            }

            return new WP_REST_Response([
                'error' => false,
                'item' => $banner
            ], 201);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update an existing promo banner.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response The updated banner or error.
     */
    public function update_banner($request): WP_REST_Response
    {
        try {
            global $wpdb;

            $banner_id = intval($request->get_param('id'));
            if (!$banner_id) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Invalid banner ID'
                ], 400);
            }

            $body = json_decode($request->get_body(), true);

            if (!isset($body['title']) || !isset($body['metadata'])) {
                return new WP_REST_Response([
                    'error' => 'missing_required_fields',
                    'message' => 'Title and metadata are required'
                ], 400);
            }

            // Check if banner exists
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $existing_banner = $wpdb->get_row(
                $wpdb->prepare("SELECT id FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d", $banner_id),
                ARRAY_A
            );

            if (!$existing_banner) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Banner not found'
                ], 404);
            }

            $data = [
                'title' => sanitize_text_field($body['title']),
                'status' => isset($body['status']) ? sanitize_text_field($body['status']) : 'active',
                'start_datetime' => isset($body['start_datetime']) ? (int) $body['start_datetime'] : null,
                'end_datetime' => isset($body['end_datetime']) ? (int) $body['end_datetime'] : null,
                'metadata' => json_encode($body['metadata']),
                'updated_at' => time()
            ];

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $result = $wpdb->update(
                $wpdb->prefix . 'helpmate_promo_banners',
                $data,
                ['id' => $banner_id],
                array('%s', '%s', '%d', '%d', '%s', '%d'),
                array('%d')
            );

            if ($result === false) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Failed to update promo banner'
                ], 500);
            }

            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $banner = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d", $banner_id),
                ARRAY_A
            );

            $banner['metadata'] = json_decode($banner['metadata'], true);

            // Schedule expiration check if end_datetime is set
            if (isset($data['end_datetime']) && $data['end_datetime']) {
                $this->schedule_banner_expiration($banner_id, $data['end_datetime']);
            } else {
                // Clear any existing expiration event if end_datetime is removed
                $hook_name = 'helpmate_banner_expire_' . $banner_id;
                wp_clear_scheduled_hook($hook_name);
            }

            return new WP_REST_Response([
                'error' => false,
                'item' => $banner
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a promo banner.
     *
     * @since 1.0.0
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response Success message or error.
     */
    public function delete_banner($request): WP_REST_Response
    {
        try {
            global $wpdb;

            $banner_id = intval($request->get_param('id'));
            if (!$banner_id) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Invalid banner ID'
                ], 400);
            }

            // Check if banner exists
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $existing_banner = $wpdb->get_row(
                $wpdb->prepare("SELECT id FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d", $banner_id),
                ARRAY_A
            );

            if (!$existing_banner) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Banner not found'
                ], 404);
            }

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $result = $wpdb->delete(
                $wpdb->prefix . 'helpmate_promo_banners',
                ['id' => $banner_id],
                array('%d')
            );

            if ($result === false) {
                return new WP_REST_Response([
                    'error' => true,
                    'message' => 'Failed to delete promo banner'
                ], 500);
            }

            // Clear any scheduled expiration event for this banner
            $hook_name = 'helpmate_banner_expire_' . $banner_id;
            wp_clear_scheduled_hook($hook_name);

            return new WP_REST_Response([
                'error' => false,
                'message' => 'Promo banner deleted successfully'
            ], 200);
        } catch (Exception $e) {
            return new WP_REST_Response([
                'error' => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Render a promo banner.
     *
     * @param array $banner The banner data.
     * @return void
     */
    public function render_promo_banner($banner) {
        if (!$banner || !isset($banner['metadata'])) {
            return;
        }

        $metadata = $banner['metadata'];
        $current_time = time() * 1000;
        $start_time = isset($banner['start_datetime']) ? (int) $banner['start_datetime'] : null;
        $end_time = isset($banner['end_datetime']) ? (int) $banner['end_datetime'] : null;

        // Check if banner is within its date range
        if (($start_time && $current_time < $start_time) || ($end_time && $current_time > $end_time)) {
            return;
        }

        // Check user login status
        if (isset($metadata['display_for'])) {
            $is_logged_in = is_user_logged_in();
            switch ($metadata['display_for']) {
                case 'loggedin':
                    if (!$is_logged_in) return;
                    break;
                case 'loggedout':
                    if ($is_logged_in) return;
                    break;
                case 'everyone':
                    break;
            }
        }

        // Generate unique ID for this banner
        $banner_id = 'helpmate-promo-banner-' . $banner['id'];

        // Prepare banner data for JavaScript
        $banner_data = array(
            'id' => $banner_id,
            'metadata' => $metadata,
            'start_datetime' => $start_time,
            'end_datetime' => $end_time,
        );

        // Add banner data to JavaScript
        $script_data = 'window.helpmatePromoBanners = window.helpmatePromoBanners || []; window.helpmatePromoBanners.push(' . wp_json_encode($banner_data) . ');';

        // Add inline script
        wp_add_inline_script('helpmate-promo-banner', $script_data);

        // Generate banner HTML
        $position_class = isset($metadata['position']) ? 'helpmate-promo-banner-' . esc_attr($metadata['position']) : 'helpmate-promo-banner-top';
        $sticky_class = isset($metadata['sticky_bar']) && $metadata['sticky_bar'] ? 'helpmate-promo-banner-sticky' : '';
        $mobile_class = isset($metadata['mobile_visibility']) && !$metadata['mobile_visibility'] ? 'helpmate-promo-banner-hide-mobile' : '';
        $close_position = isset($metadata['close_button_position']) ? esc_attr($metadata['close_button_position']) : 'right';
        $layout = isset($metadata['layout']) ? esc_attr($metadata['layout']) : '1';

        ?>
        <div id="<?php echo esc_attr($banner_id); ?>"
             class="helpmate-promo-banner <?php echo esc_attr($position_class . ' ' . $sticky_class . ' ' . $mobile_class); ?>"
             data-layout="<?php echo esc_attr($layout); ?>"
             style="background-color: <?php echo esc_attr($metadata['background_color']); ?>;
                    color: <?php echo esc_attr($metadata['text_color']); ?>;
                    font-size: <?php echo esc_attr($metadata['text_font_size']); ?>;">

            <div class="helpmate-promo-banner-content">
                <?php if ($layout === '1'): ?>
                    <!-- Layout 1: Summer Sale Style -->
                    <div class="helpmate-promo-banner-text">
                        <div class="helpmate-promo-banner-main-text">
                            <?php echo esc_html($banner['title'] ?? ''); ?>
                        </div>
                        <div class="helpmate-promo-banner-separator"></div>
                        <div class="helpmate-promo-banner-description">
                            <?php echo wp_kses_post($metadata['text']); ?>
                        </div>
                    </div>

                    <?php if (isset($metadata['countdown_enabled']) && $metadata['countdown_enabled'] && $end_time) : ?>
                        <div class="helpmate-promo-banner-countdown">
                            <div class="helpmate-promo-banner-countdown-box" style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; border-radius: 7px;">
                                <div class="helpmate-promo-banner-countdown-number"
                                     data-type="days"
                                     style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; color: <?php echo esc_attr($metadata['countdown_text_color'] ?? '#1976d2'); ?>;">00</div>
                                <div class="helpmate-promo-banner-countdown-label"
                                     style="background-color: <?php echo esc_attr($metadata['button_background_color'] ?? '#1976d2'); ?>; color: white;">Day</div>
                            </div>
                            <div class="helpmate-promo-banner-countdown-box" style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; border-radius: 7px;">
                                <div class="helpmate-promo-banner-countdown-number"
                                     data-type="hours"
                                     style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; color: <?php echo esc_attr($metadata['countdown_text_color'] ?? '#1976d2'); ?>;">00</div>
                                <div class="helpmate-promo-banner-countdown-label"
                                     style="background-color: <?php echo esc_attr($metadata['button_background_color'] ?? '#1976d2'); ?>; color: white;">Hour</div>
                            </div>
                            <div class="helpmate-promo-banner-countdown-box" style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; border-radius: 7px;">
                                <div class="helpmate-promo-banner-countdown-number"
                                     data-type="minutes"
                                     style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; color: <?php echo esc_attr($metadata['countdown_text_color'] ?? '#1976d2'); ?>;">00</div>
                                <div class="helpmate-promo-banner-countdown-label"
                                     style="background-color: <?php echo esc_attr($metadata['button_background_color'] ?? '#1976d2'); ?>; color: white;">Min</div>
                            </div>
                            <div class="helpmate-promo-banner-countdown-box" style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; border-radius: 7px;">
                                <div class="helpmate-promo-banner-countdown-number"
                                     data-type="seconds"
                                     style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#e3f2fd'); ?>; color: <?php echo esc_attr($metadata['countdown_text_color'] ?? '#1976d2'); ?>;">00</div>
                                <div class="helpmate-promo-banner-countdown-label"
                                     style="background-color: <?php echo esc_attr($metadata['button_background_color'] ?? '#1976d2'); ?>; color: white;">Sec</div>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($metadata['button_text']) && !empty($metadata['button_url'])) : ?>
                        <a href="<?php echo esc_url($metadata['button_url']); ?>"
                           class="helpmate-promo-banner-button"
                           style="background-color: <?php echo esc_attr($metadata['button_background_color']); ?>;
                                  color: <?php echo esc_attr($metadata['button_text_color']); ?>;
                                  font-size: <?php echo esc_attr($metadata['button_text_font_size']); ?>;"
                           <?php echo isset($metadata['open_in_new_tab']) && $metadata['open_in_new_tab'] ? 'target="_blank"' : ''; ?>>
                            <?php
                            $button_icon = isset($metadata['button_icon']) ? $metadata['button_icon'] : 'none';
                            $icon_position = isset($metadata['button_icon_position']) ? $metadata['button_icon_position'] : 'right';

                            // Show icon on left if position is left
                            if ($button_icon && $button_icon !== 'none' && $icon_position === 'left') {
                                echo wp_kses_post($this->get_button_icon_html($button_icon));
                            }
                            ?>
                            <?php echo esc_html($metadata['button_text']); ?>
                            <?php
                            // Show icon on right if position is right or not specified
                            if ($button_icon && $button_icon !== 'none' && $icon_position === 'right') {
                                echo wp_kses_post($this->get_button_icon_html($button_icon));
                            }
                            ?>
                        </a>
                    <?php endif; ?>

                                <?php elseif ($layout === '2'): ?>
                    <!-- Layout 2: Winter Sale Style -->
                    <div class="helpmate-promo-banner-text">
                        <div class="helpmate-promo-banner-main-text">
                            <?php echo esc_html($banner['title'] ?? ''); ?>
                        </div>

                        <?php if (isset($metadata['countdown_enabled']) && $metadata['countdown_enabled'] && $end_time) : ?>
                            <div class="helpmate-promo-banner-countdown">
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="days"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">Day</div>
                                </div>
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="hours"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">Hour</div>
                                </div>
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="minutes"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">Min</div>
                                </div>
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="seconds"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#1976d2'); ?>; color: white;">Sec</div>
                                </div>
                            </div>
                        <?php endif; ?>

                        <div class="helpmate-promo-banner-description">
                            <?php echo wp_kses_post($metadata['text']); ?>
                        </div>
                    </div>

                    <div class="helpmate-promo-banner-separator"></div>

                    <?php if (!empty($metadata['button_text']) && !empty($metadata['button_url'])) : ?>
                        <a href="<?php echo esc_url($metadata['button_url']); ?>"
                           class="helpmate-promo-banner-button"
                           style="background-color: <?php echo esc_attr($metadata['button_background_color']); ?>;
                                  color: <?php echo esc_attr($metadata['button_text_color']); ?>;
                                  font-size: <?php echo esc_attr($metadata['button_text_font_size']); ?>;"
                           <?php echo isset($metadata['open_in_new_tab']) && $metadata['open_in_new_tab'] ? 'target="_blank"' : ''; ?>>
                            <?php
                            $button_icon = isset($metadata['button_icon']) ? $metadata['button_icon'] : 'none';
                            $icon_position = isset($metadata['button_icon_position']) ? $metadata['button_icon_position'] : 'right';

                            // Show icon on left if position is left
                            if ($button_icon && $button_icon !== 'none' && $icon_position === 'left') {
                                echo wp_kses_post($this->get_button_icon_html($button_icon));
                            }
                            ?>
                            <?php echo esc_html($metadata['button_text']); ?>
                            <?php
                            // Show icon on right if position is right or not specified
                            if ($button_icon && $button_icon !== 'none' && $icon_position === 'right') {
                                echo wp_kses_post($this->get_button_icon_html($button_icon));
                            }
                            ?>
                        </a>
                    <?php endif; ?>

                <?php else: ?>
                                        <!-- Layout 3: Black Friday Style -->
                    <div class="helpmate-promo-banner-content-wrapper">
                        <?php if (isset($metadata['countdown_enabled']) && $metadata['countdown_enabled'] && $end_time) : ?>
                            <div class="helpmate-promo-banner-countdown">
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="days"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#4caf50'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: transparent; color: white;">DAY</div>
                                </div>
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="hours"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#4caf50'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: transparent; color: white;">HOUR</div>
                                </div>
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="minutes"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#4caf50'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: transparent; color: white;">MIN</div>
                                </div>
                                <div class="helpmate-promo-banner-countdown-box">
                                    <div class="helpmate-promo-banner-countdown-number"
                                         data-type="seconds"
                                         style="background-color: <?php echo esc_attr($metadata['countdown_background_color'] ?? '#4caf50'); ?>; color: white;">00</div>
                                    <div class="helpmate-promo-banner-countdown-label"
                                         style="background-color: transparent; color: white;">SEC</div>
                                </div>
                            </div>
                        <?php endif; ?>

                        <div class="helpmate-promo-banner-text">
                            <div class="helpmate-promo-banner-main-text">
                                <?php echo esc_html($banner['title'] ?? ''); ?>
                            </div>
                            <div class="helpmate-promo-banner-description">
                                <?php echo wp_kses_post($metadata['text']); ?>
                            </div>
                        </div>

                        <?php if (!empty($metadata['button_text']) && !empty($metadata['button_url'])) : ?>
                            <a href="<?php echo esc_url($metadata['button_url']); ?>"
                               class="helpmate-promo-banner-button"
                               style="color: <?php echo esc_attr($metadata['button_text_color']); ?>;
                                      font-size: <?php echo esc_attr($metadata['button_text_font_size']); ?>;"
                               <?php echo isset($metadata['open_in_new_tab']) && $metadata['open_in_new_tab'] ? 'target="_blank"' : ''; ?>>
                                <?php
                                $button_icon = isset($metadata['button_icon']) ? $metadata['button_icon'] : 'none';
                                $icon_position = isset($metadata['button_icon_position']) ? $metadata['button_icon_position'] : 'right';

                                // Show icon on left if position is left
                                if ($button_icon && $button_icon !== 'none' && $icon_position === 'left') {
                                    echo wp_kses_post($this->get_button_icon_html($button_icon));
                                }
                                ?>
                                <?php echo esc_html($metadata['button_text']); ?>
                                <?php
                                // Show icon on right if position is right or not specified
                                if ($button_icon && $button_icon !== 'none' && $icon_position === 'right') {
                                    echo wp_kses_post($this->get_button_icon_html($button_icon));
                                }
                                ?>
                            </a>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>
            </div>

            <?php if (isset($metadata['display_close_button']) && $metadata['display_close_button']) : ?>
                <button class="helpmate-promo-banner-close"
                        style="color: <?php echo esc_attr($metadata['close_button_color']); ?>;"
                        data-position="<?php echo esc_attr($close_position); ?>"
                        data-permanent="<?php echo isset($metadata['permanent_close']) && $metadata['permanent_close'] ? 'true' : 'false'; ?>">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Register shortcode for promo banner.
     *
     * @param array $atts Shortcode attributes.
     * @return string
     */
    public function promo_banner_shortcode($atts) {
        $atts = shortcode_atts(array(
            'id' => '',
        ), $atts);

        if (empty($atts['id'])) {
            return '';
        }

        $banner_id = intval($atts['id']);
        if (!$banner_id) {
            return '';
        }

        global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $banner = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE id = %d AND status = %s",
                $banner_id,
                'active'
            ),
            ARRAY_A
        );

        if (!$banner) {
            return '';
        }

        $banner['metadata'] = json_decode($banner['metadata'], true);
        ob_start();
        $this->render_promo_banner($banner);
        return ob_get_clean();
    }

    /**
     * Display active promo banners at the top.
     */
    public function display_promo_banners_top() {
        $this->display_promo_banners('top');
    }

    /**
     * Display active promo banners at the bottom.
     */
    public function display_promo_banners_bottom() {
        $this->display_promo_banners('bottom');
    }

    /**
     * Reschedule expiration events for all active banners with end dates.
     * This should be called on plugin activation or when needed.
     *
     * @since 1.0.0
     */
    public function reschedule_all_banner_expirations(): void
    {
        global $wpdb;
        $current_time = time() * 1000; // Current time in milliseconds

        // Get all active banners with end dates that haven't expired yet
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $active_banners = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, end_datetime FROM {$wpdb->prefix}helpmate_promo_banners WHERE status = %s AND end_datetime IS NOT NULL AND end_datetime > %d",
                'active',
                $current_time
            ),
            ARRAY_A
        );

        foreach ($active_banners as $banner) {
            $this->schedule_banner_expiration($banner['id'], $banner['end_datetime']);
        }
    }

    /**
     * Clear all scheduled expiration events.
     * This should be called on plugin deactivation.
     *
     * @since 1.0.0
     */
    public function clear_all_banner_expirations(): void
    {
        global $wpdb;

        // Get all banner IDs
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $banner_ids = $wpdb->get_col("SELECT id FROM {$wpdb->prefix}helpmate_promo_banners");

        foreach ($banner_ids as $banner_id) {
            $hook_name = 'helpmate_banner_expire_' . $banner_id;
            wp_clear_scheduled_hook($hook_name);
        }

        // Clear the main expiration check cron
        wp_clear_scheduled_hook('helpmate_check_banner_expiration');
    }

    /**
     * Display active promo banners.
     */
    public function display_promo_banners($position = null) {
        // Check if promo banner module is enabled
        if (!$this->is_enabled()) {
            return;
        }

        // Check if any shortcode is being used on the current page
        global $post;
        if ($post && has_shortcode($post->post_content, 'helpmate_promo')) {
            return;
        }

        global $wpdb;
        $current_time = time() * 1000;

        // Get active banners that are within their date range
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $banners = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}helpmate_promo_banners WHERE status = %s AND (start_datetime IS NULL OR start_datetime <= %d) AND (end_datetime IS NULL OR end_datetime >= %d) ORDER BY created_at DESC",
                'active',
                $current_time,
                $current_time
            ),
            ARRAY_A
        );

        if (!$banners) {
            return;
        }

        // Get current page ID more reliably
        $current_page_id = get_the_ID();
        if (!$current_page_id) {
            // Try to get page ID from query vars
            global $wp_query;
            if (isset($wp_query->queried_object_id)) {
                $current_page_id = $wp_query->queried_object_id;
            }
        }

        foreach ($banners as $banner) {
            $banner['metadata'] = json_decode($banner['metadata'], true);

            // Only show banners that match the current position
            if ($position && (!isset($banner['metadata']['position']) || $banner['metadata']['position'] !== $position)) {
                continue;
            }

            // Check if banner should be displayed on current page
            if (isset($banner['metadata']['show_on'])) {
                switch ($banner['metadata']['show_on']) {
                    case 'shortcode':
                        continue 2;
                    case 'selected':
                        if (!isset($banner['metadata']['selected_pages']) || !in_array($current_page_id, $banner['metadata']['selected_pages'])) {
                            continue 2; // Skip this banner
                        }
                        break;
                    case 'hide_selected':
                        // If we're on a page that's in the selected_pages array, skip this banner
                        if (isset($banner['metadata']['selected_pages']) && is_array($banner['metadata']['selected_pages'])) {
                            // Convert all values to integers for comparison
                            $selected_pages = array_map('intval', $banner['metadata']['selected_pages']);
                            $current_page_id = intval($current_page_id);

                            if (in_array($current_page_id, $selected_pages)) {
                                continue 2; // Skip this banner
                            }
                        }
                        break;
                }
            }

            // Check user login status
            if (isset($banner['metadata']['display_for'])) {
                $is_logged_in = is_user_logged_in();
                switch ($banner['metadata']['display_for']) {
                    case 'loggedin':
                        if (!$is_logged_in) continue 2;
                        break;
                    case 'loggedout':
                        if ($is_logged_in) continue 2;
                        break;
                }
            }

            // If we get here, display the banner
            $this->render_promo_banner($banner);
        }
    }

    /**
     * Get default template styles for each layout.
     *
     * @since 1.0.0
     * @param string $layout The layout number (1, 2, or 3).
     * @return array The default styles for the specified layout.
     */
    public function get_default_template_styles($layout = '1'): array
    {
        $templates = [
            '1' => [
                'name' => 'Summer Sale',
                'description' => 'Clean and modern design with light countdown boxes',
                'background_color' => '#2E3192',
                'text_color' => '#FFFFFF',
                'button_background_color' => '#3E40ED',
                'button_text_color' => '#FFFFFF',
                'button_icon' => 'shopping-bag',
                'button_icon_position' => 'right',
                'countdown_background_color' => '#DEE8FF',
                'countdown_text_color' => '#2E3192',
                'close_button_color' => '#9CB8FF',
                'text_font_size' => '16px',
                'button_text_font_size' => '14px',
                'countdown_text_font_size' => '14px',
                'position' => 'top',
                'sticky_bar' => true,
                'display_close_button' => true,
                'mobile_visibility' => true,
                'countdown_enabled' => true,
                'title' => 'Summer Sale',
                'text' => 'Lorem ipsum dolor sit amet consectetur.',
                'button_text' => 'Shop Now',
                'button_url' => '#',
            ],
            '2' => [
                'name' => 'Winter Sale',
                'description' => 'Elegant design with dark countdown boxes',
                'background_color' => '#3E40ED',
                'text_color' => '#FFFFFF',
                'button_background_color' => '#2E3192',
                'button_text_color' => '#FFFFFF',
                'button_icon' => 'shopping-bag',
                'button_icon_position' => 'left',
                'countdown_background_color' => '#2E3192',
                'countdown_text_color' => '#FFFFFF',
                'close_button_color' => '#93c5fd',
                'text_font_size' => '16px',
                'button_text_font_size' => '14px',
                'countdown_text_font_size' => '14px',
                'position' => 'top',
                'sticky_bar' => true,
                'display_close_button' => true,
                'mobile_visibility' => true,
                'countdown_enabled' => true,
                'title' => 'Winter Sale',
                'text' => 'Lorem ipsum dolor sit amet consectetur.',
                'button_text' => 'Shop Now',
                'button_url' => '#',
            ],
            '3' => [
                'name' => 'Black Friday',
                'description' => 'Bold design with green countdown and outlined button',
                'background_color' => '#042D4D',
                'text_color' => '#FFFFFF',
                'button_background_color' => 'transparent',
                'button_text_color' => '#FFFFFF',
                'button_icon' => 'shopping-bag',
                'button_icon_position' => 'right',
                'countdown_background_color' => '#042D4D',
                'countdown_text_color' => '#FFFFFF',
                'close_button_color' => '#93c5fd',
                'text_font_size' => '16px',
                'button_text_font_size' => '14px',
                'countdown_text_font_size' => '14px',
                'position' => 'top',
                'sticky_bar' => true,
                'display_close_button' => true,
                'mobile_visibility' => true,
                'countdown_enabled' => true,
                'title' => 'Black Friday',
                'text' => 'Lorem ipsum dolor sit amet consectetur.',
                'button_text' => 'Shop Now',
                'button_url' => '#',
            ],
        ];

        return isset($templates[$layout]) ? $templates[$layout] : $templates['1'];
    }

    /**
     * Get all available templates.
     *
     * @since 1.0.0
     * @return array All available templates with their metadata.
     */
    public function get_all_templates(): array
    {
        return [
            '1' => $this->get_default_template_styles('1'),
            '2' => $this->get_default_template_styles('2'),
            '3' => $this->get_default_template_styles('3'),
        ];
    }

    /**
     * Get HTML for button icon based on icon name.
     *
     * @since 1.0.0
     * @param string $icon_name The icon name.
     * @return string The HTML for the icon.
     */
    private function get_button_icon_html($icon_name): string
    {
        $icon_class = 'helpmate-promo-banner-button-icon';

        // Handle custom SVG icons (if the icon name contains SVG content)
        if (strpos($icon_name, '<svg') === 0) {
            // Extract the SVG content and add the icon class
            $svg_content = $icon_name;
            if (strpos($svg_content, 'class="') !== false) {
                // Replace existing class attribute
                $svg_content = preg_replace('/class="[^"]*"/', 'class="' . $icon_class . '"', $svg_content);
            } else {
                // Add class attribute to the first SVG tag
                $svg_content = preg_replace('/<svg/', '<svg class="' . $icon_class . '"', $svg_content, 1);
            }
            return $svg_content;
        }

        // Handle custom icon names that might be stored as custom icons
        if (strpos($icon_name, 'custom_') === 0) {
            // For custom icons, you might want to store the SVG content in a separate field
            // For now, we'll return a default icon
            return '<svg xmlns="http://www.w3.org/2000/svg" class="' . $icon_class . '" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>';
        }

        switch ($icon_name) {
            case 'shopping-cart':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-shopping-cart-icon lucide-shopping-cart"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';

            case 'arrow-right':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-arrow-right-icon lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

            case 'external-link':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-external-link-icon lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

            case 'star':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-star-icon lucide-star"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';

            case 'heart':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>';

            case 'gift':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-gift-icon lucide-gift"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>';

            case 'tag':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-tag-icon lucide-tag"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>';

            case 'zap':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-zap-icon lucide-zap"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>';

            case 'check-circle':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-circle-check-icon lucide-circle-check"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';

            case 'play':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-play-icon lucide-play"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

            case 'download':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-download-icon lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';

            case 'mail':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-mail-icon lucide-mail"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>';

            case 'phone':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-phone-icon lucide-phone"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>';

            case 'map-pin':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-map-pin-icon lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';

            case 'clock':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-clock-icon lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>';

            case 'calendar':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-calendar-icon lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';

            case 'shopping-bag':
                return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . $icon_class . ' lucide lucide-shopping-bag-icon lucide-shopping-bag"><path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></svg>';

            default:
                return '<svg class="' . $icon_class . '" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>';
        }
    }
}