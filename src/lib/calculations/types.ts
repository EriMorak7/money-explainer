import type { Currency, Transaction } from '../../types/index.ts';

export interface DeduplicationResult {
  deduplicatedTransactions: Transaction[];
  duplicates: {
    original: Transaction;
    duplicate: Transaction;
    reason: string;
  }[];
  duplicateCount: number;
  duplicateDebitSum: number;
  duplicateCreditSum: number;
}

export interface BalanceReconciliation {
  isReconciled: boolean;
  openingBalance: number;
  closingBalance: number;
  expectedClosingBalance: number;
  discrepancy: number; // expectedClosingBalance - closingBalance
  totalCredits: number;
  totalDebits: number;
  reconciliationNotes: string;
}

export interface IncomeBreakdown {
  totalIncome: number;
  externalIncome?: number;
  interestIncome?: number;
  salary: number;
  clientPayments: number;
  businessIncome: number;
  investmentReturns: number;
  otherIncome: number;
  excludedInflows: {
    internalTransfersIn: number;
    savingsWithdrawals: number;
    loansReceived: number;
    refundsAndReversals: number;
    internalWealthTransfers?: number;
  };
}

export interface ExpenseBreakdown {
  grossLivingExpenses: number;
  refundsOffset: number;
  netLivingExpenses: number;
  bankCharges: number;
  essentialExpenses: number;
  lifestyleExpenses: number;
  givingAndFamily: number;
  discretionaryExpenses: number;
  excludedOutflows: {
    internalTransfersOut: number;
    savingsDeposits: number;
    investmentDeposits: number;
    loanRepayments: number;
    internalWealthTransfers?: number;
  };
}

export interface WealthAndSavingsBreakdown {
  savingsDeposits: number;
  savingsWithdrawals: number;
  netSavings: number;
  internalWealthTransfers?: number;
  investmentDeposits: number;
  investmentYield: number;
  totalCapitalPreserved: number;
  owealthNetBalanceChange?: number;
}

export interface DebtAndLoanBreakdown {
  loansReceived: number;
  loanRepayments: number;
  netDebtChange: number;
}

export interface FinancialCalculationReport {
  currency: Currency;
  periodStart?: string;
  periodEnd?: string;
  transactionCount: number;
  
  // Reconciled Statement Audit
  reconciliation: BalanceReconciliation;
  deduplication: DeduplicationResult;

  // Strict Accounting Ledgers
  income: IncomeBreakdown;
  expenses: ExpenseBreakdown;
  wealth: WealthAndSavingsBreakdown;
  debt: DebtAndLoanBreakdown;
  transfers: {
    internalTransfersOut: number;
    internalTransfersIn: number;
    netInternalMovement: number;
  };
  refunds: {
    totalRefunds: number;
    totalReversals: number;
  };

  // Executive Core Ratios
  netCashFlow: number; // Total Earned Income - Net Living Expenses - Bank Charges - Loan Repayments
  savingsRate: number; // (Net Savings / Total Earned Income) * 100
  grossSavingsRate: number; // (Total Capital Preserved / Total Earned Income) * 100
  livingExpenseRatio: number; // (Net Living Expenses / Total Earned Income) * 100
  debtServiceRatio: number; // (Loan Repayments / Total Earned Income) * 100
  bankFeeBurden: number; // (Bank Charges / Total Earned Income) * 100
}
