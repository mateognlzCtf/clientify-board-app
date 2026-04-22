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

export async function sendAssignmentNotification({
  toEmail,
  toName,
  assignedByName,
  issueKey,
  issueTitle,
  projectId,
}: {
  toEmail: string
  toName: string
  assignedByName: string
  issueKey: string
  issueTitle: string
  projectId: string
}) {
  await sendEvent({
    event: 'issue.assigned',
    toEmail,
    toName,
    assignedByName,
    issueKey,
    issueTitle,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}

export async function sendStatusChangeNotification({
  toEmail,
  toName,
  changedByName,
  issueKey,
  issueTitle,
  newStatus,
  projectId,
}: {
  toEmail: string
  toName: string
  changedByName: string
  issueKey: string
  issueTitle: string
  newStatus: string
  projectId: string
}) {
  await sendEvent({
    event: 'issue.status_changed',
    toEmail,
    toName,
    changedByName,
    issueKey,
    issueTitle,
    newStatus,
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

export async function sendMentionNotification({
  toEmail,
  toName,
  mentionedByName,
  issueKey,
  issueTitle,
  projectId,
  commentSnippet,
}: {
  toEmail: string
  toName: string
  mentionedByName: string
  issueKey: string
  issueTitle: string
  projectId: string
  commentSnippet: string
}) {
  await sendEvent({
    event: 'comment.mentioned',
    toEmail,
    toName,
    mentionedByName,
    issueKey,
    issueTitle,
    commentSnippet,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}
