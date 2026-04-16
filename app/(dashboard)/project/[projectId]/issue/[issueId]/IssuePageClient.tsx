'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IssueDetail } from '@/components/issues/IssueDetail'
import { IssueForm } from '@/components/issues/IssueForm'
import { useToast } from '@/providers/ToastProvider'
import { useRealtimeRefresh } from '@/lib/hooks/useRealtimeRefresh'
import { updateIssueAction, deleteIssueAction } from '../../actions'
import type { IssueWithDetails, IssueUpdate } from '@/types/issue.types'
import type { ProjectMemberPreview } from '@/services/projects.service'
import type { Sprint } from '@/types/sprint.types'

interface Props {
  issue: IssueWithDetails
  projectId: string
  currentUserId: string
  sprints: Sprint[]
  members: ProjectMemberPreview[]
}

export function IssuePageClient({ issue: initialIssue, projectId, currentUserId, sprints, members }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [issue, setIssue] = useState<IssueWithDetails>(initialIssue)
  const [copied, setCopied] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Cross-browser / cross-device sync via Supabase Realtime → router.refresh()
  useRealtimeRefresh(projectId)

  // Sync state when server delivers fresh data after router.refresh()
  useEffect(() => {
    setIssue(initialIssue)
  }, [initialIssue])

  // Same-browser tab sync via BroadcastChannel (no Supabase auth needed, instant)
  useEffect(() => {
    const bc = new BroadcastChannel(`issue-sync-${initialIssue.id}`)
    bc.onmessage = (e: MessageEvent<Partial<IssueWithDetails>>) => {
      setIssue((prev) => ({ ...prev, ...e.data }))
    }
    return () => bc.close()
  }, [initialIssue.id])

  async function handleEdit(data: IssueUpdate) {
    const { error } = await updateIssueAction(projectId, issue.id, data)
    if (error) { toast(error, 'error'); return }
    toast('Ticket updated.', 'success')
    setEditOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    setDeleteLoading(true)
    const { error } = await deleteIssueAction(projectId, issue.id)
    if (error) { toast(error, 'error') }
    else {
      toast('Ticket deleted.', 'success')
      router.push(`/project/${projectId}/backlog`)
    }
    setDeleteLoading(false)
  }

  return (
    <>
      {/* Page title */}
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{issue.key}</h1>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
          }}
          title="Copy link"
          className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 transition-colors"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Link2 size={16} />}
        </button>
      </div>

      {/* Issue detail */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <IssueDetail
          issue={issue}
          currentUserId={currentUserId}
          projectId={projectId}
          members={members}
          sprints={sprints}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onUpdated={(patch) => {
            setIssue((prev) => ({ ...prev, ...patch }))
            router.refresh()
          }}
        />
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit ticket">
        <IssueForm
          mode="edit"
          issue={issue}
          members={members}
          sprints={sprints}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete ticket"
        description={`Are you sure you want to delete "${issue.title}"? This cannot be undone.`}
        confirmLabel="Yes, delete"
      />
    </>
  )
}
