<?php

/**
 * The database class for the Helpmate plugin.
 *
 * A class that handles the database operations for the Helpmate plugin.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

class Helpmate_Database
{

    /**
     * Construct the database class.
     *
     * @since 1.0.0
     */
    public function __construct()
    {
        // Initialize database tables
        $this->create_tables();
    }

    /**
     * Create the tables.
     *
     * @since 1.0.0
     * @access private
     */
    private function create_tables()
    {
        global $wpdb;
        $documents_table = esc_sql($wpdb->prefix . 'helpmate_documents');
        $chat_history_table = esc_sql($wpdb->prefix . 'helpmate_chat_history');
        $settings_table = esc_sql($wpdb->prefix . 'helpmate_settings');
        $analytics_table = esc_sql($wpdb->prefix . 'helpmate_analytics');
        $abandoned_carts_table = esc_sql($wpdb->prefix . 'helpmate_abandoned_carts');
        $tickets_table = esc_sql($wpdb->prefix . 'helpmate_tickets');
        $leads_table = esc_sql($wpdb->prefix . 'helpmate_leads');
        $jobs_table = esc_sql($wpdb->prefix . 'helpmate_jobs');

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

        $charset_collate = $wpdb->get_charset_collate();

        // Documents table
        $sql = "CREATE TABLE IF NOT EXISTS {$documents_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            document_type varchar(50) NOT NULL,
            title text,
            content longtext,
            vector text,
            metadata text,
            last_updated bigint(20),
            PRIMARY KEY  (id),
            KEY document_type (document_type)
        ) $charset_collate;";
        dbDelta($sql);

        // Chat history table
        $sql = "CREATE TABLE IF NOT EXISTS {$chat_history_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            session_id varchar(255) NOT NULL,
            message text NOT NULL,
            role varchar(50) NOT NULL,
            timestamp bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY session_id (session_id),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Settings table
        $sql = "CREATE TABLE IF NOT EXISTS {$settings_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            setting_key varchar(255) NOT NULL,
            setting_value text NOT NULL,
            last_updated bigint(20) NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY setting_key (setting_key)
        ) $charset_collate;";
        dbDelta($sql);

        // Analytics table
        $sql = "CREATE TABLE IF NOT EXISTS {$analytics_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            event_type varchar(255) NOT NULL,
            event_data text NOT NULL,
            timestamp bigint(20) NOT NULL,
            PRIMARY KEY  (id),
            KEY event_type (event_type)
        ) $charset_collate;";
        dbDelta($sql);

        // Abandoned carts table
        $sql = "CREATE TABLE IF NOT EXISTS {$abandoned_carts_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            cart_data text NOT NULL,
            cart_status varchar(50) NOT NULL COMMENT 'Order Placed, Abandoned, Recovered',
            woocommerce_session_id varchar(255) NOT NULL,
            timestamp bigint(20) NOT NULL,
            mails_sent int(11) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Tickets table
        $sql = "CREATE TABLE IF NOT EXISTS {$tickets_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            ticket_id varchar(255) NOT NULL,
            subject text NOT NULL,
            message text NOT NULL,
            role varchar(50) NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'open' COMMENT 'open, in_progress, resolved, closed',
            user_id bigint(20),
            timestamp bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY ticket_id (ticket_id),
            KEY user_id (user_id),
            KEY status (status),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Add contact_id and source columns to tickets table if they don't exist
        // Note: These columns are only stored on the initial user message (role='user')
        $ticket_contact_id_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'contact_id'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $tickets_table
            )
        );

        if (empty($ticket_contact_id_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$tickets_table} ADD COLUMN contact_id bigint(20) NULL AFTER user_id");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$tickets_table} ADD KEY contact_id (contact_id)");
        }

        $ticket_source_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'source'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $tickets_table
            )
        );

        if (empty($ticket_source_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$tickets_table} ADD COLUMN source varchar(50) NULL DEFAULT 'chatbot' AFTER contact_id");
        }

        // Leads table
        $sql = "CREATE TABLE IF NOT EXISTS {$leads_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            timestamp bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY timestamp (timestamp)
        ) $charset_collate;";
        dbDelta($sql);

        // Add contact_id and source columns to leads table if they don't exist
        $contact_id_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'contact_id'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $leads_table
            )
        );

        if (empty($contact_id_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$leads_table} ADD COLUMN contact_id bigint(20) NULL AFTER id");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$leads_table} ADD KEY contact_id (contact_id)");
        }

        $source_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'source'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $leads_table
            )
        );

        if (empty($source_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$leads_table} ADD COLUMN source varchar(50) NULL DEFAULT 'chatbot' AFTER contact_id");
        }

        // Promo banners table
        $promo_banners_table = esc_sql($wpdb->prefix . 'helpmate_promo_banners');
        $sql = "CREATE TABLE IF NOT EXISTS {$promo_banners_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            title varchar(255) NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'active' COMMENT 'active, inactive',
            start_datetime bigint(20) NULL,
            end_datetime bigint(20) NULL,
            metadata text NOT NULL,
            created_at bigint(20) NOT NULL,
            updated_at bigint(20) NOT NULL,
            PRIMARY KEY  (id),
            KEY status (status),
            KEY start_datetime (start_datetime),
            KEY end_datetime (end_datetime)
        ) $charset_collate;";
        dbDelta($sql);

        // Returns and refunds table
        $returns_refunds_table = esc_sql($wpdb->prefix . 'helpmate_returns_refunds');
        $sql = "CREATE TABLE IF NOT EXISTS {$returns_refunds_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            order_id bigint(20) NOT NULL,
            user_id bigint(20) NOT NULL,
            type varchar(50) NOT NULL COMMENT 'refund, return, or exchange',
            status varchar(50) NOT NULL DEFAULT 'pending' COMMENT 'pending, approved, rejected',
            reason text NOT NULL,
            amount decimal(10,2) NOT NULL,
            items text NOT NULL COMMENT 'JSON array of returned/refunded/exchanged items',
            created_at bigint(20) NOT NULL,
            updated_at bigint(20) NOT NULL,
            metadata text,
            PRIMARY KEY  (id),
            KEY order_id (order_id),
            KEY user_id (user_id),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // Jobs table for background processing
        $sql = "CREATE TABLE IF NOT EXISTS {$jobs_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            job_id varchar(255) NOT NULL,
            user_id bigint(20) NOT NULL,
            total_documents int(11) NOT NULL DEFAULT 0,
            processed_documents int(11) NOT NULL DEFAULT 0,
            successful_documents int(11) NOT NULL DEFAULT 0,
            failed_documents int(11) NOT NULL DEFAULT 0,
            status varchar(50) NOT NULL DEFAULT 'scheduled',
            documents longtext,
            errors longtext,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            completed_at datetime NULL,
            PRIMARY KEY (id),
            UNIQUE KEY job_id (job_id),
            KEY user_id (user_id),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // Social Chat - Connected accounts table
        $social_accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');
        $sql = "CREATE TABLE IF NOT EXISTS {$social_accounts_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            platform varchar(50) NOT NULL COMMENT 'messenger, instagram, whatsapp',
            page_id varchar(255) NOT NULL,
            page_name varchar(255) NOT NULL,
            instagram_account_id varchar(255) NULL,
            access_token_encrypted text NOT NULL,
            token_expires bigint(20) NULL,
            status varchar(50) NOT NULL DEFAULT 'active' COMMENT 'active, inactive, expired',
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY platform (platform),
            KEY page_id (page_id),
            KEY status (status)
        ) $charset_collate;";
        dbDelta($sql);

        // Social Chat - Conversations table
        $social_conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
        $sql = "CREATE TABLE IF NOT EXISTS {$social_conversations_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            account_id bigint(20) NOT NULL,
            platform varchar(50) NOT NULL COMMENT 'messenger, instagram, fb_comment, ig_comment',
            external_id varchar(255) NOT NULL,
            participant_id varchar(255) NOT NULL,
            participant_name varchar(255) NULL,
            participant_profile_pic text NULL,
            status varchar(50) NOT NULL DEFAULT 'open' COMMENT 'open, resolved, archived',
            is_human_handoff tinyint(1) NOT NULL DEFAULT 0,
            handoff_at datetime NULL,
            unread_count int(11) NOT NULL DEFAULT 0,
            last_message_at datetime NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY account_id (account_id),
            KEY platform (platform),
            KEY external_id (external_id),
            KEY participant_id (participant_id),
            KEY status (status),
            KEY is_human_handoff (is_human_handoff),
            KEY last_message_at (last_message_at)
        ) $charset_collate;";
        dbDelta($sql);

        // Social Chat - Messages table
        $social_messages_table = esc_sql($wpdb->prefix . 'helpmate_social_messages');
        $sql = "CREATE TABLE IF NOT EXISTS {$social_messages_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            conversation_id bigint(20) NOT NULL,
            external_id varchar(255) NULL,
            direction varchar(20) NOT NULL COMMENT 'inbound, outbound',
            content text NOT NULL,
            message_type varchar(50) NOT NULL DEFAULT 'text' COMMENT 'text, image, comment',
            sent_by varchar(50) NOT NULL COMMENT 'customer, ai, human',
            user_id bigint(20) NULL COMMENT 'WordPress user ID for manual replies',
            error_message text NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY conversation_id (conversation_id),
            KEY external_id (external_id),
            KEY direction (direction),
            KEY sent_by (sent_by),
            KEY user_id (user_id),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // Add user_id column to existing tables if it doesn't exist
        $column_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'user_id'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $social_messages_table
            )
        );

        if (empty($column_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_messages_table} ADD COLUMN user_id bigint(20) NULL COMMENT 'WordPress user ID for manual replies' AFTER sent_by");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_messages_table} ADD KEY user_id (user_id)");
        }

        // Add meta_data column to messages table for comment metadata
        $meta_data_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'meta_data'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $social_messages_table
            )
        );

        if (empty($meta_data_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_messages_table} ADD COLUMN meta_data text NULL COMMENT 'JSON metadata for comments (comment_id, reply_id, etc.)' AFTER error_message");
        }

        // Add whatsapp_business_account_id column to social accounts table
        $waba_id_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'whatsapp_business_account_id'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $social_accounts_table
            )
        );

        if (empty($waba_id_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_accounts_table} ADD COLUMN whatsapp_business_account_id varchar(255) NULL COMMENT 'WhatsApp Business Account ID' AFTER instagram_account_id");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_accounts_table} ADD KEY whatsapp_business_account_id (whatsapp_business_account_id)");
        }

        // Add post metadata columns to conversations table for comments
        $post_id_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'post_id'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $social_conversations_table
            )
        );

        if (empty($post_id_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD COLUMN post_id varchar(255) NULL COMMENT 'Meta post ID the comment is on' AFTER external_id");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD COLUMN post_type varchar(50) NULL COMMENT 'post, photo, video, etc.' AFTER post_id");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD COLUMN post_message text NULL COMMENT 'Original post text/content' AFTER post_type");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD COLUMN post_image_url text NULL COMMENT 'Post image URL if applicable' AFTER post_message");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD COLUMN parent_comment_id varchar(255) NULL COMMENT 'If this is a reply to another comment' AFTER post_image_url");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD KEY post_id (post_id)");
        }

        // Add contact_id column to conversations table for CRM linking
        $contact_id_exists = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
            $wpdb->prepare(
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = 'contact_id'"
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                ,
                DB_NAME,
                $social_conversations_table
            )
        );

        if (empty($contact_id_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD COLUMN contact_id bigint(20) NULL COMMENT 'CRM contact ID' AFTER participant_profile_pic");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$social_conversations_table} ADD KEY contact_id (contact_id)");
        }

        // Social Chat - Lead Campaigns State table
        $social_lead_campaigns_state_table = esc_sql($wpdb->prefix . 'helpmate_social_lead_campaigns_state');
        $sql = "CREATE TABLE IF NOT EXISTS {$social_lead_campaigns_state_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            conversation_id bigint(20) NOT NULL,
            campaign_id varchar(255) NOT NULL,
            state varchar(50) NOT NULL DEFAULT 'waiting_for_claim',
            collected_email varchar(255) NULL,
            collected_phone varchar(255) NULL,
            collected_address text NULL,
            original_comment_id varchar(255) NULL,
            original_platform varchar(50) NULL,
            dm_conversation_id bigint(20) NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY conversation_id (conversation_id),
            KEY campaign_id (campaign_id),
            KEY state (state),
            KEY dm_conversation_id (dm_conversation_id)
        ) $charset_collate;";
        dbDelta($sql);

        // Chat Reviews table
        $chat_reviews_table = esc_sql($wpdb->prefix . 'helpmate_chat_reviews');
        $sql = "CREATE TABLE IF NOT EXISTS {$chat_reviews_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            session_id varchar(255) NOT NULL,
            conversation_id varchar(255) NOT NULL,
            rating int(11) NOT NULL,
            message text NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY session_id (session_id),
            KEY conversation_id (conversation_id),
            KEY rating (rating),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Contacts table
        $crm_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_contacts');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_contacts_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            prefix varchar(50) NULL,
            first_name varchar(255) NULL,
            last_name varchar(255) NULL,
            email varchar(255) NOT NULL,
            phone varchar(50) NULL,
            date_of_birth date NULL,
            address_line_1 varchar(255) NULL,
            address_line_2 varchar(255) NULL,
            city varchar(100) NULL,
            state varchar(100) NULL,
            zip_code varchar(20) NULL,
            country varchar(100) NULL,
            wp_user_id bigint(20) NULL,
            status varchar(50) NOT NULL DEFAULT 'subscribed',
            avatar_url text NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY email (email),
            KEY phone (phone),
            KEY wp_user_id (wp_user_id),
            KEY status (status),
            KEY created_at (created_at),
            FULLTEXT KEY name_search (first_name, last_name, email)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Custom Fields table
        $crm_custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_custom_fields_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            field_name varchar(255) NOT NULL,
            field_label varchar(255) NOT NULL,
            field_type varchar(50) NOT NULL,
            field_options text NULL,
            is_required tinyint(1) NOT NULL DEFAULT 0,
            entity_type varchar(50) NOT NULL DEFAULT 'contact',
            display_order int(11) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY field_name (field_name),
            KEY entity_type (entity_type),
            KEY display_order (display_order)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Contact Custom Field Values table
        $crm_contact_field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_field_values');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_contact_field_values_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            contact_id bigint(20) NOT NULL,
            field_id bigint(20) NOT NULL,
            field_value text NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY contact_field (contact_id, field_id),
            KEY contact_id (contact_id),
            KEY field_id (field_id)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Contact Notes table
        $crm_contact_notes_table = esc_sql($wpdb->prefix . 'helpmate_crm_contact_notes');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_contact_notes_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            contact_id bigint(20) NOT NULL,
            note_content text NOT NULL,
            created_by bigint(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY contact_id (contact_id),
            KEY created_at (created_at),
            KEY contact_created (contact_id, created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Manual Orders table
        $crm_manual_orders_table = esc_sql($wpdb->prefix . 'helpmate_crm_manual_orders');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_manual_orders_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            contact_id bigint(20) NOT NULL,
            order_number varchar(255) NOT NULL,
            product_name varchar(255) NOT NULL,
            quantity int(11) NOT NULL DEFAULT 1,
            price decimal(10,2) NOT NULL,
            order_date datetime NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'pending',
            notes text NULL,
            customer_info text NULL,
            created_by bigint(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY order_number (order_number),
            KEY contact_id (contact_id),
            KEY order_date (order_date),
            KEY status (status)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Tasks table
        $crm_tasks_table = esc_sql($wpdb->prefix . 'helpmate_crm_tasks');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_tasks_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            title varchar(255) NOT NULL,
            description text NULL,
            due_date datetime NULL,
            assigned_to bigint(20) NULL COMMENT 'WordPress user ID',
            created_by bigint(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY assigned_to (assigned_to),
            KEY created_by (created_by),
            KEY due_date (due_date),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Task-Contact Relationship table (Many-to-Many)
        $crm_task_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_contacts');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_task_contacts_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            task_id bigint(20) NOT NULL,
            contact_id bigint(20) NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY task_contact (task_id, contact_id),
            KEY task_id (task_id),
            KEY contact_id (contact_id)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Task Custom Field Values table
        $crm_task_field_values_table = esc_sql($wpdb->prefix . 'helpmate_crm_task_field_values');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_task_field_values_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            task_id bigint(20) NOT NULL,
            field_id bigint(20) NOT NULL,
            field_value text NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY task_field (task_id, field_id),
            KEY task_id (task_id),
            KEY field_id (field_id)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Email Templates table
        $crm_email_templates_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_templates');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_email_templates_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            subject text NOT NULL,
            body longtext NOT NULL,
            is_default tinyint(1) NOT NULL DEFAULT 0,
            original_subject text NULL,
            original_body longtext NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY created_at (created_at),
            KEY updated_at (updated_at),
            KEY is_default (is_default)
        ) $charset_collate;";
        dbDelta($sql);

        // Add new columns if they don't exist (for existing installations)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
        $columns = $wpdb->get_col(
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "DESC {$crm_email_templates_table}"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ,
            0
        );
        if (!in_array('is_default', $columns)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_email_templates_table} ADD COLUMN is_default tinyint(1) NOT NULL DEFAULT 0");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_email_templates_table} ADD INDEX is_default (is_default)");
        }
        if (!in_array('original_subject', $columns)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_email_templates_table} ADD COLUMN original_subject text NULL");
        }
        if (!in_array('original_body', $columns)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_email_templates_table} ADD COLUMN original_body longtext NULL");
        }

        // CRM - Emails (sent email history) table
        $crm_emails_table = esc_sql($wpdb->prefix . 'helpmate_crm_emails');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_emails_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            contact_id bigint(20) NOT NULL,
            template_id bigint(20) NULL,
            subject text NOT NULL,
            body longtext NOT NULL,
            sent_by bigint(20) NOT NULL,
            sent_at datetime NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'sent',
            error_message text NULL,
            campaign_id bigint(20) NULL,
            recurring_campaign_id bigint(20) NULL,
            sequence_id bigint(20) NULL,
            sequence_step_id bigint(20) NULL,
            PRIMARY KEY (id),
            KEY contact_id (contact_id),
            KEY template_id (template_id),
            KEY sent_by (sent_by),
            KEY sent_at (sent_at),
            KEY status (status),
            KEY campaign_id (campaign_id),
            KEY sequence_id (sequence_id)
        ) $charset_collate;";
        dbDelta($sql);

        // Add campaign/sequence columns to emails table if they don't exist (for existing installations)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema inspection for migration; caching not appropriate
        $emails_columns = $wpdb->get_col(
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "DESC {$crm_emails_table}"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            ,
            0
        );
        $emails_migration_cols = array('campaign_id', 'recurring_campaign_id', 'sequence_id', 'sequence_step_id');
        foreach ($emails_migration_cols as $col) {
            if (!in_array($col, $emails_columns, true)) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
                $wpdb->query("ALTER TABLE {$crm_emails_table} ADD COLUMN {$col} bigint(20) NULL");
                if ($col === 'campaign_id' || $col === 'sequence_id') {
                    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
                    $wpdb->query("ALTER TABLE {$crm_emails_table} ADD KEY {$col} ({$col})");
                }
            }
        }

        // CRM - Email failures (for failures that don't create an email record)
        $crm_email_failures_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_failures');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_email_failures_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            campaign_id bigint(20) NULL,
            recurring_campaign_id bigint(20) NULL,
            sequence_id bigint(20) NULL,
            sequence_step_id bigint(20) NULL,
            contact_id bigint(20) NOT NULL,
            error_message text NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY campaign_id (campaign_id),
            KEY sequence_id (sequence_id)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Segments table
        $crm_segments_table = esc_sql($wpdb->prefix . 'helpmate_crm_segments');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_segments_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            conditions longtext NOT NULL COMMENT 'JSON condition groups with AND/OR logic',
            contact_count int(11) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY contact_count (contact_count),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Campaigns table
        $crm_campaigns_table = esc_sql($wpdb->prefix . 'helpmate_crm_campaigns');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_campaigns_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            template_id bigint(20) NOT NULL,
            segment_id bigint(20) NULL,
            subject_override text NULL,
            body_override text NULL,
            type varchar(20) NOT NULL DEFAULT 'one_time',
            status varchar(50) NOT NULL DEFAULT 'draft',
            scheduled_at datetime NULL,
            sent_at datetime NULL,
            total_contacts int(11) NOT NULL DEFAULT 0,
            sent_count int(11) NOT NULL DEFAULT 0,
            failed_count int(11) NOT NULL DEFAULT 0,
            recurring_campaign_id bigint(20) NULL,
            interval_value int(11) NULL,
            interval_unit varchar(20) NULL,
            send_time time NULL,
            next_run_at datetime NULL,
            last_run_at datetime NULL,
            is_active tinyint(1) NOT NULL DEFAULT 1,
            created_by bigint(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY template_id (template_id),
            KEY segment_id (segment_id),
            KEY type (type),
            KEY status (status),
            KEY scheduled_at (scheduled_at),
            KEY recurring_campaign_id (recurring_campaign_id),
            KEY is_active (is_active),
            KEY next_run_at (next_run_at),
            KEY created_by (created_by)
        ) $charset_collate;";
        dbDelta($sql);

        // Add recurring_campaign_id column if it doesn't exist (for existing installations)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
        $column_exists = $wpdb->get_results(
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SHOW COLUMNS FROM {$crm_campaigns_table} LIKE 'recurring_campaign_id'"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        if (empty($column_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN recurring_campaign_id bigint(20) NULL AFTER failed_count");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD KEY recurring_campaign_id (recurring_campaign_id)");
        }

        // Add type column if it doesn't exist (for existing installations)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
        $type_column_exists = $wpdb->get_results(
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SHOW COLUMNS FROM {$crm_campaigns_table} LIKE 'type'"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        if (empty($type_column_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN type varchar(20) NOT NULL DEFAULT 'one_time' AFTER body_override");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD KEY type (type)");
        }

        // Add recurring-specific columns if they don't exist (for existing installations)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Schema check, caching not appropriate
        $interval_value_exists = $wpdb->get_results(
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SHOW COLUMNS FROM {$crm_campaigns_table} LIKE 'interval_value'"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );
        if (empty($interval_value_exists)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN interval_value int(11) NULL AFTER recurring_campaign_id");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN interval_unit varchar(20) NULL AFTER interval_value");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN send_time time NULL AFTER interval_unit");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN next_run_at datetime NULL AFTER send_time");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN last_run_at datetime NULL AFTER next_run_at");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD COLUMN is_active tinyint(1) NOT NULL DEFAULT 1 AFTER last_run_at");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD KEY is_active (is_active)");
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Schema modification doesn't require caching; table name is safe, uses wpdb->prefix
            $wpdb->query("ALTER TABLE {$crm_campaigns_table} ADD KEY next_run_at (next_run_at)");
        }

        // CRM - Recurring Campaigns table
        $crm_recurring_campaigns_table = esc_sql($wpdb->prefix . 'helpmate_crm_recurring_campaigns');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_recurring_campaigns_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            template_id bigint(20) NOT NULL,
            segment_id bigint(20) NOT NULL,
            subject_override text NULL,
            body_override text NULL,
            interval_value int(11) NOT NULL DEFAULT 1,
            interval_unit varchar(20) NOT NULL DEFAULT 'days',
            send_time time NULL,
            next_run_at datetime NOT NULL,
            last_run_at datetime NULL,
            is_active tinyint(1) NOT NULL DEFAULT 1,
            created_by bigint(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY template_id (template_id),
            KEY segment_id (segment_id),
            KEY is_active (is_active),
            KEY next_run_at (next_run_at),
            KEY created_by (created_by)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Email Sequences table
        $crm_email_sequences_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequences');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_email_sequences_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            segment_id bigint(20) NOT NULL,
            is_active tinyint(1) NOT NULL DEFAULT 1,
            created_by bigint(20) NOT NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY segment_id (segment_id),
            KEY is_active (is_active),
            KEY created_by (created_by)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Email Sequence Steps table
        $crm_email_sequence_steps_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_steps');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_email_sequence_steps_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            sequence_id bigint(20) NOT NULL,
            step_order int(11) NOT NULL,
            template_id bigint(20) NOT NULL,
            subject_override text NULL,
            body_override text NULL,
            delay_days int(11) NOT NULL DEFAULT 0,
            delay_hours int(11) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY sequence_id (sequence_id),
            KEY step_order (step_order),
            KEY template_id (template_id)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Email Sequence Contacts table
        $crm_email_sequence_contacts_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_sequence_contacts');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_email_sequence_contacts_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            sequence_id bigint(20) NOT NULL,
            contact_id bigint(20) NOT NULL,
            current_step int(11) NOT NULL DEFAULT 0,
            next_send_at datetime NOT NULL,
            completed_at datetime NULL,
            paused_at datetime NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY sequence_contact (sequence_id, contact_id),
            KEY sequence_id (sequence_id),
            KEY contact_id (contact_id),
            KEY next_send_at (next_send_at),
            KEY current_step (current_step)
        ) $charset_collate;";
        dbDelta($sql);

        // CRM - Email Tracking table
        $crm_email_tracking_table = esc_sql($wpdb->prefix . 'helpmate_crm_email_tracking');
        $sql = "CREATE TABLE IF NOT EXISTS {$crm_email_tracking_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            email_id bigint(20) NOT NULL,
            campaign_id bigint(20) NULL,
            recurring_campaign_id bigint(20) NULL,
            sequence_id bigint(20) NULL,
            sequence_step_id bigint(20) NULL,
            contact_id bigint(20) NOT NULL,
            opened_at datetime NULL,
            opened_count int(11) NOT NULL DEFAULT 0,
            clicked_at datetime NULL,
            clicked_count int(11) NOT NULL DEFAULT 0,
            bounced_at datetime NULL,
            bounce_reason text NULL,
            unsubscribed_at datetime NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY email_contact (email_id, contact_id),
            KEY email_id (email_id),
            KEY campaign_id (campaign_id),
            KEY recurring_campaign_id (recurring_campaign_id),
            KEY sequence_id (sequence_id),
            KEY contact_id (contact_id),
            KEY opened_at (opened_at),
            KEY clicked_at (clicked_at)
        ) $charset_collate;";
        dbDelta($sql);

        // Team members table
        $team_members_table = esc_sql($wpdb->prefix . 'helpmate_team_members');
        $sql = "CREATE TABLE IF NOT EXISTS {$team_members_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL,
            role varchar(50) NOT NULL COMMENT 'admin, manager, live_chat_agent, salesperson, marketer',
            assigned_by bigint(20) NOT NULL,
            created_at bigint(20) NOT NULL,
            updated_at bigint(20) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY user_role (user_id, role),
            KEY user_id (user_id),
            KEY role (role),
            KEY assigned_by (assigned_by)
        ) $charset_collate;";
        dbDelta($sql);

        // Notifications table (admin + team; user_id=0 = global for admins only)
        $notifications_table = esc_sql($wpdb->prefix . 'helpmate_notifications');
        $sql = "CREATE TABLE IF NOT EXISTS {$notifications_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) NOT NULL DEFAULT 0 COMMENT '0=global (admins only), else target user',
            type varchar(50) NOT NULL COMMENT 'conversation, message, ticket, lead, appointment, task, social_message, etc.',
            title varchar(255) NOT NULL,
            body text NULL,
            link text NULL,
            meta text NULL COMMENT 'JSON',
            read_at datetime NULL,
            created_at datetime NOT NULL,
            entity_type varchar(50) NULL,
            entity_id bigint(20) NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY type (type),
            KEY read_at (read_at),
            KEY created_at (created_at),
            KEY entity (entity_type, entity_id)
        ) $charset_collate;";
        dbDelta($sql);

        // Conversation participants table
        $conversation_participants_table = esc_sql($wpdb->prefix . 'helpmate_conversation_participants');
        $sql = "CREATE TABLE IF NOT EXISTS {$conversation_participants_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            conversation_id varchar(255) NOT NULL COMMENT 'Can be numeric ID or string like website_xxx, ticket_xxx',
            conversation_type varchar(50) NOT NULL COMMENT 'social, website, ticket',
            user_id bigint(20) NOT NULL,
            joined_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY conversation_user (conversation_id, user_id),
            KEY conversation_id (conversation_id),
            KEY user_id (user_id),
            KEY conversation_type (conversation_type),
            KEY joined_at (joined_at)
        ) $charset_collate;";
        dbDelta($sql);

        // Smart Schedules - Schedules table
        $schedules_table = esc_sql($wpdb->prefix . 'helpmate_schedules');
        $sql = "CREATE TABLE IF NOT EXISTS {$schedules_table} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            email varchar(255) NOT NULL,
            phone varchar(255) NULL,
            message text NULL,
            scheduled_date date NOT NULL,
            scheduled_time time NOT NULL,
            status varchar(50) NOT NULL DEFAULT 'pending' COMMENT 'pending, confirmed, cancelled',
            user_id bigint(20) NULL,
            contact_id bigint(20) NULL,
            created_at bigint(20) NOT NULL,
            updated_at bigint(20) NOT NULL,
            metadata text NULL,
            PRIMARY KEY (id),
            KEY scheduled_date (scheduled_date),
            KEY scheduled_time (scheduled_time),
            KEY status (status),
            KEY user_id (user_id),
            KEY contact_id (contact_id),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        // Integration events table
        $integration_events_table = esc_sql($wpdb->prefix . 'helpmate_integration_events');
        $sql = "CREATE TABLE IF NOT EXISTS {$integration_events_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            integration varchar(100) NOT NULL,
            source varchar(100) NOT NULL,
            form_id bigint(20) unsigned NULL,
            action varchar(100) NOT NULL,
            status varchar(64) NOT NULL,
            error_code varchar(120) NULL,
            error_message text NULL,
            payload_hash varchar(64) NULL,
            dedup_key varchar(64) NULL,
            metadata longtext NULL,
            created_at bigint(20) NOT NULL,
            PRIMARY KEY (id),
            KEY integration (integration),
            KEY action (action),
            KEY status (status),
            KEY form_id (form_id),
            KEY payload_hash (payload_hash),
            KEY dedup_key (dedup_key),
            KEY created_at (created_at)
        ) $charset_collate;";
        dbDelta($sql);

        $this->initialize_default_module_settings();
        $this->initialize_task_custom_fields();
    }

    /**
     * Initialize default module settings if they don't exist.
     *
     * @since 1.0.0
     * @access private
     */
    private function initialize_default_module_settings()
    {
        global $wpdb;

        // Get all existing settings
        $existing_settings = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
            "SELECT setting_key FROM {$wpdb->prefix}helpmate_settings"
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        );

        // Define all default settings
        $default_settings = [
            'modules' => HELPMATE_MODULE_DEFAULT_SETTINGS,
            'api' => [
                'api_key' => '',
                'validation_key' => '',
                'credits' => [],
                'last_sync' => 0,
                'customer_id' => '',
            ],
            'ai' => [
                'temperature' => 0,
                'tone' => 'friendly',
                'language' => 'default',
            ],
            'behavior' => [
                'welcome_message_sound' => true,
                'welcome_message' => ['How can I help you today?'],
                'collect_lead' => false,
                'lead_form_fields' => ['name', 'email', 'message'],
                'hide_on_mobile' => false,
                'business_hours_enabled' => false,
                'business_hours' => [
                    'monday'    => [ 'enabled' => false, 'startTime' => '09:00', 'endTime' => '17:00' ],
                    'tuesday'   => [ 'enabled' => false, 'startTime' => '09:00', 'endTime' => '17:00' ],
                    'wednesday' => [ 'enabled' => false, 'startTime' => '09:00', 'endTime' => '17:00' ],
                    'thursday'  => [ 'enabled' => false, 'startTime' => '09:00', 'endTime' => '17:00' ],
                    'friday'    => [ 'enabled' => false, 'startTime' => '09:00', 'endTime' => '17:00' ],
                    'saturday'  => [ 'enabled' => false, 'startTime' => '09:00', 'endTime' => '17:00' ],
                    'sunday'    => [ 'enabled' => false, 'startTime' => '09:00', 'endTime' => '17:00' ],
                ],
                'ai_takeover_after_seconds' => 0,
            ],
            'customization' => [
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
            ],
            'order_tracker' => [
                'order_tracker_email_required' => true,
                'order_tracker_phone_required' => false,
            ],
            'refund_return' => [
                'policy_url' => '',
                'selected_email_template' => null,
                'reasons' => [
                    'Defective Product',
                    'Wrong Product Received',
                    'Wrong Size Received',
                    'Wrong Color Received',
                    'Wrong Quantity Received',
                    'Other',
                ],
            ],
            'abandoned_cart' => [
                'abandoned_cart_after' => '60',
                'delete_abandoned_cart_after' => '10080',
                'cart_recovery_button_text' => 'Recover Cart',
                'selected_email_template' => null,
                'coupon_code' => '',
                'follow_up_emails' => [],
            ],
            'proactive_sales' => [
                "proactive_sales_hide_frequency" => "0.08",
                "proactive_sales_show_frequency" => "0.16",
                "proactive_sales_template" => "1",
                "products" => []
            ],
            'coupons' => [
                "coupons" => [],
                "exit_intent_coupon" => "",
                "ask_ai_coupon" => true,
                "specific_product_query_coupon" => true,
                "collect_lead" => false,
            ],
            'social_chat' => [
                'app_id' => '',
                'app_secret' => '',
                'webhook_verify_token' => bin2hex(random_bytes(16)),
                'enabled' => true,
                'platforms' => [
                    'messenger' => ['enabled' => true, 'auto_reply' => true, 'comment_auto_reply' => true],
                    'instagram_dm' => ['enabled' => true, 'auto_reply' => true, 'comment_auto_reply' => true],
                    'whatsapp' => ['enabled' => true, 'auto_reply' => true],
                    'comments' => ['enabled' => true]
                ],
                'lead_keywords' => [
                    'messenger' => [],
                    'instagram_dm' => [],
                    'whatsapp' => []
                ],
                'leads_enabled' => false,
                'conversation_starters_enabled' => false,
            ],
            'cf7_integrations' => [
                'forms' => [],
            ],
            'integrations' => [
                'event_retention_days' => 90,
            ],
            'helpmate_crm_custom_statuses' => []
        ];

        // Insert only missing settings
        foreach ($default_settings as $key => $value) {
            if (!in_array($key, $existing_settings)) {
                $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prefix . 'helpmate_settings',
                    [
                        'setting_key' => $key,
                        'setting_value' => json_encode($value),
                        'last_updated' => time()
                    ],
                    ['%s', '%s', '%d']
                );
            }
        }
    }

    /**
     * Initialize default task custom fields if they don't exist.
     *
     * @since 1.1.7
     * @access public
     */
    public function initialize_task_custom_fields()
    {
        global $wpdb;

        $custom_fields_table = esc_sql($wpdb->prefix . 'helpmate_crm_custom_fields');

        // Define default task custom fields
        $task_custom_fields = [
            [
                'field_name' => 'priority',
                'field_label' => 'Priority',
                'field_type' => 'dropdown',
                'field_options' => json_encode(['Low', 'Medium', 'High', 'Urgent']),
                'is_required' => false,
                'entity_type' => 'task',
                'display_order' => 1,
            ],
            [
                'field_name' => 'status',
                'field_label' => 'Status',
                'field_type' => 'dropdown',
                'field_options' => json_encode(['To Do', 'In Progress', 'Review', 'Done']),
                'is_required' => true,
                'entity_type' => 'task',
                'display_order' => 2,
            ],
            [
                'field_name' => 'task_type',
                'field_label' => 'Type',
                'field_type' => 'dropdown',
                'field_options' => json_encode(['Call', 'Email', 'Meeting', 'Follow-up', 'Other']),
                'is_required' => false,
                'entity_type' => 'task',
                'display_order' => 3,
            ],
        ];

        // Insert only if they don't exist
        foreach ($task_custom_fields as $field) {
            $existing = $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                $wpdb->prepare(
                    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
                    "SELECT id FROM {$custom_fields_table} WHERE field_name = %s AND entity_type = 'task'"
                    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    ,
                    $field['field_name']
                )
            );

            if (!$existing) {
                $wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $custom_fields_table,
                    array_merge($field, [
                        'created_at' => current_time('mysql'),
                        'updated_at' => current_time('mysql'),
                    ])
                );
            }
        }
    }
}
