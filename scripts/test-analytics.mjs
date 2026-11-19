import test from 'node:test';
import assert from 'node:assert/strict';
import { realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoTransactions } from './fixtures/demoData.ts';
import { auditFinancialCalculations } from '../src/lib/calculations/financialEngine.ts';
import {
  computeAnalyticsReport,
  computeCategoryAnalytics,
  computeCategoryGroupAnalytics,
  computeHighestSpendingDays,
  computeLargestTransactions,
  computeMerchantAnalytics,
  computeSavingsTrends,
  computeTimelineTrends,
  computeTransactionFrequency,
} from '../src/lib/calculations/analyticsEngine.ts';

test('1. Spending by Category Integrity & Reconciliation', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const expectedGrossLiving = audit.expenses.grossLivingExpenses; // 310,638.08

  const categories = computeCategoryAnalytics(realOpayTransactions, expectedGrossLiving);
  assert.ok(categories.length > 0, 'Categories should not be empty');

  // Sum of all categories must match grossLivingExpenses exactly
  const sumCategories = categories.reduce((s, c) => s + c.totalSpent, 0);
  const roundedSum = Math.round((sumCategories + Number.EPSILON) * 100) / 100;
  assert.equal(
    roundedSum,
    expectedGrossLiving,
    `Category spending sum (${roundedSum}) must equal gross living expenses (${expectedGrossLiving})`
  );

  // Each category must have valid averages and metrics
  for (const cat of categories) {
    assert.ok(cat.totalSpent > 0, `Category ${cat.category} total spent must be > 0`);
    assert.ok(cat.transactionCount > 0, `Category ${cat.category} count must be > 0`);
    assert.ok(cat.averageTransaction <= cat.maxTransaction, `Average <= max for ${cat.category}`);
    assert.ok(cat.percentageOfTotal > 0, `Percentage > 0 for ${cat.category}`);
  }
});

test('2. Spending by Category Group Integrity', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const expectedGrossLiving = audit.expenses.grossLivingExpenses;

  const categories = computeCategoryAnalytics(realOpayTransactions, expectedGrossLiving);
  const groups = computeCategoryGroupAnalytics(categories, expectedGrossLiving);

  assert.ok(groups.length > 0, 'Category groups should not be empty');

  // Sum of all group totals must match grossLivingExpenses
  const sumGroups = groups.reduce((s, g) => s + g.totalSpent, 0);
  const roundedSum = Math.round((sumGroups + Number.EPSILON) * 100) / 100;
  assert.equal(
    roundedSum,
    expectedGrossLiving,
    `Group spending sum (${roundedSum}) must equal gross living expenses (${expectedGrossLiving})`
  );

  // Total percentages must sum to ~100%
  const sumPercent = groups.reduce((s, g) => s + g.percentageOfTotal, 0);
  assert.ok(Math.abs(sumPercent - 100) < 0.5, `Percentages sum to ~100% (got ${sumPercent})`);
});

test('3. Merchant Analytics Verification', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const merchants = computeMerchantAnalytics(realOpayTransactions, audit.expenses.grossLivingExpenses, 25);

  assert.ok(merchants.length > 0, 'Merchant analytics must extract recipients');
  assert.ok(merchants.length <= 25, 'Limit constraint respected');

  // Check sorting: descending by total spent
  for (let i = 0; i < merchants.length - 1; i++) {
    assert.ok(
      merchants[i].totalSpent >= merchants[i + 1].totalSpent,
      `Merchants must be sorted descending (${merchants[i].totalSpent} >= ${merchants[i + 1].totalSpent})`
    );
    assert.ok(merchants[i].firstDate <= merchants[i].lastDate, 'firstDate <= lastDate');
    assert.ok(merchants[i].averageTransaction <= merchants[i].maxTransaction, 'avg <= max');
  }
});

test('4. Daily, Weekly & Monthly Timeline Trends Mathematical Match', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const trends = computeTimelineTrends(realOpayTransactions);

  assert.ok(trends.daily.length > 0, 'Daily trends must exist');
  assert.ok(trends.weekly.length > 0, 'Weekly trends must exist');
  assert.ok(trends.monthly.length > 0, 'Monthly trends must exist');

  // Daily spending sum must match grossLivingExpenses
  const dailySpendingSum = Math.round((trends.daily.reduce((s, d) => s + d.spending, 0) + Number.EPSILON) * 100) / 100;
  assert.equal(dailySpendingSum, audit.expenses.grossLivingExpenses, 'Daily spending sum matches grossLivingExpenses');

  // Daily income sum must match totalIncome
  const dailyIncomeSum = Math.round((trends.daily.reduce((s, d) => s + d.income, 0) + Number.EPSILON) * 100) / 100;
  assert.equal(dailyIncomeSum, audit.income.totalIncome, 'Daily income sum matches totalIncome');

  // Weekly spending sum must match daily spending sum
  const weeklySpendingSum = Math.round((trends.weekly.reduce((s, w) => s + w.spending, 0) + Number.EPSILON) * 100) / 100;
  assert.equal(weeklySpendingSum, dailySpendingSum, 'Weekly spending sum equals daily spending sum');

  // Monthly spending sum must match daily spending sum
  const monthlySpendingSum = Math.round((trends.monthly.reduce((s, m) => s + m.spending, 0) + Number.EPSILON) * 100) / 100;
  assert.equal(monthlySpendingSum, dailySpendingSum, 'Monthly spending sum equals daily spending sum');

  // Chronological order verification
  for (let i = 0; i < trends.daily.length - 1; i++) {
    assert.ok(trends.daily[i].date < trends.daily[i + 1].date, 'Daily points strictly chronological');
  }
});

test('5. Savings Dynamics & Retained Capital Verification', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const savings = computeSavingsTrends(realOpayTransactions);

  assert.ok(savings.totalDeposited > 0, 'Total deposited must be > 0');
  assert.ok(savings.totalWithdrawn > 0, 'Total withdrawn must be > 0');

  // Net retained savings = totalDeposited - totalWithdrawn
  const expectedNet = Math.round((savings.totalDeposited - savings.totalWithdrawn + Number.EPSILON) * 100) / 100;
  assert.equal(savings.netRetainedSavings, expectedNet, 'Net retained savings equals deposits - withdrawals');

  // Last cumulative point must equal netRetainedSavings
  const lastPoint = savings.points[savings.points.length - 1];
  assert.equal(lastPoint.cumulativeRetained, savings.netRetainedSavings, 'Last cumulative point equals net retained savings');

  // Retention rate must match formula
  const expectedRate = Math.round(((savings.netRetainedSavings / savings.totalDeposited) * 100 + Number.EPSILON) * 100) / 100;
  assert.equal(savings.retentionRate, expectedRate, 'Retention rate matches formula');

  // Highest single deposit must be positive
  assert.ok(savings.highestSingleDeposit.amount > 0, 'Highest deposit > 0');
});

test('6. Behavioral Frequency & Distribution Verification', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const freq = computeTransactionFrequency(realOpayTransactions, audit.expenses.grossLivingExpenses);

  assert.equal(freq.totalTransactions, 432, 'Total transactions must be exactly 432');
  assert.equal(freq.debitCount + freq.creditCount, 432, 'Debits + credits = 432');

  // Day of week counts must sum to 432
  const dowCount = freq.dayOfWeekDistribution.reduce((s, d) => s + d.transactionCount, 0);
  assert.equal(dowCount, 432, 'Day of week counts sum to total transactions');

  // Day of week spending sum must match grossLivingExpenses
  const dowSpend = Math.round((freq.dayOfWeekDistribution.reduce((s, d) => s + d.spending, 0) + Number.EPSILON) * 100) / 100;
  assert.equal(dowSpend, audit.expenses.grossLivingExpenses, 'Day of week spending sum matches grossLivingExpenses');

  // Time of day counts must sum to 432
  const todCount = freq.timeOfDayDistribution.reduce((s, t) => s + t.transactionCount, 0);
  assert.equal(todCount, 432, 'Time of day counts sum to total transactions');

  // Peak days must be non-empty strings
  assert.ok(freq.mostActiveDayOfWeek.length > 2, 'Most active day is identified');
  assert.ok(freq.highestSpendingDayOfWeek.length > 2, 'Highest spending day is identified');
});

test('7. Largest Transactions Ranking & Accounting Role', () => {
  const largest = computeLargestTransactions(realOpayTransactions, 10);

  assert.equal(largest.topDebits.length, 10, 'Top 10 debits extracted');
  assert.equal(largest.topCredits.length, 10, 'Top 10 credits extracted');

  // Top debits strictly descending
  for (let i = 0; i < largest.topDebits.length - 1; i++) {
    assert.ok(
      largest.topDebits[i].amount >= largest.topDebits[i + 1].amount,
      `Debits sorted descending (${largest.topDebits[i].amount} >= ${largest.topDebits[i + 1].amount})`
    );
  }

  // Top credits strictly descending
  for (let i = 0; i < largest.topCredits.length - 1; i++) {
    assert.ok(
      largest.topCredits[i].amount >= largest.topCredits[i + 1].amount,
      `Credits sorted descending (${largest.topCredits[i].amount} >= ${largest.topCredits[i + 1].amount})`
    );
  }

  // Savings sweep debits must have isSavingsSweep = true
  const owealthDebits = largest.topDebits.filter((d) => /owealth/i.test(d.description));
  for (const od of owealthDebits) {
    assert.ok(od.isSavingsSweep, 'OWealth debit marked as savings sweep');
    assert.equal(od.isLivingExpense, false, 'OWealth debit NOT marked as living expense');
  }
});

test('8. Highest Spending Days Ranking & Traceability', () => {
  const topDays = computeHighestSpendingDays(realOpayTransactions, 10);

  assert.ok(topDays.length > 0 && topDays.length <= 10, 'Top days extracted');

  // Top days strictly descending
  for (let i = 0; i < topDays.length - 1; i++) {
    assert.ok(
      topDays[i].totalSpending >= topDays[i + 1].totalSpending,
      `Highest spending days sorted descending (${topDays[i].totalSpending} >= ${topDays[i + 1].totalSpending})`
    );
  }

  // Each day's topCategoryAmount <= totalSpending and largestTransaction <= totalSpending
  for (const d of topDays) {
    assert.ok(d.totalSpending > 0, 'Total spending > 0');
    assert.ok(d.transactionCount > 0, 'Transaction count > 0');
    assert.ok(d.topCategoryAmount <= d.totalSpending, 'Top category amount <= day total');
    assert.ok(d.largestTransaction <= d.totalSpending, 'Largest single tx <= day total');
  }
});

test('9. Full Master Analytics Report on Both Real OPay & Zenith Datasets', () => {
  const opayReport = computeAnalyticsReport(realOpayTransactions, 'NGN');
  assert.equal(opayReport.totalTransactions, 432, 'OPay 432 transactions analyzed');
  assert.ok(opayReport.grossLivingExpenses > 0, 'Gross living expenses positive');
  assert.ok(opayReport.categoryAnalytics.length > 0, 'Categories populated');
  assert.ok(opayReport.merchantAnalytics.length > 0, 'Merchants populated');
  assert.ok(opayReport.dailyTrends.length > 0, 'Daily trends populated');

  const zenithReport = computeAnalyticsReport(demoTransactions, 'NGN');
  assert.equal(zenithReport.totalTransactions, 34, 'Zenith 34 transactions analyzed');
  assert.ok(zenithReport.grossLivingExpenses > 0, 'Zenith gross living expenses positive');
  assert.ok(zenithReport.categoryAnalytics.length > 0, 'Zenith categories populated');
});
