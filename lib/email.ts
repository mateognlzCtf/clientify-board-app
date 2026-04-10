import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Clientify Board <board@notifications.clientify.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

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
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping.')
    return
  }

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
        <p style="margin-top:24px;font-size:12px;color:#aaa">Clientify Board · no responder a este correo</p>
      </div>
    `,
  })

  if (error) console.error('[email] Resend error:', error)
  else console.log('[email] Sent to', toEmail, '| id:', data?.id)
}
