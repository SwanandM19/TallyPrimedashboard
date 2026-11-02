import { TABS } from '@/lib/cashflow-sheets'

/** Sends the "report submitted" e-mail through Resend (https://resend.com). Returns false when e-mail is off or fails. */
export async function emailSubmission(sheet: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Cashflow e-mail not sent: RESEND_API_KEY is not set.')
    return false
  }
  const from = process.env.RESEND_FROM || 'Mantri Cashflow <onboarding@resend.dev>'
  const to = process.env.REPORT_RECIPIENT || 'suhas@mantri.com'
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const label = TABS.find((tab) => tab.id === sheet)?.label ?? sheet
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Cashflow Report Submitted - Ashok Agarwal',
        text: `${label} has been submitted for admin review.\n\nOpen the admin dashboard: ${site}/admin\n\nSign in with your admin account to view the report.`,
      }),
    })
    if (!response.ok) {
      console.error(`Cashflow e-mail failed [${response.status}]: ${await response.text()}`)
      return false
    }
    return true
  } catch (error) {
    console.error('Cashflow e-mail failed:', error)
    return false
  }
}
