import test from 'node:test';
import assert from 'node:assert/strict';
import { realOpayTransactions } from './fixtures/realOpayData.ts';
import { demoTransactions } from './fixtures/demoData.ts';
import { auditFinancialCalculations } from '../src/lib/calculations/financialEngine.ts';
import {
  computePersonalizedBudget,
  applyBudgetOverrides,
  getPresetOverrides,
} from '../src/lib/budget/budgetEngine.ts';

test('1. Intelligent Personalization vs 50/30/20: Reflects Actual History', () => {
  const report = computePersonalizedBudget(realOpayTransactions, {}, 'NGN');

  // Verify it does NOT blindly assign 50% to essential and 30% to wants
  const dist = report.summary.categoryDistribution;
  assert.ok(
    dist.essential.percentOfBudget !== 50,
    'Budget distribution must NOT be hardcoded to 50% essential'
  );
  assert.ok(
    dist.lifestyle.percentOfBudget !== 30,
    'Budget distribution must NOT be hardcoded to 30% lifestyle'
  );

  // High risk betting must be recommended at 0 to protect capital
  const betting = report.categories.find((c) => c.category === 'Betting & Gambling');
  assert.ok(betting, 'Betting category must be tracked from actual debits');
  assert.equal(betting.actualSpend, 2200, 'Actual betting spend was ₦2,200');
  assert.equal(
    betting.recommendedTarget,
    0,
    'Intelligent budget must recommend ₦0 target for high-risk betting'
  );
  assert.equal(betting.status, 'OVER_BUDGET', 'Zero target with actual spend is OVER_BUDGET');

  // Food delivery: recommended target must be a tailored reduction (~15% trim), not an arbitrary figure
  const foodDelivery = report.categories.find((c) => c.category === 'Food Delivery');
  assert.ok(foodDelivery, 'Food delivery must be present');
  assert.ok(
    foodDelivery.recommendedTarget < foodDelivery.actualSpend,
    'Recommended target should propose a realistic trim for high app delivery spending'
  );
  assert.ok(
    foodDelivery.recommendedTarget >= foodDelivery.actualSpend * 0.8,
    'Recommended target should not be impossibly restrictive (should be around 15% trim)'
  );
  assert.ok(
    foodDelivery.recommendationReason.includes('trim') ||
      foodDelivery.recommendationReason.includes('reduction'),
    'Must provide transparent rationale for recommendation'
  );

  // Family support: preserves actual commitment
  const familySupport = report.categories.find((c) => c.category === 'Family Support');
  assert.ok(familySupport, 'Family support must be tracked');
  assert.equal(
    familySupport.group,
    'Giving',
    'Family support must be recognized in Giving group'
  );
  assert.ok(
    Math.abs(familySupport.recommendedTarget - familySupport.actualSpend) <= 500,
    'Family support budget must respect and preserve actual filial commitments'
  );
});

test('2. Mathematical Accuracy: Reconciles with Audited Financial Engine', () => {
  const audit = auditFinancialCalculations(realOpayTransactions, 33956.53, 15.45, 'NGN');
  const report = computePersonalizedBudget(realOpayTransactions, {}, 'NGN');

  // Total actual spend must match audited gross living expenses
  assert.equal(
    report.summary.totalActualSpend,
    audit.expenses.grossLivingExpenses,
    `Total actual spend (${report.summary.totalActualSpend}) must match audited grossLivingExpenses (${audit.expenses.grossLivingExpenses})`
  );

  // Total income must match audited total income
  assert.equal(
    report.summary.totalIncome,
    audit.income.totalIncome,
    `Total income must match audited total income (${audit.income.totalIncome})`
  );

  // Unallocated income = Total Income - Total Budget Target
  const expectedUnallocated = Math.round((audit.income.totalIncome - report.summary.totalBudgetTarget) * 100) / 100;
  assert.equal(report.summary.unallocatedIncome, expectedUnallocated);

  // Category sum check
  const sumCategories = report.categories.reduce((s, c) => s + c.actualSpend, 0);
  assert.equal(
    Math.round(sumCategories * 100) / 100,
    report.summary.totalActualSpend,
    'Sum of individual category actuals must equal totalActualSpend'
  );
});

test('3. User Overrides: Dynamic Recalculation & Custom Budget Targets', () => {
  const initial = computePersonalizedBudget(realOpayTransactions, {}, 'NGN');
  const foodDeliveryInitial = initial.categories.find((c) => c.category === 'Food Delivery');
  assert.ok(foodDeliveryInitial);

  // User sets a custom target of ₦90,000 for Food Delivery
  const customTarget = 90000;
  const overrides = { 'Food Delivery': customTarget };
  const updated = applyBudgetOverrides(initial, overrides, realOpayTransactions);

  const foodDeliveryUpdated = updated.categories.find((c) => c.category === 'Food Delivery');
  assert.ok(foodDeliveryUpdated);
  assert.equal(foodDeliveryUpdated.currentTarget, customTarget);
  assert.equal(foodDeliveryUpdated.isUserEdited, true);
  assert.equal(
    foodDeliveryUpdated.variance,
    Math.round((foodDeliveryUpdated.actualSpend - customTarget) * 100) / 100
  );

  // Total budget target should reflect the difference between recommended and custom target
  const diff = customTarget - foodDeliveryInitial.recommendedTarget;
  assert.equal(
    Math.round((updated.summary.totalBudgetTarget - initial.summary.totalBudgetTarget) * 100) / 100,
    Math.round(diff * 100) / 100,
    'Total budget target must adjust by the exact delta of the user override'
  );

  // Unallocated income must adjust inversely
  assert.equal(
    Math.round((updated.summary.unallocatedIncome - initial.summary.unallocatedIncome) * 100) / 100,
    Math.round(-diff * 100) / 100,
    'Unallocated income must adjust inversely by the exact delta'
  );
});

test('4. Scenario Presets: Conservative and Aggressive Savings Presets', () => {
  const initial = computePersonalizedBudget(realOpayTransactions, {}, 'NGN');

  // Aggressive preset: trims lifestyle by 25% and sets betting to 0
  const aggressiveOverrides = getPresetOverrides(initial.categories, 'aggressive');
  const aggressiveReport = applyBudgetOverrides(initial, aggressiveOverrides, realOpayTransactions);

  assert.ok(
    aggressiveReport.summary.totalBudgetTarget < initial.summary.totalBudgetTarget,
    'Aggressive budget must have a lower total cap than baseline'
  );
  assert.ok(
    aggressiveReport.summary.unallocatedIncome > initial.summary.unallocatedIncome,
    'Aggressive budget must free up more unallocated income for savings buffer'
  );

  // Reverting to recommended preset clears overrides
  const resetOverrides = getPresetOverrides(initial.categories, 'recommended');
  assert.deepEqual(resetOverrides, {});
  const resetReport = applyBudgetOverrides(initial, resetOverrides, realOpayTransactions);
  assert.equal(resetReport.summary.totalBudgetTarget, initial.summary.totalBudgetTarget);
});

test('5. Multi-Bank Statement Verification: Runs on Zenith Bank Dataset', () => {
  const zenithAudit = auditFinancialCalculations(demoTransactions, 0, 0, 'NGN');
  const zenithReport = computePersonalizedBudget(demoTransactions, {}, 'NGN');

  assert.equal(
    zenithReport.summary.totalActualSpend,
    zenithAudit.expenses.grossLivingExpenses,
    'Zenith totalActualSpend must match audited living expenses'
  );
  assert.equal(
    zenithReport.summary.totalIncome,
    zenithAudit.income.totalIncome,
    'Zenith totalIncome must match audited total income'
  );
  assert.ok(zenithReport.categories.length > 0, 'Must have categories for Zenith statement');
  assert.ok(zenithReport.summary.budgetHealthScore >= 0 && zenithReport.summary.budgetHealthScore <= 100);
});
