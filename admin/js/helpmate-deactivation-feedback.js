(function($) {
    'use strict';

    $(document).ready(function() {
        // Find the deactivate link for Helpmate plugin
        const deactivateLink = $('tr[data-plugin*="helpmate-ai-chatbot"] .deactivate a');

        if (deactivateLink.length === 0) {
            return;
        }

        const originalHref = deactivateLink.attr('href');

        // Prevent default deactivation and show modal
        deactivateLink.on('click', function(e) {
            e.preventDefault();
            showFeedbackModal(originalHref);
        });

        function showFeedbackModal(deactivateUrl) {
            const modal = `
                <div id="helpmate-deactivation-overlay" class="helpmate-deactivation-overlay">
                    <div class="helpmate-deactivation-modal">
                        <div class="helpmate-deactivation-header">
                            <h2>Quick Feedback</h2>
                            <button class="helpmate-deactivation-close">&times;</button>
                        </div>
                        <div class="helpmate-deactivation-body">
                            <p>If you have a moment, please let us know why you're deactivating Helpmate:</p>
                            <form id="helpmate-deactivation-form">
                                <div class="helpmate-feedback-options">
                                    <label class="helpmate-feedback-option">
                                        <input type="radio" name="feedback_reason" value="no_longer_needed">
                                        <span>I no longer need the plugin</span>
                                    </label>
                                    <label class="helpmate-feedback-option">
                                        <input type="radio" name="feedback_reason" value="found_better">
                                        <span>I found a better plugin</span>
                                    </label>
                                    <label class="helpmate-feedback-option">
                                        <input type="radio" name="feedback_reason" value="not_working">
                                        <span>The plugin is not working as expected</span>
                                    </label>
                                    <label class="helpmate-feedback-option">
                                        <input type="radio" name="feedback_reason" value="temporary">
                                        <span>It's a temporary deactivation</span>
                                    </label>
                                    <label class="helpmate-feedback-option">
                                        <input type="radio" name="feedback_reason" value="too_expensive">
                                        <span>Too expensive</span>
                                    </label>
                                    <label class="helpmate-feedback-option">
                                        <input type="radio" name="feedback_reason" value="missing_features">
                                        <span>Missing features I need</span>
                                    </label>
                                    <label class="helpmate-feedback-option">
                                        <input type="radio" name="feedback_reason" value="other">
                                        <span>Other</span>
                                    </label>
                                </div>
                                <div class="helpmate-feedback-missing" style="display: none;">
                                    <textarea
                                        id="helpmate-feedback-missing-text"
                                        placeholder="What features are you missing?"
                                        rows="4"
                                    ></textarea>
                                </div>
                                <div class="helpmate-feedback-other" style="display: none;">
                                    <textarea
                                        id="helpmate-feedback-other-text"
                                        placeholder="Please tell us more..."
                                        rows="4"
                                    ></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="helpmate-deactivation-footer">
                            <button class="button helpmate-deactivation-skip" data-deactivate-url="${deactivateUrl}">
                                Skip & Deactivate
                            </button>
                            <button class="button button-primary helpmate-deactivation-submit" disabled>
                                Submit & Deactivate
                            </button>
                        </div>
                    </div>
                </div>
            `;

            $('body').append(modal);

            // Handle radio button changes
            $('input[name="feedback_reason"]').on('change', function() {
                const selectedValue = $(this).val();
                const submitButton = $('.helpmate-deactivation-submit');

                // Show/hide missing features textarea
                if (selectedValue === 'missing_features') {
                    $('.helpmate-feedback-missing').slideDown(200);
                    $('.helpmate-feedback-other').slideUp(200);
                    submitButton.prop('disabled', true);
                }
                // Show/hide other textarea
                else if (selectedValue === 'other') {
                    $('.helpmate-feedback-other').slideDown(200);
                    $('.helpmate-feedback-missing').slideUp(200);
                    submitButton.prop('disabled', true);
                } else {
                    $('.helpmate-feedback-other').slideUp(200);
                    $('.helpmate-feedback-missing').slideUp(200);
                    submitButton.prop('disabled', false);
                }
            });

            // Enable submit button when typing in "missing features" field
            $('#helpmate-feedback-missing-text').on('input', function() {
                const text = $(this).val().trim();
                $('.helpmate-deactivation-submit').prop('disabled', text.length === 0);
            });

            // Enable submit button when typing in "other" field
            $('#helpmate-feedback-other-text').on('input', function() {
                const text = $(this).val().trim();
                $('.helpmate-deactivation-submit').prop('disabled', text.length === 0);
            });

            // Close modal
            $('.helpmate-deactivation-close, .helpmate-deactivation-overlay').on('click', function(e) {
                if (e.target === this) {
                    closeFeedbackModal();
                }
            });

            // Skip and deactivate
            $('.helpmate-deactivation-skip').on('click', function() {
                // Send feedback without reason to indicate uninstall
                $.ajax({
                    url: '/wp-json/helpmate/v1/deactivate-feedback',
                    method: 'POST',
                    data: JSON.stringify({
                        reason: ''
                    }),
                    contentType: 'application/json',
                    timeout: 5000
                }).always(function() {
                    // Always proceed with deactivation regardless of success/failure
                    window.location.href = deactivateUrl;
                });
            });

            // Submit feedback and deactivate
            $('.helpmate-deactivation-submit').on('click', function() {
                const submitButton = $(this);
                const selectedReason = $('input[name="feedback_reason"]:checked').val();
                const missingFeaturesText = $('#helpmate-feedback-missing-text').val();
                const otherText = $('#helpmate-feedback-other-text').val();

                // Combine reason with text if applicable
                let feedbackReason = selectedReason;
                if (selectedReason === 'missing_features' && missingFeaturesText) {
                    feedbackReason = `Missing features: ${missingFeaturesText}`;
                } else if (selectedReason === 'other' && otherText) {
                    feedbackReason = otherText;
                } else if (selectedReason) {
                    // Map the value to a readable reason
                    const reasonMap = {
                        'no_longer_needed': 'I no longer need the plugin',
                        'found_better': 'I found a better plugin',
                        'not_working': 'The plugin is not working as expected',
                        'temporary': "It's a temporary deactivation",
                        'too_expensive': 'Too expensive',
                        'missing_features': 'Missing features I need'
                    };
                    feedbackReason = reasonMap[selectedReason] || selectedReason;
                }

                // Disable button and show loading state
                submitButton.prop('disabled', true).text('Submitting...');

                // Send feedback via AJAX
                $.ajax({
                    url: '/wp-json/helpmate/v1/deactivate-feedback',
                    method: 'POST',
                    data: JSON.stringify({
                        reason: feedbackReason
                    }),
                    contentType: 'application/json',
                    timeout: 5000 // 5 second timeout
                }).always(function() {
                    // Always proceed with deactivation regardless of success/failure
                    window.location.href = deactivateUrl;
                });
            });
        }

        function closeFeedbackModal() {
            $('#helpmate-deactivation-overlay').fadeOut(200, function() {
                $(this).remove();
            });
        }

        // Handle ESC key
        $(document).on('keyup', function(e) {
            if (e.key === 'Escape' && $('#helpmate-deactivation-overlay').length) {
                closeFeedbackModal();
            }
        });
    });

})(jQuery);

