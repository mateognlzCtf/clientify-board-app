'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, Search, Ticket, MessageSquare, GripVertical, Layers, ChevronDown, CircleDot, Zap, Users, Flag, Settings2, MoreHorizontal, ExternalLink, Calendar, Tag, RotateCw, Link2 } from 'lucide-react'
import { JiraFilterButton, type FilterFieldDef } from '@/components/issues/JiraFilterButton'
import { AssigneeAvatars } from '@/components/issues/AssigneeAvatars'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { IssueForm } from '@/components/issues/IssueForm'
import { IssueDetail } from '@/components/issues/IssueDetail'
import { StatusBadge } from '@/components/issues/StatusBadge'
import { PriorityIcon, ALL_PRIORITIES, priorityLabel } from '@/components/issues/PriorityIcon'
import { TypeIcon } from '@/components/issues/TypeIcon'
import { useToast } from '@/providers/ToastProvider'
import { useProjectSettings, formatSettingLabel } from '@/contexts/ProjectSettingsContext'
import { useProjectData } from '@/contexts/ProjectDataContext'
import { cn } from '@/lib/utils/cn'
import { formatDate, isOverdue } from '@/lib/utils/dates'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useRealtimeRefresh } from '@/lib/hooks/useRealtimeRefresh'
import { useListColumnWidths, type ListColumnId } from '@/lib/hooks/useListColumnWidths'
import { useListColumnVisibility, LIST_COLUMN_LABELS, LIST_COLUMN_ORDER } from '@/lib/hooks/useListColumnVisibility'
import { RichTextEditor } from '@/components/issues/RichTextEditor'
import type { JSONContent } from '@tiptap/core'
import { uploadCommentImageAction } from '../comment-actions'
import type { IssueWithDetails, IssueCreate, IssueUpdate, IssuePriority } from '@/types/issue.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'
import type { Epic } from '@/types/epic.types'
import {
  createIssueAction,
  updateIssueAction,
  deleteIssueAction,
  loadIssuesListLiteAction,
  loadIssueGroupCountsAction,
} from '../actions'
import type { IssueListLite } from '@/types/issue.types'
import type { ProjectLabel as ProjectLabelType } from '@/types/project-settings.types'

function liteToFull(lite: IssueListLite): IssueWithDetails {
  return {
    ...lite,
    description: null,
    start_date: null,
    slack_thread: null,
    resolved_at: null,
  }
}

interface ActiveFilters {
  statuses: string[]
  priorities: string[]
  types: string[]
  assignees: string[]
  labels: string[]
  parents: string[]
}

interface IssuesClientProps {
  projectId: string
  currentUserId: string
  canDelete: boolean
  issues: IssueWithDetails[]
  initialHasMore: boolean
  initialTotal: number
  pageSize: number
  initialFilters: ActiveFilters
}

export function IssuesClient({ projectId, currentUserId, canDelete, issues, initialHasMore, initialTotal, pageSize, initialFilters }: IssuesClientProps) {
  const { sprints, members: rawMembers, epics } = useProjectData()
  const members = useMemo(
    () => [...rawMembers].sort((a, b) =>
      (a.profile?.full_name ?? a.user_id).localeCompare(
        b.profile?.full_name ?? b.user_id,
        undefined,
        { sensitivity: 'base' },
      ),
    ),
    [rawMembers],
  )
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { statuses: projectStatuses, types: projectTypes, labels: projectLabels } = useProjectSettings()
  const { widths: colWidths, setWidth: setColWidth } = useListColumnWidths()
  const { visible: colVisible, toggle: toggleColumn } = useListColumnVisibility()
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null)
  useRefreshOnFocus(() => setDetailTarget(null))
  useRealtimeRefresh(projectId)

  const [localIssues, setLocalIssues] = useState<IssueWithDetails[]>(
    [...issues].sort((a, b) => a.position - b.position)
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeIssue, setActiveIssue] = useState<IssueWithDetails | null>(null)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters)
  const [listGroupBy, setListGroupBy] = useState<'none' | 'status' | 'sprint' | 'assignee' | 'priority'>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [searchParams])
  const [detailTarget, setDetailTarget] = useState<IssueWithDetails | null>(null)
  // Keep the detail modal in sync with optimistic updates / new pages.
  // Read from `localIssues` (current client state) rather than the immutable
  // `issues` prop so tickets loaded via infinite scroll and inline edits both
  // reflect in an open modal.
  useEffect(() => {
    if (!detailTarget) return
    const fresh = localIssues.find((i) => i.id === detailTarget.id)
    if (fresh && fresh !== detailTarget) setDetailTarget(fresh)
  }, [localIssues, detailTarget])
  const [editTarget, setEditTarget] = useState<IssueWithDetails | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IssueWithDetails | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Update URL params when filters change
  const applyFilters = useCallback((next: ActiveFilters) => {
    setFilters(next)
    const params = new URLSearchParams(searchParams.toString())

    if (next.statuses.length) params.set('status', next.statuses.join(','))
    else params.delete('status')

    if (next.priorities.length) params.set('priority', next.priorities.join(','))
    else params.delete('priority')

    if (next.types.length) params.set('type', next.types.join(','))
    else params.delete('type')

    if (next.assignees.length) params.set('assignee', next.assignees.join(','))
    else params.delete('assignee')

    if (next.labels.length) params.set('label', next.labels.join(','))
    else params.delete('label')

    if (next.parents.length) params.set('parent', next.parents.join(','))
    else params.delete('parent')

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const hasActiveFilters = filters.statuses.length > 0 || filters.priorities.length > 0 ||
    filters.types.length > 0 || filters.assignees.length > 0 || filters.labels.length > 0 || filters.parents.length > 0

  // Server already applied filters; only search runs client-side over loaded items.
  const filtered = useMemo(() => {
    if (!search.trim()) return localIssues
    const q = search.trim().toLowerCase()
    return localIssues.filter((i) =>
      i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    )
  }, [localIssues, search])

  // React Query manages pagination + caching. For small projects the queryKey
  // is constant ('all') so changing filters never triggers a refetch — the
  // server already returned every ticket and filters apply client-side.
  // For large projects the queryKey includes the filters so each combination
  // is cached separately and revisiting a filter is instant.
  const queryClient = useQueryClient()
  const filterKey = useMemo(() => JSON.stringify(filters), [filters])

  const query = useInfiniteQuery({
    queryKey: ['issues-list', projectId, filterKey] as const,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await loadIssuesListLiteAction(projectId, pageParam, filters, pageSize)
      if (!data) return { data: [] as IssueWithDetails[], hasMore: false, total: 0 }
      return { data: data.data.map(liteToFull), hasMore: data.hasMore, total: data.total }
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.reduce((acc, p) => acc + p.data.length, 0) : undefined,
    initialData: { pages: [{ data: issues, hasMore: initialHasMore, total: initialTotal }], pageParams: [0] },
    // Mark initialData as freshly fetched so React Query doesn't trigger a
    // background refetch on mount (the server-rendered page is already current).
    initialDataUpdatedAt: Date.now(),
    staleTime: 30 * 1000,
    refetchOnMount: false,
  })

  const queryIssues = useMemo(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data]
  )

  // Sync localIssues from query when it changes (filters change, fetchNextPage, etc.)
  useEffect(() => {
    setLocalIssues([...queryIssues].sort((a, b) => a.position - b.position))
  }, [queryIssues])

  const hasMore = query.hasNextPage
  // Loading-more indicator + sentinel gate: only when the NEXT page is in flight.
  const loadingMore = query.isFetchingNextPage
  // Refresh button spinner: explicit local state so it spins ONLY when the
  // user clicks refresh, not on background invalidations from inline edits.
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true)
    try { await query.refetch() } finally { setManualRefreshing(false) }
  }, [query])

  // Total tickets matching the current server-side filters.
  const totalCount = useMemo(() => {
    const lastPage = query.data?.pages[query.data.pages.length - 1]
    return lastPage?.total ?? initialTotal
  }, [query.data, initialTotal])

  // Infinite scroll: when the sentinel comes into view (within the internal
  // scroll container, not the page), fetch the next page.
  // We keep the latest fetchNextPage / loadingMore in refs so the observer is
  // only re-created when `hasMore` toggles, not on every parent re-render.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fetchNextPageRef = useRef(query.fetchNextPage)
  fetchNextPageRef.current = query.fetchNextPage
  const loadingMoreRef = useRef(loadingMore)
  loadingMoreRef.current = loadingMore
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMoreRef.current) {
        fetchNextPageRef.current()
      }
    }, { root: scrollContainerRef.current, rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore])

  // When grouping is active, fetch real per-group totals from the server (the
  // visible groups would otherwise only count loaded rows, not the full set).
  const groupCountsQuery = useQuery({
    queryKey: ['issue-group-counts', projectId, filterKey, listGroupBy] as const,
    enabled: listGroupBy !== 'none',
    queryFn: async () => {
      if (listGroupBy === 'none') return {}
      const { data } = await loadIssueGroupCountsAction(projectId, filters, listGroupBy)
      return data ?? {}
    },
    staleTime: 30 * 1000,
  })
  const groupCounts = groupCountsQuery.data ?? {}

  // Invalidate the list query so realtime / mutations trigger a refetch.
  const invalidateList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['issues-list', projectId] })
    queryClient.invalidateQueries({ queryKey: ['issue-group-counts', projectId] })
  }, [queryClient, projectId])

  // Bridge: when the server component refetches (router.refresh from realtime
  // or revalidatePath from mutations), the `issues` prop reference changes.
  // Invalidate React Query so the displayed data stays fresh.
  const isFirstSync = useRef(true)
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false
      return
    }
    invalidateList()
  }, [issues, invalidateList])

  const groupedIssues = useMemo(() => {
    if (listGroupBy === 'none') return null
    const map = new Map<string, { key: string; label: string; issues: IssueWithDetails[] }>()
    for (const issue of filtered) {
      let key: string, label: string
      if (listGroupBy === 'status') {
        key = issue.status; label = formatSettingLabel(issue.status)
      } else if (listGroupBy === 'sprint') {
        key = issue.sprint_id ?? '__none__'
        label = sprints.find((s) => s.id === issue.sprint_id)?.name ?? 'Backlog'
      } else if (listGroupBy === 'assignee') {
        key = issue.assignee_id ?? '__unassigned__'
        label = issue.assignee?.full_name ?? 'Unassigned'
      } else {
        key = issue.priority; label = priorityLabel(issue.priority)
      }
      if (!map.has(key)) map.set(key, { key, label, issues: [] })
      map.get(key)!.issues.push(issue)
    }
    const groups = Array.from(map.values())
    if (listGroupBy === 'sprint') {
      groups.sort((a, b) => {
        if (a.key === '__none__') return 1
        if (b.key === '__none__') return -1
        const sa = sprints.find((s) => s.id === a.key)
        const sb = sprints.find((s) => s.id === b.key)
        const rank = (s: typeof sa) => s?.status === 'active' ? 0 : 1
        const r = rank(sa) - rank(sb)
        if (r !== 0) return r
        return (sa?.start_date ?? '') < (sb?.start_date ?? '') ? -1 : 1
      })
    }
    return groups
  }, [filtered, listGroupBy, sprints])

  function handleDragStart({ active }: DragStartEvent) {
    setActiveIssue(localIssues.find((i) => i.id === active.id) ?? null)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveIssue(null)
    if (!over || active.id === over.id) return
    const oldIndex = filtered.findIndex((i) => i.id === active.id)
    const newIndex = filtered.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(filtered, oldIndex, newIndex)
    const filteredIds = new Set(filtered.map((i) => i.id))
    const rest = localIssues.filter((i) => !filteredIds.has(i.id))
    setLocalIssues([...reordered, ...rest])
    await Promise.all(
      reordered.map((issue, idx) => updateIssueAction(projectId, issue.id, { position: idx }))
    )
  }

  async function handleGroupedDragEnd({ active, over }: DragEndEvent) {
    setActiveIssue(null)
    if (!over || active.id === over.id || !groupedIssues) return
    const sourceGroup = groupedIssues.find((g) => g.issues.some((i) => i.id === active.id))
    const targetGroup = groupedIssues.find((g) => g.issues.some((i) => i.id === over.id))
    if (!sourceGroup || !targetGroup) return

    if (sourceGroup.key === targetGroup.key) {
      // Reorder within same group
      const oldIndex = sourceGroup.issues.findIndex((i) => i.id === active.id)
      const newIndex = targetGroup.issues.findIndex((i) => i.id === over.id)
      const reordered = arrayMove(sourceGroup.issues, oldIndex, newIndex)
      setLocalIssues((prev) => {
        const groupIds = new Set(sourceGroup.issues.map((i) => i.id))
        const rest = prev.filter((i) => !groupIds.has(i.id))
        return [...rest, ...reordered]
      })
      await Promise.all(reordered.map((issue, idx) => updateIssueAction(projectId, issue.id, { position: idx })))
    } else {
      // Move to different group — update the grouped field
      const patch: IssueUpdate = {}
      if (listGroupBy === 'status') {
        const targetStatus = projectStatuses.find((s) => s.name === targetGroup.key)
        if (targetStatus?.requires_pause_reason) {
          toast('Open the ticket and fill in Pause reason before moving to this status.', 'error')
          return
        }
        patch.status = targetGroup.key as IssueWithDetails['status']
      } else if (listGroupBy === 'sprint') {
        patch.sprint_id = targetGroup.key === '__none__' ? null : targetGroup.key
      } else if (listGroupBy === 'assignee') {
        patch.assignee_id = targetGroup.key === '__unassigned__' ? null : targetGroup.key
      } else if (listGroupBy === 'priority') {
        patch.priority = targetGroup.key as IssueWithDetails['priority']
      }
      setLocalIssues((prev) => prev.map((i) => i.id === active.id ? { ...i, ...patch } : i))
      const { error } = await updateIssueAction(projectId, active.id as string, patch)
      if (error) { toast(error, 'error'); router.refresh() }
    }
  }

  async function handleCreate(data: IssueCreate) {
    try {
      const { error } = await createIssueAction(projectId, data)
      if (error) { toast(error, 'error'); return }
      toast('Ticket created.', 'success')
      setCreateOpen(false)
      router.refresh()
    } catch {
      toast('Unexpected error creating ticket.', 'error')
    }
  }

  async function handleEdit(data: IssueUpdate) {
    if (!editTarget) return
    try {
      const { error } = await updateIssueAction(projectId, editTarget.id, data)
      if (error) { toast(error, 'error'); return }
      toast('Ticket updated.', 'success')
      setEditTarget(null)
      router.refresh()
    } catch {
      toast('Unexpected error updating ticket.', 'error')
    }
  }

  // Optimistic inline edit for a single field. Called by each EditableCell.
  const handleInlineUpdate = useCallback(async (issueId: string, patch: IssueUpdate) => {
    setLocalIssues((prev) => prev.map((i) => {
      if (i.id !== issueId) return i
      const updated: IssueWithDetails = { ...i, ...patch } as IssueWithDetails
      // When label_ids changes, resolve the actual ProjectLabel objects so the row re-renders correctly
      if (patch.label_ids !== undefined) {
        updated.labels = patch.label_ids
          .map((id) => projectLabels.find((l) => l.id === id))
          .filter((l): l is typeof projectLabels[number] => !!l)
      }
      // Same for epic_id: resolve the nested epic so the Parent cell renders instantly
      if (patch.epic_id !== undefined) {
        updated.epic = patch.epic_id ? (epics.find((e) => e.id === patch.epic_id) ?? null) : null
      }
      // Same for assignee_id: resolve the nested assignee profile for the Assignee cell
      if (patch.assignee_id !== undefined) {
        updated.assignee = patch.assignee_id
          ? (rawMembers.find((m) => m.user_id === patch.assignee_id)?.profile ?? null)
          : null
      }
      return updated
    }))
    const { error } = await updateIssueAction(projectId, issueId, patch)
    if (error) {
      toast(error, 'error')
      invalidateList()
    }
  }, [projectId, toast, invalidateList, projectLabels, epics, rawMembers])

  const handleAddComment = useCallback(async (issueId: string, content: JSONContent) => {
    const contentJson = JSON.stringify(content)
    const { createCommentAction } = await import('../comment-actions')
    const { error } = await createCommentAction({ issue_id: issueId, contentJson, projectId })
    if (error) {
      toast(error, 'error')
      return
    }
    setLocalIssues((prev) => prev.map((i) =>
      i.id === issueId ? { ...i, comment_count: i.comment_count + 1 } : i
    ))
  }, [projectId, toast])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { error } = await deleteIssueAction(projectId, deleteTarget.id)
      if (error) { toast(error, 'error'); return }
      toast('Ticket deleted.', 'success')
      setDeleteTarget(null)
      setDetailTarget(null)
      router.refresh()
    } catch {
      toast('Unexpected error deleting ticket.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  function openEdit(issue: IssueWithDetails) {
    setDetailTarget(null)
    setEditTarget(issue)
  }

  function openDelete(issue: IssueWithDetails) {
    setDetailTarget(null)
    setDeleteTarget(issue)
  }

  function clearFilters() {
    applyFilters({ statuses: [], priorities: [], types: [], assignees: [], labels: [], parents: [] })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
        {/* Search */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
          />
        </div>

        {/* Assignee bubbles */}
        {members.length > 0 && (
          <AssigneeAvatars
            members={members}
            activeIds={filters.assignees}
            onToggle={(userId) =>
              applyFilters({
                ...filters,
                assignees: filters.assignees.includes(userId)
                  ? filters.assignees.filter((id) => id !== userId)
                  : [...filters.assignees, userId],
              })
            }
          />
        )}

        {/* Filter button */}
        <JiraFilterButton
          fields={[
            {
              id: 'statuses', label: 'Status',
              options: projectStatuses.map((s) => ({ value: s.name, label: formatSettingLabel(s.name) })),
            },
            {
              id: 'priorities', label: 'Priority',
              options: ALL_PRIORITIES.map((p) => ({ value: p, label: priorityLabel(p) })),
            },
            {
              id: 'types', label: 'Type',
              options: projectTypes.map((t) => ({ value: t.name, label: formatSettingLabel(t.name) })),
            },
            {
              id: 'assignees', label: 'Assignee',
              options: [
                { value: '__unassigned__', label: 'Unassigned' },
                ...members.map((m) => ({ value: m.user_id, label: m.profile?.full_name ?? m.user_id, avatarUrl: m.profile?.avatar_url ?? null, inactive: (m.profile?.status ?? 'active') !== 'active' })),
              ],
            },
            ...(epics.length > 0 ? [{
              id: 'parents', label: 'Parent',
              options: [
                { value: '__none__', label: 'No parent' },
                ...epics.map((ep) => ({ value: ep.id, label: ep.name, color: ep.color })),
              ],
            } satisfies FilterFieldDef] : []),
            ...(projectLabels.length > 0 ? [{
              id: 'labels', label: 'Labels',
              options: projectLabels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
            } satisfies FilterFieldDef] : []),
          ]}
          values={filters as unknown as Record<string, string[]>}
          onChange={(v) => applyFilters({ statuses: v.statuses ?? [], priorities: v.priorities ?? [], types: v.types ?? [], assignees: v.assignees ?? [], labels: v.labels ?? [], parents: v.parents ?? [] })}
        />

        {/* Group button */}
        <ListGroupButton groupBy={listGroupBy} onChange={setListGroupBy} />
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
          {filters.statuses.map((s) => (
            <FilterChip key={s} label={formatSettingLabel(s)} onRemove={() =>
              applyFilters({ ...filters, statuses: filters.statuses.filter((x) => x !== s) })} />
          ))}
          {filters.priorities.map((p) => (
            <FilterChip key={p} label={priorityLabel(p as IssuePriority)} onRemove={() =>
              applyFilters({ ...filters, priorities: filters.priorities.filter((x) => x !== p) })} />
          ))}
          {filters.types.map((t) => (
            <FilterChip key={t} label={formatSettingLabel(t)} onRemove={() =>
              applyFilters({ ...filters, types: filters.types.filter((x) => x !== t) })} />
          ))}
          {filters.assignees.map((a) => (
            <FilterChip
              key={a}
              label={a === '__unassigned__' ? 'Unassigned' : (members.find((m) => m.user_id === a)?.profile?.full_name ?? a)}
              onRemove={() => applyFilters({ ...filters, assignees: filters.assignees.filter((x) => x !== a) })}
            />
          ))}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
      <div className="w-full min-h-0 max-h-full flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto">
        {listGroupBy !== 'none' && groupedIssues ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleGroupedDragEnd}>
              <table className="text-sm whitespace-nowrap" style={{ tableLayout: 'fixed', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {colVisible.type && <ResizableTh id="type" label="Type" widths={colWidths} setWidth={setColWidth} />}
                    <ResizableTh id="key" label="Key" widths={colWidths} setWidth={setColWidth} />
                    {colVisible.summary && <ResizableTh id="summary" label="Summary" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.parent && <ResizableTh id="parent" label="Parent" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.labels && <ResizableTh id="labels" label="Labels" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.status && <ResizableTh id="status" label="Status" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.comments && <ResizableTh id="comments" label="Comments" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.sprint && <ResizableTh id="sprint" label="Sprint" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.assignee && <ResizableTh id="assignee" label="Assignee" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.due_date && <ResizableTh id="due_date" label="Due date" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.priority && <ResizableTh id="priority" label="Priority" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.created && <ResizableTh id="created" label="Created" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.updated && <ResizableTh id="updated" label="Updated" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.reporter && <ResizableTh id="reporter" label="Reporter" widths={colWidths} setWidth={setColWidth} />}
                    <th className="sticky top-0 z-20 bg-gray-50" />
                    <th style={{ width: 56, minWidth: 56, maxWidth: 56 }} className="sticky right-0 top-0 z-30 bg-gray-50 border-l border-gray-200 px-2 py-2.5">
                      <ColumnsConfigButton visible={colVisible} onToggle={toggleColumn} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groupedIssues.map((group) => {
                    const collapsed = collapsedGroups.has(group.key)
                    return (
                      <SortableContext key={group.key} items={group.issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <>
                          <tr className="bg-gray-50 border-t border-gray-100">
                            <td colSpan={16} className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCollapsedGroups((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(group.key)) next.delete(group.key)
                                    else next.add(group.key)
                                    return next
                                  })}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  <ChevronDown size={14} className={cn('transition-transform', collapsed && '-rotate-90')} />
                                </button>
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  {group.label}
                                </span>
                                <span className="text-xs font-medium text-gray-400">
                                  {(() => {
                                    const total = groupCounts[group.key] ?? group.issues.length
                                    return `${total} ${total === 1 ? 'ticket' : 'tickets'}`
                                  })()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCreateOpen(true)}
                                  className="ml-1 flex items-center justify-center h-4 w-4 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="Create ticket"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {!collapsed && group.issues.map((issue) => (
                            <SortableIssueRow
                              key={issue.id}
                              issue={issue}
                              sprints={sprints}
                              epics={epics}
                              members={members}
                              projectLabels={projectLabels}
                              onDetail={() => router.push(`/project/${projectId}/issue/${issue.id}`)}
                              onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
                              onAddComment={(text) => handleAddComment(issue.id, text)}
                              colVisible={colVisible}
                              menuOpen={rowMenuOpen === issue.id}
                              onMenuToggle={(open) => setRowMenuOpen(open ? issue.id : null)}
                            />
                          ))}
                        </>
                      </SortableContext>
                    )
                  })}
                </tbody>
              </table>
            <DragOverlay dropAnimation={null}>
              {activeIssue && (
                <div className="bg-white border border-blue-300 rounded-lg shadow-xl px-4 py-2 text-sm font-medium text-gray-800 opacity-95">
                  {activeIssue.key} — {activeIssue.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <table className="text-sm whitespace-nowrap" style={{ tableLayout: 'fixed', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {colVisible.type && <ResizableTh id="type" label="Type" widths={colWidths} setWidth={setColWidth} />}
                    <ResizableTh id="key" label="Key" widths={colWidths} setWidth={setColWidth} />
                    {colVisible.summary && <ResizableTh id="summary" label="Summary" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.parent && <ResizableTh id="parent" label="Parent" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.labels && <ResizableTh id="labels" label="Labels" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.status && <ResizableTh id="status" label="Status" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.comments && <ResizableTh id="comments" label="Comments" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.sprint && <ResizableTh id="sprint" label="Sprint" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.assignee && <ResizableTh id="assignee" label="Assignee" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.due_date && <ResizableTh id="due_date" label="Due date" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.priority && <ResizableTh id="priority" label="Priority" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.created && <ResizableTh id="created" label="Created" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.updated && <ResizableTh id="updated" label="Updated" widths={colWidths} setWidth={setColWidth} />}
                    {colVisible.reporter && <ResizableTh id="reporter" label="Reporter" widths={colWidths} setWidth={setColWidth} />}
                    <th className="sticky top-0 z-20 bg-gray-50" />
                    <th style={{ width: 56, minWidth: 56, maxWidth: 56 }} className="sticky right-0 top-0 z-30 bg-gray-50 border-l border-gray-200 px-2 py-2.5">
                      <ColumnsConfigButton visible={colVisible} onToggle={toggleColumn} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((issue) => (
                    <SortableIssueRow
                      key={issue.id}
                      issue={issue}
                      sprints={sprints}
                      epics={epics}
                      members={members}
                      projectLabels={projectLabels}
                      onDetail={() => router.push(`/project/${projectId}/issue/${issue.id}`)}
                      onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
                      onAddComment={(text) => handleAddComment(issue.id, text)}
                      colVisible={colVisible}
                      menuOpen={rowMenuOpen === issue.id}
                      onMenuToggle={(open) => setRowMenuOpen(open ? issue.id : null)}
                    />
                  ))}
                </tbody>
              </table>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeIssue && (
              <div className="bg-white border border-blue-300 rounded-lg shadow-xl px-4 py-2 text-sm font-medium text-gray-800 opacity-95">
                {activeIssue.key} — {activeIssue.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        )}

        {/* Infinite scroll sentinel + loading indicator */}
        {hasMore && (
          <div ref={sentinelRef} className="h-1" />
        )}
        {loadingMore && (
          <div className="flex justify-center py-2 text-xs text-gray-400 border-t border-gray-100">Loading more...</div>
        )}
        </div>

        {/* Footer: Create on the left, count + refresh centered — pinned outside the scroll */}
        <div className="grid grid-cols-3 items-center px-4 py-2 bg-white border-t border-gray-200 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors justify-self-start"
          >
            <Plus size={14} /> Create
          </button>
          <div className="flex items-center gap-2 text-gray-500 justify-self-center">
            <span>{filtered.length} of {totalCount}</span>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RotateCw size={12} className={cn(manualRefreshing && 'animate-spin')} />
            </button>
          </div>
          <div />
        </div>
      </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={<Ticket size={48} />}
          title="No tickets yet"
          description="Create the first ticket to start tracking work on this project."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={15} />
              Create first ticket
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<Search size={40} />}
          title="No results"
          description="No tickets match the current filters."
        />
      )}

      {/* Modal: ticket detail */}
      <Modal open={detailTarget !== null} onClose={() => setDetailTarget(null)} title={detailTarget?.key ?? ''} size="2xl" externalHref={detailTarget ? `/project/${projectId}/issue/${detailTarget.id}` : undefined}>
        {detailTarget && (
          <IssueDetail
            issue={detailTarget}
            currentUserId={currentUserId}
            projectId={projectId}
            members={members}
            sprints={sprints}
            epics={epics}
            canDelete={canDelete}
            onEdit={() => openEdit(detailTarget)}
            onDelete={() => openDelete(detailTarget)}
            onUpdated={(patch) => {
              const resolved = patch.label_ids !== undefined
                ? { ...patch, labels: projectLabels.filter((l) => patch.label_ids!.includes(l.id)) }
                : patch
              setDetailTarget((prev) => prev ? { ...prev, ...resolved } : prev)
              router.refresh()
            }}
          />
        )}
      </Modal>

      {/* Modal: create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New ticket" size="xl">
        <IssueForm mode="create" projectId={projectId} members={members} sprints={sprints} epics={epics} defaultSprintId={sprints.find((s) => s.status === 'active')?.id ?? null} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {/* Modal: edit */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Edit ticket" size="xl">
        {editTarget && (
          <IssueForm mode="edit" issue={editTarget} members={members} sprints={sprints} epics={epics} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
        )}
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete ticket"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Yes, delete"
      />
    </div>
  )
}

// ── Sortable row ─────────────────────────────────────────────────────────────

function SortableIssueRow({
  issue, sprints, epics, members, projectLabels, onDetail, onUpdate, onAddComment, disableDrag, colVisible, menuOpen, onMenuToggle,
}: {
  issue: IssueWithDetails
  sprints: Sprint[]
  epics: Epic[]
  members: ProjectMemberPreview[]
  projectLabels: ProjectLabelType[]
  onDetail: () => void
  onUpdate: (patch: IssueUpdate) => void
  onAddComment: (content: JSONContent) => void | Promise<void>
  disableDrag?: boolean
  colVisible: Record<ListColumnId, boolean>
  menuOpen: boolean
  onMenuToggle: (open: boolean) => void
}) {
  const { statuses: projectStatuses, types: projectTypes } = useProjectSettings()
  const { toast } = useToast()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id, disabled: disableDrag })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const sprint = sprints.find((s) => s.id === issue.sprint_id)
  const isCompleted = projectStatuses.find((s) => s.name === issue.status)?.is_completed ?? false

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${window.location.origin}/project/${issue.project_id}/issue/${issue.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied to clipboard.', 'success')
    } catch {
      toast('Could not copy link.', 'error')
    }
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('group hover:bg-gray-50 transition-colors', isDragging && 'opacity-40 bg-blue-50')}
    >
      {colVisible.type && (
        <td className="px-3 py-3 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {disableDrag ? (
              <span className="w-4 h-4 block shrink-0" />
            ) : (
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded shrink-0"
                tabIndex={-1}
              >
                <GripVertical size={14} />
              </button>
            )}
            <div className="relative inline-flex items-center cursor-pointer hover:bg-gray-100 rounded p-0.5">
              <TypeIcon type={issue.type} />
              <select
                value={issue.type}
                onChange={(e) => onUpdate({ type: e.target.value as IssueWithDetails['type'] })}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {projectTypes.map((t) => (
                  <option key={t.id} value={t.name}>{formatSettingLabel(t.name)}</option>
                ))}
              </select>
            </div>
          </div>
        </td>
      )}
      <td className="px-4 py-3 border-r border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'font-mono text-xs',
            isCompleted ? 'text-gray-300 line-through' : 'text-gray-400'
          )}>{issue.key}</span>
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy link"
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded p-0.5 transition-all"
          >
            <Link2 size={11} />
          </button>
        </div>
      </td>
      {colVisible.summary && (
        <td className="px-4 py-3 max-w-[260px] border-r border-gray-100 text-gray-900 font-medium">
          <InlineText
            value={issue.title}
            onSave={(v) => { if (v.trim()) onUpdate({ title: v.trim() }) }}
            placeholder="Untitled"
          />
        </td>
      )}
      {colVisible.parent && (
        <td className="px-4 py-3 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
          <div className="relative inline-block w-full cursor-pointer">
            {issue.epic ? (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[130px] block"
                style={{ backgroundColor: issue.epic.color + '22', color: issue.epic.color }}
              >
                {issue.epic.name}
              </span>
            ) : (
              <span className="text-gray-300 text-xs hover:bg-gray-100 rounded px-1 -mx-1">—</span>
            )}
            <select
              value={issue.epic_id ?? ''}
              onChange={(e) => onUpdate({ epic_id: e.target.value || null })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="">No epic</option>
              {epics.map((ep) => (
                <option key={ep.id} value={ep.id}>{ep.name}</option>
              ))}
            </select>
          </div>
        </td>
      )}
      {colVisible.labels && (
        <td className="px-4 py-3 border-r border-gray-100">
          <InlineLabels
            value={issue.labels ?? []}
            allLabels={projectLabels}
            onSave={(ids) => onUpdate({ label_ids: ids })}
          />
        </td>
      )}
      {colVisible.status && (
        <td className="px-4 py-3 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
          <div className="relative inline-block cursor-pointer">
            <StatusBadge status={issue.status} color={projectStatuses.find(s => s.name === issue.status)?.color ?? undefined} />
            <select
              value={issue.status}
              onChange={(e) => onUpdate({ status: e.target.value as IssueWithDetails['status'] })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {projectStatuses.map((s) => (
                <option key={s.id} value={s.name}>{formatSettingLabel(s.name)}</option>
              ))}
            </select>
          </div>
        </td>
      )}
      {colVisible.comments && (
        <td className="px-4 py-3 border-r border-gray-100">
          <InlineComment count={issue.comment_count} members={members} onAdd={onAddComment} />
        </td>
      )}
      {colVisible.sprint && (
        <td className="px-4 py-3 text-xs text-gray-600 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
          <div className="relative inline-block w-full cursor-pointer">
            {sprint ? (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs truncate max-w-[120px] block">
                {sprint.name}
              </span>
            ) : (
              <span className="text-gray-300 hover:bg-gray-100 rounded px-1 -mx-1">—</span>
            )}
            <select
              value={issue.sprint_id ?? ''}
              onChange={(e) => onUpdate({ sprint_id: e.target.value || null })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="">Backlog (no sprint)</option>
              {sprints.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>
        </td>
      )}
      {colVisible.assignee && (
        <td className="px-4 py-3 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
          <div className="relative inline-block w-full cursor-pointer">
            <UserCell person={issue.assignee} fallback="Unassigned" />
            <select
              value={issue.assignee_id ?? ''}
              onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? m.user_id}</option>
              ))}
            </select>
          </div>
        </td>
      )}
      {colVisible.due_date && (
        <td className={cn('px-4 py-3 border-r border-gray-100 text-xs', issue.due_date && isOverdue(issue.due_date, projectStatuses.find(s => s.name === issue.status)?.is_completed) ? 'text-red-500 font-medium' : 'text-gray-600')}>
          <InlineDate value={issue.due_date} onSave={(v) => onUpdate({ due_date: v })} />
        </td>
      )}
      {colVisible.priority && (
        <td className="px-4 py-3 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
          <div className="relative inline-block cursor-pointer">
            <PriorityIcon priority={issue.priority} showLabel />
            <select
              value={issue.priority}
              onChange={(e) => onUpdate({ priority: e.target.value as IssueWithDetails['priority'] })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>{priorityLabel(p)}</option>
              ))}
            </select>
          </div>
        </td>
      )}
      {colVisible.created && (
        <td className="px-4 py-3 text-xs text-gray-400 border-r border-gray-100">{formatDate(issue.created_at)}</td>
      )}
      {colVisible.updated && (
        <td className="px-4 py-3 text-xs text-gray-400 border-r border-gray-100">{formatDate(issue.updated_at)}</td>
      )}
      {colVisible.reporter && (
        <td className="px-4 py-3 border-r border-gray-100"><UserCell person={issue.reporter} fallback="Unknown" /></td>
      )}
      <td className="border-r border-gray-100" />
      <td
        className={cn(
          'sticky right-0 z-10 border-l border-gray-100 px-2 py-3 transition-colors',
          isDragging ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50',
        )}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 56 }}
      >
        <RowActionsButton open={menuOpen} onToggle={onMenuToggle} onView={onDetail} />
      </td>
    </tr>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 ml-0.5">×</button>
    </span>
  )
}

// ── List Group Button ─────────────────────────────────────────────────────────

type ListGroupBy = 'none' | 'status' | 'sprint' | 'assignee' | 'priority'

const GROUP_OPTIONS: { value: ListGroupBy; label: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'None', icon: <Layers size={14} /> },
  { value: 'status', label: 'Status', icon: <CircleDot size={14} /> },
  { value: 'sprint', label: 'Sprint', icon: <Zap size={14} /> },
  { value: 'assignee', label: 'Assignee', icon: <Users size={14} /> },
  { value: 'priority', label: 'Priority', icon: <Flag size={14} /> },
]

function ListGroupButton({ groupBy, onChange }: { groupBy: ListGroupBy; onChange: (v: ListGroupBy) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = GROUP_OPTIONS.find((o) => o.value === groupBy)!

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
          groupBy !== 'none'
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
        )}
      >
        <Layers size={14} />
        Group
        {groupBy !== 'none' && <span className="text-blue-500">: {active.label}</span>}
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-gray-200 shadow-xl w-44 py-1.5">
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Group by</p>
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors',
                groupBy === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className={cn(groupBy === opt.value ? 'text-blue-500' : 'text-gray-400')}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserCell({ person, fallback }: { person: { id: string; full_name: string | null; avatar_url: string | null; status?: string } | null; fallback: string }) {
  if (!person) return <span className="text-xs text-gray-300">{fallback}</span>
  const initials = person.full_name ? person.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() : '?'
  const inactive = person.status !== undefined && person.status !== 'active'
  return (
    <div className="flex items-center gap-1.5">
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" className={`h-5 w-5 rounded-full object-cover ${inactive ? 'grayscale opacity-60' : ''}`} />
      ) : (
        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${inactive ? 'bg-gray-400' : 'bg-blue-500'}`}>
          <span className="text-[8px] font-bold text-white">{initials}</span>
        </div>
      )}
      <span className="text-xs text-gray-600 truncate max-w-[80px]">{person.full_name ?? 'Unknown'}</span>
    </div>
  )
}

// ── Resizable column header ──────────────────────────────────────────────────

function ResizableTh({
  id, label, widths, setWidth, last,
}: {
  id: ListColumnId
  label: string
  widths: Record<ListColumnId, number>
  setWidth: (id: ListColumnId, next: number) => void
  last?: boolean
}) {
  const width = widths[id]

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(ev: MouseEvent) {
      const next = startWidth + (ev.clientX - startX)
      setWidth(id, next)
    }
    function onMouseUp() {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <th
      style={{ width, minWidth: width, maxWidth: width }}
      className={cn(
        'sticky top-0 z-20 bg-gray-50 text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide',
        !last && 'border-r border-gray-200'
      )}
    >
      <span className="truncate block">{label}</span>
      <span
        role="separator"
        aria-orientation="vertical"
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/60 transition-colors z-10"
      />
    </th>
  )
}

// ── Columns config button (renders menu via portal to escape table overflow) ──

function ColumnsConfigButton({
  visible, onToggle,
}: {
  visible: Record<ListColumnId, boolean>
  onToggle: (id: ListColumnId) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  function handleOpen() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(true)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Configure columns"
      >
        <Settings2 size={14} />
      </button>
      {open && position && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] text-left"
            style={{ top: position.top, right: position.right }}
          >
            <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Columns</p>
            {LIST_COLUMN_ORDER.map((id) => (
              <label key={id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visible[id]}
                  onChange={() => onToggle(id)}
                  className="rounded border-gray-300"
                />
                {LIST_COLUMN_LABELS[id]}
              </label>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ── Row actions button (3-dots menu via portal to escape table overflow) ────

function RowActionsButton({
  open, onToggle, onView,
}: {
  open: boolean
  onToggle: (open: boolean) => void
  onView: () => void
}) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  function handleOpen() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    onToggle(true)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? onToggle(false) : handleOpen())}
        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && position && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => onToggle(false)} />
          <div
            className="fixed z-[70] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{ top: position.top, right: position.right }}
          >
            <button
              type="button"
              onClick={() => { onToggle(false); onView() }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 text-left"
            >
              <ExternalLink size={12} />
              View work item
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ── Inline editors ──────────────────────────────────────────────────────────

function InlineText({
  value, onSave, placeholder,
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        className="block cursor-text hover:bg-gray-100 rounded px-1 -mx-1 truncate"
      >
        {value || <span className="text-gray-300">{placeholder ?? '—'}</span>}
      </span>
    )
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
        if (e.key === 'Escape') { setDraft(value); setEditing(false) }
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full px-1 -mx-1 border border-blue-500 rounded outline-none text-sm bg-white"
    />
  )
}

function InlineDate({
  value, onSave,
}: {
  value: string | null
  onSave: (v: string | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const formatted = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    const input = ref.current
    if (!input) return
    try {
      if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
        (input as HTMLInputElement & { showPicker: () => void }).showPicker()
      } else {
        input.focus()
        input.click()
      }
    } catch {
      input.focus()
    }
  }

  return (
    <span
      onClick={handleClick}
      className="inline-flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5"
    >
      <Calendar size={12} className="text-gray-400 shrink-0" />
      {formatted ? (
        <span>{formatted}</span>
      ) : (
        <span className="text-gray-400">None</span>
      )}
      <input
        ref={ref}
        type="date"
        value={value ?? ''}
        onChange={(e) => onSave(e.target.value || null)}
        onClick={(e) => e.stopPropagation()}
        className="sr-only"
      />
    </span>
  )
}

function InlineSelect<T extends string>({
  value, options, onSave, children,
}: {
  value: T
  options: { value: T; label: string }[]
  onSave: (v: T) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative inline-block w-full" onClick={(e) => e.stopPropagation()}>
      {children}
      <select
        value={value}
        onChange={(e) => onSave(e.target.value as T)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Inline labels editor (multi-select popover via portal) ───────────────────

function InlineLabels({
  value, allLabels, onSave,
}: {
  value: ProjectLabelType[]
  allLabels: ProjectLabelType[]
  onSave: (labelIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const selectedIds = useMemo(() => new Set(value.map((l) => l.id)), [value])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(true)
  }

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSave(Array.from(next))
  }

  return (
    <>
      <div
        ref={buttonRef}
        onClick={handleOpen}
        className="cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5 min-h-[24px] flex items-center"
      >
        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.map((l) => (
              <span
                key={l.id}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: l.color + '22', color: l.color }}
              >
                {l.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </div>
      {open && position && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] max-h-[300px] overflow-y-auto"
            style={{ top: position.top, left: position.left }}
          >
            <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Labels</p>
            {allLabels.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400 italic">No labels in this project</p>
            )}
            {allLabels.map((l) => (
              <label key={l.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(l.id)}
                  onChange={() => toggle(l.id)}
                  className="rounded border-gray-300"
                />
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: l.color + '22', color: l.color }}
                >
                  {l.name}
                </span>
              </label>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ── Inline comment editor (popover via portal) ──────────────────────────────

function InlineComment({
  count, members, onAdd,
}: {
  count: number
  members: ProjectMemberPreview[]
  onAdd: (contentJson: JSONContent) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const getJsonRef = useRef<(() => JSONContent) | null>(null)

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(true)
  }

  async function handleSubmit() {
    if (!getJsonRef.current || submitting) return
    const content = getJsonRef.current()
    const text = JSON.stringify(content)
    // Skip if empty
    if (!content.content || content.content.length === 0 || text === '{"type":"doc","content":[{"type":"paragraph"}]}') return
    setSubmitting(true)
    await onAdd(content)
    setSubmitting(false)
    setOpen(false)
  }

  async function uploadImage(file: File): Promise<string | null> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await uploadCommentImageAction(formData)
    return data
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-gray-400 hover:bg-gray-100 rounded px-1 -mx-1 py-0.5 transition-colors"
      >
        <MessageSquare size={13} />
        <span>
          {count > 0
            ? `${count} comment${count === 1 ? '' : 's'}`
            : 'Add comment'}
        </span>
      </button>
      {open && position && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[520px] max-w-[calc(100vw-24px)]"
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-gray-700 mb-2">Add comment</p>
            <RichTextEditor
              initialContent={null}
              members={members.map((m) => ({
                id: m.id,
                user_id: m.user_id,
                role: m.role,
                profile: m.profile,
              }))}
              placeholder="Write a comment… use @ to mention someone"
              allowMentions
              uploadImage={uploadImage}
              onReady={(getJson) => { getJsonRef.current = getJson }}
              minHeight="100px"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setOpen(false)}
                className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Comment'}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
