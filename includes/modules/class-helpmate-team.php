<?php

/**
 * The Team Management module for the Helpmate plugin.
 *
 * Handles team member role assignments and permissions.
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

class Helpmate_Team
{
    /**
     * The helpmate instance.
     *
     * @since    1.3.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * Available roles.
     *
     * @since    1.3.0
     * @access   private
     * @var      array    $available_roles    Available roles.
     */
    private $available_roles = ['admin', 'manager', 'live_chat_agent', 'salesperson', 'marketer'];

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.3.0
     * @param    Helpmate    $helpmate    The helpmate instance.
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Get all team members with optional filters.
     *
     * @since    1.3.0
     * @param    array    $filters    Optional filters (role, search, pagination).
     * @return   array    Team members grouped by user_id with roles array.
     */
    public function get_team_members($filters = [])
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_team_members');

        // Search by user first if needed
        $user_ids = null;
        if (!empty($filters['search'])) {
            $search = '%' . $wpdb->esc_like($filters['search']) . '%';
            $user_ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT ID FROM {$wpdb->users} WHERE user_login LIKE %s OR user_email LIKE %s OR display_name LIKE %s",
                    $search,
                    $search,
                    $search
                )
            );
            if (empty($user_ids)) {
                // No users found, return empty result
                return [];
            }
        }

        // Build query with explicit conditional branches
        if (!empty($filters['role']) && !empty($user_ids)) {
            // Role filter + user search
            $role = sanitize_text_field($filters['role']);
            $placeholders = implode(',', array_fill(0, count($user_ids), '%d'));
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is safe, uses wpdb->prefix; placeholders are dynamically generated
            $results = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE role = %s AND user_id IN ($placeholders) ORDER BY created_at DESC",
                    $role,
                    ...$user_ids
                ),
                ARRAY_A
            );
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
        } elseif (!empty($filters['role'])) {
            // Role filter only
            $role = sanitize_text_field($filters['role']);
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $results = $wpdb->get_results(
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT * FROM {$table} WHERE role = %s ORDER BY created_at DESC"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $role
                ),
                ARRAY_A
            );
        } elseif (!empty($user_ids)) {
            // User search only
            $placeholders = implode(',', array_fill(0, count($user_ids), '%d'));
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is safe, uses wpdb->prefix; placeholders are dynamically generated
            $results = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE user_id IN ($placeholders) ORDER BY created_at DESC",
                    ...$user_ids
                ),
                ARRAY_A
            );
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        } else {
            // No filters
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
            $results = $wpdb->get_results(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT * FROM {$table} ORDER BY created_at DESC"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                ARRAY_A
            );
        }

        // Group by user_id
        $team_members = [];
        foreach ($results as $row) {
            $user_id = (int) $row['user_id'];
            if (!isset($team_members[$user_id])) {
                $user = get_userdata($user_id);
                $team_members[$user_id] = [
                    'user_id' => $user_id,
                    'user' => $user ? [
                        'id' => $user->ID,
                        'login' => $user->user_login,
                        'email' => $user->user_email,
                        'display_name' => $user->display_name,
                        'first_name' => $user->first_name,
                        'last_name' => $user->last_name,
                    ] : null,
                    'roles' => [],
                    'assigned_by' => [],
                    'created_at' => (int) $row['created_at'],
                    'updated_at' => (int) $row['updated_at'],
                ];
            }
            $team_members[$user_id]['roles'][] = $row['role'];
            if (!in_array($row['assigned_by'], $team_members[$user_id]['assigned_by'])) {
                $team_members[$user_id]['assigned_by'][] = (int) $row['assigned_by'];
            }
            // Update timestamps to latest
            if ((int) $row['updated_at'] > $team_members[$user_id]['updated_at']) {
                $team_members[$user_id]['updated_at'] = (int) $row['updated_at'];
            }
        }

        return array_values($team_members);
    }

    /**
     * Get all roles for a specific user.
     *
     * @since    1.3.0
     * @param    int    $user_id    User ID.
     * @return   array   Array of role strings.
     */
    public function get_user_roles($user_id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_team_members');

        $roles = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT role FROM {$table} WHERE user_id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $user_id
            )
        );

        return $roles ? $roles : [];
    }

    /**
     * Get team members who have any of the specified roles.
     *
     * Returns unique users with their email and display name for notifications.
     *
     * @since    1.3.0
     * @param    array    $roles    Array of role strings (e.g., ['admin', 'manager']).
     * @return   array    Array of users with 'user_id', 'email', 'display_name', 'first_name'.
     */
    public function get_team_members_by_roles($roles)
    {
        if (empty($roles) || !is_array($roles)) {
            return [];
        }

        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_team_members');

        // Sanitize roles
        $roles = array_map('sanitize_text_field', $roles);

        // Build placeholders for IN clause
        $placeholders = implode(',', array_fill(0, count($roles), '%s'));

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is safe, uses wpdb->prefix; placeholders are dynamically generated
        $user_ids = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT DISTINCT user_id FROM {$table} WHERE role IN ($placeholders)",
                ...$roles
            )
        );
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

        if (empty($user_ids)) {
            return [];
        }

        // Get user data for each user
        $team_members = [];
        foreach ($user_ids as $user_id) {
            $user = get_userdata((int) $user_id);
            if ($user && $user->user_email) {
                $team_members[] = [
                    'user_id' => (int) $user_id,
                    'email' => $user->user_email,
                    'display_name' => $user->display_name,
                    'first_name' => $user->first_name ?: $user->display_name,
                ];
            }
        }

        return $team_members;
    }

    /**
     * Assign multiple roles to user (replaces existing roles).
     *
     * @since    1.3.0
     * @param    int      $user_id      User ID.
     * @param    array    $roles        Array of role strings.
     * @param    int      $assigned_by  User ID who assigned the roles.
     * @return   bool|WP_Error    True on success, WP_Error on failure.
     */
    public function assign_roles($user_id, $roles, $assigned_by)
    {
        if (empty($roles) || !is_array($roles)) {
            return new WP_Error('invalid_roles', __('Roles must be a non-empty array.', 'helpmate-ai-chatbot'));
        }

        // Validate roles
        foreach ($roles as $role) {
            if (!in_array($role, $this->available_roles, true)) {
                // translators: %s: Role name
                return new WP_Error('invalid_role', sprintf(__('Invalid role: %s', 'helpmate-ai-chatbot'), $role));
            }
        }

        // Remove existing roles
        $this->remove_all_roles($user_id);

        // Add new roles
        foreach ($roles as $role) {
            $result = $this->add_role($user_id, $role, $assigned_by);
            if (is_wp_error($result)) {
                return $result;
            }
        }

        return true;
    }

    /**
     * Add a single role to user (doesn't remove existing).
     *
     * @since    1.3.0
     * @param    int      $user_id      User ID.
     * @param    string   $role         Role string.
     * @param    int      $assigned_by  User ID who assigned the role.
     * @return   bool|WP_Error    True on success, WP_Error on failure.
     */
    public function add_role($user_id, $role, $assigned_by)
    {
        if (!in_array($role, $this->available_roles, true)) {
            // translators: %s: Role name
            return new WP_Error('invalid_role', sprintf(__('Invalid role: %s', 'helpmate-ai-chatbot'), $role));
        }

        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_team_members');
        $now = time();

        // Check if role already exists
        $exists = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT id FROM {$table} WHERE user_id = %d AND role = %s"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $user_id,
                $role
            )
        );

        if ($exists) {
            // Update existing
            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $table,
                [
                    'assigned_by' => $assigned_by,
                    'updated_at' => $now,
                ],
                [
                    'user_id' => $user_id,
                    'role' => $role,
                ],
                ['%d', '%d'],
                ['%d', '%s']
            );
        } else {
            // Insert new
            $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $table,
                [
                    'user_id' => $user_id,
                    'role' => $role,
                    'assigned_by' => $assigned_by,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                ['%d', '%s', '%d', '%d', '%d']
            );
        }

        return $result !== false ? true : new WP_Error('db_error', __('Failed to add role.', 'helpmate-ai-chatbot'));
    }

    /**
     * Remove a specific role from user.
     *
     * @since    1.3.0
     * @param    int      $user_id    User ID.
     * @param    string   $role       Role string.
     * @return   bool    True on success, false on failure.
     */
    public function remove_role($user_id, $role)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_team_members');

        $result = $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            [
                'user_id' => $user_id,
                'role' => $role,
            ],
            ['%d', '%s']
        );

        return $result !== false;
    }

    /**
     * Remove user from team (all roles).
     *
     * @since    1.3.0
     * @param    int    $user_id    User ID.
     * @return   bool    True on success, false on failure.
     */
    public function remove_all_roles($user_id)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_team_members');

        $result = $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            ['user_id' => $user_id],
            ['%d']
        );

        return $result !== false;
    }

    /**
     * Check if user can access a feature (checks if ANY role allows it).
     *
     * @since    1.3.0
     * @param    int      $user_id    User ID.
     * @param    string   $feature    Feature name.
     * @return   bool    True if user can access, false otherwise.
     */
    public function can_user_access($user_id, $feature)
    {
        return Helpmate_Permissions::can_access_feature($user_id, $feature);
    }

    /**
     * Get all permissions for a user (union of all role permissions).
     *
     * @since    1.3.0
     * @param    int    $user_id    User ID.
     * @return   array   Array of allowed features.
     */
    public function get_user_permissions($user_id)
    {
        return Helpmate_Permissions::get_allowed_features($user_id);
    }

    /**
     * Check hierarchical permissions - can manager manage target user.
     *
     * @since    1.3.0
     * @param    int    $manager_id      Manager user ID.
     * @param    int    $target_user_id  Target user ID.
     * @return   bool    True if manager can manage target user.
     */
    public function can_manage_user($manager_id, $target_user_id)
    {
        // WordPress admins can manage anyone
        if (user_can($manager_id, 'manage_options')) {
            return true;
        }

        $manager_roles = $this->get_user_roles($manager_id);
        $target_roles = $this->get_user_roles($target_user_id);

        // Admin can manage anyone
        if (in_array('admin', $manager_roles, true)) {
            return true;
        }

        // Manager can manage non-admin roles
        if (in_array('manager', $manager_roles, true)) {
            return !in_array('admin', $target_roles, true);
        }

        return false;
    }

    /**
     * Get list of all available roles.
     *
     * @since    1.3.0
     * @return   array   Array of available role strings.
     */
    public function get_available_roles()
    {
        return $this->available_roles;
    }

    /**
     * Build email HTML structure.
     *
     * @since    1.3.0
     * @param    string   $name          Recipient name.
     * @param    string   $title         Email title.
     * @param    string   $body_text     Main body text.
     * @param    string   $box_content   Content for the main box.
     * @param    string   $button_html   Optional button HTML.
     * @param    string   $title_color   Optional title color (default: #455CFE).
     * @param    string   $border_color  Optional border color (default: #455CFE).
     * @return   string   Complete email HTML.
     */
    private function build_email_html($name, $title, $body_text, $box_content, $button_html = '', $title_color = '#455CFE', $border_color = '#455CFE')
    {
        $shop_name = get_bloginfo('name');

        /* translators: %s: Recipient's name */
        $greeting = sprintf(__('Hello %s,', 'helpmate-ai-chatbot'), esc_html($name));

        return '<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="color: #666666; font-size: 16px; margin-bottom: 10px; text-align: center;">' . $greeting . '</div>
                <div style="color: ' . esc_attr($title_color) . '; font-size: 28px; font-weight: bold; margin-bottom: 20px; text-align: center;">' . esc_html($title) . '</div>
                <div style="color: #666666; font-size: 14px; line-height: 1.5; margin-bottom: 25px; text-align: center;">
                    ' . esc_html($body_text) . '
                </div>
                <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px auto; box-shadow: 0 2px 6px rgba(0,0,0,0.08); max-width: 400px; border: 2px solid ' . esc_attr($border_color) . ';">
                    ' . $box_content . '
                    ' . $button_html . '
                </div>
                <div style="margin-top: 30px; color: #999999; font-size: 12px; text-align: center;">
                    ' . __('Best regards,', 'helpmate-ai-chatbot') . '<br>
                    ' . esc_html($shop_name) . '
                </div>
            </div>
        </div>';
    }

    /**
     * Send welcome email to new team member.
     *
     * @since    1.3.0
     * @param    int      $user_id          User ID.
     * @param    array    $roles            Array of assigned roles.
     * @param    string   $password         Optional password to include in email.
     * @param    bool     $send_reset_link  Whether to send password reset link instead.
     * @return   bool     True on success, false on failure.
     */
    public function send_team_member_welcome_email($user_id, $roles, $password = null, $send_reset_link = false)
    {
        $user = get_userdata($user_id);
        if (!$user || !$user->user_email) {
            return false;
        }

        $crm = $this->helpmate->get_crm();
        if (!$crm) {
            return false;
        }

        $shop_name = get_bloginfo('name');
        $login_url = admin_url();
        $first_name = get_user_meta($user_id, 'first_name', true) ?: $user->display_name;
        $roles_list = implode(', ', array_map('ucfirst', $roles));

        // Build body text
        $body_text = sprintf(
            /* translators: %s: List of assigned roles */
            __('We\'re excited to have you join our team! You\'ve been granted access to our Helpmate system with the following roles: %s.', 'helpmate-ai-chatbot'),
            esc_html($roles_list)
        );

        // Build account details box
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Your Account Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8; margin-bottom: 15px;">
                            <strong>' . __('Email:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($user->user_email) . '<br>
                            <strong>' . __('Roles:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($roles_list) . '
                        </div>
                    </div>';

        // Add password section if needed
        if ($send_reset_link) {
            $reset_key = get_password_reset_key($user);
            if (!is_wp_error($reset_key)) {
                $reset_url = network_site_url("wp-login.php?action=rp&key=$reset_key&login=" . rawurlencode($user->user_login), 'login');
                $box_content .= '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Set Your Password', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8; margin-bottom: 15px;">
                            ' . __('Click the link below to set your password and access your account:', 'helpmate-ai-chatbot') . '
                        </div>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="' . esc_url($reset_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('Set Password', 'helpmate-ai-chatbot') . '</a>
                        </div>
                    </div>';
            }
        } elseif ($password) {
            $box_content .= '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Your Login Credentials', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Username:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($user->user_login) . '<br>
                            <strong>' . __('Password:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($password) . '<br><br>
                            <em>' . __('Please change your password after first login for security.', 'helpmate-ai-chatbot') . '</em>
                        </div>
                    </div>';
        }

        // Build button
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($login_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('Access Dashboard', 'helpmate-ai-chatbot') . '</a>
                </div>';

        // Build email HTML
        /* translators: %s: Shop/site name */
        $email_title = sprintf(__('Welcome to %s Team', 'helpmate-ai-chatbot'), $shop_name);

        $body = $this->build_email_html(
            $first_name,
            $email_title,
            $body_text,
            $box_content,
            $button_html
        );

        /* translators: %s: Shop/site name */
        $subject = sprintf(__('Welcome to %s Team', 'helpmate-ai-chatbot'), $shop_name);

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        return wp_mail($user->user_email, $subject, $body, $headers);
    }

    /**
     * Send notification email when existing user is added as team member.
     *
     * @since    1.3.0
     * @param    int      $user_id    User ID.
     * @param    array    $roles      Array of assigned roles.
     * @return   bool     True on success, false on failure.
     */
    public function send_team_member_added_email($user_id, $roles)
    {
        $user = get_userdata($user_id);
        if (!$user || !$user->user_email) {
            return false;
        }

        $crm = $this->helpmate->get_crm();
        if (!$crm) {
            return false;
        }

        $shop_name = get_bloginfo('name');
        $login_url = admin_url();
        $first_name = get_user_meta($user_id, 'first_name', true) ?: $user->display_name;
        $roles_list = implode(', ', array_map('ucfirst', $roles));

        // Build body text
        $body_text = sprintf(
            /* translators: %s: List of assigned roles */
            __('You\'ve been granted access to our Helpmate system with the following roles: %s.', 'helpmate-ai-chatbot'),
            esc_html($roles_list)
        );

        // Build account details box
        $box_content = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #455CFE;">
                        <div style="color: #455CFE; font-weight: bold; font-size: 16px; margin-bottom: 10px;">' . __('Your Account Details', 'helpmate-ai-chatbot') . '</div>
                        <div style="color: #666666; font-size: 14px; line-height: 1.8;">
                            <strong>' . __('Email:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($user->user_email) . '<br>
                            <strong>' . __('Roles:', 'helpmate-ai-chatbot') . '</strong> ' . esc_html($roles_list) . '
                        </div>
                    </div>';

        // Build button
        $button_html = '<div style="text-align: center; margin: 25px 0 0 0;">
                    <a href="' . esc_url($login_url) . '" style="display: inline-block; background-color: #455CFE; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">' . __('Access Dashboard', 'helpmate-ai-chatbot') . '</a>
                </div>';

        // Build email HTML
        /* translators: %s: Shop/site name */
        $email_title = sprintf(__('You\'ve been added to %s Team', 'helpmate-ai-chatbot'), $shop_name);

        $body = $this->build_email_html(
            $first_name,
            $email_title,
            $body_text,
            $box_content,
            $button_html
        );

        /* translators: %s: Shop/site name */
        $subject = sprintf(__('You\'ve been added to %s Team', 'helpmate-ai-chatbot'), $shop_name);

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        return wp_mail($user->user_email, $subject, $body, $headers);
    }
}

