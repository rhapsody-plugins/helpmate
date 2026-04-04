<?php

if (!defined('ABSPATH')) {
	exit;
}

class Helpmate_Integration_Events
{
	const SCHEMA_VERSION = '1.0.0';
	const SCHEMA_OPTION_KEY = 'helpmate_integration_events_schema_version';
	const CLEANUP_HOOK = 'helpmate_integration_events_cleanup';

	/**
	 * @var Helpmate
	 */
	private $helpmate;

	public function __construct($helpmate)
	{
		$this->helpmate = $helpmate;
		$this->maybe_upgrade_schema();

		add_action('init', [$this, 'schedule_cleanup']);
		add_action(self::CLEANUP_HOOK, [$this, 'cleanup_old_events']);
	}

	public function schedule_cleanup()
	{
		if (!wp_next_scheduled(self::CLEANUP_HOOK)) {
			wp_schedule_event(time(), 'daily', self::CLEANUP_HOOK);
		}
	}

	public function maybe_upgrade_schema()
	{
		$current = get_option(self::SCHEMA_OPTION_KEY, '');
		if ($current === self::SCHEMA_VERSION) {
			return;
		}

		global $wpdb;
		$table = esc_sql($wpdb->prefix . 'helpmate_integration_events');
		$charset_collate = $wpdb->get_charset_collate();
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$sql = "CREATE TABLE IF NOT EXISTS {$table} (
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
		update_option(self::SCHEMA_OPTION_KEY, self::SCHEMA_VERSION);
	}

	public function record_event(array $event)
	{
		global $wpdb;
		$table = esc_sql($wpdb->prefix . 'helpmate_integration_events');
		$allowed_metadata = $this->filter_metadata(isset($event['metadata']) && is_array($event['metadata']) ? $event['metadata'] : []);

		$data = [
			'integration' => isset($event['integration']) ? sanitize_text_field($event['integration']) : 'unknown',
			'source' => isset($event['source']) ? sanitize_text_field($event['source']) : 'unknown',
			'form_id' => isset($event['form_id']) ? absint($event['form_id']) : null,
			'action' => isset($event['action']) ? sanitize_text_field($event['action']) : 'unknown',
			'status' => isset($event['status']) ? sanitize_text_field($event['status']) : 'failed_terminal',
			'error_code' => !empty($event['error_code']) ? sanitize_text_field($event['error_code']) : null,
			'error_message' => !empty($event['error_message']) ? sanitize_textarea_field($event['error_message']) : null,
			'payload_hash' => !empty($event['payload_hash']) ? sanitize_text_field($event['payload_hash']) : null,
			'dedup_key' => !empty($event['dedup_key']) ? sanitize_text_field($event['dedup_key']) : null,
			'metadata' => !empty($allowed_metadata) ? wp_json_encode($allowed_metadata) : null,
			'created_at' => time(),
		];

		$formats = ['%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d'];
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Event logging is direct write and not cacheable
		$result = $wpdb->insert($table, $data, $formats);
		if ($result === false) {
			return false;
		}

		return (int) $wpdb->insert_id;
	}

	public function is_duplicate($integration, $action, $dedup_key, $window_seconds = 300)
	{
		if (empty($dedup_key)) {
			return false;
		}

		global $wpdb;
		$table = esc_sql($wpdb->prefix . 'helpmate_integration_events');
		$threshold = time() - absint($window_seconds);
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Duplicate check must read latest writes
		$existing = $wpdb->get_var($wpdb->prepare(
			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
			"SELECT id FROM {$table}
			WHERE integration = %s
			  AND action = %s
			  AND dedup_key = %s
			  AND status IN ('accepted', 'validated', 'processed', 'failed_transient', 'failed_terminal')
			  AND NOT (status = 'failed_terminal' AND error_code = 'pro_required')
			  AND created_at >= %d
			ORDER BY id DESC
			LIMIT 1"
			// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			,
			sanitize_text_field($integration),
			sanitize_text_field($action),
			sanitize_text_field($dedup_key),
			$threshold
		));

		return !empty($existing);
	}

	public function get_events($request)
	{
		global $wpdb;
		$table = esc_sql($wpdb->prefix . 'helpmate_integration_events');
		$page = max(1, absint($request->get_param('page') ?: 1));
		$per_page = min(100, max(1, absint($request->get_param('per_page') ?: 20)));
		$offset = ($page - 1) * $per_page;

		$where = ['1=1'];
		$params = [];

		$integration = $request->get_param('integration');
		if (!empty($integration)) {
			$where[] = 'integration = %s';
			$params[] = sanitize_text_field($integration);
		}

		$action = $request->get_param('action');
		if (!empty($action)) {
			$where[] = 'action = %s';
			$params[] = sanitize_text_field($action);
		}

		$status = $request->get_param('status');
		if (!empty($status)) {
			$where[] = 'status = %s';
			$params[] = sanitize_text_field($status);
		}

		$form_id = $request->get_param('form_id');
		if (!empty($form_id)) {
			$where[] = 'form_id = %d';
			$params[] = absint($form_id);
		}

		$date_from = $request->get_param('date_from');
		if (!empty($date_from)) {
			$from_ts = strtotime(sanitize_text_field($date_from));
			if ($from_ts) {
				$where[] = 'created_at >= %d';
				$params[] = $from_ts;
			}
		}

		$date_to = $request->get_param('date_to');
		if (!empty($date_to)) {
			$to_ts = strtotime(sanitize_text_field($date_to));
			if ($to_ts) {
				$where[] = 'created_at <= %d';
				$params[] = $to_ts;
			}
		}

		$where_sql = implode(' AND ', $where);
		if (!empty($params)) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Event diagnostics require direct reads (caching not appropriate); table uses esc_sql(wpdb->prefix); WHERE is fixed fragments + placeholders imploded and bound via wpdb->prepare().
			$total = (int) $wpdb->get_var($wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE {$where_sql}",
				...$params
			));
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Event diagnostics require direct reads; WHERE is static 1=1 only; no user input in SQL.
			$total = (int) $wpdb->get_var(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
				"SELECT COUNT(*) FROM {$table} WHERE {$where_sql}"
			);
		}

		$list_params = array_merge($params, [$per_page, $offset]);
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Event diagnostics require direct reads (caching not appropriate); table uses esc_sql(wpdb->prefix); dynamic WHERE + LIMIT/OFFSET bound via wpdb->prepare() with matching $list_params.
		$rows = $wpdb->get_results($wpdb->prepare(
			"SELECT id, integration, source, form_id, action, status, error_code, error_message, payload_hash, dedup_key, metadata, created_at
			FROM {$table}
			WHERE {$where_sql}
			ORDER BY id DESC
			LIMIT %d OFFSET %d",
			...$list_params
		), ARRAY_A);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		return new WP_REST_Response([
			'error' => false,
			'data' => array_map([$this, 'hydrate_metadata'], $rows),
			'pagination' => [
				'total' => $total,
				'page' => $page,
				'per_page' => $per_page,
				'total_pages' => $per_page > 0 ? (int) ceil($total / $per_page) : 1,
			],
		], 200);
	}

	public function cleanup_old_events()
	{
		global $wpdb;
		$table = esc_sql($wpdb->prefix . 'helpmate_integration_events');
		$retention_days = 90;
		$settings = $this->helpmate->get_settings()->get_setting('integrations', []);
		if (!empty($settings['event_retention_days'])) {
			$retention_days = max(1, absint($settings['event_retention_days']));
		}

		$threshold = time() - ($retention_days * DAY_IN_SECONDS);
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Cleanup operation is a direct delete
		$wpdb->query($wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
			"DELETE FROM {$table} WHERE created_at < %d",
			$threshold
		));
	}

	private function filter_metadata(array $metadata)
	{
		$allowlist = [
			'request_id',
			'validation_fields',
			'missing_fields',
			'route_mode',
			'pro_required',
			'dedup_window_seconds',
		];
		$filtered = [];
		foreach ($allowlist as $key) {
			if (!array_key_exists($key, $metadata)) {
				continue;
			}
			$value = $metadata[$key];
			if (is_array($value)) {
				$filtered[$key] = array_map('sanitize_text_field', $value);
			} else {
				$filtered[$key] = sanitize_text_field((string) $value);
			}
		}

		return $filtered;
	}

	private function hydrate_metadata(array $row)
	{
		$row['metadata'] = !empty($row['metadata']) ? json_decode($row['metadata'], true) : [];
		return $row;
	}
}

