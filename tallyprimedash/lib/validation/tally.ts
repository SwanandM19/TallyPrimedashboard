import type { TransactionType } from "@/lib/tally/database.types";

const VALID_TYPES: TransactionType[] = ["sale", "purchase", "receipt", "payment"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RawTransactionInput {
  external_id?: unknown;
  transaction_type?: unknown;
  amount?: unknown;
  invoice_no?: unknown;
  party_name?: unknown;
  transaction_date?: unknown;
  description?: unknown;
}

export interface ValidTransaction {
  external_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  invoice_no: string | null;
  party_name: string | null;
  transaction_date: string;
  description: string | null;
  source: "tally";
}

export type ValidationResult =
  | { valid: true; transaction: ValidTransaction }
  | { valid: false; error: string };

function asNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateTransaction(
  input: unknown,
  index: number
): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: `Transaction at index ${index} must be an object` };
  }

  const raw = input as RawTransactionInput;

  if (
    typeof raw.transaction_type !== "string" ||
    !VALID_TYPES.includes(raw.transaction_type as TransactionType)
  ) {
    return {
      valid: false,
      error: `Transaction at index ${index} has invalid transaction_type (must be one of ${VALID_TYPES.join(", ")})`,
    };
  }

  if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount) || raw.amount <= 0) {
    return {
      valid: false,
      error: `Transaction at index ${index} has invalid amount (must be a positive number)`,
    };
  }

  if (typeof raw.transaction_date !== "string" || !DATE_RE.test(raw.transaction_date)) {
    return {
      valid: false,
      error: `Transaction at index ${index} has invalid transaction_date (expected YYYY-MM-DD)`,
    };
  }

  const parsedDate = new Date(`${raw.transaction_date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return {
      valid: false,
      error: `Transaction at index ${index} has an invalid transaction_date`,
    };
  }

  return {
    valid: true,
    transaction: {
      external_id: asNullableString(raw.external_id),
      transaction_type: raw.transaction_type as TransactionType,
      amount: raw.amount,
      invoice_no: asNullableString(raw.invoice_no),
      party_name: asNullableString(raw.party_name),
      transaction_date: raw.transaction_date,
      description: asNullableString(raw.description),
      source: "tally",
    },
  };
}
