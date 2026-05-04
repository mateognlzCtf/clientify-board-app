'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import ImageExtension from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import { createLowlight, common } from 'lowlight'
import { Image as ImageIcon, Link as LinkIcon } from 'lucide-react'
import LinkExtension from '@tiptap/extension-link'
import type { JSONContent } from '@tiptap/core'
import type { ProjectMemberPreview } from '@/services/projects.service'
import { MentionList, type MentionListHandle } from '@/components/issues/MentionList'

const lowlight = createLowlight(common)

export function buildDisplayExtensions() {
  return [
    StarterKit.configure({ codeBlock: false, link: false }),
    CodeBlockLowlight.configure({ lowlight }),
    ImageExtension.configure({ inline: false, allowBase64: true }),
    LinkExtension.configure({ openOnClick: true, HTMLAttributes: { class: 'tiptap-link', target: '_blank', rel: 'noopener noreferrer' } }),
    Mention.configure({ HTMLAttributes: { class: 'mention-chip' } }),
  ]
}

function buildEditorExtensions(
  membersRef: React.MutableRefObject<ProjectMemberPreview[]>,
  placeholder: string,
  allowMentions: boolean,
) {
  const base = [
    StarterKit.configure({ codeBlock: false, link: false }),
    CodeBlockLowlight.configure({ lowlight }),
    ImageExtension.configure({ inline: false, allowBase64: true }),
    LinkExtension.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link', target: '_blank', rel: 'noopener noreferrer' } }),
    Placeholder.configure({ placeholder }),
  ]
  if (!allowMentions) return base
  return [
    ...base,
    Mention.configure({
      HTMLAttributes: { class: 'mention-chip' },
      suggestion: {
        items: ({ query }: { query: string }) =>
          membersRef.current
            .filter((m) => (m.profile?.full_name ?? '').toLowerCase().includes(query.toLowerCase()))
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
              if (rect) { container.style.top = `${rect.bottom + 6}px`; container.style.left = `${rect.left}px` }
            },
            onUpdate: (props) => {
              renderer.updateProps(props)
              const rect = props.clientRect?.()
              if (rect && container) { container.style.top = `${rect.bottom + 6}px`; container.style.left = `${rect.left}px` }
            },
            onKeyDown: ({ event }) => {
              if (event.key === 'Escape') { container?.remove(); return true }
              return renderer.ref?.onKeyDown(event) ?? false
            },
            onExit: () => { container?.remove(); renderer.destroy() },
          }
        },
      },
    }),
  ]
}

/** Parse a stored description: JSON string → JSONContent, plain text → paragraph node */
export function parseDescription(raw: string | null): JSONContent | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && parsed.type === 'doc') return parsed as JSONContent
  } catch { /* plain text */ }
  // Wrap plain text in a doc so Tiptap can render it
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }] }
}

export function renderDescriptionHTML(raw: string | null): string {
  const json = parseDescription(raw)
  if (!json) return ''
  try {
    return generateHTML(json, buildDisplayExtensions())
  } catch { return '' }
}

interface RichTextEditorProps {
  initialContent: JSONContent | null
  members: ProjectMemberPreview[]
  placeholder?: string
  allowMentions?: boolean
  uploadImage: (file: File) => Promise<string | null>
  onReady?: (getJson: () => JSONContent) => void
  minHeight?: string
}

export function RichTextEditor({
  initialContent,
  members,
  placeholder = 'Write something…',
  allowMentions = false,
  uploadImage,
  onReady,
  minHeight = '120px',
}: RichTextEditorProps) {
  const membersRef = useRef(members)
  useEffect(() => { membersRef.current = members }, [members])

  const imageInputRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)

  const [linkDialog, setLinkDialog] = useState<{ open: boolean; text: string; url: string } | null>(null)

  function handleSetLink() {
    const { from, to } = editor!.state.selection
    const selectedText = from !== to ? editor!.state.doc.textBetween(from, to) : ''
    const existingHref = editor?.getAttributes('link').href ?? ''
    setLinkDialog({ open: true, text: selectedText, url: existingHref })
  }

  function applyLink() {
    if (!linkDialog) return
    const href = linkDialog.url.startsWith('http://') || linkDialog.url.startsWith('https://')
      ? linkDialog.url
      : `https://${linkDialog.url}`
    const { from, to } = editor!.state.selection
    if (from === to) {
      const display = linkDialog.text.trim() || href
      editor?.chain().focus().insertContent(`<a href="${href}" target="_blank">${display}</a>`).run()
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setLinkDialog(null)
  }

  const extensions = useMemo(() => buildEditorExtensions(membersRef, placeholder, allowMentions), [placeholder, allowMentions])

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialContent ?? undefined,
    editorProps: {
      attributes: {
        class: `tiptap-content focus:outline-none px-3 py-2 text-gray-900 text-sm`,
        style: `min-height: ${minHeight}`,
      },
    },
  })

  useEffect(() => {
    if (editor && onReady) onReady(() => editor.getJSON())
  }, [editor, onReady])

  async function handleImageFile(file: File) {
    if (uploadingRef.current) return
    uploadingRef.current = true
    const src = await uploadImage(file)
    uploadingRef.current = false
    if (src) editor?.chain().focus().setImage({ src }).run()
  }

  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        <TB onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="B" cls="font-bold" title="Bold" />
        <TB onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="I" cls="italic" title="Italic" />
        <TB onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} label="<>" cls="font-mono text-xs" title="Inline code" />
        <TB onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label="{ }" cls="font-mono text-xs" title="Code block" />
        <button
          type="button"
          title="Link"
          onClick={handleSetLink}
          className={`px-2 py-0.5 text-sm rounded transition-colors ${editor?.isActive('link') ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <LinkIcon size={14} />
        </button>
        <button
          type="button"
          title="Attach image"
          onClick={() => imageInputRef.current?.click()}
          className="px-2 py-0.5 text-sm rounded text-gray-500 hover:bg-gray-100"
        >
          <ImageIcon size={14} />
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

      {/* Link dialog */}
      {linkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-80 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Insert link</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Text to display</label>
              <input
                autoFocus
                type="text"
                value={linkDialog.text}
                onChange={(e) => setLinkDialog({ ...linkDialog, text: e.target.value })}
                placeholder="Link text"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
              <input
                type="text"
                value={linkDialog.url}
                onChange={(e) => setLinkDialog({ ...linkDialog, url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter') applyLink() }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setLinkDialog(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="button" onClick={applyLink} disabled={!linkDialog.url.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TB({ onClick, active, label, cls, title }: {
  onClick: () => void; active?: boolean; label: string; cls?: string; title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-0.5 text-sm rounded transition-colors ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'} ${cls ?? ''}`}
    >
      {label}
    </button>
  )
}
