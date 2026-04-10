import { Bug, Star, CheckSquare, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { IssueType } from '@/types/issue.types'

const TYPE_CONFIG: Record<IssueType, { label: string; icon: React.ReactNode; className: string }> = {
  bug:         { label: 'Bug',         icon: <Bug size={13} />,         className: 'text-red-500' },
  feature:     { label: 'Feature',     icon: <Star size={13} />,        className: 'text-blue-500' },
  task:        { label: 'Task',        icon: <CheckSquare size={13} />, className: 'text-gray-500' },
  improvement: { label: 'Improvement', icon: <TrendingUp size={13} />,  className: 'text-purple-500' },
}

export function TypeIcon({ type, showLabel = false }: { type: IssueType; showLabel?: boolean }) {
  const config = TYPE_CONFIG[type]
  return (
    <span className={cn('inline-flex items-center gap-1', config.className)} title={config.label}>
      {config.icon}
      {showLabel && <span className="text-xs">{config.label}</span>}
    </span>
  )
}

export function typeLabel(type: IssueType): string {
  return TYPE_CONFIG[type]?.label ?? type
}

export const ALL_TYPES: IssueType[] = ['bug', 'feature', 'task', 'improvement']
