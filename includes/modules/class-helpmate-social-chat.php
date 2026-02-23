<?php

/**
 * The Social Chat module for the Helpmate plugin.
 *
 * Handles Facebook Messenger, Instagram DMs, and post comment auto-replies.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.2.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/modules
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) exit;

class Helpmate_Social_Chat
{
    /**
     * The helpmate instance.
     *
     * @since    1.2.0
     * @access   private
     * @var      Helpmate    $helpmate    The helpmate instance.
     */
    private $helpmate;

    /**
     * The settings instance.
     *
     * @since    1.2.0
     * @access   private
     * @var      Helpmate_Settings    $settings    The settings instance.
     */
    private $settings;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.2.0
     * @param    Helpmate    $helpmate    The helpmate instance.
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
        $this->settings = $helpmate->get_settings();
    }

    /**
     * Get social chat settings.
     *
     * @since    1.2.0
     * @return   array    The social chat settings.
     */
    public function get_social_chat_settings(): array
    {
        return $this->settings->get_setting('social_chat') ?? [];
    }

    /**
     * Get the webhook URL for Meta configuration.
     *
     * @since    1.2.0
     * @return   string    The webhook URL.
     */
    public function get_webhook_url(): string
    {
        return rest_url('helpmate/v1/social/webhook');
    }

    /**
     * Get the webhook verify token.
     *
     * @since    1.2.0
     * @return   string    The verify token.
     */
    public function get_verify_token(): string
    {
        $settings = $this->get_social_chat_settings();
        return $settings['webhook_verify_token'] ?? '';
    }

    /**
     * Encrypt a value using WordPress salts.
     *
     * @since    1.2.0
     * @param    string    $value    The value to encrypt.
     * @return   string    The encrypted value.
     */
    public function encrypt_value(string $value): string
    {
        if (empty($value)) {
            return '';
        }

        $key = wp_salt('auth');
        $iv = substr(wp_salt('secure_auth'), 0, 16);

        $encrypted = openssl_encrypt($value, 'AES-256-CBC', $key, 0, $iv);
        return base64_encode($encrypted);
    }

    /**
     * Decrypt a value using WordPress salts.
     *
     * @since    1.2.0
     * @param    string    $encrypted_value    The encrypted value.
     * @return   string    The decrypted value.
     */
    public function decrypt_value(string $encrypted_value): string
    {
        if (empty($encrypted_value)) {
            return '';
        }

        $key = wp_salt('auth');
        $iv = substr(wp_salt('secure_auth'), 0, 16);

        $decoded = base64_decode($encrypted_value);
        return openssl_decrypt($decoded, 'AES-256-CBC', $key, 0, $iv);
    }

    /**
     * Get all connected social accounts.
     *
     * NOTE: This method has been moved to Helpmate_Pro_Social_Connections.
     * This method now delegates to the pro plugin if available.
     *
     * @since    1.2.0
     * @param    int    $page        Page number.
     * @param    int    $per_page    Items per page.
     * @return   array    The connected accounts with pagination.
     */
    public function get_accounts(int $page = 1, int $per_page = 10): array
    {
        // Delegate to pro plugin if available
        if ($this->helpmate->is_helpmate_pro_active() && isset($GLOBALS['helpmate_pro'])) {
            $pro_connections = $GLOBALS['helpmate_pro']->get_social_connections();
            if ($pro_connections) {
                return $pro_connections->get_accounts($page, $per_page);
            }
        }

        // Return empty if pro not available
        return [
            'accounts' => [],
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => 0,
                'total_pages' => 0
            ]
        ];
    }

    /**
     * Get a single account by ID.
     *
     * @since    1.2.0
     * @param    int    $account_id    The account ID.
     * @return   array|null    The account data or null.
     */
    public function get_account(int $account_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

        $account = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $account_id
            ),
            ARRAY_A
        );

        if ($account) {
            $account['access_token'] = $this->decrypt_value($account['access_token_encrypted']);
            unset($account['access_token_encrypted']);
        }

        return $account;
    }

    /**
     * Get account by page ID.
     * When platform and/or instagram_account_id are provided, resolves the correct account
     * when multiple accounts (e.g. Messenger and Instagram) share the same page_id.
     *
     * @since    1.2.0
     * @param    string    $page_id               The page ID from the webhook.
     * @param    string|null    $platform          Optional. messenger, instagram, fb_comment, ig_comment, whatsapp.
     * @param    string|null    $instagram_account_id    Optional. Instagram business account ID (used when page_id may be IG ID).
     * @return   array|null    The account data or null.
     */
    public function get_account_by_page_id(string $page_id, ?string $platform = null, ?string $instagram_account_id = null): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

        $account = null;

        // For instagram/ig_comment: try instagram_account_id first (license-server may forward IG ID as page_id).
        if ($instagram_account_id && in_array($platform, ['instagram', 'ig_comment'], true)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate
            $account = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table} WHERE instagram_account_id = %s AND platform = 'instagram'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $instagram_account_id
            ), ARRAY_A);
        }

        // For instagram/ig_comment when page_id is FB Page ID, or for messenger/fb_comment: resolve by page_id + platform.
        if (!$account && $platform) {
            $db_platform = in_array($platform, ['fb_comment', 'ig_comment'], true)
                ? ($platform === 'fb_comment' ? 'messenger' : 'instagram')
                : $platform;
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate
            $account = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table} WHERE page_id = %s AND platform = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $page_id,
                $db_platform
            ), ARRAY_A);
        }

        // Fallback: page_id only (e.g. WhatsApp, or when platform not provided).
        if (!$account) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate
            $account = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table} WHERE page_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $page_id
            ), ARRAY_A);
        }

        if ($account) {
            $account['access_token'] = $this->decrypt_value($account['access_token_encrypted']);
            unset($account['access_token_encrypted']);
        }

        return $account;
    }

    /**
     * Save a connected account.
     *
     * NOTE: This method has been moved to Helpmate_Pro_Social_Connections.
     * This method now delegates to the pro plugin if available.
     *
     * @since    1.2.0
     * @param    array    $data    The account data.
     * @return   int|false    The account ID or false on failure.
     */
    public function save_account(array $data)
    {
        // Delegate to pro plugin if available
        if ($this->helpmate->is_helpmate_pro_active() && isset($GLOBALS['helpmate_pro'])) {
            $pro_connections = $GLOBALS['helpmate_pro']->get_social_connections();
            if ($pro_connections) {
                return $pro_connections->save_account($data);
            }
        }

        return false;
    }

    /**
     * Update an account's access token.
     *
     * @since    1.2.0
     * @param    int       $account_id      The account ID.
     * @param    string    $access_token    The new access token.
     * @param    int|null  $token_expires   Token expiration timestamp.
     * @return   bool    Whether the update was successful.
     */
    public function update_account_token(int $account_id, string $access_token, ?int $token_expires = null): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

        $update_data = [
            'access_token_encrypted' => $this->encrypt_value($access_token),
            'status' => 'active',
            'updated_at' => current_time('mysql')
        ];

        if ($token_expires) {
            $update_data['token_expires'] = $token_expires;
        }

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            $update_data,
            ['id' => $account_id]
        );

        return $result !== false;
    }

    /**
     * Disconnect (delete) an account.
     *
     * NOTE: This method has been moved to Helpmate_Pro_Social_Connections.
     * This method now delegates to the pro plugin if available.
     *
     * @since    1.2.0
     * @param    int    $account_id    The account ID.
     * @return   bool    Whether the deletion was successful.
     */
    public function disconnect_account(int $account_id): bool
    {
        // Delegate to pro plugin if available
        if ($this->helpmate->is_helpmate_pro_active() && isset($GLOBALS['helpmate_pro'])) {
            $pro_connections = $GLOBALS['helpmate_pro']->get_social_connections();
            if ($pro_connections) {
                return $pro_connections->disconnect_account($account_id);
            }
        }

        return false;
    }

    /**
     * Get conversations with pagination and filters.
     *
     * @since    1.2.0
     * @param    array    $filters    Filter options (platform, status, is_human_handoff).
     * @param    int      $page       Page number.
     * @param    int      $per_page   Items per page.
     * @return   array    The conversations with pagination.
     */
    public function get_conversations(array $filters = [], int $page = 1, int $per_page = 20): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
        $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');
        $offset = ($page - 1) * $per_page;

        $include_website = empty($filters['platform']) || $filters['platform'] === 'website';
        $only_website = !empty($filters['platform']) && $filters['platform'] === 'website';
        $include_tickets = empty($filters['platform']) || $filters['platform'] === 'ticket';
        $only_tickets = !empty($filters['platform']) && $filters['platform'] === 'ticket';

        // If we need website chats, get them separately and merge
        $website_conversations = [];
        $website_total = 0;

        if ($include_website) {
            // Get ALL website conversations (not paginated) so we can merge and paginate correctly
            $website_data = $this->get_website_conversations($filters, 1, 999999);
            $website_conversations = $website_data['conversations'];
            $website_total = $website_data['total'];
        }

        // If only website, return website conversations
        if ($only_website) {
            return [
                'conversations' => $website_conversations,
                'pagination' => [
                    'page' => $page,
                    'per_page' => $per_page,
                    'total' => $website_total,
                    'total_pages' => ceil($website_total / $per_page)
                ]
            ];
        }

        // If only tickets, return ticket conversations
        if ($only_tickets) {
            $ticket_data = $this->get_ticket_conversations($filters, $page, $per_page);
            return [
                'conversations' => $ticket_data['conversations'],
                'pagination' => [
                    'page' => $page,
                    'per_page' => $per_page,
                    'total' => $ticket_data['total'],
                    'total_pages' => ceil($ticket_data['total'] / $per_page)
                ]
            ];
        }

        // Get ticket conversations if needed
        $ticket_conversations = [];
        $ticket_total = 0;
        if ($include_tickets) {
            // Get ALL ticket conversations (not paginated) so we can merge and paginate correctly
            $ticket_data = $this->get_ticket_conversations($filters, 1, 999999);
            $ticket_conversations = $ticket_data['conversations'];
            $ticket_total = $ticket_data['total'];
        }

        // Get social conversations
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['platform']) && $filters['platform'] !== 'website' && $filters['platform'] !== 'ticket') {
            $where[] = 'c.platform = %s';
            $params[] = $filters['platform'];
        }

        if (!empty($filters['status'])) {
            $where[] = 'c.status = %s';
            $params[] = $filters['status'];
        }

        if (isset($filters['is_human_handoff'])) {
            $where[] = 'c.is_human_handoff = %d';
            $params[] = (int) $filters['is_human_handoff'];
        }

        if (!empty($filters['account_id'])) {
            $where[] = 'c.account_id = %d';
            $params[] = (int) $filters['account_id'];
        }

        if (!empty($filters['contact_id'])) {
            $where[] = 'c.contact_id = %d';
            $params[] = (int) $filters['contact_id'];
        }

        // Add date range filtering
        if (!empty($filters['date_from'])) {
            $where[] = '(c.last_message_at >= %s OR c.created_at >= %s)';
            $params[] = $filters['date_from'] . ' 00:00:00';
            $params[] = $filters['date_from'] . ' 00:00:00';
        }

        if (!empty($filters['date_to'])) {
            $where[] = '(c.last_message_at <= %s OR c.created_at <= %s)';
            $params[] = $filters['date_to'] . ' 23:59:59';
            $params[] = $filters['date_to'] . ' 23:59:59';
        }

        // Add search filtering (search in participant_name, contact fields)
        if (!empty($filters['search'])) {
            $search_term = '%' . $wpdb->esc_like($filters['search']) . '%';
            $where[] = '(c.participant_name LIKE %s OR contact.first_name LIKE %s OR contact.last_name LIKE %s OR contact.email LIKE %s)';
            $params[] = $search_term;
            $params[] = $search_term;
            $params[] = $search_term;
            $params[] = $search_term;
        }

        $where_clause = implode(' AND ', $where);

        // Get total count
        $count_query = sprintf("SELECT COUNT(*) FROM %s c WHERE %s", $table, $where_clause);
        if (!empty($params)) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            $count_query = $wpdb->prepare($count_query, ...$params);
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built with safe placeholders and prepared with wpdb->prepare(); direct query necessary
        $social_total = $wpdb->get_var($count_query);

        // Get ALL social conversations (not paginated) so we can merge and paginate correctly
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $query = sprintf("SELECT c.*, a.page_name as account_name,
                         contact.first_name as contact_first_name,
                         contact.last_name as contact_last_name,
                         contact.email as contact_email,
                         contact.avatar_url as contact_avatar_url
                  FROM %s c
                  LEFT JOIN %s a ON c.account_id = a.id
                  LEFT JOIN %s contact ON c.contact_id = contact.id
                  WHERE %s
                  ORDER BY c.last_message_at DESC", $table, $accounts_table, $contacts_table, $where_clause);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built with safe placeholders and prepared with wpdb->prepare(); direct query necessary
        $social_conversations = $wpdb->get_results(
            !empty($params) ? $wpdb->prepare($query, ...$params) : $query, // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query is built safely and prepared here
            ARRAY_A
        );

        // Normalize is_human_handoff to boolean for all social conversations
        foreach ($social_conversations as &$conversation) {
            $conversation['is_human_handoff'] = (bool) ((int) ($conversation['is_human_handoff'] ?? 0));
        }
        unset($conversation); // Unset reference

        // Merge and sort by last_message_at
        $all_conversations = array_merge($social_conversations, $website_conversations, $ticket_conversations);

        // Apply search and date filters to merged results (for website and tickets that don't support SQL filtering)
        if (!empty($filters['search']) || !empty($filters['date_from']) || !empty($filters['date_to'])) {
            $all_conversations = array_filter($all_conversations, function($conv) use ($filters) {
                // Apply search filter
                if (!empty($filters['search'])) {
                    $search_lower = strtolower($filters['search']);
                    $participant_name = isset($conv['participant_name']) ? strtolower($conv['participant_name']) : '';
                    $first_name = isset($conv['contact_first_name']) ? strtolower($conv['contact_first_name']) : '';
                    $last_name = isset($conv['contact_last_name']) ? strtolower($conv['contact_last_name']) : '';
                    $email = isset($conv['contact_email']) ? strtolower($conv['contact_email']) : '';
                    $subject = isset($conv['subject']) ? strtolower($conv['subject']) : '';

                    if (strpos($participant_name, $search_lower) === false &&
                        strpos($first_name, $search_lower) === false &&
                        strpos($last_name, $search_lower) === false &&
                        strpos($email, $search_lower) === false &&
                        strpos($subject, $search_lower) === false) {
                        return false;
                    }
                }

                // Apply date filters
                $last_message_at = isset($conv['last_message_at']) ? $conv['last_message_at'] : (isset($conv['last_activity']) ? gmdate('Y-m-d H:i:s', (int)$conv['last_activity']) : '');
                $created_at = isset($conv['created_at']) ? $conv['created_at'] : '';
                $date_to_check = !empty($last_message_at) ? $last_message_at : $created_at;

                if (!empty($filters['date_from']) && !empty($date_to_check)) {
                    if (strtotime($date_to_check) < strtotime($filters['date_from'] . ' 00:00:00')) {
                        return false;
                    }
                }

                if (!empty($filters['date_to']) && !empty($date_to_check)) {
                    if (strtotime($date_to_check) > strtotime($filters['date_to'] . ' 23:59:59')) {
                        return false;
                    }
                }

                return true;
            });
        }

        // Sort by last_message_at (descending)
        usort($all_conversations, function($a, $b) {
            $time_a = isset($a['last_message_at']) ? strtotime($a['last_message_at']) : (isset($a['last_activity']) ? (int)$a['last_activity'] : 0);
            $time_b = isset($b['last_message_at']) ? strtotime($b['last_message_at']) : (isset($b['last_activity']) ? (int)$b['last_activity'] : 0);
            return $time_b - $time_a;
        });

        // Paginate the merged results
        $total = count($all_conversations);
        $paginated_conversations = array_slice($all_conversations, $offset, $per_page);

        return [
            'conversations' => $paginated_conversations,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => (int) $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Get website chat conversations from helpmate_chat_history.
     *
     * @since    1.3.0
     * @param    array    $filters    Filter options.
     * @param    int      $page       Page number.
     * @param    int      $per_page   Items per page.
     * @return   array    The website conversations with total count.
     */
    private function get_website_conversations(array $filters = [], int $page = 1, int $per_page = 20): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        // Build WHERE clause for filters (excluding debug sessions)
        $where = ["session_id NOT IN (
            SELECT DISTINCT session_id
            FROM {$table}
            WHERE JSON_EXTRACT(metadata, '$.debug') = true
        )"];

        // Get all sessions (we'll filter by handoff in PHP since it's in metadata)
        $where_clause = implode(' AND ', $where);
        $query = sprintf("SELECT
                    session_id,
                    COUNT(*) as message_count,
                    MIN(timestamp) as start_time,
                    MAX(timestamp) as last_activity
                  FROM %s
                  WHERE %s
                  GROUP BY session_id
                  ORDER BY last_activity DESC", $table, $where_clause);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause built with safe static strings; direct query necessary
        $all_sessions = $wpdb->get_results($query, ARRAY_A);

        // Convert to conversation format and apply filters
        $conversations = [];
        foreach ($all_sessions as $session) {
            $session_id = $session['session_id'];
            $is_handoff = $this->get_website_handoff_status($session_id);
            $status = $this->get_website_conversation_status($session_id);

            // Apply handoff filter if set
            if (isset($filters['is_human_handoff'])) {
                if ((int)$filters['is_human_handoff'] !== (int)$is_handoff) {
                    continue;
                }
            }

            // Apply status filter if set
            if (!empty($filters['status'])) {
                if ($status !== $filters['status']) {
                    continue;
                }
            }

            // Get unread count from transient
            $unread_count = $this->get_website_unread($session_id);

            // Get contact_id if linked
            $contact_id = $this->get_contact_id_for_website_conversation($session_id);

            // Apply contact_id filter if set
            if (!empty($filters['contact_id'])) {
                $filter_contact_id = (int) $filters['contact_id'];
                if ($contact_id !== $filter_contact_id) {
                    continue;
                }
            }

            // Get contact info if linked
            $contact_first_name = null;
            $contact_last_name = null;
            $contact_email = null;
            $contact_avatar_url = null;
            if ($contact_id) {
                $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
                $contact = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        "SELECT first_name, last_name, email, avatar_url FROM {$contacts_table} WHERE id = %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        $contact_id
                    ),
                    ARRAY_A
                );
                if ($contact) {
                    $contact_first_name = $contact['first_name'];
                    $contact_last_name = $contact['last_name'];
                    $contact_email = $contact['email'];
                    $contact_avatar_url = $contact['avatar_url'];
                }
            }

            $conversation = [
                'id' => 'website_' . md5($session_id), // Virtual ID
                'account_id' => 0, // No account for website chats
                'account_name' => null,
                'platform' => 'website',
                'external_id' => $session_id,
                'participant_id' => $session_id,
                'participant_name' => __('Website Visitor', 'helpmate-ai-chatbot'),
                'participant_profile_pic' => null,
                'contact_id' => $contact_id, // Include contact_id if linked
                'contact_first_name' => $contact_first_name,
                'contact_last_name' => $contact_last_name,
                'contact_email' => $contact_email,
                'contact_avatar_url' => $contact_avatar_url,
                'status' => $status,
                'is_human_handoff' => (bool) $is_handoff,
                'handoff_at' => $is_handoff ? $this->get_website_handoff_time($session_id) : null,
                'unread_count' => $unread_count,
                'last_message_at' => gmdate('Y-m-d H:i:s', (int)$session['last_activity']),
                'created_at' => gmdate('Y-m-d H:i:s', (int)$session['start_time']),
                'message_count' => (int) $session['message_count'],
                'last_activity' => (int) $session['last_activity'],
            ];

            // Apply search filter if set
            if (!empty($filters['search'])) {
                $search_lower = strtolower($filters['search']);
                $participant_name = strtolower($conversation['participant_name']);
                $first_name = $contact_first_name ? strtolower($contact_first_name) : '';
                $last_name = $contact_last_name ? strtolower($contact_last_name) : '';
                $email = $contact_email ? strtolower($contact_email) : '';

                if (strpos($participant_name, $search_lower) === false &&
                    strpos($first_name, $search_lower) === false &&
                    strpos($last_name, $search_lower) === false &&
                    strpos($email, $search_lower) === false) {
                    continue;
                }
            }

            // Apply date filters if set
            $last_message_at = $conversation['last_message_at'];
            $created_at = $conversation['created_at'];
            $date_to_check = !empty($last_message_at) ? $last_message_at : $created_at;

            if (!empty($filters['date_from']) && !empty($date_to_check)) {
                if (strtotime($date_to_check) < strtotime($filters['date_from'] . ' 00:00:00')) {
                    continue;
                }
            }

            if (!empty($filters['date_to']) && !empty($date_to_check)) {
                if (strtotime($date_to_check) > strtotime($filters['date_to'] . ' 23:59:59')) {
                    continue;
                }
            }

            $conversations[] = $conversation;
        }

        // Sort by last_message_at (already sorted, but ensure)
        usort($conversations, function($a, $b) {
            return strtotime($b['last_message_at']) - strtotime($a['last_message_at']);
        });

        $total = count($conversations);

        // Apply pagination
        $offset = ($page - 1) * $per_page;
        $conversations = array_slice($conversations, $offset, $per_page);

        return [
            'conversations' => $conversations,
            'total' => $total
        ];
    }

    /**
     * Get ticket conversations from helpmate_tickets.
     *
     * @since    1.4.0
     * @param    array    $filters    Filter options.
     * @param    int      $page       Page number.
     * @param    int      $per_page   Items per page.
     * @return   array    The ticket conversations with total count.
     */
    private function get_ticket_conversations(array $filters = [], int $page = 1, int $per_page = 20): array
    {
        global $wpdb;
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');
        $contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');

        // Build WHERE clause
        $where_clause = "WHERE role = 'user'";
        $where_params = [];

        // Get all tickets grouped by ticket_id
        $query = sprintf("SELECT MIN(id) as id, ticket_id, MIN(timestamp) as timestamp, subject, status,
                        MAX(contact_id) as contact_id, MAX(source) as source,
                        MAX(timestamp) as last_message_timestamp
                  FROM %s
                  %s
                  GROUP BY ticket_id
                  ORDER BY last_message_timestamp DESC", $tickets_table, $where_clause);

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- WHERE clause is static safe string; direct query necessary
        $all_tickets = $wpdb->get_results($query, ARRAY_A);

        // Convert to conversation format and apply filters
        $conversations = [];
        foreach ($all_tickets as $ticket) {
            $ticket_id = $ticket['ticket_id'];

            // Map ticket status to inbox status
            // 'open', 'pending', 'resolved' → 'open'; 'closed' → 'archived'
            $ticket_status = $ticket['status'];
            $inbox_status = in_array($ticket_status, ['open', 'pending', 'resolved'], true) ? 'open' : 'archived';

            // Apply status filter if set
            if (!empty($filters['status'])) {
                if ($inbox_status !== $filters['status']) {
                    continue;
                }
            }

            // Get contact info if linked
            $contact_id = !empty($ticket['contact_id']) ? (int) $ticket['contact_id'] : null;

            // Apply contact_id filter if set
            if (!empty($filters['contact_id'])) {
                $filter_contact_id = (int) $filters['contact_id'];
                if ($contact_id !== $filter_contact_id) {
                    continue;
                }
            }
            $contact_first_name = null;
            $contact_last_name = null;
            $contact_email = null;
            $contact_avatar_url = null;

            if ($contact_id) {
                $contact = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        "SELECT first_name, last_name, email, avatar_url FROM {$contacts_table} WHERE id = %d LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        $contact_id
                    ),
                    ARRAY_A
                );
                if ($contact) {
                    $contact_first_name = $contact['first_name'];
                    $contact_last_name = $contact['last_name'];
                    $contact_email = $contact['email'];
                    $contact_avatar_url = $contact['avatar_url'];
                }
            }

            // Get participant info from first message metadata
            $first_message = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT metadata FROM {$tickets_table} WHERE ticket_id = %s AND role = 'user' ORDER BY timestamp ASC LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    $ticket_id
                ),
                ARRAY_A
            );

            $participant_name = __('Ticket User', 'helpmate-ai-chatbot');
            $participant_email = null;
            if ($first_message && !empty($first_message['metadata'])) {
                $metadata = json_decode($first_message['metadata'], true);
                if (is_array($metadata)) {
                    $participant_name = !empty($metadata['name']) ? $metadata['name'] : (!empty($metadata['email']) ? $metadata['email'] : $participant_name);
                    $participant_email = !empty($metadata['email']) ? $metadata['email'] : null;
                }
            }

            // Use contact info if available, otherwise use participant info
            $display_name = $contact_first_name || $contact_last_name
                ? trim($contact_first_name . ' ' . $contact_last_name)
                : ($contact_email ?: $participant_name);
            $display_email = $contact_email ?: $participant_email;

            $conversation = [
                'id' => 'ticket_' . $ticket_id, // Prefixed ID to distinguish from social conversations
                'account_id' => 0, // No account for tickets
                'account_name' => null,
                'platform' => 'ticket',
                'external_id' => $ticket_id,
                'participant_id' => $ticket_id,
                'participant_name' => $display_name,
                'participant_profile_pic' => null,
                'contact_id' => $contact_id,
                'contact_first_name' => $contact_first_name,
                'contact_last_name' => $contact_last_name,
                'contact_email' => $contact_email,
                'contact_avatar_url' => $contact_avatar_url,
                'status' => $inbox_status,
                'is_human_handoff' => true, // Tickets are always human handoff
                'handoff_at' => gmdate('Y-m-d H:i:s', (int)$ticket['timestamp']),
                'unread_count' => $this->get_ticket_unread($ticket_id),
                'last_message_at' => gmdate('Y-m-d H:i:s', (int)$ticket['last_message_timestamp']),
                'created_at' => gmdate('Y-m-d H:i:s', (int)$ticket['timestamp']),
                'subject' => $ticket['subject'], // Store subject for display
            ];

            // Apply search filter if set
            if (!empty($filters['search'])) {
                $search_lower = strtolower($filters['search']);
                $participant_name = strtolower($conversation['participant_name']);
                $first_name = $contact_first_name ? strtolower($contact_first_name) : '';
                $last_name = $contact_last_name ? strtolower($contact_last_name) : '';
                $email = $contact_email ? strtolower($contact_email) : '';
                $subject = isset($conversation['subject']) ? strtolower($conversation['subject']) : '';

                if (strpos($participant_name, $search_lower) === false &&
                    strpos($first_name, $search_lower) === false &&
                    strpos($last_name, $search_lower) === false &&
                    strpos($email, $search_lower) === false &&
                    strpos($subject, $search_lower) === false) {
                    continue;
                }
            }

            // Apply date filters if set
            $last_message_at = $conversation['last_message_at'];
            $created_at = $conversation['created_at'];
            $date_to_check = !empty($last_message_at) ? $last_message_at : $created_at;

            if (!empty($filters['date_from']) && !empty($date_to_check)) {
                if (strtotime($date_to_check) < strtotime($filters['date_from'] . ' 00:00:00')) {
                    continue;
                }
            }

            if (!empty($filters['date_to']) && !empty($date_to_check)) {
                if (strtotime($date_to_check) > strtotime($filters['date_to'] . ' 23:59:59')) {
                    continue;
                }
            }

            $conversations[] = $conversation;
        }

        // Sort by last_message_at (already sorted, but ensure)
        usort($conversations, function($a, $b) {
            return strtotime($b['last_message_at']) - strtotime($a['last_message_at']);
        });

        $total = count($conversations);

        // Apply pagination
        $offset = ($page - 1) * $per_page;
        $conversations = array_slice($conversations, $offset, $per_page);

        return [
            'conversations' => $conversations,
            'total' => $total
        ];
    }

    /**
     * Get or create a conversation.
     *
     * @since    1.2.0
     * @param    array    $data    Conversation data.
     * @return   array    The conversation.
     */
    public function get_or_create_conversation(array $data): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        // Try to find existing conversation
        // For comments (fb_comment, ig_comment), match on post_id so each post gets a separate conversation
        $is_comment = in_array($data['platform'] ?? '', ['fb_comment', 'ig_comment'], true);
        $post_id_param = !empty($data['post_id']) ? $data['post_id'] : '';

        if ($is_comment) {
            $conversation = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE account_id = %d AND participant_id = %s AND platform = %s AND COALESCE(post_id, '') = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    $data['account_id'],
                    $data['participant_id'],
                    $data['platform'],
                    $post_id_param
                ),
                ARRAY_A
            );
        } else {
            $conversation = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE account_id = %d AND participant_id = %s AND platform = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    $data['account_id'],
                    $data['participant_id'],
                    $data['platform']
                ),
                ARRAY_A
            );
        }

        if ($conversation) {
            return $conversation;
        }

        // Create new conversation
        $insert_data = [
            'account_id' => (int) $data['account_id'],
            'platform' => sanitize_text_field($data['platform']),
            'external_id' => sanitize_text_field($data['external_id'] ?? ''),
            'post_id' => isset($data['post_id']) ? sanitize_text_field($data['post_id']) : null,
            'post_type' => isset($data['post_type']) ? sanitize_text_field($data['post_type']) : null,
            'post_message' => isset($data['post_message']) ? sanitize_textarea_field($data['post_message']) : null,
            'post_image_url' => isset($data['post_image_url']) ? esc_url_raw($data['post_image_url']) : null,
            'parent_comment_id' => isset($data['parent_comment_id']) ? sanitize_text_field($data['parent_comment_id']) : null,
            'participant_id' => sanitize_text_field($data['participant_id']),
            'participant_name' => sanitize_text_field($data['participant_name'] ?? ''),
            'participant_profile_pic' => esc_url_raw($data['participant_profile_pic'] ?? ''),
            'status' => 'open',
            'is_human_handoff' => 0,
            'unread_count' => 0,
            'created_at' => current_time('mysql')
        ];

        $wpdb->insert($table, $insert_data); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery

        $conv_id = $wpdb->insert_id;

        return array_merge($insert_data, ['id' => $conv_id]);
    }

    /**
     * Get messages for a conversation.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @param    int    $page               Page number.
     * @param    int    $per_page           Items per page.
     * @return   array    The messages with pagination.
     */
    public function get_messages($conversation_id, int $page = 1, int $per_page = 50): array
    {
        // Check if this is a ticket (virtual ID starts with 'ticket_')
        if (is_string($conversation_id) && strpos($conversation_id, 'ticket_') === 0) {
            $ticket_id = substr($conversation_id, 7); // Remove 'ticket_' prefix
            return $this->get_ticket_messages($ticket_id, $page, $per_page);
        }

        // Check if this is a website conversation (virtual ID starts with 'website_')
        if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
            // Extract session_id from virtual ID
            $session_id = $this->get_session_id_from_virtual_id($conversation_id);
            if ($session_id) {
                return $this->get_website_messages($session_id, $page, $per_page);
            }
        }

        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_messages');
        $offset = ($page - 1) * $per_page;

        $total = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE conversation_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                (int) $conversation_id
            )
        );

        $messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE conversation_id = %d ORDER BY created_at ASC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                (int) $conversation_id,
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        // Add WordPress user info for human messages and parse meta_data
        foreach ($messages as &$message) {
            if ($message['sent_by'] === 'human' && !empty($message['user_id'])) {
                $user = get_userdata((int) $message['user_id']);
                if ($user) {
                    $message['user_name'] = $user->display_name;
                    $message['user_avatar'] = get_avatar_url((int) $message['user_id'], ['size' => 32]);
                }
            }
            // Parse meta_data JSON if present
            if (!empty($message['meta_data'])) {
                $message['meta_data'] = json_decode($message['meta_data'], true);
            }
        }

        return [
            'messages' => $messages,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => (int) $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Get session_id from virtual conversation ID.
     *
     * @since    1.3.0
     * @param    string    $virtual_id    The virtual conversation ID (website_xxxx).
     * @return   string|null    The session_id or null.
     */
    public function get_session_id_from_virtual_id(string $virtual_id): ?string
    {
        // Virtual ID format: website_{md5(session_id)}
        // We need to find the session_id by matching the hash
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');
        $hash = str_replace('website_', '', $virtual_id);

        // Get all unique session IDs and find the one that matches
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $sessions = $wpdb->get_col(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT DISTINCT session_id FROM {$table}"
        );

        foreach ($sessions as $session_id) {
            if (md5($session_id) === $hash) {
                return $session_id;
            }
        }

        return null;
    }

    /**
     * Get ticket messages in SocialMessage format.
     *
     * @since    1.4.0
     * @param    string    $ticket_id    The ticket ID.
     * @param    int       $page         Page number.
     * @param    int       $per_page     Items per page.
     * @return   array     The messages with pagination.
     */
    private function get_ticket_messages(string $ticket_id, int $page = 1, int $per_page = 50): array
    {
        global $wpdb;
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');
        $offset = ($page - 1) * $per_page;

        // Get total count
        $total = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$tickets_table} WHERE ticket_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $ticket_id
            )
        );

        // Get messages
        $ticket_messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$tickets_table} WHERE ticket_id = %s ORDER BY timestamp ASC LIMIT %d OFFSET %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $ticket_id,
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        // Transform to SocialMessage format
        $messages = [];
        foreach ($ticket_messages as $msg) {
            $metadata = json_decode($msg['metadata'], true);
            if (!is_array($metadata)) {
                $metadata = [];
            }

            // Map role to direction and sent_by
            $direction = $msg['role'] === 'user' ? 'inbound' : 'outbound';
            $sent_by = $msg['role'] === 'admin' ? 'human' : 'customer';

            // Get user info if admin
            $user_name = null;
            $user_avatar = null;
            if ($msg['role'] === 'admin' && !empty($msg['user_id'])) {
                $user = get_userdata((int) $msg['user_id']);
                if ($user) {
                    $user_name = $user->display_name;
                    $user_avatar = get_avatar_url((int) $msg['user_id'], ['size' => 32]);
                }
            }

            $messages[] = [
                'id' => (int) $msg['id'],
                'conversation_id' => 'ticket_' . $ticket_id,
                'external_id' => null,
                'direction' => $direction,
                'content' => $msg['message'],
                'message_type' => 'text',
                'sent_by' => $sent_by,
                'user_id' => !empty($msg['user_id']) ? (int) $msg['user_id'] : null,
                'user_name' => $user_name,
                'user_avatar' => $user_avatar,
                'error_message' => null,
                'meta_data' => $metadata,
                'created_at' => gmdate('Y-m-d H:i:s', (int) $msg['timestamp']),
            ];
        }

        return [
            'messages' => $messages,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => (int) $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Get website chat messages for a session.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @param    int       $page          Page number.
     * @param    int       $per_page      Items per page.
     * @return   array    The messages with pagination.
     */
    private function get_website_messages(string $session_id, int $page = 1, int $per_page = 50): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');
        $offset = ($page - 1) * $per_page;

        // Get total count
        $total = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE session_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $session_id
            )
        );

        // Get messages
        $messages_data = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT id, message, role, timestamp, metadata
                FROM {$table}
                WHERE session_id = %s
                ORDER BY timestamp ASC
                LIMIT %d OFFSET %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $session_id,
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        // Convert to social message format
        $messages = [];
        foreach ($messages_data as $msg) {
            $metadata = json_decode($msg['metadata'], true);
            if (!is_array($metadata)) {
                $metadata = [];
            }

            // Handle system messages (join notifications, etc.)
            if ($msg['role'] === 'system') {
                $message = [
                    'id' => $msg['id'],
                    'conversation_id' => 'website_' . md5($session_id),
                    'external_id' => null,
                    'direction' => 'outbound',
                    'content' => $msg['message'],
                    'message_type' => 'system',
                    'sent_by' => 'system',
                    'user_id' => isset($metadata['user_id']) ? (int) $metadata['user_id'] : null,
                    'error_message' => null,
                    'system_event' => isset($metadata['system_event']) ? $metadata['system_event'] : null,
                    'system_data' => isset($metadata['system_event']) ? [
                        'user_id' => isset($metadata['user_id']) ? (int) $metadata['user_id'] : null,
                        'first_name' => isset($metadata['first_name']) ? $metadata['first_name'] : null,
                    ] : null,
                    'meta_data' => $metadata,
                    'created_at' => gmdate('Y-m-d H:i:s', (int) $msg['timestamp']),
                ];
                $messages[] = $message;
                continue;
            }

            // Determine sent_by based on role and metadata
            $sent_by = 'customer';
            if ($msg['role'] === 'assistant') {
                $sent_by = isset($metadata['sent_by_human']) && $metadata['sent_by_human'] ? 'human' : 'ai';
            }

            // Parse message content (can be JSON string for assistant messages)
            $content = $msg['message'];
            if ($msg['role'] === 'assistant') {
                $parsed = json_decode($content, true);
                if (is_array($parsed)) {
                    if (isset($parsed['text'])) {
                        $content = $parsed['text'];
                    }
                    if (!empty($parsed['type'])) {
                        $metadata['tool_type'] = $parsed['type'];
                    }
                    if (!empty($parsed['data'])) {
                        $metadata['tool_data'] = $parsed['data'];
                    }
                }
            }

            $message = [
                'id' => $msg['id'],
                'conversation_id' => 'website_' . md5($session_id),
                'external_id' => null,
                'direction' => $msg['role'] === 'user' ? 'inbound' : 'outbound',
                'content' => $content,
                'message_type' => 'text',
                'sent_by' => $sent_by,
                'user_id' => isset($metadata['user_id']) ? (int) $metadata['user_id'] : null,
                'error_message' => null,
                'meta_data' => $metadata,
                'created_at' => gmdate('Y-m-d H:i:s', (int) $msg['timestamp']),
            ];

            // Add user info for human messages
            if ($sent_by === 'human' && !empty($message['user_id'])) {
                $user = get_userdata($message['user_id']);
                if ($user) {
                    $message['user_name'] = $user->display_name;
                    $message['user_avatar'] = get_avatar_url($message['user_id'], ['size' => 32]);
                }
            }

            $messages[] = $message;
        }

        return [
            'messages' => $messages,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => (int) $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ];
    }

    /**
     * Save a message.
     *
     * @since    1.2.0
     * @param    array    $data    Message data.
     * @return   int|false    The message ID or false on failure.
     */
    public function save_message(array $data)
    {
        global $wpdb;
        $messages_table = esc_sql($wpdb->prefix . 'helpmate_social_messages');
        $conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        $insert_data = [
            'conversation_id' => (int) $data['conversation_id'],
            'external_id' => isset($data['external_id']) ? sanitize_text_field($data['external_id']) : null,
            'direction' => sanitize_text_field($data['direction']),
            'content' => sanitize_textarea_field($data['content']),
            'message_type' => sanitize_text_field($data['message_type'] ?? 'text'),
            'sent_by' => sanitize_text_field($data['sent_by']),
            'user_id' => isset($data['user_id']) ? (int) $data['user_id'] : null,
            'error_message' => isset($data['error_message']) ? sanitize_text_field($data['error_message']) : null,
            'meta_data' => isset($data['meta_data']) ? wp_json_encode($data['meta_data']) : null,
            'created_at' => current_time('mysql')
        ];

        $result = $wpdb->insert($messages_table, $insert_data); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery

        if ($result) {
            // Update conversation's last message timestamp
            $update_data = ['last_message_at' => current_time('mysql')];

            // Increment unread count for inbound messages
            if ($data['direction'] === 'inbound') {
                $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        "UPDATE {$conversations_table} SET unread_count = unread_count + 1, last_message_at = %s WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        current_time('mysql'),
                        $data['conversation_id']
                    )
                );
                $notifications = $this->helpmate->get_notifications();
                if ($notifications) {
                    // Get platform from conversation
                    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                    $conversation = $wpdb->get_row(
                        $wpdb->prepare(
                            "SELECT platform FROM {$conversations_table} WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                            $data['conversation_id']
                        ),
                        ARRAY_A
                    );

                    $preview = wp_trim_words(wp_strip_all_tags($data['content']), 15);
                    $notification_title = in_array(($conversation ?? [])['platform'] ?? '', ['fb_comment', 'ig_comment'], true)
                        ? __('New comment', 'helpmate-ai-chatbot')
                        : __('New message', 'helpmate-ai-chatbot');
                    $notifications->create(
                        0,
                        'social_message',
                        $notification_title,
                        $preview,
                        admin_url('admin.php?page=helpmate&tab=social-chat&subtab=inbox&conversation_id=' . rawurlencode((string) $data['conversation_id'])),
                        $conversation && isset($conversation['platform']) ? ['platform' => $conversation['platform']] : [],
                        'conversation',
                        (int) $data['conversation_id']
                    );
                }
            } else {
                $wpdb->update($conversations_table, $update_data, ['id' => $data['conversation_id']]); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            }

            return $wpdb->insert_id;
        }

        return false;
    }

    /**
     * Toggle human handoff for a conversation.
     *
     * @since    1.2.0
     * @param    int     $conversation_id    The conversation ID.
     * @param    bool    $handoff            Whether to enable handoff.
     * @return   bool    Whether the update was successful.
     */
    public function toggle_handoff(int $conversation_id, bool $handoff): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        $update_data = [
            'is_human_handoff' => $handoff ? 1 : 0,
            'handoff_at' => $handoff ? current_time('mysql') : null
        ];

        $result = $wpdb->update($table, $update_data, ['id' => $conversation_id]); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

        return $result !== false;
    }

    /**
     * Update conversation status.
     *
     * @since    1.2.0
     * @param    int       $conversation_id    The conversation ID.
     * @param    string    $status             The new status.
     * @return   bool    Whether the update was successful.
     */
    public function update_conversation_status(int $conversation_id, string $status): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            ['status' => sanitize_text_field($status)],
            ['id' => $conversation_id]
        );

        return $result !== false;
    }

    /**
     * Bulk toggle human handoff for all conversations of a platform.
     *
     * @since    1.2.0
     * @param    string    $platform    The platform identifier (messenger, instagram_dm, whatsapp).
     * @param    bool      $handoff     Whether to enable or disable handoff.
     * @return   int    The number of conversations updated, or -1 on failure.
     */
    public function bulk_toggle_handoff_by_platform(string $platform, bool $handoff): int
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        // Map platform keys to actual platform values in database
        $platform_map = [
            'messenger' => 'messenger',
            'instagram_dm' => 'instagram',
            'whatsapp' => 'whatsapp',
        ];

        $db_platform = $platform_map[$platform] ?? $platform;

        $update_data = [
            'is_human_handoff' => $handoff ? 1 : 0,
            'handoff_at' => $handoff ? current_time('mysql') : null
        ];

        $where = [
            'platform' => $db_platform
        ];

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            $update_data,
            $where,
            ['%d', '%s'],
            ['%s']
        );

        if ($result === false) {
            return -1; // Return -1 to indicate error
        }

        // Send email notifications for conversations that were set to handoff
        if ($handoff && $result > 0) {
        }

        return $result;
    }

    /**
     * Link a contact to a conversation.
     *
     * @since    1.3.0
     * @param    int    $conversation_id    The conversation ID.
     * @param    int    $contact_id         The contact ID.
     * @return   bool    Whether the update was successful.
     */
    public function link_contact_to_conversation(int $conversation_id, int $contact_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            ['contact_id' => (int) $contact_id],
            ['id' => $conversation_id]
        );

        return $result !== false;
    }

    /**
     * Link contact to website conversation (stored in options).
     *
     * @since 1.0.0
     * @param string $virtual_id The virtual conversation ID (website_xxx).
     * @param int $contact_id The contact ID to link.
     * @return bool True on success, false on failure.
     */
    public function link_contact_to_website_conversation(string $virtual_id, int $contact_id): bool
    {
        $session_id = $this->get_session_id_from_virtual_id($virtual_id);
        if (!$session_id) {
            return false;
        }

        $option_key = 'helpmate_website_conversation_contact_' . md5($session_id);
        return update_option($option_key, (int) $contact_id);
    }

    /**
     * Unlink contact from website conversation.
     *
     * @since 1.0.0
     * @param string $virtual_id The virtual conversation ID (website_xxx).
     * @return bool True on success, false on failure.
     */
    public function unlink_contact_from_website_conversation(string $virtual_id): bool
    {
        $session_id = $this->get_session_id_from_virtual_id($virtual_id);
        if (!$session_id) {
            return false;
        }

        $option_key = 'helpmate_website_conversation_contact_' . md5($session_id);
        return delete_option($option_key);
    }

    /**
     * Get contact ID for website conversation.
     *
     * @since 1.0.0
     * @param string $session_id The session ID.
     * @return int|null The contact ID or null if not linked.
     */
    public function get_contact_id_for_website_conversation(string $session_id): ?int
    {
        $option_key = 'helpmate_website_conversation_contact_' . md5($session_id);
        $contact_id = get_option($option_key);
        return $contact_id ? (int) $contact_id : null;
    }

    /**
     * Unlink a contact from a conversation.
     *
     * @since    1.3.0
     * @param    int    $conversation_id    The conversation ID.
     * @return   bool    Whether the update was successful.
     */
    public function unlink_contact_from_conversation(int $conversation_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            ['contact_id' => null],
            ['id' => $conversation_id]
        );

        return $result !== false;
    }

    /**
     * Get contact for a conversation.
     *
     * @since    1.3.0
     * @param    int    $conversation_id    The conversation ID.
     * @return   array|null    The contact data or null if not linked.
     */
    public function get_conversation_contact(int $conversation_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        $conversation = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT contact_id FROM {$table} WHERE id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $conversation_id
            ),
            ARRAY_A
        );

        if (!$conversation || empty($conversation['contact_id'])) {
            return null;
        }

        $contact_id = (int) $conversation['contact_id'];
        return $this->helpmate->get_crm()->get_contact($contact_id);
    }

    /**
     * Mark conversation as read.
     *
     * @since    1.2.0
     * @param    int|string    $conversation_id    The conversation ID (int for social, string for website).
     * @return   bool    Whether the update was successful.
     */
    public function mark_as_read($conversation_id): bool
    {
        // Handle website conversations
        if (is_string($conversation_id) && strpos($conversation_id, 'website_') === 0) {
            $session_id = $this->get_session_id_from_virtual_id($conversation_id);
            if ($session_id) {
                $this->reset_website_unread($session_id);
                return true;
            }
            return false;
        }

        // Handle ticket conversations
        if (is_string($conversation_id) && strpos($conversation_id, 'ticket_') === 0) {
            $ticket_id = substr($conversation_id, 7); // Remove 'ticket_' prefix
            $this->reset_ticket_unread($ticket_id);
            return true;
        }

        // Handle social conversations (database)
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            ['unread_count' => 0],
            ['id' => $conversation_id]
        );

        return $result !== false;
    }

    /**
     * Increment unread count for a website conversation.
     *
     * @since    1.4.0
     * @param    string    $session_id    The website session ID.
     * @return   void
     */
    public function increment_website_unread(string $session_id): void
    {
        $transient_key = 'helpmate_unread_website_' . $session_id;
        $current_count = get_transient($transient_key);
        $new_count = ($current_count !== false) ? (int) $current_count + 1 : 1;
        // Store for 30 days (same as typical session lifetime)
        set_transient($transient_key, $new_count, 30 * DAY_IN_SECONDS);
    }

    /**
     * Get unread count for a website conversation.
     *
     * @since    1.4.0
     * @param    string    $session_id    The website session ID.
     * @return   int    The unread count.
     */
    private function get_website_unread(string $session_id): int
    {
        $transient_key = 'helpmate_unread_website_' . $session_id;
        $count = get_transient($transient_key);
        return ($count !== false) ? (int) $count : 0;
    }

    /**
     * Reset unread count for a website conversation.
     *
     * @since    1.4.0
     * @param    string    $session_id    The website session ID.
     * @return   void
     */
    private function reset_website_unread(string $session_id): void
    {
        $transient_key = 'helpmate_unread_website_' . $session_id;
        delete_transient($transient_key);
    }

    /**
     * Increment unread count for a ticket conversation.
     *
     * @since    1.4.0
     * @param    string    $ticket_id    The ticket ID.
     * @return   void
     */
    public function increment_ticket_unread(string $ticket_id): void
    {
        $transient_key = 'helpmate_unread_ticket_' . $ticket_id;
        $current_count = get_transient($transient_key);
        $new_count = ($current_count !== false) ? (int) $current_count + 1 : 1;
        // Store for 90 days (tickets may be older)
        set_transient($transient_key, $new_count, 90 * DAY_IN_SECONDS);
    }

    /**
     * Get unread count for a ticket conversation.
     *
     * @since    1.4.0
     * @param    string    $ticket_id    The ticket ID.
     * @return   int    The unread count.
     */
    private function get_ticket_unread(string $ticket_id): int
    {
        $transient_key = 'helpmate_unread_ticket_' . $ticket_id;
        $count = get_transient($transient_key);
        return ($count !== false) ? (int) $count : 0;
    }

    /**
     * Reset unread count for a ticket conversation.
     *
     * @since    1.4.0
     * @param    string    $ticket_id    The ticket ID.
     * @return   void
     */
    private function reset_ticket_unread(string $ticket_id): void
    {
        $transient_key = 'helpmate_unread_ticket_' . $ticket_id;
        delete_transient($transient_key);
    }

    /**
     * Get recent messages for AI context.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @param    int    $limit              Number of messages to get.
     * @return   array    The recent messages.
     */
    public function get_recent_messages_for_context(int $conversation_id, int $limit = 10): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_messages');

        $messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT direction, content, sent_by FROM {$table}
                WHERE conversation_id = %d
                ORDER BY created_at DESC
                LIMIT %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $conversation_id,
                $limit
            ),
            ARRAY_A
        );

        // Reverse to get chronological order
        return array_reverse($messages);
    }

    /**
     * Check if a conversation has any messages.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @return   bool    True if conversation is empty (no messages), false otherwise.
     */
    public function is_conversation_empty(int $conversation_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_messages');

        $count = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE conversation_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $conversation_id
            )
        );

        return (int) $count === 0;
    }

    /**
     * Get basic analytics for social chat.
     *
     * @since    1.2.0
     * @param    string    $date_filter    Date filter (7d, 30d, 90d, all).
     * @return   array    The analytics data.
     */
    public function get_analytics(string $date_filter = '30d', $user_id = null): array
    {
        global $wpdb;
        $messages_table = esc_sql($wpdb->prefix . 'helpmate_social_messages');
        $conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        // Calculate date range
        $date_where = '';
        if ($date_filter !== 'all') {
            $days = (int) str_replace('d', '', $date_filter);
            $date_where = $wpdb->prepare(' AND created_at >= %s', gmdate('Y-m-d H:i:s', strtotime("-{$days} days")));
        }

        // Total messages
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $date_where is already prepared with wpdb->prepare() on line 1597; table name is safe
        $total_inbound = $wpdb->get_var(
            sprintf("SELECT COUNT(*) FROM %s WHERE direction = 'inbound'", $messages_table) . $date_where // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table name is escaped; date filter is already prepared
        );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $date_where is already prepared with wpdb->prepare() on line 1597; table name is safe
        $total_outbound = $wpdb->get_var(
            sprintf("SELECT COUNT(*) FROM %s WHERE direction = 'outbound'", $messages_table) . $date_where // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table name is escaped; date filter is already prepared
        );

        // AI vs Human responses
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $date_where is already prepared with wpdb->prepare() on line 1597; table name is safe
        $ai_responses = $wpdb->get_var(
            sprintf("SELECT COUNT(*) FROM %s WHERE sent_by = 'ai'", $messages_table) . $date_where // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table name is escaped; date filter is already prepared
        );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $date_where is already prepared with wpdb->prepare() on line 1597; table name is safe
        $human_responses = $wpdb->get_var(
            sprintf("SELECT COUNT(*) FROM %s WHERE sent_by = 'human'", $messages_table) . $date_where // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table name is escaped; date filter is already prepared
        );

        // Handoff rate
        $conversations_date_where = str_replace('created_at', 'c.created_at', $date_where);
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $conversations_date_where derived from already-prepared $date_where; table name is safe
        $total_conversations = $wpdb->get_var(
            sprintf("SELECT COUNT(*) FROM %s c WHERE 1=1", $conversations_table) . $conversations_date_where // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table name is escaped; date filter is already prepared
        );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $conversations_date_where derived from already-prepared $date_where; table name is safe
        $handoff_conversations = $wpdb->get_var(
            sprintf("SELECT COUNT(*) FROM %s c WHERE is_human_handoff = 1", $conversations_table) . $conversations_date_where // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table name is escaped; date filter is already prepared
        );

        // Messages by platform - use m.created_at to avoid ambiguity
        $messages_date_where = str_replace('created_at', 'm.created_at', $date_where);
        $platform_query = sprintf("SELECT c.platform, COUNT(m.id) as count
            FROM %s m
            INNER JOIN %s c ON m.conversation_id = c.id
            WHERE 1=1%s
            GROUP BY c.platform", $messages_table, $conversations_table, $messages_date_where); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table names are escaped; date filter is already prepared
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $messages_date_where derived from already-prepared $date_where; table names are safe
        $by_platform = $wpdb->get_results(
            $platform_query, // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Query built safely with escaped table names and prepared date filter
            ARRAY_A
        );

        // CRM-linked conversations (conversations with contact_id)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $conversations_date_where derived from already-prepared $date_where; table name is safe
        $crm_linked_conversations = $wpdb->get_var(
            sprintf("SELECT COUNT(*) FROM %s c WHERE contact_id IS NOT NULL", $conversations_table) . $conversations_date_where // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Table name is escaped; date filter is already prepared
        );

        // Manual responses (messages with user_id, indicating human response)
        // When user_id is provided, filter by that specific user; otherwise count all manual responses
        if ($user_id) {
            if ($date_where) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $manual_responses = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$messages_table} WHERE user_id = %d AND direction = 'outbound' AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, escaped with esc_sql()
                    $user_id,
                    gmdate('Y-m-d H:i:s', strtotime("-" . (int) str_replace('d', '', $date_filter) . " days"))
                ));
            } else {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $manual_responses = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$messages_table} WHERE user_id = %d AND direction = 'outbound'", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, escaped with esc_sql()
                    $user_id
                ));
            }
        } else {
            if ($date_where) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $manual_responses = $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$messages_table} WHERE user_id IS NOT NULL AND direction = 'outbound' AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, escaped with esc_sql()
                    gmdate('Y-m-d H:i:s', strtotime("-" . (int) str_replace('d', '', $date_filter) . " days"))
                ));
            } else {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
                $manual_responses = $wpdb->get_var(
                    "SELECT COUNT(*) FROM {$messages_table} WHERE user_id IS NOT NULL AND direction = 'outbound'" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, escaped with esc_sql()
                );
            }
        }

        $handoff_rate = $total_conversations > 0
            ? round(($handoff_conversations / $total_conversations) * 100, 1)
            : 0;

        $crm_link_rate = $total_conversations > 0
            ? round(($crm_linked_conversations / $total_conversations) * 100, 1)
            : 0;

        $manual_response_rate = $total_outbound > 0
            ? round(($manual_responses / $total_outbound) * 100, 1)
            : 0;

        return [
            'total_messages_inbound' => (int) $total_inbound,
            'total_messages_outbound' => (int) $total_outbound,
            'ai_responses' => (int) $ai_responses,
            'human_responses' => (int) $human_responses,
            'total_conversations' => (int) $total_conversations,
            'handoff_conversations' => (int) $handoff_conversations,
            'handoff_rate' => $handoff_rate,
            'crm_linked_conversations' => (int) $crm_linked_conversations,
            'crm_link_rate' => $crm_link_rate,
            'manual_responses' => (int) $manual_responses,
            'manual_response_rate' => $manual_response_rate,
            'messages_by_platform' => $by_platform
        ];
    }

    /**
     * Get unread conversation count.
     *
     * @since    1.2.0
     * @return   int    The count of conversations with unread messages.
     */
    public function get_unread_count(): int
    {
        global $wpdb;
        $count = 0;

        // Count social conversations with unread messages
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
        $count += (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*) FROM {$table} WHERE unread_count > 0" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );

        // Count website conversations with unread messages
        $chat_history_table = esc_sql($wpdb->prefix . 'helpmate_chat_history');
        // Get all unique session IDs (excluding debug sessions)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $sessions = $wpdb->get_col(
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT DISTINCT session_id
            FROM {$chat_history_table}
            WHERE session_id NOT IN (
                SELECT DISTINCT session_id
                FROM {$chat_history_table}
                WHERE JSON_EXTRACT(metadata, '$.debug') = true
            )"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        foreach ($sessions as $session_id) {
            if ($this->get_website_unread($session_id) > 0) {
                $count++;
            }
        }

        // Count ticket conversations with unread messages
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');
        // Get all unique ticket IDs
        $ticket_ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT DISTINCT ticket_id FROM {$tickets_table} WHERE role = 'user'" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        foreach ($ticket_ids as $ticket_id) {
            if ($this->get_ticket_unread($ticket_id) > 0) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Get handoff pending count.
     *
     * @since    1.2.0
     * @return   int    The count of conversations awaiting human response.
     */
    public function get_handoff_pending_count(): int
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

        return (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT COUNT(*) FROM {$table} WHERE is_human_handoff = 1 AND status = 'open'" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
    }

    /**
     * Get unread conversation counts per inbox tab (for sidebar badges).
     * Keys: chatbot, live_chat, tickets, social_messages, comments.
     *
     * @since    1.4.0
     * @return   array{chatbot: int, live_chat: int, tickets: int, social_messages: int, comments: int}
     */
    public function get_inbox_unread_counts(): array
    {
        global $wpdb;
        $chat_history_table = esc_sql($wpdb->prefix . 'helpmate_chat_history');
        $social_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');

        $chatbot = 0;
        $website_unread = 0;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary; caching not appropriate for frequently changing data
        $sessions = $wpdb->get_col(
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT DISTINCT session_id
            FROM {$chat_history_table}
            WHERE session_id NOT IN (
                SELECT DISTINCT session_id
                FROM {$chat_history_table}
                WHERE JSON_EXTRACT(metadata, '$.debug') = true
            )"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        foreach ($sessions as $session_id) {
            if ($this->get_website_unread($session_id) > 0) {
                $website_unread++;
                if (! $this->get_website_handoff_status($session_id)) {
                    $chatbot++;
                }
            }
        }

        // Social: unread by platform (messenger, instagram, whatsapp = live_chat + social_messages; fb_comment, ig_comment = comments).
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary
        $social_messages = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$social_table} WHERE unread_count > 0 AND platform IN ('messenger', 'instagram', 'whatsapp')" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for unread counts
        $social_comments = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$social_table} WHERE unread_count > 0 AND platform IN ('fb_comment', 'ig_comment')" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query necessary for unread counts
        $social_chat_unread = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$social_table} WHERE unread_count > 0 AND platform IN ('messenger', 'instagram', 'whatsapp')" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        $live_chat = $website_unread + $social_chat_unread;

        $tickets = 0;
        $ticket_ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            "SELECT DISTINCT ticket_id FROM {$tickets_table} WHERE role = 'user'" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        if (is_array($ticket_ids)) {
            foreach ($ticket_ids as $ticket_id) {
                if ($this->get_ticket_unread($ticket_id) > 0) {
                    $tickets++;
                }
            }
        }

        return [
            'chatbot'         => $chatbot,
            'live_chat'       => $live_chat,
            'tickets'         => $tickets,
            'social_messages' => $social_messages,
            'comments'        => $social_comments,
        ];
    }

    /**
     * Extract profile picture URL from Graph API response.
     * Supports both 'picture' (picture.data.url) and legacy 'profile_pic' (direct URL).
     *
     * @since    1.2.0
     * @param    array    $data    Decoded Graph API response.
     * @return   string|null    Profile picture URL or null.
     */
    private function extract_profile_pic_from_graph_response(array $data): ?string
    {
        if (!empty($data['profile_pic'])) {
            return $data['profile_pic'];
        }
        if (!empty($data['profile_picture_url'])) {
            return $data['profile_picture_url'];
        }
        $url = $data['picture']['data']['url'] ?? $data['picture']['url'] ?? null;
        return !empty($url) ? $url : null;
    }

    /**
     * Fetch user profile from Meta Graph API.
     *
     * @since    1.2.0
     * @param    string    $participant_id    The participant ID (sender ID).
     * @param    array     $account           The account data with access token.
     * @param    string    $platform          The platform (messenger, instagram, etc.).
     * @return   array|null    User profile data (name, profile_pic) or null on failure.
     */
    public function fetch_user_profile_from_meta(string $participant_id, array $account, string $platform): ?array
    {
        $access_token = $account['access_token'] ?? '';
        if (empty($access_token)) {
            return null;
        }

        $graph_version = 'v18.0';
        $graph_base_url = 'https://graph.facebook.com';

        try {
            // For Instagram (DMs and comments): use IGSID with Messenger Platform User Profile API
            // https://developers.facebook.com/docs/messenger-platform/instagram/features/user-profile
            // Field is profile_pic (direct URL). Requires Page token; comment-only users may lack consent.
            if ($platform === 'instagram') {
                $url = "{$graph_base_url}/{$graph_version}/{$participant_id}";
                $params = [
                    'fields' => 'name,username,profile_pic',
                    'access_token' => $access_token,
                ];

                $response = wp_remote_get(
                    add_query_arg($params, $url),
                    [
                        'timeout' => 10,
                        'headers' => [
                            'Content-Type' => 'application/json',
                        ],
                    ]
                );

                if (is_wp_error($response)) {
                    return null;
                }

                $body = wp_remote_retrieve_body($response);
                $data = json_decode($body, true);

                if (isset($data['error'])) {
                    return null;
                }

                $profile_pic = $this->extract_profile_pic_from_graph_response($data);
                if (isset($data['name']) || $profile_pic) {
                    return [
                        'name' => $data['name'] ?? '',
                        'profile_pic' => $profile_pic ?? '',
                    ];
                }
            }

            // For Messenger, PSID requires page access token and specific permissions
            // Note: Messenger PSID queries often fail due to privacy/permissions
            // User info should ideally come from webhook payload, but we try API as fallback
            if ($platform === 'messenger') {
                // For Messenger, the participant_id is a PSID (Page-Scoped ID)
                // We need to use the page access token to query user info
                // However, this often fails due to privacy settings or missing permissions
                $url = "{$graph_base_url}/{$graph_version}/{$participant_id}";
                $params = [
                    'fields' => 'name,first_name,last_name,picture',
                    'access_token' => $access_token,
                ];

                $response = wp_remote_get(
                    add_query_arg($params, $url),
                    [
                        'timeout' => 10,
                        'headers' => [
                            'Content-Type' => 'application/json',
                        ],
                    ]
                );

                if (is_wp_error($response)) {
                    // Don't log this as error - it's expected for Messenger due to privacy
                    return null;
                }

                $body = wp_remote_retrieve_body($response);
                $data = json_decode($body, true);

                if (isset($data['error'])) {
                    // Messenger PSID queries often fail - this is normal due to privacy/permissions
                    // Don't log as error unless it's an unexpected error code
                    $error_code = $data['error']['code'] ?? 0;
                    $error_subcode = $data['error']['error_subcode'] ?? 0;

                    // Common error codes for Messenger:
                    // 100: Invalid parameter (PSID doesn't exist or invalid)
                    // 803: User hasn't interacted with page
                    // 10: Permission denied
                    // 200: Permission denied (user privacy settings)
                    // Only log unexpected errors
                    if (!in_array($error_code, [100, 803, 10, 200]) && $error_subcode !== 2018218) {
                    }
                    return null;
                }

                // Build name from first_name and last_name if name is not available
                $name = $data['name'] ?? '';
                if (empty($name) && (!empty($data['first_name']) || !empty($data['last_name']))) {
                    $name = trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? ''));
                }

                $profile_pic = $this->extract_profile_pic_from_graph_response($data);
                if (!empty($name) || $profile_pic) {
                    return [
                        'name' => $name,
                        'profile_pic' => $profile_pic ?? '',
                    ];
                }
            }

            // For comments, profile info comes from webhook payload
            // This method is mainly for Messenger/Instagram DMs
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Schedule background fetch of user profile.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @param    array  $account            The account data.
     * @param    string $platform           The platform.
     * @param    string $participant_id     The participant ID.
     */
    public function schedule_profile_fetch(int $conversation_id, array $account, string $platform, string $participant_id): void
    {
        // Schedule a single event to fetch profile in background
        $hook_name = 'helpmate_fetch_social_profile';
        $args = [$conversation_id, $account, $platform, $participant_id];

        // Check if already scheduled
        if (!wp_next_scheduled($hook_name, $args)) {
            wp_schedule_single_event(time() + 5, $hook_name, $args);
        }
    }

    /**
     * Unsubscribe account from Meta app webhooks.
     *
     * @since    1.2.0
     * @param    array    $account    The account data with access_token.
     * @return   bool|WP_Error    True on success, false on failure, WP_Error on error.
     */
    public function unsubscribe_from_meta_app(array $account)
    {
        $settings = $this->get_social_chat_settings();
        $encrypted_app_id = $settings['app_id'] ?? '';
        $app_id = !empty($encrypted_app_id) ? $this->decrypt_value($encrypted_app_id) : '';
        $encrypted_app_secret = $settings['app_secret'] ?? '';
        $app_secret = !empty($encrypted_app_secret) ? $this->decrypt_value($encrypted_app_secret) : '';

        // Get platform and access_token early so we can use them for querying subscribed apps
        $platform = $account['platform'] ?? '';
        $access_token = $account['access_token'] ?? '';
        $graph_version = 'v18.0';
        $graph_base_url = 'https://graph.facebook.com';

        if (empty($app_id)) {
            // Try to get app_id by querying subscribed apps
            if ($platform === 'whatsapp') {
                // For WhatsApp, query the WABA's subscribed apps
                $waba_id = $account['whatsapp_business_account_id'] ?? '';
                if (!empty($waba_id) && !empty($access_token)) {
                    $query_url = "{$graph_base_url}/{$graph_version}/{$waba_id}/subscribed_apps";
                    $full_query_url = add_query_arg(['access_token' => $access_token], $query_url);

                    $query_response = wp_remote_get(
                        $full_query_url,
                        [
                            'timeout' => 15,
                            'headers' => ['Content-Type' => 'application/json'],
                        ]
                    );

                    if (!is_wp_error($query_response)) {
                        $query_body = wp_remote_retrieve_body($query_response);
                        $query_data = json_decode($query_body, true);

                        // If we found subscribed apps, use the first one (assuming it's our app)
                        if (isset($query_data['data']) && !empty($query_data['data'])) {
                            $subscribed_app = $query_data['data'][0];
                            // For WhatsApp, the app ID is nested under whatsapp_business_api_data
                            if (isset($subscribed_app['whatsapp_business_api_data']['id'])) {
                                $app_id = $subscribed_app['whatsapp_business_api_data']['id'];
                            } else {
                                // Fallback to direct id field (for other platforms)
                                $app_id = $subscribed_app['id'] ?? '';
                            }
                        }
                    }
                }
            } else {
                // For Messenger/Instagram, query the page's subscribed apps
                $page_id = $account['page_id'] ?? '';
                if (!empty($page_id) && !empty($access_token)) {
                    $query_url = "{$graph_base_url}/{$graph_version}/{$page_id}/subscribed_apps";
                    $full_query_url = add_query_arg(['access_token' => $access_token], $query_url);

                    $query_response = wp_remote_get(
                        $full_query_url,
                        [
                            'timeout' => 15,
                            'headers' => ['Content-Type' => 'application/json'],
                        ]
                    );

                    if (!is_wp_error($query_response)) {
                        $query_body = wp_remote_retrieve_body($query_response);
                        $query_data = json_decode($query_body, true);

                        // If we found subscribed apps, use the first one (assuming it's our app)
                        if (isset($query_data['data']) && !empty($query_data['data'])) {
                            $subscribed_app = $query_data['data'][0];
                            $app_id = $subscribed_app['id'] ?? '';
                        }
                    }
                }
            }

            // If we still don't have app_id, log and return false (prevent deletion until unsubscribe succeeds)
            if (empty($app_id)) {
                return false;
            }
        }

        if (empty($access_token)) {
            return false;
        }

        try {
            if ($platform === 'whatsapp') {
                // For WhatsApp, we need the WhatsApp Business Account ID
                // The page_id for WhatsApp accounts is actually the phone_number_id
                // Note: WhatsApp unsubscribe requires the WABA ID, not phone number ID
                $waba_id = $account['whatsapp_business_account_id'] ?? '';

                if (empty($waba_id)) {
                    // Return true to allow deletion to continue - webhook subscription cleanup is optional
                    return true;
                }

                $url = "{$graph_base_url}/{$graph_version}/{$waba_id}/subscribed_apps";
                $params = [
                    'app_id' => $app_id,
                    'access_token' => $access_token
                ];
                $full_url = add_query_arg($params, $url);

                $response = wp_remote_request(
                    $full_url,
                    [
                        'method' => 'DELETE',
                        'timeout' => 15,
                        'headers' => [
                            'Content-Type' => 'application/json',
                        ],
                    ]
                );

                if (is_wp_error($response)) {
                    return false;
                }

                $response_code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                $data = json_decode($body, true);

                if ($response_code === 200 && isset($data['success']) && $data['success'] === true) {
                    return true;
                } elseif ($response_code === 200 && isset($data['success']) && $data['success'] === false) {
                    // Already unsubscribed or not subscribed
                    return true; // Consider this success - goal is achieved
                } else {
                    return false;
                }
            } else {
                // For Messenger/Instagram, use page_id
                $page_id = $account['page_id'] ?? '';

                if (empty($page_id)) {
                    return false;
                }

                $url = "{$graph_base_url}/{$graph_version}/{$page_id}/subscribed_apps";
                $params = [
                    'app_id' => $app_id,
                    'access_token' => $access_token
                ];
                $full_url = add_query_arg($params, $url);

                $response = wp_remote_request(
                    $full_url,
                    [
                        'method' => 'DELETE',
                        'timeout' => 15,
                        'headers' => [
                            'Content-Type' => 'application/json',
                        ],
                    ]
                );

                if (is_wp_error($response)) {
                    return false;
                }

                $response_code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                $data = json_decode($body, true);

                if ($response_code === 200 && isset($data['success']) && $data['success'] === true) {
                    return true;
                } elseif ($response_code === 200 && isset($data['success']) && $data['success'] === false) {
                    // Already unsubscribed or not subscribed
                    return true; // Consider this success - goal is achieved
                } else {
                    $error_code = isset($data['error']['code']) ? $data['error']['code'] : '';

                    if ((int) $error_code === 100) {
                        // Invalid parameter - page might not exist or app not subscribed
                        return true; // Consider this success - app is not subscribed
                    }

                    // For 190, 200 (permissions), or other errors: try App Access Token fallback.
                    // Meta allows an app to remove its own webhook with App Token (no Page permissions needed).
                    if (!empty($app_id) && !empty($app_secret)) {
                        $app_token = $app_id . '|' . $app_secret;
                        $fallback_params = [
                            'app_id' => $app_id,
                            'access_token' => $app_token,
                        ];
                        $fallback_url = add_query_arg($fallback_params, $url);
                        $fallback_response = wp_remote_request(
                            $fallback_url,
                            [
                                'method' => 'DELETE',
                                'timeout' => 15,
                                'headers' => ['Content-Type' => 'application/json'],
                            ]
                        );

                        if (!is_wp_error($fallback_response)) {
                            $fallback_code = wp_remote_retrieve_response_code($fallback_response);
                            $fallback_body = wp_remote_retrieve_body($fallback_response);
                            $fallback_data = json_decode($fallback_body, true);

                            if ($fallback_code === 200 && isset($fallback_data['success'])) {
                                return true; // success true or false = goal achieved
                            }
                            $fallback_error_code = isset($fallback_data['error']['code']) ? $fallback_data['error']['code'] : '';
                            if ((int) $fallback_error_code === 100) {
                                return true; // App not subscribed
                            }
                        }
                    }
                    return false;
                }
            }
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Get website chat handoff status for a session.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @return   bool    Whether handoff is active.
     */
    public function get_website_handoff_status(string $session_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        // Get the most recent message with handoff metadata
        $result = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT JSON_EXTRACT(metadata, '$.is_human_handoff')
                FROM {$table}
                WHERE session_id = %s
                AND JSON_EXTRACT(metadata, '$.is_human_handoff') IS NOT NULL
                ORDER BY timestamp DESC
                LIMIT 1"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $session_id
            )
        );

        return (bool) $result;
    }

    /**
     * Get website chat handoff timestamp for a session.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @return   string|null    The handoff timestamp or null.
     */
    private function get_website_handoff_time(string $session_id): ?string
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        $result = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT JSON_EXTRACT(metadata, '$.handoff_at')
                FROM {$table}
                WHERE session_id = %s
                AND JSON_EXTRACT(metadata, '$.is_human_handoff') = 1
                ORDER BY timestamp DESC
                LIMIT 1"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $session_id
            )
        );

        return $result ? $result : null;
    }

    /**
     * Get the Unix timestamp of the last human (agent) reply in a website chat session.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @return   int|null    Unix timestamp of last assistant message with sent_by_human, or null.
     */
    public function get_last_human_reply_timestamp(string $session_id): ?int
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        $result = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT MAX(timestamp) FROM {$table}
                WHERE session_id = %s
                AND role = 'assistant'
                AND (JSON_EXTRACT(metadata, '$.sent_by_human') = true OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sent_by_human')) = 'true')"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $session_id
            )
        );

        return $result !== null ? (int) $result : null;
    }

    /**
     * Get the reference Unix timestamp for AI takeover: last human reply, or handoff-at if no human has replied.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @return   int|null    Unix timestamp to compare against takeover threshold, or null.
     */
    public function get_website_takeover_reference_timestamp(string $session_id): ?int
    {
        $last_human = $this->get_last_human_reply_timestamp($session_id);
        if ($last_human !== null) {
            return $last_human;
        }
        $handoff_at = $this->get_website_handoff_time($session_id);
        if ($handoff_at === null || $handoff_at === '') {
            return null;
        }
        $trimmed = trim($handoff_at, '"');
        $unix = strtotime($trimmed);
        return $unix !== false ? $unix : null;
    }

    /**
     * Toggle website chat handoff status.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @param    bool      $handoff       Whether to enable or disable handoff.
     * @return   bool    Whether the update was successful.
     */
    public function toggle_website_handoff(string $session_id, bool $handoff): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        // Get all messages for this session to update metadata
        $messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT id, metadata FROM {$table} WHERE session_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $session_id
            ),
            ARRAY_A
        );

        if (empty($messages)) {
            return false;
        }

        // Update metadata for all messages in session to reflect handoff status
        $handoff_time = $handoff ? current_time('mysql') : null;
        $success = true;

        foreach ($messages as $message) {
            $metadata = json_decode($message['metadata'], true);
            if (!is_array($metadata)) {
                $metadata = [];
            }

            $metadata['is_human_handoff'] = $handoff ? 1 : 0;
            if ($handoff) {
                $metadata['handoff_at'] = $handoff_time;
            } else {
                unset($metadata['handoff_at']);
            }

            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $table,
                ['metadata' => json_encode($metadata)],
                ['id' => $message['id']],
                ['%s'],
                ['%d']
            );

            if ($result === false) {
                $success = false;
            }
        }

        return $success;
    }

    /**
     * Get website conversation status for a session.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @return   string    The conversation status ('open' or 'archived').
     */
    public function get_website_conversation_status(string $session_id): string
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        // Get the most recent message with status metadata
        // Use JSON_UNQUOTE to properly extract the string value without quotes
        $result = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.status'))
                FROM {$table}
                WHERE session_id = %s
                AND JSON_EXTRACT(metadata, '$.status') IS NOT NULL
                ORDER BY timestamp DESC
                LIMIT 1"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $session_id
            )
        );

        // Return status if found, otherwise default to 'open'
        return $result && in_array($result, ['open', 'archived'], true) ? $result : 'open';
    }

    /**
     * Update website conversation status.
     *
     * @since    1.3.0
     * @param    string    $session_id    The chat session ID.
     * @param    string    $status         The status to set ('open' or 'archived').
     * @return   bool    Whether the update was successful.
     */
    public function update_website_conversation_status(string $session_id, string $status): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_chat_history');

        // Validate status
        if (!in_array($status, ['open', 'archived'], true)) {
            return false;
        }

        // Get all messages for this session to update metadata
        $messages = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT id, metadata FROM {$table} WHERE session_id = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                $session_id
            ),
            ARRAY_A
        );

        if (empty($messages)) {
            return false;
        }

        // Update metadata for all messages in session to reflect status
        $success = true;

        foreach ($messages as $message) {
            $metadata = json_decode($message['metadata'], true);
            if (!is_array($metadata)) {
                $metadata = [];
            }

            $metadata['status'] = $status;

            $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $table,
                ['metadata' => json_encode($metadata)],
                ['id' => $message['id']],
                ['%s'],
                ['%d']
            );

            if ($result === false) {
                $success = false;
            }
        }

        return $success;
    }

    /**
     * Record that a team member has joined a conversation.
     *
     * @since    1.3.0
     * @param    string|int    $conversation_id    The conversation ID (can be numeric or string like website_xxx).
     * @param    string        $conversation_type  The conversation type ('social', 'website', 'ticket').
     * @param    int           $user_id            The WordPress user ID.
     * @return   bool          Whether the join was recorded successfully.
     */
    public function record_team_member_join($conversation_id, string $conversation_type, int $user_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_conversation_participants');

        // Check if user has already joined
        if ($this->has_user_joined($conversation_id, $user_id)) {
            return false; // Already joined
        }

        $result = $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            [
                'conversation_id' => (string) $conversation_id,
                'conversation_type' => $conversation_type,
                'user_id' => $user_id,
                'joined_at' => current_time('mysql'),
            ],
            ['%s', '%s', '%d', '%s']
        );

        return $result !== false;
    }

    /**
     * Check if a user has already joined a conversation.
     *
     * @since    1.3.0
     * @param    string|int    $conversation_id    The conversation ID.
     * @param    int           $user_id            The WordPress user ID.
     * @return   bool          Whether the user has joined.
     */
    public function has_user_joined($conversation_id, int $user_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_conversation_participants');

        $count = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE conversation_id = %s AND user_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                (string) $conversation_id,
                $user_id
            )
        );

        return (int) $count > 0;
    }

    /**
     * Get all team members who have joined a conversation.
     *
     * @since    1.3.0
     * @param    string|int    $conversation_id    The conversation ID.
     * @return   array         Array of participant data with user_id, first_name, last_name, joined_at.
     */
    public function get_conversation_participants($conversation_id): array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_conversation_participants');

        $participants = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT user_id, joined_at FROM {$table} WHERE conversation_id = %s ORDER BY joined_at ASC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                (string) $conversation_id
            ),
            ARRAY_A
        );

        if (empty($participants)) {
            return [];
        }

        $result = [];
        foreach ($participants as $participant) {
            $user = get_userdata((int) $participant['user_id']);
            if ($user) {
                $result[] = [
                    'user_id' => (int) $participant['user_id'],
                    'first_name' => $user->first_name ?: $user->display_name,
                    'last_name' => $user->last_name ?: '',
                    'display_name' => $user->display_name,
                    'joined_at' => $participant['joined_at'],
                ];
            }
        }

        return $result;
    }

    /**
     * Send a join notification message to the customer on social platforms.
     *
     * @since    1.3.0
     * @param    int       $conversation_id    The conversation ID.
     * @param    string    $user_first_name    The team member's first name.
     * @param    string    $platform           The platform ('messenger', 'instagram', etc.).
     * @return   bool      Whether the message was sent successfully.
     */
    public function send_join_notification_message(int $conversation_id, string $user_first_name, string $platform): bool
    {
        global $wpdb;
        $conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
        $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');

        // Get conversation with account
        $conversation = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                "SELECT c.*, a.page_id, a.instagram_account_id, a.access_token_encrypted
                FROM {$conversations_table} c
                INNER JOIN {$accounts_table} a ON c.account_id = a.id
                WHERE c.id = %d"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                $conversation_id
            ),
            ARRAY_A
        );

        if (!$conversation) {
            return false;
        }

        // Skip join messages for comments (fb_comment, ig_comment) as they can't send arbitrary messages
        if (in_array($platform, ['fb_comment', 'ig_comment'], true)) {
            return false;
        }

        $access_token = $this->decrypt_value($conversation['access_token_encrypted']);
        $account = [
            'page_id' => $conversation['page_id'],
            'instagram_account_id' => $conversation['instagram_account_id'],
            'access_token' => $access_token
        ];

        // translators: %s: User's first name or display name
        $message = sprintf(__('%s joined the conversation', 'helpmate-ai-chatbot'), $user_first_name);

        $processor = new Helpmate_Social_Message_Processor($this->helpmate);
        $result = $processor->send_response(
            $account,
            $platform,
            $conversation['participant_id'],
            $message,
            $conversation,
            ['message_id' => ''],
            null // No user_id for system messages
        );

        return $result;
    }

    /**
     * Update Messenger Profile ice breakers via Facebook Graph API.
     *
     * @since    1.2.0
     * @param    string    $page_id        The Facebook Page ID.
     * @param    string    $access_token   The page access token.
     * @param    array     $ice_breakers   Array of ice breakers with 'question' and 'payload' keys.
     * @return   array|WP_Error    Response data on success, WP_Error on failure.
     */
    /**
     * Get campaign state for a conversation.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @return   array|null    The campaign state or null if not found.
     */
    public function get_campaign_state(int $conversation_id): ?array
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_lead_campaigns_state');

        $state = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE conversation_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $conversation_id
            ),
            ARRAY_A
        );

        return $state ?: null;
    }

    /**
     * Create a new campaign state record.
     *
     * @since    1.2.0
     * @param    array    $data    Campaign state data.
     * @return   int|false    The campaign state ID or false on failure.
     */
    public function create_campaign_state(array $data)
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_lead_campaigns_state');

        $insert_data = [
            'conversation_id' => (int) $data['conversation_id'],
            'campaign_id' => sanitize_text_field($data['campaign_id']),
            'state' => sanitize_text_field($data['state'] ?? 'waiting_for_claim'),
            'collected_email' => isset($data['collected_email']) ? sanitize_email($data['collected_email']) : null,
            'collected_phone' => isset($data['collected_phone']) ? sanitize_text_field($data['collected_phone']) : null,
            'collected_address' => isset($data['collected_address']) ? sanitize_textarea_field($data['collected_address']) : null,
            'original_comment_id' => isset($data['original_comment_id']) ? sanitize_text_field($data['original_comment_id']) : null,
            'original_platform' => isset($data['original_platform']) ? sanitize_text_field($data['original_platform']) : null,
            'dm_conversation_id' => isset($data['dm_conversation_id']) ? (int) $data['dm_conversation_id'] : null,
            'created_at' => current_time('mysql'),
            'updated_at' => current_time('mysql'),
        ];

        $result = $wpdb->insert($table, $insert_data); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery

        if ($result === false) {
            return false;
        }

        return $wpdb->insert_id;
    }

    /**
     * Create or replace campaign state for a DM conversation.
     * If state already exists, updates it with new campaign data (last-one-wins).
     *
     * @since    1.2.0
     * @param    array    $data    Campaign state data (same shape as create_campaign_state).
     * @return   int|bool    The campaign state ID on create, true on replace, false on failure.
     */
    public function create_or_replace_campaign_state(array $data)
    {
        $dm_conversation_id = (int) ( $data['dm_conversation_id'] ?? $data['conversation_id'] ?? 0 );
        if (!$dm_conversation_id) {
            return false;
        }

        $existing = $this->get_campaign_state($dm_conversation_id);
        if ($existing) {
            $replace_data = [
                'campaign_id' => $data['campaign_id'] ?? '',
                'original_comment_id' => $data['original_comment_id'] ?? null,
                'original_platform' => $data['original_platform'] ?? null,
                'state' => $data['state'] ?? 'waiting_for_claim',
                'collected_email' => null,
                'collected_phone' => null,
                'collected_address' => null,
            ];
            return $this->update_campaign_state($dm_conversation_id, $replace_data);
        }

        return $this->create_campaign_state($data);
    }

    /**
     * Update campaign state.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @param    array  $data               Campaign state data to update.
     * @return   bool    True on success, false on failure.
     */
    public function update_campaign_state(int $conversation_id, array $data): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_lead_campaigns_state');

        $update_data = [
            'updated_at' => current_time('mysql'),
        ];

        if (isset($data['state'])) {
            $update_data['state'] = sanitize_text_field($data['state']);
        }

        if (array_key_exists('campaign_id', $data)) {
            $update_data['campaign_id'] = sanitize_text_field($data['campaign_id']);
        }

        if (array_key_exists('original_comment_id', $data)) {
            $update_data['original_comment_id'] = $data['original_comment_id'] !== null && $data['original_comment_id'] !== '' ? sanitize_text_field($data['original_comment_id']) : null;
        }

        if (array_key_exists('original_platform', $data)) {
            $update_data['original_platform'] = $data['original_platform'] !== null && $data['original_platform'] !== '' ? sanitize_text_field($data['original_platform']) : null;
        }

        if (array_key_exists('collected_email', $data)) {
            $update_data['collected_email'] = ( $data['collected_email'] !== null && $data['collected_email'] !== '' ) ? sanitize_email( $data['collected_email'] ) : null;
        }

        if (array_key_exists('collected_phone', $data)) {
            $update_data['collected_phone'] = ( $data['collected_phone'] !== null && $data['collected_phone'] !== '' ) ? sanitize_text_field( $data['collected_phone'] ) : null;
        }

        if (array_key_exists('collected_address', $data)) {
            $update_data['collected_address'] = ( $data['collected_address'] !== null && $data['collected_address'] !== '' ) ? sanitize_textarea_field( $data['collected_address'] ) : null;
        }

        if (isset($data['dm_conversation_id'])) {
            $update_data['dm_conversation_id'] = (int) $data['dm_conversation_id'];
        }

        $result = $wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            $update_data,
            ['conversation_id' => $conversation_id]
        );

        return $result !== false;
    }

    /**
     * Delete campaign state.
     *
     * @since    1.2.0
     * @param    int    $conversation_id    The conversation ID.
     * @return   bool    True on success, false on failure.
     */
    public function delete_campaign_state(int $conversation_id): bool
    {
        global $wpdb;
        $table = esc_sql($wpdb->prefix . 'helpmate_social_lead_campaigns_state');

        $result = $wpdb->delete( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $table,
            ['conversation_id' => $conversation_id]
        );

        return $result !== false;
    }

    /**
     * Get or create DM conversation from comment sender.
     *
     * @since    1.2.0
     * @param    array    $account         The account data.
     * @param    string   $sender_id       The comment sender ID.
     * @param    string   $original_platform The original platform (fb_comment or ig_comment).
     * @return   array|null    The DM conversation or null on failure.
     */
    public function get_or_create_dm_conversation(array $account, string $sender_id, string $original_platform): ?array
    {
        // Map comment platform to DM platform
        $dm_platform = ($original_platform === 'fb_comment') ? 'messenger' : 'instagram';

        // Try to find existing DM conversation
        $conversation = $this->get_or_create_conversation([
            'account_id' => $account['id'],
            'participant_id' => $sender_id,
            'platform' => $dm_platform,
            'external_id' => 'dm_' . $sender_id . '_' . time(),
        ]);

        return $conversation;
    }

    /**
     * Build the request body for ice breakers API (Messenger vs Instagram formats).
     *
     * @param array  $ice_breakers Array of {question, payload}.
     * @param string $platform     'messenger' or 'instagram'.
     * @return array Request body for Graph API.
     */
    private function build_ice_breakers_request_body(array $ice_breakers, string $platform): array
    {
        $body = ['ice_breakers' => []];
        if ($platform === 'instagram') {
            $body['platform'] = 'instagram';
            // Instagram format: one object with all questions in call_to_actions array
            $call_to_actions = [];
            foreach ($ice_breakers as $ib) {
                $call_to_actions[] = ['question' => $ib['question'], 'payload' => $ib['payload']];
            }
            if (!empty($call_to_actions)) {
                $body['ice_breakers'] = [
                    ['call_to_actions' => $call_to_actions, 'locale' => 'default'],
                ];
            }
        } else {
            $body['ice_breakers'] = $ice_breakers;
        }
        if (empty($ice_breakers)) {
            $body['fields'] = ['ice_breakers'];
        }
        return $body;
    }

    public function update_messenger_profile_ice_breakers(string $page_id, string $access_token, array $ice_breakers, string $platform = 'messenger'): array
    {
        if (empty($page_id) || empty($access_token)) {
            return [
                'error' => true,
                'message' => 'Page ID and access token are required'
            ];
        }

        $graph_version = 'v18.0';
        // Use graph.facebook.com for both - Page tokens from Messenger Platform flow work here.
        // graph.instagram.com requires Instagram User token; Helpmate uses Page token from FB connection.
        $graph_base_url = 'https://graph.facebook.com';
        // Meta docs: Instagram uses /me/messenger_profile?platform=instagram - token identifies the Page
        $path_id = ($platform === 'instagram') ? 'me' : $page_id;
        $url = "{$graph_base_url}/{$graph_version}/{$path_id}/messenger_profile";
        if ($platform === 'instagram') {
            $url = add_query_arg(['platform' => 'instagram'], $url);
        }

        // Validate ice breakers format (Messenger: question/payload; Instagram uses same for conversion)
        $validated_ice_breakers = [];
        foreach ($ice_breakers as $ice_breaker) {
            if (isset($ice_breaker['question']) && isset($ice_breaker['payload'])) {
                $question = substr(sanitize_text_field($ice_breaker['question']), 0, 20); // Max 20 characters
                $payload = sanitize_text_field($ice_breaker['payload']);

                if (!empty($question) && !empty($payload)) {
                    $validated_ice_breakers[] = [
                        'question' => $question,
                        'payload' => $payload
                    ];
                }
            }
        }

        // Meta limits: max 4 ice breakers for both Messenger and Instagram
        $validated_ice_breakers = array_slice($validated_ice_breakers, 0, 4);

        // Add access token as query parameter (standard for Facebook Graph API)
        $url = add_query_arg(['access_token' => $access_token], $url);

        // If no ice breakers, use DELETE to remove them
        if (empty($validated_ice_breakers)) {
            // Try DELETE first with fields in query parameter
            // Facebook Graph API format: DELETE with fields=["ice_breakers"]
            $delete_url = add_query_arg(['fields' => '["ice_breakers"]'], $url);

            $delete_response = wp_remote_request(
                $delete_url,
                [
                    'method' => 'DELETE',
                    'timeout' => 15,
                    'headers' => [
                        'Content-Type' => 'application/json',
                    ]
                ]
            );

            // Check if DELETE succeeded
            if (!is_wp_error($delete_response)) {
                $delete_code = wp_remote_retrieve_response_code($delete_response);
                $delete_body = wp_remote_retrieve_body($delete_response);
                $delete_data = json_decode($delete_body, true);

                // If DELETE succeeded or returned success result
                if ($delete_code === 200 || (isset($delete_data['result']) && $delete_data['result'] === 'success')) {
                    $response = $delete_response;
                } else {
                    // DELETE didn't work, try POST with empty array and fields parameter
                    $request_body = $this->build_ice_breakers_request_body([], $platform);
                    $response = wp_remote_post(
                        $url,
                        [
                            'timeout' => 15,
                            'headers' => [
                                'Content-Type' => 'application/json',
                            ],
                            'body' => wp_json_encode($request_body)
                        ]
                    );
                }
            } else {
                // DELETE request failed, try POST with empty array
                $request_body = $this->build_ice_breakers_request_body([], $platform);
                $response = wp_remote_post(
                    $url,
                    [
                        'timeout' => 15,
                        'headers' => [
                            'Content-Type' => 'application/json',
                        ],
                        'body' => wp_json_encode($request_body)
                    ]
                );
            }
        } else {
            // POST with ice breakers
            $request_body = $this->build_ice_breakers_request_body($validated_ice_breakers, $platform);
            $response = wp_remote_post(
                $url,
                [
                    'timeout' => 15,
                    'headers' => [
                        'Content-Type' => 'application/json',
                    ],
                    'body' => wp_json_encode($request_body)
                ]
            );
        }

        if (is_wp_error($response)) {
            return [
                'error' => true,
                'message' => $response->get_error_message()
            ];
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $response_data = json_decode($response_body, true);

        if ($response_code !== 200) {
            $error_message = $response_data['error']['message'] ?? 'Unknown error';
            $error_code = $response_data['error']['code'] ?? 0;
            return [
                'error' => true,
                'message' => $error_message,
                'code' => $response_code
            ];
        }

        // Check for Graph API errors in response
        if (isset($response_data['error'])) {
            $error_message = $response_data['error']['message'] ?? 'Unknown error';
            return [
                'error' => true,
                'message' => $error_message
            ];
        }

        return [
            'error' => false,
            'message' => empty($validated_ice_breakers) ? 'Ice breakers removed successfully' : 'Ice breakers updated successfully',
            'data' => $response_data
        ];
    }
}

