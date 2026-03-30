<?php

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_CF7_Integration
{
	/**
	 * @var Helpmate
	 */
	private $helpmate;

	/**
	 * @var Helpmate_Integration_Events
	 */
	private $events;

	private $free_actions = ['lead_collection', 'ticket_creation'];
	private $pro_actions = ['appointment_creation', 'order_status_checking', 'refund_return'];

	/**
	 * Sanitized order payload for CF7 feedback (plain message + JSON for frontend card).
	 *
	 * @var array<string, mixed>|null
	 */
	private $cf7_pending_order_status = null;

	/** @var int */
	private $cf7_pending_order_form_id = 0;

	public function __construct($helpmate, $events)
	{
		$this->helpmate = $helpmate;
		$this->events = $events;

		add_action('wpcf7_before_send_mail', [$this, 'handle_submission'], 10, 3);
		add_action('wpcf7_after_save', [$this, 'persist_cf7_editor_settings'], 10, 1);
		add_action('wpcf7_mail_sent', [$this, 'maybe_apply_cf7_order_status_response'], 10, 1);
		add_action('wpcf7_mail_failed', [$this, 'maybe_apply_cf7_order_status_response'], 10, 1);
		add_action('wp_enqueue_scripts', [$this, 'enqueue_cf7_order_status_public_assets'], 20);

		if (is_admin()) {
			add_filter('wpcf7_editor_panels', [$this, 'register_cf7_editor_panel']);
			add_action('admin_enqueue_scripts', [$this, 'enqueue_cf7_editor_scripts'], 20);
		}
	}

	public function handle_submission($contact_form, &$abort = false, $submission = null)
	{
		if (!class_exists('WPCF7_Submission')) {
			return;
		}

		$this->clear_cf7_pending_order_status();

		$submission = $submission instanceof WPCF7_Submission ? $submission : WPCF7_Submission::get_instance();
		if (!$submission) {
			return;
		}

		$posted_data = (array) $submission->get_posted_data();
		$form_id = method_exists($contact_form, 'id') ? absint($contact_form->id()) : 0;
		$config = $this->get_form_config($form_id);
		if (empty($config) || empty($config['enabled'])) {
			return;
		}

		$action = $this->resolve_action($config, $posted_data);
		if (empty($action)) {
			return;
		}

		$field_map = isset($config['field_map']) && is_array($config['field_map']) ? $config['field_map'] : [];
		$route_mode = !empty($posted_data['_helpmate_action']) ? 'hidden_field' : 'settings';
		$context = [
			'integration' => 'contact_form_7',
			'source' => 'cf7',
			'form_id' => $form_id,
			'action' => $action,
			'metadata' => ['route_mode' => $route_mode],
		];

		$payload = $this->build_payload($action, $field_map, $posted_data);
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
			$this->abort_submission($abort, $submission, $user_message);
			return;
		}

		if (in_array($action, $this->pro_actions, true) && !$this->is_pro_available()) {
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_terminal',
				'error_code' => 'pro_required',
				'error_message' => __('This integration action requires a Pro license.', 'helpmate-ai-chatbot'),
				'metadata' => ['pro_required' => '1'],
			]));
			$this->abort_submission($abort, $submission, __('This form action requires Helpmate Pro.', 'helpmate-ai-chatbot'));
			return;
		}

		// Dedup only after validation (and pro gate) so invalid payloads can be retried; block duplicate mail send.
		// Skip for order_status_checking: read-only lookup; repeat submits with the same order id are expected.
		if ($action !== 'order_status_checking' && $this->events->is_duplicate('contact_form_7', $action, $context['dedup_key'], 300)) {
			$dup_message = __('This submission was already received. Please wait a moment before trying again.', 'helpmate-ai-chatbot');
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_terminal',
				'error_code' => 'duplicate_submission',
				'error_message' => $dup_message,
				'metadata' => ['route_mode' => $route_mode, 'dedup_window_seconds' => '300'],
			]));
			$this->abort_submission($abort, $submission, $dup_message);
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
				$this->abort_submission($abort, $submission, $response->get_error_message());
				return;
			}

			$is_error = false;
			if ($response instanceof WP_REST_Response) {
				$data = (array) $response->get_data();
				$is_error = !empty($data['error']) || $response->get_status() >= 400;
				if ($is_error) {
					$message = !empty($data['message']) ? $data['message'] : __('Integration failed.', 'helpmate-ai-chatbot');
					$this->events->record_event(array_merge($context, [
						'status' => 'failed_terminal',
						'error_code' => 'dispatch_failed',
						'error_message' => $message,
					]));
					$this->abort_submission($abort, $submission, $message);
					return;
				}
			}

			$this->events->record_event(array_merge($context, ['status' => 'processed']));

			if (
				$action === 'order_status_checking'
				&& $response instanceof WP_REST_Response
			) {
				$body = (array) $response->get_data();
				$order_raw = isset($body['data']) && is_array($body['data']) ? $body['data'] : null;
				if ($order_raw && $this->is_valid_cf7_order_status_payload($order_raw)) {
					$this->cf7_pending_order_status = $this->sanitize_order_for_cf7_feedback($order_raw);
					$this->cf7_pending_order_form_id = $form_id;
				}
			}
		} catch (Exception $exception) {
			$this->events->record_event(array_merge($context, [
				'status' => 'failed_transient',
				'error_code' => 'exception',
				'error_message' => $exception->getMessage(),
			]));
			$this->abort_submission($abort, $submission, __('Submission failed due to an integration error.', 'helpmate-ai-chatbot'));
		}
	}

	public function get_admin_forms_payload()
	{
		$forms = [];
		$saved_settings = $this->helpmate->get_settings()->get_setting('cf7_integrations', []);
		$saved_forms = isset($saved_settings['forms']) && is_array($saved_settings['forms']) ? $saved_settings['forms'] : [];

		if (!class_exists('WPCF7_ContactForm')) {
			return new WP_REST_Response([
				'error' => false,
				'installed' => false,
				'actions' => $this->get_action_definitions(),
				'forms' => [],
			], 200);
		}

		$contact_forms = WPCF7_ContactForm::find(['posts_per_page' => -1]);
		foreach ($contact_forms as $contact_form) {
			$form_id = (int) $contact_form->id();
			$saved_form = isset($saved_forms[$form_id]) && is_array($saved_forms[$form_id]) ? $saved_forms[$form_id] : [];
			$forms[] = [
				'id' => $form_id,
				'title' => sanitize_text_field($contact_form->title()),
				'fields' => $this->extract_form_fields($contact_form),
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

	public function get_action_definitions()
	{
		$order_tracker = $this->helpmate->get_settings()->get_setting('order_tracker') ?? [];
		$verification_contact_required = !empty($order_tracker['order_tracker_email_required']) || !empty($order_tracker['order_tracker_phone_required']);

		return [
			[
				'id' => 'lead_collection',
				'label' => __('Lead Collection', 'helpmate-ai-chatbot'),
				'tier' => 'free',
				'required_fields' => ['name'],
				'mappable_fields' => [
					['key' => 'name', 'label' => __('Name', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'email', 'label' => __('Email', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'phone', 'label' => __('Phone', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'message', 'label' => __('Message', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'company', 'label' => __('Company', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'website', 'label' => __('Website', 'helpmate-ai-chatbot'), 'required' => false],
				],
			],
			[
				'id' => 'ticket_creation',
				'label' => __('Ticket Creation', 'helpmate-ai-chatbot'),
				'tier' => 'free',
				'required_fields' => ['subject', 'message', 'email'],
				'mappable_fields' => [
					['key' => 'subject', 'label' => __('Subject', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'message', 'label' => __('Message', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'email', 'label' => __('Email', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'name', 'label' => __('Name', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'priority', 'label' => __('Priority', 'helpmate-ai-chatbot'), 'required' => false],
				],
			],
			[
				'id' => 'appointment_creation',
				'label' => __('Appointment Creation', 'helpmate-ai-chatbot'),
				'tier' => 'pro',
				'required_fields' => ['name', 'email', 'scheduled_date', 'scheduled_time'],
				'mappable_fields' => [
					['key' => 'name', 'label' => __('Name', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'email', 'label' => __('Email', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'scheduled_date', 'label' => __('Scheduled date', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'scheduled_time', 'label' => __('Scheduled time', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'phone', 'label' => __('Phone', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'message', 'label' => __('Message', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'reservation_token', 'label' => __('Reservation token', 'helpmate-ai-chatbot'), 'required' => false],
				],
			],
			[
				'id' => 'order_status_checking',
				'label' => __('Order Status Checking', 'helpmate-ai-chatbot'),
				'tier' => 'pro',
				'required_fields' => ['order_id'],
				'verification_contact_required' => $verification_contact_required,
				'mappable_fields' => [
					['key' => 'order_id', 'label' => __('Order ID', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'email', 'label' => __('Email', 'helpmate-ai-chatbot'), 'required' => false],
					['key' => 'phone', 'label' => __('Phone', 'helpmate-ai-chatbot'), 'required' => false],
				],
			],
			[
				'id' => 'refund_return',
				'label' => __('Refund Return', 'helpmate-ai-chatbot'),
				'tier' => 'pro',
				'required_fields' => ['order_id', 'type', 'reason'],
				'mappable_fields' => [
					['key' => 'order_id', 'label' => __('Order ID', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'type', 'label' => __('Type', 'helpmate-ai-chatbot'), 'required' => true],
					['key' => 'reason', 'label' => __('Reason', 'helpmate-ai-chatbot'), 'required' => true],
				],
			],
		];
	}

	/**
	 * Normalize CF7-mapped lead payload for create_lead (name + metadata).
	 *
	 * @param array $payload Raw flat payload from field map.
	 * @return array{name:string,source:string,metadata:array<string,mixed>}
	 */
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
		$source = isset($payload['source']) && is_string($payload['source']) ? sanitize_text_field($payload['source']) : 'contact-form-7';

		return [
			'name' => $name,
			'source' => $source,
			'metadata' => $metadata,
		];
	}

	private function dispatch_action($action, array $payload, array $context)
	{
		if ($action === 'lead_collection') {
			return $this->helpmate->get_leads()->create_lead($this->normalize_lead_collection_payload($payload));
		}

		if ($action === 'ticket_creation') {
			return $this->helpmate->get_ticket()->create_ticket($payload);
		}

		if (in_array($action, $this->pro_actions, true)) {
			$result = apply_filters('helpmate_cf7_pro_dispatch', null, $action, $payload, $context);
			if ($result === null) {
				return new WP_Error('cf7_pro_handler_missing', __('Pro integration handler is not available.', 'helpmate-ai-chatbot'));
			}
			return $result;
		}

		return new WP_Error('cf7_unknown_action', __('Unknown integration action.', 'helpmate-ai-chatbot'));
	}

	/**
	 * Labels for mappable keys of a given action (for user-visible validation messages).
	 *
	 * @param string $action Action id.
	 * @return array<string, string> key => translated label.
	 */
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

	/**
	 * Fallback label when a key has no mappable definition.
	 *
	 * @param string $key Field key.
	 * @return string
	 */
	private function humanize_field_key($key)
	{
		$key = sanitize_key($key);
		if ($key === '') {
			return '';
		}

		return ucwords(str_replace('_', ' ', $key));
	}

	/**
	 * User-facing message listing what is missing or invalid (form submitters).
	 *
	 * @param string   $action Action id.
	 * @param string[] $missing Internal missing keys from get_missing_required_fields().
	 * @return string
	 */
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

	private function build_payload($action, array $field_map, array $posted_data)
	{
		$payload = [
			'source' => 'contact-form-7',
		];

		foreach ($field_map as $target => $source) {
			if (!is_string($target) || !is_string($source)) {
				continue;
			}
			$target_key = sanitize_key($target);
			if ($target_key === '') {
				continue;
			}
			$value = isset($posted_data[$source]) ? $posted_data[$source] : null;
			if (is_array($value)) {
				$value = implode(', ', array_map('sanitize_text_field', $value));
			}
			$payload[$target_key] = is_string($value) ? sanitize_textarea_field($value) : $value;
		}

		if ($action === 'ticket_creation') {
			if (empty($payload['priority'])) {
				$payload['priority'] = 'normal';
			}
		}

		return $payload;
	}

	private function get_missing_required_fields($action, array $payload)
	{
		$definitions = $this->get_action_definitions();
		$def = null;
		foreach ($definitions as $row) {
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

	private function get_form_config($form_id)
	{
		$settings = $this->helpmate->get_settings()->get_setting('cf7_integrations', []);
		$forms = isset($settings['forms']) && is_array($settings['forms']) ? $settings['forms'] : [];
		return isset($forms[$form_id]) && is_array($forms[$form_id]) ? $forms[$form_id] : [];
	}

	private function resolve_action(array $config, array $posted_data)
	{
		if (!empty($posted_data['_helpmate_action'])) {
			$action = sanitize_key($posted_data['_helpmate_action']);
			if (in_array($action, array_merge($this->free_actions, $this->pro_actions), true)) {
				return $action;
			}
		}

		return !empty($config['action']) ? sanitize_key($config['action']) : '';
	}

	public function is_pro_available()
	{
		return $this->helpmate->get_product_slug() !== 'helpmate-free' && $this->helpmate->is_helpmate_pro_active();
	}

	private function abort_submission(&$abort, $submission, $message)
	{
		$abort = true;
		if (is_object($submission) && method_exists($submission, 'set_response')) {
			$submission->set_response(wp_kses_post($message));
		}
	}

	private function clear_cf7_pending_order_status()
	{
		$this->cf7_pending_order_status = null;
		$this->cf7_pending_order_form_id = 0;
	}

	/**
	 * @param array<string, mixed> $raw Order payload from Pro REST data.
	 */
	private function is_valid_cf7_order_status_payload(array $raw)
	{
		$oid = isset($raw['orderId']) ? trim((string) $raw['orderId']) : '';
		$st = isset($raw['status']) ? trim((string) $raw['status']) : '';

		return $oid !== '' || $st !== '';
	}

	/**
	 * Strip HTML, decode entities, and normalize order fields for JSON in CF7 feedback.
	 *
	 * @param array<string, mixed> $raw Raw order from check_order_status.
	 * @return array{orderId:string,status:string,date:string,trackingNumber:string,estimatedDelivery:string,shippingAddress:string,items:array<int,array{name:string,quantity:int,price:string}>}
	 */
	private function sanitize_order_for_cf7_feedback(array $raw)
	{
		$out = [
			'orderId' => isset($raw['orderId']) ? sanitize_text_field((string) $raw['orderId']) : '',
			'status' => isset($raw['status']) ? sanitize_text_field((string) $raw['status']) : '',
			'date' => isset($raw['date']) ? sanitize_text_field((string) $raw['date']) : '',
			'trackingNumber' => isset($raw['trackingNumber']) ? sanitize_text_field((string) $raw['trackingNumber']) : '',
			'estimatedDelivery' => isset($raw['estimatedDelivery']) ? sanitize_text_field((string) $raw['estimatedDelivery']) : '',
			'shippingAddress' => isset($raw['shippingAddress'])
				? $this->strip_tags_decode_entities((string) $raw['shippingAddress'])
				: '',
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
	 * Strip HTML and decode entities so JSON/JS show real currency symbols, not &amp;#…; literals.
	 *
	 * @param string $html Raw HTML or entity-heavy string from WooCommerce.
	 * @return string
	 */
	private function strip_tags_decode_entities($html)
	{
		$plain = wp_strip_all_tags($html);

		return html_entity_decode($plain, ENT_QUOTES | ENT_HTML5, 'UTF-8');
	}

	/**
	 * After CF7 sets mail_sent_ok / mail_sent_ng, replace message and attach JSON for frontend card.
	 *
	 * @param WPCF7_ContactForm $contact_form Contact form.
	 */
	public function maybe_apply_cf7_order_status_response($contact_form)
	{
		if (!$contact_form instanceof WPCF7_ContactForm) {
			return;
		}

		if (empty($this->cf7_pending_order_status) || !is_array($this->cf7_pending_order_status)) {
			return;
		}

		$form_id = method_exists($contact_form, 'id') ? absint($contact_form->id()) : 0;
		if ($form_id !== $this->cf7_pending_order_form_id) {
			return;
		}

		$submission = WPCF7_Submission::get_instance();
		if (!$submission) {
			$this->clear_cf7_pending_order_status();
			return;
		}

		$order = $this->cf7_pending_order_status;
		/**
		 * Visitor-facing CF7 `message` when order details are shown via the Helpmate card (AJAX innerText).
		 * Default empty avoids duplicating the same content above the card; use the filter to restore plain text for no-JS or custom copy.
		 *
		 * @param string               $message       Default empty string.
		 * @param array<string, mixed> $order         Sanitized order payload.
		 * @param WPCF7_ContactForm    $contact_form  Current form.
		 */
		$message = (string) apply_filters('helpmate_cf7_order_status_response_message', '', $order, $contact_form);
		$submission->set_response($message);
		$submission->add_result_props(
			[
				'helpmate_order_status' => $order,
			]
		);

		$this->clear_cf7_pending_order_status();
	}

	/**
	 * Frontend script: render order card from CF7 REST extra props (wpcf7mailsent / wpcf7mailfailed).
	 */
	public function enqueue_cf7_order_status_public_assets()
	{
		if (is_admin() || !class_exists('WPCF7_ContactForm')) {
			return;
		}

		if (!function_exists('wpcf7_load_js') || !wpcf7_load_js()) {
			return;
		}

		if (!wp_script_is('contact-form-7', 'registered')) {
			return;
		}

		/**
		 * Whether to load Helpmate CF7 order-status UI script on this request.
		 *
		 * @param bool $load Default: true when Contact Form 7 JS is enabled.
		 */
		$load = (bool) apply_filters('helpmate_cf7_order_status_enqueue_script', true);
		if (!$load) {
			return;
		}

		if (!defined('HELPMATE_URL') || !defined('HELPMATE_VERSION')) {
			return;
		}

		wp_enqueue_script(
			'helpmate-cf7-order-status',
			HELPMATE_URL . 'public/js/helpmate-cf7-order-status.js',
			['contact-form-7'],
			HELPMATE_VERSION,
			true
		);

		wp_localize_script(
			'helpmate-cf7-order-status',
			'helpmateCf7OrderStatus',
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

	private function extract_form_fields($contact_form)
	{
		$fields = [];
		if (!method_exists($contact_form, 'scan_form_tags')) {
			return $fields;
		}

		$tags = $contact_form->scan_form_tags();
		foreach ($tags as $tag) {
			if (empty($tag->name)) {
				continue;
			}
			$type = !empty($tag->basetype) ? sanitize_text_field($tag->basetype) : sanitize_text_field($tag->type);
			if (in_array($type, ['submit', 'acceptance', 'quiz', 'captcha'], true)) {
				continue;
			}
			$fields[] = [
				'name' => sanitize_text_field($tag->name),
				'type' => $type,
			];
		}

		return $fields;
	}

	/**
	 * Scannable CF7 field names/types for admin mapping UI (same rules as extract_form_fields).
	 *
	 * @param WPCF7_ContactForm $contact_form Contact form.
	 * @return array<int, array{name:string,type:string}>
	 */
	public function get_scannable_form_fields_for_admin($contact_form)
	{
		if (!$contact_form instanceof WPCF7_ContactForm) {
			return [];
		}

		return $this->extract_form_fields($contact_form);
	}

	/**
	 * Register Helpmate tab on the CF7 form editor.
	 *
	 * @param array<string, array{title:string,callback:callable}> $panels Panel definitions.
	 * @return array<string, array{title:string,callback:callable}>
	 */
	public function register_cf7_editor_panel($panels)
	{
		if (!is_array($panels) || !class_exists('WPCF7_ContactForm')) {
			return $panels;
		}

		$contact_form = WPCF7_ContactForm::get_current();
		if (!$contact_form instanceof WPCF7_ContactForm || $contact_form->initial()) {
			return $panels;
		}

		$panels['helpmate-panel'] = [
			'title' => __('Helpmate', 'helpmate-ai-chatbot'),
			'callback' => [$this, 'render_cf7_editor_panel'],
		];

		return $panels;
	}

	/**
	 * Scripts for switching field-map blocks when the action changes.
	 *
	 * @param string $hook_suffix Current admin page hook suffix.
	 */
	public function enqueue_cf7_editor_scripts($hook_suffix)
	{
		if (!is_string($hook_suffix) || strpos($hook_suffix, 'wpcf7') === false) {
			return;
		}

		$page = isset($_GET['page']) ? sanitize_key((string) wp_unslash($_GET['page'])) : '';
		if ($page !== 'wpcf7' && $page !== 'wpcf7-new') {
			return;
		}

		if (!defined('HELPMATE_URL')) {
			return;
		}

		wp_enqueue_script(
			'helpmate-cf7-editor',
			HELPMATE_URL . 'admin/js/helpmate-cf7-editor.js',
			[],
			defined('HELPMATE_VERSION') ? HELPMATE_VERSION : '1.0.0',
			true
		);
	}

	/**
	 * Save Helpmate CF7 integration when the contact form is saved from the admin editor.
	 *
	 * @param WPCF7_ContactForm $contact_form Saved form.
	 */
	public function persist_cf7_editor_settings($contact_form)
	{
		if (!$contact_form instanceof WPCF7_ContactForm) {
			return;
		}

		if (!isset($_POST['helpmate_cf7_present']) || (string) wp_unslash($_POST['helpmate_cf7_present']) !== '1') {
			return;
		}

		if (!isset($_POST['wpcf7-save'])) {
			return;
		}

		$form_id = (int) $contact_form->id();
		if ($form_id <= 0 || !current_user_can('wpcf7_edit_contact_form', $form_id)) {
			return;
		}

		$raw = isset($_POST['helpmate_cf7']) && is_array($_POST['helpmate_cf7'])
			? wp_unslash($_POST['helpmate_cf7'])
			: [];

		$cfg = $this->sanitize_cf7_helpmate_post($contact_form, $raw);

		$all = $this->helpmate->get_settings()->get_setting('cf7_integrations', []);
		if (!is_array($all)) {
			$all = [];
		}

		$forms = isset($all['forms']) && is_array($all['forms']) ? $all['forms'] : [];
		$forms[$form_id] = $cfg;
		$all['forms'] = $forms;

		$this->helpmate->get_settings()->set_setting('cf7_integrations', $all);
	}

	/**
	 * Sanitize POSTed Helpmate CF7 settings for one form.
	 *
	 * @param WPCF7_ContactForm $form   Contact form.
	 * @param array             $input  Raw helpmate_cf7 array from POST.
	 * @return array{enabled:bool,action:string,field_map:array<string,string>}
	 */
	private function sanitize_cf7_helpmate_post($form, array $input)
	{
		$allowed_names = [];
		foreach ($this->get_scannable_form_fields_for_admin($form) as $f) {
			if (!empty($f['name'])) {
				$allowed_names[(string) $f['name']] = true;
			}
		}

		$enabled = !empty($input['enabled']);

		$action = isset($input['action']) ? sanitize_key((string) $input['action']) : '';
		$valid_ids = [];
		foreach ($this->get_action_definitions() as $def) {
			if (!empty($def['id'])) {
				$valid_ids[] = (string) $def['id'];
			}
		}

		if ($action !== '' && !in_array($action, $valid_ids, true)) {
			$action = '';
		}

		if ($action !== '' && in_array($action, $this->pro_actions, true) && !$this->is_pro_available()) {
			$action = '';
		}

		$field_maps_raw = isset($input['field_maps']) && is_array($input['field_maps']) ? $input['field_maps'] : [];
		$map_for_action = ($action !== '' && isset($field_maps_raw[$action]) && is_array($field_maps_raw[$action]))
			? $field_maps_raw[$action]
			: [];

		$allowed_targets = $this->get_mappable_target_keys_for_action($action);
		$field_map = [];

		foreach ($map_for_action as $target => $source) {
			$t = sanitize_key((string) $target);
			if ($t === '' || !isset($allowed_targets[$t])) {
				continue;
			}
			$s = is_string($source) ? trim($source) : '';
			if ($s === '' || !isset($allowed_names[$s])) {
				continue;
			}
			$field_map[$t] = sanitize_text_field($s);
		}

		return [
			'enabled' => $enabled,
			'action' => $action,
			'field_map' => $field_map,
		];
	}

	/**
	 * Allowed Helpmate target keys for field mapping for a given action.
	 *
	 * @param string $action Action id.
	 * @return array<string, true>
	 */
	private function get_mappable_target_keys_for_action($action)
	{
		$action = sanitize_key((string) $action);
		if ($action === '') {
			return [];
		}

		$out = [];
		foreach ($this->get_action_definitions() as $row) {
			if (empty($row['id']) || (string) $row['id'] !== $action) {
				continue;
			}
			if (empty($row['mappable_fields']) || !is_array($row['mappable_fields'])) {
				return [];
			}
			foreach ($row['mappable_fields'] as $mf) {
				if (!empty($mf['key'])) {
					$k = sanitize_key((string) $mf['key']);
					if ($k !== '') {
						$out[$k] = true;
					}
				}
			}
			return $out;
		}

		return [];
	}

	/**
	 * Helpmate panel markup on the CF7 editor.
	 *
	 * @param WPCF7_ContactForm $contact_form Current form.
	 */
	public function render_cf7_editor_panel($contact_form)
	{
		if (!$contact_form instanceof WPCF7_ContactForm || $contact_form->initial()) {
			return;
		}

		$form_id = (int) $contact_form->id();
		$saved = $this->get_form_config($form_id);
		$enabled = !empty($saved['enabled']);
		$current_action = !empty($saved['action']) ? sanitize_key((string) $saved['action']) : '';
		$saved_field_map = isset($saved['field_map']) && is_array($saved['field_map']) ? $saved['field_map'] : [];

		$posted_field_maps = [];
		if (isset($_POST['helpmate_cf7_present'], $_POST['helpmate_cf7']) && is_array($_POST['helpmate_cf7'])) {
			$posted = wp_unslash($_POST['helpmate_cf7']);
			$enabled = !empty($posted['enabled']);
			$current_action = isset($posted['action']) ? sanitize_key((string) $posted['action']) : '';
			if (isset($posted['field_maps']) && is_array($posted['field_maps'])) {
				$posted_field_maps = $posted['field_maps'];
			}
		}

		$cf7_fields = $this->get_scannable_form_fields_for_admin($contact_form);
		$definitions = $this->get_action_definitions();
		$verification_hint = false;
		foreach ($definitions as $row) {
			if (!empty($row['id']) && (string) $row['id'] === $current_action && !empty($row['verification_contact_required'])) {
				$verification_hint = true;
				break;
			}
		}

		echo '<h2>' . esc_html(__('Helpmate', 'helpmate-ai-chatbot')) . '</h2>';
		echo '<p class="description">';
		esc_html_e('Route this form’s submissions to a Helpmate workflow. Settings are stored with your Helpmate integration and match the Contact Form 7 section in Helpmate Control Center.', 'helpmate-ai-chatbot');
		echo '</p>';

		if (current_user_can('edit_posts')) {
			$integrations_url = admin_url('admin.php?page=helpmate&tab=control-center&subtab=integrations');
			echo '<p class="description">';
			echo '<a href="' . esc_url($integrations_url) . '">' . esc_html(__('Open Helpmate Integrations', 'helpmate-ai-chatbot')) . '</a>';
			echo '</p>';
		}

		echo '<input type="hidden" name="helpmate_cf7_present" value="1" />';

		echo '<fieldset class="cf7-hm-fieldset"><legend class="screen-reader-text">' . esc_html(__('Helpmate integration', 'helpmate-ai-chatbot')) . '</legend>';
		echo '<table class="form-table" role="presentation"><tbody>';

		echo '<tr><th scope="row">' . esc_html(__('Enabled', 'helpmate-ai-chatbot')) . '</th><td>';
		printf(
			'<label><input type="checkbox" name="helpmate_cf7[enabled]" value="1" %s /> %s</label>',
			checked($enabled, true, false),
			esc_html(__('Send submissions to Helpmate when this form is submitted', 'helpmate-ai-chatbot'))
		);
		echo '</td></tr>';

		echo '<tr><th scope="row"><label for="helpmate_cf7_action">' . esc_html(__('Action', 'helpmate-ai-chatbot')) . '</label></th><td>';
		echo '<select name="helpmate_cf7[action]" id="helpmate_cf7_action">';
		echo '<option value="">' . esc_html(__('— Select —', 'helpmate-ai-chatbot')) . '</option>';
		foreach ($definitions as $def) {
			if (empty($def['id'])) {
				continue;
			}
			$aid = sanitize_key((string) $def['id']);
			$label = isset($def['label']) ? (string) $def['label'] : $aid;
			$is_pro = isset($def['tier']) && $def['tier'] === 'pro';
			// Keep the currently saved Pro action selectable so the value is posted; otherwise browsers omit disabled options.
			$disabled = $is_pro && !$this->is_pro_available() && $current_action !== $aid;
			printf(
				'<option value="%1$s"%2$s%3$s>%4$s%5$s</option>',
				esc_attr($aid),
				selected($current_action, $aid, false),
				$disabled ? ' disabled="disabled"' : '',
				esc_html($label),
				$is_pro ? esc_html(' (' . __('Pro', 'helpmate-ai-chatbot') . ')') : ''
			);
		}
		echo '</select>';
		echo '<p class="description">' . esc_html(__('Choose what Helpmate should do with validated submission data.', 'helpmate-ai-chatbot')) . '</p>';
		echo '</td></tr>';

		echo '</tbody></table>';

		if ($verification_hint) {
			echo '<p class="description" style="color:#b45309;">';
			esc_html_e('Order tracker verification is on: map at least one of Email or Phone so customers can confirm the order.', 'helpmate-ai-chatbot');
			echo '</p>';
		}

		foreach ($definitions as $def) {
			if (empty($def['id']) || empty($def['mappable_fields']) || !is_array($def['mappable_fields'])) {
				continue;
			}
			$aid = sanitize_key((string) $def['id']);
			$is_pro_action = isset($def['tier']) && $def['tier'] === 'pro';
			if ($is_pro_action && !$this->is_pro_available() && $current_action !== $aid) {
				continue;
			}

			printf(
				'<div class="helpmate-cf7-action-block" data-helpmate-action-block="%s">',
				esc_attr($aid)
			);
			echo '<h3>' . esc_html(sprintf(
				/* translators: %s: Integration action label (e.g. "Lead Collection"). */
				__('Field mapping: %s', 'helpmate-ai-chatbot'),
				isset($def['label']) ? (string) $def['label'] : $aid
			)) . '</h3>';
			echo '<table class="form-table" role="presentation"><tbody>';

			foreach ($def['mappable_fields'] as $mf) {
				if (empty($mf['key'])) {
					continue;
				}
				$key = sanitize_key((string) $mf['key']);
				$mlabel = isset($mf['label']) ? (string) $mf['label'] : $key;
				$req = !empty($mf['required']);
				$fname = 'helpmate_cf7[field_maps][' . $aid . '][' . $key . ']';
				$selected = isset($saved_field_map[$key]) ? (string) $saved_field_map[$key] : '';
				if (isset($posted_field_maps[$aid]) && is_array($posted_field_maps[$aid]) && isset($posted_field_maps[$aid][$key])) {
					$selected = sanitize_text_field((string) $posted_field_maps[$aid][$key]);
				}

				echo '<tr><th scope="row">';
				echo esc_html($mlabel);
				if ($req) {
					echo ' <span class="description">(' . esc_html(__('required for this action', 'helpmate-ai-chatbot')) . ')</span>';
				}
				echo '</th><td>';
				echo '<select name="' . esc_attr($fname) . '" id="' . esc_attr('helpmate_cf7_fm_' . $aid . '_' . $key) . '">';
				echo '<option value="">' . esc_html(__('— Not mapped —', 'helpmate-ai-chatbot')) . '</option>';
				foreach ($cf7_fields as $cf) {
					$n = isset($cf['name']) ? (string) $cf['name'] : '';
					if ($n === '') {
						continue;
					}
					$t = isset($cf['type']) ? (string) $cf['type'] : '';
					$opt_label = $t !== '' ? $n . ' (' . $t . ')' : $n;
					printf(
						'<option value="%1$s"%2$s>%3$s</option>',
						esc_attr($n),
						selected($selected, $n, false),
						esc_html($opt_label)
					);
				}
				echo '</select></td></tr>';
			}

			echo '</tbody></table></div>';
		}

		echo '</fieldset>';
	}
}

