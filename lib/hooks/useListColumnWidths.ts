'use client'

import { useState, useEffect, useCallback } from 'react'

export type ListColumnId =
  | 'type'
  | 'key'
  | 'summary'
  | 'parent'
  | 'labels'
  | 'status'
  | 'comments'
  | 'sprint'
  | 'assignee'
  | 'due_date'
  | 'priority'
  | 'created'
  | 'updated'
  | 'reporter'

export const DEFAULT_LIST_COLUMN_WIDTHS: Record<ListColumnId, number> = {
  type: 112,
  key: 96,
  summary: 280,
  parent: 144,
  labels: 144,
  status: 128,
  comments: 120,
  sprint: 128,
  assignee: 140,
  due_date: 112,
  priority: 96,
  created: 112,
  updated: 112,
  reporter: 140,
}

const STORAGE_KEY = 'list-column-widths-v1'
const MIN_WIDTH = 60
const MAX_WIDTH = 600

export function useListColumnWidths() {
  const [widths, setWidths] = useState<Record<ListColumnId, number>>(DEFAULT_LIST_COLUMN_WIDTHS)

  // Load saved widths from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<Record<ListColumnId, number>>
      setWidths((prev) => ({ ...prev, ...parsed }))
    } catch {
      /* ignore */
    }
  }, [])

  const setWidth = useCallback((id: ListColumnId, next: number) => {
    setWidths((prev) => {
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next))
      const updated = { ...prev, [id]: clamped }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        /* ignore */
      }
      return updated
    })
  }, [])

  return { widths, setWidth }
}
