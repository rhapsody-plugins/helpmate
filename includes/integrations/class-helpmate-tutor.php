<?php
/**
 * Tutor LMS integration helpers.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_Tutor
 */
class Helpmate_Tutor {

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
	 * Whether Tutor LMS runtime is available.
	 *
	 * @return bool
	 */
	public function is_active() {
		return function_exists( 'tutor_utils' ) || class_exists( 'TUTOR\Tutor' );
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
	 * Return Tutor courses.
	 *
	 * @return array<int, array{id:int,title:string}>
	 */
	public function get_courses_for_rest() {
		$ids = get_posts(
			array(
				'post_type'      => 'courses',
				'post_status'    => 'publish',
				'posts_per_page' => 1000,
				'orderby'        => 'title',
				'order'          => 'ASC',
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		if ( ! is_array( $ids ) ) {
			return array();
		}
		return $this->ids_to_title_rows( $ids );
	}

	/**
	 * Return Tutor lessons.
	 *
	 * @return array<int, array{id:int,title:string}>
	 */
	public function get_lessons_for_rest() {
		$ids = get_posts(
			array(
				'post_type'      => 'lesson',
				'post_status'    => 'publish',
				'posts_per_page' => 2000,
				'orderby'        => 'title',
				'order'          => 'ASC',
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		if ( ! is_array( $ids ) ) {
			return array();
		}
		return $this->ids_to_title_rows( $ids );
	}

	/**
	 * Sync all Tutor students into CRM.
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
			$crm->save_contact_tutor_snapshot( (int) $result['id'], $snapshot );
			$crm->add_contact_sync_source( (int) $result['id'], 'tutor' );

			if ( ! empty( $result['created'] ) ) {
				++$summary['created'];
			} elseif ( ! empty( $result['updated'] ) ) {
				++$summary['updated'];
			}
		}

		return $summary;
	}

	/**
	 * Build Tutor LMS details payload for one contact.
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
			'enrolled_course_ids'    => array(),
			'completed_course_ids'   => array(),
			'in_progress_course_ids' => array(),
			'completed_lesson_ids'   => array(),
		);
		if ( $wp_user_id > 0 && $this->is_active() ) {
			$live = $this->build_user_lms_snapshot( $wp_user_id );
		}

		$snapshot = $this->extract_snapshot_from_contact_custom_fields(
			isset( $contact['custom_fields'] ) && is_array( $contact['custom_fields'] ) ? $contact['custom_fields'] : array()
		);

		return array(
			'active'         => $this->is_active(),
			'wp_user_id'     => $wp_user_id > 0 ? $wp_user_id : null,
			'live'           => $this->decorate_snapshot( $live ),
			'snapshot'       => $this->decorate_snapshot( $snapshot ),
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
		$in_progress   = array();
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
	 * Discover student WP user IDs.
	 *
	 * Priority:
	 * 1) Tutor student role.
	 * 2) Tutor enrollment table fallback.
	 *
	 * @return int[]
	 */
	private function get_student_user_ids() {
		$ids = array();

		$role_ids = get_users(
			array(
				'role'   => 'tutor_student',
				'fields' => 'ID',
				'number' => -1,
			)
		);
		if ( is_array( $role_ids ) ) {
			foreach ( $role_ids as $id ) {
				$id = absint( $id );
				if ( $id > 0 ) {
					$ids[] = $id;
				}
			}
		}

		$ids = array_merge( $ids, $this->get_student_ids_from_enrollment_table() );
		$ids = array_values( array_unique( array_map( 'absint', $ids ) ) );
		return array_values( array_filter( $ids ) );
	}

	/**
	 * Query Tutor enrollment table for student IDs.
	 *
	 * @return int[]
	 */
	private function get_student_ids_from_enrollment_table() {
		global $wpdb;
		$table = esc_sql( $wpdb->prefix . 'tutor_enrolled' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Lookup query for Tutor student discovery; caching not appropriate
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $exists !== $table ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
		$rows = $wpdb->get_col( "SELECT DISTINCT user_id FROM {$table} WHERE user_id > 0" );
		if ( ! is_array( $rows ) ) {
			return array();
		}

		return array_values( array_filter( array_map( 'absint', $rows ) ) );
	}

	/**
	 * Get enrolled course IDs for one user.
	 *
	 * @param int $user_id User ID.
	 * @return int[]
	 */
	private function get_user_course_ids( $user_id ) {
		global $wpdb;
		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			return array();
		}

		$ids = array();

		if ( function_exists( 'tutor_utils' ) ) {
			$utils = tutor_utils();
			if ( is_object( $utils ) && method_exists( $utils, 'get_enrolled_courses_by_user' ) ) {
				$result = $utils->get_enrolled_courses_by_user( $user_id );
				if ( is_array( $result ) ) {
					foreach ( $result as $row ) {
						if ( is_array( $row ) && ! empty( $row['ID'] ) ) {
							$ids[] = absint( $row['ID'] );
						} elseif ( is_object( $row ) && ! empty( $row->ID ) ) {
							$ids[] = absint( $row->ID );
						}
					}
				}
			}
		}

		if ( ! empty( $ids ) ) {
			return array_values( array_unique( array_filter( $ids ) ) );
		}

		$table = esc_sql( $wpdb->prefix . 'tutor_enrolled' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Lookup query for Tutor enrollment fallback; caching not appropriate
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $exists !== $table ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Enrollment query by user; low-cost and frequently changing
		$columns = $wpdb->get_col(
			$wpdb->prepare(
				'SHOW COLUMNS FROM `' . esc_sql( $table ) . '` LIKE %s',
				'course_id'
			)
		);
		$course_col = ! empty( $columns ) ? 'course_id' : 'post_id';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name and selected column are from fixed safe allowlist
		$rows = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT {$course_col} FROM {$table} WHERE user_id = %d AND {$course_col} > 0", $user_id ) );
		if ( ! is_array( $rows ) ) {
			return array();
		}

		return array_values( array_filter( array_map( 'absint', $rows ) ) );
	}

	/**
	 * Get completed course IDs for one user.
	 *
	 * @param int $user_id User ID.
	 * @return int[]
	 */
	private function get_user_completed_course_ids( $user_id ) {
		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			return array();
		}

		$meta = get_user_meta( $user_id, '_tutor_completed_courses', true );
		if ( is_array( $meta ) ) {
			return array_values( array_filter( array_map( 'absint', $meta ) ) );
		}
		if ( is_string( $meta ) && '' !== $meta ) {
			$decoded = json_decode( $meta, true );
			if ( is_array( $decoded ) ) {
				return array_values( array_filter( array_map( 'absint', $decoded ) ) );
			}
		}

		return $this->get_ids_from_activity_table( $user_id, 'course_complete' );
	}

	/**
	 * Get completed lesson IDs for one user.
	 *
	 * @param int $user_id User ID.
	 * @return int[]
	 */
	private function get_user_completed_lesson_ids( $user_id ) {
		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			return array();
		}

		$meta = get_user_meta( $user_id, '_tutor_completed_lesson_id', false );
		if ( is_array( $meta ) && ! empty( $meta ) ) {
			return array_values( array_unique( array_filter( array_map( 'absint', $meta ) ) ) );
		}

		return $this->get_ids_from_activity_table( $user_id, 'lesson_complete' );
	}

	/**
	 * Fallback from tutor_activities table.
	 *
	 * @param int    $user_id User ID.
	 * @param string $activity_type Activity type.
	 * @return int[]
	 */
	private function get_ids_from_activity_table( $user_id, $activity_type ) {
		global $wpdb;
		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			return array();
		}

		$table = esc_sql( $wpdb->prefix . 'tutor_activities' );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Lookup query for Tutor completion fallback; caching not appropriate
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $exists !== $table ) {
			return array();
		}

		$allowed = array( 'course_complete', 'lesson_complete' );
		if ( ! in_array( $activity_type, $allowed, true ) ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Activity completion query; low-cost and frequently changing
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe, uses wpdb->prefix
				"SELECT DISTINCT course_id
				FROM {$table}
				WHERE user_id = %d
				AND activity_type = %s
				AND course_id > 0"
				// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				,
				$user_id,
				$activity_type
			)
		);
		if ( ! is_array( $rows ) ) {
			return array();
		}

		return array_values( array_filter( array_map( 'absint', $rows ) ) );
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
	 * Extract stored Tutor snapshot from CRM custom fields.
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
			'enrolled_course_ids'    => $this->decode_token_ids( isset( $map['tutor_enrolled_course_ids'] ) ? $map['tutor_enrolled_course_ids'] : '' ),
			'completed_course_ids'   => $this->decode_token_ids( isset( $map['tutor_completed_course_ids'] ) ? $map['tutor_completed_course_ids'] : '' ),
			'in_progress_course_ids' => $this->decode_token_ids( isset( $map['tutor_in_progress_course_ids'] ) ? $map['tutor_in_progress_course_ids'] : '' ),
			'completed_lesson_ids'   => $this->decode_token_ids( isset( $map['tutor_completed_lesson_ids'] ) ? $map['tutor_completed_lesson_ids'] : '' ),
			'last_synced_at'         => isset( $map['tutor_last_synced_at'] ) ? sanitize_text_field( (string) $map['tutor_last_synced_at'] ) : '',
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
				'enrolled_courses'    => count( $course_ids ),
				'completed_courses'   => isset( $snapshot['completed_course_ids'] ) && is_array( $snapshot['completed_course_ids'] ) ? count( $snapshot['completed_course_ids'] ) : 0,
				'in_progress_courses' => isset( $snapshot['in_progress_course_ids'] ) && is_array( $snapshot['in_progress_course_ids'] ) ? count( $snapshot['in_progress_course_ids'] ) : 0,
				'completed_lessons'   => count( $lesson_ids ),
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

