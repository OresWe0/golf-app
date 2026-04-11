import { Resend } from 'resend'

export async function sendFriendRequestEmail({
  to,
  requesterName,
  acceptUrl,
}: {
  to: string
  requesterName: string
  acceptUrl: string
}) {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY saknas i miljövariablerna')
  }

  const resend = new Resend(resendApiKey)

  await resend.emails.send({
    from: 'Golfappen <onboarding@resend.dev>',
    to,
    subject: `${requesterName} har lagt till dig som vän`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f3327;">
        <h2 style="margin-bottom: 12px;">Du har fått en vänförfrågan 🏌️</h2>
        <p><strong>${requesterName}</strong> har lagt till dig som vän i appen.</p>
        <p>Klicka på knappen nedan för att acceptera förfrågan:</p>
        <p style="margin: 24px 0;">
          <a
            href="${acceptUrl}"
            style="
              display: inline-block;
              background: #16a34a;
              color: #ffffff;
              text-decoration: none;
              padding: 12px 18px;
              border-radius: 12px;
              font-weight: 700;
            "
          >
            Acceptera vänförfrågan
          </a>
        </p>
        <p>Om knappen inte fungerar kan du kopiera och klistra in länken här:</p>
        <p>${acceptUrl}</p>
      </div>
    `,
  })
}