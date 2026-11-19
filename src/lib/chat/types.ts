import type { TransactionCategory } from '../../types/index.ts';

export type ChatIntent =
  | 'CATEGORY_SPEND'
  | 'MERCHANT_SPEND'
  | 'INCOME_TOTAL'
  | 'SAVINGS_TOTAL'
  | 'EXPENSE_TOTAL'
  | 'NET_CASH_FLOW'
  | 'LARGEST_TRANSACTIONS'
  | 'BANK_CHARGES'
  | 'REFUNDS'
  | 'DAILY_BURN_RATE'
  | 'HIGHEST_SPENDING_DAYS'
  | 'TRANSACTION_SEARCH'
  | 'GENERAL_FINANCIAL_SUMMARY'
  | 'NO_MATCH';

export interface CitedTransaction {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  category: TransactionCategory | string;
}

export interface ChatQueryResult {
  intent: ChatIntent;
  query: string;
  entities: {
    category?: TransactionCategory | string;
    merchant?: string;
    keyword?: string;
    direction?: 'DEBIT' | 'CREDIT';
  };
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  citedTransactions: CitedTransaction[];
  traceFilter?: {
    category?: string;
    type?: string;
    merchant?: string;
    search?: string;
  };
  isGroundingVerified: boolean;
  groundingExplanation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  queryResult?: ChatQueryResult;
}
