'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown, PauseCircle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/providers/ToastProvider'
import { formatSettingLabel } from '@/contexts/ProjectSettingsContext'
import type { Epic } from '@/types/epic.types'
import type { ProjectStatus, ProjectIssueType } from '@/types/project-settings.types'
import {
  createEpicSettingsAction, updateEpicSettingsAction, deleteEpicSettingsAction,
  createStatusAction, updateStatusAction, deleteStatusAction, reorderStatusesAction,
  createTypeAction, updateTypeAction, deleteTypeAction, reorderTypesAction,
  deleteProjectSettingsAction,
} from '../settings-actions'

interface Props {
  projectId: string
  epics: Epic[]
  statuses: ProjectStatus[]
  types: ProjectIssueType[]
}

export function SettingsClient({ projectId, epics: initialEpics, statuses: initialStatuses, types: initialTypes }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [epics, setEpics] = useState(initialEpics)
  const [statuses, setStatuses] = useState(initialStatuses)
  const [types, setTypes] = useState(initialTypes)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [deleteProjectLoading, setDeleteProjectLoading] = useState(false)

  function refresh() { router.refresh() }

  async function handleDeleteProject() {
    setDeleteProjectLoading(true)
    const { error } = await deleteProjectSettingsAction(projectId)
    setDeleteProjectLoading(false)
    if (error) { toast(error, 'error'); return }
    toast('Project deleted.', 'success')
    router.refresh()
    router.push('/dashboard')
  }

  return (
    <div className="space-y-8">
      <SettingSection
        title="Epics"
        description="Group tickets under epics. Manage colors and names here."
      >
        <EpicsManager projectId={projectId} epics={epics} setEpics={setEpics} toast={toast} refresh={refresh} />
      </SettingSection>

      <SettingSection
        title="Statuses"
        description="Define the workflow statuses for this project. Order determines board column order."
      >
        <StatusManager
          projectId={projectId}
          statuses={statuses}
          setStatuses={setStatuses}
          toast={toast}
          refresh={refresh}
        />
      </SettingSection>

      <SettingSection
        title="Issue types"
        description="Define the types of issues for this project."
      >
        <ItemManager
          projectId={projectId}
          items={types}
          setItems={setTypes}
          toast={toast}
          refresh={refresh}
          onCreate={(projectId, name, color, pos) => createTypeAction(projectId, name, color, pos)}
          onUpdate={(projectId, id, name, color) => updateTypeAction(projectId, id, name, color)}
          onDelete={(projectId, id) => deleteTypeAction(projectId, id)}
          onReorder={(projectId, updates) => reorderTypesAction(projectId, updates)}
        />
      </SettingSection>
      <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Delete project</p>
              <p className="text-xs text-gray-500 mt-0.5">Permanently deletes all tickets, comments, sprints and epics.</p>
            </div>
            <button
              onClick={() => setDeleteProjectOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} /> Delete project
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteProjectOpen}
        onClose={() => setDeleteProjectOpen(false)}
        onConfirm={handleDeleteProject}
        loading={deleteProjectLoading}
        title="Delete project"
        description="Are you sure you want to permanently delete this project? All tickets, comments, sprints and epics will be deleted. This cannot be undone."
        confirmLabel="Yes, delete project"
      />
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function SettingSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Epics manager ─────────────────────────────────────────────────────────────

function EpicsManager({
  projectId, epics, setEpics, toast, refresh,
}: {
  projectId: string
  epics: Epic[]
  setEpics: React.Dispatch<React.SetStateAction<Epic[]>>
  toast: (msg: string, type: 'success' | 'error') => void
  refresh: () => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#6366f1')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading(true)
    const { data, error } = await createEpicSettingsAction(projectId, newName.trim(), newColor)
    setLoading(false)
    if (error || !data) { toast(error ?? 'Error', 'error'); return }
    setEpics((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName('')
    setNewColor('#6366f1')
    toast('Epic created.', 'success')
    refresh()
  }

  async function handleUpdate(id: string) {
    const { data, error } = await updateEpicSettingsAction(projectId, id, editName.trim(), editColor)
    if (error || !data) { toast(error ?? 'Error', 'error'); return }
    setEpics((prev) => prev.map((e) => e.id === id ? data : e))
    setEditId(null)
    toast('Epic updated.', 'success')
    refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await deleteEpicSettingsAction(projectId, id)
    if (error) { toast(error, 'error'); return }
    setEpics((prev) => prev.filter((e) => e.id !== id))
    toast('Epic deleted.', 'success')
    refresh()
  }

  return (
    <div className="space-y-2">
      {epics.map((epic) => (
        <div key={epic.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
          {editId === epic.id ? (
            <>
              <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-7 w-7 rounded cursor-pointer border border-gray-200 p-0.5" />
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(epic.id); if (e.key === 'Escape') setEditId(null) }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => handleUpdate(epic.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
            </>
          ) : (
            <>
              <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
              <span
                className="flex-1 text-sm font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: epic.color + '22', color: epic.color }}
              >
                {epic.name}
              </span>
              <button onClick={() => { setEditId(epic.id); setEditName(epic.name); setEditColor(epic.color) }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(epic.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      ))}

      {/* Add new */}
      <div className="flex items-center gap-2 pt-2">
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-7 w-7 rounded cursor-pointer border border-gray-200 p-0.5" />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="New epic name…"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
        <button
          onClick={handleCreate}
          disabled={loading || !newName.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

// ── Status manager (with requires_pause_reason toggle) ───────────────────────

function StatusManager({
  projectId, statuses, setStatuses, toast, refresh,
}: {
  projectId: string
  statuses: ProjectStatus[]
  setStatuses: React.Dispatch<React.SetStateAction<ProjectStatus[]>>
  toast: (msg: string, type: 'success' | 'error') => void
  refresh: () => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#6b7280')
  const [editPause, setEditPause] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6b7280')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading(true)
    const nextPos = (statuses[statuses.length - 1]?.position ?? 0) + 1000
    const { data, error } = await createStatusAction(projectId, newName.trim(), newColor, nextPos)
    setLoading(false)
    if (error || !data) { toast(error ?? 'Error', 'error'); return }
    setStatuses((prev) => [...prev, data])
    setNewName('')
    setNewColor('#6b7280')
    toast('Created.', 'success')
    refresh()
  }

  async function handleUpdate(id: string) {
    const { data, error } = await updateStatusAction(projectId, id, editName.trim(), editColor, editPause)
    if (error || !data) { toast(error ?? 'Error', 'error'); return }
    setStatuses((prev) => prev.map((s) => s.id === id ? data : s))
    setEditId(null)
    toast('Updated.', 'success')
    refresh()
  }

  async function handleTogglePause(status: ProjectStatus) {
    const { data, error } = await updateStatusAction(projectId, status.id, status.name, status.color, !status.requires_pause_reason)
    if (error || !data) { toast(error ?? 'Error', 'error'); return }
    setStatuses((prev) => prev.map((s) => s.id === status.id ? data : s))
    refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await deleteStatusAction(projectId, id)
    if (error) { toast(error, 'error'); return }
    setStatuses((prev) => prev.filter((s) => s.id !== id))
    toast('Deleted.', 'success')
    refresh()
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const newItems = [...statuses]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newItems.length) return
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]
    const updates = newItems.map((s, i) => ({ id: s.id, position: (i + 1) * 1000 }))
    setStatuses(newItems.map((s, i) => ({ ...s, position: (i + 1) * 1000 })))
    await reorderStatusesAction(projectId, updates)
    refresh()
  }

  return (
    <div className="space-y-2">
      {statuses.map((status, index) => (
        <div key={status.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
          {editId === status.id ? (
            <>
              <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-7 w-7 rounded cursor-pointer border border-gray-200 p-0.5" />
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(status.id); if (e.key === 'Escape') setEditId(null) }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none shrink-0">
                <input type="checkbox" checked={editPause} onChange={(e) => setEditPause(e.target.checked)} className="rounded" />
                Pause reason
              </label>
              <button onClick={() => handleUpdate(status.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronUp size={12} /></button>
                <button onClick={() => handleMove(index, 'down')} disabled={index === statuses.length - 1} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronDown size={12} /></button>
              </div>
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
              <span
                className="flex-1 text-xs font-semibold px-2 py-0.5 rounded border"
                style={{ backgroundColor: status.color + '22', color: status.color, borderColor: status.color + '44' }}
              >
                {formatSettingLabel(status.name)}
              </span>
              <button
                onClick={() => handleTogglePause(status)}
                title={status.requires_pause_reason ? 'Requires pause reason (click to disable)' : 'Does not require pause reason (click to enable)'}
                className={`p-1 rounded transition-colors ${status.requires_pause_reason ? 'text-orange-500 bg-orange-50 hover:bg-orange-100' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
              >
                <PauseCircle size={14} />
              </button>
              <button onClick={() => { setEditId(status.id); setEditName(status.name); setEditColor(status.color); setEditPause(status.requires_pause_reason) }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(status.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-7 w-7 rounded cursor-pointer border border-gray-200 p-0.5" />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="New status name…"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
        <button
          onClick={handleCreate}
          disabled={loading || !newName.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}

// ── Generic item manager (Statuses & Types) ───────────────────────────────────

type ItemBase = { id: string; name: string; color: string; position: number }

function ItemManager<T extends ItemBase>({
  projectId, items, setItems, toast, refresh,
  onCreate, onUpdate, onDelete, onReorder,
}: {
  projectId: string
  items: T[]
  setItems: React.Dispatch<React.SetStateAction<T[]>>
  toast: (msg: string, type: 'success' | 'error') => void
  refresh: () => void
  onCreate: (projectId: string, name: string, color: string, position: number) => Promise<{ data: T | null; error: string | null }>
  onUpdate: (projectId: string, id: string, name: string, color: string) => Promise<{ data: T | null; error: string | null }>
  onDelete: (projectId: string, id: string) => Promise<{ data: null; error: string | null }>
  onReorder: (projectId: string, updates: { id: string; position: number }[]) => Promise<{ data: null; error: string | null }>
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#6b7280')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6b7280')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading(true)
    const nextPos = (items[items.length - 1]?.position ?? 0) + 1000
    const { data, error } = await onCreate(projectId, newName.trim(), newColor, nextPos)
    setLoading(false)
    if (error || !data) { toast(error ?? 'Error', 'error'); return }
    setItems((prev) => [...prev, data])
    setNewName('')
    setNewColor('#6b7280')
    toast('Created.', 'success')
    refresh()
  }

  async function handleUpdate(id: string) {
    const { data, error } = await onUpdate(projectId, id, editName.trim(), editColor)
    if (error || !data) { toast(error ?? 'Error', 'error'); return }
    setItems((prev) => prev.map((i) => i.id === id ? data : i))
    setEditId(null)
    toast('Updated.', 'success')
    refresh()
  }

  async function handleDelete(id: string) {
    const { error } = await onDelete(projectId, id)
    if (error) { toast(error, 'error'); return }
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast('Deleted.', 'success')
    refresh()
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const newItems = [...items]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newItems.length) return
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]
    const updates = newItems.map((item, i) => ({ id: item.id, position: (i + 1) * 1000 }))
    setItems(newItems.map((item, i) => ({ ...item, position: (i + 1) * 1000 })) as T[])
    await onReorder(projectId, updates)
    refresh()
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
          {editId === item.id ? (
            <>
              <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-7 w-7 rounded cursor-pointer border border-gray-200 p-0.5" />
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(item.id); if (e.key === 'Escape') setEditId(null) }}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => handleUpdate(item.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronUp size={12} /></button>
                <button onClick={() => handleMove(index, 'down')} disabled={index === items.length - 1} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20"><ChevronDown size={12} /></button>
              </div>
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span
                className="flex-1 text-xs font-semibold px-2 py-0.5 rounded border"
                style={{ backgroundColor: item.color + '22', color: item.color, borderColor: item.color + '44' }}
              >
                {formatSettingLabel(item.name)}
              </span>
              <button onClick={() => { setEditId(item.id); setEditName(item.name); setEditColor(item.color) }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      ))}

      {/* Add new */}
      <div className="flex items-center gap-2 pt-2">
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-7 w-7 rounded cursor-pointer border border-gray-200 p-0.5" />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="New name…"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
        <button
          onClick={handleCreate}
          disabled={loading || !newName.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  )
}
