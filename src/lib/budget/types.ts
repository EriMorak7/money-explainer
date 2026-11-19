import type { Currency, SpendingCategoryGroup, TransactionCategory } from '../../types/index.ts';

export type BudgetStatus = 'ON_TRACK' | 'WARNING' | 'OVER_BUDGET';

export interface BudgetCategoryTarget {
  category: TransactionCategory;
  group: SpendingCategoryGroup;
  actualSpend: number;
  transactionCount: number;
  recommendedTarget: number;
  currentTarget: number;
  variance: number; // actualSpend - currentTarget (positive = over budget)
  utilizationPercent: number; // (actualSpend / currentTarget) * 100
  status: BudgetStatus;
  recommendationReason: string;
  isUserEdited: boolean;
}

export interface BudgetSummary {
  totalIncome: number;
  totalActualSpend: number;
  totalBudgetTarget: number;
  unallocatedIncome: number; // totalIncome - totalBudgetTarget
  budgetSurplusOrDeficit: number; // totalBudgetTarget vs totalActualSpend
  budgetHealthScore: number; // 0-100 score
  periodDays: number;
  categoryDistribution: {
    essential: { amount: number; percentOfBudget: number };
    lifestyle: { amount: number; percentOfBudget: number };
    giving: { amount: number; percentOfBudget: number };
    financial: { amount: number; percentOfBudget: number };
    other: { amount: number; percentOfBudget: number };
  };
}

export interface BudgetReport {
  currency: Currency;
  periodDays: number;
  summary: BudgetSummary;
  categories: BudgetCategoryTarget[];
  overrides: Record<string, number>;
}
