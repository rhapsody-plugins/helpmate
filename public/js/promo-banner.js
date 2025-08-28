(function($) {
    'use strict';

    class PromoBanner {
        constructor(bannerData) {
            this.banner = bannerData;
            this.element = document.getElementById(bannerData.id);
            this.metadata = bannerData.metadata;
            this.closeButton = this.element?.querySelector('.helpmate-promo-banner-close');

            this.init();
        }

        init() {
            if (!this.element) return;

            // Add layout data attribute
            this.element.setAttribute('data-layout', this.metadata.layout || '1');

            // Add slide-in animation
            this.element.classList.add('helpmate-promo-banner-slide-in');

            // Initialize countdown if enabled
            if (this.metadata.countdown_enabled && this.banner.end_datetime) {
                this.initCountdown();
            }

            // Initialize close button
            if (this.closeButton) {
                this.initCloseButton();
            }

            // Handle auto-hide
            if (this.metadata.autohide) {
                this.initAutoHide();
            }

            // Handle initial delay
            if (this.metadata.initial_delay && parseInt(this.metadata.initial_delay) > 0) {
                this.element.style.display = 'none';
                setTimeout(() => {
                    this.element.style.display = 'flex';
                }, parseInt(this.metadata.initial_delay) * 1000);
            }
        }

        initCountdown() {
            const endTime = parseInt(this.banner.end_datetime);

            if (!endTime || isNaN(endTime)) {
                return;
            }

            const updateCountdown = () => {
                const now = Date.now();
                const timeLeft = endTime - now;

                if (timeLeft <= 0) {
                    // Update all countdown elements to show expired
                    const countdownElements = this.element.querySelectorAll('[data-type]');
                    countdownElements.forEach(el => {
                        el.textContent = '00';
                    });

                    // Hide the promo banner when countdown is over
                    this.closeBanner(this.metadata.permanent_close || false);
                    return;
                }

                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                // Update individual countdown boxes for all layouts
                const dayElement = this.element.querySelector('[data-type="days"]');
                const hourElement = this.element.querySelector('[data-type="hours"]');
                const minuteElement = this.element.querySelector('[data-type="minutes"]');
                const secondElement = this.element.querySelector('[data-type="seconds"]');

                if (dayElement) dayElement.textContent = days.toString().padStart(2, '0');
                if (hourElement) hourElement.textContent = hours.toString().padStart(2, '0');
                if (minuteElement) minuteElement.textContent = minutes.toString().padStart(2, '0');
                if (secondElement) secondElement.textContent = seconds.toString().padStart(2, '0');

                // Debug logging for first update
                if (!this.countdownInitialized) {
                    this.countdownInitialized = true;
                }
            };

            updateCountdown();
            this.countdownInterval = setInterval(updateCountdown, 1000);
        }

        initCloseButton() {
            this.closeButton.addEventListener('click', () => {
                this.closeBanner(this.closeButton.dataset.permanent === 'true');
            });
        }

        initAutoHide() {
            const hideAfter = parseInt(this.metadata.hide_after) * 1000;
            setTimeout(() => {
                this.closeBanner(false);
            }, hideAfter);
        }

        closeBanner(permanent) {
            this.element.classList.add('helpmate-promo-banner-slide-out');

            // Store in localStorage if permanent
            if (permanent) {
                localStorage.setItem(`helpmate_promo_banner_${this.banner.id}_closed`, 'true');
            }

            // Remove element after animation
            setTimeout(() => {
                this.element.remove();
                if (this.countdownInterval) {
                    clearInterval(this.countdownInterval);
                }
            }, 500);
        }
    }

    // Initialize all promo banners
    function initPromoBanners() {
        if (window.helpmatePromoBanners) {
            window.helpmatePromoBanners.forEach(bannerData => {
                // Check if banner was permanently closed
                if (localStorage.getItem(`helpmate_promo_banner_${bannerData.id}_closed`) === 'true') {
                    return;
                }
                new PromoBanner(bannerData);
            });
        }
    }

    // Initialize when DOM is ready
    $(document).ready(initPromoBanners);

})(jQuery);