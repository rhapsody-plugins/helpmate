<?php

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_Forminator_Integration
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
	 * Pending sanitized order payload keyed by Forminator form id.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	private $pending_order_status = [];

	public function __construct($helpmate, $events)
	{
		$this->helpmate = $helpmate;
		$this->events = $events;

		add_filter('forminator_custom_form_submit_errors', [$this, 'handle_submit_errors'], 20, 3);
		add_filter('forminator_form_submit_response', [$this, 'filter_submit_response'], 20, 2);
		add_filter('forminator_form_ajax_submit_response', [$this, 'filter_ajax_submit_response'], 20, 2);
		// Forminator registers `forminator-front-scripts` when a form renders (often after wp_enqueue_scripts).
		add_action('forminator_custom_forms_enqueue_scripts', [$this, 'enqueue_forminator_order_status_script'], 20);
		add_action('wp_enqueue_scripts', [$this, 'enqueue_forminator_order_status_script'], 1000);
		add_action('wp_footer', [$this, 'maybe_enqueue_forminator_order_status_in_footer'], 5);
	}

	public function get_admin_forms_payload()
	{
		if (!class_exists('Forminator_API')) {
			return new WP_REST_Response([
				'error' => false,
				'installed' => false,
				'actions' => $this->get_action_definitions(),
				'forms' => [],
			], 200);
		}

		$forms = [];
		$saved_settings = $this->helpmate->get_settings()->get_setting('forminator_integrations', []);
		$saved_forms = isset($saved_settings['forms']) && is_array($saved_settings['forms']) ? $saved_settings['forms'] : [];
		$forminator_forms = Forminator_API::get_forms(null, 1, 999, 'publish');

		if (is_wp_error($forminator_forms)) {
			return new WP_REST_Response([
				'error' => true,
				'installed' => true,
				'actions' => $this->get_action_definitions(),
				'forms' => [],
				'message' => $forminator_forms->get_error_message(),
			], 500);
		}

		foreach ((array) $forminator_forms as $form) {
			if (!is_object($form) || !isset($form->id)) {
				continue;
			}

			$form_id = absint($form->id);
			if ($form_id <= 0) {
				continue;
			}

			$saved_form = isset($saved_forms[$form_id]) && is_array($saved_forms[$form_id]) ? $saved_forms[$form_id] : [];
			$forms[] = [
				'id' => $form_id,
				'title' => isset($form->name) ? sanitize_text_field($form->name) : ('Form #' . $form_id),
				'fields' => $this->extract_form_fields($form),
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

	/**
	 * Forminator custom-form submit interception.
	 *
	 * @param array $submit_errors Existing Forminator errors.
	 * @param int   $form_id       Forminator form id.
	 * @param array $field_data_array Submitted Forminator entries [{name,value}, ...].
	 * @return array
	 */
	public function handle_submit_errors($submit_errors, $form_id, $field_data_array)
	{
		$form_id = absint($form_id);
		if ($form_id <= 0) {
			return is_array($submit_errors) ? $submit_errors : [];
		}

		unset($this->pending_order_status[$form_id]);

		$submit_errors = is_array($submit_errors) ? $submit_errors : [];
		$config = $this->get_form_config($form_id);
		if (empty($config) || empty($config['enabled'])) {
			return $submit_errors;
		}

		$action = !empty($config['action']) ? sanitize_key((string) $config['action']) : '';
		if ($action === '') {
			return $submit_errors;
		}

		$posted_map = $this->normalize_field_data_array($field_data_array);
		$field_map = isset($config['field_map']) && is_array($config['field_map']) ? $config['field_map'] : [];
		$payload = $this->build_payload($action, $field_map, $posted_map);

		$context = [
			'integration' => 'forminator_custom_form',
			'source' => 'forminator',
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

			return $this->append_submit_error($submit_errors, $user_message);
		}

		if ($this->is_pro_action($action) && !$this->is_pro_available()) {
			$message = __('This form action requires Helpmate Pro.', 'helpmate-ai-chatbot');
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_terminal',
				'error_code' => 'pro_required',
				'error_message' => $message,
				'metadata' => ['pro_required' => '1'],
			]));

			return $this->append_submit_error($submit_errors, $message);
		}

		// Skip dedup for order status checks: repeat lookups for same order id are expected.
		if ($action !== 'order_status_checking' && $this->events->is_duplicate('forminator_custom_form', $action, $context['dedup_key'], 300)) {
			$dup_message = __('This submission was already received. Please wait a moment before trying again.', 'helpmate-ai-chatbot');
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_terminal',
				'error_code' => 'duplicate_submission',
				'error_message' => $dup_message,
				'metadata' => ['route_mode' => 'settings', 'dedup_window_seconds' => '300'],
			]));

			return $this->append_submit_error($submit_errors, $dup_message);
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

				return $this->append_submit_error($submit_errors, $response->get_error_message());
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

					return $this->append_submit_error($submit_errors, $message);
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

			return $this->append_submit_error($submit_errors, __('Submission failed due to an integration error.', 'helpmate-ai-chatbot'));
		}

		return $submit_errors;
	}

	public function filter_submit_response($response, $form_id)
	{
		return $this->apply_order_status_to_response($response, $form_id);
	}

	public function filter_ajax_submit_response($response, $form_id)
	{
		return $this->apply_order_status_to_response($response, $form_id);
	}

	/**
	 * Load order-status UI script once Forminator front scripts exist (see class constructor hooks).
	 *
	 * @param mixed $render_obj Optional Forminator render object (unused).
	 * @return void
	 */
	public function enqueue_forminator_order_status_script($render_obj = null)
	{
		if (is_admin()) {
			return;
		}

		if (!class_exists('Forminator')) {
			return;
		}

		if (!wp_script_is('forminator-front-scripts', 'registered')) {
			return;
		}

		$load = (bool) apply_filters('helpmate_forminator_order_status_enqueue_script', true);
		if (!$load) {
			return;
		}

		if (!defined('HELPMATE_URL') || !defined('HELPMATE_VERSION')) {
			return;
		}

		static $did_enqueue = false;
		if ($did_enqueue) {
			return;
		}
		$did_enqueue = true;

		wp_enqueue_script(
			'helpmate-forminator-order-status',
			HELPMATE_URL . 'public/js/helpmate-forminator-order-status.js',
			['jquery', 'forminator-front-scripts'],
			HELPMATE_VERSION,
			true
		);

		wp_localize_script(
			'helpmate-forminator-order-status',
			'helpmateForminatorOrderStatus',
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

	/**
	 * Late fallback: Forminator may register front scripts only when the form shortcode/block runs.
	 *
	 * @return void
	 */
	public function maybe_enqueue_forminator_order_status_in_footer()
	{
		if (is_admin() || wp_script_is('helpmate-forminator-order-status', 'enqueued')) {
			return;
		}
		if (!wp_script_is('forminator-front-scripts', 'registered')) {
			return;
		}
		$this->enqueue_forminator_order_status_script();
	}

	private function apply_order_status_to_response($response, $form_id)
	{
		$form_id = absint($form_id);
		if ($form_id <= 0 || !isset($this->pending_order_status[$form_id])) {
			return $response;
		}

		$response = is_array($response) ? $response : [];
		$order = $this->pending_order_status[$form_id];
		unset($this->pending_order_status[$form_id]);

		if (empty($response['success'])) {
			return $response;
		}

		$response['helpmate_order_status'] = $order;
		$response['helpmate_order_status_form_id'] = $form_id;

		/**
		 * Forminator success message when Helpmate order-status card is present.
		 * Default empty to avoid duplicate visible status blocks.
		 *
		 * @param string               $message Default empty message.
		 * @param array<string,mixed>  $order   Sanitized order payload.
		 * @param int                  $form_id Forminator form id.
		 * @param array<string,mixed>  $response Response being filtered.
		 */
		$response['message'] = (string) apply_filters('helpmate_forminator_order_status_response_message', '', $order, $form_id, $response);

		return $response;
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
		$settings = $this->helpmate->get_settings()->get_setting('forminator_integrations', []);
		$forms = isset($settings['forms']) && is_array($settings['forms']) ? $settings['forms'] : [];
		return isset($forms[$form_id]) && is_array($forms[$form_id]) ? $forms[$form_id] : [];
	}

	/**
	 * @param array<int, array<string, mixed>> $field_data_array
	 * @return array<string, mixed>
	 */
	private function normalize_field_data_array($field_data_array)
	{
		$out = [];
		foreach ((array) $field_data_array as $row) {
			if (!is_array($row) || empty($row['name'])) {
				continue;
			}

			$name = sanitize_text_field((string) $row['name']);
			if ($name === '') {
				continue;
			}

			$out[$name] = isset($row['value']) ? $row['value'] : null;
		}

		return $out;
	}

	private function build_payload($action, array $field_map, array $posted_map)
	{
		$payload = ['source' => 'forminator'];

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
				$value = $this->normalize_forminator_scheduled_date($value);
			} elseif ($target_key === 'scheduled_time') {
				$value = $this->normalize_forminator_scheduled_time($value);
			} elseif (is_array($value)) {
				$value = implode(', ', array_map(function ($item) {
					return sanitize_text_field((string) $item);
				}, $value));
			}

			$payload[$target_key] = is_string($value) ? sanitize_textarea_field($value) : $value;
		}

		if ($action === 'ticket_creation' && empty($payload['priority'])) {
			$payload['priority'] = 'normal';
		}

		return $payload;
	}

	/**
	 * Forminator date fields (dropdowns) post month/day/year arrays; calendar text may be m/d/Y.
	 * MySQL DATE expects Y-m-d — naive implode breaks storage.
	 *
	 * @param mixed $value Raw field value from Forminator field_data_array.
	 * @return string Normalized Y-m-d or empty string if not parseable.
	 */
	private function normalize_forminator_scheduled_date($value)
	{
		if ($value === null || $value === '') {
			return '';
		}

		if (is_array($value)) {
			if (!isset($value['month'], $value['day'], $value['year'])) {
				return '';
			}
			$month = (int) $value['month'];
			$day = (int) $value['day'];
			$year = (int) $value['year'];
			if ($month <= 0 || $day <= 0 || $year <= 0) {
				return '';
			}
			if ($year < 100) {
				$year += 2000;
			}
			if (!checkdate($month, $day, $year)) {
				return '';
			}

			return sprintf('%04d-%02d-%02d', $year, $month, $day);
		}

		$s = trim((string) $value);
		if ($s === '') {
			return '';
		}

		if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
			return $s;
		}

		if (ctype_digit($s) && strlen($s) >= 10) {
			$ts = (int) substr($s, 0, 10);

			return wp_date('Y-m-d', $ts);
		}

		$formats = ['Y-m-d', 'm/d/Y', 'n/j/Y', 'd/m/Y', 'j/n/Y', 'm-d-Y', 'd-m-Y'];
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
		if ($ts !== false) {
			return wp_date('Y-m-d', $ts);
		}

		return '';
	}

	/**
	 * Forminator time fields post hours/minutes/(ampm) arrays. Imploding breaks MySQL TIME.
	 *
	 * @param mixed $value Raw field value from Forminator field_data_array.
	 * @return string H:i:s or empty string; passthrough string if already time-like.
	 */
	private function normalize_forminator_scheduled_time($value)
	{
		if ($value === null || $value === '') {
			return '';
		}

		if (is_array($value)) {
			if (!array_key_exists('hours', $value) || !array_key_exists('minutes', $value)) {
				return '';
			}
			$h_raw = $value['hours'];
			$m_raw = $value['minutes'];
			if ($h_raw === '' && $m_raw === '') {
				return '';
			}
			$hour = (int) $h_raw;
			$minute = (int) $m_raw;
			$ampm = isset($value['ampm']) ? strtolower(trim((string) $value['ampm'])) : '';
			if ($ampm === 'pm' && $hour < 12) {
				$hour += 12;
			}
			if ($ampm === 'am' && $hour === 12) {
				$hour = 0;
			}
			if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59) {
				return '';
			}

			return sprintf('%02d:%02d:00', $hour, $minute);
		}

		$s = trim((string) $value);
		if ($s === '') {
			return '';
		}

		if (preg_match('/^(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(am|pm)$/i', $s, $m)) {
			return $this->normalize_forminator_scheduled_time([
				'hours' => $m[1],
				'minutes' => $m[2],
				'ampm' => strtolower($m[3]),
			]);
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
			$result = apply_filters('helpmate_forminator_pro_dispatch', null, $action, $payload, $context);
			if ($result === null) {
				return new WP_Error('forminator_pro_handler_missing', __('Pro integration handler is not available.', 'helpmate-ai-chatbot'));
			}
			return $result;
		}

		return new WP_Error('forminator_unknown_action', __('Unknown integration action.', 'helpmate-ai-chatbot'));
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
		$source = isset($payload['source']) && is_string($payload['source']) ? sanitize_text_field($payload['source']) : 'forminator';

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
			if (!isset($payload[$field]) || $payload[$field] === '' || $payload[$field] === null) {
				$missing[] = $field;
			}
		}

		if ($action === 'order_status_checking' && !empty($def['verification_contact_required'])) {
			$email = isset($payload['email']) ? trim((string) $payload['email']) : '';
			$phone = isset($payload['phone']) ? trim((string) $payload['phone']) : '';
			if ($email === '' && $phone === '') {
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
		return sprintf(
			__('Please complete or correct the following: %s.', 'helpmate-ai-chatbot'),
			$list
		);
	}

	private function append_submit_error(array $submit_errors, $message)
	{
		$submit_errors[] = [
			'submit' => sanitize_text_field((string) $message),
		];
		return $submit_errors;
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

	private function strip_tags_decode_entities($html)
	{
		$plain = wp_strip_all_tags($html);
		return html_entity_decode($plain, ENT_QUOTES | ENT_HTML5, 'UTF-8');
	}

	private function extract_form_fields($form_model)
	{
		$fields = [];
		if (!is_object($form_model) || !method_exists($form_model, 'get_real_fields')) {
			return $fields;
		}

		foreach ((array) $form_model->get_real_fields() as $field) {
			if (!is_object($field) || !method_exists($field, 'to_formatted_array')) {
				continue;
			}
			$row = (array) $field->to_formatted_array();
			$name = !empty($row['element_id']) ? sanitize_text_field((string) $row['element_id']) : '';
			if ($name === '') {
				continue;
			}
			$type = !empty($row['type']) ? sanitize_text_field((string) $row['type']) : '';
			$fields[] = [
				'name' => $name,
				'type' => $type,
			];
		}

		return $fields;
	}
}

