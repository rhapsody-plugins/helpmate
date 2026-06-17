# Helpmate i18n

The plugin ships only the translation template: `helpmate-ai-chatbot.pot`.

Compiled translations belong in the WordPress global language directory, not in this plugin folder:

- `wp-content/languages/plugins/helpmate-ai-chatbot-{locale}.mo` — PHP strings
- `wp-content/languages/plugins/helpmate-ai-chatbot-{locale}-{handle}.json` — JavaScript (`wp-i18n`) per script handle

Common script handles for Jed JSON: `helpmate-admin-vite`, `helpmate-public-vite`, `helpmate-scheduling`, plus block editor handles registered for scheduling and promo-banner blocks.

## Regenerate the POT

From the plugin root, after production builds of the admin and public Vite apps (`admin/app/dist`, `public/app/dist`):

```bash
bash languages/build-i18n.sh
```

Requires [WP-CLI](https://wp-cli.org/) with the `i18n` command and PHP `mbstring`.

## Contributing translations

When a [translate.wordpress.org](https://translate.wordpress.org/) project exists for this plugin, contribute there so language packs install automatically. Until then, translators can work from `helpmate-ai-chatbot.pot` and install compiled files under `wp-content/languages/plugins/`.

More info: [WordPress Polyglots](https://make.wordpress.org/polyglots/)
