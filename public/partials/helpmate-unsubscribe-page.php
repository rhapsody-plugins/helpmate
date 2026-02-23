<?php
/**
 * Provide a public-facing view for the email unsubscribe page
 *
 * This file is used to display the unsubscribe confirmation page.
 *
 * @link       https://rhapsodyplugins.com/helpmate
 * @since      1.3.0
 *
 * @package    Helpmate
 * @subpackage Helpmate/public/partials
 */

// If this file is called directly, abort.
if (!defined('ABSPATH'))
    exit;

$helpmate_site_name = get_bloginfo('name');
$helpmate_site_url = home_url();
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo esc_html__('Email Preferences', 'helpmate-ai-chatbot'); ?> - <?php echo esc_html($helpmate_site_name); ?></title>
    <?php wp_head(); ?>
</head>
<body>
    <div class="helpmate-unsubscribe-container">
        <?php if ($error) : ?>
            <div class="helpmate-unsubscribe-icon error">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            <h1 class="helpmate-unsubscribe-title"><?php echo esc_html__('Something went wrong', 'helpmate-ai-chatbot'); ?></h1>
            <p class="helpmate-unsubscribe-message"><?php echo esc_html($error); ?></p>
            <a href="<?php echo esc_url($helpmate_site_url); ?>" class="helpmate-unsubscribe-btn secondary">
                <?php echo esc_html__('Return to site', 'helpmate-ai-chatbot'); ?>
            </a>
        <?php elseif ($success) : ?>
            <div id="unsubscribed-state">
                <div class="helpmate-unsubscribe-icon success">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 class="helpmate-unsubscribe-title">
                    <?php echo $already_unsubscribed
                        ? esc_html__('Already Unsubscribed', 'helpmate-ai-chatbot')
                        : esc_html__('Successfully Unsubscribed', 'helpmate-ai-chatbot'); ?>
                </h1>
                <p class="helpmate-unsubscribe-message">
                    <?php echo esc_html__('You will no longer receive marketing emails from us. If you change your mind, you can resubscribe below.', 'helpmate-ai-chatbot'); ?>
                </p>
                <button type="button" id="resubscribe-btn" class="helpmate-unsubscribe-btn primary" onclick="helpmateResubscribe()">
                    <?php echo esc_html__('Resubscribe', 'helpmate-ai-chatbot'); ?>
                </button>
                <br>
                <a href="<?php echo esc_url($helpmate_site_url); ?>" class="helpmate-unsubscribe-btn secondary">
                    <?php echo esc_html__('Return to site', 'helpmate-ai-chatbot'); ?>
                </a>
            </div>

            <div id="resubscribed-state" class="helpmate-hidden">
                <div class="helpmate-unsubscribe-icon success">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 class="helpmate-unsubscribe-title"><?php echo esc_html__('Welcome Back!', 'helpmate-ai-chatbot'); ?></h1>
                <p class="helpmate-unsubscribe-message">
                    <?php echo esc_html__('You have been successfully resubscribed. You will now receive our emails again.', 'helpmate-ai-chatbot'); ?>
                </p>
                <a href="<?php echo esc_url($helpmate_site_url); ?>" class="helpmate-unsubscribe-btn primary">
                    <?php echo esc_html__('Return to site', 'helpmate-ai-chatbot'); ?>
                </a>
            </div>
        <?php endif; ?>

        <div class="helpmate-unsubscribe-site">
            <a href="<?php echo esc_url($helpmate_site_url); ?>"><?php echo esc_html($helpmate_site_name); ?></a>
        </div>
    </div>

    <?php wp_footer(); ?>
</body>
</html>
