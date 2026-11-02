import { z } from 'zod'
import { errorResponse, HttpError, requireUser } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

const body = z.object({ id: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const context = await requireUser(request)
    const parsed = body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new HttpError(400, 'Invalid request.')
    const { error } = await context.supabase.from('cashflow_feedback')
      .update({ resolved_at: new Date().toISOString() }).eq('id', parsed.data.id).eq('employee_id', context.userId)
    if (error) throw new Error(error.message)
    return Response.json({ resolved: true })
  } catch (error) {
    return errorResponse(error)
  }
}
