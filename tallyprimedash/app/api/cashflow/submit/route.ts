import { z } from 'zod'
import { errorResponse, HttpError, requireUser } from '@/lib/server/auth'
import { isAdmin } from '@/lib/server/admin'
import { emailSubmission } from '@/lib/server/email'

export const dynamic = 'force-dynamic'

const body = z.object({
  sheet: z.enum(['oppl', 'prerana', 'pppl', 'mcpl', 'apex', 'ra']),
  rows: z.array(z.record(z.unknown())).max(500),
})

export async function POST(request: Request) {
  try {
    const context = await requireUser(request)
    const parsed = body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new HttpError(400, 'Invalid request.')
    const data = parsed.data
    if (await isAdmin(context)) throw new HttpError(403, 'Admins cannot submit employee reports')
    const { data: existing } = await context.supabase.from('cashflow_reports').select('id').eq('sheet', data.sheet).eq('employee_id', context.userId).maybeSingle()
    const now = new Date().toISOString()
    const payload = { sheet: data.sheet, employee_id: context.userId, rows: data.rows, submitted_at: now, updated_at: now }
    const result = existing
      ? await context.supabase.from('cashflow_reports').update(payload).eq('id', existing.id).select('id').single()
      : await context.supabase.from('cashflow_reports').insert(payload).select('id').single()
    if (result.error) throw new Error(result.error.message)
    if (existing) {
      const { error: feedbackError } = await context.supabase.from('cashflow_feedback')
        .update({ resolved_at: new Date().toISOString() }).eq('report_id', existing.id)
        .eq('employee_id', context.userId).not('row_id', 'is', null).is('resolved_at', null)
      if (feedbackError) throw new Error(feedbackError.message)
    }
    const emailSent = await emailSubmission(data.sheet)
    return Response.json({ id: result.data.id as string, emailSent })
  } catch (error) {
    return errorResponse(error)
  }
}
