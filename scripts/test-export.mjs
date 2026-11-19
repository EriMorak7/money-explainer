import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { exportTransactionsToCsv } from '../src/lib/export/csvExport.ts';
import { generateFinancialReportData } from '../src/lib/export/reportData.ts';
import { auditFinancialCalculations, computeHealthScore } from '../src/lib/calculations/financialEngine.ts';
import { realOpayAccount, realOpayStatement, realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoAccount, demoStatement, demoTransactions } from './fixtures/demoData.ts';

describe('Phase 14: Financial Report Export (PDF & CSV)', () => {
  it('1. CSV Export: Exact Header Columns & Row Count', () => {
    const csv = exportTransactionsToCsv(realOpayTransactions);
    const lines = csv.split('\r\n');
    assert.ok(lines.length > realOpayTransactions.length, 'Contains all rows plus header');

    const expectedHeader = 'Date,Description,Merchant,Category,Debit,Credit,Balance,Transaction Type,Confidence';
    assert.equal(lines[0], expectedHeader);

    // Verify first row has 9 columns
    const firstRowCols = lines[1].split(',');
    assert.ok(firstRowCols.length >= 9, 'First row has at least 9 columns');
  });

  it('2. CSV Export: RFC 4180 Escaping for Quotes, Commas, and Newlines', () => {
    const mockTxs = [
      {
        id: 'tx1',
        date: '2024-03-01',
        description: 'Payment for groceries, snacks, and "fresh" fruit',
        merchant: 'Supermarket, Victoria Island',
        category: 'Food',
        debit: 15400.5,
        credit: 0,
        amount: 15400.5,
        balance: 250000,
        transactionType: 'EXPENSE',
        confidenceScore: 0.95,
      },
    ];

    const csv = exportTransactionsToCsv(mockTxs);
    const lines = csv.split('\r\n');
    assert.equal(lines.length, 2);

    // Description must be quoted and have doubled quotes
    assert.ok(lines[1].includes('"Payment for groceries, snacks, and ""fresh"" fruit"'));
    // Merchant with comma must be quoted
    assert.ok(lines[1].includes('"Supermarket, Victoria Island"'));
    assert.ok(lines[1].includes('15400.50'));
    assert.ok(lines[1].includes('95%'));
  });

  it('3. CSV Export: Filtered Export Support', () => {
    const filteredTxs = realOpayTransactions.filter((t) => t.category === 'Food');
    const csv = exportTransactionsToCsv(filteredTxs);
    const lines = csv.split('\r\n').filter((l) => l.trim().length > 0);
    // 1 header + filtered length
    assert.equal(lines.length, filteredTxs.length + 1);
  });

  it('4. Financial Report Data: Contains All 13 Mandated Sections', () => {
    const report = generateFinancialReportData(
      realOpayTransactions,
      realOpayAccount,
      realOpayStatement,
      'NGN'
    );

    assert.ok(report.statementOverview, 'Section 1: Statement Overview');
    assert.ok(report.financialSummary, 'Section 2: Financial Summary');
    assert.ok(report.incomeAnalysis, 'Section 3: Income Analysis');
    assert.ok(report.expenseAnalysis, 'Section 4: Expense Analysis');
    assert.ok(report.cashFlow, 'Section 5: Cash Flow');
    assert.ok(report.savingsAnalysis, 'Section 6: Savings Analysis');
    assert.ok(report.spendingCategories, 'Section 7: Spending Categories');
    assert.ok(report.merchantAnalysis, 'Section 8: Merchant Analysis');
    assert.ok(report.recurringPayments, 'Section 9: Recurring Payments');
    assert.ok(report.largestTransactions, 'Section 10: Largest Transactions');
    assert.ok(report.financialInsights, 'Section 11: Financial Insights');
    assert.ok(report.budgetAnalysis, 'Section 12: Budget Analysis');
    assert.ok(report.recommendations, 'Section 13: Recommendations');
    assert.ok(report.recommendations.length >= 3, 'At least 3 tailored recommendations');
  });

  it('5. Zero Discrepancy: Mathematical Identity With Core Financial Engine', () => {
    const coreAudit = auditFinancialCalculations(
      realOpayTransactions,
      realOpayAccount.openingBalance,
      realOpayAccount.closingBalance,
      'NGN'
    );
    const report = generateFinancialReportData(
      realOpayTransactions,
      realOpayAccount,
      realOpayStatement,
      'NGN'
    );

    // Exact identity checks
    assert.equal(report.financialSummary.totalExternalIncome, coreAudit.income.totalIncome);
    assert.equal(report.financialSummary.totalActualExpenses, coreAudit.expenses.netLivingExpenses);
    assert.equal(report.financialSummary.netCashFlow, coreAudit.netCashFlow);
    assert.equal(report.financialSummary.savingsRatePercent, coreAudit.savingsRate);
    const expectedHealth = computeHealthScore(coreAudit, realOpayTransactions);
    assert.equal(report.financialSummary.financialHealthScore, expectedHealth.overallScore);
  });

  it('6. Privacy & Sensitive Information Masking', () => {
    const report = generateFinancialReportData(
      realOpayTransactions,
      realOpayAccount,
      realOpayStatement,
      'NGN'
    );

    // Account number must be masked
    assert.ok(
      report.statementOverview.accountNumberMasked.startsWith('****'),
      'Account number begins with mask asterisks'
    );
    assert.notEqual(report.statementOverview.accountNumberMasked, '8139596407');
    assert.ok(
      !report.statementOverview.accountNumberMasked.includes('8139596407'),
      'Full account number is never exposed in report'
    );
  });

  it('7. Multi-Bank Dataset Execution: Zenith Bank Statement', () => {
    const reportZenith = generateFinancialReportData(
      demoTransactions,
      demoAccount,
      demoStatement,
      'NGN'
    );

    assert.ok(reportZenith.statementOverview.bankName.includes('Zenith Bank'));
    assert.equal(reportZenith.statementOverview.totalTransactions, demoTransactions.length);
    assert.ok(reportZenith.spendingCategories.length > 0);
    assert.ok(reportZenith.merchantAnalysis.length > 0);
  });
});
