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

$is_dev = defined('WP_HELPMATE_DEV') && WP_HELPMATE_DEV;

?>

<!-- Create container for shadow DOM -->
<div id="helpmate-root"></div>

<?php if ($is_dev): ?>
    <!-- Development mode - Vite dev scripts with proper preamble -->
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