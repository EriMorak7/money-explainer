import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMerchantName,
  computeSubscriptionAudit,
} from '../src/lib/subscriptions/recurringEngine.ts';
import { realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoTransactions } from './fixtures/demoData.ts';

describe('Phase 10: Recurring Merchant & Subscription Audit Engine', () => {
  it('1. Merchant Normalization & Signature Matching', () => {
    const raw1 = 'POS PURCHASE - GOOGLE *PLAY APPS 2348123456';
    const norm1 = normalizeMerchantName(raw1);
    assert.equal(norm1.cleanName, 'Google Play Services');
    assert.equal(norm1.knownMatch?.category, 'Gaming & App Store');

    const raw2 = 'WEB PURCHASE - ADOBE SYSTEMS SOFTWARE';
    const norm2 = normalizeMerchantName(raw2);
    assert.equal(norm2.cleanName, 'Adobe Creative Cloud');
    assert.equal(norm2.knownMatch?.category, 'Software & SaaS');

    const raw3 = 'NETFLIX.COM PAYMENT 987654';
    const norm3 = normalizeMerchantName(raw3);
    assert.equal(norm3.cleanName, 'Netflix');

    const raw4 = 'POS PURCHASE - CHOWDECK FOOD DELIVERY 99991';
    const norm4 = normalizeMerchantName(raw4);
    assert.equal(norm4.cleanName, 'CHOWDECK FOOD DELIVERY');
    assert.equal(norm4.knownMatch, undefined);
  });

  it('2. Confidence Scoring & Guard: Never Flag Subscription Solely Because Count = 2', () => {
    // Two random restaurant visits on different dates
    const twoRandomMeals = [
      {
        id: 't1',
        date: '2024-03-01',
        amount: 8500,
        debit: 8500,
        credit: 0,
        type: 'DEBIT',
        isExpense: true,
        category: 'Food',
        merchant: 'Mama Cass Restaurant',
        description: 'Mama Cass Restaurant Lunch',
      },
      {
        id: 't2',
        date: '2024-03-12',
        amount: 9200,
        debit: 9200,
        credit: 0,
        type: 'DEBIT',
        isExpense: true,
        category: 'Food',
        merchant: 'Mama Cass Restaurant',
        description: 'Mama Cass Restaurant Dinner',
      },
    ];

    const reportRandom = computeSubscriptionAudit(twoRandomMeals);
    const mamaCass = reportRandom.allMerchants.find((m) => m.cleanMerchant.includes('Mama Cass'));
    assert.ok(mamaCass, 'Mama Cass found in analysis');
    // Must NOT be flagged as potential subscription
    assert.equal(mamaCass.isPotentialSubscription, false);
    assert.ok(mamaCass.confidenceScore < 0.50, `Confidence was ${mamaCass.confidenceScore}, expected < 0.50`);
    assert.ok(
      mamaCass.confidenceRationale.includes('insufficient pattern') || mamaCass.confidenceRationale.includes('twice'),
      'Rationale notes insufficient subscription pattern'
    );

    // Two Google Play transactions with recurring interval
    const twoGooglePlay = [
      {
        id: 'gp1',
        date: '2024-03-01',
        amount: 4500,
        debit: 4500,
        credit: 0,
        type: 'DEBIT',
        isExpense: true,
        category: 'Subscriptions',
        merchant: 'Google Play',
        description: 'Google Play monthly storage',
      },
      {
        id: 'gp2',
        date: '2024-03-31',
        amount: 4500,
        debit: 4500,
        credit: 0,
        type: 'DEBIT',
        isExpense: true,
        category: 'Subscriptions',
        merchant: 'Google Play',
        description: 'Google Play monthly storage',
      },
    ];

    const reportGoogle = computeSubscriptionAudit(twoGooglePlay);
    const google = reportGoogle.allMerchants.find((m) => m.cleanMerchant.includes('Google Play'));
    assert.ok(google, 'Google Play found');
    assert.equal(google.isPotentialSubscription, true);
    assert.ok(google.confidenceScore >= 0.70, `Google Play confidence was ${google.confidenceScore}`);
    assert.equal(google.frequency, 'monthly');
    assert.equal(google.classification, 'confirmed');
  });

  it('3. Interval & Cadence Detection: Weekly, Biweekly, Monthly, and Next Due Date', () => {
    // 4 weekly transactions
    const weeklyTxs = [
      { id: 'w1', date: '2024-01-07', amount: 12000, debit: 12000, isExpense: true, category: 'Transportation', merchant: 'Weekly Fuel Total', description: 'Fuel' },
      { id: 'w2', date: '2024-01-14', amount: 12000, debit: 12000, isExpense: true, category: 'Transportation', merchant: 'Weekly Fuel Total', description: 'Fuel' },
      { id: 'w3', date: '2024-01-21', amount: 12000, debit: 12000, isExpense: true, category: 'Transportation', merchant: 'Weekly Fuel Total', description: 'Fuel' },
      { id: 'w4', date: '2024-01-28', amount: 12000, debit: 12000, isExpense: true, category: 'Transportation', merchant: 'Weekly Fuel Total', description: 'Fuel' },
    ];

    const report = computeSubscriptionAudit(weeklyTxs);
    const fuel = report.allMerchants[0];
    assert.equal(fuel.frequency, 'weekly');
    assert.equal(fuel.classification, 'confirmed');
    assert.equal(fuel.nextEstimatedPaymentDate, '2024-02-04');
    assert.equal(fuel.amountVariancePercent, 0);
    // 12000 * 4.333 = 51996
    assert.ok(fuel.monthlyCost > 50000 && fuel.monthlyCost < 55000);
  });

  it('4. Active vs Recently Stopped Status & Stopped Savings Metric', () => {
    // A subscription active until Feb 2024 in a statement running through May 2024
    const mockStatement = [
      // Stopped Adobe sub
      { id: 'a1', date: '2024-01-15', amount: 15000, debit: 15000, isExpense: true, category: 'Subscriptions', merchant: 'Adobe Creative Cloud', description: 'Adobe sub' },
      { id: 'a2', date: '2024-02-15', amount: 15000, debit: 15000, isExpense: true, category: 'Subscriptions', merchant: 'Adobe Creative Cloud', description: 'Adobe sub' },
      // Ongoing internet active until May 2024
      { id: 'i1', date: '2024-01-20', amount: 20000, debit: 20000, isExpense: true, category: 'Utilities', merchant: 'Spectranet LTE', description: 'Internet' },
      { id: 'i2', date: '2024-02-20', amount: 20000, debit: 20000, isExpense: true, category: 'Utilities', merchant: 'Spectranet LTE', description: 'Internet' },
      { id: 'i3', date: '2024-03-20', amount: 20000, debit: 20000, isExpense: true, category: 'Utilities', merchant: 'Spectranet LTE', description: 'Internet' },
      { id: 'i4', date: '2024-04-20', amount: 20000, debit: 20000, isExpense: true, category: 'Utilities', merchant: 'Spectranet LTE', description: 'Internet' },
      { id: 'i5', date: '2024-05-20', amount: 20000, debit: 20000, isExpense: true, category: 'Utilities', merchant: 'Spectranet LTE', description: 'Internet' },
    ];

    const report = computeSubscriptionAudit(mockStatement);
    assert.ok(report.recentlyStopped.some((m) => m.cleanMerchant.includes('Adobe')), 'Adobe flagged as recently stopped');
    assert.ok(report.activeRecurring.some((m) => m.cleanMerchant.includes('Spectranet')), 'Spectranet flagged as active');
    assert.equal(report.metrics.recentlyStoppedCount, 1);
    assert.equal(report.metrics.savedMonthlyFromStopped, 15000);
  });

  it('5. User Overrides: Custom Labeling Dynamically Updates Audit Sections', () => {
    const txs = [
      { id: 't1', date: '2024-01-05', amount: 10000, debit: 10000, isExpense: true, category: 'Subscriptions', merchant: 'Cloud Host Co', description: 'Server' },
      { id: 't2', date: '2024-02-05', amount: 10000, debit: 10000, isExpense: true, category: 'Subscriptions', merchant: 'Cloud Host Co', description: 'Server' },
    ];

    // Default analysis: detected as recurring
    const defaultReport = computeSubscriptionAudit(txs);
    assert.equal(defaultReport.activeRecurring.length, 1);

    // Override 1: Mark as Business Expense
    const bizReport = computeSubscriptionAudit(txs, { 'Cloud Host Co': 'business_expense' });
    assert.equal(bizReport.activeRecurring[0].userLabel, 'business_expense');

    // Override 2: Mark as Not Recurring
    const notRecReport = computeSubscriptionAudit(txs, { 'Cloud Host Co': 'not_recurring' });
    assert.equal(notRecReport.activeRecurring.length, 0);

    // Override 3: Mark as Ignore
    const ignoreReport = computeSubscriptionAudit(txs, { 'Cloud Host Co': 'ignore' });
    assert.equal(ignoreReport.activeRecurring.length, 0);
    assert.equal(ignoreReport.metrics.totalMonthlyRecurringCost, 0);
  });

  it('6. Real 20-Page OPay Statement Execution: Identifies Real Recurring Merchants', () => {
    const report = computeSubscriptionAudit(realOpayTransactions);
    assert.ok(report.allMerchants.length > 5, 'Merchants extracted');
    assert.ok(report.metrics.totalMonthlyRecurringCost > 0, 'Recurring commitments calculated');

    // Check Google Play is captured
    const googlePlay = report.allMerchants.find((m) => m.cleanMerchant.includes('Google Play'));
    assert.ok(googlePlay, 'Google Play detected in OPay statement');
    assert.equal(googlePlay.isPotentialSubscription, true);
    assert.ok(googlePlay.transactionCount >= 20, `Google Play transaction count was ${googlePlay.transactionCount}`);
  });

  it('7. Demo Zenith Bank Dataset Execution', () => {
    const report = computeSubscriptionAudit(demoTransactions);
    assert.ok(report.allMerchants.length > 0, 'Demo merchants analyzed');
    // Internal transfers and savings deposits must NOT be counted as recurring living expenses
    for (const m of report.allMerchants) {
      assert.notEqual(m.category, 'Savings');
      assert.notEqual(m.category, 'Transfers');
    }
  });
});
