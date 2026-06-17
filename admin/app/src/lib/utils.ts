import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the portal container element for Radix UI components.
 * This keeps all portals within the React root to prevent WordPress DOM conflicts.
 * Falls back to document.body if the container doesn't exist (shouldn't happen in production).
 */
export function getPortalContainer(): HTMLElement {
  return document.getElementById('helpmate-portal-root') || document.body
}

/** WordPress text domain for Helpmate scripts (must match plugin Text Domain). Used by admin/public app i18n + POT extraction. */
export const HELPMATE_TEXT_DOMAIN = 'helpmate-ai-chatbot'

export function __(text: string): string {
  return (window as Window & typeof globalThis & { wp: { i18n: { __: (text: string, domain?: string) => string } } })?.wp?.i18n?.__?.(text, HELPMATE_TEXT_DOMAIN) ?? text
}

/** WordPress `sprintf` for translated strings with placeholders. */
export function sprintf(format: string, ...args: unknown[]): string {
  const fn = (window as Window & typeof globalThis & { wp: { i18n: { sprintf: (fmt: string, ...replacements: unknown[]) => string } } })?.wp?.i18n?.sprintf as
    | ((fmt: string, ...replacements: unknown[]) => string)
    | undefined;
  return typeof fn === 'function' ? fn(format, ...args) : format;
}
