import type { IssuePriority } from '@/types/issue.types'

export const ISSUE_PRIORITIES: Record<
  IssuePriority,
  { label: string; color: string; bgColor: string }
> = {
  low: {
    label: 'Baja',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  medium: {
    label: 'Media',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
  },
  high: {
    label: 'Alta',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  urgent: {
    label: 'Urgente',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
}
