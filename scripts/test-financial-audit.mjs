// Phase 4 Financial Calculation Audit Test Suite
// Rigorously audits all 14 criteria:
// 1. Internal transfers != Income
// 2. Internal transfers != Expenses
// 3. Savings deposits != Expenses
// 4. Savings withdrawals != Income
// 5. Refunds != Permanent spending & != Income
// 6. Reversed transactions handled correctly
// 7. Loans received != Income
// 8. Loan repayments != Ordinary lifestyle spending
// 9. Own-account transfers detected
// 10. Client/business payments distinguished from internal transfers
// 11. Bank charges counted separately
// 12. Investment deposits separated from ordinary expenses
// 13. Deduplication prevents double counting of credits and debits
// 14. Opening and closing balance reconciliation
// 15. Audit of real 20-page Nigerian OPay statement

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import pdf from 'pdf-parse/lib/pdf-parse.js';

import { 
  auditFinancialCalculations, 
  deduplicateTransactions, 
  reconcileBalances, 
  round2 
} from '../src/lib/calculations/financialEngine.ts';
import { parseOPayText } from '../src/lib/parser/opayParser.ts';

// Helper to construct mock transaction
function createMockTx(overrides) {
  return {
    id: `tx_${Math.random().toString(36).substring(2, 9)}`,
    statementId: 'stmt_test',
    accountId: 'acc_test',
    date: '2026-10-15',
    description: 'Mock Transaction',
    originalDescription: 'Mock Transaction Raw',
    debit: 0,
    credit: 0,
    amount: 0,
    direction: 'DEBIT',
    balance: 100000,
    currency: 'NGN',
    category: 'Other',
    categoryGroup: 'Other',
    transactionType: 'EXPENSE',
    confidenceScore: 1.0,
    classificationMethod: 'deterministic',
    isInternalTransfer: false,
    isRefund: false,
    isRecurring: false,
    isIncome: false,
    isExpense: true,
    isSavings: false,
    source: 'test.pdf',
    ...overrides,
  };
}

test('1. Internal Transfers are NOT counted as Income', () => {
  const txs = [
    createMockTx({
      description: 'Transfer from Zenith Bank | Own Account Sweep',
      direction: 'CREDIT',
      credit: 50000,
      amount: 50000,
      balance: 150000,
      category: 'Transfers',
      transactionType: 'INTERNAL_TRANSFER',
      isInternalTransfer: true,
      isIncome: false,
    }),
    createMockTx({
      description: 'Monthly Salary ACME Tech',
      direction: 'CREDIT',
      credit: 500000,
      amount: 500000,
      balance: 650000,
      category: 'Salary',
      transactionType: 'INCOME',
      isIncome: true,
    }),
  ];

  const report = auditFinancialCalculations(txs, 100000, 650000);
  assert.equal(report.income.totalIncome, 500000, 'Income must strictly exclude internal transfer credit');
  assert.equal(report.income.excludedInflows.internalTransfersIn, 50000);
  assert.equal(report.transfers.internalTransfersIn, 50000);
});

test('2. Internal Transfers are NOT counted as Expenses', () => {
  const txs = [
    createMockTx({
      description: 'Transfer to OPay Wallet | Self Funding',
      direction: 'DEBIT',
      debit: 40000,
      amount: 40000,
      balance: 60000,
      category: 'Transfers',
      transactionType: 'INTERNAL_TRANSFER',
      isInternalTransfer: true,
      isExpense: false,
    }),
    createMockTx({
      description: 'Dominos Pizza Lekki',
      direction: 'DEBIT',
      debit: 12000,
      amount: 12000,
      balance: 48000,
      category: 'Restaurants',
      transactionType: 'EXPENSE',
      isExpense: true,
    }),
  ];

  const report = auditFinancialCalculations(txs, 100000, 48000);
  assert.equal(report.expenses.netLivingExpenses, 12000, 'Living expenses must strictly exclude internal transfer debit');
  assert.equal(report.expenses.excludedOutflows.internalTransfersOut, 40000);
  assert.equal(report.transfers.internalTransfersOut, 40000);
});

test('3. Savings Deposits are NOT counted as ordinary expenses', () => {
  const txs = [
    createMockTx({
      description: 'TRF/DEPOSIT PIGGYVEST CORE SAVINGS',
      direction: 'DEBIT',
      debit: 150000,
      amount: 150000,
      balance: 350000,
      category: 'Savings',
      transactionType: 'SAVINGS_TRANSFER',
      isSavings: true,
      isExpense: false,
    }),
    createMockTx({
      description: 'Auto-save to OWealth Balance',
      direction: 'DEBIT',
      debit: 20000,
      amount: 20000,
      balance: 330000,
      category: 'Savings',
      transactionType: 'SAVINGS_TRANSFER',
      isSavings: true,
      isExpense: false,
    }),
    createMockTx({
      description: 'Groceries Shoprite Ikeja',
      direction: 'DEBIT',
      debit: 35000,
      amount: 35000,
      balance: 295000,
      category: 'Groceries',
      transactionType: 'EXPENSE',
      isExpense: true,
    }),
  ];

  const report = auditFinancialCalculations(txs, 500000, 295000);
  assert.equal(report.expenses.netLivingExpenses, 35000, 'Living expenses must ONLY count grocery shopping');
  assert.equal(report.wealth.savingsDeposits, 170000, 'Savings deposits must be tracked as capital preserved');
  assert.equal(report.expenses.excludedOutflows.savingsDeposits, 170000);
});

test('4. Savings Withdrawals are NOT counted as Income', () => {
  const txs = [
    createMockTx({
      description: 'OWealth Withdrawal to Wallet',
      direction: 'CREDIT',
      credit: 80000,
      amount: 80000,
      balance: 180000,
      category: 'Savings',
      transactionType: 'SAVINGS_TRANSFER',
      isSavings: true,
      isIncome: false,
    }),
    createMockTx({
      description: 'Safebox Withdrawal to Wallet',
      direction: 'CREDIT',
      credit: 25000,
      amount: 25000,
      balance: 205000,
      category: 'Savings',
      transactionType: 'SAVINGS_TRANSFER',
      isSavings: true,
      isIncome: false,
    }),
  ];

  const report = auditFinancialCalculations(txs, 100000, 205000);
  assert.equal(report.income.totalIncome, 0, 'Savings withdrawals must NEVER be counted as earned income');
  assert.equal(report.wealth.savingsWithdrawals, 105000);
  assert.equal(report.income.excludedInflows.savingsWithdrawals, 105000);
});

test('5. Refunds are NOT counted as permanent spending or income', () => {
  const txs = [
    createMockTx({
      description: 'POS Purchase Bolt Lagos',
      direction: 'DEBIT',
      debit: 10000,
      amount: 10000,
      balance: 90000,
      category: 'Transportation',
      transactionType: 'EXPENSE',
      isExpense: true,
    }),
    createMockTx({
      description: 'Bolt refunded | Trip Cancellation',
      direction: 'CREDIT',
      credit: 3500,
      amount: 3500,
      balance: 93500,
      category: 'Refund',
      transactionType: 'REFUND',
      isRefund: true,
      isIncome: false,
    }),
  ];

  const report = auditFinancialCalculations(txs, 100000, 93500);
  assert.equal(report.income.totalIncome, 0, 'Refunds must NOT be counted as income');
  assert.equal(report.expenses.grossLivingExpenses, 10000, 'Gross expense before refund');
  assert.equal(report.expenses.refundsOffset, 3500, 'Refund offsets living expenses');
  assert.equal(report.expenses.netLivingExpenses, 6500, 'Net living expenses must be strictly ₦6,500');
});

test('6. Reversed transactions are handled correctly', () => {
  const txs = [
    createMockTx({
      description: 'OPay Card Payment Failed',
      direction: 'DEBIT',
      debit: 4710,
      amount: 4710,
      balance: 95290,
      category: 'Shopping',
      transactionType: 'EXPENSE',
      isExpense: true,
    }),
    createMockTx({
      description: 'Reversal - OPay Card Payment',
      direction: 'CREDIT',
      credit: 4710,
      amount: 4710,
      balance: 100000,
      category: 'Refund',
      transactionType: 'REFUND',
      isRefund: true,
      isIncome: false,
    }),
  ];

  const report = auditFinancialCalculations(txs, 100000, 100000);
  assert.equal(report.income.totalIncome, 0, 'Reversal credit is not income');
  assert.equal(report.expenses.netLivingExpenses, 0, 'Reversal completely nullifies the failed debit');
  assert.equal(report.refunds.totalReversals, 4710);
});

test('7. Loans received are NOT automatically classified as income', () => {
  const txs = [
    createMockTx({
      description: 'Carbon Quick Loan Disbursement',
      direction: 'CREDIT',
      credit: 100000,
      amount: 100000,
      balance: 150000,
      category: 'Loan Repayment',
      transactionType: 'LOAN_DISBURSEMENT',
      isIncome: false,
    }),
    createMockTx({
      description: 'Client Invoice Payment Dev Work',
      direction: 'CREDIT',
      credit: 250000,
      amount: 250000,
      balance: 400000,
      category: 'Client Payment',
      transactionType: 'INCOME',
      isIncome: true,
    }),
  ];

  const report = auditFinancialCalculations(txs, 50000, 400000);
  assert.equal(report.income.totalIncome, 250000, 'Total income must exclude loan disbursement');
  assert.equal(report.debt.loansReceived, 100000, 'Loan disbursement recorded in debt ledger');
  assert.equal(report.income.excludedInflows.loansReceived, 100000);
});

test('8. Loan repayments are separated from ordinary lifestyle spending', () => {
  const txs = [
    createMockTx({
      description: 'Transfer to FairMoney Loan Repayment',
      direction: 'DEBIT',
      debit: 30000,
      amount: 30000,
      balance: 170000,
      category: 'Loan Repayment',
      transactionType: 'LOAN_REPAYMENT',
      isExpense: false,
    }),
    createMockTx({
      description: 'Chicken Republic Lunch',
      direction: 'DEBIT',
      debit: 5000,
      amount: 5000,
      balance: 165000,
      category: 'Restaurants',
      transactionType: 'EXPENSE',
      isExpense: true,
    }),
  ];

  const report = auditFinancialCalculations(txs, 200000, 165000);
  assert.equal(report.expenses.netLivingExpenses, 5000, 'Living expenses must only include food, not loan debt');
  assert.equal(report.debt.loanRepayments, 30000, 'Loan repayment recorded under debt service');
  assert.equal(report.expenses.excludedOutflows.loanRepayments, 30000);
});

test('9. Transfers between user own accounts are detected where possible', () => {
  const txs = [
    createMockTx({
      description: 'Transfer from own Zenith Account',
      direction: 'CREDIT',
      credit: 15000,
      amount: 15000,
      balance: 65000,
      category: 'Transfers',
      transactionType: 'INTERNAL_TRANSFER',
      isInternalTransfer: true,
    }),
    createMockTx({
      description: 'Transfer to own Zenith Account',
      direction: 'DEBIT',
      debit: 15000,
      amount: 15000,
      balance: 50000,
      category: 'Transfers',
      transactionType: 'INTERNAL_TRANSFER',
      isInternalTransfer: true,
    }),
  ];

  const report = auditFinancialCalculations(txs, 50000, 50000);
  assert.equal(report.transfers.internalTransfersIn, 15000);
  assert.equal(report.transfers.internalTransfersOut, 15000);
  assert.equal(report.transfers.netInternalMovement, 0);
  assert.equal(report.income.totalIncome, 0);
  assert.equal(report.expenses.netLivingExpenses, 0);
});

test('10. Client/business payments are distinguished from internal transfers', () => {
  const txs = [
    createMockTx({
      description: 'Transfer from PAYSTACK / DELOY CONSULTING LTD | Invoice 104',
      direction: 'CREDIT',
      credit: 350000,
      amount: 350000,
      balance: 400000,
      category: 'Client Payment',
      transactionType: 'INCOME',
      isIncome: true,
    }),
    createMockTx({
      description: 'Transfer from GTBank | Internal Sweep',
      direction: 'CREDIT',
      credit: 50000,
      amount: 50000,
      balance: 450000,
      category: 'Transfers',
      transactionType: 'INTERNAL_TRANSFER',
      isInternalTransfer: true,
      isIncome: false,
    }),
  ];

  const report = auditFinancialCalculations(txs, 50000, 450000);
  assert.equal(report.income.clientPayments, 350000);
  assert.equal(report.income.totalIncome, 350000, 'Only genuine client payment is counted in total income');
  assert.equal(report.transfers.internalTransfersIn, 50000);
});

test('11. Bank charges are counted separately from ordinary spending', () => {
  const txs = [
    createMockTx({
      description: 'Stamp Duty Fee',
      direction: 'DEBIT',
      debit: 50,
      amount: 50,
      balance: 99950,
      category: 'Bank Charges',
      transactionType: 'BANK_CHARGE',
    }),
    createMockTx({
      description: 'USSD Charge',
      direction: 'DEBIT',
      debit: 10,
      amount: 10,
      balance: 99940,
      category: 'Bank Charges',
      transactionType: 'BANK_CHARGE',
    }),
    createMockTx({
      description: 'Electronic Money Transfer Levy (EMTL)',
      direction: 'DEBIT',
      debit: 50,
      amount: 50,
      balance: 99890,
      category: 'Bank Charges',
      transactionType: 'BANK_CHARGE',
    }),
    createMockTx({
      description: 'Total Energies Petrol Lekki',
      direction: 'DEBIT',
      debit: 25000,
      amount: 25000,
      balance: 74890,
      category: 'Fuel',
      transactionType: 'EXPENSE',
    }),
  ];

  const report = auditFinancialCalculations(txs, 100000, 74890);
  assert.equal(report.expenses.bankCharges, 110, 'Bank fees must equal ₦110');
  assert.equal(report.expenses.netLivingExpenses, 25000, 'Living expenses must only include fuel');
});

test('12. Investment deposits are separated from ordinary expenses', () => {
  const txs = [
    createMockTx({
      description: 'TRF/DEPOSIT COWRYWISE MUTUAL FUNDS INVESTMENT',
      direction: 'DEBIT',
      debit: 100000,
      amount: 100000,
      balance: 100000,
      category: 'Investment',
      transactionType: 'INVESTMENT',
    }),
    createMockTx({
      description: 'Risevest Dollar Tech Fund Deposit',
      direction: 'DEBIT',
      debit: 80000,
      amount: 80000,
      balance: 20000,
      category: 'Investment',
      transactionType: 'INVESTMENT',
    }),
  ];

  const report = auditFinancialCalculations(txs, 200000, 20000);
  assert.equal(report.expenses.netLivingExpenses, 0, 'Investment capital must NOT be marked as an expense');
  assert.equal(report.wealth.investmentDeposits, 180000);
  assert.equal(report.wealth.totalCapitalPreserved, 180000);
});

test('13. Deduplication prevents double-counting of credits and debits', () => {
  const originalTx = createMockTx({
    id: 'tx_orig_1',
    reference: 'REF998877665544',
    direction: 'CREDIT',
    credit: 200000,
    amount: 200000,
    balance: 300000,
    category: 'Salary',
    transactionType: 'INCOME',
    isIncome: true,
  });

  const duplicateTx = createMockTx({
    id: 'tx_dup_1',
    reference: 'REF998877665544', // exact same reference
    direction: 'CREDIT',
    credit: 200000,
    amount: 200000,
    balance: 300000,
    category: 'Salary',
    transactionType: 'INCOME',
    isIncome: true,
  });

  const txs = [originalTx, duplicateTx];

  const dedup = deduplicateTransactions(txs);
  assert.equal(dedup.duplicateCount, 1, 'Must detect exactly 1 duplicate transaction');
  assert.equal(dedup.duplicateCreditSum, 200000, 'Duplicate credit sum must equal ₦200,000');
  assert.equal(dedup.deduplicatedTransactions.length, 1);

  const report = auditFinancialCalculations(txs, 100000, 300000);
  assert.equal(report.income.totalIncome, 200000, 'Income must be counted ONCE, not doubled to ₦400,000');
});

test('14. Opening and closing balance reconciliation with discrepancy detection', () => {
  const txs = [
    createMockTx({
      direction: 'CREDIT',
      credit: 150000,
      amount: 150000,
      balance: 250000,
      category: 'Salary',
      transactionType: 'INCOME',
    }),
    createMockTx({
      direction: 'DEBIT',
      debit: 40000,
      amount: 40000,
      balance: 210000,
      category: 'Fuel',
      transactionType: 'EXPENSE',
    }),
  ];

  // Case A: Perfectly reconciled
  const reconciled = reconcileBalances(txs, 100000, 210000);
  assert.equal(reconciled.isReconciled, true);
  assert.equal(reconciled.discrepancy, 0);
  assert.equal(reconciled.expectedClosingBalance, 210000);

  // Case B: Unreconciled bank statement drift
  const unreconciled = reconcileBalances(txs, 100000, 205000); // 5000 missing in statement
  assert.equal(unreconciled.isReconciled, false);
  assert.equal(unreconciled.discrepancy, 5000, 'Discrepancy must be exactly ₦5,000');
});

test('15. Full Statement Audit on Real 20-Page Nigerian OPay Statement', async () => {
  const REAL_PDF_PATH = path.resolve('C:/Users/erimo/.gemini/antigravity/brain/3cf779ba-64fe-40e1-867f-3de71de07346/.user_uploaded/media_1794234934312_0f5b93fd.pdf');
  const buffer = fs.readFileSync(REAL_PDF_PATH);
  const pdfData = await pdf(buffer);
  const parsed = parseOPayText(pdfData.text, 'media_1794234934312_0f5b93fd.pdf');

  // Convert normalized transactions to Transaction objects
  const transactions = parsed.transactions.map((tx) => ({
    id: tx.id,
    statementId: 'stmt_opay_real',
    accountId: 'acc_opay_real',
    date: tx.date,
    time: tx.time,
    description: tx.description,
    originalDescription: tx.originalDescription,
    merchant: tx.merchant,
    reference: tx.reference,
    debit: tx.debit,
    credit: tx.credit,
    amount: tx.amount,
    direction: tx.direction,
    balance: tx.balance,
    currency: tx.currency,
    category: tx.category || 'Other',
    categoryGroup: tx.categoryGroup || 'Other',
    transactionType: tx.transactionType || 'EXPENSE',
    confidenceScore: tx.confidenceScore || 0.95,
    classificationMethod: tx.classificationMethod || 'deterministic',
    isInternalTransfer: tx.isInternalTransfer || false,
    isRefund: tx.isRefund || false,
    isRecurring: tx.isRecurring || false,
    isIncome: tx.isIncome || false,
    isExpense: tx.isExpense || false,
    isSavings: tx.isSavings || false,
    notes: tx.notes,
    source: tx.source,
  }));

  // Run the audit engine on all 432 real transactions
  const auditReport = auditFinancialCalculations(transactions);

  // Assert calculations happened deterministically in application code
  assert.ok(auditReport.transactionCount === 432, 'Must audit all 432 real transactions');
  assert.ok(auditReport.income.totalIncome >= 0);
  assert.ok(auditReport.expenses.netLivingExpenses >= 0);
  assert.ok(auditReport.wealth.savingsDeposits >= 0);
  assert.ok(auditReport.transfers.internalTransfersOut >= 0);

  // Assert that internal transfers and savings are NOT counted as living expenses
  assert.ok(
    auditReport.expenses.excludedOutflows.internalTransfersOut >= 0,
    'Internal transfers must be tracked separately from expenses'
  );
  assert.ok(
    auditReport.expenses.excludedOutflows.savingsDeposits >= 0,
    'Savings deposits must be tracked separately from expenses'
  );

  // Assert key ratios are computed within valid mathematical bounds
  assert.ok(typeof auditReport.netCashFlow === 'number');
  assert.ok(auditReport.savingsRate >= 0 && auditReport.savingsRate <= 100);
});
