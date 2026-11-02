'use client'

import { createContext, useContext } from 'react'

/** One "Actual Taken" figure that the dashboard got from Tally, in Rs. Lakhs. */
export type TallyCell = { amount: number; confirmed: boolean; ledgers: number }
export type TallyByRow = Record<string, TallyCell>

type ReviewContext = {
  initialRows?: unknown[]
  onRowsChange?: (rows: unknown[]) => void
  markedCells?: Set<string>
  /** Tally figures for the sheet that is open. Undefined = do not fill from Tally (admin page, or nothing loaded). */
  tally?: TallyByRow
}
export const CashflowReviewContext = createContext<ReviewContext>({})
export const useCashflowReview = () => useContext(CashflowReviewContext)
export const markedClass = (marked: Set<string> | undefined, row: string, field: string) => marked?.has(`${row}:${field}`) ? ' review-blink' : ''
