'use client'

import { createContext, useContext } from 'react'
import type { Sprint } from '@/types/sprint.types'
import type { Epic } from '@/types/epic.types'
import type { ProjectMemberPreview } from '@/services/projects.service'

interface ProjectDataContextValue {
  sprints: Sprint[]
  members: ProjectMemberPreview[]
  epics: Epic[]
}

const ProjectDataContext = createContext<ProjectDataContextValue>({
  sprints: [],
  members: [],
  epics: [],
})

export function ProjectDataProvider({
  sprints,
  members,
  epics,
  children,
}: {
  sprints: Sprint[]
  members: ProjectMemberPreview[]
  epics: Epic[]
  children: React.ReactNode
}) {
  return (
    <ProjectDataContext.Provider value={{ sprints, members, epics }}>
      {children}
    </ProjectDataContext.Provider>
  )
}

export function useProjectData() {
  return useContext(ProjectDataContext)
}
