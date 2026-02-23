(function($) {
    'use strict';

    var HelpmateCrmOrderMetabox = {
        init: function() {
            this.initContactSelector();
            this.initViewContactButton();
            this.initCreateContactButton();
        },

        /**
         * Initialize contact selector for new orders
         */
        initContactSelector: function() {
            var $select = $('#helpmate_crm_contact_select');

            if (!$select.length) {
                return; // Not on new order page
            }

            $select.select2({
                ajax: {
                    url: helpmateCrmOrderMetabox.restUrl,
                    dataType: 'json',
                    delay: 250,
                    headers: {
                        'X-WP-Nonce': helpmateCrmOrderMetabox.restNonce
                    },
                    data: function(params) {
                        return {
                            search: params.term,
                            per_page: 50,
                            page: params.page || 1
                        };
                    },
                    processResults: function(data, params) {
                        params.page = params.page || 1;

                        if (data.error || !data.data || !data.data.contacts) {
                            return {
                                results: []
                            };
                        }

                        var results = data.data.contacts.map(function(contact) {
                            var name = (contact.first_name || '') + ' ' + (contact.last_name || '');
                            name = name.trim();
                            if (!name) {
                                name = contact.email || '';
                            } else {
                                name += ' (' + (contact.email || '') + ')';
                            }

                            return {
                                id: contact.id,
                                text: name,
                                contact: contact
                            };
                        });

                        return {
                            results: results,
                            pagination: {
                                more: params.page < data.data.pagination.total_pages
                            }
                        };
                    },
                    cache: true
                },
                placeholder: helpmateCrmOrderMetabox.i18n.searching,
                minimumInputLength: 0,
                allowClear: true,
                width: '100%'
            }).on('select2:select', function(e) {
                var data = e.params.data;
                if (data && data.contact) {
                    HelpmateCrmOrderMetabox.populateBillingFields(data.contact);
                }
            }).on('select2:clear', function() {
                // Optionally clear fields when selection is cleared
            });
        },

        /**
         * Populate billing fields from contact data
         */
        populateBillingFields: function(contact) {
            // Check if any billing fields already have values
            var hasExistingData = false;
            var fieldsToCheck = ['first_name', 'last_name', 'email'];

            $.each(fieldsToCheck, function(index, key) {
                var $field = $('#_billing_' + key);
                if ($field.length && $field.val() && $field.val().trim() !== '') {
                    hasExistingData = true;
                    return false; // break loop
                }
            });

            // Show confirmation if there's existing data
            if (hasExistingData) {
                if (!confirm(helpmateCrmOrderMetabox.i18n.confirmOverwrite || 'Billing information already exists. Do you want to overwrite it with the selected contact information?')) {
                    // User cancelled - clear the select2 selection
                    $('#helpmate_crm_contact_select').val(null).trigger('change');
                    return;
                }
            }

            // Map contact fields to billing fields
            var fieldMap = {
                first_name: contact.first_name || '',
                last_name: contact.last_name || '',
                email: contact.email || ''
            };

            // Populate fields and trigger change events
            $.each(fieldMap, function(key, value) {
                var $field = $('#_billing_' + key);
                if ($field.length) {
                    $field.val(value).trigger('change');
                }
            });

            // Open the billing edit form so user can see the populated data
            // Wait a bit longer to ensure DOM is ready and fields are populated
            setTimeout(function() {
                // Find the billing column - look for the column containing billing fields
                var $billingColumn = null;
                $('.order_data_column').each(function() {
                    if ($(this).find('input[name^="_billing_"]').length > 0) {
                        $billingColumn = $(this);
                        return false; // break
                    }
                });

                if ($billingColumn && $billingColumn.length) {
                    var $editAddressDiv = $billingColumn.find('div.edit_address');
                    var $addressDiv = $billingColumn.find('div.address');
                    var $editLink = $billingColumn.find('h3 a.edit_address');

                    // Only trigger if edit form is not already visible
                    if ($editLink.length && !$editAddressDiv.is(':visible')) {
                        // Try clicking the edit link first (WooCommerce way)
                        $editLink.trigger('click');

                        // Fallback: if still not visible after a short delay, manually show it
                        setTimeout(function() {
                            if (!$editAddressDiv.is(':visible')) {
                                $addressDiv.hide();
                                $editLink.parent().find('a').toggle();
                                $editAddressDiv.show();

                                // Set default country/state if needed (WooCommerce does this)
                                var $countryInput = $editAddressDiv.find('.js_field-country');
                                var $stateInput = $editAddressDiv.find('.js_field-state');
                                if (!$countryInput.val() && typeof woocommerce_admin_meta_boxes_order !== 'undefined') {
                                    if (woocommerce_admin_meta_boxes_order.default_country) {
                                        $countryInput.val(woocommerce_admin_meta_boxes_order.default_country).trigger('change');
                                    }
                                    if (woocommerce_admin_meta_boxes_order.default_state) {
                                        $stateInput.val(woocommerce_admin_meta_boxes_order.default_state).trigger('change');
                                    }
                                }
                            }
                        }, 100);
                    }
                }
            }, 300);
        },



        /**
         * Initialize view contact button
         */
        initViewContactButton: function() {
            $(document).on('click', '.helpmate-view-contact', function(e) {
                e.preventDefault();
                var contactId = $(this).data('contact-id');

                if (!contactId) {
                    return;
                }

                // Set sessionStorage - ContactsList will detect this and redirect to ContactDetails
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('crm_selected_contact_id', contactId.toString());
                }

                // Open in new tab - navigate to Helpmate contacts page
                // ContactsList will detect sessionStorage and redirect to ContactDetails
                var url = helpmateCrmOrderMetabox.contactDetailsUrl;
                window.open(url, '_blank');
            });
        },

        /**
         * Initialize create contact button
         */
        initCreateContactButton: function() {
            $(document).on('click', '.helpmate-create-contact', function(e) {
                e.preventDefault();
                var $button = $(this);
                var orderId = $button.data('order-id');

                if (!orderId) {
                    alert(helpmateCrmOrderMetabox.i18n.error);
                    return;
                }

                // Disable button
                $button.prop('disabled', true).text(helpmateCrmOrderMetabox.i18n.searching);

                $.ajax({
                    url: helpmateCrmOrderMetabox.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'helpmate_create_contact_from_order',
                        order_id: orderId,
                        nonce: helpmateCrmOrderMetabox.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            // Reload the page to show the contact info
                            window.location.reload();
                        } else {
                            alert(response.data.message || helpmateCrmOrderMetabox.i18n.contactCreatedError);
                            var originalText = $button.data('original-text');
                            if (originalText) {
                                $button.text(originalText);
                            }
                            $button.prop('disabled', false);
                        }
                    },
                    error: function() {
                        alert(helpmateCrmOrderMetabox.i18n.error);
                        var originalText = $button.data('original-text');
                        if (originalText) {
                            $button.text(originalText);
                        }
                        $button.prop('disabled', false);
                    }
                });
            });

            // Store original button text
            $('.helpmate-create-contact').each(function() {
                $(this).data('original-text', $(this).text());
            });
        }
    };

    // Initialize when document is ready
    $(document).ready(function() {
        HelpmateCrmOrderMetabox.init();
    });

})(jQuery);

