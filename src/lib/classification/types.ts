import type {
  FinancialType,
  SpendingCategoryGroup,
  TransactionCategory,
  TransactionType,
} from '../../types/index.ts';

export type ClassificationMethod = 'deterministic' | 'rule_engine' | 'ai' | 'manual';

export interface ClassificationResult {
  category: TransactionCategory;
  categoryGroup: SpendingCategoryGroup;
  transactionType: TransactionType;
  financialType?: FinancialType;
  merchant?: string;
  confidence: number; // 0.00 to 1.00
  method: ClassificationMethod;
  isInternalTransfer: boolean;
  isRefund: boolean;
  isRecurring: boolean;
  isIncome: boolean;
  isExpense: boolean;
  isSavings: boolean;
  isInternal?: boolean;
  isExternal?: boolean;
  notes?: string;
  classificationReason?: string;
}

export interface DeterministicMerchantRule {
  patterns: (string | RegExp)[];
  merchant: string;
  category: TransactionCategory;
  categoryGroup: SpendingCategoryGroup;
  transactionType: TransactionType;
  financialType?: FinancialType;
  isRecurring?: boolean;
  isExpense?: boolean;
  isIncome?: boolean;
  isSavings?: boolean;
  isRefund?: boolean;
  isInternalTransfer?: boolean;
  isInternal?: boolean;
  isExternal?: boolean;
  confidence?: number;
}
