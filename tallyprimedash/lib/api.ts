'use client'

import { getSupabase } from '@/lib/supabase/client'

export type Report = {
  id: string
  sheet: string
  employee_id: string
  rows: unknown
  submitted_at: string
  updated_at: string
}
export type Feedback = {
  id: string
  report_id: string
  employee_id: string
  sheet: string
  row_id: string | null
  field: string | null
  message: string | null
  created_at: string
  resolved_at: string | null
}
export type Approval = { report_id: string; employee_id: string; submitted_at: string; approved_at: string }
export type Workspace = { admin: boolean; reports: Report[]; feedback: Feedback[]; approvals: Approval[] }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again.')
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(json.error ?? `Request failed (${response.status})`)
  return json as T
}

export const getWorkspace = () => call<Workspace>('/api/cashflow/workspace')
export const submitReport = (input: { sheet: string; rows: Record<string, unknown>[] }) =>
  call<{ id: string; emailSent: boolean }>('/api/cashflow/submit', input)
export const reviewReport = (input: { reportId: string; rows: Record<string, unknown>[]; changes: { rowId: string; field: string }[]; comment: string }) =>
  call<{ saved: boolean }>('/api/cashflow/review', input)
export const approveReport = (input: { reportId: string }) => call<{ approved: boolean }>('/api/cashflow/approve', input)
export const resolveFeedback = (input: { id: string }) => call<{ resolved: boolean }>('/api/cashflow/resolve', input)
