"use client";

import { useCashflowReview, markedClass } from "@/lib/cashflow-review";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EditableCell, formatNumber } from "./CashflowTable";

// 8 visual columns:
//  0: Sr.No.
//  1: Particulars (EXPENSES / Payments)
//  2: AREA (Payments only)
//  3: blank   (Payments only)
//  4: Estimated Amt.   (Payments only)
//  5: Actual Paid (Payments) / Actual Received upto Last Month (Receipts)
//  6: Estimated this month (both)
//  7: Amt. Rs. In Lakhs (both)

type Side = "receipts" | "payments";

interface PRow {
  id: string;
  srNo: string;
  particulars: string;
  type: "section" | "subheader" | "item" | "total" | "grandTotal" | "balance";
  sectionKey?: string;
  side?: Side;
  isEditable?: boolean;
  // Payments-only text inputs
  areaText?: string;
  noteText?: string;
  // Numeric values aligned to visual columns 4-7
  estAmt?: number | null;     // col 4 (payments)
  actual?: number | null;     // col 5 (payments) / col 5 (receipts: Actual Received upto Last Month)
  estMonth?: number | null;   // col 6
  amtLakhs?: number | null;   // col 7
}

const initialRows: PRow[] = [
  { id: "pa", srNo: "A", particulars: "Fixed Deposit", type: "section", sectionKey: "PA", side: "receipts" },
  { id: "pb0", srNo: "B", particulars: "Receipts", type: "section", sectionKey: "PB", side: "receipts" },
  { id: "pb1", srNo: "1", particulars: "Balance B/fd.", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb2", srNo: "2", particulars: "RERA A/c", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb3", srNo: "3", particulars: "Finance - Loan", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb4", srNo: "4", particulars: "ICD", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb5", srNo: "5", particulars: "J.V. Partner", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb6", srNo: "6", particulars: "Deposit with SBI for BG", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb7", srNo: "7", particulars: "Interest Received on Fixed Deposits", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb8", srNo: "8", particulars: "PPPL", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pb9", srNo: "9", particulars: "Receivable from Customers / Sale of Units", type: "item", sectionKey: "PB", side: "receipts", isEditable: true },
  { id: "pbt", srNo: "", particulars: "Total Receipts", type: "grandTotal", side: "receipts" },

  // Payments sub-header (acts like the C row in Excel with its own column headers)
  { id: "pc-sub", srNo: "C", particulars: "Payments", type: "subheader", sectionKey: "PC", side: "payments" },

  { id: "pc1", srNo: "1", particulars: "SOC AGREEMENT, LEGAL, MUTATION , PMC ETC", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc2", srNo: "2", particulars: "BROKARAGE - ETC", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc3", srNo: "3", particulars: "STAMP DUTY LAND", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc4", srNo: "4", particulars: "STAMP DUTY MEMBERS", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc5", srNo: "5", particulars: "MEMBER CORPUS", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc6", srNo: "6", particulars: "MEMBER RENT 24 MONTHS + BROKERAGE - RES (Point No.6 & 7)", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc8", srNo: "8", particulars: "MEMBERS SHIFTING CHARGES", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc9", srNo: "9", particulars: "BANK GURANTY - SWM", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc10", srNo: "10", particulars: "BANK DEPOSIT", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc11", srNo: "11", particulars: "FSI - MCGM - BAL 50%", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc12", srNo: "12", particulars: "TDR SLUM - 80% of RR", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc13", srNo: "13", particulars: "TDR - OPEN MKT - 43% of RR", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc14", srNo: "14", particulars: "TDR STAMP DUTY, REGD & BROKERAGE", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc15", srNo: "15", particulars: "NOC/LEGAL/SANCTIONS /ASSESSMENT", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc16", srNo: "16", particulars: "SANCTIONS - MCGM: SCRUTINY FEES", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc17", srNo: "17", particulars: "CONSTRUCTIONS (FSI * 1.45)", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc18", srNo: "18", particulars: "AR/CONSULTANTS", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc19", srNo: "19", particulars: "OVERHEADS DIRECT", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc20", srNo: "20", particulars: "OVERHEADS INDIRECT", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc21", srNo: "21", particulars: "MARKETING & BROKERAGE", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc22", srNo: "22", particulars: "GST - Members additional area - 5%", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc23", srNo: "23", particulars: "Tenant Garage compenstion", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc24", srNo: "24", particulars: "FINANCE CHARGES", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pc25", srNo: "25", particulars: "EXCESS / SHORT PAYAMENTS", type: "item", sectionKey: "PC", side: "payments", isEditable: true },
  { id: "pct", srNo: "", particulars: "Total Payments", type: "total", sectionKey: "PC", side: "payments" },
  { id: "pc26", srNo: "26", particulars: "ICD Interest", type: "item", sectionKey: "PCINT", side: "payments", isEditable: true },
  { id: "pc27", srNo: "27", particulars: "Interest on Term Loan", type: "item", sectionKey: "PCINT", side: "payments", isEditable: true },
  { id: "pcit", srNo: "", particulars: "Total Payments Including Interest", type: "grandTotal", side: "payments" },
  { id: "pbal", srNo: "", particulars: "Balance C/fd.", type: "balance", side: "payments" },
];

type NumKey = "estAmt" | "actual" | "estMonth" | "amtLakhs";

function sumSection(rows: PRow[], sectionKey: string, key: NumKey): number {
  return rows.filter((r) => r.sectionKey === sectionKey && r.type === "item")
    .reduce((s, r) => s + (r[key] || 0), 0);
}

function compute(rows: PRow[]): PRow[] {
  return rows.map((row) => {
    if (row.type === "total" && row.sectionKey) {
      return {
        ...row,
        estAmt: sumSection(rows, row.sectionKey, "estAmt"),
        actual: sumSection(rows, row.sectionKey, "actual"),
        estMonth: sumSection(rows, row.sectionKey, "estMonth"),
        amtLakhs: sumSection(rows, row.sectionKey, "amtLakhs"),
      };
    }
    if (row.id === "pbt") {
      const k: NumKey[] = ["estAmt", "actual", "estMonth", "amtLakhs"];
      const out: Partial<Record<NumKey, number>> = {};
      k.forEach((kk) => { out[kk] = sumSection(rows, "PA", kk) + sumSection(rows, "PB", kk); });
      return { ...row, ...out };
    }
    if (row.id === "pcit") {
      const k: NumKey[] = ["estAmt", "actual", "estMonth", "amtLakhs"];
      const out: Partial<Record<NumKey, number>> = {};
      k.forEach((kk) => { out[kk] = sumSection(rows, "PC", kk) + sumSection(rows, "PCINT", kk); });
      return { ...row, ...out };
    }
    if (row.id === "pbal") {
      const k: NumKey[] = ["estAmt", "actual", "estMonth", "amtLakhs"];
      const out: Partial<Record<NumKey, number>> = {};
      k.forEach((kk) => {
        const r = sumSection(rows, "PA", kk) + sumSection(rows, "PB", kk);
        const p = sumSection(rows, "PC", kk) + sumSection(rows, "PCINT", kk);
        out[kk] = r - p;
      });
      return { ...row, ...out };
    }
    return row;
  });
}

const TOTAL_COLS = 9; // 8 + Actions

export function PreranaTable() {
  const { initialRows: savedRows, onRowsChange, markedCells } = useCashflowReview();
  const [rows, setRows] = useState<PRow[]>((savedRows as PRow[] | undefined) ?? initialRows);
  useEffect(() => { onRowsChange?.(rows); }, [rows, onRowsChange]);
  const computed = compute(rows);

  const update = useCallback((id: string, patch: Partial<PRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback((afterId: string, sectionKey: string, side: Side) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === afterId);
      const newRow: PRow = {
        id: `new_${Date.now()}`,
        srNo: "",
        particulars: "",
        type: "item",
        sectionKey,
        side,
        isEditable: true,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  }, []);

  const deleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const handleDeleteClick = useCallback((row: PRow) => {
    const hasContent = row.particulars.trim() !== "" ||
      row.estAmt != null || row.actual != null || row.estMonth != null || row.amtLakhs != null ||
      (row.areaText ?? "") !== "" || (row.noteText ?? "") !== "";
    if (hasContent) setDeleteConfirmId(row.id);
    else deleteRow(row.id);
  }, [deleteRow]);

  const renumbered = useMemo(() => {
    const counters: Record<string, number> = {};
    return computed.map((row) => {
      if (row.type === "item" && row.sectionKey) {
        if (!counters[row.sectionKey]) counters[row.sectionKey] = 0;
        counters[row.sectionKey]++;
        return { ...row, srNo: String(counters[row.sectionKey]) };
      }
      return row;
    });
  }, [computed]);

  const balColor = (v: number | null | undefined) => {
    if (v == null || v === 0) return "";
    return v > 0 ? "text-positive font-bold" : "text-negative font-bold";
  };

  const numCell = (row: PRow, key: NumKey) => {
    const isBalance = row.type === "balance";
    const v = row[key] ?? null;
    return (
      <td className={`px-4 py-2 border border-border ${isBalance ? balColor(v) : ""}${markedClass(markedCells, row.id, key)}`}>
        {row.isEditable ? (
          <EditableCell value={v} onChange={(nv) => update(row.id, { [key]: nv })} />
        ) : (
          <div className="text-right">{formatNumber(v)}</div>
        )}
      </td>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-bold text-foreground">Prerana - Cash Flow</h3>
        <p className="text-sm text-muted-foreground">APR TO JUN-2026 (Rs. in Lakhs)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="w-14 px-2 py-3 font-semibold border border-primary-foreground/30 text-center">Sr. No.</th>
              <th className="px-4 py-3 font-semibold border border-primary-foreground/30 text-left w-[28%]">EXPENSES</th>
              <th colSpan={3} className="px-2 py-3 font-semibold border border-primary-foreground/30"></th>
              <th className="px-2 py-3 font-semibold border border-primary-foreground/30 text-center">Actual Received upto Last Month</th>
              <th className="px-2 py-3 font-semibold border border-primary-foreground/30 text-center">Estimated this month</th>
              <th className="px-2 py-3 font-semibold border border-primary-foreground/30 text-center">Amt. Rs. In Lakhs</th>
              <th className="w-20 px-2 py-3 font-semibold border border-primary-foreground/30 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {renumbered.map((row) => {
              const isSection = row.type === "section";
              const isSub = row.type === "subheader";
              const isTotal = row.type === "total";
              const isGrand = row.type === "grandTotal";
              const isBalance = row.type === "balance";

              if (isSub) {
                // Custom Payments sub-header row mirroring Excel
                return (
                  <tr key={row.id} className="bg-primary text-primary-foreground font-semibold">
                    <td className="px-2 py-3 border border-primary-foreground/30 text-center">{row.srNo}</td>
                    <td className="px-4 py-3 border border-primary-foreground/30 text-left">Payments</td>
                    <td className="px-2 py-3 border border-primary-foreground/30 text-center">AREA</td>
                    <td className="px-2 py-3 border border-primary-foreground/30"></td>
                    <td className="px-2 py-3 border border-primary-foreground/30 text-center">Estimated Amt.</td>
                    <td className="px-2 py-3 border border-primary-foreground/30 text-center">Actual Paid</td>
                    <td className="px-2 py-3 border border-primary-foreground/30 text-center">Estimated this month</td>
                    <td className="px-2 py-3 border border-primary-foreground/30 text-center">Amt. Rs. In Lakhs</td>
                    <td className="px-2 py-3 border border-primary-foreground/30"></td>
                  </tr>
                );
              }

              const trClass = isSection
                ? "bg-section-header-bg font-semibold"
                : isGrand || isBalance
                  ? "bg-total-row-bg font-bold"
                  : isTotal
                    ? "bg-total-row-bg font-semibold"
                    : "hover:bg-accent/50";

              if (isSection) {
                return (
                  <tr key={row.id} className={`border-b border-border ${trClass}`}>
                    <td className="px-4 py-2 text-center border border-border">{row.srNo}</td>
                    <td colSpan={TOTAL_COLS - 2} className="px-4 py-2 border border-border">{row.particulars}</td>
                    <td className="px-2 py-2 border border-border"></td>
                  </tr>
                );
              }

              const isPayments = row.side === "payments";

              return (
                <tr key={row.id} className={`border-b border-border ${trClass}`}>
                  <td className="px-4 py-2 text-center text-muted-foreground border border-border">{row.srNo}</td>
                  <td className={`px-4 py-2 border border-border${markedClass(markedCells, row.id, "particulars")}`}>
                    {row.isEditable ? (
                      <input type="text" className="bg-transparent w-full outline-none focus:border-b focus:border-primary/30"
                        value={row.particulars} onChange={(e) => update(row.id, { particulars: e.target.value })}
                        placeholder="Enter item name..." />
                    ) : row.particulars}
                  </td>

                  {isPayments ? (
                    <>
                      <td className={`px-2 py-2 border border-border${markedClass(markedCells, row.id, "areaText")}`}>
                        {row.isEditable ? (
                          <input type="text" className="bg-transparent w-full text-sm outline-none focus:bg-accent/30"
                            value={row.areaText ?? ""} onChange={(e) => update(row.id, { areaText: e.target.value })} />
                        ) : null}
                      </td>
                      <td className={`px-2 py-2 border border-border${markedClass(markedCells, row.id, "noteText")}`}>
                        {row.isEditable ? (
                          <input type="text" className="bg-transparent w-full text-sm outline-none focus:bg-accent/30"
                            value={row.noteText ?? ""} onChange={(e) => update(row.id, { noteText: e.target.value })} />
                        ) : null}
                      </td>
                      {numCell(row, "estAmt")}
                      {numCell(row, "actual")}
                      {numCell(row, "estMonth")}
                      {numCell(row, "amtLakhs")}
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2 border border-border bg-muted/30"></td>
                      <td className="px-2 py-2 border border-border bg-muted/30"></td>
                      <td className="px-2 py-2 border border-border bg-muted/30"></td>
                      {numCell(row, "actual")}
                      {numCell(row, "estMonth")}
                      {numCell(row, "amtLakhs")}
                    </>
                  )}

                  <td className="px-2 py-2 text-center border border-border">
                    {row.isEditable && (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => addRow(row.id, row.sectionKey!, row.side!)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors" title="Add row below">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteClick(row)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-negative transition-colors" title="Delete row">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
            <DialogDescription>Are you sure you want to delete this row?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <button onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors">No</button>
            <button onClick={() => { if (deleteConfirmId) deleteRow(deleteConfirmId); setDeleteConfirmId(null); }}
              className="px-4 py-2 text-sm rounded-md bg-negative text-white hover:bg-negative/80 transition-colors">Yes</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
