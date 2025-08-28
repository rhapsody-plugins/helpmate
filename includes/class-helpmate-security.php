<?php

/**
 * Security class for HelpMate plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/includes
 */

/**
 * Security class for HelpMate plugin.
 *
 * This class defines all code necessary to run during the plugin's security checks.
 *
 * @since      1.0.0
 * @package    HelpMate
 * @subpackage HelpMate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

class HelpMate_Security
{
    /**
     * The settings instance.
     *
     * @var HelpMate_Settings
     */
    private $settings;

    /**
     * The heartbeat interval in seconds.
     *
     * @var int
     */
    private $heartbeat_interval = 300; // 5 minutes

    /**
     * Constructor
     *
     * @param HelpMate_Settings $settings The settings instance.
     */
    public function __construct(HelpMate_Settings $settings)
    {
        $this->settings = $settings;

        // Schedule heartbeat
        if (!wp_next_scheduled('helpmate_security_heartbeat')) {
            wp_schedule_event(time(), 'helpmate_five_minutes', 'helpmate_security_heartbeat');
        }

        // Add heartbeat handler
        add_action('helpmate_security_heartbeat', array($this, 'run_security_checks'));

        // Add custom cron schedule
        add_filter('cron_schedules', array($this, 'add_cron_schedule'));
    }

    /**
     * Add a custom cron schedule.
     *
     * @param array $schedules The existing cron schedules.
     * @return array The updated cron schedules.
     */
    public function add_cron_schedule($schedules)
    {
        $schedules['helpmate_five_minutes'] = array(
            'interval' => $this->heartbeat_interval,
            'display' => __('Every 5 minutes', 'helpmate')
        );
        return $schedules;
    }

    /**
     * Run the security checks.
     */
    public function run_security_checks()
    {
        // Check if plugin is disabled
        if (!is_plugin_active('helpmate/helpmate.php')) {
            $this->log_security_event('plugin_disabled', array(
                'time' => current_time('mysql'),
                'user' => wp_get_current_user()->user_login
            ));
        }

        // Check for suspicious activities
        $this->check_suspicious_activities();
    }

    /**
     * Check for suspicious activities.
     */
    private function check_suspicious_activities()
    {
        $recent_events = $this->settings->get_setting('security_events');
        if (!$recent_events) {
            return;
        }

        $suspicious_patterns = array(
            'multiple_failed_validations' => 0,
            'rapid_license_changes' => 0,
            'unusual_access_patterns' => 0
        );

        foreach ($recent_events as $event) {
            if (time() - strtotime($event['timestamp']) > 3600) { // Only check last hour
                continue;
            }

            switch ($event['type']) {
                case 'license_validation_failed':
                    $suspicious_patterns['multiple_failed_validations']++;
                    break;
                case 'license_key_changed':
                    $suspicious_patterns['rapid_license_changes']++;
                    break;
                case 'unusual_access':
                    $suspicious_patterns['unusual_access_patterns']++;
                    break;
            }
        }

        // Check thresholds
        if (
            $suspicious_patterns['multiple_failed_validations'] > 5 ||
            $suspicious_patterns['rapid_license_changes'] > 3 ||
            $suspicious_patterns['unusual_access_patterns'] > 10
        ) {
            $this->log_security_event('suspicious_activity_detected', $suspicious_patterns);
            $this->show_security_alert('Suspicious activity detected. Please check security logs.');
        }
    }

    /**
     * Log a security event.
     *
     * @param string $type The event type.
     * @param array $data The event data.
     */
    public function log_security_event($type, $data = array())
    {
        $events = $this->settings->get_setting('security_events') ?: array();

        // Keep only last 1000 events
        if (count($events) >= 1000) {
            array_shift($events);
        }

        $events[] = array(
            'type' => $type,
            'data' => $data,
            'timestamp' => current_time('mysql'),
            'user' => wp_get_current_user()->user_login,
            'ip' => $this->get_client_ip()
        );

        $this->settings->set_setting('security_events', $events);

        // Send alert for critical events
        if (in_array($type, array('suspicious_activity_detected'))) {
            $this->send_security_alert($type, $data);
        }
    }

    /**
     * Disable the plugin.
     */
    private function disable_plugin()
    {
        deactivate_plugins('helpmate/helpmate.php');
        add_action('admin_notices', function () {
            echo '<div class="error"><p>' . esc_html__('Helpmate has been disabled due to security concerns. Please contact support.', 'helpmate') . '</p></div>';
        });
    }

    /**
     * Send a security alert.
     *
     * @param string $type The event type.
     * @param array $data The event data.
     */
    private function send_security_alert($type, $data)
    {
        // Check if we've already sent an alert for this type today
        $last_alert_time = $this->settings->get_setting('last_security_alert_' . $type);
        if ($last_alert_time) {
            $last_alert_date = gmdate('Y-m-d', strtotime($last_alert_time));
            $current_date = gmdate('Y-m-d');

            if ($last_alert_date === $current_date) {
                return; // Skip sending alert if we already sent one today
            }
        }

        $admin_email = get_option('admin_email');
        $site_url = get_site_url();

        $subject = sprintf(
            '[Helpmate Security Alert] %s detected on %s',
            ucwords(str_replace('_', ' ', $type)),
            $site_url
        );

        $message = sprintf(
            "Security Alert:\n\nType: %s\nTime: %s\nSite: %s\nUser: %s\nIP: %s\n\nData: %s",
            $type,
            current_time('mysql'),
            $site_url,
            wp_get_current_user()->user_login,
            $this->get_client_ip(),
            wp_json_encode($data)
        );

        if (wp_mail($admin_email, $subject, $message)) {
            // Update the last alert time for this type
            $this->settings->set_setting('last_security_alert_' . $type, current_time('mysql'));
        }
    }

    /**
     * Get the client IP address.
     *
     * @return string The client IP address.
     */
    private function get_client_ip()
    {
        $ip = '';
        if (isset($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = sanitize_text_field(wp_unslash($_SERVER['HTTP_CLIENT_IP']));
        } elseif (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = sanitize_text_field(wp_unslash($_SERVER['HTTP_X_FORWARDED_FOR']));
        } elseif (isset($_SERVER['REMOTE_ADDR'])) {
            $ip = sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']));
        }
        return $ip;
    }

    /**
     * Show a security alert.
     *
     * @param string $message The alert message.
     */
    private function show_security_alert($message)
    {
        add_action('admin_notices', function () use ($message) {
            echo '<div class="error"><p><strong>' . esc_html__('Helpmate Security Alert:', 'helpmate') . '</strong> ' . esc_html($message) . '</p></div>';
        });
    }
}