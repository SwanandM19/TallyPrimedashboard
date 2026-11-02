'use client'

import { getSupabase } from '@/lib/supabase/client'
import type { TallyByRow } from '@/lib/cashflow-review'
import type { SheetId } from '@/lib/cashflow-sheets'

/** The four sheets whose "Actual Taken" column can be filled from Tally. Prerana and RA stay manual. */
export const TALLY_SHEETS: SheetId[] = ['oppl', 'pppl', 'mcpl', 'apex']
export const isTallySheet = (id: SheetId) => TALLY_SHEETS.includes(id)

/** Part of the Tally company name that belongs to each sheet (only used to pick the right status line). */
export const SHEET_COMPANY_HINT: Record<string, string> = {
  oppl: 'Omega Premises',
  pppl: 'Pentagon Premises',
  mcpl: 'Mantri Constructions',
  apex: 'Apex Premises',
}

export type Period = { from: string; to: string }   // yyyy-mm-dd
export type UnmatchedLedger = { flow: 'receipt' | 'payment'; ledger: string; amount_lakhs: number }
export type CompanyStatus = { company: string; first_day: string; last_day: string; days: number; vouchers: number; last_ingest: string }
export type TallyLoad = {
  byRow: TallyByRow
  unmatched: UnmatchedLedger[]
  status: CompanyStatus[]
  loadedAt: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate()
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "JUL TO SEP-2026 (Rs. in Lakhs)" -> 2026-07-01 .. 2026-09-30.  Null when the text has no such period. */
export function periodFromSubtitle(subtitle: string): Period | null {
  const m = /([A-Z]{3})\s+TO\s+([A-Z]{3})-(\d{4})/i.exec(subtitle)
  if (!m) return null
  const a = MONTHS.indexOf(m[1].toUpperCase()) + 1
  const b = MONTHS.indexOf(m[2].toUpperCase()) + 1
  const year = Number(m[3])
  if (a < 1 || b < 1) return null
  const startYear = a > b ? year - 1 : year
  return { from: iso(startYear, a, 1), to: iso(year, b, lastDayOf(year, b)) }
}

export function quickPeriods(now: Date): { label: string; period: Period }[] {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const prevY = m === 1 ? y - 1 : y
  const prevM = m === 1 ? 12 : m - 1
  const qStart = Math.floor((m - 1) / 3) * 3 + 1
  const pqStart = qStart === 1 ? 10 : qStart - 3
  const pqYear = qStart === 1 ? y - 1 : y
  return [
    { label: 'This month', period: { from: iso(y, m, 1), to: iso(y, m, lastDayOf(y, m)) } },
    { label: 'Last month', period: { from: iso(prevY, prevM, 1), to: iso(prevY, prevM, lastDayOf(prevY, prevM)) } },
    { label: 'This quarter', period: { from: iso(y, qStart, 1), to: iso(y, qStart + 2, lastDayOf(y, qStart + 2)) } },
    { label: 'Last quarter', period: { from: iso(pqYear, pqStart, 1), to: iso(pqYear, pqStart + 2, lastDayOf(pqYear, pqStart + 2)) } },
  ]
}

export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return day
  return `${d} ${MONTHS[m - 1].charAt(0)}${MONTHS[m - 1].slice(1).toLowerCase()} ${y}`
}

type ActualRow = { row_id: string; flow: string; amount_lakhs: number | string; confirmed: boolean; ledgers: number }

/** Reads the figures from Supabase as the signed-in user (row level security applies). */
export async function loadTally(sheet: SheetId, period: Period): Promise<TallyLoad> {
  const supabase = getSupabase()
  const [actuals, unmatched, status] = await Promise.all([
    supabase.rpc('tally_actuals', { p_sheet: sheet, p_from: period.from, p_to: period.to }),
    supabase.rpc('tally_unmatched', { p_sheet: sheet, p_from: period.from, p_to: period.to }),
    supabase.rpc('tally_status'),
  ])
  if (actuals.error) throw new Error(actuals.error.message)
  const byRow: TallyByRow = {}
  for (const r of (actuals.data ?? []) as ActualRow[]) {
    byRow[r.row_id] = { amount: Number(r.amount_lakhs), confirmed: Boolean(r.confirmed), ledgers: Number(r.ledgers) }
  }
  return {
    byRow,
    unmatched: unmatched.error ? [] : ((unmatched.data ?? []) as UnmatchedLedger[]).map((u) => ({ ...u, amount_lakhs: Number(u.amount_lakhs) })),
    status: status.error ? [] : ((status.data ?? []) as CompanyStatus[]),
    loadedAt: Date.now(),
  }
}
