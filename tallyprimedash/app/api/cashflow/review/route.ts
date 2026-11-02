import { z } from 'zod'
import { errorResponse, HttpError, requireUser } from '@/lib/server/auth'
import { isAdmin } from '@/lib/server/admin'

export const dynamic = 'force-dynamic'

const body = z.object({
  reportId: z.string().uuid(),
  rows: z.array(z.record(z.unknown())).max(500),
  changes: z.array(z.object({ rowId: z.string(), field: z.string() })).max(1000),
  comment: z.string().trim().max(3000),
})

export async function POST(request: Request) {
  try {
    const context = await requireUser(request)
    const parsed = body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new HttpError(400, 'Invalid request.')
    const data = parsed.data
    if (!(await isAdmin(context))) throw new HttpError(403, 'Admin access required')
    const { data: report, error: reportError } = await context.supabase.from('cashflow_reports').select('id, employee_id, sheet').eq('id', data.reportId).single()
    if (reportError || !report) throw new HttpError(404, 'Report not found')
    const { error } = await context.supabase.from('cashflow_reports').update({ rows: data.rows, updated_at: new Date().toISOString() }).eq('id', report.id)
    if (error) throw new Error(error.message)
    const feedback = [
      ...data.changes.map(({ rowId, field }) => ({ report_id: report.id, employee_id: report.employee_id, sheet: report.sheet, row_id: rowId, field, message: null })),
      ...(data.comment ? [{ report_id: report.id, employee_id: report.employee_id, sheet: report.sheet, row_id: null, field: null, message: data.comment }] : []),
    ]
    if (feedback.length) {
      const { error: feedbackError } = await context.supabase.from('cashflow_feedback').insert(feedback)
      if (feedbackError) throw new Error(feedbackError.message)
    }
    return Response.json({ saved: true })
  } catch (error) {
    return errorResponse(error)
  }
}
