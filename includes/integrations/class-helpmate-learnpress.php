<?php
/**
 * LearnPress LMS integration helpers.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_LearnPress
 */
class Helpmate_LearnPress {

	/**
	 * Helpmate instance.
	 *
	 * @var Helpmate
	 */
	private $helpmate;

	/**
	 * Constructor.
	 *
	 * @param Helpmate $helpmate Helpmate instance.
	 */
	public function __construct( $helpmate ) {
		$this->helpmate = $helpmate;
	}

	/**
	 * Whether LearnPress runtime is available.
	 *
	 * @return bool
	 */
	public function is_active() {
		return class_exists( 'LearnPress', false ) || function_exists( 'learn_press_get_course' );
	}

	/**
	 * REST status payload.
	 *
	 * @return array<string, int|bool>
	 */
	public function get_rest_status() {
		if ( ! $this->is_active() ) {
			return array(
				'active'         => false,
				'student_count'  => 0,
				'course_count'   => 0,
				'lesson_count'   => 0,
			);
		}

		return array(
			'active'         => true,
			'student_count'  => count( $this->get_student_user_ids() ),
			'course_count'   => count( $this->get_courses_for_rest() ),
			'lesson_count'   => count( $this->get_lessons_for_rest() ),
		);
	}

	/**
	 * Return active/published courses.
	 *
	 * @return array<int, array{id:int,title:string}>
	 */
	public function get_courses_for_rest() {
		$courses = get_posts(
			array(
				'post_type'      => 'lp_course',
				'post_status'    => 'publish',
				'posts_per_page' => 1000,
				'orderby'        => 'title',
				'order'          => 'ASC',
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		if ( ! is_array( $courses ) ) {
			return array();
		}

		$out = array();
		foreach ( $courses as $course_id ) {
			$course_id = (int) $course_id;
			if ( $course_id <= 0 ) {
				continue;
			}
			$out[] = array(
				'id'    => $course_id,
				'title' => get_the_title( $course_id ),
			);
		}
		return $out;
	}

	/**
	 * Return active/published lessons.
	 *
	 * @return array<int, array{id:int,title:string}>
	 */
	public function get_lessons_for_rest() {
		$lessons = get_posts(
			array(
				'post_type'      => 'lp_lesson',
				'post_status'    => 'publish',
				'posts_per_page' => 2000,
				'orderby'        => 'title',
				'order'          => 'ASC',
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		if ( ! is_array( $lessons ) ) {
			return array();
		}

		$out = array();
		foreach ( $lessons as $lesson_id ) {
			$lesson_id = (int) $lesson_id;
			if ( $lesson_id <= 0 ) {
				continue;
			}
			$out[] = array(
				'id'    => $lesson_id,
				'title' => get_the_title( $lesson_id ),
			);
		}
		return $out;
	}

	/**
	 * Sync all LearnPress students into CRM.
	 *
	 * @return array{created:int,updated:int,skipped_no_email:int,errors:array<int,array{email:string,message:string}>}
	 */
	public function sync_all_students_to_crm() {
		$summary = array(
			'created'          => 0,
			'updated'          => 0,
			'skipped_no_email' => 0,
			'errors'           => array(),
		);

		if ( ! $this->is_active() ) {
			return $summary;
		}

		$crm = $this->helpmate->get_crm();
		foreach ( $this->get_student_user_ids() as $user_id ) {
			$user = get_userdata( $user_id );
			if ( ! $user instanceof WP_User ) {
				continue;
			}

			$data = $this->map_user_to_student_contact_data( $user );
			if ( null === $data ) {
				++$summary['skipped_no_email'];
				continue;
			}

			$result = $crm->upsert_contact_from_lms_student( $data );
			if ( is_wp_error( $result ) ) {
				$summary['errors'][] = array(
					'email'   => $data['email'],
					'message' => $result->get_error_message(),
				);
				continue;
			}

			$snapshot = $this->build_user_lms_snapshot( (int) $user->ID );
			$crm->save_contact_lms_snapshot( (int) $result['id'], $snapshot );
			$crm->add_contact_sync_source( (int) $result['id'], 'learnpress' );

			if ( ! empty( $result['created'] ) ) {
				++$summary['created'];
			} elseif ( ! empty( $result['updated'] ) ) {
				++$summary['updated'];
			}
		}

		return $summary;
	}

	/**
	 * Build LMS details payload for a contact.
	 *
	 * @param array<string,mixed> $contact Contact payload.
	 * @return array<string,mixed>
	 */
	public function get_contact_lms_details( array $contact ) {
		$wp_user_id = ! empty( $contact['wp_user_id'] ) ? (int) $contact['wp_user_id'] : 0;
		if ( $wp_user_id <= 0 && ! empty( $contact['email'] ) ) {
			$user = get_user_by( 'email', sanitize_email( (string) $contact['email'] ) );
			if ( $user instanceof WP_User ) {
				$wp_user_id = (int) $user->ID;
			}
		}

		$live = array(
			'enrolled_course_ids'   => array(),
			'completed_course_ids'  => array(),
			'in_progress_course_ids'=> array(),
			'completed_lesson_ids'  => array(),
		);
		if ( $wp_user_id > 0 && $this->is_active() ) {
			$live = $this->build_user_lms_snapshot( $wp_user_id );
		}

		$snapshot = $this->extract_snapshot_from_contact_custom_fields(
			isset( $contact['custom_fields'] ) && is_array( $contact['custom_fields'] ) ? $contact['custom_fields'] : array()
		);

		return array(
			'active'      => $this->is_active(),
			'wp_user_id'  => $wp_user_id > 0 ? $wp_user_id : null,
			'live'        => $this->decorate_snapshot( $live ),
			'snapshot'    => $this->decorate_snapshot( $snapshot ),
			'last_synced_at' => isset( $snapshot['last_synced_at'] ) ? $snapshot['last_synced_at'] : null,
		);
	}

	/**
	 * Build live progress snapshot for one WP user.
	 *
	 * @param int $user_id User ID.
	 * @return array<string,mixed>
	 */
	public function build_user_lms_snapshot( $user_id ) {
		$enrolled  = $this->get_user_course_ids( $user_id );
		$completed = $this->get_user_completed_course_ids( $user_id );
		$lessons   = $this->get_user_completed_lesson_ids( $user_id );

		$completed_map = array_fill_keys( $completed, true );
		$in_progress = array();
		foreach ( $enrolled as $course_id ) {
			if ( empty( $completed_map[ $course_id ] ) ) {
				$in_progress[] = $course_id;
			}
		}

		return array(
			'enrolled_course_ids'    => $enrolled,
			'completed_course_ids'   => $completed,
			'in_progress_course_ids' => $in_progress,
			'completed_lesson_ids'   => $lessons,
			'last_synced_at'         => gmdate( 'Y-m-d H:i:s' ),
		);
	}

	/**
	 * Map WP user to CRM contact payload.
	 *
	 * @param WP_User $user User.
	 * @return array<string,mixed>|null
	 */
	private function map_user_to_student_contact_data( WP_User $user ) {
		$email = sanitize_email( (string) $user->user_email );
		if ( '' === $email ) {
			return null;
		}
		return array(
			'email'      => $email,
			'first_name' => sanitize_text_field( (string) $user->first_name ),
			'last_name'  => sanitize_text_field( (string) $user->last_name ),
			'phone'      => '',
			'wp_user_id' => (int) $user->ID,
			'status'     => 'subscribed',
		);
	}

	/**
	 * Discover student WP user IDs.
	 *
	 * @return int[]
	 */
	private function get_student_user_ids() {
		$ids = array();
		$role_ids = get_users(
			array(
				'role'   => 'lp_student',
				'fields' => 'ID',
				'number' => -1,
			)
		);
		if ( is_array( $role_ids ) ) {
			foreach ( $role_ids as $id ) {
				$id = (int) $id;
				if ( $id > 0 ) {
					$ids[] = $id;
				}
			}
		}

		$table_ids = $this->get_student_ids_from_user_items_table();
		if ( ! empty( $table_ids ) ) {
			$ids = array_merge( $ids, $table_ids );
		}

		$ids = array_values( array_unique( array_map( 'absint', $ids ) ) );
		return array_values( array_filter( $ids ) );
	}

	/**
	 * Query LearnPress user-items table for student IDs.
	 *
	 * @return int[]
	 */
	private function get_student_ids_from_user_items_table() {
		global $wpdb;
		$table = esc_sql( $wpdb->prefix . 'learnpress_user_items' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Lookup query for LearnPress student discovery; caching not appropriate
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $exists !== $table ) {
			return array();
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
		$rows = $wpdb->get_col( "SELECT DISTINCT user_id FROM {$table} WHERE user_id > 0 AND item_type IN ('lp_course', 'lp_lesson')" );
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return array_values( array_filter( array_map( 'absint', $rows ) ) );
	}

	/**
	 * Get enrolled course IDs for user.
	 *
	 * @param int $user_id User ID.
	 * @return int[]
	 */
	private function get_user_course_ids( $user_id ) {
		return $this->get_user_item_ids_by_type( $user_id, 'lp_course' );
	}

	/**
	 * Get completed course IDs for user.
	 *
	 * @param int $user_id User ID.
	 * @return int[]
	 */
	private function get_user_completed_course_ids( $user_id ) {
		$done = $this->get_user_item_ids_by_type( $user_id, 'lp_course', array( 'completed', 'finished', 'passed' ) );
		if ( ! empty( $done ) ) {
			return $done;
		}
		$meta = get_user_meta( $user_id, '_lp_courses_completed', true );
		if ( is_array( $meta ) ) {
			return array_values( array_filter( array_map( 'absint', $meta ) ) );
		}
		return array();
	}

	/**
	 * Get completed lesson IDs for user.
	 *
	 * @param int $user_id User ID.
	 * @return int[]
	 */
	private function get_user_completed_lesson_ids( $user_id ) {
		return $this->get_user_item_ids_by_type( $user_id, 'lp_lesson', array( 'completed', 'finished', 'passed' ) );
	}

	/**
	 * Fetch user item IDs by item_type and optional statuses.
	 *
	 * @param int   $user_id User ID.
	 * @param string $item_type Item type.
	 * @param array<int,string> $statuses Optional statuses.
	 * @return int[]
	 */
	private function get_user_item_ids_by_type( $user_id, $item_type, array $statuses = array() ) {
		global $wpdb;
		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			return array();
		}
		$table = esc_sql( $wpdb->prefix . 'learnpress_user_items' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Lookup query for LearnPress user progress; caching not appropriate
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $exists !== $table ) {
			return array();
		}

		$where = 'user_id = %d AND item_type = %s';
		$params = array( $user_id, $item_type );
		if ( ! empty( $statuses ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $statuses ), '%s' ) );
			$where       .= " AND status IN ({$placeholders})";
			$params       = array_merge( $params, $statuses );
		}

		$query = "SELECT DISTINCT item_id FROM {$table} WHERE {$where} AND item_id > 0";
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
		$rows = $wpdb->get_col( $wpdb->prepare( $query, ...$params ) );
		if ( ! is_array( $rows ) ) {
			return array();
		}
		return array_values( array_filter( array_map( 'absint', $rows ) ) );
	}

	/**
	 * Extract stored LMS snapshot from CRM custom fields.
	 *
	 * @param array<int,array<string,mixed>> $custom_fields Contact custom fields.
	 * @return array<string,mixed>
	 */
	private function extract_snapshot_from_contact_custom_fields( array $custom_fields ) {
		$map = array();
		foreach ( $custom_fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['field_name'] ) ) {
				continue;
			}
			$map[ (string) $field['field_name'] ] = isset( $field['value'] ) ? $field['value'] : '';
		}

		return array(
			'enrolled_course_ids'    => $this->decode_token_ids( isset( $map['lp_enrolled_course_ids'] ) ? $map['lp_enrolled_course_ids'] : '' ),
			'completed_course_ids'   => $this->decode_token_ids( isset( $map['lp_completed_course_ids'] ) ? $map['lp_completed_course_ids'] : '' ),
			'in_progress_course_ids' => $this->decode_token_ids( isset( $map['lp_in_progress_course_ids'] ) ? $map['lp_in_progress_course_ids'] : '' ),
			'completed_lesson_ids'   => $this->decode_token_ids( isset( $map['lp_completed_lesson_ids'] ) ? $map['lp_completed_lesson_ids'] : '' ),
			'last_synced_at'         => isset( $map['lp_last_synced_at'] ) ? sanitize_text_field( (string) $map['lp_last_synced_at'] ) : '',
		);
	}

	/**
	 * Add titles/counts to a snapshot.
	 *
	 * @param array<string,mixed> $snapshot Snapshot.
	 * @return array<string,mixed>
	 */
	private function decorate_snapshot( array $snapshot ) {
		$course_ids = isset( $snapshot['enrolled_course_ids'] ) && is_array( $snapshot['enrolled_course_ids'] ) ? $snapshot['enrolled_course_ids'] : array();
		$lesson_ids = isset( $snapshot['completed_lesson_ids'] ) && is_array( $snapshot['completed_lesson_ids'] ) ? $snapshot['completed_lesson_ids'] : array();

		return array(
			'enrolled_course_ids'    => $course_ids,
			'completed_course_ids'   => isset( $snapshot['completed_course_ids'] ) ? $snapshot['completed_course_ids'] : array(),
			'in_progress_course_ids' => isset( $snapshot['in_progress_course_ids'] ) ? $snapshot['in_progress_course_ids'] : array(),
			'completed_lesson_ids'   => $lesson_ids,
			'enrolled_courses'       => $this->ids_to_title_rows( $course_ids ),
			'completed_lessons'      => $this->ids_to_title_rows( $lesson_ids ),
			'counts'                 => array(
				'enrolled_courses'   => count( $course_ids ),
				'completed_courses'  => isset( $snapshot['completed_course_ids'] ) && is_array( $snapshot['completed_course_ids'] ) ? count( $snapshot['completed_course_ids'] ) : 0,
				'in_progress_courses'=> isset( $snapshot['in_progress_course_ids'] ) && is_array( $snapshot['in_progress_course_ids'] ) ? count( $snapshot['in_progress_course_ids'] ) : 0,
				'completed_lessons'  => count( $lesson_ids ),
			),
		);
	}

	/**
	 * Convert post IDs to {id,title}.
	 *
	 * @param array<int,int> $ids IDs.
	 * @return array<int,array{id:int,title:string}>
	 */
	private function ids_to_title_rows( array $ids ) {
		$out = array();
		foreach ( $ids as $id ) {
			$id = absint( $id );
			if ( $id <= 0 ) {
				continue;
			}
			$out[] = array(
				'id'    => $id,
				'title' => get_the_title( $id ),
			);
		}
		return $out;
	}

	/**
	 * Decode ",1,2,3," list into IDs.
	 *
	 * @param mixed $value Stored value.
	 * @return int[]
	 */
	private function decode_token_ids( $value ) {
		if ( ! is_string( $value ) || '' === $value ) {
			return array();
		}
		$trimmed = trim( $value, ',' );
		if ( '' === $trimmed ) {
			return array();
		}
		$parts = explode( ',', $trimmed );
		return array_values( array_filter( array_map( 'absint', $parts ) ) );
	}
}

