import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Clientify Projects <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function guard() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping.')
    return false
  }
  return true
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
  if (!guard()) return
  const issueUrl = `${APP_URL}/project/${projectId}/list`
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${assignedByName} te asignó ${issueKey}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="font-size:16px;margin-bottom:8px">
          Se te asignó <strong>${issueKey}: ${issueTitle}</strong>
        </h2>
        <p style="color:#555;font-size:14px;margin-bottom:16px">
          <strong>${assignedByName}</strong> te asignó este ticket.
        </p>
        <a href="${issueUrl}"
           style="display:inline-block;margin-top:4px;padding:8px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
          Ver ticket
        </a>
        <p style="margin-top:24px;font-size:12px;color:#aaa">Clientify Projects · no responder a este correo</p>
      </div>
    `,
  })
  if (error) console.error('[email] Resend error:', error)
  else console.log('[email] Assignment sent to', toEmail, '| id:', data?.id)
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
  if (!guard()) return
  const issueUrl = `${APP_URL}/project/${projectId}/list`
  const statusLabel = newStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${issueKey} cambió de estado a ${statusLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="font-size:16px;margin-bottom:8px">
          Estado actualizado en <strong>${issueKey}: ${issueTitle}</strong>
        </h2>
        <p style="color:#555;font-size:14px;margin-bottom:16px">
          <strong>${changedByName}</strong> cambió el estado a
          <strong style="color:#3b82f6">${statusLabel}</strong>.
        </p>
        <a href="${issueUrl}"
           style="display:inline-block;margin-top:4px;padding:8px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
          Ver ticket
        </a>
        <p style="margin-top:24px;font-size:12px;color:#aaa">Clientify Projects · no responder a este correo</p>
      </div>
    `,
  })
  if (error) console.error('[email] Resend error:', error)
  else console.log('[email] Status change sent to', toEmail, '| id:', data?.id)
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
  if (!guard()) return
  const projectUrl = `${APP_URL}/project/${projectId}/backlog`
  const firstName = toName.split(' ')[0]
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${invitedByName} te invitó a unirte a ${projectName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;padding:32px 24px">
        <p style="font-size:22px;font-weight:700;margin:0 0 24px">👋 Hola, ${firstName}</p>
        <p style="font-size:15px;color:#333;margin:0 0 8px">
          <strong>${invitedByName}</strong> te invitó a unirte al proyecto
          <strong>${projectName}</strong> en Clientify Projects.
        </p>
        <a href="${projectUrl}"
           style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
          Ver proyecto
        </a>
        <hr style="margin:32px 0;border:none;border-top:1px solid #eee" />
        <p style="font-size:12px;color:#aaa;margin:0">Clientify Projects · no responder a este correo</p>
      </div>
    `,
  })
  if (error) console.error('[email] Resend error:', error)
  else console.log('[email] Project invite sent to', toEmail, '| id:', data?.id)
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
  if (!guard()) return
  const inviteUrl = `${APP_URL}/accept-invite?token=${inviteToken}`
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${invitedByName} te invitó a unirte a ${projectName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;padding:32px 24px">
        <p style="font-size:22px;font-weight:700;margin:0 0 24px">👋 Hola</p>
        <p style="font-size:15px;color:#333;margin:0 0 8px">
          <strong>${invitedByName}</strong> te invitó a unirte al proyecto
          <strong>${projectName}</strong> en Clientify Projects.
        </p>
        <p style="font-size:14px;color:#666;margin:0 0 28px">
          Clientify Projects es una herramienta de gestión de proyectos y tickets para equipos.
          Crea tu cuenta gratuita para aceptar la invitación.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
          Aceptar invitación
        </a>
        <p style="font-size:12px;color:#aaa;margin:28px 0 0">
          Este enlace expira en 7 días. Si no esperabas esta invitación, puedes ignorar este correo.
        </p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
        <p style="font-size:12px;color:#aaa;margin:0">Clientify Projects · no responder a este correo</p>
      </div>
    `,
  })
  if (error) console.error('[email] Resend error:', error)
  else console.log('[email] Pending invite sent to', toEmail, '| id:', data?.id)
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
  if (!guard()) return

  const issueUrl = `${APP_URL}/project/${projectId}/list`

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `${mentionedByName} te mencionó en ${issueKey}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="font-size:16px;margin-bottom:8px">
          Fuiste mencionado en <strong>${issueKey}: ${issueTitle}</strong>
        </h2>
        <p style="color:#555;font-size:14px;margin-bottom:16px">
          <strong>${mentionedByName}</strong> te mencionó en un comentario:
        </p>
        <blockquote style="border-left:3px solid #3b82f6;margin:0;padding:10px 16px;background:#f0f7ff;border-radius:4px;font-size:14px;color:#333">
          ${commentSnippet}
        </blockquote>
        <a href="${issueUrl}"
           style="display:inline-block;margin-top:20px;padding:8px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
          Ver ticket
        </a>
        <p style="margin-top:24px;font-size:12px;color:#aaa">Clientify Projects · no responder a este correo</p>
      </div>
    `,
  })

  if (error) console.error('[email] Resend error:', error)
  else console.log('[email] Sent to', toEmail, '| id:', data?.id)
}
