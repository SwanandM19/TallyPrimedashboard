"use client";

import { useCashflowReview, markedClass } from "@/lib/cashflow-review";
import { useMemo, useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditableCell, formatNumber } from "./CashflowTable";
import { raInitialRows, type RaRow } from "@/data/raCashflow";

type NumericKey = "estimatedAmount" | "actual" | "estimated" | "amountLakhs";
type CellKey = "area" | "rate" | NumericKey;
const numericKeys: NumericKey[] = ["estimatedAmount", "actual", "estimated", "amountLakhs"];
const paymentKeys: CellKey[] = ["area", "rate", ...numericKeys];

export function RaTable() {
  const { initialRows, onRowsChange, markedCells } = useCashflowReview();
  const [rows, setRows] = useState<RaRow[]>((initialRows as RaRow[] | undefined) ?? raInitialRows);
  useEffect(() => { onRowsChange?.(rows); }, [rows, onRowsChange]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<RaRow>) =>
    setRows((old) => old.map((row) => row.id === id ? { ...row, ...patch } : row));
  const addRow = (after: RaRow) => setRows((old) => {
    const index = old.findIndex((row) => row.id === after.id);
    const next = [...old];
    next.splice(index + 1, 0, { id: crypto.randomUUID(), srNo: "", particulars: "", sectionKey: after.sectionKey,
      area: null, rate: null, estimatedAmount: null, actual: null, estimated: null, amountLakhs: null });
    return next;
  });
  const deleteRow = (id: string) => setRows((old) => old.filter((row) => row.id !== id));
  const askDelete = (row: RaRow) => {
    if (row.particulars.trim() || paymentKeys.some((key) => row[key] !== null)) setDeleteId(row.id);
    else deleteRow(row.id);
  };

  const displayRows = useMemo(() => {
    const counts = { B: 0, C: 0 };
    return rows.map((row) => {
      if (row.sectionKey === "B" || row.sectionKey === "C") {
        counts[row.sectionKey]++;
        return { ...row, srNo: String(counts[row.sectionKey]) };
      }
      return row;
    });
  }, [rows]);
  const total = (sections: RaRow["sectionKey"][], key: NumericKey) =>
    rows.filter((row) => sections.includes(row.sectionKey)).reduce((sum, row) => sum + (row[key] ?? 0), 0);
  const receipts = (key: NumericKey) => total(["A", "B"], key);
  const payments = (key: NumericKey) => total(["C"], key);
  const withInterest = (key: NumericKey) => payments(key) + total(["I"], key);

  const numberCell = (row: RaRow, key: NumericKey) => (
    <td key={key} className={`border border-border px-3 py-2 min-w-32${markedClass(markedCells, row.id, key)}`}>
      <EditableCell value={row[key]} onChange={(value) => update(row.id, { [key]: value })} />
    </td>
  );
  const textCell = (row: RaRow, key: "area" | "rate") => (
    <td key={key} className={`border border-border px-3 py-2 min-w-28${markedClass(markedCells, row.id, key)}`}>
      <input aria-label={`${row.particulars} ${key}`} className="w-full bg-transparent outline-none text-right focus:border-b focus:border-primary" type="text"
        value={row[key] ?? ""} onChange={(event) => {
          const text = event.target.value;
          update(row.id, { [key]: text === "" ? null : /^-?\d+(\.\d*)?$/.test(text) ? Number(text) : text });
        }} />
    </td>
  );
  const summary = (label: string, values: Partial<Record<NumericKey, number>>, balance = false) => (
    <tr key={label} className="bg-total-row-bg font-bold">
      <td className="border border-border px-3 py-2" />
      <td className="border border-border px-4 py-2">{label}</td>
      <td className="border border-border" /><td className="border border-border" />
      {numericKeys.map((key) => <td key={key} className={`border border-border px-4 py-2 text-right ${balance && values[key] != null ? (values[key] >= 0 ? "text-positive" : "text-negative") : ""}`}>
        {values[key] === undefined ? "" : formatNumber(values[key] ?? null)}
      </td>)}
      <td className="border border-border no-print" />
    </tr>
  );
  const item = (row: RaRow) => <tr key={row.id} className="hover:bg-accent/50">
    <td className="border border-border px-3 py-2 text-center text-muted-foreground">{row.srNo}</td>
    <td colSpan={row.sectionKey === "A" || row.sectionKey === "B" ? 4 : 1} className={`border border-border px-4 py-2 min-w-72 text-left${markedClass(markedCells, row.id, "particulars")}`}>
      <input aria-label={`Item ${row.srNo}`} className="w-full bg-transparent outline-none focus:border-b focus:border-primary" value={row.particulars}
        onChange={(event) => update(row.id, { particulars: event.target.value })} placeholder="Enter item name..." />
    </td>
    {row.sectionKey === "A" || row.sectionKey === "B" ? null : <>{textCell(row, "area")}{textCell(row, "rate")}{numberCell(row, "estimatedAmount")}</>}
    {numberCell(row, "actual")}{numberCell(row, "estimated")}{numberCell(row, "amountLakhs")}
    <td className="border border-border px-2 no-print"><div className="flex justify-center">
      <Button variant="ghost" size="icon" className="size-7" title="Add row below" aria-label="Add row below" onClick={() => addRow(row)}><Plus /></Button>
      <Button variant="ghost" size="icon" className="size-7" title="Delete row" aria-label="Delete row" onClick={() => askDelete(row)}><Trash2 /></Button>
    </div></td>
  </tr>;
  const section = (letter: string, name: string) => {
    if (letter === "C") {
      return <tr className="bg-section-header-bg font-semibold" key={letter}>
        <td className="border border-border px-3 py-2 text-center">{letter}</td>
        <td className="border border-border px-4 py-2 text-lg">{name}</td>
        <td className="border border-border px-3 py-2 text-center">AREA</td>
        <td className="border border-border px-3 py-2 text-center">RATE</td>
        <td className="border border-border px-3 py-2 text-center">Estimated Amt.</td>
        <td className="border border-border" />
        <td className="border border-border" />
        <td className="border border-border" />
        <td className="border border-border no-print" />
      </tr>;
    }

    return <tr className="bg-section-header-bg font-semibold" key={letter}>
      <td className="border border-border px-3 py-2 text-center">{letter}</td>
      <td colSpan={7} className="border border-border px-4 py-2">{name}</td>
      <td className="border border-border no-print" />
    </tr>;
  };

  return <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-border"><h3 className="text-lg font-bold text-foreground">RA - Ghatkopar Cash Flow</h3><p className="text-sm text-muted-foreground">JUL TO SEP-2026 (Rs. in Lakhs)</p></div>
    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[1100px]">
      <thead><tr className="bg-primary text-primary-foreground">
        {["Sr. No.", "EXPENSES", "", "", "", "Actual Received / Paid", "Estimated", "Amt. Rs. In Lakhs"].map((heading, index) =>
          <th key={`${heading}-${index}`} className="border border-primary-foreground/30 px-3 py-3 text-left font-semibold">{heading}</th>)}
        <th className="border border-primary-foreground/30 px-2 py-3 no-print">Actions</th>
      </tr></thead>
      <tbody>
        {section("A", "Fixed Deposit")}
        {displayRows.filter((row) => row.sectionKey === "A").map(item)}
        {section("B", "Receipts")}
        {displayRows.filter((row) => row.sectionKey === "B").map(item)}
        {summary("Total Receipts", { actual: receipts("actual"), estimated: receipts("estimated"), amountLakhs: receipts("amountLakhs") })}
        {section("C", "Payments")}
        {displayRows.filter((row) => row.sectionKey === "C").map(item)}
        {summary("Total Payments", { estimatedAmount: payments("estimatedAmount"), actual: payments("actual"), estimated: payments("estimated") })}
        {displayRows.filter((row) => row.sectionKey === "I").map(item)}
        {summary("Total Payments Including Interest", { estimatedAmount: withInterest("estimatedAmount"), actual: withInterest("actual"), estimated: withInterest("estimated") })}
        {summary("Balance C/fd.", { actual: receipts("actual") - withInterest("actual") + 0.2, estimated: receipts("estimated") - payments("estimated") - 1 }, true)}
      </tbody>
    </table></div>
    <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Delete Row</DialogTitle><DialogDescription>Are you sure you want to delete this row?</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>No</Button><Button variant="destructive" onClick={() => { if (deleteId) deleteRow(deleteId); setDeleteId(null); }}>Yes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}