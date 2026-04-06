<?php
/**
 * Provide a public-facing view for the Smart Schedules form
 *
 * This file is used to markup the scheduling form shortcode.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/public/partials
 */

// If this file is called directly, abort.
if (!defined('ABSPATH')) {
	exit;
}

$hm_inst = isset($helpmate_scheduling_instance) ? $helpmate_scheduling_instance : 'hm1';
$hm_inst = preg_replace('/[^a-zA-Z0-9_-]/', '', $hm_inst);
if ($hm_inst === '') {
	$hm_inst = 'hm1';
}

$hm_heading = isset($helpmate_scheduling_heading) ? $helpmate_scheduling_heading : null;
if ($hm_heading !== null && $hm_heading !== '') {
	$heading_out = $hm_heading;
} else {
	$heading_out = esc_html__('Schedule an Appointment', 'helpmate-ai-chatbot');
}

$hm_align = isset( $helpmate_scheduling_text_align ) ? $helpmate_scheduling_text_align : '';
$hm_root_style = '';
if ( in_array( $hm_align, array( 'left', 'center', 'right' ), true ) ) {
	$hm_root_style = 'text-align:' . $hm_align . ';';
}
?>

<div class="helpmate-scheduling-root helpmate-scheduling-form-wrapper" id="helpmate-scheduling-root-<?php echo esc_attr($hm_inst); ?>" data-instance="<?php echo esc_attr($hm_inst); ?>"<?php echo $hm_root_style !== '' ? ' style="' . esc_attr( $hm_root_style ) . '"' : ''; ?>>
	<form class="helpmate-scheduling-form" data-instance="<?php echo esc_attr($hm_inst); ?>">
		<div class="helpmate-scheduling-form-header">
			<h3><?php echo esc_html($heading_out); ?></h3>
		</div>

		<div class="helpmate-scheduling-form-body">
			<div class="helpmate-scheduling-messages" data-instance="<?php echo esc_attr($hm_inst); ?>"></div>

			<div class="helpmate-scheduling-field" data-field="name">
				<label for="helpmate-scheduling-name-<?php echo esc_attr($hm_inst); ?>">
					<?php echo esc_html__('Name', 'helpmate-ai-chatbot'); ?>
					<span class="required">*</span>
				</label>
				<input type="text" id="helpmate-scheduling-name-<?php echo esc_attr($hm_inst); ?>" name="name" required>
			</div>

			<div class="helpmate-scheduling-field" data-field="email">
				<label for="helpmate-scheduling-email-<?php echo esc_attr($hm_inst); ?>">
					<?php echo esc_html__('Email', 'helpmate-ai-chatbot'); ?>
					<span class="required">*</span>
				</label>
				<input type="email" id="helpmate-scheduling-email-<?php echo esc_attr($hm_inst); ?>" name="email" required>
			</div>

			<div class="helpmate-scheduling-field" data-field="phone">
				<label for="helpmate-scheduling-phone-<?php echo esc_attr($hm_inst); ?>">
					<?php echo esc_html__('Phone', 'helpmate-ai-chatbot'); ?>
				</label>
				<input type="tel" id="helpmate-scheduling-phone-<?php echo esc_attr($hm_inst); ?>" name="phone">
			</div>

			<div class="helpmate-scheduling-field" data-field="message">
				<label for="helpmate-scheduling-message-<?php echo esc_attr($hm_inst); ?>">
					<?php echo esc_html__('Message', 'helpmate-ai-chatbot'); ?>
				</label>
				<textarea id="helpmate-scheduling-message-<?php echo esc_attr($hm_inst); ?>" name="message" rows="4"></textarea>
			</div>

			<div class="helpmate-scheduling-field" data-field="date">
				<label for="helpmate-scheduling-date-<?php echo esc_attr($hm_inst); ?>">
					<?php echo esc_html__('Date', 'helpmate-ai-chatbot'); ?>
					<span class="required">*</span>
				</label>
				<input type="date" id="helpmate-scheduling-date-<?php echo esc_attr($hm_inst); ?>" name="date" required>
			</div>

			<div class="helpmate-scheduling-field" data-field="time">
				<label for="helpmate-scheduling-time-<?php echo esc_attr($hm_inst); ?>">
					<?php echo esc_html__('Time', 'helpmate-ai-chatbot'); ?>
					<span class="required">*</span>
				</label>
				<select id="helpmate-scheduling-time-<?php echo esc_attr($hm_inst); ?>" name="time" required>
					<option value=""><?php echo esc_html__('Select a time', 'helpmate-ai-chatbot'); ?></option>
				</select>
				<div class="helpmate-scheduling-countdown" style="display:none;" aria-live="polite" data-instance="<?php echo esc_attr($hm_inst); ?>"></div>
			</div>

			<div class="helpmate-scheduling-form-footer">
				<button type="submit" class="helpmate-scheduling-submit" data-instance="<?php echo esc_attr($hm_inst); ?>">
					<?php echo esc_html__('Schedule Appointment', 'helpmate-ai-chatbot'); ?>
				</button>
			</div>
		</div>
	</form>
</div>
