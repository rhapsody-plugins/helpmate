// Format time to HH:MM format
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("default", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date instanceof Date ? date : new Date(date))
}
