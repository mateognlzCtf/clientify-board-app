export type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'staging_qa' | 'ready_for_production' | 'done' | 'canceled' | 'stopper'
export type IssuePriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest'
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
  start_date: string | null
  sprint_id: string | null
  epic_id: string | null
  slack_thread: string | null
  pause_reason: string | null
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
  start_date?: string | null
  sprint_id?: string | null
  epic_id?: string | null
  slack_thread?: string | null
  pause_reason?: string | null
}

export interface IssueUpdate {
  title?: string
  description?: string
  status?: IssueStatus
  priority?: IssuePriority
  type?: IssueType
  assignee_id?: string | null
  due_date?: string | null
  start_date?: string | null
  position?: number
  sprint_id?: string | null
  epic_id?: string | null
  slack_thread?: string | null
  pause_reason?: string | null
}

export interface IssueWithDetails extends Issue {
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
  reporter: { id: string; full_name: string | null; avatar_url: string | null }
  epic: { id: string; name: string; color: string } | null
  comment_count: number
}
