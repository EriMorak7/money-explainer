// Phase 1 Foundation Automated Verification Test
// Tests accounting integrity, normalization, demo math, and currency utilities

import assert from 'node:assert/strict';
import test from 'node:test';

// Import raw data and calculations
import { 
  demoAccount, 
  demoStatement, 
  rawDemoTransactions, 
  demoTransactions, 
  demoMetrics,
  demoCategorySummaries 
} from './fixtures/demoData.ts';
import { formatCurrency, formatCompactCurrency, formatPercentage } from '../src/lib/utils.ts';

test('1. Currency Formatter Formats Correctly with Nigerian Naira', () => {
  assert.equal(formatCurrency(1500, 'NGN'), '₦1,500.00');
  assert.equal(formatCurrency(1200000, 'NGN'), '₦1,200,000.00');
  assert.equal(formatCurrency(-5000, 'NGN'), '-₦5,000.00');
  assert.equal(formatCurrency(0, 'NGN'), '₦0.00');
  assert.equal(formatCompactCurrency(1200000, 'NGN'), '₦1.2M');
  assert.equal(formatCompactCurrency(45000, 'NGN'), '₦45.0k');
  assert.equal(formatPercentage(15.15), '15.2%');
});

test('2. Statement Data Integrity and Constraints', () => {
  assert.equal(demoAccount.currency, 'NGN');
  assert.equal(demoStatement.transactionCount, 34);
  assert.equal(demoTransactions.length, 34);
  assert.equal(demoAccount.openingBalance, 420500.0);
  assert.equal(demoAccount.closingBalance, 1238488.72);
});

test('3. Strict Accounting: Income Isolation vs Credits', () => {
  // Only genuine income credits are counted as income
  const incomeCredits = demoTransactions
    .filter((tx) => tx.isIncome)
    .reduce((sum, tx) => sum + tx.credit, 0);

  assert.equal(incomeCredits, 1650000.0, 'Income must strictly equal ₦1,650,000');
  assert.equal(demoMetrics.totalIncome, 1650000.0);

  // Refund credit (3,500) must NOT be counted as income
  const refundCredits = demoTransactions
    .filter((tx) => tx.isRefund)
    .reduce((sum, tx) => sum + tx.credit, 0);
  assert.equal(refundCredits, 3500.0, 'Refund must be ₦3,500');
  assert.equal(demoMetrics.totalRefunds, 3500.0);
});

test('4. Strict Accounting: Savings Sweeps Isolated from Living Expenses', () => {
  // Savings sweeps (PiggyVest 150k + Cowrywise 100k)
  const savingsDebits = demoTransactions
    .filter((tx) => tx.isSavings)
    .reduce((sum, tx) => sum + tx.debit, 0);

  assert.equal(savingsDebits, 250000.0, 'Savings must equal ₦250,000');
  assert.equal(demoMetrics.totalSaved, 250000.0);

  // Every savings transaction must have isExpense: false
  demoTransactions
    .filter((tx) => tx.isSavings)
    .forEach((tx) => {
      assert.equal(tx.isExpense, false, `Savings transaction ${tx.id} must NOT be flagged as an expense`);
    });
});

test('5. Strict Accounting: Internal Transfers Isolated', () => {
  // Internal transfer (50,000 to OPay wallet)
  const internalTransfers = demoTransactions
    .filter((tx) => tx.isInternalTransfer)
    .reduce((sum, tx) => sum + tx.debit, 0);

  assert.equal(internalTransfers, 50000.0, 'Internal transfer must equal ₦50,000');
  assert.equal(demoMetrics.totalTransfers, 50000.0);

  // Internal transfers must have isExpense: false
  demoTransactions
    .filter((tx) => tx.isInternalTransfer)
    .forEach((tx) => {
      assert.equal(tx.isExpense, false, `Internal transfer ${tx.id} must NOT be flagged as an expense`);
    });
});

test('6. Strict Accounting: Net Living Expenses and Cash Flow Math', () => {
  // Gross debits flagged as pure expenses
  const grossExpenses = demoTransactions
    .filter((tx) => tx.isExpense)
    .reduce((sum, tx) => sum + tx.debit, 0);

  assert.equal(Math.round(grossExpenses * 100) / 100, 535511.28);

  // Net expenses = gross expenses - refund credit
  const netExpenses = Math.round((grossExpenses - demoMetrics.totalRefunds) * 100) / 100;
  assert.equal(netExpenses, 532011.28);
  assert.equal(demoMetrics.totalExpenses, 532011.28);

  // Net cash flow = Total Income - Net Living Expenses
  const computedCashFlow = Math.round((demoMetrics.totalIncome - netExpenses) * 100) / 100;
  assert.equal(computedCashFlow, 1117988.72);
  assert.equal(demoMetrics.netCashFlow, 1117988.72);

  // Savings rate = Total Saved / Total Income
  const computedSavingsRate = Math.round((demoMetrics.totalSaved / demoMetrics.totalIncome) * 10000) / 100;
  assert.equal(computedSavingsRate, 15.15);
});

test('7. Running Balance Verification on Every Single Row', () => {
  let rolling = demoAccount.openingBalance;
  for (const tx of demoTransactions) {
    rolling = rolling - tx.debit + tx.credit;
    const roundedRolling = Math.round(rolling * 100) / 100;
    assert.equal(
      tx.balance,
      roundedRolling,
      `Transaction ${tx.id} (${tx.description}) running balance mismatch: expected ${roundedRolling}, got ${tx.balance}`
    );
  }
  assert.equal(Math.round(rolling * 100) / 100, demoAccount.closingBalance);
});

test('8. Financial Health Score Breakdown Ranges', () => {
  const h = demoMetrics.healthScore;
  assert.ok(h.overallScore >= 0 && h.overallScore <= 100);
  assert.ok(h.breakdown.saving >= 0 && h.breakdown.saving <= 100);
  assert.ok(h.breakdown.spendingControl >= 0 && h.breakdown.spendingControl <= 100);
  assert.ok(h.breakdown.cashFlowStability >= 0 && h.breakdown.cashFlowStability <= 100);
  assert.ok(h.breakdown.emergencyLiquidity >= 0 && h.breakdown.emergencyLiquidity <= 100);
  assert.ok(h.breakdown.debtManagement >= 0 && h.breakdown.debtManagement <= 100);
  assert.ok(h.breakdown.discretionarySpending >= 0 && h.breakdown.discretionarySpending <= 100);
  assert.ok(h.disclaimer.includes('AI-generated baseline estimate'));
});
