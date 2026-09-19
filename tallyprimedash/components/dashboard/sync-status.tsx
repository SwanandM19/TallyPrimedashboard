import type { TallySyncLogRow } from "@/lib/tally/database.types";
import { formatDateTime } from "@/lib/format";

export function SyncStatus({ lastSync }: { lastSync: TallySyncLogRow | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:gap-6">
      <div>
        <span className="text-slate-500">Last Sync: </span>
        <span className="font-medium text-slate-900">
          {lastSync ? formatDateTime(lastSync.received_at) : "Never"}
        </span>
      </div>
      <div>
        <span className="text-slate-500">Records synced: </span>
        <span className="font-medium text-slate-900">
          {lastSync ? lastSync.records_inserted : "—"}
        </span>
      </div>
      {lastSync && lastSync.status !== "success" && (
        <span className="inline-flex w-fit rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
          {lastSync.status === "error" ? "Last sync failed" : "Last sync partial"}
        </span>
      )}
    </div>
  );
}
