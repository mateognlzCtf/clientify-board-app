import type { JSONContent } from '@tiptap/react'

export interface Comment {
  id: string
  issue_id: string
  author_id: string
  content: JSONContent
  created_at: string
  updated_at: string
}

export interface CommentCreate {
  issue_id: string
  content: JSONContent
}

export interface CommentUpdate {
  content: JSONContent
}

export interface CommentWithAuthor extends Comment {
  author: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}
