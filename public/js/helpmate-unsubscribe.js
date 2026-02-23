/**
 * Unsubscribe Page JavaScript
 *
 * Handles resubscribe functionality via REST API.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/public/js
 */

(function() {
	'use strict';

	/**
	 * Handle resubscribe button click.
	 */
	function resubscribe() {
		var btn = document.getElementById('resubscribe-btn');
		if (!btn || !window.helpmateUnsubscribe) {
			return;
		}

		var originalText = btn.innerHTML;
		var data = window.helpmateUnsubscribe;

		btn.disabled = true;
		btn.innerHTML = '<span class="helpmate-spinner"></span>' + data.i18n.processing;

		fetch(data.restUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				contact_id: data.contactId
			})
		})
		.then(function(response) {
			return response.json();
		})
		.then(function(responseData) {
			if (responseData.error) {
				alert(responseData.message || data.i18n.error);
				btn.disabled = false;
				btn.innerHTML = originalText;
			} else {
				document.getElementById('unsubscribed-state').classList.add('helpmate-hidden');
				document.getElementById('resubscribed-state').classList.remove('helpmate-hidden');
			}
		})
		.catch(function() {
			alert(data.i18n.error);
			btn.disabled = false;
			btn.innerHTML = originalText;
		});
	}

	// Expose to global scope for onclick handler
	window.helpmateResubscribe = resubscribe;
})();
