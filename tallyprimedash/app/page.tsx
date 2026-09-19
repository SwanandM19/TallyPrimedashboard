import { KpiCard } from "@/components/dashboard/kpi-card";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { SyncStatus } from "@/components/dashboard/sync-status";
import { getDashboardData } from "@/lib/tally/queries";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData().catch(() => null);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Owner Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">Tally Business Overview</p>
        </header>

        {!data ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            Unable to load dashboard data. Check the Supabase configuration.
          </div>
        ) : (
          <>
            <div className="mb-6">
              <SyncStatus lastSync={data.lastSync} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label="Today's Sales" value={formatINR(data.todaysSales)} />
              <KpiCard label="Today's Purchases" value={formatINR(data.todaysPurchases)} />
              <KpiCard label="Today's Receipts" value={formatINR(data.todaysReceipts)} />
              <KpiCard label="Today's Payments" value={formatINR(data.todaysPayments)} />
              <KpiCard label="Outstanding Receivables" value="Not available yet" />
              <KpiCard label="Outstanding Payables" value="Not available yet" />
            </div>

            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">
                Recent Transactions
              </h2>
              <TransactionsTable transactions={data.recentTransactions} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
