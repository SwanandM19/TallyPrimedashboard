'use client'

import { createContext, useContext } from 'react'

/** One "Actual Taken" figure that the dashboard got from Tally, in Rs. Lakhs. */
export type TallyCell = { amount: number; confirmed: boolean; ledgers: number }
export type TallyByRow = Record<string, TallyCell>

/**
 * One Tally ledger that can be ticked for a row. `amount_lakhs` is its amount in the chosen dates.
 * `counted_in` is the row it counts in right now (empty = not counted anywhere);
 * `via` says why: 'pick' = a person ticked it, 'rule' = an automatic rule.
 */
export type LedgerOption = {
  flow: 'receipt' | 'payment'
  ledger: string
  amount_lakhs: number
  counted_in: string | null
  via: 'pick' | 'rule' | null
}

type ReviewContext = {
  initialRows?: unknown[]
  onRowsChange?: (rows: unknown[]) => void
  markedCells?: Set<string>
  /** Tally figures for the sheet that is open. Undefined = do not fill from Tally (admin page, or nothing loaded). */
  tally?: TallyByRow
  /** Ledgers that can be ticked per row. Undefined = no ledger dropdown (admin page, nothing loaded, or the SQL file is missing). */
  ledgerOptions?: LedgerOption[]
  /** Saves the ledgers ticked for one row (and reloads the figures). */
  onPickLedgers?: (rowId: string, flow: 'receipt' | 'payment', ledgers: string[]) => Promise<void>
  /** The dates the figures are for, only used for the wording in the dropdown. */
  periodLabel?: string
}
export const CashflowReviewContext = createContext<ReviewContext>({})
export const useCashflowReview = () => useContext(CashflowReviewContext)
export const markedClass = (marked: Set<string> | undefined, row: string, field: string) => marked?.has(`${row}:${field}`) ? ' review-blink' : ''
