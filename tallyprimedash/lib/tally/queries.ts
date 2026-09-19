import { createServiceClient } from "@/lib/supabase/service";
import { getTodayIST } from "@/lib/format";
import type { TallyTransactionRow, TallySyncLogRow, TransactionType } from "@/lib/tally/database.types";

export interface DashboardData {
  todaysSales: number;
  todaysPurchases: number;
  todaysReceipts: number;
  todaysPayments: number;
  recentTransactions: TallyTransactionRow[];
  lastSync: TallySyncLogRow | null;
}

async function sumToday(
  supabase: ReturnType<typeof createServiceClient>,
  type: TransactionType,
  today: string
): Promise<number> {
  const { data, error } = await supabase
    .from("tally_transactions")
    .select("amount")
    .eq("transaction_type", type)
    .eq("transaction_date", today);

  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + Number(row.amount), 0);
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createServiceClient();
  const today = getTodayIST();

  const [todaysSales, todaysPurchases, todaysReceipts, todaysPayments, recentResult, syncResult] =
    await Promise.all([
      sumToday(supabase, "sale", today),
      sumToday(supabase, "purchase", today),
      sumToday(supabase, "receipt", today),
      sumToday(supabase, "payment", today),
      supabase
        .from("tally_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("tally_sync_logs")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    todaysSales,
    todaysPurchases,
    todaysReceipts,
    todaysPayments,
    recentTransactions: recentResult.data ?? [],
    lastSync: syncResult.data ?? null,
  };
}
