import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    // A plain (non-HEAD) query is used deliberately: Supabase returns error
    // bodies only on GET responses, so a HEAD request (head: true) cannot
    // reveal problems like a missing table — it silently reports success.
    const { error } = await supabase.from("tally_transactions").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { status: "error", database: "disconnected" },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json(
      { status: "error", database: "disconnected" },
      { status: 503 }
    );
  }
}
