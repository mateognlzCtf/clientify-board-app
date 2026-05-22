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
  issueId,
  projectId,
}: {
  toEmail: string
  toName: string
  assignedByName: string
  issueKey: string
  issueTitle: string
  issueId: string
  projectId: string
}) {
  await sendEvent({
    event: 'issue.assigned',
    toEmail,
    toName,
    assignedByName,
    issueKey,
    issueTitle,
    issueUrl: `${APP_URL}/project/${projectId}/issue/${issueId}`,
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
  issueId,
  newStatus,
  projectId,
}: {
  toEmail: string
  toName: string
  changedByName: string
  issueKey: string
  issueTitle: string
  issueId: string
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
    issueUrl: `${APP_URL}/project/${projectId}/issue/${issueId}`,
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

export async function sendIssueUpdatedNotification({
  toEmail,
  toName,
  updatedByName,
  issueKey,
  issueTitle,
  issueId,
  projectId,
  changes,
}: {
  toEmail: string
  toName: string
  updatedByName: string
  issueKey: string
  issueTitle: string
  issueId: string
  projectId: string
  changes: { field: string; from: string | null; to: string | null }[]
}) {
  await sendEvent({
    event: 'issue.updated',
    toEmail,
    toName,
    updatedByName,
    issueKey,
    issueTitle,
    changes,
    issueUrl: `${APP_URL}/project/${projectId}/issue/${issueId}`,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}

export async function sendCommentNotification({
  toEmail,
  toName,
  authorName,
  issueKey,
  issueTitle,
  issueId,
  projectId,
  commentSnippet,
}: {
  toEmail: string
  toName: string
  authorName: string
  issueKey: string
  issueTitle: string
  issueId: string
  projectId: string
  commentSnippet: string
}) {
  await sendEvent({
    event: 'comment.created',
    toEmail,
    toName,
    authorName,
    issueKey,
    issueTitle,
    commentSnippet,
    issueUrl: `${APP_URL}/project/${projectId}/issue/${issueId}`,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}

export async function sendMentionNotification({
  toEmail,
  toName,
  mentionedByName,
  issueKey,
  issueTitle,
  issueId,
  projectId,
  commentSnippet,
}: {
  toEmail: string
  toName: string
  mentionedByName: string
  issueKey: string
  issueTitle: string
  issueId: string
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
    issueUrl: `${APP_URL}/project/${projectId}/issue/${issueId}`,
    projectUrl: `${APP_URL}/project/${projectId}/list`,
    projectId,
  })
}
