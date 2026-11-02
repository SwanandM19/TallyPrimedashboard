import { errorResponse, requireUser } from '@/lib/server/auth'
import { isAdmin } from '@/lib/server/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const context = await requireUser(request)
    const admin = await isAdmin(context)
    const reports = await context.supabase.from('cashflow_reports').select('*').order('submitted_at', { ascending: false })
    if (reports.error) throw new Error(reports.error.message)
    const feedback = await context.supabase.from('cashflow_feedback').select('*').order('created_at', { ascending: false })
    if (feedback.error) throw new Error(feedback.error.message)
    const approvals = await context.supabase.from('cashflow_approvals').select('*')
    if (approvals.error) throw new Error(approvals.error.message)
    return Response.json({ admin, reports: reports.data, feedback: feedback.data, approvals: approvals.data })
  } catch (error) {
    return errorResponse(error)
  }
}
