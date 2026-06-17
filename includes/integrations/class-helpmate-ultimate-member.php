<?php
/**
 * Ultimate Member integration helpers.
 *
 * @package Helpmate
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class Helpmate_Ultimate_Member
 */
class Helpmate_Ultimate_Member
{
	/**
	 * @var Helpmate
	 */
	private $helpmate;

	/**
	 * @var Helpmate_Integration_Events
	 */
	private $events;

	/**
	 * @var bool
	 */
	private $hooks_registered = false;

	/**
	 * @param Helpmate                    $helpmate Helpmate instance.
	 * @param Helpmate_Integration_Events $events   Event logger instance.
	 */
	public function __construct($helpmate, $events)
	{
		$this->helpmate = $helpmate;
		$this->events = $events;

		add_action('init', [$this, 'maybe_register_hooks'], 20);
	}

	/**
	 * Runtime check for Ultimate Member.
	 *
	 * @return bool
	 */
	public function is_active()
	{
		return class_exists('UM') || defined('ultimatemember_version') || function_exists('um_user');
	}

	/**
	 * Integration toggle (OFF by default).
	 *
	 * @return bool
	 */
	public function is_enabled()
	{
		$settings = $this->helpmate->get_settings()->get_setting('integrations', []);
		if (!is_array($settings) || empty($settings['ultimate_member']) || !is_array($settings['ultimate_member'])) {
			return false;
		}

		return !empty($settings['ultimate_member']['enabled']);
	}

	/**
	 * Register UM hooks only when UM is available and integration is enabled.
	 *
	 * @return void
	 */
	public function maybe_register_hooks()
	{
		if ($this->hooks_registered || !$this->is_active() || !$this->is_enabled()) {
			return;
		}

		add_action('um_user_register', [$this, 'on_user_register'], 10, 3);
		add_action('um_user_login', [$this, 'on_user_login'], 10, 2);
		add_action('um_after_user_updated', [$this, 'on_user_profile_updated'], 10, 3);
		add_action('um_after_user_account_updated', [$this, 'on_user_account_updated'], 10, 2);
		add_action('um_after_user_is_set_as_pending', [$this, 'on_status_pending'], 10, 1);
		add_action('um_after_user_is_approved', [$this, 'on_status_approved'], 10, 1);
		add_action('um_after_user_is_rejected', [$this, 'on_status_rejected'], 10, 1);
		add_action('um_after_user_is_inactive', [$this, 'on_status_inactive'], 10, 1);
		add_action('um_after_user_is_reactivated', [$this, 'on_status_reactivated'], 10, 1);
		add_action('um_after_user_role_is_updated', [$this, 'on_role_updated'], 10, 2);

		$this->hooks_registered = true;
	}

	/**
	 * REST status payload.
	 *
	 * @return array<string,mixed>
	 */
	public function get_rest_status()
	{
		$active = $this->is_active();
		$enabled = $this->is_enabled();

		return [
			'active' => $active,
			'enabled' => $enabled,
			'member_count' => $active ? (int) count_users()['total_users'] : 0,
		];
	}

	/**
	 * REST manual backfill entrypoint.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function rest_sync_members($request)
	{
		if (!$this->is_active()) {
			return new WP_REST_Response([
				'error' => true,
				'message' => __('Ultimate Member is not active.', 'helpmate-ai-chatbot'),
			], 400);
		}

		$limit = min(200, max(1, absint($request->get_param('limit') ?: 50)));
		$offset = max(0, absint($request->get_param('offset') ?: 0));

		$summary = [
			'processed' => 0,
			'created' => 0,
			'updated' => 0,
			'skipped_no_email' => 0,
			'errors' => [],
			'limit' => $limit,
			'offset' => $offset,
		];

		$users = get_users([
			'number' => $limit,
			'offset' => $offset,
			'orderby' => 'ID',
			'order' => 'ASC',
			'fields' => ['ID'],
		]);

		foreach ($users as $user) {
			$user_id = isset($user->ID) ? (int) $user->ID : 0;
			if ($user_id <= 0) {
				continue;
			}
			$outcome = $this->sync_member_to_crm($user_id, 'manual_backfill', ['manual_backfill' => '1']);
			++$summary['processed'];

			if (is_wp_error($outcome)) {
				$summary['errors'][] = [
					'user_id' => $user_id,
					'message' => $outcome->get_error_message(),
				];
				continue;
			}
			if (!empty($outcome['skipped_no_email'])) {
				++$summary['skipped_no_email'];
			}
			if (!empty($outcome['created'])) {
				++$summary['created'];
			}
			if (!empty($outcome['updated'])) {
				++$summary['updated'];
			}
		}

		return new WP_REST_Response([
			'error' => false,
			'summary' => $summary,
		], 200);
	}

	/**
	 * REST profile support payload for UM profile tab.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function rest_profile_support($request)
	{
		if (!$this->is_active()) {
			return new WP_REST_Response([
				'error' => false,
				'active' => false,
				'enabled' => $this->is_enabled(),
				'data' => [],
			], 200);
		}

		$current_user_id = get_current_user_id();
		$requested_user_id = absint($request->get_param('user_id') ?: $current_user_id);
		if ($requested_user_id <= 0) {
			return new WP_REST_Response([
				'error' => true,
				'message' => __('A valid user is required.', 'helpmate-ai-chatbot'),
			], 400);
		}

		if ($requested_user_id !== (int) $current_user_id && !current_user_can('edit_users')) {
			return new WP_REST_Response([
				'error' => true,
				'message' => __('You are not allowed to view this profile support data.', 'helpmate-ai-chatbot'),
			], 403);
		}

		$user = get_userdata($requested_user_id);
		if (!$user instanceof WP_User) {
			return new WP_REST_Response([
				'error' => true,
				'message' => __('User not found.', 'helpmate-ai-chatbot'),
			], 404);
		}

		$crm = $this->helpmate->get_crm();
		$ticket = $this->helpmate->get_ticket();
		$email = sanitize_email((string) $user->user_email);
		$contact = $email !== '' ? $crm->get_contact_by_email($email) : null;
		$contact_id = !empty($contact['id']) ? (int) $contact['id'] : null;
		$tickets = [];

		if ($contact_id) {
			$tickets_response = $ticket->get_all_tickets(1, 10, $contact_id);
			if ($tickets_response instanceof WP_REST_Response) {
				$tickets_data = (array) $tickets_response->get_data();
				$tickets = isset($tickets_data['data']['tickets']) && is_array($tickets_data['data']['tickets'])
					? $tickets_data['data']['tickets']
					: [];
			}
		}

		return new WP_REST_Response([
			'error' => false,
			'active' => true,
			'enabled' => $this->is_enabled(),
			'data' => [
				'user_id' => (int) $user->ID,
				'email' => $email,
				'display_name' => (string) $user->display_name,
				'contact_id' => $contact_id,
				'tickets' => $tickets,
			],
		], 200);
	}

	/**
	 * Hook handlers.
	 */
	public function on_user_register($user_id, $submitted_data = [], $form_data = null)
	{
		$this->record_and_sync((int) $user_id, 'user_register', $submitted_data, $form_data);
	}

	public function on_user_login($submitted_data = [], $form_data = null)
	{
		$user_id = 0;
		if (function_exists('um_user') && is_array($submitted_data) && !empty($submitted_data['username'])) {
			$user = get_user_by('login', sanitize_user((string) $submitted_data['username']));
			if ($user instanceof WP_User) {
				$user_id = (int) $user->ID;
			}
		}
		if ($user_id <= 0) {
			$user_id = (int) get_current_user_id();
		}
		if ($user_id <= 0) {
			return;
		}

		update_user_meta($user_id, 'helpmate_um_last_login_at', gmdate('Y-m-d H:i:s'));
		$this->record_and_sync($user_id, 'user_login', $submitted_data, $form_data);
	}

	public function on_user_profile_updated($user_id, $args = [], $to_update = [])
	{
		$this->record_and_sync((int) $user_id, 'profile_updated', $args, $to_update);
	}

	public function on_user_account_updated($user_id, $changes = [])
	{
		$this->record_and_sync((int) $user_id, 'account_updated', $changes, null);
	}

	public function on_status_pending($user_id)
	{
		$this->record_and_sync((int) $user_id, 'status_pending');
	}

	public function on_status_approved($user_id)
	{
		$this->record_and_sync((int) $user_id, 'status_approved');
	}

	public function on_status_rejected($user_id)
	{
		$this->record_and_sync((int) $user_id, 'status_rejected');
	}

	public function on_status_inactive($user_id)
	{
		$this->record_and_sync((int) $user_id, 'status_inactive');
	}

	public function on_status_reactivated($user_id)
	{
		$this->record_and_sync((int) $user_id, 'status_reactivated');
	}

	public function on_role_updated($user_id, $role)
	{
		$this->record_and_sync((int) $user_id, 'role_updated', ['role' => sanitize_key((string) $role)], null);
	}

	/**
	 * Log event and sync to CRM with dedup safety.
	 *
	 * @param int   $user_id        User ID.
	 * @param string $action        Action key.
	 * @param array $submitted_data Submitted payload.
	 * @param mixed $form_data      Form data payload.
	 * @return void
	 */
	private function record_and_sync($user_id, $action, $submitted_data = [], $form_data = null)
	{
		if ($user_id <= 0) {
			return;
		}

		$dedup_key = hash('sha256', (string) $user_id . ':' . $action . ':' . gmdate('Y-m-d H:i'));
		if ($this->events->is_duplicate('ultimate_member', $action, $dedup_key, 30)) {
			return;
		}

		$context = [
			'integration' => 'ultimate_member',
			'source' => 'ultimate_member',
			'action' => $action,
			'status' => 'accepted',
			'dedup_key' => $dedup_key,
			'metadata' => [
				'user_id' => (string) $user_id,
				'request_id' => wp_generate_uuid4(),
			],
		];
		$this->events->record_event($context);

		$result = $this->sync_member_to_crm($user_id, $action, [], $submitted_data, $form_data);
		if (is_wp_error($result)) {
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_terminal',
				'error_code' => sanitize_key((string) $result->get_error_code()),
				'error_message' => sanitize_text_field((string) $result->get_error_message()),
			]));
			return;
		}

		$this->events->record_event(array_merge($context, [
			'status' => 'processed',
		]));
	}

	/**
	 * Sync one UM member into CRM.
	 *
	 * @param int    $user_id         User ID.
	 * @param string $action          Action key.
	 * @param array  $meta            Extra metadata.
	 * @param array  $submitted_data  Submitted payload.
	 * @param mixed  $form_data       Form payload.
	 * @return array<string,mixed>|WP_Error
	 */
	private function sync_member_to_crm($user_id, $action, array $meta = [], array $submitted_data = [], $form_data = null)
	{
		$user = get_userdata($user_id);
		if (!$user instanceof WP_User) {
			return new WP_Error('user_not_found', __('User not found for Ultimate Member sync.', 'helpmate-ai-chatbot'));
		}

		$email = sanitize_email((string) $user->user_email);
		if ($email === '') {
			return ['skipped_no_email' => true];
		}

		$crm = $this->helpmate->get_crm();
		$data = [
			'email' => $email,
			'first_name' => sanitize_text_field((string) get_user_meta($user_id, 'first_name', true)),
			'last_name' => sanitize_text_field((string) get_user_meta($user_id, 'last_name', true)),
			'phone' => sanitize_text_field((string) get_user_meta($user_id, 'phone_number', true)),
			'wp_user_id' => (int) $user_id,
			'status' => 'Subscribed',
		];
		if ($data['first_name'] === '' && $user->display_name !== '') {
			$data['first_name'] = sanitize_text_field((string) $user->display_name);
		}

		$result = $crm->upsert_contact_from_ultimate_member($data);
		if (is_wp_error($result)) {
			return $result;
		}
		$contact_id = !empty($result['id']) ? (int) $result['id'] : 0;
		if ($contact_id <= 0) {
			return new WP_Error('sync_failed', __('Failed to sync member to CRM.', 'helpmate-ai-chatbot'));
		}

		$snapshot = $this->build_member_snapshot($user, $action, $meta, $submitted_data, $form_data);
		$crm->save_contact_ultimate_member_snapshot($contact_id, $snapshot);
		$crm->add_contact_sync_source($contact_id, 'ultimate_member');

		return $result;
	}

	/**
	 * Build UM snapshot payload for CRM fields.
	 *
	 * @param WP_User $user           User.
	 * @param string  $action         Action key.
	 * @param array   $meta           Extra metadata.
	 * @param array   $submitted_data Submitted payload.
	 * @param mixed   $form_data      Form payload.
	 * @return array<string,mixed>
	 */
	private function build_member_snapshot($user, $action, array $meta = [], array $submitted_data = [], $form_data = null)
	{
		$user_id = (int) $user->ID;
		$roles = is_array($user->roles) ? array_values($user->roles) : [];
		$primary_role = !empty($roles[0]) ? sanitize_key((string) $roles[0]) : '';
		$status = sanitize_key((string) get_user_meta($user_id, 'account_status', true));
		$registered_at = !empty($user->user_registered) ? sanitize_text_field((string) $user->user_registered) : '';
		$last_login = sanitize_text_field((string) get_user_meta($user_id, 'helpmate_um_last_login_at', true));

		$registration_form = '';
		if (isset($meta['registration_form']) && $meta['registration_form'] !== '') {
			$registration_form = sanitize_text_field((string) $meta['registration_form']);
		} elseif (is_array($submitted_data) && !empty($submitted_data['form_id'])) {
			$registration_form = sanitize_text_field((string) $submitted_data['form_id']);
		} elseif (is_array($form_data) && !empty($form_data['form_id'])) {
			$registration_form = sanitize_text_field((string) $form_data['form_id']);
		}

		$profile_completeness = get_user_meta($user_id, 'profile_completeness', true);
		$profile_completed = is_numeric($profile_completeness) ? ((int) $profile_completeness >= 100) : false;
		if (!$profile_completed) {
			$profile_completed = ($status === 'approved');
		}

		return [
			'account_status' => $status,
			'primary_role' => $primary_role,
			'registered_at' => $registered_at,
			'last_login_at' => $last_login,
			'registration_form' => $registration_form,
			'profile_completed' => $profile_completed ? 1 : 0,
			'action' => sanitize_key($action),
		];
	}
}

