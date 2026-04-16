import { Bug, CheckSquare, Bookmark, TrendingUp, Zap, Star, Wrench, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// Maps lowercase type name → display config.
// Covers default types + common extras users may add via Settings.
const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  bug:         { label: 'Bug',         icon: <Bug size={13} />,         className: 'text-red-500' },
  task:        { label: 'Task',        icon: <CheckSquare size={13} />, className: 'text-blue-500' },
  feature:     { label: 'Feature',     icon: <Rocket size={13} />,      className: 'text-sky-500' },
  improvement: { label: 'Improvement', icon: <TrendingUp size={13} />,  className: 'text-amber-500' },
  story:       { label: 'Story',       icon: <Bookmark size={13} />,    className: 'text-green-500' },
  epic:        { label: 'Epic',        icon: <Zap size={13} />,         className: 'text-purple-500' },
  chore:       { label: 'Chore',       icon: <Wrench size={13} />,      className: 'text-gray-500' },
  spike:       { label: 'Spike',       icon: <Star size={13} />,        className: 'text-yellow-500' },
}

const FALLBACK_COLORS = [
  'bg-pink-500', 'bg-orange-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-violet-500', 'bg-rose-500', 'bg-lime-500',
]

function typeColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

export function TypeIcon({ type, showLabel = false }: { type: string; showLabel?: boolean }) {
  const config = TYPE_CONFIG[type?.toLowerCase()]
  const label = type?.replace(/_/g, ' ') ?? ''

  if (!config) {
    const letter = label.trim().charAt(0).toUpperCase() || '?'
    return (
      <span className="inline-flex items-center gap-1" title={label}>
        <span className={cn('inline-flex items-center justify-center rounded-sm text-white font-bold leading-none', typeColor(label.toLowerCase()))}
          style={{ width: 13, height: 13, fontSize: 8 }}>
          {letter}
        </span>
        {showLabel && <span className="text-xs capitalize text-gray-600">{label}</span>}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1', config.className)} title={config.label}>
      {config.icon}
      {showLabel && <span className="text-xs">{config.label}</span>}
    </span>
  )
}

export function typeLabel(type: string): string {
  return TYPE_CONFIG[type?.toLowerCase()]?.label ?? type?.replace(/_/g, ' ') ?? type
}

export type IssueType = keyof typeof TYPE_CONFIG
export const ALL_TYPES = Object.keys(TYPE_CONFIG) as IssueType[]
