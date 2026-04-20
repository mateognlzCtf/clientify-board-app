'use server'

import { redirect } from 'next/navigation'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getIssueLinks,
  createIssueLink,
  deleteIssueLink,
} from '@/services/issue-links.service'
import type { LinkedIssuePreview } from '@/services/issue-links.service'
import type { ServiceResult } from '@/types/common.types'

async function getAuthenticatedUser() {
  const ssrClient = await createSsrClient()
  const { data: { user } } = await ssrClient.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export interface IssueLinkOption {
  id: string
  key: string
  title: string
  status: string
  type: string
}

export async function getIssueLinksAction(issueId: string): Promise<LinkedIssuePreview[]> {
  const supabase = createAdminClient()
  return getIssueLinks(supabase, issueId)
}

export async function getProjectIssuesForLinkAction(
  projectId: string,
  currentIssueId: string,
): Promise<IssueLinkOption[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('issues')
    .select('id, key, title, status, type')
    .eq('project_id', projectId)
    .neq('id', currentIssueId)
    .order('created_at', { ascending: false })
  return (data ?? []) as IssueLinkOption[]
}

export async function createIssueLinkAction(
  sourceIssueId: string,
  targetIssueId: string,
): Promise<ServiceResult<{ link_id: string }>> {
  const user = await getAuthenticatedUser()
  const supabase = createAdminClient()
  return createIssueLink(supabase, sourceIssueId, targetIssueId, user.id)
}

export async function deleteIssueLinkAction(linkId: string): Promise<ServiceResult<null>> {
  await getAuthenticatedUser()
  const supabase = createAdminClient()
  return deleteIssueLink(supabase, linkId)
}
