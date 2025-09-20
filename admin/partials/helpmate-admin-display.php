<?php

/**
 * Provide a admin area view for the plugin
 *
 * This file is used to markup the admin-facing aspects of the plugin.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.0.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/admin/partials
 * @author     Rhapsody Plugins <hello@rhapsodyplugins.com>
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) exit;

$is_dev = defined('WP_HELPMATE_DEV') && WP_HELPMATE_DEV;

?>

<div class="wrap">
    <hr class="!border-none wp-header-end">
    <div id="helpmate-root">
        <!-- The Vite app will be mounted here -->
    </div>
</div>

<?php if ($is_dev): ?>
    <!-- Development mode -->
    <?php /* phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript */ ?>
    <script type="module">
        import RefreshRuntime from 'http://localhost:5173/wp-content/plugins/helpmate-ai-chatbot/admin/app/@react-refresh'
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => { }
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
    </script>
    <?php /* phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript */ ?>
    <script type="module" src="http://localhost:5173/wp-content/plugins/helpmate-ai-chatbot/admin/app/@vite/client"></script>
    <?php /* phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript */ ?>
    <script type="module" src="http://localhost:5173/wp-content/plugins/helpmate-ai-chatbot /admin/app/src/main.tsx"></script>
<?php endif; ?>