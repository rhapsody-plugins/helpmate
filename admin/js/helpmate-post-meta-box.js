/**
 * Post Meta Box JavaScript
 *
 * Handles the Helpmate meta box button interactions on post/page edit screens.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/admin/js
 */

jQuery(function($) {
	'use strict';

	$('.helpmate-kb-button').on('click', function() {
		var button = $(this);
		var postId = button.data('post-id');
		var action = button.data('action');
		var ajaxAction = action === 'add' ? 'helpmate_add_post_to_kb' : 'helpmate_remove_post_from_kb';
		var i18n = window.helpmatePostMetaBox || {};

		$.ajax({
			url: ajaxurl,
			type: 'POST',
			data: {
				action: ajaxAction,
				post_id: postId,
				nonce: $('#helpmate_post_meta_box_nonce').val()
			},
			beforeSend: function() {
				button.prop('disabled', true);
				button.css('opacity', 0.5);
			},
			success: function(response) {
				if (response.success) {
					button.data('action', action === 'add' ? 'remove' : 'add');
					button.text(action === 'add' ? i18n.removeText : i18n.addText);
				} else {
					alert(response.data.message || i18n.errorText);
				}
			},
			error: function() {
				alert(i18n.errorText);
			},
			complete: function() {
				button.prop('disabled', false);
				button.css('opacity', 1);
			}
		});
	});
});
