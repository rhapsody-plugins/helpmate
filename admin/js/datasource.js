jQuery(function($) {
    var i18n = window.helpmateDatasource || {};

    $(document).on('click', '.datasource-action', function(e) {
        e.preventDefault();

        const $button = $(this);
        const productId = $button.data('product-id');
        const action = $button.data('action');
        const nonce = $button.data('nonce');

        const originalText = $button.text();
        const addKbText = i18n.addKbText || 'Add to Knowledge Base';
        const removeKbText = i18n.removeKbText || 'Remove from Knowledge Base';
        const errorText = i18n.errorText || 'An error occurred';
        const requestErrorText = i18n.requestErrorText || 'An error occurred while processing your request';

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: action === 'add' ? 'helpmate_add_to_datasource' : 'helpmate_remove_from_datasource',
                product_id: productId,
                nonce: nonce
            },
            beforeSend: function() {
                $button.html('<span class="helpmate-spinner is-active" style="float:none;display:inline-block;vertical-align:middle;margin:0 4px 0 0;"></span>' + originalText);
                $button.css('pointer-events', 'none');
            },
            complete: function() {
                $button.css('pointer-events', '');
                $button.find('.helpmate-spinner').remove();
            },
            success: function(response) {
                if (response.success) {
                    const newAction = action === 'add' ? 'remove' : 'add';
                    const newText = action === 'add' ? removeKbText : addKbText;
                    $button
                        .data('action', newAction)
                        .text(newText)
                        .prop('disabled', false);
                } else {
                    alert(response.data && response.data.message ? response.data.message : errorText);
                    $button.prop('disabled', false);
                }
            },
            error: function() {
                alert(requestErrorText);
                $button.prop('disabled', false);
            }
        });
    });
});
