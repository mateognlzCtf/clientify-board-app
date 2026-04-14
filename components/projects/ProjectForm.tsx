'use client'

/**
 * ProjectForm — formulario para crear y editar proyectos.
 * Se usa dentro de un Modal, no como página independiente.
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
      newErrors.name = 'El nombre es obligatorio.'
    }
    if (!isEdit && !isValidProjectKey(key)) {
      newErrors.key =
        'La clave debe tener 1-5 caracteres: solo letras mayúsculas y números, empezando por una letra. Ej: CLF, PROJ'
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

  // Auto-generar key desde el nombre (solo en modo crear)
  function handleNameChange(value: string) {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17)
    setName(upper)
    if (!isEdit && !key) {
      const autoKey = upper.slice(0, 5)
      setKey(autoKey)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Nombre */}
      <div>
        <label
          htmlFor="project-name"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Nombre del proyecto <span className="text-red-500">*</span>
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

      {/* Clave del proyecto — solo en modo crear */}
      {!isEdit && (
        <div>
          <label
            htmlFor="project-key"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Clave del proyecto <span className="text-red-500">*</span>
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
            Máx. 5 caracteres. Se usará para las keys de los tickets: <span className="font-mono">{key || 'CLF'}-1</span>
          </p>
          {errors.key && (
            <p className="mt-1 text-xs text-red-600">{errors.key}</p>
          )}
        </div>
      )}

      {/* Descripción */}
      <div>
        <label
          htmlFor="project-desc"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Descripción <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          id="project-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="¿De qué trata este proyecto?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={props.onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
        </Button>
      </div>
    </form>
  )
}
