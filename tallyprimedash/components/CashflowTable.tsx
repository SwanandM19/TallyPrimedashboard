"use client";

import { useCashflowReview, markedClass, type TallyCell } from "@/lib/cashflow-review";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { LedgerPicker } from "./LedgerPicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Row {
  id: string;
  srNo: string;
  particulars: string;
  col1: number | null;
  col2: number | null;
  col3: number | null;
  type: "section" | "item" | "total" | "grandTotal" | "balance" | "header";
  sectionKey?: string;
  isEditable?: boolean;
  transfersText?: [string, string, string];
  /** Where the "Actual Taken" figure came from: Tally (filled automatically) or typed by hand. */
  col3Src?: "tally" | "manual";
}

interface TableConfig {
  title: string;
  subtitle: string;
  columns: string[];
  initialRows: Row[];
  receiptSections?: string[];
  paymentSections?: string[];
  extraSection?: string;
  receiptsTotalId?: string;
  paymentsTotalId?: string;
  balanceId?: string;
  netBalanceId?: string;
}

// OPPL Data
export const opplConfig: TableConfig = {
  title: "OPPL - Receipts & Payments",
  subtitle: "APR TO JUN-2026 (Rs. in Lakhs)",
  columns: ["Sr.No.", "Particulars", "AMT.RS. ( In Lakhs ) Transfers Taken", "Amt. Rs. (In Lakhs)", "Actual Taken"],
  receiptSections: ["A", "B"],
  paymentSections: ["C", "D", "E"],
  extraSection: "F",
  receiptsTotalId: "tab",
  paymentsTotalId: "tcde",
  balanceId: "bal",
  netBalanceId: "netbal",
  initialRows: [
    { id: "a0", srNo: "A", particulars: "Balances B/fd.", col1: null, col2: null, col3: null, type: "section", sectionKey: "A" },
    { id: "a1", srNo: "1", particulars: "ICD from", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a2", srNo: "2", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a4", srNo: "4", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "at", srNo: "", particulars: "Total - A", col1: null, col2: null, col3: null, type: "total", sectionKey: "A" },
    { id: "b0", srNo: "B", particulars: "Rent Receivables", col1: null, col2: null, col3: null, type: "section", sectionKey: "B" },
    { id: "b1", srNo: "1", particulars: "Atlas Copco (OPPL-Alpine)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b2", srNo: "2", particulars: "BITS Pilani (OPPL-Alpine)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b3", srNo: "3", particulars: "HDFC Bank (OPPL-Alpine)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b4", srNo: "4", particulars: "We Shine Tech (OPPL-Alpine)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b5", srNo: "5", particulars: "BDO (OPPL-Sterling)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b6", srNo: "6", particulars: "RIIM (OPPL-Alpine) 4th Floor", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b7", srNo: "7", particulars: "RIIM (OPPL-Alpine) - Sh.No.4 (Part)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b8", srNo: "8", particulars: "Arihant (RIIMs-Alpine) Sh.No.4 (Part)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "bt", srNo: "", particulars: "Total - B", col1: null, col2: null, col3: null, type: "total", sectionKey: "B" },
    { id: "tab", srNo: "", particulars: "Total Receipts (A+B)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "c0", srNo: "C", particulars: "Loan Interest & Installments", col1: null, col2: null, col3: null, type: "section", sectionKey: "C" },
    { id: "c1", srNo: "1", particulars: "L & T - OPPL", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true, transfersText: ["", "", ""] },
    { id: "c2", srNo: "2", particulars: "ABFL - OPPL (RIIMS 4th Floor & Others)", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true, transfersText: ["", "", ""] },
    { id: "c3", srNo: "3", particulars: "ABHFL - OPPL (HDFC & WESHINE)", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true, transfersText: ["", "", ""] },
    { id: "c4", srNo: "4", particulars: "ICICI Bank - LRD (OPPL)", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true, transfersText: ["", "", ""] },
    { id: "ct", srNo: "", particulars: "Total - C", col1: null, col2: null, col3: null, type: "total", sectionKey: "C" },
    { id: "d0", srNo: "D", particulars: "Monthly Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "D" },
    { id: "d1", srNo: "1", particulars: "Monthly Exps. - OPPL (Except Installments)", col1: null, col2: null, col3: null, type: "item", sectionKey: "D", isEditable: true },
    { id: "dt", srNo: "", particulars: "Total - D", col1: null, col2: null, col3: null, type: "total", sectionKey: "D" },
    { id: "e0", srNo: "E", particulars: "Other Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "E" },
    { id: "e1", srNo: "1", particulars: "Other Exps. and Professional & Consultants", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e2", srNo: "2", particulars: "Traveling & Card Expenses & Membership", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e3", srNo: "3", particulars: "Mantri Sterling 4th Floor Renovation Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e4", srNo: "4", particulars: "Fees to Directors", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e5", srNo: "5", particulars: "Repairs, Advertisement & Other Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e6", srNo: "6", particulars: "Insurance Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "et", srNo: "", particulars: "Total - E", col1: null, col2: null, col3: null, type: "total", sectionKey: "E" },
    { id: "tcde", srNo: "", particulars: "Total Payments (C+D+E)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "bal", srNo: "", particulars: "Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
    { id: "f0", srNo: "F", particulars: "EXTRA EXPENSES", col1: null, col2: null, col3: null, type: "section", sectionKey: "F" },
    { id: "f1", srNo: "1", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "f2", srNo: "2", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "f3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "ft", srNo: "", particulars: "Total - F", col1: null, col2: null, col3: null, type: "total", sectionKey: "F" },
    { id: "netbal", srNo: "", particulars: "Net Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
  ],
};

// PPPL (Pentagon)
export const ppplConfig: TableConfig = {
  title: "PPPL - Receipts & Payments",
  subtitle: "JUL TO SEP-2026 (Rs. in Lakhs)",
  columns: ["Sr.No.", "Particulars", "AMT.RS. ( In Lakhs ) Transfers Taken", "Amt. Rs. (In Lakhs)", "Actual Taken"],
  receiptSections: ["A", "B"],
  paymentSections: ["C", "D", "E"],
  extraSection: "F",
  receiptsTotalId: "tab",
  paymentsTotalId: "tcde",
  balanceId: "bal",
  netBalanceId: "netbal",
  initialRows: [
    { id: "a0", srNo: "A", particulars: "Balances B/fd.", col1: null, col2: null, col3: null, type: "section", sectionKey: "A" },
    { id: "a1", srNo: "1", particulars: "RA(17.88) + Prerna(12.52) = 30.40*5", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a2", srNo: "2", particulars: "Prerana Project", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a4", srNo: "4", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a5", srNo: "5", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "at", srNo: "", particulars: "Total - A", col1: null, col2: null, col3: null, type: "total", sectionKey: "A" },
    { id: "b0", srNo: "B", particulars: "Rent Receivables", col1: null, col2: null, col3: null, type: "section", sectionKey: "B" },
    { id: "b1", srNo: "1", particulars: "BDO (PPPL-Sterling)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "bt", srNo: "", particulars: "Total - B", col1: null, col2: null, col3: null, type: "total", sectionKey: "B" },
    { id: "tab", srNo: "", particulars: "Total Receipts (A+B)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "c0", srNo: "C", particulars: "Loan Interest & Installments", col1: null, col2: null, col3: null, type: "section", sectionKey: "C" },
    { id: "c1", srNo: "1", particulars: "ABFL - PPPL (BDO Sterling 2nd Floor) Diff. Rs. 13.85 X 2", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true, transfersText: ["", "", ""] },
    { id: "ct", srNo: "", particulars: "Total - C", col1: null, col2: null, col3: null, type: "total", sectionKey: "C" },
    { id: "d0", srNo: "D", particulars: "Monthly Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "D" },
    { id: "d1", srNo: "1", particulars: "Monthly Exps. PPPL (Except Install.) 24.25*3", col1: null, col2: null, col3: null, type: "item", sectionKey: "D", isEditable: true },
    { id: "dt", srNo: "", particulars: "Total - D", col1: null, col2: null, col3: null, type: "total", sectionKey: "D" },
    { id: "e0", srNo: "E", particulars: "Other Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "E" },
    { id: "e1", srNo: "1", particulars: "Other Exps. and Professional & Consultants (CS Bodas, CA, Architects & Advocates)", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e2", srNo: "2", particulars: "Traveling & Card Expenses & Membership", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e3", srNo: "3", particulars: "Fees to Directors (For Dec.25 Qtr.)", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e4", srNo: "4", particulars: "Repairs, Yoga Session & Others Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e5", srNo: "5", particulars: "Vehicle & Property Insurance", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e6", srNo: "6", particulars: "Mantri Sterling Renovation Exps. 1st & 2nd Floor Jan.26 to Mar.26", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e7", srNo: "7", particulars: "Suhas Mantri - HUF", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e8", srNo: "8", particulars: "Incidental Exps", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e9", srNo: "9", particulars: "Web Designing / Web Hosting", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "et", srNo: "", particulars: "Total - E", col1: null, col2: null, col3: null, type: "total", sectionKey: "E" },
    { id: "tcde", srNo: "", particulars: "Total Payments (C+D+E)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "bal", srNo: "", particulars: "Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
    { id: "f0", srNo: "F", particulars: "EXTRA EXPENSES", col1: null, col2: null, col3: null, type: "section", sectionKey: "F" },
    { id: "f1", srNo: "1", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "f2", srNo: "2", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "f3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "ft", srNo: "", particulars: "Total - F", col1: null, col2: null, col3: null, type: "total", sectionKey: "F" },
    { id: "netbal", srNo: "", particulars: "Net Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
  ],
};

// MCPL
export const mcplConfig: TableConfig = {
  title: "MCPL - Receipts & Payments",
  subtitle: "JUL TO SEP-2026 (Rs. in Lakhs)",
  columns: ["Sr.No.", "Particulars", "AMT.RS. ( In Lakhs ) Transfers Taken", "Amt. Rs. (In Lakhs)", "Actual Taken"],
  receiptSections: ["A", "B"],
  paymentSections: ["C", "D", "E"],
  extraSection: "F",
  receiptsTotalId: "tab",
  paymentsTotalId: "tcde",
  balanceId: "bal",
  netBalanceId: "netbal",
  initialRows: [
    { id: "a0", srNo: "A", particulars: "Balances B/fd.", col1: null, col2: null, col3: null, type: "section", sectionKey: "A" },
    { id: "a1", srNo: "1", particulars: "FD with ICICI Bank for OD A/c", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a2", srNo: "2", particulars: "ICICI Bank - OD (Total OD Limit 7.28 CR)", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "at", srNo: "", particulars: "Total - A", col1: null, col2: null, col3: null, type: "total", sectionKey: "A" },
    { id: "b0", srNo: "B", particulars: "Rent Receivables", col1: null, col2: null, col3: null, type: "section", sectionKey: "B" },
    { id: "b1", srNo: "1", particulars: "Medsynaptic (MCPL-Galleria 4th Floor)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b2", srNo: "2", particulars: "Cellcure (MCPL-Galleria Gr.Floor)", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b3", srNo: "3", particulars: "Pasay Invento", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b4", srNo: "4", particulars: "Genepath", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "b5", srNo: "5", particulars: "Smifs Ltd.", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true, transfersText: ["", "", ""] },
    { id: "bt", srNo: "", particulars: "Total - B", col1: null, col2: null, col3: null, type: "total", sectionKey: "B" },
    { id: "tab", srNo: "", particulars: "Total Receipts (A+B)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "c0", srNo: "C", particulars: "Loan Interest & Installments", col1: null, col2: null, col3: null, type: "section", sectionKey: "C" },
    { id: "c1", srNo: "1", particulars: "ICICI Bank - OD (MCPL)", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true, transfersText: ["", "", ""] },
    { id: "ct", srNo: "", particulars: "Total - C", col1: null, col2: null, col3: null, type: "total", sectionKey: "C" },
    { id: "d0", srNo: "D", particulars: "Monthly Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "D" },
    { id: "d1", srNo: "1", particulars: "Monthly Exps. MCPL (Except Installments) Rs.4.60*3", col1: null, col2: null, col3: null, type: "item", sectionKey: "D", isEditable: true },
    { id: "dt", srNo: "", particulars: "Total - D", col1: null, col2: null, col3: null, type: "total", sectionKey: "D" },
    { id: "e0", srNo: "E", particulars: "Other Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "E" },
    { id: "e1", srNo: "1", particulars: "Other Exps. and Professional & Consultants (CS Bodas, CA, Architects & Advocates)", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e2", srNo: "2", particulars: "Traveling & Card Expenses & Membership", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e3", srNo: "3", particulars: "Fees to Directors (For Mar.26 Qtr.)", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e4", srNo: "4", particulars: "Repairs & Other Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e5", srNo: "5", particulars: "Insurance Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e6", srNo: "6", particulars: "ICD to OPPL", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "e7", srNo: "7", particulars: "Incidental Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "E", isEditable: true },
    { id: "et", srNo: "", particulars: "Total - E", col1: null, col2: null, col3: null, type: "total", sectionKey: "E" },
    { id: "tcde", srNo: "", particulars: "Total Payments (C+D+E)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "bal", srNo: "", particulars: "Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
    { id: "f0", srNo: "F", particulars: "EXTRA EXPENSES", col1: null, col2: null, col3: null, type: "section", sectionKey: "F" },
    { id: "f1", srNo: "1", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "f2", srNo: "2", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "f3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "F", isEditable: true },
    { id: "ft", srNo: "", particulars: "Total - F", col1: null, col2: null, col3: null, type: "total", sectionKey: "F" },
    { id: "netbal", srNo: "", particulars: "Net Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
  ],
};

// APEX (simpler: A receipts; B, C payments; D extra)
export const apexConfig: TableConfig = {
  title: "APEX - Receipts & Payments",
  subtitle: "JUL TO SEP-2026 (Rs. in Lakhs)",
  columns: ["Sr.No.", "Particulars", "AMT.RS. ( In Lakhs ) Transfers Taken", "Amt. Rs. (In Lakhs)", "Actual Taken"],
  receiptSections: ["A"],
  paymentSections: ["B", "C"],
  extraSection: "D",
  receiptsTotalId: "trec",
  paymentsTotalId: "tpay",
  balanceId: "bal",
  netBalanceId: "netbal",
  initialRows: [
    { id: "a0", srNo: "A", particulars: "Balances B/fd.", col1: null, col2: null, col3: null, type: "section", sectionKey: "A" },
    { id: "a1", srNo: "1", particulars: "Rent from OPPL", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a2", srNo: "2", particulars: "ICD from PPPL", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "a3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "A", isEditable: true },
    { id: "at", srNo: "", particulars: "Total - A", col1: null, col2: null, col3: null, type: "total", sectionKey: "A" },
    { id: "trec", srNo: "", particulars: "Total Receipts (A)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "b0", srNo: "B", particulars: "Monthly Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "B" },
    { id: "b1", srNo: "1", particulars: "Monthly Exps. Rs.70 * 3", col1: null, col2: null, col3: null, type: "item", sectionKey: "B", isEditable: true },
    { id: "bt", srNo: "", particulars: "Total - B", col1: null, col2: null, col3: null, type: "total", sectionKey: "B" },
    { id: "c0", srNo: "C", particulars: "Other Expenses", col1: null, col2: null, col3: null, type: "section", sectionKey: "C" },
    { id: "c1", srNo: "1", particulars: "Other Exps. and Professional & Consultants (CS Bodas, CA, Architects & Advocates)", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true },
    { id: "c2", srNo: "2", particulars: "Fees to Directors (For Dec.25 Qtr.)", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true },
    { id: "c3", srNo: "3", particulars: "Insurance", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true },
    { id: "c4", srNo: "4", particulars: "Mantri Sterling 3 Floor Renovation Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true },
    { id: "c5", srNo: "5", particulars: "Misc., Other & Incidental Exps.", col1: null, col2: null, col3: null, type: "item", sectionKey: "C", isEditable: true },
    { id: "ct", srNo: "", particulars: "Total - C", col1: null, col2: null, col3: null, type: "total", sectionKey: "C" },
    { id: "tpay", srNo: "", particulars: "Total Payments (B+C)", col1: null, col2: null, col3: null, type: "grandTotal" },
    { id: "bal", srNo: "", particulars: "Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
    { id: "d0", srNo: "D", particulars: "EXTRA EXPENSES", col1: null, col2: null, col3: null, type: "section", sectionKey: "D" },
    { id: "d1", srNo: "1", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "D", isEditable: true },
    { id: "d2", srNo: "2", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "D", isEditable: true },
    { id: "d3", srNo: "3", particulars: "", col1: null, col2: null, col3: null, type: "item", sectionKey: "D", isEditable: true },
    { id: "dt", srNo: "", particulars: "Total - D", col1: null, col2: null, col3: null, type: "total", sectionKey: "D" },
    { id: "netbal", srNo: "", particulars: "Net Balance Available + / (-)", col1: null, col2: null, col3: null, type: "balance" },
  ],
};

type NumCol = "col1" | "col2" | "col3";

function sumSection(rows: Row[], sectionKey: string, col: NumCol): number {
  return rows
    .filter((r) => r.sectionKey === sectionKey && r.type === "item")
    .reduce((sum, r) => sum + (r[col] || 0), 0);
}

function computeTotals(rows: Row[], config: TableConfig): Row[] {
  const receipts = config.receiptSections ?? ["A", "B"];
  const payments = config.paymentSections ?? ["C", "D", "E"];
  const extra = config.extraSection ?? "F";
  const sumCols = (keys: string[], col: NumCol) =>
    keys.reduce((s, k) => s + sumSection(rows, k, col), 0);
  return rows.map((row) => {
    if (row.type === "total" && row.sectionKey) {
      return {
        ...row,
        col1: sumSection(rows, row.sectionKey, "col1"),
        col2: sumSection(rows, row.sectionKey, "col2"),
        col3: sumSection(rows, row.sectionKey, "col3"),
      };
    }
    if (config.receiptsTotalId && row.id === config.receiptsTotalId) {
      return { ...row, col1: sumCols(receipts, "col1"), col2: sumCols(receipts, "col2"), col3: sumCols(receipts, "col3") };
    }
    if (config.paymentsTotalId && row.id === config.paymentsTotalId) {
      return { ...row, col1: sumCols(payments, "col1"), col2: sumCols(payments, "col2"), col3: sumCols(payments, "col3") };
    }
    if (config.balanceId && row.id === config.balanceId) {
      return {
        ...row,
        col1: sumCols(receipts, "col1") - sumCols(payments, "col1"),
        col2: sumCols(receipts, "col2") - sumCols(payments, "col2"),
        col3: sumCols(receipts, "col3") - sumCols(payments, "col3"),
      };
    }
    if (config.netBalanceId && row.id === config.netBalanceId) {
      const paymentsPlusExtra = [...payments, extra];
      return {
        ...row,
        col1: sumCols(receipts, "col1") - sumCols(paymentsPlusExtra, "col1"),
        col2: sumCols(receipts, "col2") - sumCols(paymentsPlusExtra, "col2"),
        col3: sumCols(receipts, "col3") - sumCols(paymentsPlusExtra, "col3"),
      };
    }
    return row;
  });
}

export function formatNumber(val: number | null): string {
  if (val === null || val === 0) return "-";
  return val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function EditableCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (val: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value?.toString() ?? "");

  if (editing) {
    return (
      <input
        type="text"
        className="w-full bg-transparent text-right text-sm px-2 py-1 border-b border-primary/30 outline-none focus:border-primary"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const num = parseFloat(text);
          onChange(isNaN(num) ? null : num);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            const num = parseFloat(text);
            onChange(isNaN(num) ? null : num);
          }
        }}
      />
    );
  }

  return (
    <div
      className="cursor-pointer text-right text-sm px-2 py-1 hover:bg-accent rounded transition-colors"
      onClick={() => {
        setText(value?.toString() ?? "");
        setEditing(true);
      }}
    >
      {formatNumber(value)}
    </div>
  );
}

export function CashflowTable({ config }: { config: TableConfig; tabType?: "oppl" }) {
  const { initialRows, onRowsChange, markedCells, tally, ledgerOptions, onPickLedgers, periodLabel } = useCashflowReview();
  const [rows, setRows] = useState<Row[]>((initialRows as Row[] | undefined) ?? config.initialRows);
  useEffect(() => { onRowsChange?.(rows); }, [rows, onRowsChange]);
  const computed = computeTotals(rows, config);

  // Rows in the receipt sections take receipts from Tally, every other row takes payments.
  const receiptKeys = config.receiptSections ?? ["A", "B"];
  const flowOf = (sectionKey?: string): "receipt" | "payment" =>
    sectionKey && receiptKeys.includes(sectionKey) ? "receipt" : "payment";
  // row id -> the name written on the sheet (the dropdown shows it when a ledger already counts in another row)
  const rowNames = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r.particulars])), [rows]);

  // Fill "Actual Taken" from Tally. A figure that somebody typed by hand is never overwritten.
  useEffect(() => {
    if (!tally) return;
    setRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.type !== "item" || !r.isEditable) return r;
        const typedByHand = r.col3Src === "manual" || (r.col3Src === undefined && r.col3 !== null);
        if (typedByHand) return r;
        const t = tally[r.id];
        if (t) {
          if (r.col3 === t.amount && r.col3Src === "tally") return r;
          changed = true;
          return { ...r, col3: t.amount, col3Src: "tally" as const };
        }
        if (r.col3Src === "tally") { changed = true; return { ...r, col3: null, col3Src: undefined }; }
        return r;
      });
      return changed ? next : prev;
    });
  }, [tally]);

  const updateCell = useCallback((id: string, col: NumCol, val: number | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? (col === "col3" ? { ...r, col3: val, col3Src: "manual" as const } : { ...r, [col]: val }) : r)));
  }, []);

  const applyTallyValue = useCallback((id: string, t: TallyCell) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, col3: t.amount, col3Src: "tally" as const } : r)));
  }, []);

  const updateParticulars = useCallback((id: string, val: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, particulars: val } : r)));
  }, []);

  const updateTransferText = useCallback((id: string, idx: 0 | 1 | 2, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id || !r.transfersText) return r;
        const next = [...r.transfersText] as [string, string, string];
        next[idx] = val;
        return { ...r, transfersText: next };
      }),
    );
  }, []);

  const addRow = useCallback((afterId: string, sectionKey: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === afterId);
      const newRow: Row = {
        id: `new_${Date.now()}`,
        srNo: "",
        particulars: "",
        col1: null,
        col2: null,
        col3: null,
        type: "item",
        sectionKey,
        isEditable: true,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  }, []);

  const deleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = useCallback((row: Row) => {
    const hasContent = row.particulars.trim() !== "" || row.col1 !== null || row.col2 !== null || row.col3 !== null;
    if (hasContent) setDeleteConfirmId(row.id);
    else deleteRow(row.id);
  }, [deleteRow]);

  const renumbered = useMemo(() => {
    const counters: Record<string, number> = {};
    return computed.map((row) => {
      if (row.type === "item" && row.sectionKey) {
        if (!counters[row.sectionKey]) counters[row.sectionKey] = 0;
        counters[row.sectionKey]++;
        return { ...row, srNo: String(counters[row.sectionKey]) };
      }
      return row;
    });
  }, [computed]);

  const getBalanceColor = (val: number | null) => {
    if (val === null || val === 0) return "";
    return val > 0 ? "text-positive font-bold" : "text-negative font-bold";
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-bold text-foreground">{config.title}</h3>
        <p className="text-sm text-muted-foreground">{config.subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              {config.columns.map((col, i) => {
                const isTransfersCol = i === 2;
                const widthClass =
                  i === 0
                    ? "w-16 text-center"
                    : i === 1
                      ? "text-left w-[22%]"
                      : isTransfersCol
                        ? "text-center w-[40%]"
                        : "text-right";
                return (
                  <th key={i} className={`px-4 py-3 font-semibold border border-primary-foreground/30 ${widthClass}`}>
                    {col}
                  </th>
                );
              })}
              <th className="w-20 px-2 py-3 text-center font-semibold border border-primary-foreground/30">Actions</th>
            </tr>
          </thead>
          <tbody>
            {renumbered.map((row) => {
              const isSection = row.type === "section";
              const isTotal = row.type === "total";
              const isGrandTotal = row.type === "grandTotal";
              const isBalance = row.type === "balance";
              const isSummary = isTotal || isGrandTotal || isBalance;
              return (
                <tr key={row.id} className={`border-b border-border transition-colors ${
                  isSection ? "bg-section-header-bg font-semibold"
                    : isGrandTotal || isBalance ? "bg-total-row-bg font-bold"
                    : isTotal ? "bg-total-row-bg font-semibold"
                    : "hover:bg-accent/50"
                }`}>
                  <td className="px-4 py-2 text-center text-muted-foreground border border-border">{row.srNo}</td>
                  <td className={`px-4 py-2 border border-border ${isSummary ? "font-semibold" : ""}${markedClass(markedCells, row.id, "particulars")}`}>
                    {row.isEditable ? (
                      <>
                        <input type="text" className="bg-transparent w-full outline-none focus:border-b focus:border-primary/30"
                          value={row.particulars} onChange={(e) => updateParticulars(row.id, e.target.value)}
                          placeholder="Enter item name..." />
                        {row.type === "item" && ledgerOptions && onPickLedgers && (
                          <LedgerPicker
                            rowId={row.id}
                            rowName={row.particulars}
                            flow={flowOf(row.sectionKey)}
                            options={ledgerOptions}
                            rowNames={rowNames}
                            periodLabel={periodLabel}
                            onSave={(ledgers) => onPickLedgers(row.id, flowOf(row.sectionKey), ledgers)}
                          />
                        )}
                      </>
                    ) : row.particulars}
                  </td>
                  {(["col1", "col2", "col3"] as const).map((col) => {
                    if (col === "col1" && row.transfersText) {
                      return (
                        <td key={col} className={`p-0 border border-border${markedClass(markedCells, row.id, "transfersText")}`}>
                          <div className="grid grid-cols-3">
                            {[0, 1, 2].map((i) => (
                              <input key={i} type="text"
                                className={`bg-transparent w-full text-sm px-2 py-2 outline-none focus:bg-accent/30 ${i < 2 ? "border-r border-border" : ""}`}
                                value={row.transfersText![i]}
                                onChange={(e) => updateTransferText(row.id, i as 0 | 1 | 2, e.target.value)} />
                            ))}
                          </div>
                        </td>
                      );
                    }
                    const tallyCell = col === "col3" && row.isEditable ? tally?.[row.id] : undefined;
                    return (
                      <td key={col} className={`px-4 py-2 border border-border ${isBalance ? getBalanceColor(row[col]) : ""}${markedClass(markedCells, row.id, col)}`}>
                        {row.isEditable ? (
                          <div className="flex items-center justify-end gap-1">
                            {tallyCell && row.col3Src === "tally" && (
                              <span
                                className="no-print shrink-0 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary"
                                title={tallyCell.confirmed
                                  ? `Filled from Tally (${tallyCell.ledgers} ledger${tallyCell.ledgers === 1 ? "" : "s"})`
                                  : `Filled from Tally (${tallyCell.ledgers} ledger${tallyCell.ledgers === 1 ? "" : "s"}) - the matching rule for this row is a guess, please check it once`}
                              >{tallyCell.confirmed ? "T" : "T?"}</span>
                            )}
                            {tallyCell && row.col3Src === "manual" && (
                              <button
                                type="button"
                                className="no-print shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-primary"
                                title={`Typed by hand. Click to use the Tally figure instead: ${formatNumber(tallyCell.amount)}`}
                                onClick={() => applyTallyValue(row.id, tallyCell)}
                              >Tally {formatNumber(tallyCell.amount)}</button>
                            )}
                            <div className="min-w-0 flex-1">
                              <EditableCell value={row[col]} onChange={(v) => updateCell(row.id, col, v)} />
                            </div>
                          </div>
                        ) : (
                          <div className="text-right">{formatNumber(row[col])}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center border border-border">
                    {row.isEditable && (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => addRow(row.id, row.sectionKey!)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors" title="Add row below">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteClick(row)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-negative transition-colors" title="Delete row">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
            <DialogDescription>Are you sure you want to delete this row?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <button onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors">No</button>
            <button onClick={() => { if (deleteConfirmId) deleteRow(deleteConfirmId); setDeleteConfirmId(null); }}
              className="px-4 py-2 text-sm rounded-md bg-negative text-white hover:bg-negative/80 transition-colors">Yes</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
