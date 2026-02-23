<?php

/**
 * The settings handler class for the Helpmate plugin.
 *
 * A class that handles all settings-related functionality for the Helpmate plugin.
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

class Helpmate_Settings
{

    private $settings_cache = [];

    /**
     * Create or update a setting in the database.
     *
     * @since 1.0.0
     * @param string $key The setting key.
     * @param mixed $value The setting value (will be JSON encoded).
     * @return bool True on success, false on failure.
     */
    public function set_setting(string $key, $value): bool
    {
        global $wpdb;

        $data = array(
            'setting_key' => $key,
            'setting_value' => json_encode($value),
            'last_updated' => time()
        );

        $format = array('%s', '%s', '%d');

        $result = $wpdb->replace($wpdb->prefix . 'helpmate_settings', $data, $format); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        if ($result !== false) {
            $this->settings_cache[$key] = $value;
            return true;
        }
        return false;
    }

    /**
     * Get a setting from the database.
     *
     * @since 1.0.0
     * @param string $key The setting key.
     * @param mixed $default The default value to return if setting doesn't exist.
     * @return mixed The setting value or default if not found.
     */
    public function get_setting(string $key, $default = null)
    {
        global $wpdb;

        // Check cache first
        if (isset($this->settings_cache[$key])) {
            return $this->settings_cache[$key];
        }

        $value = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT setting_value FROM {$wpdb->prefix}helpmate_settings WHERE setting_key = %s",
            $key
        ));

        if ($value === null) {
            return $default;
        }

        $decoded_value = json_decode($value, true);
        $this->settings_cache[$key] = $decoded_value;
        return $decoded_value;
    }

    /**
     * Delete a setting from the database.
     *
     * @since 1.0.0
     * @param string $key The setting key to delete.
     * @return bool True on success, false on failure.
     */
    public function delete_setting(string $key): bool
    {
        global $wpdb;

        $result = $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prefix . 'helpmate_settings',
            array('setting_key' => $key),
            array('%s')
        );

        if ($result !== false) {
            // Clear the cache for this setting
            if (isset($this->settings_cache[$key])) {
                unset($this->settings_cache[$key]);
            }
            return true;
        }
        return false;
    }

    /**
     * Check if a setting exists in the database.
     *
     * @since 1.0.0
     * @param string $key The setting key to check.
     * @return bool True if setting exists, false otherwise.
     */
    public function setting_exists(string $key): bool
    {
        global $wpdb;

        $count = $wpdb->get_var($wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*) FROM {$wpdb->prefix}helpmate_settings WHERE setting_key = %s",
            $key
        ));

        return $count > 0;
    }

    /**
     * Check if customization settings have been modified from defaults.
     *
     * @since 1.0.0
     * @return bool True if customization differs from defaults, false otherwise.
     */
    public function has_customization_changes()
    {
        $current_customization = $this->get_setting('customization', []);

        // Default customization values from database defaults
        $default_customization = [
            'bot_name' => 'Helpmate',
            'bot_icon' => '',
            'primary_color' => '#455CFE',
            'primary_gradient' => 'linear-gradient(to top left,#748EFF,#455CFE)',
            'secondary_color' => '#748EFF',
            'secondary_gradient' => '',
            'font_size' => '1rem',
            'sound_effect' => 'notification-1.mp3',
            'icon' => '',
            'icon_size' => '60px',
            'position' => 'right',
            'icon_shape' => 'circle',
        ];

        // Compare current with defaults
        foreach ($default_customization as $key => $default_value) {
            $current_value = isset($current_customization[$key]) ? $current_customization[$key] : null;
            if ($current_value !== $default_value) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if business hours are configured (enabled and at least one day has enabled slot).
     *
     * @since 1.0.0
     * @return bool True if business hours are enabled and at least one day is enabled, false otherwise.
     */
    public function has_business_hours_configured()
    {
        $behavior = $this->get_setting('behavior', []);
        $enabled = !empty($behavior['business_hours_enabled']);
        $hours   = isset($behavior['business_hours']) && is_array($behavior['business_hours']) ? $behavior['business_hours'] : [];

        if (!$enabled || empty($hours)) {
            return false;
        }

        foreach ($hours as $day_config) {
            if (is_array($day_config) && !empty($day_config['enabled'])) {
                return true;
            }
        }

        return false;
    }
}