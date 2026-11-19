import type {
  AccountType,
  ClassificationMethod,
  Currency,
  FinancialType,
  SpendingCategoryGroup,
  TransactionCategory,
  TransactionType,
} from '../../types/index.ts';
import type { FinancialCalculationReport } from '../calculations/types.ts';

export interface ExtractedAccountSummary {
  accountName: string;
  accountNumber: string;
  bankName: string;
  accountType: string;
  address?: string;
  periodStart: string; // ISO date YYYY-MM-DD
  periodEnd: string; // ISO date YYYY-MM-DD
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  debitCount: number;
  creditCount: number;
}

export interface RawExtractedTransaction {
  dateRaw: string;
  timeRaw?: string;
  valueDateRaw?: string;
  descriptionRaw: string;
  debitRaw: string | number;
  creditRaw: string | number;
  balanceRaw: string | number;
  channelRaw?: string;
  referenceRaw?: string;
  accountType?: string;
  pageNumber?: number;
}

export interface NormalizedTransactionData {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  valueDate?: string; // YYYY-MM-DD
  description: string;
  originalDescription: string;
  debit: number;
  credit: number;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  balance: number;
  currency: Currency;
  reference?: string;
  channel?: string;
  accountType: AccountType | string;
  source: string;

  // Transaction Classification
  category?: TransactionCategory;
  categoryGroup?: SpendingCategoryGroup;
  merchant?: string;
  confidenceScore?: number;
  classificationMethod?: ClassificationMethod;
  transactionType?: TransactionType;
  financialType?: FinancialType;
  isInternal?: boolean;
  isExternal?: boolean;
  pairedTransactionId?: string;
  fundingTransactionId?: string;
  classificationReason?: string;
  isInternalTransfer?: boolean;
  isRefund?: boolean;
  isRecurring?: boolean;
  isIncome?: boolean;
  isExpense?: boolean;
  isSavings?: boolean;
  notes?: string;
}

export interface ParseResult {
  bankName: string;
  accountName: string;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  currency: Currency;
  accounts: ExtractedAccountSummary[];
  transactions: NormalizedTransactionData[];
  auditReport?: FinancialCalculationReport;
  metadata: {
    pageCount: number;
    rawTransactionCount: number;
    normalizedTransactionCount: number;
    totalDebit: number;
    totalCredit: number;
    extractionConfidence: number;
  };
}
