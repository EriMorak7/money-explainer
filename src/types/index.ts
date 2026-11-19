// MoneyLens Core Type Definitions
// Phase 1 Foundation: Normalized Financial Models

export type Currency = 'NGN' | 'USD' | 'EUR' | 'GBP';

export type AccountType =
  | 'WALLET'
  | 'SAVINGS'
  | 'SAFEBOX'
  | 'BANK'
  | 'CURRENT'
  | 'DOMICILIARY'
  | 'CREDIT'
  | 'INVESTMENT'
  | 'UNKNOWN';

export type StatementStatus = 'UPLOADED' | 'PARSING' | 'EXTRACTED' | 'NORMALIZED' | 'CLASSIFIED' | 'COMPLETED' | 'FAILED';

export type TransactionDirection = 'DEBIT' | 'CREDIT';

export type ClassificationMethod = 'deterministic' | 'rule_engine' | 'ai' | 'manual' | 'demo';

export type FinancialType =
  | 'EXTERNAL_INCOME'
  | 'EXPENSE'
  | 'INTERNAL_TRANSFER'
  | 'SAVINGS_CONTRIBUTION'
  | 'SAVINGS_WITHDRAWAL'
  | 'INTERNAL_WEALTH_TRANSFER'
  | 'INTEREST_INCOME'
  | 'REFUND'
  | 'FEE'
  | 'GIVING'
  | 'UNKNOWN';

export type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'INTERNAL_TRANSFER'
  | 'SAVINGS_DEPOSIT'
  | 'SAVINGS_WITHDRAWAL'
  | 'INVESTMENT_CONTRIBUTION'
  | 'INVESTMENT_WITHDRAWAL'
  | 'INTEREST'
  | 'REFUND'
  | 'BANK_CHARGE'
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_REPAYMENT'
  | 'GIVING'
  | 'SAVINGS_TRANSFER'
  | 'INVESTMENT'
  | 'UNCATEGORIZED';

export type SpendingCategoryGroup =
  | 'Income'
  | 'Essential Spending'
  | 'Lifestyle'
  | 'Financial'
  | 'Giving'
  | 'Discretionary'
  | 'Other';

export type TransactionCategory =
  // Income
  | 'Income'
  | 'Salary'
  | 'Freelance'
  | 'Business Income'
  | 'Client Payment'
  | 'Transfers Received'
  | 'Investment Return'
  | 'Other Income'
  // Essential
  | 'Food'
  | 'Groceries'
  | 'Transportation'
  | 'Fuel'
  | 'Rent'
  | 'Utilities'
  | 'Airtime'
  | 'Data'
  | 'Healthcare'
  | 'Education'
  // Lifestyle
  | 'Restaurants'
  | 'Food Delivery'
  | 'Entertainment'
  | 'Shopping'
  | 'Gaming'
  | 'Streaming'
  | 'Subscriptions'
  // Financial
  | 'Savings'
  | 'Investment'
  | 'Loan Repayment'
  | 'Bank Charges'
  | 'Transfers'
  | 'Cash Withdrawal'
  // Giving
  | 'Giving'
  | 'Family Support'
  | 'Church & Tithe'
  | 'Charity'
  | 'Gifts'
  // Discretionary / Risk
  | 'Betting & Gambling'
  | 'Impulse Spending'
  // Other
  | 'Refund'
  | 'Other'
  | 'Uncategorized';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  accountName: string;
  accountNumberMasked: string;
  accountType: AccountType;
  currency: Currency;
  openingBalance: number;
  closingBalance: number;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  createdAt: string;
}

export interface StatementMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'csv' | 'xlsx' | 'xls';
  bankName: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  status: StatementStatus;
  detectedAccount: string;
  currency: Currency;
  uploadDate: string;
}

export interface Transaction {
  id: string;
  statementId: string;
  accountId: string;
  date: string; // ISO date YYYY-MM-DD
  time?: string;
  description: string;
  originalDescription: string;
  merchant?: string;
  reference?: string;
  debit: number; // positive number or 0
  credit: number; // positive number or 0
  amount: number; // absolute transaction amount
  direction: TransactionDirection;
  balance: number; // running balance after this transaction
  currency: Currency;
  
  // Categorization
  category: TransactionCategory;
  categoryGroup: SpendingCategoryGroup;
  subcategory?: string;
  transactionType: TransactionType;
  confidenceScore: number; // 0.00 to 1.00
  classificationMethod: ClassificationMethod;
  userOverriddenCategory?: boolean;

  // Strict Financial Flags (Section 6 & 11)
  isInternalTransfer: boolean;
  isRefund: boolean;
  isRecurring: boolean;
  isIncome: boolean;
  isExpense: boolean;
  isSavings: boolean;

  // Accounting Engine v2: Account Awareness & Pairing Graph
  accountType?: AccountType;
  financialType?: FinancialType;
  isInternal?: boolean;
  isExternal?: boolean;
  pairedTransactionId?: string;
  fundingTransactionId?: string;
  classificationReason?: string;

  parentTransactionId?: string;
  notes?: string;
  source: string;
}

export interface CategorySummary {
  category: TransactionCategory;
  group: SpendingCategoryGroup;
  totalAmount: number;
  transactionCount: number;
  percentageOfSpending: number;
  color: string;
}

export interface MerchantSummary {
  merchant: string;
  category: TransactionCategory;
  totalSpent: number;
  transactionCount: number;
  lastDate: string;
}

export interface FinancialHealthBreakdown {
  saving: number; // 0 - 100
  spendingControl: number; // 0 - 100
  cashFlowStability: number; // 0 - 100
  emergencyLiquidity: number; // 0 - 100
  subscriptionManagement: number; // 0 - 100
  debtManagement: number; // 0 - 100
  discretionarySpending: number; // 0 - 100
  consistency: number; // 0 - 100
}

export interface FinancialHealthScore {
  overallScore: number; // 0 - 100
  rating: 'Poor' | 'Fair' | 'Moderate' | 'Good' | 'Excellent';
  summary: string;
  breakdown: FinancialHealthBreakdown;
  disclaimer: string;
}

export interface FinancialMetrics {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  totalSaved: number;
  savingsRate: number; // percentage (0 - 100)
  totalTransfers: number;
  totalRefunds: number;
  averageDailySpending: number;
  largestExpenseCategory: string;
  largestSingleExpense: {
    description: string;
    amount: number;
    date: string;
    category: string;
  };
  openingBalance: number;
  closingBalance: number;
  netWorthChange: number;
  totalTransactions: number;
  healthScore: FinancialHealthScore;
}

export interface DailySpendingPoint {
  date: string;
  day: string;
  spending: number;
  income: number;
}
