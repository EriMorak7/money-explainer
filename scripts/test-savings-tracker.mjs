import test from 'node:test';
import assert from 'node:assert/strict';
import { realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoTransactions } from './fixtures/demoData.ts';
import { computeSavingsReport, extractSavingsMovements } from '../src/lib/savings/savingsEngine.ts';

test('1. Provider Recognition & Investment Isolation: Never Confuses Savings With Investment Without Proof', () => {
  // Test on Zenith bank dataset
  const zenithReport = computeSavingsReport(demoTransactions, undefined, 'NGN');

  const piggy = zenithReport.providers.find((p) => p.provider === 'PiggyVest');
  assert.ok(piggy, 'PiggyVest provider must be detected');
  assert.equal(piggy.providerType, 'savings', 'PiggyVest must be typed as savings');
  assert.equal(piggy.deposited, 150000, 'PiggyVest deposit is ₦150,000');

  const cowry = zenithReport.providers.find((p) => p.provider === 'Cowrywise');
  assert.ok(cowry, 'Cowrywise provider must be detected');
  assert.equal(cowry.providerType, 'investment', 'Cowrywise mutual funds must be typed as investment based on narration');
  assert.equal(cowry.invested, 100000, 'Cowrywise investment is ₦100,000');

  assert.equal(zenithReport.metrics.totalDeposited, 150000);
  assert.equal(zenithReport.metrics.totalInvested, 100000);
  assert.equal(zenithReport.metrics.totalSaved, 250000);
});

test('2. Deduplication of Mirrored Pairs in Multi-Account Statements', () => {
  const { movements, mirroredCount } = extractSavingsMovements(realOpayTransactions);

  assert.ok(mirroredCount > 0, 'Must detect and deduplicate mirrored debit/credit pairs in multi-account OPay statement');

  // Verify SafeBox to OWealth internal transfer movements
  const internalTransfers = movements.filter((m) => m.kind === 'INTERNAL_SAVINGS_TRANSFER');
  assert.ok(internalTransfers.length >= 5, 'Must detect SafeBox to OWealth internal transfers');
  for (const it of internalTransfers) {
    assert.equal(it.provider, 'SafeBox (OPay)');
    assert.equal(it.toProvider, 'OWealth (OPay)');
  }

  // Verify Auto-save sweeps are deduplicated into single movements
  const autoSaves = movements.filter((m) => m.description.includes('Auto-save to OWealth'));
  assert.equal(autoSaves.length, 15, 'There are exactly 15 distinct auto-save events in the statement');
  for (const as of autoSaves) {
    assert.equal(as.mirrored, true, 'Each auto-save must link both wallet and savings sides');
    assert.equal(as.sourceTransactionIds.length, 2, 'Must cite both underlying transaction IDs');
  }
});

test('3. Interest Earned & Yield Calculation Accuracy', () => {
  const report = computeSavingsReport(realOpayTransactions, {
    provider: 'OWealth (OPay)',
    openingBalance: 33956.53,
    closingBalance: 15.45,
  }, 'NGN');

  // Exact interest earned in real OPay statement
  assert.equal(report.metrics.interestCreditCount, 37, 'There are 37 daily interest credit records');
  assert.equal(report.metrics.interestEarned, 181.92, 'Total interest earned must strictly equal ₦181.92');
  assert.ok(report.metrics.annualizedInterestRunRate !== null && report.metrics.annualizedInterestRunRate > 0, 'Must compute annualized interest projection');
});

test('4. Comprehensive Savings Metrics & Velocity Tracking', () => {
  const report = computeSavingsReport(realOpayTransactions, undefined, 'NGN');

  // Verify metrics presence
  assert.ok(report.metrics.totalDeposited > 0);
  assert.ok(report.metrics.totalWithdrawn > 0);
  assert.ok(report.metrics.depositCount > 0);
  assert.ok(report.metrics.withdrawalCount > 0);
  assert.ok(report.metrics.averageContribution > 0);
  assert.ok(report.metrics.averageWithdrawal > 0);
  assert.ok(report.metrics.largestContribution !== null);
  assert.ok(report.metrics.largestWithdrawal !== null);
  assert.ok(report.metrics.depositsPerWeek > 0);
  assert.ok(report.metrics.withdrawalsPerWeek > 0);
  assert.ok(report.timeline.length > 0, 'Timeline points must be generated');

  // Largest deposit check
  assert.equal(report.metrics.largestContribution?.amount, 150000, 'Largest contribution was ₦150,000 auto-save sweep');
});

test('5. Behavioral Pattern Detection', () => {
  const report = computeSavingsReport(realOpayTransactions, undefined, 'NGN');

  assert.ok(report.patterns.length >= 2, 'Must detect significant behavioral savings patterns');

  // Must detect deposit followed by withdrawal
  const depWdPattern = report.patterns.find((p) => p.type === 'DEPOSIT_THEN_WITHDRAWAL');
  assert.ok(depWdPattern, 'Must detect deposit followed by subsequent withdrawal pattern');
  assert.ok(depWdPattern.figures.length >= 2, 'Pattern must cite exact numbers');
  assert.ok(depWdPattern.relatedTransactionIds.length >= 2, 'Pattern must cite related transaction IDs');

  // Must detect interest yield pattern
  const interestPattern = report.patterns.find((p) => p.type === 'INTEREST_EARNED');
  assert.ok(interestPattern, 'Must generate yield generation verified pattern');
  assert.equal(interestPattern.figures[0].value, 181.92);
});
