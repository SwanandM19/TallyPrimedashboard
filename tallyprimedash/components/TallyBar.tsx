"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDay, quickPeriods, SHEET_COMPANY_HINT, type Period, type TallyLoad } from "@/lib/tally";
import { formatNumber } from "./CashflowTable";

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 2) return "just now";
  if (minutes < 90) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000) + 1;
}

export function TallyBar({
  sheet,
  period,
  onPeriod,
  data,
  loading,
  error,
  onRefresh,
}: {
  sheet: string;
  period: Period;
  onPeriod: (p: Period) => void;
  data: TallyLoad | undefined;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const presets = useMemo(() => quickPeriods(new Date()), []);
  const hint = SHEET_COMPANY_HINT[sheet];
  const company = data?.status.find((s) => s.company.toLowerCase().includes(hint.toLowerCase()));
  const rowsFilled = data ? Object.keys(data.byRow).length : 0;
  const guesses = data ? Object.values(data.byRow).filter((c) => !c.confirmed).length : 0;
  const missingDays = company ? Math.max(0, daysBetween(company.first_day, company.last_day) - company.days) : 0;
  const endsEarly = company ? company.last_day < period.to && new Date(period.to) <= new Date() : false;

  return (
    <section className="no-print rounded-lg border border-border bg-card px-4 py-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold">Actual Taken from Tally</span>
        <label className="flex items-center gap-1.5">
          From
          <input
            type="date"
            className="border border-input bg-background rounded px-2 py-1"
            value={period.from}
            max={period.to}
            onChange={(e) => e.target.value && onPeriod({ ...period, from: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-1.5">
          To
          <input
            type="date"
            className="border border-input bg-background rounded px-2 py-1"
            value={period.to}
            min={period.from}
            onChange={(e) => e.target.value && onPeriod({ ...period, to: e.target.value })}
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant="outline" onClick={() => onPeriod(p.period)}>
              {p.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} title="Read the latest figures again">
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && <p role="alert" className="text-negative">Could not read Tally figures: {error}</p>}

      {!error && data && (
        <p className="text-muted-foreground">
          {rowsFilled > 0
            ? `${rowsFilled} row${rowsFilled === 1 ? "" : "s"} filled from Tally for ${formatDay(period.from)} to ${formatDay(period.to)}.`
            : "No Tally figures for this period yet."}
          {guesses > 0 && ` ${guesses} of them use a guessed rule (marked T?).`}{" "}
          {company
            ? `Tally data received up to ${formatDay(company.last_day)} (last update ${ago(company.last_ingest)}).`
            : "Nothing received from the Tally agent for this company yet."}
          {missingDays > 0 && ` ${missingDays} day${missingDays === 1 ? " is" : "s are"} missing between ${formatDay(company!.first_day)} and ${formatDay(company!.last_day)}.`}
          {endsEarly && company && ` The period runs to ${formatDay(period.to)} but Tally data stops at ${formatDay(company.last_day)}.`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Figures are Rs. Lakhs, cash basis: Receipt vouchers (credit side) and Payment vouchers (debit side). Opening balances are not taken from Tally. A figure you type yourself is never overwritten.
      </p>

      {data && data.options === undefined && (
        <p className="text-xs text-muted-foreground">
          The ledger dropdown under each row is switched off. Run <code>04-ledger-picker.sql</code> once in Supabase (SQL Editor) to turn it on.
        </p>
      )}
      {data && data.options !== undefined && (
        <p className="text-xs text-muted-foreground">
          Under each row name there is a small dropdown (it starts as “Select ledgers…”). Use it to choose which Tally ledgers count in that row.
        </p>
      )}

      {data && data.unmatched.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-sm font-bold text-foreground hover:text-primary">
            In Tally but not counted in any row ({data.unmatched.length} ledger{data.unmatched.length === 1 ? "" : "s"}, largest first)
          </summary>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {data.unmatched.map((u) => (
              <li key={u.flow + u.ledger} className="flex justify-between gap-3 border-b border-border/50 py-0.5">
                <span className="truncate">
                  <span className="text-muted-foreground">{u.flow === "receipt" ? "Receipt" : "Payment"}: </span>
                  {u.ledger}
                </span>
                <span className="tabular-nums">{formatNumber(u.amount_lakhs)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
