import { formatDistanceToNow, format, parseISO, isPast } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatRelativeDate(dateString: string): string {
  return formatDistanceToNow(parseISO(dateString), {
    addSuffix: true,
    locale: es,
  })
}

export function formatDate(dateString: string): string {
  return format(parseISO(dateString), 'dd MMM yyyy', { locale: es })
}

export function formatDateTime(dateString: string): string {
  return format(parseISO(dateString), 'dd MMM yyyy HH:mm', { locale: es })
}

export function isOverdue(dueDateString: string): boolean {
  return isPast(parseISO(dueDateString))
}
