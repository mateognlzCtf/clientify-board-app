import type { IssuePriority } from '@/types/issue.types'

export const ISSUE_PRIORITIES: Record<
  IssuePriority,
  { label: string; color: string; bgColor: string }
> = {
  lowest: {
    label: 'Mínima',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
  },
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
  highest: {
    label: 'Crítica',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
}
