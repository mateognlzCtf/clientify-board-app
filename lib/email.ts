const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? 'https://n8n.clientify.com/webhook/f185245d-461f-4523-a0b4-dc28fef35a07'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function sendEvent(payload: Record<string, unknown>) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error('[email] Webhook error:', res.status, await res.text())
    else console.log('[email] Event sent:', payload.event)
  } catch (err) {
    console.error('[email] Webhook fetch failed:', err)
  }
}

// ── Ticket / comment events (consolidated, one webhook per user action) ─────

export type EventActor = { id: string; name: string; email: string }
export type EventIssue = { id: string; key: string; title: string }
export type RecipientRole = 'assignee' | 'reporter' | 'previousAssignee' | 'mentioned'
export type EventRecipient = { id: string; name: string; email: string; role: RecipientRole }
export type EventChange = { field: string; from: string | null; to: string | null }
/** Where the ticket was created: 'web' = UI form, 'api' = integration endpoint. */
export type EventSource = 'web' | 'api'

function withIssueUrls(issue: EventIssue, projectId: string) {
  return {
    ...issue,
    url: `${APP_URL}/project/${projectId}/issue/${issue.id}`,
    projectId,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
  }
}

// Events always fire when there's a real action — recipients[] can be empty so
// n8n can still post to Slack channels, audit logs, etc. even when no one
// would receive a direct email notification.

export async function sendIssueCreatedEvent({
  actor, issue, recipients, projectId, source,
}: {
  actor: EventActor
  issue: EventIssue
  recipients: EventRecipient[]
  projectId: string
  source: EventSource
}) {
  await sendEvent({
    event: 'issue.created',
    source,
    actor,
    issue: withIssueUrls(issue, projectId),
    recipients,
  })
}

export async function sendIssueUpdatedEvent({
  actor, issue, changes, recipients, projectId,
}: {
  actor: EventActor
  issue: EventIssue
  changes: EventChange[]
  recipients: EventRecipient[]
  projectId: string
}) {
  if (changes.length === 0) return
  await sendEvent({
    event: 'issue.updated',
    actor,
    issue: withIssueUrls(issue, projectId),
    changes,
    recipients,
  })
}

export async function sendCommentCreatedEvent({
  actor, issue, comment, recipients, projectId,
}: {
  actor: EventActor
  issue: EventIssue
  comment: { snippet: string }
  recipients: EventRecipient[]
  projectId: string
}) {
  await sendEvent({
    event: 'comment.created',
    actor,
    issue: withIssueUrls(issue, projectId),
    comment,
    recipients,
  })
}

// ── Project / user / platform events (unchanged) ────────────────────────────

export async function sendProjectInviteNotification({
  toEmail, toName, invitedByName, projectName, projectId,
}: {
  toEmail: string
  toName: string
  invitedByName: string
  projectName: string
  projectId: string
}) {
  await sendEvent({
    event: 'project.invited',
    toEmail,
    toName,
    invitedByName,
    projectName,
    projectUrl: `${APP_URL}/project/${projectId}/backlog`,
    projectId,
  })
}

export async function sendPendingInviteEmail({
  toEmail, invitedByName, projectName, inviteToken,
}: {
  toEmail: string
  invitedByName: string
  projectName: string
  inviteToken: string
}) {
  await sendEvent({
    event: 'project.invite_pending',
    toEmail,
    invitedByName,
    projectName,
    inviteUrl: `${APP_URL}/accept-invite?token=${inviteToken}`,
  })
}

export async function sendUserRegisteredNotification({
  toEmail, newUserName, newUserEmail, approveUrl, rejectUrl,
}: {
  toEmail: string
  newUserName: string
  newUserEmail: string
  approveUrl: string
  rejectUrl: string
}) {
  await sendEvent({
    event: 'user.registered',
    toEmail,
    newUserName,
    newUserEmail,
    approveUrl,
    rejectUrl,
  })
}

export async function sendUserApprovedNotification({
  toEmail, toName,
}: {
  toEmail: string
  toName: string
}) {
  await sendEvent({
    event: 'user.approved',
    toEmail,
    toName,
    loginUrl: `${APP_URL}/login`,
  })
}

export async function sendUserRejectedNotification({
  toEmail, toName,
}: {
  toEmail: string
  toName: string
}) {
  await sendEvent({
    event: 'user.rejected',
    toEmail,
    toName,
  })
}

export async function sendPlatformInviteNotification({
  toEmail, invitedByName, inviteUrl,
}: {
  toEmail: string
  invitedByName: string
  inviteUrl: string
}) {
  await sendEvent({
    event: 'platform.invite',
    toEmail,
    invitedByName,
    inviteUrl,
  })
}
