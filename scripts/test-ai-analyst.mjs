import test from 'node:test';
import assert from 'node:assert/strict';
import { realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoTransactions } from './fixtures/demoData.ts';
import { auditFinancialCalculations } from '../src/lib/calculations/financialEngine.ts';
import {
  buildGroundingRegistry,
  generateVerifiedFinancialInsights,
  verifyTextGrounding,
} from '../src/lib/ai/analystEngine.ts';

test('1. Grounding Registry Registers Core Deterministic Metrics', () => {
  const registry = buildGroundingRegistry(realOpayTransactions, 'NGN');
  assert.ok(registry.values.size > 20, 'Registry must register many verified values');
  assert.ok(registry.metricMap.size > 15, 'Metric map must contain core financial keys');

  // Must contain audited living expenses (310638.08)
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  assert.ok(
    registry.metricMap.has('grossLivingExpenses'),
    'Registry must register grossLivingExpenses'
  );
  assert.equal(
    registry.metricMap.get('grossLivingExpenses').value,
    audit.expenses.grossLivingExpenses
  );

  assert.ok(registry.metricMap.has('totalIncome'), 'Registry must register totalIncome');
  assert.equal(registry.metricMap.get('totalIncome').value, audit.income.totalIncome);
});

test('2. Anti-Hallucination Guard Validates Verified Insights (100% Provenance)', () => {
  const report = generateVerifiedFinancialInsights(realOpayTransactions, 'NGN');

  assert.ok(report.insights.length >= 5, 'AI Analyst must generate comprehensive insights');
  assert.equal(
    report.antiHallucinationAudit.flaggedHallucinationsCount,
    0,
    'All numbers generated in verified insights must be 100% grounded'
  );
  assert.equal(
    report.antiHallucinationAudit.overallProvenanceScore,
    100,
    'Provenance score must be 100%'
  );
  assert.equal(
    report.antiHallucinationAudit.auditStatus,
    'VERIFIED_100_PERCENT',
    'Audit status must be VERIFIED_100_PERCENT'
  );

  // Every individual insight must pass grounding verification
  for (const insight of report.insights) {
    assert.equal(
      insight.verification.isGroundingPassed,
      true,
      `Insight "${insight.title}" must pass anti-hallucination grounding`
    );
    assert.equal(
      insight.verification.hallucinatedCount,
      0,
      `Insight "${insight.title}" must have 0 hallucinated figures`
    );
  }
});

test('3. Anti-Hallucination Guard Catches and Flags Injected Hallucinations', () => {
  const registry = buildGroundingRegistry(realOpayTransactions, 'NGN');

  // Test 1: Injected fake luxury expense
  const fakeText1 = 'You spent ₦9,999,999 on a private jet purchase this month.';
  const audit1 = verifyTextGrounding(fakeText1, registry);
  assert.equal(audit1.isGroundingPassed, false, 'Fake number must fail grounding');
  assert.ok(audit1.hallucinatedCount > 0, 'Hallucinated count must be > 0');
  assert.ok(
    audit1.checks.some((c) => c.extractedValue === 9999999 && !c.isVerified),
    '9,999,999 must be flagged as unverified'
  );

  // Test 2: Injected fake cryptocurrency figure
  const fakeText2 = 'Your secret offshore profit is $73,892.45 from arbitrary crypto trades.';
  const audit2 = verifyTextGrounding(fakeText2, registry);
  assert.equal(audit2.isGroundingPassed, false, 'Fake dollar figure must fail grounding');
  assert.ok(audit2.hallucinatedCount > 0, 'Hallucinated count must be > 0');

  // Test 3: Grounded text with real numbers from calculation engine
  const realAudit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const trueText = `Your gross living expenses totaled ₦${realAudit.expenses.grossLivingExpenses.toLocaleString()} across 432 transactions.`;
  const audit3 = verifyTextGrounding(trueText, registry);
  assert.equal(audit3.isGroundingPassed, true, 'True calculation text must pass grounding');
  assert.equal(audit3.hallucinatedCount, 0, 'True calculation text must have 0 hallucinations');
});

test('4. Exact Mathematical Consistency with Financial Engine', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const report = generateVerifiedFinancialInsights(realOpayTransactions, 'NGN');

  // Cash flow insight matches audit
  const cashFlowInsight = report.insights.find((i) => i.id === 'ins_exec_cashflow');
  assert.ok(cashFlowInsight, 'Cash flow insight must exist');

  const netCashFlowMetric = cashFlowInsight.groundedMetrics.find((m) => m.metricKey === 'netCashFlow');
  assert.ok(netCashFlowMetric, 'netCashFlow metric must be attached');
  assert.equal(netCashFlowMetric.value, audit.netCashFlow);

  const livingExpenseMetric = cashFlowInsight.groundedMetrics.find((m) => m.metricKey === 'grossLivingExpenses');
  assert.ok(livingExpenseMetric, 'grossLivingExpenses metric must be attached');
  assert.equal(livingExpenseMetric.value, audit.expenses.grossLivingExpenses);

  // Category concentration insight matches audit
  const catInsight = report.insights.find((i) => i.id === 'ins_category_leak');
  assert.ok(catInsight, 'Category leak insight must exist');
  assert.ok(catInsight.potentialMonthlySavings > 0, 'Potential savings must be positive');
});

test('5. Traceability: Filter Metadata Maps to Underlying Transactions', () => {
  const report = generateVerifiedFinancialInsights(realOpayTransactions, 'NGN');

  for (const insight of report.insights) {
    if (insight.traceFilter) {
      const filter = insight.traceFilter;
      // Filter the raw transactions
      const matches = realOpayTransactions.filter((tx) => {
        if (filter.category && tx.category !== filter.category) return false;
        if (filter.type && tx.transactionType !== filter.type && tx.direction !== filter.type) return false;
        if (filter.merchant) {
          const m = tx.merchant || tx.description;
          if (!m.toLowerCase().includes(filter.merchant.toLowerCase())) return false;
        }
        return true;
      });

      assert.ok(
        matches.length > 0,
        `Trace filter for "${insight.title}" must yield at least 1 matching transaction`
      );
    }
  }
});

test('6. Multi-Bank Execution: AI Analyst Works on Zenith Bank Statement', () => {
  const zenithReport = generateVerifiedFinancialInsights(demoTransactions, 'NGN');
  assert.ok(zenithReport.insights.length >= 4, 'Zenith must generate insights');
  assert.equal(
    zenithReport.antiHallucinationAudit.flaggedHallucinationsCount,
    0,
    'Zenith insights must have 0 hallucinations'
  );
  assert.equal(
    zenithReport.antiHallucinationAudit.overallProvenanceScore,
    100,
    'Zenith provenance score must be 100%'
  );
});
