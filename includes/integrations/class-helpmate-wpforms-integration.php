<?php

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_WPForms_Integration
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
	 * Pending sanitized order payload keyed by WPForms form id.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	private $pending_order_status = [];

	/**
	 * Submission blocks keyed by WPForms form id.
	 *
	 * @var array<int, string>
	 */
	private $blocked_submissions = [];

	public function __construct($helpmate, $events)
	{
		$this->helpmate = $helpmate;
		$this->events = $events;

		add_action('wpforms_process', [$this, 'handle_submission'], 20, 3);
		add_filter('wpforms_process_after_filter', [$this, 'enforce_submission_block'], 999, 3);
		add_filter('wpforms_frontend_confirmation_message', [$this, 'filter_confirmation_message'], 20, 4);
		add_action('wp_enqueue_scripts', [$this, 'enqueue_wpforms_order_status_script'], 1000);
	}

	public function get_admin_forms_payload()
	{
		$post_type_obj = get_post_type_object('wpforms');
		if (!$post_type_obj || !post_type_exists('wpforms')) {
			return new WP_REST_Response([
				'error' => false,
				'installed' => false,
				'actions' => $this->get_action_definitions(),
				'forms' => [],
			], 200);
		}

		$saved_settings = $this->helpmate->get_settings()->get_setting('wpforms_integrations', []);
		$saved_forms = isset($saved_settings['forms']) && is_array($saved_settings['forms']) ? $saved_settings['forms'] : [];
		$wpforms = get_posts([
			'post_type' => 'wpforms',
			'post_status' => 'publish',
			'posts_per_page' => -1,
			'orderby' => 'date',
			'order' => 'DESC',
			'fields' => 'ids',
		]);

		$forms = [];
		foreach ((array) $wpforms as $form_id_raw) {
			$form_id = absint($form_id_raw);
			if ($form_id <= 0) {
				continue;
			}
			$saved_form = isset($saved_forms[$form_id]) && is_array($saved_forms[$form_id]) ? $saved_forms[$form_id] : [];
			$forms[] = [
				'id' => $form_id,
				'title' => sanitize_text_field(get_the_title($form_id) ?: ('Form #' . $form_id)),
				'fields' => $this->extract_form_fields($form_id),
				'config' => [
					'enabled' => !empty($saved_form['enabled']),
					'action' => !empty($saved_form['action']) ? sanitize_key($saved_form['action']) : '',
					'field_map' => isset($saved_form['field_map']) && is_array($saved_form['field_map']) ? $saved_form['field_map'] : [],
				],
			];
		}

		return new WP_REST_Response([
			'error' => false,
			'installed' => true,
			'actions' => $this->get_action_definitions(),
			'forms' => $forms,
		], 200);
	}

	public function handle_submission($fields, $entry, $form_data = [])
	{
		$form_id = isset($form_data['id']) ? absint($form_data['id']) : 0;
		if ($form_id <= 0) {
			return;
		}

		unset($this->pending_order_status[$form_id]);
		unset($this->blocked_submissions[$form_id]);

		$config = $this->get_form_config($form_id);
		if (empty($config) || empty($config['enabled'])) {
			return;
		}

		$action = !empty($config['action']) ? sanitize_key((string) $config['action']) : '';
		if ($action === '') {
			return;
		}

		$posted_map = $this->normalize_wpforms_fields($fields);
		$field_map = isset($config['field_map']) && is_array($config['field_map']) ? $config['field_map'] : [];
		$payload = $this->build_payload($action, $field_map, $posted_map);

		$context = [
			'integration' => 'wpforms',
			'source' => 'wpforms',
			'form_id' => $form_id,
			'action' => $action,
			'metadata' => ['route_mode' => 'settings'],
		];
		$context['payload_hash'] = hash('sha256', wp_json_encode($payload));
		$context['dedup_key'] = hash('sha256', $form_id . ':' . $action . ':' . $context['payload_hash']);

		$required_missing = $this->get_missing_required_fields($action, $payload);
		if (!empty($required_missing)) {
			$user_message = $this->get_missing_fields_user_message($action, $required_missing);
			$this->events->record_event(array_merge($context, [
				'status' => 'rejected_validation',
				'error_code' => 'missing_required_fields',
				'error_message' => $user_message,
				'metadata' => ['missing_fields' => $required_missing, 'validation_fields' => $required_missing],
			]));
			$this->block_submission($form_id, $user_message);
			return;
		}

		if ($this->is_pro_action($action) && !$this->is_pro_available()) {
			$message = __('This form action requires Helpmate Pro.', 'helpmate-ai-chatbot');
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_terminal',
				'error_code' => 'pro_required',
				'error_message' => $message,
				'metadata' => ['pro_required' => '1'],
			]));
			$this->block_submission($form_id, $message);
			return;
		}

		// Skip dedup for order status checks: repeat lookups for the same order id are expected.
		if ($action !== 'order_status_checking' && $this->events->is_duplicate('wpforms', $action, $context['dedup_key'], 300)) {
			$dup_message = __('This submission was already received. Please wait a moment before trying again.', 'helpmate-ai-chatbot');
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_terminal',
				'error_code' => 'duplicate_submission',
				'error_message' => $dup_message,
				'metadata' => ['route_mode' => 'settings', 'dedup_window_seconds' => '300'],
			]));
			$this->block_submission($form_id, $dup_message);
			return;
		}

		$this->events->record_event(array_merge($context, ['status' => 'accepted']));
		$this->events->record_event(array_merge($context, ['status' => 'validated']));

		try {
			$response = $this->dispatch_action($action, $payload, $context);
			if ($response instanceof WP_Error) {
				$this->events->record_event(array_merge($context, [
					'status' => 'failed_terminal',
					'error_code' => $response->get_error_code(),
					'error_message' => $response->get_error_message(),
				]));
				$this->block_submission($form_id, $response->get_error_message());
				return;
			}

			if ($response instanceof WP_REST_Response) {
				$data = (array) $response->get_data();
				$is_error = !empty($data['error']) || $response->get_status() >= 400;
				if ($is_error) {
					$message = !empty($data['message']) ? sanitize_text_field((string) $data['message']) : __('Integration failed.', 'helpmate-ai-chatbot');
					$this->events->record_event(array_merge($context, [
						'status' => 'failed_terminal',
						'error_code' => 'dispatch_failed',
						'error_message' => $message,
					]));
					$this->block_submission($form_id, $message);
					return;
				}

				if ($action === 'order_status_checking') {
					$order_raw = isset($data['data']) && is_array($data['data']) ? $data['data'] : null;
					if ($order_raw && $this->is_valid_order_payload($order_raw)) {
						$this->pending_order_status[$form_id] = $this->sanitize_order_for_feedback($order_raw);
					}
				}
			}

			$this->events->record_event(array_merge($context, ['status' => 'processed']));
		} catch (Exception $exception) {
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_transient',
				'error_code' => 'exception',
				'error_message' => $exception->getMessage(),
			]));
			$this->block_submission($form_id, __('Submission failed due to an integration error.', 'helpmate-ai-chatbot'));
		}
	}

	/**
	 * Re-assert blocked submission errors at WPForms' final pre-save filter.
	 *
	 * @param array $fields
	 * @param array $entry
	 * @param array $form_data
	 * @return array
	 */
	public function enforce_submission_block($fields, $entry, $form_data)
	{
		$form_id = isset($form_data['id']) ? absint($form_data['id']) : 0;
		if ($form_id <= 0 || empty($this->blocked_submissions[$form_id])) {
			return $fields;
		}

		$this->append_wpforms_header_error($form_id, $this->blocked_submissions[$form_id]);
		return $fields;
	}

	public function filter_confirmation_message($message, $form_data = [], $fields = [], $entry_id = 0)
	{
		$form_id = isset($form_data['id']) ? absint($form_data['id']) : 0;
		if ($form_id <= 0 || !isset($this->pending_order_status[$form_id])) {
			return $message;
		}

		$order = $this->pending_order_status[$form_id];
		unset($this->pending_order_status[$form_id]);

		$payload_json = wp_json_encode($order);
		if (!is_string($payload_json) || $payload_json === '') {
			return $message;
		}

		$container = sprintf(
			'<div class="helpmate-wpforms-order-status-payload" data-helpmate-order-status="%1$s" data-helpmate-order-status-form-id="%2$d"></div>',
			esc_attr($payload_json),
			$form_id
		);
		$card_html = $this->render_order_status_card_html($order, $form_id);

		/**
		 * WPForms success message when Helpmate order-status card exists.
		 * Default empty to avoid duplicate visible status blocks.
		 *
		 * @param string               $confirmation Default empty message.
		 * @param array<string,mixed>  $order        Sanitized order payload.
		 * @param int                  $form_id      WPForms form id.
		 * @param mixed                $form_data    WPForms form data.
		 */
		$confirmation = (string) apply_filters('helpmate_wpforms_order_status_response_message', '', $order, $form_id, $form_data);

		return $confirmation . $container . $card_html;
	}

	public function enqueue_wpforms_order_status_script()
	{
		if (is_admin()) {
			return;
		}

		if (!defined('HELPMATE_URL') || !defined('HELPMATE_VERSION')) {
			return;
		}

		$load = (bool) apply_filters('helpmate_wpforms_order_status_enqueue_script', true);
		if (!$load) {
			return;
		}

		wp_enqueue_script(
			'helpmate-wpforms-order-status',
			HELPMATE_URL . 'public/js/helpmate-wpforms-order-status.js',
			['jquery'],
			HELPMATE_VERSION,
			true
		);

		wp_localize_script(
			'helpmate-wpforms-order-status',
			'helpmateWpformsOrderStatus',
			[
				'labels' => [
					'order' => __('Order', 'helpmate-ai-chatbot'),
					'orderDate' => __('Order date', 'helpmate-ai-chatbot'),
					'tracking' => __('Tracking', 'helpmate-ai-chatbot'),
					'estimatedDelivery' => __('Estimated delivery', 'helpmate-ai-chatbot'),
					'items' => __('Items', 'helpmate-ai-chatbot'),
					'shippingAddress' => __('Shipping address', 'helpmate-ai-chatbot'),
				],
			]
		);
	}

	private function get_action_definitions()
	{
		if (!method_exists($this->helpmate, 'get_cf7_integration')) {
			return [];
		}

		$cf7 = $this->helpmate->get_cf7_integration();
		if ($cf7 && method_exists($cf7, 'get_action_definitions')) {
			return $cf7->get_action_definitions();
		}

		return [];
	}

	private function get_form_config($form_id)
	{
		$settings = $this->helpmate->get_settings()->get_setting('wpforms_integrations', []);
		$forms = isset($settings['forms']) && is_array($settings['forms']) ? $settings['forms'] : [];
		return isset($forms[$form_id]) && is_array($forms[$form_id]) ? $forms[$form_id] : [];
	}

	private function append_wpforms_header_error($form_id, $message)
	{
		$has_wpforms_fn = function_exists('wpforms');
		$wpforms_instance = $has_wpforms_fn ? wpforms() : null;
		$process_via_magic = ($wpforms_instance && isset($wpforms_instance->process)) ? $wpforms_instance->process : null;
		$process_via_obj = ($wpforms_instance && method_exists($wpforms_instance, 'obj')) ? $wpforms_instance->obj('process') : null;
		$process = is_object($process_via_obj) ? $process_via_obj : (is_object($process_via_magic) ? $process_via_magic : null);

		if (!is_object($process)) {
			return;
		}
		if (!isset($process->errors[$form_id]) || !is_array($process->errors[$form_id])) {
			$process->errors[$form_id] = [];
		}
		$sanitized = sanitize_text_field((string) $message);
		$process->errors[$form_id]['header'] = $sanitized;
		if (empty($process->errors[$form_id]['footer'])) {
			$process->errors[$form_id]['footer'] = $sanitized;
		}
	}

	private function block_submission($form_id, $message)
	{
		$sanitized = sanitize_text_field((string) $message);
		$this->blocked_submissions[(int) $form_id] = $sanitized;
		$this->append_wpforms_header_error($form_id, $sanitized);
	}

	/**
	 * @param array<int, mixed> $fields
	 * @return array<string, mixed>
	 */
	private function normalize_wpforms_fields($fields)
	{
		$out = [];
		foreach ((array) $fields as $field) {
			if (!is_array($field)) {
				continue;
			}
			$source = '';
			if (!empty($field['name'])) {
				$source = sanitize_text_field((string) $field['name']);
			} elseif (isset($field['id'])) {
				$source = 'field_' . absint($field['id']);
			}
			if ($source === '') {
				continue;
			}

			$value = isset($field['value_raw']) ? $field['value_raw'] : (isset($field['value']) ? $field['value'] : null);
			$out[$source] = $value;
		}

		return $out;
	}

	private function build_payload($action, array $field_map, array $posted_map)
	{
		$payload = ['source' => 'wpforms'];

		foreach ($field_map as $target => $source) {
			if (!is_string($target) || !is_string($source)) {
				continue;
			}
			$target_key = sanitize_key($target);
			if ($target_key === '' || !array_key_exists($source, $posted_map)) {
				continue;
			}

			$value = $posted_map[$source];
			if ($target_key === 'scheduled_date') {
				$value = $this->normalize_wpforms_scheduled_date($value);
			} elseif ($target_key === 'scheduled_time') {
				$value = $this->normalize_wpforms_scheduled_time($value);
			} elseif (is_array($value)) {
				$flat = [];
				array_walk_recursive($value, function ($item) use (&$flat) {
					$s = sanitize_text_field((string) $item);
					if (trim($s) !== '') {
						$flat[] = $s;
					}
				});
				$value = implode(', ', $flat);
			}

			$payload[$target_key] = is_string($value) ? sanitize_textarea_field($value) : $value;
		}

		if ($action === 'ticket_creation' && empty($payload['priority'])) {
			$payload['priority'] = 'normal';
		}

		return $payload;
	}

	private function normalize_wpforms_scheduled_date($value)
	{
		if ($value === null || $value === '') {
			return '';
		}
		$s = trim((string) $value);
		if ($s === '') {
			return '';
		}
		if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
			return $s;
		}

		$formats = ['m/d/Y', 'n/j/Y', 'd/m/Y', 'j/n/Y', 'm-d-Y', 'd-m-Y', 'Y/m/d'];
		foreach ($formats as $fmt) {
			$dt = \DateTimeImmutable::createFromFormat($fmt, $s);
			if ($dt instanceof \DateTimeImmutable) {
				$err = \DateTimeImmutable::getLastErrors();
				if (is_array($err) && (int) $err['warning_count'] === 0 && (int) $err['error_count'] === 0) {
					return $dt->format('Y-m-d');
				}
			}
		}

		$ts = strtotime($s);
		return $ts === false ? '' : wp_date('Y-m-d', $ts);
	}

	private function normalize_wpforms_scheduled_time($value)
	{
		if ($value === null || $value === '') {
			return '';
		}
		$s = trim((string) $value);
		if ($s === '') {
			return '';
		}

		if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i', $s, $m)) {
			$hour = (int) $m[1];
			$minute = (int) $m[2];
			$sec = isset($m[3]) && $m[3] !== '' ? (int) $m[3] : 0;
			$meridiem = isset($m[4]) ? strtolower($m[4]) : '';
			if ($meridiem === 'pm' && $hour < 12) {
				$hour += 12;
			}
			if ($meridiem === 'am' && $hour === 12) {
				$hour = 0;
			}
			if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59 || $sec < 0 || $sec > 59) {
				return '';
			}
			return sprintf('%02d:%02d:%02d', $hour, $minute, $sec);
		}

		return $s;
	}

	private function dispatch_action($action, array $payload, array $context)
	{
		if ($action === 'lead_collection') {
			return $this->helpmate->get_leads()->create_lead($this->normalize_lead_collection_payload($payload));
		}

		if ($action === 'ticket_creation') {
			return $this->helpmate->get_ticket()->create_ticket($payload);
		}

		if ($this->is_pro_action($action)) {
			$result = apply_filters('helpmate_wpforms_pro_dispatch', null, $action, $payload, $context);
			if ($result === null) {
				return new WP_Error('wpforms_pro_handler_missing', __('Pro integration handler is not available.', 'helpmate-ai-chatbot'));
			}
			return $result;
		}

		return new WP_Error('wpforms_unknown_action', __('Unknown integration action.', 'helpmate-ai-chatbot'));
	}

	private function normalize_lead_collection_payload(array $payload)
	{
		$metadata = [];
		if (!empty($payload['email']) && is_string($payload['email'])) {
			$em = sanitize_email($payload['email']);
			if ($em !== '') {
				$metadata['email'] = $em;
			}
		}
		if (!empty($payload['phone']) && is_string($payload['phone'])) {
			$metadata['phone'] = sanitize_text_field($payload['phone']);
		}
		if (!empty($payload['message']) && is_string($payload['message'])) {
			$metadata['message'] = sanitize_textarea_field($payload['message']);
		}
		if (!empty($payload['company']) && is_string($payload['company'])) {
			$metadata['company'] = sanitize_text_field($payload['company']);
		}
		if (!empty($payload['website']) && is_string($payload['website'])) {
			$url = esc_url_raw($payload['website']);
			if ($url !== '') {
				$metadata['website'] = $url;
			}
		}

		$name = isset($payload['name']) && is_string($payload['name']) ? sanitize_text_field($payload['name']) : '';
		$source = isset($payload['source']) && is_string($payload['source']) ? sanitize_text_field($payload['source']) : 'wpforms';

		return [
			'name' => $name,
			'source' => $source,
			'metadata' => $metadata,
		];
	}

	private function get_missing_required_fields($action, array $payload)
	{
		$def = null;
		foreach ($this->get_action_definitions() as $row) {
			if (isset($row['id']) && $row['id'] === $action) {
				$def = $row;
				break;
			}
		}

		$needed = ($def && !empty($def['required_fields']) && is_array($def['required_fields'])) ? $def['required_fields'] : [];
		$missing = [];
		foreach ($needed as $field) {
			if (!isset($payload[$field]) || $this->is_empty_payload_value($payload[$field])) {
				$missing[] = $field;
			}
		}

		if ($action === 'order_status_checking' && !empty($def['verification_contact_required'])) {
			$email_missing = !isset($payload['email']) || $this->is_empty_payload_value($payload['email']);
			$phone_missing = !isset($payload['phone']) || $this->is_empty_payload_value($payload['phone']);
			if ($email_missing && $phone_missing) {
				$missing[] = 'email_or_phone';
			}
		}

		return array_values(array_unique($missing));
	}

	private function get_field_labels_for_action($action)
	{
		$map = [];
		foreach ($this->get_action_definitions() as $row) {
			if (empty($row['id']) || $row['id'] !== $action) {
				continue;
			}
			if (empty($row['mappable_fields']) || !is_array($row['mappable_fields'])) {
				return $map;
			}
			foreach ($row['mappable_fields'] as $mf) {
				if (!empty($mf['key']) && isset($mf['label']) && $mf['label'] !== '') {
					$map[(string) $mf['key']] = (string) $mf['label'];
				}
			}
			return $map;
		}

		return $map;
	}

	private function humanize_field_key($key)
	{
		$key = sanitize_key($key);
		if ($key === '') {
			return '';
		}

		return ucwords(str_replace('_', ' ', $key));
	}

	private function get_missing_fields_user_message($action, array $missing)
	{
		$missing = array_values(array_unique(array_filter(array_map('strval', $missing))));
		if ($missing === []) {
			return __('Please check the form and try again.', 'helpmate-ai-chatbot');
		}

		$label_map = $this->get_field_labels_for_action($action);
		$labels = [];

		foreach ($missing as $key) {
			if ($key === 'email_or_phone') {
				$labels[] = __('email or phone number (required to verify your order)', 'helpmate-ai-chatbot');
				continue;
			}
			if (isset($label_map[$key])) {
				$labels[] = $label_map[$key];
				continue;
			}
			$h = $this->humanize_field_key($key);
			if ($h !== '') {
				$labels[] = $h;
			}
		}

		$labels = array_values(array_unique(array_filter($labels)));
		if ($labels === []) {
			return __('Please check the form and try again.', 'helpmate-ai-chatbot');
		}

		$list = implode(', ', $labels);

		/* translators: %s: Comma-separated list of field labels the visitor should complete. */
		$format = __('Please complete or correct the following: %s.', 'helpmate-ai-chatbot');

		return sprintf($format, $list);
	}

	private function is_pro_action($action)
	{
		$action = sanitize_key((string) $action);
		foreach ($this->get_action_definitions() as $def) {
			if (!empty($def['id']) && (string) $def['id'] === $action) {
				return isset($def['tier']) && $def['tier'] === 'pro';
			}
		}
		return false;
	}

	private function is_pro_available()
	{
		if (!method_exists($this->helpmate, 'get_cf7_integration')) {
			return false;
		}

		$cf7 = $this->helpmate->get_cf7_integration();
		if ($cf7 && method_exists($cf7, 'is_pro_available')) {
			return (bool) $cf7->is_pro_available();
		}

		return false;
	}

	private function is_valid_order_payload(array $raw)
	{
		$oid = isset($raw['orderId']) ? trim((string) $raw['orderId']) : '';
		$st = isset($raw['status']) ? trim((string) $raw['status']) : '';
		return $oid !== '' || $st !== '';
	}

	private function sanitize_order_for_feedback(array $raw)
	{
		$out = [
			'orderId' => isset($raw['orderId']) ? sanitize_text_field((string) $raw['orderId']) : '',
			'status' => isset($raw['status']) ? sanitize_text_field((string) $raw['status']) : '',
			'date' => isset($raw['date']) ? sanitize_text_field((string) $raw['date']) : '',
			'trackingNumber' => isset($raw['trackingNumber']) ? sanitize_text_field((string) $raw['trackingNumber']) : '',
			'estimatedDelivery' => isset($raw['estimatedDelivery']) ? sanitize_text_field((string) $raw['estimatedDelivery']) : '',
			'shippingAddress' => isset($raw['shippingAddress']) ? $this->strip_tags_decode_entities((string) $raw['shippingAddress']) : '',
			'items' => [],
		];

		if (!empty($raw['items']) && is_array($raw['items'])) {
			foreach ($raw['items'] as $item) {
				if (!is_array($item)) {
					continue;
				}
				$out['items'][] = [
					'name' => isset($item['name']) ? sanitize_text_field((string) $item['name']) : '',
					'quantity' => isset($item['quantity']) ? (int) $item['quantity'] : 0,
					'price' => isset($item['price']) ? $this->strip_tags_decode_entities((string) $item['price']) : '',
				];
			}
		}

		return $out;
	}

	/**
	 * Determine whether a mapped payload value is effectively empty.
	 *
	 * @param mixed $value
	 * @return bool
	 */
	private function is_empty_payload_value($value)
	{
		if ($value === null) {
			return true;
		}
		if (is_string($value)) {
			return trim($value) === '';
		}
		if (is_array($value)) {
			foreach ($value as $item) {
				if (!$this->is_empty_payload_value($item)) {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	private function strip_tags_decode_entities($html)
	{
		$plain = wp_strip_all_tags($html);
		return html_entity_decode($plain, ENT_QUOTES | ENT_HTML5, 'UTF-8');
	}

	/**
	 * Render a server-side fallback order-status card for WPForms confirmation.
	 *
	 * @param array<string, mixed> $order
	 * @param int                  $form_id
	 * @return string
	 */
	private function render_order_status_card_html(array $order, $form_id)
	{
		$order_id = isset($order['orderId']) ? sanitize_text_field((string) $order['orderId']) : '';
		$status = isset($order['status']) ? sanitize_text_field((string) $order['status']) : '';
		$date = isset($order['date']) ? sanitize_text_field((string) $order['date']) : '';
		$tracking = isset($order['trackingNumber']) ? sanitize_text_field((string) $order['trackingNumber']) : '';
		$eta = isset($order['estimatedDelivery']) ? sanitize_text_field((string) $order['estimatedDelivery']) : '';
		$shipping = isset($order['shippingAddress']) ? sanitize_textarea_field((string) $order['shippingAddress']) : '';
		$items = isset($order['items']) && is_array($order['items']) ? $order['items'] : [];

		$status_key = strtolower($status);
		$badge_bg = '#e2e8f0';
		$badge_color = '#475569';
		if ($status_key === 'delivered') {
			$badge_bg = '#bbf7d0';
			$badge_color = '#166534';
		} elseif ($status_key === 'shipped') {
			$badge_bg = '#bfdbfe';
			$badge_color = '#1e40af';
		} elseif ($status_key === 'processing') {
			$badge_bg = '#fed7aa';
			$badge_color = '#c2410c';
		} elseif ($status_key === 'cancelled') {
			$badge_bg = '#fecaca';
			$badge_color = '#991b1b';
		}

		ob_start();
		?>
		<div
			class="helpmate-wpforms-order-card helpmate-cf7-order-status"
			data-helpmate-form-id="<?php echo esc_attr((string) absint($form_id)); ?>"
			role="status"
			aria-live="polite"
			style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;"
		>
			<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
				<div style="font-weight:600;"><?php echo esc_html(sprintf('%s %s', __('Order', 'helpmate-ai-chatbot'), $order_id)); ?></div>
				<span style="font-size:.75rem;padding:2px 8px;border-radius:999px;font-weight:600;background:<?php echo esc_attr($badge_bg); ?>;color:<?php echo esc_attr($badge_color); ?>;">
					<?php echo esc_html($status); ?>
				</span>
			</div>
			<div style="padding:12px;background:#f1f5f9;">
				<?php if ($date !== '') : ?>
					<p style="margin:0 0 .35em 0;font-size:.875rem;"><span style="color:#64748b;"><?php esc_html_e('Order date', 'helpmate-ai-chatbot'); ?>: </span><span style="color:#334155;"><?php echo esc_html($date); ?></span></p>
				<?php endif; ?>
				<?php if ($tracking !== '') : ?>
					<p style="margin:0 0 .35em 0;font-size:.875rem;"><span style="color:#64748b;"><?php esc_html_e('Tracking', 'helpmate-ai-chatbot'); ?>: </span><span style="color:#334155;"><?php echo esc_html($tracking); ?></span></p>
				<?php endif; ?>
				<?php if ($eta !== '') : ?>
					<p style="margin:0 0 .35em 0;font-size:.875rem;"><span style="color:#64748b;"><?php esc_html_e('Estimated delivery', 'helpmate-ai-chatbot'); ?>: </span><span style="color:#334155;"><?php echo esc_html($eta); ?></span></p>
				<?php endif; ?>
				<?php if (!empty($items)) : ?>
					<p style="margin:8px 0 4px 0;font-size:.75rem;color:#64748b;"><?php esc_html_e('Items', 'helpmate-ai-chatbot'); ?></p>
					<ul style="margin:0;padding-left:1.25em;font-size:.875rem;">
						<?php foreach ($items as $item) : ?>
							<?php
							$item_name = isset($item['name']) ? sanitize_text_field((string) $item['name']) : '';
							$item_qty = isset($item['quantity']) ? (int) $item['quantity'] : 0;
							$item_price = isset($item['price']) ? sanitize_text_field((string) $item['price']) : '';
							?>
							<li style="margin-bottom:4px;"><?php echo esc_html(sprintf('%1$dx %2$s - %3$s', $item_qty, $item_name, $item_price)); ?></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>
				<?php if ($shipping !== '') : ?>
					<p style="margin:10px 0 4px 0;font-size:.75rem;color:#64748b;"><?php esc_html_e('Shipping address', 'helpmate-ai-chatbot'); ?></p>
					<p style="margin:0;font-size:.875rem;color:#334155;white-space:pre-line;"><?php echo esc_html($shipping); ?></p>
				<?php endif; ?>
			</div>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	private function extract_form_fields($form_id)
	{
		$post = get_post($form_id);
		if (!$post || !isset($post->post_content)) {
			return [];
		}

		$decoded = json_decode((string) $post->post_content, true);
		if (!is_array($decoded) || empty($decoded['fields']) || !is_array($decoded['fields'])) {
			return [];
		}

		$fields = [];
		foreach ($decoded['fields'] as $field_id => $field) {
			if (!is_array($field)) {
				continue;
			}
			$name = !empty($field['label']) ? sanitize_text_field((string) $field['label']) : ('field_' . absint($field_id));
			if ($name === '') {
				continue;
			}
			$type = !empty($field['type']) ? sanitize_text_field((string) $field['type']) : '';
			$fields[] = [
				'name' => $name,
				'type' => $type,
			];
		}

		return $fields;
	}
}

