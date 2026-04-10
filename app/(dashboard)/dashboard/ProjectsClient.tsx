'use client'

/**
 * ProjectsClient — parte interactiva del dashboard.
 *
 * Es un Client Component porque maneja:
 * - Estado de los modales (crear, editar, confirmar eliminación)
 * - Búsqueda local por nombre
 * - Llamadas a mutations (create, update, delete)
 *
 * Recibe los datos iniciales del Server Component y los mantiene frescos
 * llamando a router.refresh() después de cada mutación.
 */
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, FolderKanban } from 'lucide-react'
import { type ProjectWithMembers } from '@/services/projects.service'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/providers/ToastProvider'
import type { ProjectCreate, ProjectUpdate } from '@/types/project.types'
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from './actions'

interface ProjectsClientProps {
  projects: ProjectWithMembers[]
  currentUserId: string
}

export function ProjectsClient({ projects, currentUserId }: ProjectsClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProjectWithMembers | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithMembers | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Filtrado local por nombre (los filtros de URL vendrán en la Fase 9)
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    )
  }, [projects, search])

  async function handleCreate(data: ProjectCreate) {
    try {
      const { error } = await createProjectAction(data)

      if (error) {
        toast(error, 'error')
        return
      }

      toast('Proyecto creado correctamente.', 'success')
      setCreateOpen(false)
      router.refresh()
    } catch (err) {
      console.error('[handleCreate] unexpected error:', err)
      toast('Error inesperado al crear el proyecto.', 'error')
    }
  }

  async function handleEdit(data: ProjectUpdate) {
    if (!editTarget) return

    try {
      const { error } = await updateProjectAction(editTarget.id, data)

      if (error) {
        toast(error, 'error')
        return
      }

      toast('Proyecto actualizado.', 'success')
      setEditTarget(null)
      router.refresh()
    } catch (err) {
      console.error('[handleEdit] unexpected error:', err)
      toast('Error inesperado al actualizar el proyecto.', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)

    try {
      const { error } = await deleteProjectAction(deleteTarget.id)

      if (error) {
        toast(error, 'error')
        return
      }

      toast('Proyecto eliminado.', 'success')
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      console.error('[handleDelete] unexpected error:', err)
      toast('Error inesperado al eliminar el proyecto.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyectos..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400"
          />
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nuevo proyecto
        </Button>
      </div>

      {/* Projects grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              currentUserId={currentUserId}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={48} />}
          title="Sin proyectos todavía"
          description="Crea tu primer proyecto para empezar a gestionar tickets y colaborar con tu equipo."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              Crear primer proyecto
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<Search size={40} />}
          title="Sin resultados"
          description={`No hay proyectos que coincidan con "${search}".`}
        />
      )}

      {/* Modal: Crear proyecto */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo proyecto"
      >
        <ProjectForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Modal: Editar proyecto */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Editar proyecto"
      >
        {editTarget && (
          <ProjectForm
            mode="edit"
            project={editTarget}
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {/* Confirmar eliminación */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Eliminar proyecto"
        description={`¿Estás seguro de que quieres eliminar "${deleteTarget?.name}"? Se eliminarán todos sus tickets, comentarios y archivos. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
      />
    </>
  )
}
