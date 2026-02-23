<?php

/**
 * The message processor for the Social Chat module.
 *
 * Handles processing incoming messages and generating AI responses.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.2.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/includes/social
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) exit;

class Helpmate_Social_Message_Processor
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
     * Last API error message from comment reply or send-message (for propagating to user).
     *
     * @since    1.2.0
     * @var      string|null    $last_api_error_message
     */
    private $last_api_error_message = null;

    /**
     * Initialize the class and set its properties.
     *
     * @since    1.2.0
     * @param    Helpmate    $helpmate    The helpmate instance.
     */
    public function __construct(Helpmate $helpmate)
    {
        $this->helpmate = $helpmate;
    }

    /**
     * Generate AI response only (for centralized flow).
     *
     * @since    1.2.0
     * @param    string    $message         The user message.
     * @param    array     $conversation    The conversation data.
     * @return   string|null    The AI response or null on failure.
     */
    public function generate_ai_response_only(string $message, array $conversation): ?string
    {
        $social_chat = $this->helpmate->get_social_chat();
        $settings = $social_chat->get_social_chat_settings();

        return $this->generate_ai_response($message, $conversation, $settings);
    }

    /**
     * Process an incoming message.
     *
     * @since    1.2.0
     * @param    array    $data    The message data.
     * @return   bool    Whether processing was successful.
     */
    public function process_incoming_message(array $data): bool
    {
        $social_chat = $this->helpmate->get_social_chat();
        $settings = $social_chat->get_social_chat_settings();

        // Check if social chat is enabled
        if (empty($settings['enabled'])) {
            return false;
        }

        // Check if platform is enabled
        $platform_key = $this->get_platform_key($data['platform']);
        $platforms = $settings['platforms'] ?? [];

        if (empty($platforms[$platform_key]['enabled'])) {
            return false;
        }

        // Get account details
        $account = $social_chat->get_account((int) $data['account_id']);
        if (!$account) {
            return false;
        }

        // Get or create conversation
        $conversation = $social_chat->get_or_create_conversation([
            'account_id' => $data['account_id'],
            'platform' => $data['platform'],
            'external_id' => $data['message_id'],
            'participant_id' => $data['sender_id'],
            'participant_name' => $data['sender_name'] ?? ''
        ]);

        // Schedule background fetch of user profile if name is empty, or for comments when profile pic is missing
        // (Webhooks send sender_name but never profile pic, so we must fetch for comments to get avatar)
        $needs_fetch = empty($conversation['participant_name']) ||
            (in_array($data['platform'], ['fb_comment', 'ig_comment'], true) && empty($conversation['participant_profile_pic'] ?? ''));
        if ($needs_fetch) {
            $api_platform = ($data['platform'] === 'fb_comment') ? 'messenger' : (($data['platform'] === 'ig_comment') ? 'instagram' : $data['platform']);
            if (in_array($api_platform, ['messenger', 'instagram'], true)) {
                $social_chat->schedule_profile_fetch(
                    (int) $conversation['id'],
                    $account,
                    $api_platform,
                    $data['sender_id']
                );
            }
        }

        // Save incoming message
        $message_id = $social_chat->save_message([
            'conversation_id' => $conversation['id'],
            'external_id' => $data['message_id'],
            'direction' => 'inbound',
            'content' => $data['content'],
            'message_type' => $data['message_type'],
            'sent_by' => 'customer'
        ]);

        if (!$message_id) {
            return false;
        }

        // Check for campaign keywords and trigger campaign if match found (only for comments)
        $campaign_matched = false;
        if (in_array($data['platform'], ['fb_comment', 'ig_comment'], true)) {
            $campaign_matched = $this->check_and_trigger_campaign($data, $conversation, $account);
        }

        // If a campaign was matched, skip AI reply (campaign handles the response)
        if ($campaign_matched) {
            return true;
        }

        // Check if human handoff is active
        if ((int) ($conversation['is_human_handoff'] ?? 0) === 1) {
            // Don't auto-reply, human is handling
            return true;
        }

        // If this post has any campaign, skip generic AI comment reply
        if (in_array($data['platform'], ['fb_comment', 'ig_comment'], true) && !empty($data['post_id'])) {
            $comment_platform = ($data['platform'] === 'fb_comment') ? 'facebook' : 'instagram';
            $campaigns = $settings['lead_campaigns'] ?? [];
            $post_has_campaign = false;
            foreach ($campaigns as $c) {
                if (($c['post_id'] ?? '') === $data['post_id'] && ($c['platform'] ?? '') === $comment_platform) {
                    $post_has_campaign = true;
                    break;
                }
            }
            if ($post_has_campaign) {
                return true;
            }
        }

        // Check if auto-reply is enabled for this platform
        // For comments, check the parent platform's comment_auto_reply setting
        if (in_array($data['platform'], ['fb_comment', 'ig_comment'], true)) {
            $parent_platform = ($data['platform'] === 'fb_comment') ? 'messenger' : 'instagram_dm';
            if (empty($platforms[$parent_platform]['comment_auto_reply'] ?? true)) {
                return true;
            }
        } elseif (empty($platforms[$platform_key]['auto_reply'])) {
            return true;
        }

        // Generate AI response
        $ai_response = $this->generate_ai_response($data['content'], $conversation, $settings);

        if (empty($ai_response)) {
            return false;
        }

        // Send response
        return $this->send_response(
            $account,
            $data['platform'],
            $data['sender_id'],
            $ai_response,
            $conversation,
            $data,
            null // No user_id for AI responses
        );
    }

    /**
     * Get the platform key for settings lookup.
     *
     * @since    1.2.0
     * @param    string    $platform    The platform identifier.
     * @return   string    The settings key.
     */
    private function get_platform_key(string $platform): string
    {
        switch ($platform) {
            case 'messenger':
                return 'messenger';
            case 'instagram':
                return 'instagram_dm';
            case 'fb_comment':
            case 'ig_comment':
                return 'comments';
            default:
                return $platform;
        }
    }

    /**
     * Get the platform key for lead keywords lookup.
     * Comments use the same keywords as their parent platforms.
     *
     * @since    1.2.0
     * @param    string    $platform    The platform identifier.
     * @return   string    The lead keywords key.
     */
    private function get_lead_platform_key(string $platform): string
    {
        switch ($platform) {
            case 'messenger':
            case 'fb_comment':
                return 'messenger';
            case 'instagram':
            case 'ig_comment':
                return 'instagram_dm';
            case 'whatsapp':
                return 'whatsapp';
            default:
                return $platform;
        }
    }

    /**
     * Check comment for campaign keywords and trigger campaign if match found.
     *
     * @since    1.2.0
     * @param    array    $data         The message data.
     * @param    array    $conversation The conversation data.
     * @param    array    $account      The account data.
     * @return   bool    Whether a campaign was matched and triggered.
     */
    public function check_and_trigger_campaign(array $data, array $conversation, array $account): bool
    {
        // Only work for comments
        if (!in_array($data['platform'], ['fb_comment', 'ig_comment'], true)) {
            return false;
        }

        $social_chat = $this->helpmate->get_social_chat();
        $settings = $social_chat->get_social_chat_settings();

        // Check if DM for Comments feature is enabled
        $platforms = $settings['platforms'] ?? [];
        if (empty($platforms['comments']['enabled'])) {
            return false;
        }

        $campaigns = $settings['lead_campaigns'] ?? [];

        if (empty($campaigns)) {
            return false;
        }

        // Determine comment platform (fb_comment -> facebook, ig_comment -> instagram)
        $comment_platform = ($data['platform'] === 'fb_comment') ? 'facebook' : 'instagram';
        $post_id = $data['post_id'] ?? null;

        // Check if comment exactly matches any campaign keyword (case-insensitive)
        $message_normalized = strtolower(trim($data['content'] ?? ''));
        $matched_campaign = null;

        foreach ($campaigns as $campaign) {
            // 1. Platform Check: Match campaign platform with comment platform
            $campaign_platform = $campaign['platform'] ?? 'facebook'; // Default to facebook for backward compatibility
            if ($campaign_platform !== $comment_platform) {
                continue; // Skip if platforms don't match
            }

            // 2. Post ID Check: Campaign must match the comment's post
            $campaign_post_id = $campaign['post_id'] ?? '';
            if (empty($campaign_post_id) || $campaign_post_id !== $post_id) {
                continue; // Skip if post IDs don't match
            }

            // 3. Keywords Check: Split keywords by comma and check ANY match (OR logic)
            $keywords = $campaign['keywords'] ?? '';

            if (empty($keywords)) {
                continue; // Skip if no keywords
            }

            // Split keywords by comma and trim each
            $keyword_array = array_map('trim', explode(',', $keywords));
            $keyword_array = array_filter($keyword_array); // Remove empty values

            $found = false;
            foreach ($keyword_array as $keyword) {
                if (empty($keyword)) {
                    continue;
                }
                $keyword_lower = strtolower(trim($keyword));
                if ($message_normalized === $keyword_lower) {
                    $found = true;
                    break; // Found a match, stop checking
                }
            }

            if ($found) {
                $matched_campaign = $campaign;
                break; // Found matching campaign, stop searching
            }
        }

        if (!$matched_campaign) {
            return false;
        }

        // Get campaign type (default to 'lead' for backward compatibility)
        $campaign_type = $matched_campaign['campaign_type'] ?? 'lead';

        // Get comment reply if provided
        $comment_reply = !empty($matched_campaign['comment_reply']) ? trim($matched_campaign['comment_reply']) : '';

        // Send comment reply first if provided (only if field is filled)
        if (!empty($comment_reply)) {
            $post_id = $data['post_id'] ?? null;
            $comment_id = $data['message_id'] ?? null;

            $this->send_comment_reply(
                $account,
                $data['platform'],
                $comment_id,
                $post_id,
                $comment_reply,
                $conversation
            );
        }

        // Get or create DM conversation
        $dm_conversation = $social_chat->get_or_create_dm_conversation(
            $account,
            $data['sender_id'],
            $data['platform']
        );

        // If DM conversation creation fails, still return true to prevent AI reply
        // The campaign was matched, so we don't want AI to generate a response
        if (!$dm_conversation) {
            return true; // Campaign matched, prevent AI reply even if DM creation failed
        }

        // Prepare comment context for DM - use original comment ID for Meta Private Reply API
        $post_id = $data['post_id'] ?? null;
        $comment_id = $data['message_id'] ?? null; // Full format (post_id_comment_id) for Meta API

        // Route based on campaign type
        if ($campaign_type === 'custom_message') {
            // Send custom message DM
            $this->send_custom_message_dm($matched_campaign, $dm_conversation, $account, $data['platform'], $post_id, $comment_id);

            // Create or replace campaign state for tracking (last-one-wins)
            $social_chat->create_or_replace_campaign_state([
                'conversation_id' => (int) $dm_conversation['id'],
                'campaign_id' => $matched_campaign['id'],
                'state' => 'custom_message_sent',
                'original_comment_id' => $data['message_id'],
                'original_platform' => $data['platform'],
                'dm_conversation_id' => (int) $dm_conversation['id'],
            ]);
        } else {
            // Send lead campaign DM
            $this->send_campaign_dm($matched_campaign, $dm_conversation, $account, $data['platform'], $post_id, $comment_id);

            // Create or replace campaign state for lead collection (last-one-wins)
            $social_chat->create_or_replace_campaign_state([
                'conversation_id' => (int) $dm_conversation['id'],
                'campaign_id' => $matched_campaign['id'],
                'state' => 'waiting_for_claim',
                'original_comment_id' => $data['message_id'],
                'original_platform' => $data['platform'],
                'dm_conversation_id' => (int) $dm_conversation['id'],
            ]);
        }

        return true; // Campaign was matched and triggered
    }

    /**
     * Send campaign DM to user with title, description, and claim button.
     *
     * @since    1.2.0
     * @param    array    $campaign         The campaign data.
     * @param    array    $dm_conversation  The DM conversation.
     * @param    array    $account          The account data.
     * @param    string   $original_platform The original platform (fb_comment or ig_comment).
     * @param    string|null   $post_id     The post ID where the comment was made (optional).
     * @param    string|null   $comment_id  The comment ID - use full format from webhook for Meta Private Reply (optional).
     * @return   bool    Whether sending was successful.
     */
    private function send_campaign_dm(array $campaign, array $dm_conversation, array $account, string $original_platform, ?string $post_id = null, ?string $comment_id = null): bool
    {
        // Map comment platform to DM platform
        $dm_platform = ($original_platform === 'fb_comment') ? 'messenger' : 'instagram';

        // Instagram: single message with comment context (private reply) for badge. No button (Meta doesn't support it).
        // Messenger: single message with button.
        $message_cta = "Type 'claim' to get this deal!";

        $license_key = $this->helpmate->get_api()->get_key();
        $api_server  = $this->helpmate->get_api()->get_api_server();

        if (empty($license_key) || empty($api_server)) {
            return false;
        }

        $button_payload = 'claim_deal_' . $campaign['id'];

        $social_chat   = $this->helpmate->get_social_chat();
        $access_token  = $account['access_token'] ?? '';
        if (empty($access_token) && !empty($account['access_token_encrypted'])) {
            $access_token = $social_chat->decrypt_value($account['access_token_encrypted']);
        }

        $message_deal = '🎉 ' . $campaign['title'] . "\n\n" . $campaign['description'] . "\n\n" . $message_cta;

        $request_body = [
            'license_key'          => $license_key,
            'page_id'              => $account['page_id'],
            'recipient_id'         => $dm_conversation['participant_id'],
            'message'              => $message_deal,
            'platform'             => $dm_platform,
            'access_token'         => $access_token,
            'instagram_account_id' => $account['instagram_account_id'] ?? '',
        ];

        // Instagram: text only (no button) with comment context for private reply badge
        if ($dm_platform === 'instagram') {
            if ($post_id && $comment_id) {
                $request_body['post_id']   = $post_id;
                $request_body['comment_id'] = $comment_id;
            }
        } else {
            // Messenger: add button
            $request_body['button_text']    = 'Claim the Deal';
            $request_body['button_payload']  = $button_payload;
            if ($post_id && $comment_id) {
                $request_body['post_id']   = $post_id;
                $request_body['comment_id'] = $comment_id;
            }
        }

        $response = wp_remote_post($api_server . '/wp-json/rp/v1/social/send-message', [
            'timeout' => 30,
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body'    => wp_json_encode($request_body),
        ]);

        if (is_wp_error($response)) {
            return false;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $result       = json_decode($response_body, true);

        if ($response_code !== 200 || (isset($result['error']) && $result['error'])) {
            return false;
        }

        $message_id = $result['result']['message_id'] ?? ($result['result']['id'] ?? uniqid('msg_'));
        $social_chat->save_message([
            'conversation_id' => (int) $dm_conversation['id'],
            'external_id'     => $message_id,
            'direction'       => 'outbound',
            'content'         => $message_deal,
            'message_type'    => 'text',
            'sent_by'         => 'ai',
        ]);

        return true;
    }

    /**
     * Send comment reply before DM.
     *
     * @since    1.2.0
     * @param    array    $account          The account data.
     * @param    string   $platform         The comment platform (fb_comment or ig_comment).
     * @param    string   $comment_id       The comment ID to reply to.
     * @param    string   $post_id           The post ID where the comment was made.
     * @param    string   $reply_message     The message to reply with.
     * @param    array    $conversation      The comment conversation.
     * @return   bool    Whether sending was successful.
     */
    private function send_comment_reply(array $account, string $platform, string $comment_id, string $post_id, string $reply_message, array $conversation): bool
    {
        // Extract comment ID if it's in format {post_id}_{comment_id}
        $extracted_comment_id = $comment_id;
        if ($platform === 'fb_comment' && strpos($comment_id, '_') !== false) {
            $parts = explode('_', $comment_id);
            $extracted_comment_id = end($parts);
        }

        // Use the existing send_response method which handles comment replies
        return $this->send_response(
            $account,
            $platform,
            $conversation['participant_id'],
            $reply_message,
            $conversation,
            [
                'message_id' => $comment_id,
                'post_id' => $post_id,
            ],
            null
        );
    }

    /**
     * Send custom message DM to user.
     *
     * @since    1.2.0
     * @param    array    $campaign         The campaign data.
     * @param    array    $dm_conversation  The DM conversation.
     * @param    array    $account          The account data.
     * @param    string   $original_platform The original platform (fb_comment or ig_comment).
     * @param    string|null   $post_id     The post ID where the comment was made (optional).
     * @param    string|null   $comment_id  The comment ID - use full format from webhook for Meta Private Reply (optional).
     * @return   bool    Whether sending was successful.
     */
    private function send_custom_message_dm(array $campaign, array $dm_conversation, array $account, string $original_platform, ?string $post_id = null, ?string $comment_id = null): bool
    {
        // Map comment platform to DM platform
        $dm_platform = ($original_platform === 'fb_comment') ? 'messenger' : 'instagram';

        // Get custom message from campaign
        $message = $campaign['custom_message'] ?? '';

        if (empty($message)) {
            return false;
        }

        // Send DM
        $license_key = $this->helpmate->get_api()->get_key();
        $api_server = $this->helpmate->get_api()->get_api_server();

        if (empty($license_key) || empty($api_server)) {
            return false;
        }

        // Decrypt access token if needed
        $social_chat = $this->helpmate->get_social_chat();
        $access_token = $account['access_token'] ?? '';
        if (empty($access_token) && !empty($account['access_token_encrypted'])) {
            $access_token = $social_chat->decrypt_value($account['access_token_encrypted']);
        }

        $request_body = [
            'license_key' => $license_key,
            'page_id' => $account['page_id'],
            'recipient_id' => $dm_conversation['participant_id'],
            'message' => $message,
            'platform' => $dm_platform,
            'access_token' => $access_token,
            'instagram_account_id' => $account['instagram_account_id'] ?? '',
        ];

        // Add comment context for Meta's "responding to comment" notification - pass on every campaign trigger
        if ($post_id && $comment_id) {
            $request_body['post_id'] = $post_id;
            $request_body['comment_id'] = $comment_id;
        }

        $response = wp_remote_post($api_server . '/wp-json/rp/v1/social/send-message', [
            'timeout' => 30,
            'headers' => [
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode($request_body)
        ]);

        if (is_wp_error($response)) {
            return false;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $result = json_decode($response_body, true);

        if ($response_code !== 200 || (isset($result['error']) && $result['error'])) {
            return false;
        }

        // Save the message
        $message_id = $result['result']['message_id'] ?? ($result['result']['id'] ?? uniqid('msg_'));
        $social_chat->save_message([
            'conversation_id' => $dm_conversation['id'],
            'external_id' => $message_id,
            'direction' => 'outbound',
            'content' => $message,
            'message_type' => 'text',
            'sent_by' => 'ai'
        ]);

        return true;
    }

    /**
     * Handle lead collection in DM conversation.
     *
     * @since    1.2.0
     * @param    array    $data         The message data.
     * @param    array    $conversation The conversation data.
     * @param    array    $account      The account data.
     * @return   bool    Whether lead collection was handled.
     */
    public function handle_lead_collection(array $data, array $conversation, array $account): bool
    {
        $social_chat = $this->helpmate->get_social_chat();
        $campaign_state = $social_chat->get_campaign_state((int) $conversation['id']);

        if (!$campaign_state) {
            return false; // Not in lead collection flow
        }

        $settings = $social_chat->get_social_chat_settings();
        $campaigns = $settings['lead_campaigns'] ?? [];
        $campaign = $campaigns[$campaign_state['campaign_id']] ?? null;

        if (!$campaign) {
            // Campaign deleted, clean up state
            $social_chat->delete_campaign_state((int) $conversation['id']);
            return false;
        }

        $user_message = trim($data['content']);
        $state = $campaign_state['state'];

        // Check if user is claiming the deal
        if ($state === 'waiting_for_claim') {
            $claim_patterns = ['claim', 'yes', 'claim deal', 'i want', 'interested'];
            $user_message_lower = strtolower($user_message);
            $is_claim = false;

            foreach ($claim_patterns as $pattern) {
                if (strpos($user_message_lower, $pattern) !== false) {
                    $is_claim = true;
                    break;
                }
            }

            if ($is_claim) {
                // Determine first field to collect
                $next_field = $this->get_next_field_to_collect($campaign, $campaign_state);
                if ($next_field) {
                    $social_chat->update_campaign_state((int) $conversation['id'], [
                        'state' => 'collecting_' . $next_field
                    ]);

                    $this->send_response(
                        $account,
                        $conversation['platform'],
                        $conversation['participant_id'],
                        "Great! To claim this deal, I need some information from you.\n\nPlease provide your {$next_field}:",
                        $conversation,
                        $data,
                        null
                    );
                    return true;
                } else {
                    // All fields collected, complete
                    $this->complete_lead_collection($campaign, $campaign_state, $conversation, $account);
                    return true;
                }
            }
            return false; // Not a claim, process normally
        }

        // Handle field collection
        if (strpos($state, 'collecting_') === 0) {
            $field = str_replace('collecting_', '', $state);
            $valid = false;
            $value = '';

            switch ($field) {
                case 'email':
                    $value = $this->validate_email($user_message);
                    $valid = !empty($value);
                    break;
                case 'phone':
                    $value = $this->validate_phone($user_message);
                    $valid = !empty($value);
                    break;
                case 'address':
                    $value = $this->validate_address($user_message);
                    $valid = !empty($value);
                    break;
            }

            if (!$valid) {
                // Invalid input, ask again
                $this->send_response(
                    $account,
                    $conversation['platform'],
                    $conversation['participant_id'],
                    "That doesn't look like a valid {$field}. Please try again:",
                    $conversation,
                    $data,
                    null
                );
                return true;
            }

            // Update collected data
            $update_data = [
                'collected_' . $field => $value
            ];

            // Check if more fields needed
            $next_field = $this->get_next_field_to_collect($campaign, array_merge($campaign_state, $update_data));
            if ($next_field) {
                $update_data['state'] = 'collecting_' . $next_field;
                $social_chat->update_campaign_state((int) $conversation['id'], $update_data);

                $this->send_response(
                    $account,
                    $conversation['platform'],
                    $conversation['participant_id'],
                    "Thank you! Now please provide your {$next_field}:",
                    $conversation,
                    $data,
                    null
                );
            } else {
                // All fields collected, complete
                $social_chat->update_campaign_state((int) $conversation['id'], $update_data);
                $this->complete_lead_collection($campaign, array_merge($campaign_state, $update_data), $conversation, $account);
            }

            return true;
        }

        return false;
    }

    /**
     * Get next field to collect.
     *
     * @since    1.2.0
     * @param    array    $campaign       The campaign data.
     * @param    array    $campaign_state The campaign state.
     * @return   string|null    The next field name or null if all collected.
     */
    private function get_next_field_to_collect(array $campaign, array $campaign_state): ?string
    {
        if ($campaign['collect_email'] && empty($campaign_state['collected_email'])) {
            return 'email';
        }
        if ($campaign['collect_phone'] && empty($campaign_state['collected_phone'])) {
            return 'phone';
        }
        if ($campaign['collect_address'] && empty($campaign_state['collected_address'])) {
            return 'address';
        }
        return null;
    }

    /**
     * Complete lead collection and create lead.
     *
     * @since    1.2.0
     * @param    array    $campaign       The campaign data.
     * @param    array    $campaign_state The campaign state.
     * @param    array    $conversation   The conversation data.
     * @param    array    $account        The account data.
     * @return   void
     */
    private function complete_lead_collection(array $campaign, array $campaign_state, array $conversation, array $account): void
    {
        // Get leads module
        if (!isset($GLOBALS['helpmate'])) {
            return;
        }

        $helpmate = $GLOBALS['helpmate'];
        $leads = $helpmate->get_leads();
        if (!$leads) {
            return;
        }

        // Prepare lead metadata
        $metadata = [
            'campaign_id' => $campaign['id'],
            'campaign_title' => $campaign['title'],
            'platform' => $conversation['platform'],
            'account_name' => $account['page_name'] ?? '',
            'original_comment_id' => $campaign_state['original_comment_id'] ?? '',
            'original_platform' => $campaign_state['original_platform'] ?? '',
        ];

        if (!empty($campaign_state['collected_email'])) {
            $metadata['email'] = $campaign_state['collected_email'];
        }
        if (!empty($campaign_state['collected_phone'])) {
            $metadata['phone'] = $campaign_state['collected_phone'];
        }
        if (!empty($campaign_state['collected_address'])) {
            $metadata['address'] = $campaign_state['collected_address'];
        }

        // Map platform to source name
        $source_map = [
            'messenger' => 'facebook_messenger',
            'instagram' => 'instagram_dm',
        ];
        $source = $source_map[$conversation['platform']] ?? $conversation['platform'];

        // Create lead
        $lead_data = [
            'name' => $conversation['participant_name'] ?: __('Unknown', 'helpmate-ai-chatbot'),
            'metadata' => $metadata,
            'source' => $source,
        ];

        if (!empty($campaign_state['collected_email'])) {
            $lead_data['email'] = $campaign_state['collected_email'];
        }

        $result = $leads->create_lead($lead_data);

        if (is_wp_error($result)) {
        } elseif (isset($result->data['error']) && $result->data['error']) {
        }

        // Send final URL
        $final_message = "Perfect! Here's your special link: " . $campaign['url'];
        $this->send_response(
            $account,
            $conversation['platform'],
            $conversation['participant_id'],
            $final_message,
            $conversation,
            [],
            null
        );

        // Delete campaign state
        $social_chat = $this->helpmate->get_social_chat();
        $social_chat->delete_campaign_state((int) $conversation['id']);
    }

    /**
     * Validate email address.
     *
     * @since    1.2.0
     * @param    string    $input    The input to validate.
     * @return   string    The validated email or empty string.
     */
    private function validate_email(string $input): string
    {
        $pattern = '/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/';
        $email = trim($input);
        if (preg_match($pattern, $email)) {
            return sanitize_email($email);
        }
        return '';
    }

    /**
     * Validate phone number.
     *
     * @since    1.2.0
     * @param    string    $input    The input to validate.
     * @return   string    The validated phone or empty string.
     */
    private function validate_phone(string $input): string
    {
        $pattern = '/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/';
        $phone = trim($input);
        if (preg_match($pattern, $phone)) {
            return sanitize_text_field($phone);
        }
        return '';
    }

    /**
     * Validate address.
     *
     * @since    1.2.0
     * @param    string    $input    The input to validate.
     * @return   string    The validated address or empty string.
     */
    private function validate_address(string $input): string
    {
        $address = trim($input);
        if (strlen($address) >= 10) { // Minimum length check
            return sanitize_textarea_field($address);
        }
        return '';
    }

    /**
     * Extract email address from message text using regex.
     *
     * @since    1.2.0
     * @param    string    $message    The message text.
     * @return   string    The email address or empty string.
     */
    private function extract_email_from_message(string $message): string
    {
        $pattern = '/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/';
        if (preg_match($pattern, $message, $matches)) {
            return sanitize_email($matches[0]);
        }
        return '';
    }

    /**
     * Try to get email from Meta Graph API.
     *
     * @since    1.2.0
     * @param    array     $account     The account data.
     * @param    string    $platform    The platform identifier.
     * @param    string    $user_id     The user/participant ID.
     * @return   string    The email address or empty string.
     */
    private function try_get_email_from_api(array $account, string $platform, string $user_id): string
    {
        $social_chat = $this->helpmate->get_social_chat();
        $access_token = $account['access_token'] ?? '';

        // Try to decrypt if encrypted
        if (empty($access_token) && !empty($account['access_token_encrypted'])) {
            $access_token = $social_chat->decrypt_value($account['access_token_encrypted']);
        }

        if (empty($access_token)) {
            return '';
        }

        $graph_version = 'v18.0';
        $graph_base_url = 'https://graph.facebook.com';

        try {
            // For Messenger and Instagram, try to get user profile with email field
            // Note: Email is rarely available due to privacy restrictions
            $url = "{$graph_base_url}/{$graph_version}/{$user_id}";
            $params = [
                'fields' => 'email',
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
                return '';
            }

            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);

            if (isset($data['email']) && is_email($data['email'])) {
                return sanitize_email($data['email']);
            }
        } catch (Exception $e) {
        }

        return '';
    }

    /**
     * Update participant profile from Meta API.
     *
     * @since    1.2.0
     * @param    array     $conversation    The conversation data.
     * @param    array     $account         The account data.
     * @param    string    $platform        The platform.
     */
    private function update_participant_profile(array $conversation, array $account, string $platform): void
    {
        // Profile updates are now handled via webhook events from Meta
        // This method is kept for backward compatibility but no longer makes direct API calls
        // If profile information is needed, it should come from the webhook payload
    }

    /**
     * Generate an AI response using the existing chat system.
     *
     * @since    1.2.0
     * @param    string    $message         The user message.
     * @param    array     $conversation    The conversation data.
     * @param    array     $settings        The social chat settings.
     * @return   string|null    The AI response or null on failure.
     */
    private function generate_ai_response(string $message, array $conversation, array $settings): ?string
    {
        $social_chat = $this->helpmate->get_social_chat();
        $chat = $this->helpmate->get_chat();

        // Get recent conversation history for context
        $context_limit = 10; // Default context limit
        $recent_messages = $social_chat->get_recent_messages_for_context((int) $conversation['id'], $context_limit);

        // Format messages for the AI
        $formatted_messages = [];
        foreach ($recent_messages as $msg) {
            $role = $msg['direction'] === 'inbound' ? 'user' : 'assistant';
            $formatted_messages[] = [
                'role' => $role,
                'content' => $msg['content']
            ];
        }

        // Add post context for comments
        $enhanced_message = $message;
        $post_image_url = '';
        if (in_array($conversation['platform'], ['fb_comment', 'ig_comment'], true)) {
            $post_context_parts = [];

            if (!empty($conversation['post_message'])) {
                $post_context_parts[] = 'Post: ' . $conversation['post_message'];
            }

            if (!empty($conversation['post_image_url'])) {
                $post_image_url = $conversation['post_image_url'];
                $post_context_parts[] = 'The post includes an image.';
            }

            if (!empty($post_context_parts)) {
                $enhanced_message = implode("\n", $post_context_parts) . "\n\nComment: " . $message;
            }
        }

        // Generate a unique session ID for this social conversation
        $session_id = 'social_' . $conversation['id'];

        // Use the existing chat response generator
        $response_generator = $chat->get_response_generator();

        // Add platform context to the system message
        $platform_name = $this->get_platform_display_name($conversation['platform']);
        $custom_system_message = sprintf(
            /* translators: 1: chatbot name, 2: platform name */
            __('You are responding to a customer via %2$s. Keep responses concise and friendly. Do not use markdown formatting as it won\'t render properly on social media platforms.', 'helpmate-ai-chatbot'),
            $this->helpmate->get_settings()->get_setting('customization')['bot_name'] ?? 'Helpmate',
            $platform_name
        );

        try {
            $result = $response_generator->generate_response(
                $enhanced_message,
                [], // Context from RAG
                $session_id,
                $post_image_url, // Post image URL if available
                '', // No product ID
                $chat->get_helpers()
            );

            if (isset($result['response'])) {
                $response = $result['response'];

                // Handle different response types (array from non-tool path, object from json_decode of tool result)
                if (is_array($response) && isset($response['text'])) {
                    return $this->clean_response_for_social($response['text']);
                }
                if (is_object($response) && isset($response->text)) {
                    return $this->clean_response_for_social((string) $response->text);
                }
                if (is_string($response)) {
                    return $this->clean_response_for_social($response);
                }
                return null;
            }
        } catch (Exception $e) {
        }

        return null;
    }

    /**
     * Clean AI response for social media (remove markdown, etc.).
     *
     * @since    1.2.0
     * @param    string    $response    The AI response.
     * @return   string    The cleaned response.
     */
    private function clean_response_for_social(string $response): string
    {
        // Remove markdown links [text](url) -> text (url)
        $response = preg_replace('/\[([^\]]+)\]\(([^)]+)\)/', '$1 ($2)', $response);

        // Remove markdown bold/italic
        $response = preg_replace('/\*\*([^*]+)\*\*/', '$1', $response);
        $response = preg_replace('/\*([^*]+)\*/', '$1', $response);
        $response = preg_replace('/__([^_]+)__/', '$1', $response);
        $response = preg_replace('/_([^_]+)_/', '$1', $response);

        // Remove code blocks
        $response = preg_replace('/```[^`]*```/', '', $response);
        $response = preg_replace('/`([^`]+)`/', '$1', $response);

        // Remove headers
        $response = preg_replace('/^#+\s*/m', '', $response);

        // Remove bullet points (keep content)
        $response = preg_replace('/^[\*\-]\s*/m', '• ', $response);

        // Clean up extra whitespace
        $response = preg_replace('/\n{3,}/', "\n\n", $response);
        $response = trim($response);

        // Limit response length for social media (Messenger has 2000 char limit)
        if (strlen($response) > 1900) {
            $response = substr($response, 0, 1897) . '...';
        }

        return $response;
    }

    /**
     * Get display name for a platform.
     *
     * @since    1.2.0
     * @param    string    $platform    The platform identifier.
     * @return   string    The display name.
     */
    private function get_platform_display_name(string $platform): string
    {
        $names = [
            'messenger' => 'Facebook Messenger',
            'instagram' => 'Instagram Direct',
            'fb_comment' => 'Facebook Comments',
            'ig_comment' => 'Instagram Comments'
        ];

        return $names[$platform] ?? ucfirst($platform);
    }

    /**
     * Send a response to the user.
     *
     * @since    1.2.0
     * @param    array     $account         The account data.
     * @param    string    $platform        The platform.
     * @param    string    $recipient_id    The recipient ID.
     * @param    string    $message         The message to send.
     * @param    array     $conversation    The conversation data.
     * @param    array     $original_data   The original message data.
     * @param    int|null  $user_id         WordPress user ID for manual replies.
     * @return   bool    Whether sending was successful.
     */
    public function send_response(array $account, string $platform, string $recipient_id, string $message, array $conversation, array $original_data, ?int $user_id = null): bool
    {
        $this->last_api_error_message = null;
        $social_chat = $this->helpmate->get_social_chat();
        $sent_by = 'ai';

        // Check if this is a human response (when handoff is active)
        if (!empty($conversation['is_human_handoff'])) {
            $sent_by = 'human';
        }

        // For comments, we need to use reply_to_comment which is handled differently
        if (in_array($platform, ['fb_comment', 'ig_comment'])) {
            // Prefer comment_id from original_data when provided (e.g. from campaign send_comment_reply)
            // This ensures we reply to the current comment, not an old one from the same conversation
            $comment_id_from_data = $original_data['message_id'] ?? null;

            if (!empty($comment_id_from_data)) {
                // Use the comment ID from the current request
                $parent_comment_id = $comment_id_from_data;
                if ($platform === 'fb_comment' && strpos($parent_comment_id, '_') !== false) {
                    $parts = explode('_', $parent_comment_id);
                    $parent_comment_id = end($parts);
                }
            } else {
                // Fallback: get from first inbound message (e.g. manual reply from inbox)
                global $wpdb;
                $messages_table = esc_sql($wpdb->prefix . 'helpmate_social_messages');
                $conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');

                $first_comment_data = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
                    $wpdb->prepare(
                        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, use wpdb->prefix
                        "SELECT m.external_id, c.parent_comment_id
                        FROM {$messages_table} m
                        INNER JOIN {$conversations_table} c ON m.conversation_id = c.id
                        WHERE m.conversation_id = %d AND m.direction = 'inbound'
                        ORDER BY m.created_at ASC LIMIT 1"
                        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                        ,
                        $conversation['id']
                    ),
                    ARRAY_A
                );

                if (empty($first_comment_data) || empty($first_comment_data['external_id'])) {
                    return false;
                }

                $first_comment = $first_comment_data['external_id'];
                $parent_comment_id_in_conv = $first_comment_data['parent_comment_id'] ?? null;

                if ($platform === 'ig_comment' && !empty($parent_comment_id_in_conv)) {
                    $parent_comment_id = $parent_comment_id_in_conv;
                } else {
                    $parent_comment_id = $first_comment;
                    if ($platform === 'fb_comment' && $parent_comment_id && strpos($parent_comment_id, '_') !== false) {
                        $parts = explode('_', $parent_comment_id);
                        $parent_comment_id = end($parts);
                    }
                }
            }

            // Call social-server to reply to comment via license-server proxy
            $license_key = $this->helpmate->get_api()->get_key();
            $api_server = $this->helpmate->get_api()->get_api_server();

            if (empty($license_key) || empty($api_server)) {
                return false;
            }

            // Decrypt access token if needed
            $access_token = $account['access_token'] ?? '';
            if (empty($access_token) && !empty($account['access_token_encrypted'])) {
                $access_token = $social_chat->decrypt_value($account['access_token_encrypted']);
            }

            $platform_param = $platform === 'fb_comment' ? 'facebook' : 'instagram';
            $response = wp_remote_post($api_server . '/wp-json/rp/v1/social/comments/' . $parent_comment_id . '/reply', [
                'timeout' => 30,
                'headers' => ['Content-Type' => 'application/json'],
                'body' => wp_json_encode([
                    'message' => $message,
                    'access_token' => $access_token,
                    'platform' => $platform_param
                ])
            ]);

            if (is_wp_error($response)) {
                return false;
            }

            $response_code = wp_remote_retrieve_response_code($response);
            $response_body = wp_remote_retrieve_body($response);
            $result = json_decode($response_body, true);

            if ($response_code !== 200 || (isset($result['error']) && $result['error'])) {
                if (is_array($result) && !empty($result['error']) && !empty($result['message'])) {
                    $this->last_api_error_message = $result['message'];
                }
                return false;
            }

            // Get the reply ID from the response
            $reply_id = $result['id'] ?? null;
            if (empty($reply_id)) {
                return false;
            }

            // Save the message to database with reply_id in meta_data
            $social_chat = $this->helpmate->get_social_chat();
            $message_id = $social_chat->save_message([
                'conversation_id' => $conversation['id'],
                'external_id' => $reply_id,
                'direction' => 'outbound',
                'content' => $message,
                'message_type' => 'text',
                'sent_by' => $sent_by,
                'user_id' => $user_id,
                'meta_data' => ['reply_id' => $reply_id]
            ]);

            return $message_id ? true : false;
        }

        // Send via license-server → social-server
        $license_key = $this->helpmate->get_api()->get_key();
        $api_server = $this->helpmate->get_api()->get_api_server();

        if (empty($license_key) || empty($api_server)) {
            return false;
        }

        $response = wp_remote_post($api_server . '/wp-json/rp/v1/social/send-message', [
            'timeout' => 30,
            'headers' => [
                'Content-Type' => 'application/json'
            ],
            'body' => json_encode([
                'license_key' => $license_key,
                'page_id' => $account['page_id'],
                'recipient_id' => $recipient_id,
                'message' => $message,
                'platform' => $platform,
                'access_token' => $account['access_token'],
                'instagram_account_id' => $account['instagram_account_id'] ?? ''
            ])
        ]);

        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();

            // Save failed message
            $social_chat->save_message([
                'conversation_id' => $conversation['id'],
                'direction' => 'outbound',
                'content' => $message,
                'message_type' => 'text',
                'sent_by' => $sent_by,
                'user_id' => $user_id,
                'error_message' => $error_message
            ]);

            return false;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $result = json_decode($response_body, true);

        if ($response_code !== 200 || (isset($result['error']) && $result['error'])) {
            $error_message = $result['message'] ?? 'Failed to send message';

            // Save failed message
            $social_chat->save_message([
                'conversation_id' => $conversation['id'],
                'direction' => 'outbound',
                'content' => $message,
                'message_type' => 'text',
                'sent_by' => $sent_by,
                'user_id' => $user_id,
                'error_message' => $error_message
            ]);

            return false;
        }

        // Save successful message
        $message_id = $result['result']['message_id'] ?? ($result['result']['id'] ?? uniqid('msg_'));

        $social_chat->save_message([
            'conversation_id' => $conversation['id'],
            'external_id' => $message_id,
            'direction' => 'outbound',
            'content' => $message,
            'message_type' => 'text',
            'sent_by' => $sent_by,
            'user_id' => $user_id
        ]);

        return true;
    }

    /**
     * Send a manual reply (for human handoff).
     *
     * @since    1.2.0
     * @param    int       $conversation_id    The conversation ID.
     * @param    string    $message            The message to send.
     * @return   bool|WP_Error    True on success or error.
     */
    public function send_manual_reply(int $conversation_id, string $message)
    {
        global $wpdb;
        $conversations_table = esc_sql($wpdb->prefix . 'helpmate_social_conversations');
        $accounts_table = esc_sql($wpdb->prefix . 'helpmate_social_accounts');
        $social_chat = $this->helpmate->get_social_chat();

        // Get conversation with account
        $conversation = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Sensitive data that changes frequently, caching not appropriate
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
            return new WP_Error('not_found', __('Conversation not found.', 'helpmate-ai-chatbot'));
        }

        // Automatically set handoff to true when user manually replies
        $social_chat->toggle_handoff($conversation_id, true);

        $access_token = $social_chat->decrypt_value($conversation['access_token_encrypted']);
        $account = [
            'page_id' => $conversation['page_id'],
            'instagram_account_id' => $conversation['instagram_account_id'],
            'access_token' => $access_token
        ];

        // Get current WordPress user ID
        $user_id = get_current_user_id();

        // Check if this is the user's first message in this conversation
        if (!$social_chat->has_user_joined($conversation_id, $user_id)) {
            // Record the join
            $social_chat->record_team_member_join($conversation_id, 'social', $user_id);

            // Get user's first name for join notification
            $user = get_userdata($user_id);
            $user_first_name = $user && !empty($user->first_name) ? $user->first_name : ($user ? $user->display_name : __('Team member', 'helpmate-ai-chatbot'));

            // Send join notification message to customer
            $social_chat->send_join_notification_message($conversation_id, $user_first_name, $conversation['platform']);
        }

        $result = $this->send_response(
            $account,
            $conversation['platform'],
            $conversation['participant_id'],
            $message,
            $conversation,
            ['message_id' => ''], // No original message for manual replies
            $user_id
        );

        return $result
            ? true
            : new WP_Error(
                'send_failed',
                $this->last_api_error_message ?: __('Failed to send message.', 'helpmate-ai-chatbot')
            );
    }
}


