'use client'

import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface FilterFieldDef {
  id: string
  label: string
  options: { value: string; label: string; color?: string; avatarUrl?: string | null }[]
}

export function JiraFilterButton({
  fields,
  values,
  onChange,
}: {
  fields: FilterFieldDef[]
  values: Record<string, string[]>
  onChange: (v: Record<string, string[]>) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeField, setActiveField] = useState(fields[0]?.id ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fields.length > 0 && !fields.find((f) => f.id === activeField)) {
      setActiveField(fields[0].id)
    }
  }, [fields, activeField])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const totalActive = Object.values(values).reduce((sum, arr) => sum + arr.length, 0)
  const hasFilters = totalActive > 0
  const currentField = fields.find((f) => f.id === activeField) ?? fields[0]

  function toggle(fieldId: string, value: string) {
    const current = values[fieldId] ?? []
    onChange({
      ...values,
      [fieldId]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    })
  }

  function clearAll() {
    onChange(Object.fromEntries(fields.map((f) => [f.id, []])))
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors',
          hasFilters
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
        )}
      >
        <SlidersHorizontal size={14} />
        Filter
        {totalActive > 0 && (
          <span className="bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
            {totalActive}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-40 bg-white rounded-xl border border-gray-200 shadow-2xl flex overflow-hidden"
          style={{ minWidth: 420 }}
        >
          {/* Left: field list */}
          <div className="w-44 border-r border-gray-100 py-1 bg-gray-50">
            <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filter by</p>
            {fields.map((field) => {
              const count = (values[field.id] ?? []).length
              const isActive = field.id === activeField
              return (
                <button
                  key={field.id}
                  onClick={() => setActiveField(field.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white text-blue-700 font-semibold border-r-2 border-blue-500'
                      : 'text-gray-700 hover:bg-white'
                  )}
                >
                  <span>{field.label}</span>
                  <div className="flex items-center gap-1">
                    {count > 0 && (
                      <span className="bg-blue-600 text-white rounded-full px-1.5 text-[10px] font-bold leading-4">
                        {count}
                      </span>
                    )}
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                </button>
              )
            })}
            {totalActive > 0 && (
              <div className="border-t border-gray-100 mt-1 px-3 py-2">
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

          {/* Right: options */}
          <div className="flex-1 py-1 min-w-[220px]">
            <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {currentField?.label}
            </p>
            <div className="max-h-64 overflow-y-auto">
              {currentField?.options.map((opt) => {
                const checked = (values[currentField.id] ?? []).includes(opt.value)
                const initials = opt.label.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggle(currentField.id, opt.value)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                      checked ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span className={cn(
                      'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    )}>
                      {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                    </span>

                    {opt.avatarUrl !== undefined && (
                      opt.avatarUrl ? (
                        <img src={opt.avatarUrl} className="h-5 w-5 rounded-full object-cover shrink-0" alt="" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-white">{initials}</span>
                        </div>
                      )
                    )}

                    {opt.color ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: opt.color + '22', color: opt.color }}
                      >
                        {opt.label}
                      </span>
                    ) : (
                      <span className="truncate">{opt.label}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
