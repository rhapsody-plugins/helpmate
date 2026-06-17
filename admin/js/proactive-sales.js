jQuery(function($) {
    var i18n = window.helpmateProactiveSales || {};
    var addProactiveText = i18n.addProactiveText || 'Add Proactive';
    var removeProactiveText = i18n.removeProactiveText || 'Remove Proactive';
    var errorText = i18n.errorText || 'An error occurred';
    var requestErrorText = i18n.requestErrorText || 'An error occurred while processing your request';

    var originalText;
    $(document).on('click', '.proactive-sales-action', function () {
        var button = $(this), productId = button.data('product-id'), action = button.data('action');
        var nonce = button.data('nonce');
        originalText = button.text();
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'helpmate_handle_proactive_sales',
                product_id: productId,
                proactive_action: action,
                nonce: nonce
            },
            beforeSend: function () {
                button.html('<span class="helpmate-spinner is-active" style="float:none;display:inline-block;vertical-align:middle;margin:0 4px 0 0;"></span>' + originalText);
                button.css('pointer-events', 'none');
            },
            complete: function () {
                button.css('pointer-events', '');
                button.find('.helpmate-spinner').remove();
            },
            success: function(response) {
                if (response.success) {
                    const newAction = action === 'add' ? 'remove' : 'add';
                    const newText = action === 'add' ? removeProactiveText : addProactiveText;

                    button
                        .data('action', newAction)
                        .text(newText)
                        .prop('disabled', false);
                } else {
                    alert(response.data && response.data.message ? response.data.message : errorText);
                    button.prop('disabled', false);
                }
            },
            error: function() {
                alert(requestErrorText);
                button.prop('disabled', false);
            }
        });
    });
});
