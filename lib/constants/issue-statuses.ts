import type { IssueStatus } from '@/types/issue.types'

export const ISSUE_STATUSES: Record<
  IssueStatus,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  backlog: {
    label: 'Backlog',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    dotColor: 'bg-gray-400',
  },
  todo: {
    label: 'Por hacer',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    dotColor: 'bg-blue-500',
  },
  in_progress: {
    label: 'En progreso',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    dotColor: 'bg-yellow-500',
  },
  in_review: {
    label: 'En revisión',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    dotColor: 'bg-purple-500',
  },
  done: {
    label: 'Hecho',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    dotColor: 'bg-green-500',
  },
}

export const ISSUE_STATUS_ORDER: IssueStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
]
