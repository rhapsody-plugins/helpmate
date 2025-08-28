jQuery(function($) {
    // Handle proactive sales action clicks
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
                    // Update button text and data-action
                    const newAction = action === 'add' ? 'remove' : 'add';
                    const newText = action === 'add' ? 'Remove Proactive' : 'Add Proactive';

                    button
                        .data('action', newAction)
                        .text(newText)
                        .prop('disabled', false);
                } else {
                    alert(response.data.message || 'An error occurred');
                    button.prop('disabled', false);
                }
            },
            error: function() {
                alert('An error occurred while processing your request');
                button.prop('disabled', false);
            }
        });
    });
});