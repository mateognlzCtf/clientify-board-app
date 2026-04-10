import type { IssueType } from '@/types/issue.types'

export const ISSUE_TYPES: Record<
  IssueType,
  { label: string; color: string; bgColor: string }
> = {
  bug: {
    label: 'Bug',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  feature: {
    label: 'Feature',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  task: {
    label: 'Tarea',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  improvement: {
    label: 'Mejora',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
}
