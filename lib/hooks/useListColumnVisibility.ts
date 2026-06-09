'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ListColumnId } from './useListColumnWidths'

const STORAGE_KEY = 'list-column-visibility-v1'

const DEFAULT_VISIBILITY: Record<ListColumnId, boolean> = {
  type: true,
  key: true,
  summary: true,
  parent: true,
  labels: true,
  status: true,
  comments: true,
  sprint: true,
  assignee: true,
  due_date: true,
  priority: true,
  created: true,
  updated: true,
  reporter: true,
}

export const LIST_COLUMN_LABELS: Record<ListColumnId, string> = {
  type: 'Type',
  key: 'Key',
  summary: 'Summary',
  parent: 'Parent',
  labels: 'Labels',
  status: 'Status',
  comments: 'Comments',
  sprint: 'Sprint',
  assignee: 'Assignee',
  due_date: 'Due date',
  priority: 'Priority',
  created: 'Created',
  updated: 'Updated',
  reporter: 'Reporter',
}

/** Columns the user can toggle from the "Configure columns" menu. `key` is
 * intentionally excluded — it's the primary identifier and always shown. */
export const LIST_COLUMN_ORDER: ListColumnId[] = [
  'type', 'summary', 'parent', 'labels', 'status',
  'comments', 'sprint', 'assignee', 'due_date', 'priority',
  'created', 'updated', 'reporter',
]

export function useListColumnVisibility() {
  const [visible, setVisible] = useState<Record<ListColumnId, boolean>>(DEFAULT_VISIBILITY)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<Record<ListColumnId, boolean>>
      setVisible((prev) => ({ ...prev, ...parsed }))
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback((id: ListColumnId) => {
    setVisible((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { visible, toggle }
}
