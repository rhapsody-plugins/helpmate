/**
 * Smart Scheduling Form JavaScript
 *
 * @package    Helpmate
 * @subpackage Helpmate/public/js
 * @since      1.3.0
 */

(function($) {
	'use strict';

	/**
	 * @param {JQuery} $root .helpmate-scheduling-root
	 */
	function initSchedulingForm($root) {
		const inst = $root.data('instance') || 'hm1';
		const form = $root.find('.helpmate-scheduling-form').first();
		const dateField = $root.find('#helpmate-scheduling-date-' + inst);
		const timeField = $root.find('#helpmate-scheduling-time-' + inst);
		const submitButton = $root.find('.helpmate-scheduling-submit[data-instance="' + inst + '"]');
		const messagesDiv = $root.find('.helpmate-scheduling-messages[data-instance="' + inst + '"]');
		const countdownEl = $root.find('.helpmate-scheduling-countdown[data-instance="' + inst + '"]');

		let settings = null;
		let currentDate = null;
		let reservationToken = null;
		let reservationExpiresAt = null;
		let countdownIntervalId = null;

		function clearReservation() {
			reservationToken = null;
			reservationExpiresAt = null;
			if (countdownIntervalId) {
				clearInterval(countdownIntervalId);
				countdownIntervalId = null;
			}
			countdownEl.hide().text('');
		}

		function releaseSlot(token) {
			if (!token) {
				return;
			}
			$.ajax({
				url: helpmateScheduling.apiUrl + 'schedules/release-slot',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ reservation_token: token }),
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-WP-Nonce', helpmateScheduling.nonce);
				}
			});
		}

		function startCountdown() {
			if (countdownIntervalId) {
				clearInterval(countdownIntervalId);
			}
			function tick() {
				if (reservationExpiresAt == null) {
					return;
				}
				const now = Math.floor(Date.now() / 1000);
				const remaining = Math.max(0, reservationExpiresAt - now);
				if (remaining <= 0) {
					clearReservation();
					timeField.val('');
					loadAvailableTimeSlots(currentDate);
					showMessage('Your hold expired. Please select a time again.', 'error');
					return;
				}
				const mins = Math.floor(remaining / 60);
				const secs = remaining % 60;
				const label = mins + ':' + String(secs).padStart(2, '0');
				countdownEl
					.show()
					.text('You have ' + label + ' to complete your booking.')
					.toggleClass('helpmate-scheduling-countdown-urgent', remaining <= 60);
			}
			tick();
			countdownIntervalId = setInterval(tick, 1000);
		}

		function reserveSlot(date, time) {
			if (!date || !time) {
				return;
			}
			if (reservationToken) {
				releaseSlot(reservationToken);
				clearReservation();
			}
			$.ajax({
				url: helpmateScheduling.apiUrl + 'schedules/reserve-slot',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({ date: date, time: time }),
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-WP-Nonce', helpmateScheduling.nonce);
				}
			}).done(function(response) {
				if (response.error) {
					timeField.val('');
					showMessage(response.message || 'This slot is no longer available. Please choose another time.', 'error');
					loadAvailableTimeSlots(date);
					return;
				}
				if (response.reservation_token != null && response.expires_at != null) {
					reservationToken = response.reservation_token;
					reservationExpiresAt = response.expires_at;
					startCountdown();
				}
			}).fail(function() {
				timeField.val('');
				showMessage('This slot is no longer available. Please choose another time.', 'error');
				loadAvailableTimeSlots(date);
			});
		}

		function initForm() {
			const today = new Date().toISOString().split('T')[0];
			dateField.attr('min', today);

			fetchSettings().then(function(settingsData) {
				settings = settingsData;
				applyFieldVisibility();
				applyFieldRequirements();
			}).catch(function() {
				showMessage('Failed to load form settings. Please refresh the page.', 'error');
			});

			dateField.on('change', function() {
				const selectedDate = $(this).val();
				clearReservation();
				timeField.html('<option value="">Select a time</option>');
				if (selectedDate) {
					currentDate = selectedDate;
					loadAvailableTimeSlots(selectedDate);
				}
			});

			timeField.on('change', function() {
				const time = $(this).val();
				if (time && currentDate) {
					reserveSlot(currentDate, time);
				} else {
					clearReservation();
				}
			});

			form.on('submit', handleFormSubmit);
		}

		function fetchSettings() {
			return $.ajax({
				url: helpmateScheduling.apiUrl + 'settings/smart_schedules',
				method: 'GET',
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-WP-Nonce', helpmateScheduling.nonce);
				}
			});
		}

		function applyFieldVisibility() {
			if (!settings || !settings.formFields) {
				return;
			}
			Object.keys(settings.formFields).forEach(function(fieldName) {
				const field = $root.find('.helpmate-scheduling-field[data-field="' + fieldName + '"]');
				const fieldConfig = settings.formFields[fieldName];
				if (!fieldConfig.visible) {
					field.addClass('hidden');
				} else {
					field.removeClass('hidden');
				}
			});
		}

		function applyFieldRequirements() {
			if (!settings || !settings.formFields) {
				return;
			}
			Object.keys(settings.formFields).forEach(function(fieldName) {
				const field = $root.find('.helpmate-scheduling-field[data-field="' + fieldName + '"]');
				const input = field.find('input, select, textarea');
				const label = field.find('label');
				const requiredSpan = label.find('.required');
				const fieldConfig = settings.formFields[fieldName];
				if (fieldConfig.required) {
					input.attr('required', true);
					if (requiredSpan.length === 0) {
						label.append('<span class="required">*</span>');
					}
				} else {
					input.removeAttr('required');
					requiredSpan.remove();
				}
			});

			const emailField = settings.formFields.email;
			const phoneField = settings.formFields.phone;
			if (emailField && phoneField && !emailField.required && !phoneField.required) {
				const emailInput = $root.find('.helpmate-scheduling-field[data-field="email"] input');
				emailInput.attr('required', true);
				$root.find('.helpmate-scheduling-field[data-field="email"] label').append('<span class="required">*</span>');
			}
		}

		function loadAvailableTimeSlots(date) {
			if (!date) {
				return;
			}
			timeField.prop('disabled', true);
			timeField.html('<option value="">Loading...</option>');
			$.ajax({
				url: helpmateScheduling.apiUrl + 'schedules/available-slots',
				method: 'GET',
				data: { date: date },
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-WP-Nonce', helpmateScheduling.nonce);
				}
			}).done(function(response) {
				timeField.html('<option value="">Select a time</option>');
				if (response.data && response.data.length > 0) {
					response.data.forEach(function(slot) {
						const timeLabel = formatTime(slot);
						timeField.append('<option value="' + slot + '">' + timeLabel + '</option>');
					});
				} else {
					timeField.html('<option value="">No available slots</option>');
				}
			}).fail(function() {
				timeField.html('<option value="">Error loading slots</option>');
				showMessage('Failed to load available time slots. Please try again.', 'error');
			}).always(function() {
				timeField.prop('disabled', false);
			});
		}

		function formatTime(timeString) {
			if (!timeString) {
				return '';
			}
			const parts = timeString.split(':');
			return parts[0] + ':' + parts[1];
		}

		function handleFormSubmit(e) {
			e.preventDefault();
			clearMessages();
			if (!validateForm()) {
				return;
			}
			submitButton.prop('disabled', true).addClass('loading');
			const formData = {
				name: $root.find('#helpmate-scheduling-name-' + inst).val(),
				email: $root.find('#helpmate-scheduling-email-' + inst).val(),
				phone: $root.find('#helpmate-scheduling-phone-' + inst).val(),
				message: $root.find('#helpmate-scheduling-message-' + inst).val(),
				scheduled_date: dateField.val(),
				scheduled_time: timeField.val()
			};
			const now = Math.floor(Date.now() / 1000);
			if (reservationToken && reservationExpiresAt != null && reservationExpiresAt > now) {
				formData.reservation_token = reservationToken;
			}
			$.ajax({
				url: helpmateScheduling.apiUrl + 'schedules',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify(formData),
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-WP-Nonce', helpmateScheduling.nonce);
				}
			}).done(function(response) {
				if (response.error) {
					const msg = response.message || 'Failed to schedule appointment.';
					if (msg.indexOf('expired') !== -1 || msg.indexOf('reservation') !== -1) {
						clearReservation();
						timeField.val('');
						if (currentDate) {
							loadAvailableTimeSlots(currentDate);
						}
					}
					showMessage(msg, 'error');
				} else {
					clearReservation();
					showMessage('Appointment scheduled successfully! We will contact you soon.', 'success');
					form[0].reset();
					timeField.html('<option value="">Select a time</option>');
				}
			}).fail(function(xhr) {
				let errorMessage = 'Failed to schedule appointment. Please try again.';
				if (xhr.responseJSON && xhr.responseJSON.message) {
					errorMessage = xhr.responseJSON.message;
					if (errorMessage.indexOf('expired') !== -1 || errorMessage.indexOf('reservation') !== -1) {
						clearReservation();
						timeField.val('');
						if (currentDate) {
							loadAvailableTimeSlots(currentDate);
						}
					}
				}
				showMessage(errorMessage, 'error');
			}).always(function() {
				submitButton.prop('disabled', false).removeClass('loading');
			});
		}

		function validateForm() {
			let isValid = true;
			$root.find('.helpmate-scheduling-field').removeClass('error');
			$root.find('.error-message').remove();
			$root.find('.helpmate-scheduling-field:not(.hidden)').each(function() {
				const field = $(this);
				const input = field.find('input[required], select[required], textarea[required]');
				if (input.length > 0 && !input.val()) {
					isValid = false;
					field.addClass('error');
					field.append('<div class="error-message">This field is required</div>');
				}
			});
			const emailInput = $root.find('#helpmate-scheduling-email-' + inst);
			if (emailInput.length && emailInput.val() && !isValidEmail(emailInput.val())) {
				isValid = false;
				emailInput.closest('.helpmate-scheduling-field').addClass('error');
				emailInput.closest('.helpmate-scheduling-field').append('<div class="error-message">Please enter a valid email address</div>');
			}
			const selectedDate = dateField.val();
			if (selectedDate) {
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const selected = new Date(selectedDate);
				if (selected <= today) {
					isValid = false;
					dateField.closest('.helpmate-scheduling-field').addClass('error');
					dateField.closest('.helpmate-scheduling-field').append('<div class="error-message">Please select a future date</div>');
				}
			}
			const emailValue = $root.find('#helpmate-scheduling-email-' + inst).val();
			const phoneValue = $root.find('#helpmate-scheduling-phone-' + inst).val();
			if (!emailValue && !phoneValue) {
				isValid = false;
				const emailField = $root.find('#helpmate-scheduling-email-' + inst).closest('.helpmate-scheduling-field');
				const phoneField = $root.find('#helpmate-scheduling-phone-' + inst).closest('.helpmate-scheduling-field');
				if (!emailField.hasClass('hidden')) {
					emailField.addClass('error');
					emailField.append('<div class="error-message">Email or phone is required</div>');
				}
				if (!phoneField.hasClass('hidden')) {
					phoneField.addClass('error');
					phoneField.append('<div class="error-message">Email or phone is required</div>');
				}
			}
			return isValid;
		}

		function isValidEmail(email) {
			const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			return re.test(email);
		}

		function showMessage(message, type) {
			messagesDiv.removeClass('success error').addClass('show ' + type).text(message);
			$('html, body').animate({
				scrollTop: messagesDiv.offset().top - 20
			}, 300);
		}

		function clearMessages() {
			messagesDiv.removeClass('show success error').text('');
		}

		initForm();
	}

	$(document).ready(function() {
		$('.helpmate-scheduling-root').each(function() {
			initSchedulingForm($(this));
		});
	});
})(jQuery);
