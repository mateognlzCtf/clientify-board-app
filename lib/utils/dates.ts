import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

/**
 * Relative time (e.g. "hace 3 minutos") — uses browser local time.
 */
export function formatRelativeDate(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: es,
  })
}

/**
 * Calendar date only (e.g. "15 abr 2026") — for due_date/sprint dates
 * which are date-only strings with no timezone component.
 */
export function formatDate(dateString: string): string {
  const [y, m, d] = dateString.split('T')[0].split('-').map(Number)
  return format(new Date(y, m - 1, d), 'dd MMM yyyy', { locale: es })
}

/**
 * Full timestamp in the user's local timezone (e.g. "15 abr 2026 18:32")
 * — for created_at, updated_at, comment timestamps.
 */
export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: es })
}

/**
 * Short date in local timezone (e.g. "15 abr 2026") — for created_at/updated_at
 * when time is not needed.
 */
export function formatLocalDate(dateString: string): string {
  return format(new Date(dateString), 'dd MMM yyyy', { locale: es })
}

/**
 * Jira-style relative time for ticket detail timestamps.
 * < 1 min  → "just now"
 * < 60 min → "X minutes ago"
 * < 24 h   → "X hours ago"
 * otherwise → "12 Jun 2026"
 */
export function formatRelativeOrDate(dateString: string): string {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`
  return format(date, 'dd MMM yyyy', { locale: enUS })
}

export function isOverdue(dueDateString: string, isCompleted = false): boolean {
  if (isCompleted) return false
  const due = dueDateString.split('T')[0]
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return due < today
}
