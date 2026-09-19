import type { TallyTransactionRow } from "@/lib/tally/database.types";
import { formatDate, formatINR, formatTransactionType } from "@/lib/format";

const TYPE_STYLES: Record<string, string> = {
  sale: "bg-emerald-50 text-emerald-700",
  purchase: "bg-amber-50 text-amber-700",
  receipt: "bg-sky-50 text-sky-700",
  payment: "bg-rose-50 text-rose-700",
};

export function TransactionsTable({ transactions }: { transactions: TallyTransactionRow[] }) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500">No transactions yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Synced transactions from the Tally agent will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Invoice</th>
            <th className="px-4 py-3 font-medium">Party</th>
            <th className="px-4 py-3 font-medium text-right">Amount</th>
            <th className="px-4 py-3 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(tx.transaction_date)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    TYPE_STYLES[tx.transaction_type] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {formatTransactionType(tx.transaction_type)}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {tx.invoice_no ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-600">{tx.party_name ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                {formatINR(Number(tx.amount))}
              </td>
              <td className="px-4 py-3 text-slate-500">{tx.description ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
