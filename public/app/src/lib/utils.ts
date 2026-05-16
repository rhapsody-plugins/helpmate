import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPortalContainer(): HTMLElement {
  if (typeof window === "undefined") return document.body
  return window.helpmatePortalRoot ?? document.body
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
    | undefined
  return typeof fn === 'function' ? fn(format, ...args) : format
}
