<?php

/**
 * The settings handler class for the HelpMate plugin.
 *
 * A class that handles all settings-related functionality for the HelpMate plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Settings
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
}