import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET() {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: ['mateo.gonzalez@clientify.com'],
    subject: 'Clientify Projects — test email',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a6eff;">Clientify Projects</h2>
        <p>Este es un email de prueba enviado desde Resend.</p>
        <p style="color: #6b7280; font-size: 14px;">Si recibes este mensaje, la integración está funcionando correctamente.</p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ success: true, id: data?.id })
}
