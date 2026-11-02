"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Calendar, Printer, Send, LogOut, Check } from 'lucide-react'
import { getSupabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CashflowReviewContext } from '@/lib/cashflow-review'
import { TABS, type SheetId } from '@/lib/cashflow-sheets'
import { approveReport, getWorkspace, reviewReport, resolveFeedback, submitReport, type Workspace } from '@/lib/api'
import { isTallySheet, loadTally, periodFromSubtitle, quickPeriods, type Period, type TallyLoad } from '@/lib/tally'
import { CashflowTable, opplConfig, ppplConfig, mcplConfig, apexConfig } from './CashflowTable'
import { PreranaTable } from './PreranaTable'
import { RaTable } from './RaTable'
import { TallyBar } from './TallyBar'
import type { SupabaseClient, User } from '@supabase/supabase-js'

const SHEET_CONFIGS = { oppl: opplConfig, pppl: ppplConfig, mcpl: mcplConfig, apex: apexConfig }

function defaultPeriod(sheet: SheetId): Period {
  const config = (SHEET_CONFIGS as Record<string, { subtitle: string }>)[sheet]
  return (config && periodFromSubtitle(config.subtitle)) || quickPeriods(new Date())[2].period
}

function Sheet({ id }: { id: SheetId }) {
  if (id === 'prerana') return <PreranaTable />
  if (id === 'ra') return <RaTable />
  return <CashflowTable config={SHEET_CONFIGS[id]} />
}

export function CashflowWorkspace({ adminPage = false }: { adminPage?: boolean }) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tab, setTab] = useState<SheetId>('oppl')
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [submissionMessage, setSubmissionMessage] = useState('')
  const draft = useRef<unknown[]>([])
  const baseline = useRef<unknown[]>([])
  const [periods, setPeriods] = useState<Partial<Record<SheetId, Period>>>({})
  const [tallyData, setTallyData] = useState<Partial<Record<SheetId, TallyLoad>>>({})
  const [tallyLoading, setTallyLoading] = useState(false)
  const [tallyError, setTallyError] = useState('')
  const [tallyReload, setTallyReload] = useState(0)
  useEffect(() => {
    let supabase: SupabaseClient
    try { supabase = getSupabase() } catch (err) { setError(err instanceof Error ? err.message : 'Supabase is not configured'); setAuthReady(true); return }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setAuthReady(true) })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null) })
    return () => subscription.subscription.unsubscribe()
  }, [])
  const refresh = useCallback(async () => {
    try { setWorkspace(await getWorkspace()); setError('') }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load reports') }
  }, [])
  useEffect(() => { if (user) void refresh(); else setWorkspace(null) }, [user, refresh])
  const period = periods[tab] ?? defaultPeriod(tab)
  const showTally = !adminPage && isTallySheet(tab)
  useEffect(() => {
    if (!user || !showTally) return
    let cancelled = false
    setTallyLoading(true)
    loadTally(tab, period).then((data) => { if (!cancelled) { setTallyData((current) => ({ ...current, [tab]: data })); setTallyError('') } })
      .catch((err) => { if (!cancelled) setTallyError(err instanceof Error ? err.message : 'Unable to read Tally figures') })
      .finally(() => { if (!cancelled) setTallyLoading(false) })
    return () => { cancelled = true }
  }, [user, showTally, tab, period.from, period.to, tallyReload]) // eslint-disable-line react-hooks/exhaustive-deps
  const tallyByRow = showTally ? tallyData[tab]?.byRow : undefined
  const reports = workspace?.reports ?? []
  const employeeId = reports[0]?.employee_id ?? null
  const selected = reports.find((r) => r.sheet === tab && (adminPage ? r.employee_id === employeeId : r.employee_id === user?.id))
  const feedback = workspace?.feedback ?? []
  const activeFeedback = feedback.filter((item) => !item.resolved_at && (!adminPage || item.employee_id === employeeId))
  const approvals = (workspace?.approvals ?? []).filter((item) => reports.some((report) => report.id === item.report_id && report.submitted_at === item.submitted_at && (!adminPage || report.employee_id === employeeId)))
  const selectedApproved = approvals.some((item) => item.report_id === selected?.id)
  const markedCells = useMemo(() => new Set(activeFeedback.filter((item) => item.sheet === tab && item.row_id && item.field).map((item) => `${item.row_id}:${item.field}`)), [activeFeedback, tab])
  const initialRows = Array.isArray(selected?.rows) ? selected.rows : undefined
  const sheetKey = `${adminPage ? employeeId : user?.id}:${tab}:${selected?.id ?? 'new'}:${selected?.updated_at ?? ''}`
  const onRowsChange = useCallback((rows: unknown[]) => { draft.current = rows }, [])
  useEffect(() => { baseline.current = initialRows ?? [] }, [sheetKey])
  async function handleAuth(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const result = await getSupabase().auth.signInWithPassword({ email, password })
      if (result.error) setError(result.error.message)
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed') }
    setBusy(false)
  }
  async function handleSubmit() {
    setBusy(true); setNotice('')
    try {
      const result = await submitReport({ sheet: tab, rows: draft.current as Record<string, unknown>[] })
      setWorkspace((current) => current ? { ...current, feedback: current.feedback.map((item) => item.report_id === result.id && item.row_id && !item.resolved_at ? { ...item, resolved_at: new Date().toISOString() } : item) } : current)
      setSubmissionMessage(`${TABS.find((item) => item.id === tab)?.label} has been submitted for admin review. ${result.emailSent ? 'Email sent to suhas@mantri.com.' : 'The report was saved, but the email could not be sent.'}`)
      await refresh()
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Submission failed') }
    setBusy(false)
  }
  async function handleReview() {
    if (!selected) return
    setBusy(true); setNotice('')
    try {
      const previous = baseline.current as Record<string, unknown>[]
      const current = draft.current as Record<string, unknown>[]
      const changes = current.flatMap((row) => {
        const old = previous.find((item) => item.id === row.id)
        if (!old || typeof row.id !== 'string') return []
        return Object.keys(row).filter((field) => !['id', 'srNo'].includes(field) && JSON.stringify(row[field]) !== JSON.stringify(old[field])).map((field) => ({ rowId: row.id as string, field }))
      })
      if (!changes.length && !comment.trim()) { setNotice('Make a change or add a comment first.'); return }
      await reviewReport({ reportId: selected.id, rows: current, changes, comment })
      setComment(''); await refresh(); setNotice('Changes sent. The employee can see the updated sheet and notifications under the bell.')
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Could not save review') }
    finally { setBusy(false) }
  }
  async function handleApprove() {
    if (!selected) return
    if (JSON.stringify(draft.current) !== JSON.stringify(baseline.current) || comment.trim()) {
      setNotice('Send and notify employee about your changes or comment before approving.')
      return
    }
    setBusy(true); setNotice('')
    try {
      await approveReport({ reportId: selected.id })
      await refresh()
      setNotice('Report approved. The employee will see the approval under the bell.')
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Could not approve report') }
    finally { setBusy(false) }
  }
  if (!authReady) return <main className="p-8 text-muted-foreground">Loading…</main>
  if (!user) return <main className="min-h-screen bg-background flex items-center justify-center p-4"><form onSubmit={handleAuth} className="w-full max-w-sm bg-card border border-border p-7 space-y-4 rounded-md"><h1 className="text-2xl font-bold">{adminPage ? 'Admin sign in' : 'Cashflow sign in'}</h1><input className="w-full border border-input bg-background p-2 rounded" type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} /><input className="w-full border border-input bg-background p-2 rounded" type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /><Button disabled={busy} className="w-full">Sign in</Button>{error && <p role="alert" className="text-negative">{error}</p>}{notice && <p className="text-muted-foreground">{notice}</p>}</form></main>
  if (adminPage && workspace && !workspace.admin) return <main className="p-8"><h1 className="text-2xl font-bold">Admin access required</h1><p className="mt-3 text-muted-foreground">Sign in with the designated, verified admin email address to review submitted cashflows.</p><Button variant="outline" className="mt-4" onClick={() => void getSupabase().auth.signOut()}>Sign out</Button></main>
  if (!workspace) return <main className="p-8">Loading reports… {error && <p role="alert" className="text-negative">{error}</p>}</main>
  const monthYear = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  return <main className="min-h-screen bg-background"><div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <header className="flex flex-wrap gap-4 justify-between items-center px-4 py-4 no-print"><div><h2 className="font-semibold text-lg">{adminPage ? 'Admin review' : 'Ashok Aggarwal'}</h2><p className="text-sm text-primary font-medium">{adminPage ? user.email : 'HOD - Accounts'}</p></div><div className="flex items-center gap-3">{!adminPage && <div className="relative"><Button variant="ghost" size="icon" title="Notifications" aria-label="Notifications" onClick={() => { setShowAlerts(!showAlerts); if (!showAlerts) void refresh() }}><Bell />{activeFeedback.length + approvals.length > 0 && <span className="absolute top-0 right-0 bg-negative text-primary-foreground text-xs rounded-full min-w-4 text-center">{activeFeedback.length + approvals.length}</span>}</Button>{showAlerts && <div className="absolute right-0 top-11 z-20 w-80 max-h-96 overflow-auto bg-popover text-popover-foreground border border-border shadow-lg p-4 rounded-md"><h3 className="font-semibold mb-2">Notifications</h3>{!activeFeedback.length && !approvals.length && <p className="text-sm text-muted-foreground">No new reviews</p>}{approvals.map((item) => { const report = reports.find((r) => r.id === item.report_id); return <div key={item.report_id} className="border-t border-border py-3 text-sm"><strong>{TABS.find((t) => t.id === report?.sheet)?.label}</strong> has been approved.</div> })}{activeFeedback.map((item) => <div key={item.id} className="border-t border-border py-3 text-sm"><p><strong>{TABS.find((t) => t.id === item.sheet)?.label}</strong>: {item.message || `Admin updated ${item.field} in row ${item.row_id}. Correct this cell and submit the sheet to clear its highlight.`}</p>{item.message && <Button size="sm" variant="ghost" onClick={async () => { await resolveFeedback({ id: item.id }); await refresh() }}>Mark reviewed</Button>}</div>)}</div>}</div>}<span className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-md text-sm"><Calendar className="size-4" />{monthYear}</span><Button variant="ghost" size="icon" title="Sign out" onClick={() => void getSupabase().auth.signOut()}><LogOut /></Button></div></header>
    <h1 className="text-center text-3xl font-bold uppercase">CASHFLOW</h1>
    <nav className="flex flex-wrap gap-2 border-b border-border items-center no-print">{TABS.map((item) => <Button key={item.id} variant="ghost" onClick={() => { setTab(item.id); setNotice('') }} className={`rounded-none border-b-2 ${tab === item.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{item.label}</Button>)}<Button className="ml-auto" title="Print or save as PDF" onClick={() => window.print()}><Printer />Print to PDF</Button></nav>
    {showTally && <TallyBar sheet={tab} period={period} onPeriod={(p) => setPeriods((current) => ({ ...current, [tab]: p }))} data={tallyData[tab]} loading={tallyLoading} error={tallyError} onRefresh={() => setTallyReload((n) => n + 1)} />}
    {adminPage && !selected ? <p className="py-12 text-center text-muted-foreground">No {TABS.find((t) => t.id === tab)?.label} submission yet.</p> : <div className="print-area"><CashflowReviewContext.Provider key={sheetKey} value={{ initialRows, onRowsChange, markedCells, tally: tallyByRow }}><Sheet id={tab} /></CashflowReviewContext.Provider></div>}
    {adminPage ? selected && <section className="no-print space-y-3"><label htmlFor="admin-comment" className="block font-semibold">Comment for employee</label><textarea id="admin-comment" className="w-full min-h-24 border border-input bg-background p-3 rounded-md" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment about this cashflow…" /><div className="flex flex-wrap gap-3"><Button onClick={handleApprove} disabled={busy || selectedApproved}><Check />{selectedApproved ? 'Approved' : 'Approve'}</Button><Button variant="outline" onClick={handleReview} disabled={busy}><Send />Send & notify employee</Button></div></section> : <div className="flex justify-end no-print"><Button size="lg" onClick={handleSubmit} disabled={busy}><Send />Submit Cashflow</Button></div>}
    {notice && <p role="status" className="text-sm text-muted-foreground no-print">{notice}</p>}
    <Dialog open={Boolean(submissionMessage)} onOpenChange={(open) => { if (!open) setSubmissionMessage('') }}><DialogContent><DialogHeader><DialogTitle>Cashflow submitted</DialogTitle><DialogDescription>{submissionMessage}</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setSubmissionMessage('')}>OK</Button></DialogFooter></DialogContent></Dialog>
  </div></main>
}
