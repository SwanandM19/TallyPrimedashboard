/**
 * Sends a mock transaction batch to /api/tally/sync.
 *
 * Usage:
 *   TALLY_SYNC_API_KEY=your-key npx tsx scripts/test-sync.ts
 *   TALLY_SYNC_API_KEY=your-key SYNC_URL=https://your-app.vercel.app/api/tally/sync npx tsx scripts/test-sync.ts
 */

const url = process.env.SYNC_URL ?? "http://localhost:3000/api/tally/sync";
const apiKey = process.env.TALLY_SYNC_API_KEY;

if (!apiKey) {
  console.error("Set TALLY_SYNC_API_KEY before running this script.");
  process.exit(1);
}

const payload = {
  transactions: [
    {
      external_id: "TEST-001",
      transaction_type: "sale",
      amount: 50000,
      invoice_no: "TEST-INV-001",
      party_name: "Test Customer",
      transaction_date: new Date().toISOString().slice(0, 10),
      description: "Test sale",
    },
  ],
};

async function main() {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
}

main();
