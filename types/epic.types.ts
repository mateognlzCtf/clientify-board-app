export interface Epic {
  id: string
  project_id: string
  name: string
  color: string
  created_at: string
}

export interface EpicCreate {
  project_id: string
  name: string
  color?: string
}

export interface EpicUpdate {
  name?: string
  color?: string
}
