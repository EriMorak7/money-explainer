import type { Currency, TransactionCategory, TransactionType } from '../../types/index.ts';

export type PatternMatchType = 'contains' | 'exact' | 'regex';

export interface CustomClassificationRule {
  id: string;
  pattern: string;
  matchType: PatternMatchType;
  category: TransactionCategory;
  merchant?: string;
  transactionType?: TransactionType;
  enabled: boolean;
  createdAt: string;
  notes?: string;
}

export interface WorkspacePreferences {
  defaultCurrency: Currency;
  maskSensitiveData: boolean;
  largeTransactionThreshold: number;
  themePreference: 'light' | 'dark' | 'system';
  autoDetectRecurring: boolean;
  autoDetectSavingsSweeps: boolean;
  customCategoryBudgets: Record<string, number>;
  customRules: CustomClassificationRule[];
}

export interface WorkspaceBackupPayload {
  version: string;
  exportedAt: string;
  preferences: WorkspacePreferences;
  rulesCount: number;
}
