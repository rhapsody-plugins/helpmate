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
if (!defined('ABSPATH'))
    exit;
?>

<div id="helpmate-scheduling-form-container" class="helpmate-scheduling-form-wrapper">
    <form id="helpmate-scheduling-form" class="helpmate-scheduling-form">
        <div class="helpmate-scheduling-form-header">
            <h3><?php echo esc_html__('Schedule an Appointment', 'helpmate-ai-chatbot'); ?></h3>
        </div>

        <div class="helpmate-scheduling-form-body">
            <div id="helpmate-scheduling-messages" class="helpmate-scheduling-messages"></div>

            <div class="helpmate-scheduling-field" data-field="name">
                <label for="helpmate-scheduling-name">
                    <?php echo esc_html__('Name', 'helpmate-ai-chatbot'); ?>
                    <span class="required">*</span>
                </label>
                <input type="text" id="helpmate-scheduling-name" name="name" required>
            </div>

            <div class="helpmate-scheduling-field" data-field="email">
                <label for="helpmate-scheduling-email">
                    <?php echo esc_html__('Email', 'helpmate-ai-chatbot'); ?>
                    <span class="required">*</span>
                </label>
                <input type="email" id="helpmate-scheduling-email" name="email" required>
            </div>

            <div class="helpmate-scheduling-field" data-field="phone">
                <label for="helpmate-scheduling-phone">
                    <?php echo esc_html__('Phone', 'helpmate-ai-chatbot'); ?>
                </label>
                <input type="tel" id="helpmate-scheduling-phone" name="phone">
            </div>

            <div class="helpmate-scheduling-field" data-field="message">
                <label for="helpmate-scheduling-message">
                    <?php echo esc_html__('Message', 'helpmate-ai-chatbot'); ?>
                </label>
                <textarea id="helpmate-scheduling-message" name="message" rows="4"></textarea>
            </div>

            <div class="helpmate-scheduling-field" data-field="date">
                <label for="helpmate-scheduling-date">
                    <?php echo esc_html__('Date', 'helpmate-ai-chatbot'); ?>
                    <span class="required">*</span>
                </label>
                <input type="date" id="helpmate-scheduling-date" name="date" required>
            </div>

            <div class="helpmate-scheduling-field" data-field="time">
                <label for="helpmate-scheduling-time">
                    <?php echo esc_html__('Time', 'helpmate-ai-chatbot'); ?>
                    <span class="required">*</span>
                </label>
                <select id="helpmate-scheduling-time" name="time" required>
                    <option value=""><?php echo esc_html__('Select a time', 'helpmate-ai-chatbot'); ?></option>
                </select>
                <div id="helpmate-scheduling-countdown" class="helpmate-scheduling-countdown" style="display:none;" aria-live="polite"></div>
            </div>

            <div class="helpmate-scheduling-form-footer">
                <button type="submit" id="helpmate-scheduling-submit" class="helpmate-scheduling-submit">
                    <?php echo esc_html__('Schedule Appointment', 'helpmate-ai-chatbot'); ?>
                </button>
            </div>
        </div>
    </form>
</div>

