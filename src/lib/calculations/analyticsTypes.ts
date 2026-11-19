import type {
  Currency,
  SpendingCategoryGroup,
  TransactionCategory,
} from '../../types/index.ts';

export interface CategoryAnalyticsItem {
  category: TransactionCategory;
  categoryGroup: SpendingCategoryGroup;
  totalSpent: number;
  percentageOfTotal: number;
  transactionCount: number;
  averageTransaction: number;
  maxTransaction: number;
  color: string;
}

export interface CategoryGroupAnalyticsItem {
  group: SpendingCategoryGroup;
  totalSpent: number;
  percentageOfTotal: number;
  transactionCount: number;
  categoryCount: number;
  color: string;
}

export interface MerchantAnalyticsItem {
  merchant: string;
  category: TransactionCategory;
  categoryGroup: SpendingCategoryGroup;
  totalSpent: number;
  percentageOfTotal: number;
  transactionCount: number;
  averageTransaction: number;
  maxTransaction: number;
  firstDate: string;
  lastDate: string;
}

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "12 Oct"
  spending: number; // living expenses
  income: number; // external income
  savingsDeposits: number;
  savingsWithdrawals: number;
  netSavings: number;
  netCashFlow: number;
  transactionCount: number;
}

export interface WeeklyTrendPoint {
  weekKey: string; // e.g. "2026-W41"
  weekNumber: number;
  label: string; // e.g. "06 Oct - 12 Oct"
  startDate: string;
  endDate: string;
  spending: number;
  income: number;
  savingsDeposits: number;
  savingsWithdrawals: number;
  netSavings: number;
  netCashFlow: number;
  transactionCount: number;
}

export interface MonthlyTrendPoint {
  monthKey: string; // e.g. "2026-10"
  label: string; // e.g. "Oct 2026"
  year: number;
  month: number;
  spending: number;
  income: number;
  savingsDeposits: number;
  savingsWithdrawals: number;
  netSavings: number;
  netCashFlow: number;
  transactionCount: number;
}

export interface SavingsTrendPoint {
  date: string;
  label: string;
  deposits: number;
  withdrawals: number;
  netSavings: number;
  cumulativeRetained: number;
}

export interface SavingsTrendAnalytics {
  points: SavingsTrendPoint[];
  totalDeposited: number;
  totalWithdrawn: number;
  netRetainedSavings: number;
  retentionRate: number; // (netRetained / totalDeposited) * 100
  highestSingleDeposit: {
    amount: number;
    date: string;
    description: string;
  };
}

export interface DayOfWeekFrequencyItem {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  dayName: string; // Monday, Tuesday, ...
  shortDay: string; // Mon, Tue, ...
  transactionCount: number;
  spending: number;
  income: number;
  averagePerTransaction: number;
  percentageOfTransactions: number;
}

export interface TimeOfDayFrequencyItem {
  periodKey: 'morning' | 'afternoon' | 'evening' | 'night';
  label: string; // "Morning (6 AM - 12 PM)", etc.
  transactionCount: number;
  spending: number;
  percentageOfTransactions: number;
}

export interface TransactionFrequencyAnalytics {
  totalTransactions: number;
  totalDaysInPeriod: number;
  activeSpendingDays: number;
  averageTransactionsPerDay: number;
  averageDailyBurnRate: number;
  debitCount: number;
  creditCount: number;
  debitPercentage: number;
  creditPercentage: number;
  dayOfWeekDistribution: DayOfWeekFrequencyItem[];
  timeOfDayDistribution: TimeOfDayFrequencyItem[];
  mostActiveDayOfWeek: string;
  highestSpendingDayOfWeek: string;
}

export interface TopDebitTransactionItem {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  category: TransactionCategory;
  categoryGroup: SpendingCategoryGroup;
  isLivingExpense: boolean;
  isSavingsSweep: boolean;
  isInternalTransfer: boolean;
  isBankCharge: boolean;
}

export interface TopCreditTransactionItem {
  id: string;
  date: string;
  description: string;
  sender: string;
  amount: number;
  category: TransactionCategory;
  isExternalIncome: boolean;
  isSavingsWithdrawal: boolean;
  isInternalTransfer: boolean;
  isRefund: boolean;
}

export interface LargestTransactionsAnalytics {
  topDebits: TopDebitTransactionItem[];
  topCredits: TopCreditTransactionItem[];
}

export interface HighestSpendingDayItem {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  totalSpending: number;
  transactionCount: number;
  topCategory: string;
  topCategoryAmount: number;
  topMerchant: string;
  topMerchantAmount: number;
  largestTransaction: number;
}

export interface AnalyticsReport {
  currency: Currency;
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  grossLivingExpenses: number;
  netLivingExpenses: number;
  totalIncome: number;
  netCashFlow: number;
  
  // Categorical Breakdown
  categoryAnalytics: CategoryAnalyticsItem[];
  categoryGroupAnalytics: CategoryGroupAnalyticsItem[];
  
  // Merchant Breakdown
  merchantAnalytics: MerchantAnalyticsItem[];
  
  // Trends across timeframes
  dailyTrends: DailyTrendPoint[];
  weeklyTrends: WeeklyTrendPoint[];
  monthlyTrends: MonthlyTrendPoint[];
  
  // Savings Dynamics
  savingsTrends: SavingsTrendAnalytics;
  
  // Behavioral Frequency
  frequencyAnalytics: TransactionFrequencyAnalytics;
  
  // Extremes & Records
  largestTransactions: LargestTransactionsAnalytics;
  highestSpendingDays: HighestSpendingDayItem[];
}
