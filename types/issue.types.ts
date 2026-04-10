export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled' | 'ready_for_production' | 'staging_qa' | 'stopper'
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent'
export type IssueType = 'bug' | 'feature' | 'task' | 'improvement'

export interface Issue {
  id: string
  project_id: string
  key: string
  title: string
  description: string | null
  status: IssueStatus
  priority: IssuePriority
  type: IssueType
  assignee_id: string | null
  reporter_id: string
  position: number
  due_date: string | null
  sprint_id: string | null
  created_at: string
  updated_at: string
}

export interface IssueCreate {
  project_id: string
  title: string
  description?: string
  status?: IssueStatus
  priority?: IssuePriority
  type?: IssueType
  assignee_id?: string
  due_date?: string
  sprint_id?: string | null
}

export interface IssueUpdate {
  title?: string
  description?: string
  status?: IssueStatus
  priority?: IssuePriority
  type?: IssueType
  assignee_id?: string | null
  due_date?: string | null
  position?: number
  sprint_id?: string | null
}

export interface IssueWithDetails extends Issue {
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
  reporter: { id: string; full_name: string | null; avatar_url: string | null }
}
