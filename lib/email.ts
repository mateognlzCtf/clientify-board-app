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

export type EventRecipient = { email: string; name: string; role: 'reporter' | 'assignee' | 'mentioned' }
export type EventActor = { id: string; name: string; email: string }
export type EventIssue = { id: string; key: string; title: string }

export async function sendAssignmentEvent({
  issue,
  actor,
  recipients,
  projectId,
}: {
  issue: EventIssue
  actor: EventActor
  recipients: EventRecipient[]
  projectId: string
}) {
  await sendEvent({
    event: 'issue.assigned',
    issue: {
      ...issue,
      url: `${APP_URL}/project/${projectId}/issue/${issue.id}`,
    },
    actor,
    recipients,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}

export async function sendStatusChangeEvent({
  issue,
  actor,
  changes,
  recipients,
  projectId,
}: {
  issue: EventIssue
  actor: EventActor
  changes: { from: string | null; to: string }
  recipients: EventRecipient[]
  projectId: string
}) {
  await sendEvent({
    event: 'issue.status_changed',
    issue: {
      ...issue,
      url: `${APP_URL}/project/${projectId}/issue/${issue.id}`,
    },
    actor,
    changes,
    recipients,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}

export async function sendProjectInviteNotification({
  toEmail,
  toName,
  invitedByName,
  projectName,
  projectId,
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
  toEmail,
  invitedByName,
  projectName,
  inviteToken,
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
  toEmail,
  newUserName,
  newUserEmail,
  approveUrl,
  rejectUrl,
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
  toEmail,
  toName,
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
  toEmail,
  toName,
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
  toEmail,
  invitedByName,
  inviteUrl,
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

export async function sendIssueUpdatedEvent({
  issue,
  actor,
  changes,
  recipients,
  projectId,
}: {
  issue: EventIssue
  actor: EventActor
  changes: { field: string; from: string | null; to: string | null }[]
  recipients: EventRecipient[]
  projectId: string
}) {
  await sendEvent({
    event: 'issue.updated',
    issue: {
      ...issue,
      url: `${APP_URL}/project/${projectId}/issue/${issue.id}`,
    },
    actor,
    changes,
    recipients,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}

export async function sendCommentCreatedEvent({
  issue,
  actor,
  comment,
  recipients,
  projectId,
}: {
  issue: EventIssue
  actor: EventActor
  comment: { snippet: string; images: string[] }
  recipients: EventRecipient[]
  projectId: string
}) {
  await sendEvent({
    event: 'comment.created',
    issue: {
      ...issue,
      url: `${APP_URL}/project/${projectId}/issue/${issue.id}`,
    },
    actor,
    comment,
    recipients,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}

export async function sendCommentMentionedEvent({
  issue,
  actor,
  comment,
  recipients,
  projectId,
}: {
  issue: EventIssue
  actor: EventActor
  comment: { snippet: string; images: string[] }
  recipients: EventRecipient[]
  projectId: string
}) {
  await sendEvent({
    event: 'comment.mentioned',
    issue: {
      ...issue,
      url: `${APP_URL}/project/${projectId}/issue/${issue.id}`,
    },
    actor,
    comment,
    recipients,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}
