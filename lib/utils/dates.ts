import { formatDistanceToNow, format, parseISO, isPast } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatRelativeDate(dateString: string): string {
  return formatDistanceToNow(parseISO(dateString), {
    addSuffix: true,
    locale: es,
  })
}

export function formatDate(dateString: string): string {
  // Split off any time component so DATE-only strings stay in local time
  const [y, m, d] = dateString.split('T')[0].split('-').map(Number)
  return format(new Date(y, m - 1, d), 'dd MMM yyyy', { locale: es })
}

export function formatDateTime(dateString: string): string {
  return format(parseISO(dateString), 'dd MMM yyyy HH:mm', { locale: es })
}

export function isOverdue(dueDateString: string): boolean {
  // Jira-style: compare calendar dates as strings (no timezone conversion)
  // A ticket due today is NOT overdue — only strictly past dates are
  const due = dueDateString.split('T')[0]
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return due < today
}
