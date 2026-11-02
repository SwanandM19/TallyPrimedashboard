import { z } from 'zod'
import { errorResponse, HttpError, requireUser } from '@/lib/server/auth'
import { isAdmin } from '@/lib/server/admin'

export const dynamic = 'force-dynamic'

const body = z.object({ reportId: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const context = await requireUser(request)
    const parsed = body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new HttpError(400, 'Invalid request.')
    if (!(await isAdmin(context))) throw new HttpError(403, 'Admin access required')
    const { data: report, error: reportError } = await context.supabase.from('cashflow_reports')
      .select('id, employee_id, submitted_at').eq('id', parsed.data.reportId).single()
    if (reportError || !report) throw new HttpError(404, 'Report not found')
    const { error } = await context.supabase.from('cashflow_approvals').upsert({
      report_id: report.id, employee_id: report.employee_id, submitted_at: report.submitted_at, approved_at: new Date().toISOString(),
    }, { onConflict: 'report_id' })
    if (error) throw new Error(error.message)
    return Response.json({ approved: true })
  } catch (error) {
    return errorResponse(error)
  }
}
