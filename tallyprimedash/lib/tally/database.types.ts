export type TransactionType = "sale" | "purchase" | "receipt" | "payment";

export type TallyTransactionRow = {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  invoice_no: string | null;
  party_name: string | null;
  transaction_date: string;
  description: string | null;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TallySyncLogRow = {
  id: string;
  received_at: string;
  status: "success" | "partial" | "error";
  records_received: number;
  records_inserted: number;
  error_message: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      tally_transactions: {
        Row: TallyTransactionRow;
        Insert: Partial<TallyTransactionRow> &
          Pick<
            TallyTransactionRow,
            "transaction_type" | "amount" | "transaction_date"
          >;
        Update: Partial<TallyTransactionRow>;
        Relationships: [];
      };
      tally_sync_logs: {
        Row: TallySyncLogRow;
        Insert: Partial<TallySyncLogRow> &
          Pick<TallySyncLogRow, "status" | "records_received" | "records_inserted">;
        Update: Partial<TallySyncLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
