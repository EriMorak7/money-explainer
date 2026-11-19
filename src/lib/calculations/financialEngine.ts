import type {
  CategorySummary,
  Currency,
  DailySpendingPoint,
  FinancialHealthScore,
  MerchantSummary,
  SpendingCategoryGroup,
  Transaction,
  TransactionCategory,
} from '../../types/index.ts';
import type {
  BalanceReconciliation,
  DebtAndLoanBreakdown,
  DeduplicationResult,
  ExpenseBreakdown,
  FinancialCalculationReport,
  IncomeBreakdown,
  WealthAndSavingsBreakdown,
} from './types.ts';
import { pairAndReconcileTransactions } from '../accounting/pairingEngine.ts';

/**
 * Rounds a number to exactly two decimal places to avoid IEEE 754 floating point drift.
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Deduplicates raw transactions to ensure credits and debits are never double-counted.
 * Detects duplicates by reference or matching date + direction + amount + description.
 */
export function deduplicateTransactions(transactions: Transaction[]): DeduplicationResult {
  const seenKeys = new Map<string, Transaction>();
  const duplicates: { original: Transaction; duplicate: Transaction; reason: string }[] = [];
  const deduplicated: Transaction[] = [];

  let duplicateDebitSum = 0;
  let duplicateCreditSum = 0;

  for (const tx of transactions) {
    // Determine unique signature key
    let key = '';
    let reason = '';

    if (tx.reference && tx.reference !== 'N/A' && tx.reference.length > 5) {
      key = `ref_${tx.reference}_${tx.direction}_${round2(tx.amount)}`;
      reason = `Duplicate bank reference: ${tx.reference}`;
    } else {
      key = `desc_${tx.date}_${tx.direction}_${round2(tx.amount)}_${tx.description.toLowerCase().trim()}_${round2(tx.balance)}`;
      reason = 'Identical date, amount, direction, balance and description match';
    }

    if (seenKeys.has(key)) {
      const original = seenKeys.get(key)!;
      duplicates.push({ original, duplicate: tx, reason });
      duplicateDebitSum += tx.debit;
      duplicateCreditSum += tx.credit;
    } else {
      seenKeys.set(key, tx);
      deduplicated.push(tx);
    }
  }

  return {
    deduplicatedTransactions: deduplicated,
    duplicates,
    duplicateCount: duplicates.length,
    duplicateDebitSum: round2(duplicateDebitSum),
    duplicateCreditSum: round2(duplicateCreditSum),
  };
}

/**
 * Performs strict balance reconciliation:
 * Opening Balance + Total Credits - Total Debits == Closing Balance
 */
export function reconcileBalances(
  transactions: Transaction[],
  declaredOpeningBalance?: number,
  declaredClosingBalance?: number
): BalanceReconciliation {
  const totalDebits = round2(transactions.reduce((sum, tx) => sum + tx.debit, 0));
  const totalCredits = round2(transactions.reduce((sum, tx) => sum + tx.credit, 0));

  let openingBalance = declaredOpeningBalance ?? 0;
  let closingBalance = declaredClosingBalance ?? 0;

  // Infer from transactions if not explicitly passed
  if (transactions.length > 0) {
    if (declaredOpeningBalance === undefined) {
      const first = transactions[0];
      openingBalance = round2(first.balance + first.debit - first.credit);
    }
    if (declaredClosingBalance === undefined) {
      const last = transactions[transactions.length - 1];
      closingBalance = round2(last.balance);
    }
  }

  const expectedClosingBalance = round2(openingBalance + totalCredits - totalDebits);
  const discrepancy = round2(expectedClosingBalance - closingBalance);
  const isReconciled = Math.abs(discrepancy) <= 0.05;

  const reconciliationNotes = isReconciled
    ? `Reconciled mathematically: ₦${openingBalance.toLocaleString()} (Opening) + ₦${totalCredits.toLocaleString()} (Credits) - ₦${totalDebits.toLocaleString()} (Debits) = ₦${closingBalance.toLocaleString()} (Closing)`
    : `Unreconciled discrepancy of ₦${Math.abs(discrepancy).toLocaleString()} detected between ledger math (₦${expectedClosingBalance.toLocaleString()}) and bank closing balance (₦${closingBalance.toLocaleString()})`;

  return {
    isReconciled,
    openingBalance,
    closingBalance,
    expectedClosingBalance,
    discrepancy,
    totalCredits,
    totalDebits,
    reconciliationNotes,
  };
}

/**
 * Calculates audited financial breakdown with strict isolation rules:
 * 1. Internal transfers != Income & != Expense
 * 2. Savings deposits != Expense
 * 3. Savings withdrawals != Income
 * 4. Refunds & Reversals != Income (offset gross expenses)
 * 5. Loans received != Income
 * 6. Loan repayments != Ordinary lifestyle expenses
 * 7. Investments != Ordinary expenses
 * 8. Bank charges separated
 * 9. Deduplication enforced
 */
export function auditFinancialCalculations(
  rawTransactions: Transaction[],
  openingBalance?: number,
  closingBalance?: number,
  currency: Currency = 'NGN'
): FinancialCalculationReport {
  // Step 1: Deduplicate and pair transactions into account graph
  const dedupResult = deduplicateTransactions(rawTransactions);
  const txs = pairAndReconcileTransactions(dedupResult.deduplicatedTransactions);

  // Step 2: Reconcile opening and closing balances
  const reconciliation = reconcileBalances(txs, openingBalance, closingBalance);

  // Step 3: Income Ledger Auditing
  let salary = 0;
  let clientPayments = 0;
  let businessIncome = 0;
  let investmentReturns = 0;
  let otherIncome = 0;
  let externalInflows = 0;

  let internalTransfersIn = 0;
  let savingsWithdrawals = 0;
  let loansReceived = 0;
  let refundsAndReversals = 0;
  let internalWealthTransfers = 0;

  // Step 4: Expense Ledger Auditing
  let essentialExpenses = 0;
  let lifestyleExpenses = 0;
  let givingAndFamily = 0;
  let discretionaryExpenses = 0;
  let bankCharges = 0;
  let otherLivingExpenses = 0;

  let internalTransfersOut = 0;
  let savingsDeposits = 0;
  let investmentDeposits = 0;
  let loanRepayments = 0;
  let refundsOffset = 0;
  let totalReversals = 0;

  // Track sweep IDs to guarantee every economic event contributes exactly once
  const processedSweepIds = new Set<string>();

  for (const tx of txs) {
    const isCredit = tx.direction === 'CREDIT' || (tx.credit > 0 && tx.debit === 0);
    const amount = round2(tx.amount || (isCredit ? tx.credit : tx.debit));

    // Internal Wealth Transfers (e.g. SafeBox -> OWealth internal reallocation)
    if (tx.financialType === 'INTERNAL_WEALTH_TRANSFER') {
      if (!processedSweepIds.has(tx.id)) {
        internalWealthTransfers = round2(internalWealthTransfers + amount);
        processedSweepIds.add(tx.id);
        if (tx.pairedTransactionId) processedSweepIds.add(tx.pairedTransactionId);
      }
      continue;
    }

    if (isCredit) {
      // --- CREDIT AUDITING ---
      // 1. Refunds and Reversals are NOT income
      if (tx.isRefund || tx.category === 'Refund' || tx.transactionType === 'REFUND' || tx.financialType === 'REFUND') {
        refundsAndReversals = round2(refundsAndReversals + amount);
        refundsOffset = round2(refundsOffset + amount);
        if (tx.description.toLowerCase().includes('reversal')) {
          totalReversals = round2(totalReversals + amount);
        }
        continue;
      }

      // 2. Savings Withdrawals into wallet are NOT income
      if (
        tx.financialType === 'SAVINGS_WITHDRAWAL' ||
        (tx.financialType !== 'INTERNAL_TRANSFER' && (
          tx.transactionType === 'SAVINGS_WITHDRAWAL' ||
          (tx.category === 'Savings' && isCredit && !tx.isIncome) ||
          (tx.description.toLowerCase().includes('owealth withdrawal') && !tx.description.toLowerCase().includes('(transaction payment)')) ||
          (tx.description.toLowerCase().includes('safebox withdrawal') && isCredit)
        ))
      ) {
        if (!processedSweepIds.has(tx.id)) {
          savingsWithdrawals = round2(savingsWithdrawals + amount);
          processedSweepIds.add(tx.id);
          if (tx.pairedTransactionId) processedSweepIds.add(tx.pairedTransactionId);
        }
        continue;
      }

      // 3. Investment Withdrawals are NOT income
      if (
        tx.transactionType === 'INVESTMENT_WITHDRAWAL' ||
        tx.description.toLowerCase().includes('investment withdrawal')
      ) {
        continue;
      }

      // 4. Internal Transfers In & Auto-Funding Sweeps into Wallet are NOT income
      if (
        tx.financialType === 'INTERNAL_TRANSFER' ||
        tx.isInternalTransfer ||
        tx.transactionType === 'INTERNAL_TRANSFER' ||
        tx.description.toLowerCase().includes('owealth withdrawal(transaction payment)') ||
        tx.description.toLowerCase().includes('owealth withdrawal (transaction payment)')
      ) {
        internalTransfersIn = round2(internalTransfersIn + amount);
        continue;
      }

      // 5. Loans Received are NOT income
      if (
        tx.transactionType === 'LOAN_DISBURSEMENT' ||
        tx.description.toLowerCase().includes('loan disbursement') ||
        tx.description.toLowerCase().includes('loan approved')
      ) {
        loansReceived = round2(loansReceived + amount);
        continue;
      }

      // 6. Savings Contributions credit side (in OWealth) - count once
      if (
        tx.financialType === 'SAVINGS_CONTRIBUTION' ||
        tx.transactionType === 'SAVINGS_DEPOSIT' ||
        tx.transactionType === 'SAVINGS_TRANSFER' ||
        tx.description.toLowerCase().includes('auto-save to owealth')
      ) {
        if (!processedSweepIds.has(tx.id)) {
          savingsDeposits = round2(savingsDeposits + amount);
          processedSweepIds.add(tx.id);
          if (tx.pairedTransactionId) processedSweepIds.add(tx.pairedTransactionId);
        }
        continue;
      }

      // 7. External Income & Interest Categorization
      if (
        tx.financialType === 'EXTERNAL_INCOME' ||
        tx.financialType === 'INTEREST_INCOME' ||
        tx.isIncome ||
        tx.transactionType === 'INCOME' ||
        tx.transactionType === 'INTEREST'
      ) {
        if (
          tx.financialType === 'INTEREST_INCOME' ||
          tx.category === 'Investment Return' ||
          tx.transactionType === 'INTEREST' ||
          tx.description.toLowerCase().includes('interest earned')
        ) {
          investmentReturns = round2(investmentReturns + amount);
        } else if (tx.category === 'Salary') {
          salary = round2(salary + amount);
        } else if (tx.category === 'Client Payment') {
          clientPayments = round2(clientPayments + amount);
        } else if (tx.category === 'Business Income') {
          businessIncome = round2(businessIncome + amount);
        } else if (tx.financialType === 'EXTERNAL_INCOME') {
          externalInflows = round2(externalInflows + amount);
        } else {
          otherIncome = round2(otherIncome + amount);
        }
      }
    } else {
      // --- DEBIT AUDITING ---
      // 1. Savings Withdrawals in debits (e.g. OWealth Withdrawal in Savings Account) are NOT living expenses
      if (
        tx.financialType === 'SAVINGS_WITHDRAWAL' ||
        tx.transactionType === 'SAVINGS_WITHDRAWAL' ||
        tx.description.toLowerCase().includes('owealth withdrawal') ||
        tx.description.toLowerCase() === '(transaction payment)'
      ) {
        if (!processedSweepIds.has(tx.id)) {
          savingsWithdrawals = round2(savingsWithdrawals + amount);
          processedSweepIds.add(tx.id);
          if (tx.pairedTransactionId) processedSweepIds.add(tx.pairedTransactionId);
        }
        continue;
      }

      // 2. Savings Contributions / Deposits in debits (e.g. Wallet auto-save) are NOT living expenses
      if (
        tx.financialType === 'SAVINGS_CONTRIBUTION' ||
        tx.transactionType === 'SAVINGS_DEPOSIT' ||
        tx.transactionType === 'SAVINGS_TRANSFER' ||
        tx.category === 'Savings' ||
        tx.description.toLowerCase().includes('auto-save to owealth') ||
        tx.description.toLowerCase().includes('safebox deposit')
      ) {
        if (!processedSweepIds.has(tx.id)) {
          savingsDeposits = round2(savingsDeposits + amount);
          processedSweepIds.add(tx.id);
          if (tx.pairedTransactionId) processedSweepIds.add(tx.pairedTransactionId);
        }
        continue;
      }

      // 3. Investment Deposits are NOT ordinary expenses
      if (
        tx.transactionType === 'INVESTMENT_CONTRIBUTION' ||
        tx.transactionType === 'INVESTMENT' ||
        tx.category === 'Investment'
      ) {
        investmentDeposits = round2(investmentDeposits + amount);
        continue;
      }

      // 4. Internal Transfers Out are NOT expenses
      if (
        tx.financialType === 'INTERNAL_TRANSFER' ||
        tx.isInternalTransfer ||
        tx.transactionType === 'INTERNAL_TRANSFER' ||
        tx.category === 'Transfers'
      ) {
        internalTransfersOut = round2(internalTransfersOut + amount);
        continue;
      }

      // 5. Loan Repayments are counted separately
      if (
        tx.transactionType === 'LOAN_REPAYMENT' ||
        tx.category === 'Loan Repayment' ||
        tx.description.toLowerCase().includes('loan repayment')
      ) {
        loanRepayments = round2(loanRepayments + amount);
        continue;
      }

      // 6. Bank Charges are counted separately
      if (tx.financialType === 'FEE' || tx.transactionType === 'BANK_CHARGE' || tx.category === 'Bank Charges') {
        bankCharges = round2(bankCharges + amount);
        continue;
      }

      // 7. Excluded Internal Sweeps & Movements Guard
      if (isExcludedFromLivingExpenses(tx)) {
        continue;
      }

      // 8. Genuine Living Expense Categories
      if (['Food', 'Groceries', 'Transportation', 'Fuel', 'Rent', 'Utilities', 'Airtime', 'Data', 'Healthcare', 'Education'].includes(tx.category)) {
        essentialExpenses = round2(essentialExpenses + amount);
      } else if (['Restaurants', 'Food Delivery', 'Entertainment', 'Shopping', 'Gaming', 'Streaming', 'Subscriptions'].includes(tx.category)) {
        lifestyleExpenses = round2(lifestyleExpenses + amount);
      } else if (['Family Support', 'Church & Tithe', 'Charity', 'Giving', 'Gifts'].includes(tx.category)) {
        givingAndFamily = round2(givingAndFamily + amount);
      } else if (['Betting & Gambling', 'Impulse Spending'].includes(tx.category)) {
        discretionaryExpenses = round2(discretionaryExpenses + amount);
      } else {
        otherLivingExpenses = round2(otherLivingExpenses + amount);
      }
    }
  }

  // Pure External Income
  const externalIncome = round2(externalInflows + salary + clientPayments + businessIncome + otherIncome);
  // Pure Interest Income
  const interestIncome = round2(investmentReturns);
  // Total Recognized Income
  const totalIncome = round2(externalIncome + interestIncome);

  // Gross Living Expenses (Lifestyle + Essential + Giving + Discretionary + Other)
  const grossLivingExpenses = round2(
    essentialExpenses + lifestyleExpenses + givingAndFamily + discretionaryExpenses + otherLivingExpenses
  );

  // Net Living Expenses (Gross Living Expenses reduced by refunds/reversals)
  const netLivingExpenses = round2(Math.max(0, grossLivingExpenses - refundsOffset));

  // Net Cash Flow = Total Recognized Income - Net Living Expenses - Bank Charges - Loan Repayments
  const netCashFlow = round2(totalIncome - netLivingExpenses - bankCharges - loanRepayments);

  // Total Capital Preserved = Savings Deposits + Investment Deposits
  const totalCapitalPreserved = round2(savingsDeposits + investmentDeposits);
  const netSavings = round2(savingsDeposits - savingsWithdrawals);

  // OWealth Net Balance Change: 
  // Net wealth movement into OWealth = contributions - withdrawals + internal wealth transfers + interest
  const owealthNetBalanceChange = round2(
    savingsDeposits - savingsWithdrawals + internalWealthTransfers + interestIncome
  );

  // Key Ratios
  // Primary Savings Contribution Rate: New savings contributions / external income (bounded 0 - 100%)
  const savingsRate = externalIncome > 0
    ? round2(Math.min(100, Math.max(0, (savingsDeposits / externalIncome) * 100)))
    : (totalIncome > 0 ? round2(Math.min(100, Math.max(0, (netSavings / totalIncome) * 100))) : 0);
  const grossSavingsRate = totalIncome > 0 ? round2((totalCapitalPreserved / totalIncome) * 100) : 0;
  const livingExpenseRatio = totalIncome > 0 ? round2((netLivingExpenses / totalIncome) * 100) : 0;
  const debtServiceRatio = totalIncome > 0 ? round2((loanRepayments / totalIncome) * 100) : 0;
  const bankFeeBurden = totalIncome > 0 ? round2((bankCharges / totalIncome) * 100) : 0;

  const incomeBreakdown: IncomeBreakdown = {
    totalIncome,
    externalIncome,
    interestIncome,
    salary,
    clientPayments,
    businessIncome,
    investmentReturns,
    otherIncome,
    excludedInflows: {
      internalTransfersIn,
      savingsWithdrawals,
      loansReceived,
      refundsAndReversals,
      internalWealthTransfers,
    },
  };

  const expenseBreakdown: ExpenseBreakdown = {
    grossLivingExpenses,
    refundsOffset,
    netLivingExpenses,
    bankCharges,
    essentialExpenses,
    lifestyleExpenses,
    givingAndFamily,
    discretionaryExpenses,
    excludedOutflows: {
      internalTransfersOut,
      savingsDeposits,
      investmentDeposits,
      loanRepayments,
      internalWealthTransfers,
    },
  };

  const wealthBreakdown: WealthAndSavingsBreakdown = {
    savingsDeposits,
    savingsWithdrawals,
    netSavings,
    internalWealthTransfers,
    investmentDeposits,
    investmentYield: investmentReturns,
    totalCapitalPreserved,
    owealthNetBalanceChange,
  };

  const debtBreakdown: DebtAndLoanBreakdown = {
    loansReceived,
    loanRepayments,
    netDebtChange: round2(loansReceived - loanRepayments),
  };

  return {
    currency,
    periodStart: txs[0]?.date,
    periodEnd: txs[txs.length - 1]?.date,
    transactionCount: txs.length,
    reconciliation,
    deduplication: dedupResult,
    income: incomeBreakdown,
    expenses: expenseBreakdown,
    wealth: wealthBreakdown,
    debt: debtBreakdown,
    transfers: {
      internalTransfersOut,
      internalTransfersIn,
      netInternalMovement: round2(internalTransfersIn - internalTransfersOut),
    },
    refunds: {
      totalRefunds: refundsAndReversals,
      totalReversals,
    },
    netCashFlow,
    savingsRate,
    grossSavingsRate,
    livingExpenseRatio,
    debtServiceRatio,
    bankFeeBurden,
  };
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Food Delivery': '#f97316',
  'Restaurants': '#f43f5e',
  'Groceries': '#10b981',
  'Transportation': '#3b82f6',
  'Fuel': '#eab308',
  'Airtime': '#06b6d4',
  'Data': '#6366f1',
  'Subscriptions': '#8b5cf6',
  'Streaming': '#ec4899',
  'Gaming': '#a855f7',
  'Shopping': '#14b8a6',
  'Entertainment': '#f59e0b',
  'Utilities': '#64748b',
  'Rent': '#475569',
  'Healthcare': '#ef4444',
  'Education': '#0284c7',
  'Family Support': '#84cc16',
  'Church & Tithe': '#d946ef',
  'Giving': '#d946ef',
  'Charity': '#22c55e',
  'Gifts': '#f472b6',
  'Betting & Gambling': '#dc2626',
  'Bank Charges': '#94a3b8',
  'Other': '#6b7280',
  'Uncategorized': '#9ca3af',
};

export function isExcludedFromLivingExpenses(tx: Transaction): boolean {
  const desc = (tx.description || '').toLowerCase();
  const merch = (tx.merchant || '').toLowerCase();

  if (
    tx.financialType === 'SAVINGS_WITHDRAWAL' ||
    tx.financialType === 'SAVINGS_CONTRIBUTION' ||
    tx.financialType === 'INTERNAL_WEALTH_TRANSFER' ||
    tx.financialType === 'INTERNAL_TRANSFER' ||
    tx.financialType === 'INTEREST_INCOME' ||
    tx.financialType === 'EXTERNAL_INCOME'
  ) {
    return true;
  }

  if (
    desc.includes('owealth withdrawal') ||
    merch.includes('owealth withdrawal') ||
    desc === '(transaction payment)' ||
    desc.includes('safebox') ||
    desc.includes('auto-save to owealth')
  ) {
    return true;
  }

  return (
    tx.isInternalTransfer ||
    tx.isSavings ||
    tx.isRefund ||
    tx.category === 'Transfers' ||
    tx.category === 'Savings' ||
    tx.category === 'Investment' ||
    tx.transactionType === 'INTERNAL_TRANSFER' ||
    tx.transactionType === 'SAVINGS_DEPOSIT' ||
    tx.transactionType === 'SAVINGS_WITHDRAWAL' ||
    tx.transactionType === 'SAVINGS_TRANSFER' ||
    tx.transactionType === 'INVESTMENT_CONTRIBUTION' ||
    tx.transactionType === 'INVESTMENT_WITHDRAWAL' ||
    tx.transactionType === 'INVESTMENT' ||
    tx.transactionType === 'LOAN_REPAYMENT' ||
    tx.transactionType === 'BANK_CHARGE'
  );
}

export function computeCategorySummaries(
  transactions: Transaction[],
  grossLivingExpenses: number
): CategorySummary[] {
  const map = new Map<TransactionCategory, { amount: number; count: number; group: SpendingCategoryGroup }>();

  for (const tx of transactions) {
    if (tx.isExpense && !isExcludedFromLivingExpenses(tx)) {
      const cat = tx.category;
      const group = tx.categoryGroup || 'Lifestyle';
      const amt = tx.debit || tx.amount;
      const existing = map.get(cat) || { amount: 0, count: 0, group };
      existing.amount = round2(existing.amount + amt);
      existing.count += 1;
      map.set(cat, existing);
    }
  }

  const result: CategorySummary[] = [];
  const total = grossLivingExpenses > 0 ? grossLivingExpenses : 1;

  for (const [cat, val] of map.entries()) {
    result.push({
      category: cat,
      group: val.group,
      totalAmount: val.amount,
      transactionCount: val.count,
      percentageOfSpending: round2((val.amount / total) * 100),
      color: CATEGORY_COLORS[cat] || '#64748b',
    });
  }

  return result.sort((a, b) => b.totalAmount - a.totalAmount);
}

export function computeMerchantSummaries(
  transactions: Transaction[],
  limit = 10
): MerchantSummary[] {
  const map = new Map<string, { totalSpent: number; count: number; category: TransactionCategory; lastDate: string }>();

  for (const tx of transactions) {
    if (tx.isExpense && !isExcludedFromLivingExpenses(tx)) {
      const merchant = tx.merchant || tx.description.split('|')[0].trim();
      const amt = tx.debit || tx.amount;
      const existing = map.get(merchant) || {
        totalSpent: 0,
        count: 0,
        category: tx.category,
        lastDate: tx.date,
      };
      existing.totalSpent = round2(existing.totalSpent + amt);
      existing.count += 1;
      if (new Date(tx.date) > new Date(existing.lastDate)) {
        existing.lastDate = tx.date;
      }
      map.set(merchant, existing);
    }
  }

  const result: MerchantSummary[] = [];
  for (const [merchant, val] of map.entries()) {
    result.push({
      merchant,
      category: val.category,
      totalSpent: val.totalSpent,
      transactionCount: val.count,
      lastDate: val.lastDate,
    });
  }

  return result.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, limit);
}

export function computeDailyTimeline(transactions: Transaction[]): DailySpendingPoint[] {
  const map = new Map<string, { spending: number; income: number }>();

  for (const tx of transactions) {
    const date = tx.date;
    const existing = map.get(date) || { spending: 0, income: 0 };

    if (tx.isIncome && !tx.isInternalTransfer && !tx.isRefund) {
      existing.income = round2(existing.income + (tx.credit || tx.amount));
    }
    if (tx.isExpense && !isExcludedFromLivingExpenses(tx)) {
      existing.spending = round2(existing.spending + (tx.debit || tx.amount));
    }

    map.set(date, existing);
  }

  const sortedDates = Array.from(map.keys()).sort();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return sortedDates.map((date) => {
    const val = map.get(date)!;
    const parts = date.split('-');
    let day = date;
    if (parts.length === 3) {
      const mIdx = parseInt(parts[1], 10) - 1;
      day = `${parts[2]} ${months[mIdx] || parts[1]}`;
    }
    return {
      date,
      day,
      spending: val.spending,
      income: val.income,
    };
  });
}

export function computeHealthScore(
  report: FinancialCalculationReport,
  transactions: Transaction[]
): FinancialHealthScore {
  const { totalIncome } = report.income;
  const { netLivingExpenses } = report.expenses;
  const { savingsRate, livingExpenseRatio, netCashFlow, debtServiceRatio } = report;

  let saving = 50;
  if (savingsRate >= 25) saving = 95;
  else if (savingsRate >= 15) saving = 85;
  else if (savingsRate >= 10) saving = 72;
  else if (savingsRate >= 5) saving = 60;
  else if (savingsRate > 0) saving = 50;
  else saving = 25;

  let spendingControl = 50;
  if (livingExpenseRatio <= 35) spendingControl = 95;
  else if (livingExpenseRatio <= 50) spendingControl = 85;
  else if (livingExpenseRatio <= 70) spendingControl = 70;
  else if (livingExpenseRatio <= 85) spendingControl = 55;
  else spendingControl = 30;

  let cashFlowStability = netCashFlow > 0 ? 85 : 40;
  if (netCashFlow > totalIncome * 0.3) cashFlowStability = 95;

  const monthlyBurn = netLivingExpenses > 0 ? netLivingExpenses : 100000;
  const totalLiquidWealth = Math.max(
    report.reconciliation.closingBalance,
    report.wealth.totalCapitalPreserved,
    report.wealth.owealthNetBalanceChange || 0,
    (report.wealth.netSavings || 0) + (report.reconciliation.closingBalance || 0)
  );
  const monthsCovered = totalLiquidWealth / monthlyBurn;
  let emergencyLiquidity = 50;
  if (monthsCovered >= 3) emergencyLiquidity = 95;
  else if (monthsCovered >= 1.5) emergencyLiquidity = 80;
  else if (monthsCovered >= 0.8) emergencyLiquidity = 65;
  else emergencyLiquidity = 45;

  const recurringCount = transactions.filter((t) => t.isRecurring).length;
  let subscriptionManagement = 80;
  if (recurringCount <= 3) subscriptionManagement = 90;
  else if (recurringCount <= 6) subscriptionManagement = 80;
  else subscriptionManagement = 65;

  let debtManagement = 100;
  if (debtServiceRatio > 30) debtManagement = 40;
  else if (debtServiceRatio > 15) debtManagement = 65;
  else if (debtServiceRatio > 0) debtManagement = 85;

  const discretionary = report.expenses.discretionaryExpenses;
  const discRatio = netLivingExpenses > 0 ? (discretionary / netLivingExpenses) * 100 : 0;
  let discretionarySpending = 90;
  if (discRatio > 20) discretionarySpending = 40;
  else if (discRatio > 10) discretionarySpending = 60;
  else if (discRatio > 5) discretionarySpending = 75;

  const consistency = 80;

  const overallScore = Math.round(
    saving * 0.2 +
    spendingControl * 0.2 +
    cashFlowStability * 0.15 +
    emergencyLiquidity * 0.15 +
    debtManagement * 0.1 +
    discretionarySpending * 0.1 +
    subscriptionManagement * 0.05 +
    consistency * 0.05
  );

  let rating: 'Poor' | 'Fair' | 'Moderate' | 'Good' | 'Excellent' = 'Moderate';
  if (overallScore >= 85) rating = 'Excellent';
  else if (overallScore >= 70) rating = 'Good';
  else if (overallScore >= 50) rating = 'Moderate';
  else if (overallScore >= 35) rating = 'Fair';
  else rating = 'Poor';

  const summary = `Audited net cash flow of +₦${netCashFlow.toLocaleString()} with ₦${report.wealth.totalCapitalPreserved.toLocaleString()} preserved in wealth and savings sweeps, achieving an audited net savings rate of ${savingsRate.toFixed(1)}% and living expense ratio of ${livingExpenseRatio.toFixed(1)}%.`;

  return {
    overallScore,
    rating,
    summary,
    breakdown: {
      saving,
      spendingControl,
      cashFlowStability,
      emergencyLiquidity,
      subscriptionManagement,
      debtManagement,
      discretionarySpending,
      consistency,
    },
    disclaimer: 'Audited dynamically from verified statement transactions in application code. No AI estimation.',
  };
}
