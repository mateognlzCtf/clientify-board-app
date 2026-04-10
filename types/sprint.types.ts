import type { IssueWithDetails } from '@/types/issue.types'

export type SprintStatus = 'planning' | 'active' | 'completed'

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string | null
  start_date: string | null
  end_date: string | null
  status: SprintStatus
  created_at: string
  updated_at: string
}

export interface SprintCreate {
  project_id: string
  name: string
  goal?: string
  start_date?: string
  end_date?: string
}

export interface SprintUpdate {
  name?: string
  goal?: string | null
  start_date?: string | null
  end_date?: string | null
}

export interface SprintWithIssues extends Sprint {
  issues: IssueWithDetails[]
}
