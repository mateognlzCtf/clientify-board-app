'use client'

/**
 * ProjectForm — form for creating and editing projects.
 * Used inside a Modal, not as a standalone page.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { isValidProjectKey, isNonEmptyString } from '@/lib/utils/validation'
import type { Project, ProjectCreate, ProjectUpdate } from '@/types/project.types'

interface CreateModeProps {
  mode: 'create'
  onSubmit: (data: ProjectCreate) => Promise<void>
}

interface EditModeProps {
  mode: 'edit'
  project: Project
  onSubmit: (data: ProjectUpdate) => Promise<void>
}

type ProjectFormProps = (CreateModeProps | EditModeProps) & {
  onCancel: () => void
}

export function ProjectForm(props: ProjectFormProps) {
  const isEdit = props.mode === 'edit'

  const [name, setName] = useState(isEdit ? props.project.name : '')
  const [key, setKey] = useState(isEdit ? props.project.key : '')
  const [description, setDescription] = useState(
    isEdit ? (props.project.description ?? '') : ''
  )
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<'name' | 'key', string>>>({})

  function validate(): boolean {
    const newErrors: typeof errors = {}

    if (!isNonEmptyString(name)) {
      newErrors.name = 'Name is required.'
    }
    // Key validation only matters on create — in edit the field is disabled
    // and the existing key (already valid) is preserved.
    if (!isEdit && !isValidProjectKey(key)) {
      newErrors.key =
        'Key must be 1-5 characters: uppercase letters and digits only, starting with a letter. E.g. CLF, PROJ'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      if (isEdit) {
        await (props as EditModeProps).onSubmit({ name, description })
      } else {
        await (props as CreateModeProps).onSubmit({ name, key, description })
      }
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate key from name (only in create mode).
  // Name allows spaces and dots (display only); derived key keeps just A-Z0-9
  // because it's used in URLs and ticket keys.
  function handleNameChange(value: string) {
    const upper = value.toUpperCase().replace(/[^A-Z0-9 .]/g, '').slice(0, 17)
    setName(upper)
    if (!isEdit && !key) {
      const autoKey = upper.replace(/[^A-Z0-9]/g, '').slice(0, 5)
      setKey(autoKey)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Name */}
      <div>
        <label
          htmlFor="project-name"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Project name <span className="text-red-500">*</span>
        </label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="CLIENTIFY"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Project key — only on create; can't be changed afterwards */}
      {!isEdit && (
        <div>
          <label
            htmlFor="project-key"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Project key <span className="text-red-500">*</span>
          </label>
          <input
            id="project-key"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            placeholder="CLF"
            maxLength={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
          />
          <p className="mt-1 text-xs text-gray-400">
            Max. 5 characters. Used as the ticket key prefix: <span className="font-mono">{key || 'CLF'}-1</span>
          </p>
          {errors.key && (
            <p className="mt-1 text-xs text-red-600">{errors.key}</p>
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <label
          htmlFor="project-desc"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="project-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 120))}
          rows={3}
          maxLength={120}
          placeholder="What's this project about?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400"
        />
        <p className="text-right text-xs text-gray-400 mt-1">{description.length}/120</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={props.onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  )
}
