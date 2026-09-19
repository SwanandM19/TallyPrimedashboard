import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTransaction } from "@/lib/validation/tally";

const MAX_BATCH_SIZE = 500;

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

function isAuthorized(request: Request): boolean {
  const expectedKey = process.env.TALLY_SYNC_API_KEY;
  if (!expectedKey) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token === expectedKey;
}

async function logSync(
  status: "success" | "partial" | "error",
  recordsReceived: number,
  recordsInserted: number,
  errorMessage: string | null
) {
  try {
    const supabase = createServiceClient();
    await supabase.from("tally_sync_logs").insert({
      status,
      records_received: recordsReceived,
      records_inserted: recordsInserted,
      error_message: errorMessage,
    });
  } catch {
    // Logging failures should never break the API response.
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Malformed JSON body" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || !("transactions" in body)) {
    return NextResponse.json(
      { success: false, error: "Request must include a 'transactions' array" },
      { status: 400 }
    );
  }

  const transactionsInput = (body as { transactions: unknown }).transactions;

  if (!Array.isArray(transactionsInput) || transactionsInput.length === 0) {
    return NextResponse.json(
      { success: false, error: "'transactions' must be a non-empty array" },
      { status: 400 }
    );
  }

  if (transactionsInput.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { success: false, error: `Batch too large (max ${MAX_BATCH_SIZE} transactions)` },
      { status: 400 }
    );
  }

  const validTransactions = [];
  for (let i = 0; i < transactionsInput.length; i++) {
    const result = validateTransaction(transactionsInput[i], i);
    if (!result.valid) {
      await logSync("error", transactionsInput.length, 0, result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    validTransactions.push(result.transaction);
  }

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("tally_transactions")
      .upsert(validTransactions, {
        onConflict: "external_id",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      await logSync("error", validTransactions.length, 0, error.message);
      return NextResponse.json(
        { success: false, error: "Failed to store transactions" },
        { status: 500 }
      );
    }

    const recordsInserted = data?.length ?? 0;

    await logSync("success", validTransactions.length, recordsInserted, null);

    return NextResponse.json({
      success: true,
      recordsReceived: validTransactions.length,
      recordsInserted,
      message: "Transactions synchronized successfully",
    });
  } catch {
    await logSync("error", validTransactions.length, 0, "Unexpected server error");
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
