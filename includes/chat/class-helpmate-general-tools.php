<?php

/**
 * The general tools functionality of the plugin.
 *
 * This class handles general tools including:
 * - FAQ options tool
 * - Handover to human tool
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

class Helpmate_General_Tools
{

    /**
     * Day keys mapping: PHP date('w') 0=Sunday, 1=Monday, ..., 6=Saturday.
     *
     * @var array<string>
     */
    private static $day_keys = [ 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday' ];

    /**
     * The helpmate instance.
     *
     * @since    1.0.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.0.0
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Check if current time is within business hours.
     * When $timezone is set and valid, uses that timezone; otherwise uses WordPress site timezone via current_time().
     *
     * @since 1.0.0
     * @param bool   $enabled   Whether business hours are enabled.
     * @param array  $hours     Per-day config: [ 'sunday' => ['enabled'=>bool, 'startTime'=>'09:00', 'endTime'=>'17:00'], ... ].
     * @param string $timezone  Optional IANA timezone (e.g. 'America/New_York'). Empty = use site timezone.
     * @return bool True if within business hours.
     */
    private function is_within_business_hours($enabled, $hours, $timezone = '')
    {
        if (!$enabled || !is_array($hours) || empty($hours)) {
            return false;
        }

        $day_index = 0;
        $current_hour = 0;
        $current_minute = 0;

        $tz_string = is_string($timezone) ? trim($timezone) : '';
        if ($tz_string !== '' && in_array($tz_string, timezone_identifiers_list(), true)) {
            try {
                $tz = new \DateTimeZone($tz_string);
                $now = new \DateTime('now', $tz);
                $day_index   = (int) $now->format('w');
                $current_hour   = (int) $now->format('G');
                $current_minute = (int) $now->format('i');
            } catch (\Exception $e) {
                $day_index   = (int) current_time('w');
                $current_hour   = (int) current_time('G');
                $current_minute = (int) current_time('i');
            }
        } else {
            $day_index   = (int) current_time('w');
            $current_hour   = (int) current_time('G');
            $current_minute = (int) current_time('i');
        }

        $day_key   = isset(self::$day_keys[ $day_index ]) ? self::$day_keys[ $day_index ] : 'sunday';
        $day_config = isset($hours[ $day_key ]) ? $hours[ $day_key ] : null;

        if (!is_array($day_config)) {
            return false;
        }
        $day_enabled = isset($day_config['enabled']) ? filter_var($day_config['enabled'], FILTER_VALIDATE_BOOLEAN) : false;
        if (!$day_enabled) {
            return false;
        }

        $start_str = isset($day_config['startTime']) ? $day_config['startTime'] : '09:00';
        $end_str   = isset($day_config['endTime']) ? $day_config['endTime'] : '17:00';

        $start_parts = array_map('intval', explode(':', $start_str));
        $end_parts   = array_map('intval', explode(':', $end_str));

        $start_minutes = ($start_parts[0] ?? 9) * 60 + ($start_parts[1] ?? 0);
        $end_minutes   = ($end_parts[0] ?? 17) * 60 + ($end_parts[1] ?? 0);

        $current_minutes = $current_hour * 60 + $current_minute;

        return $current_minutes >= $start_minutes && $current_minutes < $end_minutes;
    }

    /**
     * Show the handover to human.
     * Within business hours: notifies team members, returns text. Outside: offers ticket creation.
     *
     * @since 1.0.0
     * @param string $session_id The chat session ID (for notification link).
     * @return string JSON-encoded response.
     */
    public function show_handover_to_human($session_id = '')
    {
        // Live Chat in-chat handoff requires Pro; otherwise offer ticket creation
        if (!apply_filters('helpmate_live_chat_reply_allowed', false)) {
            return json_encode([
                'type' => 'text',
                'text' => __('Live chat is a Pro feature. Would you like me to help you create a support ticket instead?', 'helpmate-ai-chatbot'),
            ]);
        }

        $settings  = $this->helpmate->get_settings()->get_setting('behavior', []);
        $bh_enabled = !empty($settings['business_hours_enabled']);
        $bh_hours   = isset($settings['business_hours']) && is_array($settings['business_hours']) ? $settings['business_hours'] : [];
        $bh_tz      = isset($settings['business_hours_timezone']) && is_string($settings['business_hours_timezone']) ? trim($settings['business_hours_timezone']) : '';

        // When business hours disabled: handover always available (never say "no agents")
        if (!$bh_enabled) {
            $within_hours = true;
        } else {
            $within_hours = $this->is_within_business_hours($bh_enabled, $bh_hours, $bh_tz);
        }

        if ($within_hours) {
            if (!empty($session_id)) {
                $notifications = $this->helpmate->get_notifications();
                if ($notifications) {
                    $conversation_id = 'website_' . md5($session_id);
                    $link = admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox&conversation_id=' . rawurlencode($conversation_id));

                    $notifications->create(
                        0,
                        'conversation',
                        __('Visitor requested live agent', 'helpmate-ai-chatbot'),
                        '',
                        $link,
                        [ 'conversation_id' => $conversation_id, 'platform' => 'website' ],
                        'conversation',
                        0
                    );
                }
            }

            return json_encode([
                'type' => 'text',
                'text' => __("I've asked our live agents to respond to this chat. They will get back to you shortly.", 'helpmate-ai-chatbot'),
            ]);
        }

        return json_encode([
            'type' => 'text',
            'text' => __('No live agents are available right now. Would you like me to help you create a support ticket?', 'helpmate-ai-chatbot'),
        ]);
    }
}
