<?php

/**
 * The Permissions helper class for the Helpmate plugin.
 *
 * Handles role-based access control with modular configuration.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) exit;

class Helpmate_Permissions
{
    /**
     * Role permissions configuration.
     * Maps roles to their allowed features.
     * Easy to modify for future enhancements.
     *
     * @since    1.3.0
     * @access   private
     * @var      array    $role_permissions    Role permissions map.
     */
    private static $role_permissions = [
        'admin' => [
            'all_features',
        ],
        'manager' => [
            'crm_contacts',
            'crm_leads',
            'crm_tickets',
            'crm_tasks',
            'crm_emails',
            'crm_segments',
            'crm_custom_fields',
            'analytics',
            'chat_settings',
            'team_management',
            'live_chat',
            'tickets',
            'contacts_view',
            'contacts_full',
            'tasks',
            'leads',
            'emails',
            'segments',
            'appointments',
        ],
        'live_chat_agent' => [
            'analytics',
            'live_chat',
            'tickets',
            'contacts_full',
            'tasks',
            'appointments',
        ],
        'salesperson' => [
            'analytics',
            'live_chat',
            'tickets',
            'contacts_full',
            'tasks',
            'leads',
            'segments',
            'emails',
            'conversion_automation',
        ],
        'marketer' => [
            'analytics',
            'live_chat',
            'tickets',
            'contacts_full',
            'tasks',
            'leads',
            'segments',
            'emails',
            'conversion_automation',
        ],
    ];

    /**
     * Role hierarchy configuration.
     * Defines who can manage whom.
     *
     * @since    1.3.0
     * @access   private
     * @var      array    $role_hierarchy    Role hierarchy map.
     */
    private static $role_hierarchy = [
        'admin' => ['admin', 'manager', 'live_chat_agent', 'salesperson', 'marketer'],
        'manager' => ['live_chat_agent', 'salesperson', 'marketer'],
    ];

    /**
     * Feature definitions.
     * Maps features to their display names and requirements.
     *
     * @since    1.3.0
     * @access   private
     * @var      array    $feature_definitions    Feature definitions map.
     */
    private static $feature_definitions = [
        'all_features' => [
            'name' => 'All Features',
            'description' => 'Full access to all plugin features',
        ],
        'crm_contacts' => [
            'name' => 'CRM Contacts',
            'description' => 'Access to contacts management',
        ],
        'crm_leads' => [
            'name' => 'CRM Leads',
            'description' => 'Access to leads management',
        ],
        'crm_tickets' => [
            'name' => 'CRM Tickets',
            'description' => 'Access to tickets management',
        ],
        'crm_tasks' => [
            'name' => 'CRM Tasks',
            'description' => 'Access to tasks management',
        ],
        'crm_emails' => [
            'name' => 'CRM Emails',
            'description' => 'Access to email campaigns',
        ],
        'crm_segments' => [
            'name' => 'CRM Segments',
            'description' => 'Access to segments management',
        ],
        'crm_custom_fields' => [
            'name' => 'CRM Custom Fields',
            'description' => 'Access to custom fields',
        ],
        'analytics' => [
            'name' => 'Analytics',
            'description' => 'Access to analytics dashboard',
        ],
        'chat_settings' => [
            'name' => 'Chat Settings',
            'description' => 'Access to chatbot settings',
        ],
        'team_management' => [
            'name' => 'Team Management',
            'description' => 'Access to team management',
        ],
        'live_chat' => [
            'name' => 'Live Chat',
            'description' => 'Access to live chat',
        ],
        'tickets' => [
            'name' => 'Tickets',
            'description' => 'Access to tickets',
        ],
        'contacts_view' => [
            'name' => 'View Contacts',
            'description' => 'Read-only access to contacts',
        ],
        'contacts_full' => [
            'name' => 'Full Contacts',
            'description' => 'Full access to contacts',
        ],
        'tasks' => [
            'name' => 'Tasks',
            'description' => 'Access to tasks',
        ],
        'leads' => [
            'name' => 'Leads',
            'description' => 'Access to leads',
        ],
        'emails' => [
            'name' => 'Emails',
            'description' => 'Access to email campaigns',
        ],
        'segments' => [
            'name' => 'Segments',
            'description' => 'Access to segments',
        ],
        'appointments' => [
            'name' => 'Appointments',
            'description' => 'Access to appointments and bookings',
        ],
        'conversion_automation' => [
            'name' => 'Conversion Automation',
            'description' => 'Access to promo bar and sales notifications',
        ],
    ];

    /**
     * Get user's Helpmate roles.
     *
     * @since    1.3.0
     * @param    int    $user_id    User ID.
     * @return   array   Array of role strings.
     */
    public static function get_user_roles($user_id)
    {
        // WordPress admins automatically get admin role
        if (user_can($user_id, 'manage_options')) {
            return ['admin'];
        }

        $helpmate = $GLOBALS['helpmate'] ?? null;
        if (!$helpmate) {
            return [];
        }

        $team = $helpmate->get_team();
        if (!$team) {
            return [];
        }

        return $team->get_user_roles($user_id);
    }

    /**
     * Check feature access (returns true if ANY role allows it).
     *
     * @since    1.3.0
     * @param    int      $user_id    User ID.
     * @param    string   $feature    Feature name.
     * @return   bool    True if user can access, false otherwise.
     */
    public static function can_access_feature($user_id, $feature)
    {
        // WordPress admins always have full access
        if (user_can($user_id, 'manage_options')) {
            return true;
        }

        // Admin with all_features always has access
        $roles = self::get_user_roles($user_id);
        if (empty($roles)) {
            return false;
        }

        foreach ($roles as $role) {
            if (!isset(self::$role_permissions[$role])) {
                continue;
            }

            $permissions = self::$role_permissions[$role];

            // Check for all_features
            if (in_array('all_features', $permissions, true)) {
                return true;
            }

            // Check for specific feature
            if (in_array($feature, $permissions, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all allowed features for user (union of all role permissions).
     *
     * @since    1.3.0
     * @param    int    $user_id    User ID.
     * @return   array   Array of allowed feature strings.
     */
    public static function get_allowed_features($user_id)
    {
        // WordPress admins always have all features
        if (user_can($user_id, 'manage_options')) {
            return array_keys(self::$feature_definitions);
        }

        $roles = self::get_user_roles($user_id);
        if (empty($roles)) {
            return [];
        }

        $allowed_features = [];

        foreach ($roles as $role) {
            if (!isset(self::$role_permissions[$role])) {
                continue;
            }

            $permissions = self::$role_permissions[$role];

            // If any role has all_features, return all features
            if (in_array('all_features', $permissions, true)) {
                return array_values(array_keys(self::$feature_definitions));
            }

            $allowed_features = array_merge($allowed_features, $permissions);
        }

        // Use array_values to ensure sequential numeric keys (prevents JSON encoding as object)
        return array_values(array_unique($allowed_features));
    }

    /**
     * Get allowed features for a specific role (from config).
     *
     * @since    1.3.0
     * @param    string   $role    Role string.
     * @return   array    Array of allowed feature strings.
     */
    public static function get_allowed_features_for_role($role)
    {
        if (!isset(self::$role_permissions[$role])) {
            return [];
        }

        return self::$role_permissions[$role];
    }

    /**
     * Filter menu items based on user permissions.
     *
     * @since    1.3.0
     * @param    array    $menu_items    Menu items array.
     * @param    int      $user_id        User ID.
     * @return   array    Filtered menu items.
     */
    public static function filter_menu_items($menu_items, $user_id)
    {
        $allowed_features = self::get_allowed_features($user_id);

        // Map menu items to features (this can be customized)
        $menu_to_feature_map = [
            'crm-contacts' => 'crm_contacts',
            'crm-leads' => 'crm_leads',
            'crm-tickets' => 'crm_tickets',
            'tasks' => 'crm_tasks',
            'crm-emails' => 'crm_emails',
            'crm-segments' => 'crm_segments',
            'crm-custom-fields' => 'crm_custom_fields',
            'analytics' => 'analytics',
            'data-source' => 'chat_settings',
            'customization' => 'chat_settings',
            'behavior' => 'chat_settings',
            'control-center-team' => 'team_management',
            'social-chat-inbox' => 'live_chat',
        ];

        $filtered = [];
        foreach ($menu_items as $item) {
            $page = $item['page'] ?? '';
            $feature = $menu_to_feature_map[$page] ?? null;

            // If no feature mapping, allow access (for backward compatibility)
            if ($feature === null) {
                $filtered[] = $item;
                continue;
            }

            // Check if user has access
            if (in_array('all_features', $allowed_features, true) || in_array($feature, $allowed_features, true)) {
                $filtered[] = $item;
            }
        }

        return $filtered;
    }

    /**
     * Check if manager can assign specific role.
     *
     * @since    1.3.0
     * @param    int      $manager_id    Manager user ID.
     * @param    string   $role          Role to assign.
     * @return   bool    True if manager can assign role.
     */
    public static function can_assign_role($manager_id, $role)
    {
        $manager_roles = self::get_user_roles($manager_id);

        foreach ($manager_roles as $manager_role) {
            if (!isset(self::$role_hierarchy[$manager_role])) {
                continue;
            }

            if (in_array($role, self::$role_hierarchy[$manager_role], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the permissions configuration (for easy modification).
     *
     * @since    1.3.0
     * @return   array    Permissions configuration array.
     */
    public static function get_role_permissions_config()
    {
        return [
            'role_permissions' => self::$role_permissions,
            'role_hierarchy' => self::$role_hierarchy,
            'feature_definitions' => self::$feature_definitions,
        ];
    }
}

