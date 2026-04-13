export interface ProjectStatus {
  id: string
  project_id: string
  name: string
  color: string
  position: number
  requires_pause_reason: boolean
  created_at: string
}

export interface ProjectIssueType {
  id: string
  project_id: string
  name: string
  color: string
  position: number
  created_at: string
}
