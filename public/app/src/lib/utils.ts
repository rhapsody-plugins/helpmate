import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPortalContainer(): HTMLElement {
  if (typeof window === "undefined") return document.body
  return window.helpmatePortalRoot ?? document.body
}
