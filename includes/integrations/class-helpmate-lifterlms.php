<?php
/**
 * LifterLMS integration helpers.
 *
 * @package Helpmate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Helpmate_LifterLMS
 */
class Helpmate_LifterLMS {

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
	 * Whether LifterLMS runtime is available.
	 *
	 * @return bool
	 */
	public function is_active() {
		return class_exists( 'LifterLMS' ) || function_exists( 'llms_is_user_enrolled' ) || class_exists( 'LLMS_Student' );
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
	 * Return Lifter courses.
	 *
	 * @return array<int, array{id:int,title:string}>
	 */
	public function get_courses_for_rest() {
		$post_type = $this->get_course_post_type();
		if ( '' === $post_type ) {
			return array();
		}
		$ids = get_posts(
			array(
				'post_type'      => $post_type,
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
	 * Return Lifter lessons.
	 *
	 * @return array<int, array{id:int,title:string}>
	 */
	public function get_lessons_for_rest() {
		$post_type = $this->get_lesson_post_type();
		if ( '' === $post_type ) {
			return array();
		}
		$ids = get_posts(
			array(
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => 3000,
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
	 * Sync all Lifter students into CRM.
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
			$crm->save_contact_lifterlms_snapshot( (int) $result['id'], $snapshot );
			$crm->add_contact_sync_source( (int) $result['id'], 'lifterlms' );

			if ( ! empty( $result['created'] ) ) {
				++$summary['created'];
			} elseif ( ! empty( $result['updated'] ) ) {
				++$summary['updated'];
			}
		}

		return $summary;
	}

	/**
	 * Build LifterLMS details payload for one contact.
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
	 * Discover student user IDs.
	 *
	 * @return int[]
	 */
	private function get_student_user_ids() {
		$ids = array();
		foreach ( array( 'student', 'llms_student' ) as $role ) {
			$role_ids = get_users(
				array(
					'role'   => $role,
					'fields' => 'ID',
					'number' => -1,
				)
			);
			if ( is_array( $role_ids ) ) {
				$ids = array_merge( $ids, array_map( 'absint', $role_ids ) );
			}
		}

		$course_ids = wp_list_pluck( $this->get_courses_for_rest(), 'id' );
		if ( ! empty( $course_ids ) && function_exists( 'llms_is_user_enrolled' ) ) {
			$user_ids = get_users( array( 'fields' => 'ID', 'number' => -1 ) );
			if ( is_array( $user_ids ) ) {
				foreach ( $user_ids as $uid ) {
					$uid = absint( $uid );
					if ( $uid <= 0 ) {
						continue;
					}
					foreach ( $course_ids as $course_id ) {
						$enrolled = false;
						try {
							$enrolled = (bool) llms_is_user_enrolled( $uid, (int) $course_id );
						} catch ( Throwable $e ) {
							$enrolled = false;
						}
						if ( $enrolled ) {
							$ids[] = $uid;
							break;
						}
					}
				}
			}
		}

		$ids = array_values( array_unique( array_map( 'absint', $ids ) ) );
		return array_values( array_filter( $ids ) );
	}

	/**
	 * Get enrolled course IDs for one user.
	 *
	 * @param int $user_id User ID.
	 * @return int[]
	 */
	private function get_user_course_ids( $user_id ) {
		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			return array();
		}

		$student = $this->get_lifter_student( $user_id );
		if ( is_object( $student ) ) {
			foreach ( array( 'get_enrollments', 'get_enrolled_course_ids', 'get_courses' ) as $method ) {
				if ( method_exists( $student, $method ) ) {
					try {
						$value = $student->{$method}();
						$ids   = $this->extract_ids_from_mixed( $value );
						if ( ! empty( $ids ) ) {
							return $ids;
						}
					} catch ( Throwable $e ) {
						// Fallback below.
					}
				}
			}
		}

		if ( function_exists( 'llms_is_user_enrolled' ) ) {
			$ids = array();
			foreach ( wp_list_pluck( $this->get_courses_for_rest(), 'id' ) as $course_id ) {
				try {
					if ( llms_is_user_enrolled( $user_id, (int) $course_id ) ) {
						$ids[] = (int) $course_id;
					}
				} catch ( Throwable $e ) {
					// Continue.
				}
			}
			return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
		}

		return array();
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

		$student = $this->get_lifter_student( $user_id );
		if ( is_object( $student ) ) {
			foreach ( array( 'get_completed_course_ids', 'get_completed_courses' ) as $method ) {
				if ( method_exists( $student, $method ) ) {
					try {
						$value = $student->{$method}();
						$ids   = $this->extract_ids_from_mixed( $value );
						if ( ! empty( $ids ) ) {
							return $ids;
						}
					} catch ( Throwable $e ) {
						// Fallback below.
					}
				}
			}
		}

		$ids = array();
		foreach ( $this->get_user_course_ids( $user_id ) as $course_id ) {
			if ( $this->is_lifter_object_complete( $user_id, (int) $course_id ) ) {
				$ids[] = (int) $course_id;
			}
		}
		return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
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

		$student = $this->get_lifter_student( $user_id );
		if ( is_object( $student ) ) {
			foreach ( array( 'get_completed_lesson_ids', 'get_completed_lessons' ) as $method ) {
				if ( method_exists( $student, $method ) ) {
					try {
						$value = $student->{$method}();
						$ids   = $this->extract_ids_from_mixed( $value );
						if ( ! empty( $ids ) ) {
							return $ids;
						}
					} catch ( Throwable $e ) {
						// Fallback below.
					}
				}
			}
		}

		$ids = array();
		foreach ( wp_list_pluck( $this->get_lessons_for_rest(), 'id' ) as $lesson_id ) {
			if ( $this->is_lifter_object_complete( $user_id, (int) $lesson_id ) ) {
				$ids[] = (int) $lesson_id;
			}
		}
		return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
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
	 * Extract stored Lifter snapshot from CRM custom fields.
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
			'enrolled_course_ids'    => $this->decode_token_ids( isset( $map['lifter_enrolled_course_ids'] ) ? $map['lifter_enrolled_course_ids'] : '' ),
			'completed_course_ids'   => $this->decode_token_ids( isset( $map['lifter_completed_course_ids'] ) ? $map['lifter_completed_course_ids'] : '' ),
			'in_progress_course_ids' => $this->decode_token_ids( isset( $map['lifter_in_progress_course_ids'] ) ? $map['lifter_in_progress_course_ids'] : '' ),
			'completed_lesson_ids'   => $this->decode_token_ids( isset( $map['lifter_completed_lesson_ids'] ) ? $map['lifter_completed_lesson_ids'] : '' ),
			'last_synced_at'         => isset( $map['lifter_last_synced_at'] ) ? sanitize_text_field( (string) $map['lifter_last_synced_at'] ) : '',
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

	/**
	 * Resolve course post type for LifterLMS.
	 *
	 * @return string
	 */
	private function get_course_post_type() {
		foreach ( array( 'course', 'llms_course' ) as $post_type ) {
			if ( post_type_exists( $post_type ) ) {
				return $post_type;
			}
		}
		return '';
	}

	/**
	 * Resolve lesson post type for LifterLMS.
	 *
	 * @return string
	 */
	private function get_lesson_post_type() {
		foreach ( array( 'lesson', 'llms_lesson' ) as $post_type ) {
			if ( post_type_exists( $post_type ) ) {
				return $post_type;
			}
		}
		return '';
	}

	/**
	 * Build LLMS_Student object when available.
	 *
	 * @param int $user_id User ID.
	 * @return object|null
	 */
	private function get_lifter_student( $user_id ) {
		if ( ! class_exists( 'LLMS_Student' ) ) {
			return null;
		}
		try {
			return new LLMS_Student( absint( $user_id ) );
		} catch ( Throwable $e ) {
			return null;
		}
	}

	/**
	 * Check completion status for course/lesson object.
	 *
	 * @param int $user_id User ID.
	 * @param int $object_id Object ID.
	 * @return bool
	 */
	private function is_lifter_object_complete( $user_id, $object_id ) {
		$user_id   = absint( $user_id );
		$object_id = absint( $object_id );
		if ( $user_id <= 0 || $object_id <= 0 ) {
			return false;
		}

		if ( function_exists( 'llms_is_complete' ) ) {
			foreach ( array(
				array( $user_id, $object_id, 'course' ),
				array( $user_id, $object_id, 'lesson' ),
				array( $user_id, $object_id ),
			) as $args ) {
				try {
					$result = call_user_func_array( 'llms_is_complete', $args );
					if ( true === $result ) {
						return true;
					}
				} catch ( Throwable $e ) {
					// Try next signature.
				}
			}
		}

		$student = $this->get_lifter_student( $user_id );
		if ( is_object( $student ) ) {
			foreach ( array( 'is_complete', 'has_completed' ) as $method ) {
				if ( method_exists( $student, $method ) ) {
					try {
						if ( true === (bool) $student->{$method}( $object_id ) ) {
							return true;
						}
					} catch ( Throwable $e ) {
						// Continue.
					}
				}
			}
		}

		return false;
	}

	/**
	 * Extract IDs from mixed values.
	 *
	 * @param mixed $value Input values.
	 * @return int[]
	 */
	private function extract_ids_from_mixed( $value ) {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$ids = array();
		foreach ( $value as $row ) {
			if ( is_numeric( $row ) ) {
				$ids[] = absint( $row );
			} elseif ( is_object( $row ) && isset( $row->ID ) ) {
				$ids[] = absint( $row->ID );
			} elseif ( is_array( $row ) && isset( $row['ID'] ) ) {
				$ids[] = absint( $row['ID'] );
			}
		}
		return array_values( array_unique( array_filter( $ids ) ) );
	}
}

