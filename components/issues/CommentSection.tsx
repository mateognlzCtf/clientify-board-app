'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import ImageExtension from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import { createLowlight, common } from 'lowlight'
import { Trash2, Image as ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/providers/ToastProvider'
import type { CommentWithAuthor } from '@/types/comment.types'
import type { JSONContent } from '@tiptap/core'
import { formatDateTime } from '@/lib/utils/dates'
import type { ProjectMemberPreview } from '@/services/projects.service'
import { MentionList, type MentionListHandle } from '@/components/issues/MentionList'
import {
  getCommentsAction,
  createCommentAction,
  deleteCommentAction,
  uploadCommentImageAction,
} from '@/app/(dashboard)/project/[projectId]/comment-actions'

const lowlight = createLowlight(common)

function buildDisplayExtensions() {
  return [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    ImageExtension.configure({ inline: false, allowBase64: true }),
    Mention.configure({ HTMLAttributes: { class: 'mention-chip' } }),
  ]
}

function buildEditorExtensions(membersRef: React.MutableRefObject<ProjectMemberPreview[]>) {
  return [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    ImageExtension.configure({ inline: false, allowBase64: true }),
    Placeholder.configure({ placeholder: 'Write a comment… use @ to mention someone' }),
    Mention.configure({
      HTMLAttributes: { class: 'mention-chip' },
      suggestion: {
        items: ({ query }: { query: string }) =>
          membersRef.current
            .filter((m) =>
              (m.profile?.full_name ?? '').toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 8),

        render: () => {
          let renderer: ReactRenderer<MentionListHandle>
          let container: HTMLDivElement

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(MentionList, { props, editor: props.editor })
              container = document.createElement('div')
              container.style.cssText = 'position:fixed;z-index:9999'
              document.body.appendChild(container)
              container.appendChild(renderer.element)
              const rect = props.clientRect?.()
              if (rect) {
                container.style.top = `${rect.bottom + 6}px`
                container.style.left = `${rect.left}px`
              }
            },
            onUpdate: (props) => {
              renderer.updateProps(props)
              const rect = props.clientRect?.()
              if (rect && container) {
                container.style.top = `${rect.bottom + 6}px`
                container.style.left = `${rect.left}px`
              }
            },
            onKeyDown: ({ event }) => {
              if (event.key === 'Escape') {
                container?.remove()
                return true
              }
              return renderer.ref?.onKeyDown(event) ?? false
            },
            onExit: () => {
              container?.remove()
              renderer.destroy()
            },
          }
        },
      },
    }),
  ]
}

interface CommentSectionProps {
  issueId: string
  projectId: string
  currentUserId: string
  members?: ProjectMemberPreview[]
}

export function CommentSection({ issueId, projectId, currentUserId, members = [] }: CommentSectionProps) {
  const { toast } = useToast()
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [editorEmpty, setEditorEmpty] = useState(true)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Keep a ref so the suggestion closure always reads fresh members
  const membersRef = useRef(members)
  useEffect(() => { membersRef.current = members }, [members])

  // Same-browser tab sync for comments via BroadcastChannel
  useEffect(() => {
    const bc = new BroadcastChannel(`comment-sync-${issueId}`)
    bc.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: 'add'; comment: CommentWithAuthor & { content: JSONContent } } | { type: 'delete'; id: string }
      if (msg.type === 'add') {
        setComments((prev) => prev.some((c) => c.id === msg.comment.id) ? prev : [...prev, msg.comment])
      } else if (msg.type === 'delete') {
        setComments((prev) => prev.filter((c) => c.id !== msg.id))
      }
    }
    return () => bc.close()
  }, [issueId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extensions = useMemo(() => buildEditorExtensions(membersRef), [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    onUpdate: ({ editor }) => {
      let hasContent = false
      editor.state.doc.forEach((node) => {
        if (node.type.name === 'image') hasContent = true
        else if (node.textContent.length > 0) hasContent = true
      })
      setEditorEmpty(!hasContent)
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none min-h-[80px] px-3 py-2 text-gray-900 text-sm',
      },
    },
  })

  useEffect(() => {
    getCommentsAction(issueId).then(({ data }) => {
      if (data) {
        // contentJson is a string transported safely across the server action boundary
        setComments(data.map((c) => ({ ...c, content: JSON.parse(c.contentJson) as JSONContent })))
      }
      setLoading(false)
    })
  }, [issueId])

  async function handleImageFile(file: File) {
    setUploadingImage(true)
    try {
      const blob = await compressImage(file)
      const compressed = new File([blob], `image_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', compressed)
      const { data: src, error } = await uploadCommentImageAction(formData)
      if (error || !src) {
        toast(error ?? 'Error uploading image.', 'error')
        return
      }
      editor?.chain().focus().setImage({ src }).run()
    } catch (err) {
      console.error('[handleImageFile]', err)
      toast('Error processing image.', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit() {
    if (!editor || editorEmpty) return
    setSubmitting(true)

    // Pass content as a JSON string — Next.js server action serialization strips
    // nested `attrs` objects from plain JSONContent, so we stringify at the boundary.
    const content = editor.getJSON()
    const { data, error } = await createCommentAction({
      issue_id: issueId,
      projectId,
      contentJson: JSON.stringify(content),
    })

    if (error) {
      toast(error, 'error')
    } else if (data) {
      // Use local content for immediate display (server round-trip not needed).
      const newComment = { ...data, content }
      setComments((prev) => [...prev, newComment])
      editor.commands.clearContent()
      setEditorEmpty(true)
      // Broadcast to other tabs in the same browser
      const bc = new BroadcastChannel(`comment-sync-${issueId}`)
      bc.postMessage({ type: 'add', comment: newComment })
      bc.close()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {loading ? (
        <p className="text-xs text-gray-400">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-300 italic">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onDelete={(id) => {
              setComments((prev) => prev.filter((c) => c.id !== id))
              const bc = new BroadcastChannel(`comment-sync-${issueId}`)
              bc.postMessage({ type: 'delete', id })
              bc.close()
            }}
            />
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Toolbar */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive('bold')}
            label="B"
            className="font-bold"
            title="Bold"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive('italic')}
            label="I"
            className="italic"
            title="Italic"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleCode().run()}
            active={editor?.isActive('code')}
            label="<>"
            className="font-mono text-xs"
            title="Inline code"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            active={editor?.isActive('codeBlock')}
            label="{ }"
            className="font-mono text-xs"
            title="Code block"
          />
          <button
            type="button"
            title={uploadingImage ? 'Uploading image...' : 'Attach image'}
            onClick={() => !uploadingImage && imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="px-2 py-0.5 text-sm rounded transition-colors text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-wait"
          >
            {uploadingImage ? (
              <span className="inline-block h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImageIcon size={14} />
            )}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageFile(file)
              e.target.value = ''
            }}
          />
        </div>

        <EditorContent editor={editor} />

        <div className="flex justify-end px-2 py-1.5 border-t border-gray-100 bg-gray-50">
          <Button size="sm" onClick={handleSubmit} loading={submitting} disabled={editorEmpty || uploadingImage}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick, active, label, className, title,
}: {
  onClick: () => void
  active?: boolean
  label: string
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-0.5 text-sm rounded transition-colors ${
        active ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'
      } ${className ?? ''}`}
    >
      {label}
    </button>
  )
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: CommentWithAuthor & { content: JSONContent }
  currentUserId: string
  onDelete: (id: string) => void
}) {
  const { toast } = useToast()
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const displayExtensions = useMemo(() => buildDisplayExtensions(), [])

  const html = useMemo(() => {
    try {
      return generateHTML(comment.content as JSONContent, displayExtensions)
    } catch {
      return ''
    }
  }, [comment.content, displayExtensions])

  const initials = comment.author.full_name
    ? comment.author.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : comment.author.email[0]?.toUpperCase() ?? '?'

  const date = formatDateTime(comment.created_at)

  async function handleDelete() {
    const { error } = await deleteCommentAction(comment.id)
    if (error) toast(error, 'error')
    else onDelete(comment.id)
  }

  function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      setLightboxSrc((target as HTMLImageElement).src)
    }
  }

  return (
    <>
      <div className="flex gap-2.5">
        <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
          {comment.author.avatar_url ? (
            <img src={comment.author.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
          ) : (
            <span className="text-[10px] font-bold text-white">{initials}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-700">
              {comment.author.full_name ?? comment.author.email}
            </span>
            <span className="text-xs text-gray-400">{date}</span>
            {comment.author_id === currentUserId && (
              <button
                onClick={handleDelete}
                className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                title="Delete comment"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <div
            className="bg-gray-50 rounded-lg px-3 py-2 tiptap-content text-gray-900 text-sm"
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </>
  )
}

export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80"
      onClick={close}
    >
      <button
        onClick={close}
        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close image"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  )
}

// ── Image compression ────────────────────────────────────────────────────────

function compressImage(file: File, maxWidth = 1000, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('toBlob failed')) },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = reject
    img.src = objectUrl
  })
}
