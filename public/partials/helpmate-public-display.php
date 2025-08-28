<?php

/**
 * Provide a public-facing view for the plugin
 *
 * This file is used to markup the public-facing aspects of the plugin.
 *
 * @link       https://rhapsodyplugins.com
 * @since      1.0.0
 *
 * @package    HelpMate
 * @subpackage HelpMate/public/partials
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

// Define the Vite app URL
$vite_app_url = plugin_dir_url(__FILE__) . '../app/';
$is_dev = defined('WP_HELPMATE_DEV') && WP_HELPMATE_DEV;
$dist_dir = plugin_dir_path(__FILE__) . '../app/dist/assets/';

// Find the latest JS and CSS files
$js_files = glob($dist_dir . 'index-*.js');
$css_files = glob($dist_dir . 'index-*.css');

// Get the most recent files
$latest_js = !empty($js_files) ? basename(end($js_files)) : '';
$latest_css = !empty($css_files) ? basename(end($css_files)) : '';

?>

<!-- Create container for shadow DOM -->
<div id="helpmate-root"></div>

<!-- JavaScript variables from PHP -->
<script>
    // HelpMate configuration variables
    window.helpmateConfig = {
        isDev: <?php echo $is_dev ? 'true' : 'false'; ?>,
        viteAppUrl: '<?php echo esc_js($vite_app_url); ?>',
        latestJs: '<?php echo esc_js($latest_js); ?>',
        latestCss: '<?php echo esc_js($latest_css); ?>',
        cssUrl: '<?php echo esc_js($vite_app_url . 'dist/assets/' . $latest_css); ?>',
        jsUrl: '<?php echo esc_js($vite_app_url . 'dist/assets/' . $latest_js); ?>'
    };
</script>

<script>
    // Create shadow DOM and load CSS
    (function () {
        const container = document.getElementById('helpmate-root');
        const shadowRoot = container.attachShadow({ mode: 'open' });

        // Create a div inside shadow DOM to mount React
        const reactRoot = document.createElement('div');
        reactRoot.id = 'root';
        shadowRoot.appendChild(reactRoot);

        if (window.helpmateConfig.isDev) {
            // Development mode - load CSS from Vite dev server
            function loadDevStyles() {
                // Try to find Vite styles
                const viteClientStyle = document.querySelector('[data-vite-dev-id]:not([href*="helpmate-pro"])');
                if (viteClientStyle && viteClientStyle.textContent) {
                    const css = viteClientStyle.textContent;
                    const style = document.createElement('style');
                    style.textContent = css;
                    shadowRoot.appendChild(style);
                }

                // Load Sonner styles
                document.head.querySelectorAll('style').forEach((styleEl) => {
                    if (styleEl.textContent?.includes('[data-sonner-toaster]')) {
                        shadowRoot.append(styleEl.cloneNode(true));
                    }
                });

                // If Vite styles aren't ready yet, retry after a short delay
                if (!viteClientStyle || !viteClientStyle.textContent) {
                    setTimeout(loadDevStyles, 100);
                }
            }

            // Also listen for Vite style updates
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE &&
                                node.tagName === 'STYLE' &&
                                node.getAttribute('data-vite-dev-id') &&
                                !node.getAttribute('data-vite-dev-id').includes('helpmate-pro')) {

                                const style = document.createElement('style');
                                style.textContent = node.textContent;
                                shadowRoot.appendChild(style);
                            }
                        });
                    }
                });
            });

            observer.observe(document.head, { childList: true, subtree: true });

            // Start loading styles
            loadDevStyles();
        }

        if (!window.helpmateConfig.isDev) {
            // Production mode - load CSS file
            const wpCss = document.querySelector('link[href*="helpmate/public/app/dist/assets/index-"][href*=".css"]');

            if (wpCss) {
                const cssLink = document.createElement('link');
                cssLink.rel = 'stylesheet';
                cssLink.href = wpCss.href;
                shadowRoot.appendChild(cssLink);
            }
        }

        // Make shadow root available globally for React app
        window.helpmateShadowRoot = shadowRoot;
        window.helpmateReactRoot = reactRoot;
    })();
</script>

<?php if ($is_dev): ?>
    <!-- Development mode - Scripts outside shadow DOM -->
    <?php /* phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript */ ?>
    <script type="module">
        import RefreshRuntime from 'http://localhost:5174/wp-content/plugins/helpmate/public/app/@react-refresh'
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => { }
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
    </script>
    <?php /* phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript */ ?>
    <script type="module" src="http://localhost:5174/wp-content/plugins/helpmate/public/app/@vite/client"></script>
    <?php /* phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript */ ?>
    <script type="module" src="http://localhost:5174/wp-content/plugins/helpmate/public/app/src/main.tsx"></script>
<?php endif; ?>