import type { IssueStatus } from '@/types/issue.types'

export const ISSUE_STATUSES: Record<
  IssueStatus,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
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
  staging_qa: {
    label: 'Staging / QA',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    dotColor: 'bg-orange-500',
  },
  ready_for_production: {
    label: 'Listo para prod.',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    dotColor: 'bg-teal-500',
  },
  done: {
    label: 'Hecho',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    dotColor: 'bg-green-500',
  },
  canceled: {
    label: 'Cancelado',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    dotColor: 'bg-gray-400',
  },
  stopper: {
    label: 'Stopper',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    dotColor: 'bg-red-500',
  },
}

export const ISSUE_STATUS_ORDER: IssueStatus[] = [
  'todo',
  'in_progress',
  'in_review',
  'staging_qa',
  'ready_for_production',
  'done',
  'canceled',
  'stopper',
]
