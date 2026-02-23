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
