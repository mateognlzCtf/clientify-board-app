import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createIssue } from '@/services/issues.service'
import { sendAssignmentNotification } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function POST(request: NextRequest) {
  // 1. Auth: validate API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.INTEGRATION_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get project ID from env (always the same project)
  const projectId = process.env.INTEGRATION_PROJECT_ID
  if (!projectId) {
    return NextResponse.json({ error: 'INTEGRATION_PROJECT_ID not configured' }, { status: 500 })
  }

  // 3. Parse body
  let body: {
    title?: string
    description?: string
    reporterEmail?: string
    assigneeEmail?: string
    priority?: string
    type?: string
    dueInDays?: number | string
    slackThread?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 })
  }
  if (!body.reporterEmail?.trim()) {
    return NextResponse.json({ error: 'Missing required field: reporterEmail' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 4. Verify project exists
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, key')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Configured project not found' }, { status: 500 })
  }

  // 5. Look up reporter by email
  const { data: reporter } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', body.reporterEmail.trim().toLowerCase())
    .single()

  if (!reporter) {
    return NextResponse.json({ error: `Reporter not found: ${body.reporterEmail}` }, { status: 404 })
  }

  // 6. Look up assignee by email (optional)
  let assigneeId: string | null = null
  let assignee: { id: string; email: string; full_name: string | null } | null = null
  if (body.assigneeEmail?.trim()) {
    const { data: assigneeData } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', body.assigneeEmail.trim().toLowerCase())
      .single()
    if (!assigneeData) {
      return NextResponse.json({ error: `Assignee not found: ${body.assigneeEmail}` }, { status: 404 })
    }
    assigneeId = assigneeData.id
    assignee = assigneeData
  }

  // 7. Compute due date if dueInDays provided (accepts number or numeric string)
  let dueDate: string | null = null
  const dueDays = typeof body.dueInDays === 'string' ? parseInt(body.dueInDays, 10) : body.dueInDays
  if (typeof dueDays === 'number' && !isNaN(dueDays) && dueDays > 0) {
    const d = new Date()
    d.setDate(d.getDate() + dueDays)
    dueDate = d.toISOString().slice(0, 10)
  }

  // 8. Create the ticket (DB trigger auto-generates the key)
  const { data: issue, error } = await createIssue(supabase, reporter.id, {
    project_id: projectId,
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    priority: (body.priority as 'lowest' | 'low' | 'medium' | 'high' | 'highest') ?? 'medium',
    type: (body.type as 'bug' | 'feature' | 'task' | 'improvement') ?? 'task',
    assignee_id: assigneeId ?? undefined,
    due_date: dueDate ?? undefined,
    slack_thread: body.slackThread ?? undefined,
  })

  if (error || !issue) {
    return NextResponse.json({ error: error ?? 'Error creating ticket' }, { status: 500 })
  }

  // 9. Fire assignment notification (if assigned and different from reporter)
  if (assignee && assignee.id !== reporter.id) {
    void sendAssignmentNotification({
      toEmail: assignee.email,
      toName: assignee.full_name ?? assignee.email,
      assignedByName: reporter.full_name ?? reporter.email,
      issueKey: issue.key,
      issueTitle: issue.title,
      issueId: issue.id,
      projectId,
    })
  }

  // 10. Return response
  return NextResponse.json({
    success: true,
    issueId: issue.id,
    issueKey: issue.key,
    issueUrl: `${APP_URL}/project/${projectId}/issue/${issue.id}`,
  })
}
