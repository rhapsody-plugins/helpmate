#!/usr/bin/env bash
# Generate translation template (POT) only.
# Invoked by ../build.sh — can also be run standalone from the plugin root: bash languages/build-i18n.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Refresh translation template (scans PHP + built JS in admin/app/dist, public/app/dist)
echo "Generating languages/helpmate-ai-chatbot.pot..."
# Non-interactive bash does not load ~/.bashrc (aliases). Prefer php wp.phar on Windows — avoids
# cmd.exe //c quoting bugs that leave Command Prompt waiting for stdin (silent hang).
export WP_CLI_DISABLE_AUTO_CHECK_UPDATE=1

# WP-CLI i18n requires mbstring. Windows/PVM zips ship php.ini-development only — without php.ini,
# no extensions load (php --ini shows "none"). Fail early with a concrete fix instead of WP-CLI's terse error.
ensure_php_mbstring_for_wp_cli() {
    command -v php >/dev/null 2>&1 || return 0
    if php -r 'exit(extension_loaded("mbstring") ? 0 : 1);' 2>/dev/null; then
        return 0
    fi
    echo "Error: PHP mbstring is required for wp i18n make-pot but is not loaded."
    php --ini 2>&1 | sed 's/^/  /' || true
    php_prefix="$(php -r 'echo dirname(PHP_BINARY);' 2>/dev/null || true)"
    echo ""
    echo "Fix (typical Windows / PVM): create php.ini beside php.exe and enable extensions."
    echo "  php.exe directory: ${php_prefix:-unknown}"
    echo "  cp \"<that-dir>/php.ini-development\" \"<that-dir>/php.ini\""
    echo "  In php.ini: set extension_dir = \"ext\" and uncomment extension=mbstring (also curl + openssl for WP-CLI)."
    echo "  After php.ini exists you can use: pvm extensions enable mbstring"
    exit 1
}

run_wp_i18n_make_pot() {
    local src="$SCRIPT_DIR"
    local pot="$SCRIPT_DIR/languages/helpmate-ai-chatbot.pot"
    local domain="helpmate-ai-chatbot"
    # make-pot walks large JS trees; default 128M can exhaust (Peast/JS parse). Override with WP_I18N_MEMORY_LIMIT.
    local php_mem="${WP_I18N_MEMORY_LIMIT:-512M}"
    # Extra excludes keep scans predictable (defaults already skip node_modules; this reinforces nested paths).
    local excludes="node_modules,vendor,.git,.pnpm-store,.turbo,.cache,.tmp-ts-i18n-stub"

    resolve_wp_phar() {
        local p
        for p in "${WP_CLI_PHAR:-}" "/c/wp-cli/wp.phar" "/c/Program Files/wp-cli/wp.phar"; do
            [ -n "$p" ] && [ -f "$p" ] && printf '%s' "$p" && return 0
        done
        return 1
    }

    # WP-CLI only parses PHP + JS, not .ts/.tsx. Emit wp.i18n.__() lines from __('…') in sources and merge into POT.
    generate_ts_i18n_stub_and_pot() {
        local stub_dir="$SCRIPT_DIR/.tmp-ts-i18n-stub"
        local stub_pot="$SCRIPT_DIR/languages/_ts_i18n_stub.pot"
        rm -rf "$stub_dir"
        rm -f "$stub_pot"
        if ! command -v node >/dev/null 2>&1; then
            echo "Warning: node not found — skipping TS/TSX string extraction for POT (install Node or add to PATH)."
            printf ''
            return 0
        fi
        HELPMATE_PLUGIN_ROOT="$SCRIPT_DIR" node <<'NODE'
const fs = require("fs");
const path = require("path");
const scriptDir = process.env.HELPMATE_PLUGIN_ROOT;
const utilsPath = path.join(scriptDir, "admin/app/src/lib/utils.ts");
let domain = "helpmate-ai-chatbot";
try {
  const u = fs.readFileSync(utilsPath, "utf8");
  const m = u.match(/HELPMATE_TEXT_DOMAIN\s*=\s*['"]([^'"]+)['"]/);
  if (m) domain = m[1];
} catch (_) {}
const roots = [
  path.join(scriptDir, "admin/app/src"),
  path.join(scriptDir, "public/app/src"),
];
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}
function findTranslatorsCommentBefore(content, callIdx) {
  let i = callIdx - 1;
  while (i >= 0 && /\s/.test(content[i])) i--;
  if (i < 1) return null;
  if (content[i] !== "/" || content[i - 1] !== "*") return null;
  const closeSlash = i;
  let j = i - 2;
  while (j >= 1) {
    if (content[j] === "*" && content[j - 1] === "/") {
      const block = content.slice(j - 1, closeSlash + 1);
      if (/translators:/i.test(block)) return block;
      return null;
    }
    j--;
  }
  return null;
}
function extractOne__(content, startIdx) {
  let j = startIdx + 3;
  while (j < content.length && /\s/.test(content[j])) j++;
  const q = content[j];
  if (q !== "'" && q !== '"') return null;
  j++;
  let buf = "";
  while (j < content.length) {
    const c = content[j];
    if (c === "\\") {
      j++;
      if (j < content.length) {
        buf += content[j];
        j++;
      }
      continue;
    }
    if (c === q) {
      return { str: buf, end: j + 1 };
    }
    buf += c;
    j++;
  }
  return null;
}
function extract__(content) {
  const pairs = [];
  let i = 0;
  while (i < content.length) {
    const idx = content.indexOf("__(", i);
    if (idx === -1) break;
    const got = extractOne__(content, idx);
    if (!got) {
      i = idx + 3;
      continue;
    }
    const comment = findTranslatorsCommentBefore(content, idx);
    pairs.push({ str: got.str, comment });
    i = got.end;
  }
  return pairs;
}
const msgidMap = new Map();
for (const r of roots) {
  for (const f of walk(r)) {
    const t = fs.readFileSync(f, "utf8");
    for (const { str, comment } of extract__(t)) {
      const prev = msgidMap.get(str);
      if (prev === undefined) {
        msgidMap.set(str, comment || null);
      } else if (comment) {
        if (!prev) msgidMap.set(str, comment);
        else if (prev !== comment) {
          console.error(
            `TS i18n stub: conflicting translators comments for duplicate msgid (first wins): ${JSON.stringify(str.slice(0, 80))}${str.length > 80 ? "..." : ""}`
          );
        }
      }
    }
  }
}
const outDir = path.join(scriptDir, ".tmp-ts-i18n-stub");
fs.mkdirSync(outDir, { recursive: true });
let js =
  "/* AUTO-GENERATED from *.ts/*.tsx __() — do not edit; regenerated by languages/build-i18n.sh */\n";
for (const s of [...msgidMap.keys()].sort()) {
  const comment = msgidMap.get(s);
  const esc = s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  if (comment) js += `${comment}\n`;
  js += `wp.i18n.__('${esc}', '${domain.replace(/'/g, "\\'")}');\n`;
}
fs.writeFileSync(path.join(outDir, "stub.js"), js, "utf8");
// stderr only — stdout must be only the merge POT path for merge_pot=$(...)
console.error(`TS i18n stub: ${msgidMap.size} unique strings`);
NODE
        # Second pass: run make-pot on stub.js only (WP-CLI only understands JS, not .ts).
        # WP-CLI prints "Success: ..." to stdout — redirect to stderr so merge_pot=$() only captures printf below.
        local merge_arg=""
        local phar_local
        phar_local=$(resolve_wp_phar 2>/dev/null || true)
        if [ -d "$stub_dir" ] && [ -f "$stub_dir/stub.js" ]; then
            if command -v php >/dev/null 2>&1 && [ -n "$phar_local" ] && php -d "memory_limit=${php_mem}" "$phar_local" i18n make-pot "$stub_dir" "$stub_pot" --domain="$domain" --skip-php 1>&2; then
                merge_arg="$stub_pot"
            elif command -v wp >/dev/null 2>&1 && WP_CLI_PHP_ARGS="-dmemory_limit=${php_mem}" wp i18n make-pot "$stub_dir" "$stub_pot" --domain="$domain" --skip-php 1>&2; then
                merge_arg="$stub_pot"
            elif command -v wp.cmd >/dev/null 2>&1 && WP_CLI_PHP_ARGS="-dmemory_limit=${php_mem}" wp.cmd i18n make-pot "$stub_dir" "$stub_pot" --domain="$domain" --skip-php 1>&2; then
                merge_arg="$stub_pot"
            else
                echo "Warning: could not run wp i18n make-pot on TS stub — POT may miss admin/public TypeScript strings."
            fi
        else
            echo "Warning: TS i18n stub.js was not generated — POT may miss TypeScript-sourced strings."
        fi
        rm -rf "$stub_dir"
        printf '%s' "$merge_arg"
    }

    run_make_pot() {
        local merge_pot
        merge_pot=$(generate_ts_i18n_stub_and_pot || true)
        # Strip CR so [ -f "$merge_pot" ] works on Windows/Git Bash when paths pick up \r
        merge_pot="${merge_pot//$'\r'/}"
        echo "Running: $* i18n make-pot -> languages/helpmate-ai-chatbot.pot (may take a minute on Windows)..."
        if [ -n "$merge_pot" ] && [ -f "$merge_pot" ]; then
            "$@" i18n make-pot "$src" "$pot" --domain="$domain" --exclude="$excludes" --merge="$merge_pot"
            rm -f "$merge_pot"
        else
            "$@" i18n make-pot "$src" "$pot" --domain="$domain" --exclude="$excludes"
            # merge_pot was invalid or empty; drop leftover stub POT so it is not committed by mistake
            rm -f "$SCRIPT_DIR/languages/_ts_i18n_stub.pot"
        fi
    }

    local phar
    phar=$(resolve_wp_phar || true)
    if command -v php >/dev/null 2>&1 && [ -n "$phar" ] && php "$phar" --version >/dev/null 2>&1; then
        ensure_php_mbstring_for_wp_cli
        run_make_pot php -d "memory_limit=${php_mem}" "$phar"
        return 0
    fi
    if wp --version >/dev/null 2>&1; then
        ensure_php_mbstring_for_wp_cli
        WP_CLI_PHP_ARGS="-dmemory_limit=${php_mem}" run_make_pot wp
        return 0
    fi
    if wp.cmd --version >/dev/null 2>&1; then
        ensure_php_mbstring_for_wp_cli
        WP_CLI_PHP_ARGS="-dmemory_limit=${php_mem}" run_make_pot wp.cmd
        return 0
    fi

    echo "Error: wp (WP-CLI) is required for i18n. Install WP-CLI and ensure php can run wp.phar or wp is on PATH."
    echo "Tip: set WP_CLI_PHAR to the full path of wp.phar (e.g. C:/wp-cli/wp.phar)."
    exit 1
}
run_wp_i18n_make_pot
