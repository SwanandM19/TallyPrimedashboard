"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LedgerOption } from "@/lib/cashflow-review";

const fmt = (n: number) =>
  n === 0 ? "-" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const short = (s: string, max = 60) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * The "which Tally ledgers count in this row?" dropdown.
 * A small button under the row name opens a searchable list of every ledger of the company.
 * Tick the ledgers that belong to the row and press Save: the row then shows their total from Supabase.
 */
export function LedgerPicker({
  rowId,
  rowName,
  flow,
  options,
  rowNames,
  periodLabel,
  onSave,
}: {
  rowId: string;
  rowName: string;
  flow: "receipt" | "payment";
  options: LedgerOption[];
  rowNames: Record<string, string>;
  periodLabel?: string;
  onSave: (ledgers: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [firstShown, setFirstShown] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Only the ledgers of this side: receipts for income rows, payments for expense rows.
  const side = useMemo(() => options.filter((o) => o.flow === flow), [options, flow]);
  const inRow = useMemo(() => side.filter((o) => o.counted_in === rowId), [side, rowId]);
  const picked = useMemo(() => inRow.filter((o) => o.via === "pick"), [inRow]);

  function openDialog() {
    setSelected(new Set(picked.map((o) => o.ledger)));
    setFirstShown(new Set(inRow.map((o) => o.ledger)));
    setQuery("");
    setError("");
    setOpen(true);
  }

  function toggle(ledger: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(ledger)) next.delete(ledger);
      else next.add(ledger);
      return next;
    });
  }

  // Ledgers already in this row come first (the order does not jump while ticking); the rest keep "largest first".
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = side.filter((o) => !q || o.ledger.toLowerCase().includes(q));
    return [...list.filter((o) => firstShown.has(o.ledger)), ...list.filter((o) => !firstShown.has(o.ledger))];
  }, [side, query, firstShown]);

  const total = useMemo(
    () =>
      side
        .filter((o) => (o.counted_in === rowId && o.via === "rule") || selected.has(o.ledger))
        .reduce((sum, o) => sum + o.amount_lakhs, 0),
    [side, rowId, selected],
  );
  const count = useMemo(
    () => side.filter((o) => (o.counted_in === rowId && o.via === "rule") || selected.has(o.ledger)).length,
    [side, rowId, selected],
  );

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(Array.from(selected));
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    }
    setSaving(false);
  }

  const label =
    inRow.length === 0
      ? "Select ledgers…"
      : `${short(inRow[0].ledger, 34)}${inRow.length > 1 ? ` +${inRow.length - 1} more` : ""}`;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="no-print mt-1 flex w-full items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        title={
          inRow.length === 0
            ? "Choose which Tally ledgers count in this row"
            : `Ledgers counted in this row:\n${inRow.map((o) => `${o.ledger}  ${fmt(o.amount_lakhs)}`).join("\n")}`
        }
      >
        <ChevronDown className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </button>

      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ledgers for this row</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{rowName.trim() || "(unnamed row)"}</span>
              <br />
              Tick the Tally ledgers whose {flow === "receipt" ? "receipts" : "payments"} belong in this row. Amounts are Rs. Lakhs
              {periodLabel ? ` for ${periodLabel}` : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="Search ledgers…"
              className="w-full rounded border border-input bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded border border-border">
            {shown.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {side.length === 0 ? "No ledgers received from Tally for this company yet." : "No ledger matches your search."}
              </p>
            )}
            {shown.map((o) => {
              const isAuto = o.counted_in === rowId && o.via === "rule";
              const elsewhere = o.counted_in && o.counted_in !== rowId;
              const where = elsewhere ? short(rowNames[o.counted_in as string]?.trim() || (o.counted_in as string), 50) : "";
              return (
                <label
                  key={o.ledger}
                  className={`flex items-start gap-2 border-b border-border/50 px-2 py-1.5 text-sm ${isAuto ? "bg-muted/40" : "cursor-pointer hover:bg-accent/50"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={isAuto || selected.has(o.ledger)}
                    disabled={isAuto}
                    onChange={() => toggle(o.ledger)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{o.ledger}</span>
                    {isAuto && (
                      <span className="block text-xs text-muted-foreground">
                        Counts here through an automatic rule. To move it, tick it in another row.
                      </span>
                    )}
                    {elsewhere && (
                      <span className="block text-xs text-muted-foreground">
                        Now counted in: {where}
                        {o.via === "rule" ? " (automatic rule)" : ""}. Ticking it here moves it.
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">{fmt(o.amount_lakhs)}</span>
                </label>
              );
            })}
          </div>

          {error && <p role="alert" className="text-sm text-negative">{error}</p>}

          <DialogFooter className="items-center gap-2 sm:justify-between sm:space-x-0">
            <span className="text-sm text-muted-foreground">
              {count} ledger{count === 1 ? "" : "s"} · total <span className="font-semibold text-foreground">{fmt(total)}</span>
            </span>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
