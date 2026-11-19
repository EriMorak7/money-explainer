import type { Currency, SpendingCategoryGroup, Transaction, TransactionCategory } from '../../types/index.ts';
import {
  auditFinancialCalculations,
  isExcludedFromLivingExpenses,
  round2,
} from '../calculations/financialEngine.ts';
import type {
  BudgetCategoryTarget,
  BudgetReport,
  BudgetStatus,
  BudgetSummary,
} from './types.ts';

/**
 * Maps categories to their logical spending category groups.
 */
function getCategoryGroup(category: TransactionCategory): SpendingCategoryGroup {
  switch (category) {
    case 'Salary':
    case 'Freelance':
    case 'Business Income':
    case 'Client Payment':
    case 'Transfers Received':
    case 'Investment Return':
    case 'Other Income':
    case 'Income':
      return 'Income';

    case 'Food':
    case 'Groceries':
    case 'Transportation':
    case 'Fuel':
    case 'Rent':
    case 'Utilities':
    case 'Airtime':
    case 'Data':
    case 'Healthcare':
    case 'Education':
      return 'Essential Spending';

    case 'Restaurants':
    case 'Food Delivery':
    case 'Entertainment':
    case 'Shopping':
    case 'Gaming':
    case 'Streaming':
    case 'Subscriptions':
      return 'Lifestyle';

    case 'Family Support':
    case 'Church & Tithe':
    case 'Charity':
    case 'Gifts':
    case 'Giving':
      return 'Giving';

    case 'Savings':
    case 'Investment':
    case 'Loan Repayment':
    case 'Bank Charges':
    case 'Transfers':
    case 'Cash Withdrawal':
      return 'Financial';

    case 'Betting & Gambling':
    case 'Impulse Spending':
      return 'Discretionary';

    default:
      return 'Other';
  }
}

/**
 * Generates an intelligent, personalized budget recommendation for a category
 * based on actual statement history and financial nature, rather than a generic 50/30/20 rule.
 */
function recommendTargetForCategory(
  category: TransactionCategory,
  actualSpend: number,
  _group: SpendingCategoryGroup,
  totalLivingExpenses: number,
  _totalIncome: number
): { recommendedTarget: number; recommendationReason: string } {
  // If zero spend
  if (actualSpend <= 0) {
    return {
      recommendedTarget: 0,
      recommendationReason: 'No historical spend detected in this statement period.',
    };
  }

  // 1. High-Risk / Gambling / Speculative
  if (category === 'Betting & Gambling' || category === 'Impulse Spending') {
    return {
      recommendedTarget: 0,
      recommendationReason: 'Target: ₦0.00. Eliminates high-risk speculative losses to preserve capital.',
    };
  }

  // 2. Food Delivery & Restaurants
  if (category === 'Food Delivery' || category === 'Restaurants') {
    const share = totalLivingExpenses > 0 ? (actualSpend / totalLivingExpenses) * 100 : 0;
    if (share > 15) {
      // High dining spend: recommend 15% reduction
      const trimmed = round2(actualSpend * 0.85);
      return {
        recommendedTarget: Math.round(trimmed / 100) * 100,
        recommendationReason: `Consumes ${share.toFixed(1)}% of expenses. Recommends a realistic 15% reduction by swapping 2-3 app deliveries with groceries.`,
      };
    }
    const trimmed = round2(actualSpend * 0.9);
    return {
      recommendedTarget: Math.round(trimmed / 100) * 100,
      recommendationReason: 'Moderate dining spend. Recommends a 10% trim while preserving dining flexibility.',
    };
  }

  // 3. Airtime & Data
  if (category === 'Airtime' || category === 'Data') {
    // Round to clean monthly bundle benchmark
    const rounded = Math.ceil(actualSpend / 500) * 500;
    return {
      recommendedTarget: rounded,
      recommendationReason: 'Communication baseline benchmarked to your active bundle recharge frequency.',
    };
  }

  // 4. Transportation & Fuel
  if (category === 'Transportation' || category === 'Fuel') {
    // Add 5% buffer for transit price fluctuations
    const buffered = Math.ceil((actualSpend * 1.05) / 500) * 500;
    return {
      recommendedTarget: buffered,
      recommendationReason: 'Commuting baseline with a 5% buffer to accommodate surge pricing and fuel adjustments.',
    };
  }

  // 5. Utilities, Rent, Healthcare, Education
  if (category === 'Utilities' || category === 'Rent' || category === 'Healthcare' || category === 'Education') {
    const buffered = Math.ceil((actualSpend * 1.05) / 500) * 500;
    return {
      recommendedTarget: buffered,
      recommendationReason: 'Essential fixed commitment protected with a 5% inflation safety buffer.',
    };
  }

  // 6. Family Support & Church / Giving
  if (category === 'Family Support' || category === 'Church & Tithe' || category === 'Giving') {
    // Preserve exact historical commitment
    return {
      recommendedTarget: Math.round(actualSpend / 500) * 500,
      recommendationReason: 'Preserves non-negotiable family remittances and charitable giving commitments.',
    };
  }

  // 7. Shopping & Entertainment
  if (category === 'Shopping' || category === 'Entertainment' || category === 'Gaming') {
    const trimmed = round2(actualSpend * 0.85);
    return {
      recommendedTarget: Math.round(trimmed / 500) * 500,
      recommendationReason: 'Lifestyle expenditure targeted for a 15% optimization to boost monthly surplus.',
    };
  }

  // 8. Bank Charges
  if (category === 'Bank Charges') {
    return {
      recommendedTarget: Math.ceil((actualSpend * 1.1) / 100) * 100,
      recommendationReason: 'Covers mandatory transfer levies, SMS alerts, and stamp duties.',
    };
  }

  // Default fallback: match actuals with modest sanity round
  const fallback = Math.round(actualSpend / 500) * 500;
  return {
    recommendedTarget: fallback,
    recommendationReason: 'Aligned with actual historical statement run-rate.',
  };
}

/**
 * Evaluates the status of a category based on actual spend vs target.
 */
function evaluateBudgetStatus(actual: number, target: number): { status: BudgetStatus; utilizationPercent: number } {
  if (target <= 0) {
    if (actual > 0) return { status: 'OVER_BUDGET', utilizationPercent: 999 };
    return { status: 'ON_TRACK', utilizationPercent: 0 };
  }

  const utilizationPercent = round2((actual / target) * 100);

  if (utilizationPercent > 100) {
    return { status: 'OVER_BUDGET', utilizationPercent };
  }
  if (utilizationPercent >= 85) {
    return { status: 'WARNING', utilizationPercent };
  }
  return { status: 'ON_TRACK', utilizationPercent };
}

/**
 * Computes a holistic 0-100 Budget Health Score based on:
 * - Net budget surplus vs income
 * - Proportion of categories on-track
 * - Prudence of discretionary spending
 */
function computeBudgetHealthScore(
  totalIncome: number,
  totalBudgetTarget: number,
  categories: BudgetCategoryTarget[]
): number {
  let score = 70; // baseline

  // 1. Budget vs Income solvency
  if (totalIncome > 0) {
    const budgetToIncomeRatio = totalBudgetTarget / totalIncome;
    if (budgetToIncomeRatio <= 0.7) score += 20;
    else if (budgetToIncomeRatio <= 0.85) score += 15;
    else if (budgetToIncomeRatio <= 1.0) score += 5;
    else score -= 25; // deficit budget
  }

  // 2. On-track categories ratio
  const activeCategories = categories.filter((c) => c.currentTarget > 0 || c.actualSpend > 0);
  if (activeCategories.length > 0) {
    const onTrackCount = activeCategories.filter((c) => c.status === 'ON_TRACK').length;
    const overBudgetCount = activeCategories.filter((c) => c.status === 'OVER_BUDGET').length;

    const onTrackRatio = onTrackCount / activeCategories.length;
    score += Math.round(onTrackRatio * 15);
    score -= overBudgetCount * 5;
  }

  // 3. Speculative / Betting penalty
  const bettingCat = categories.find((c) => c.category === 'Betting & Gambling');
  if (bettingCat && bettingCat.actualSpend > 0) {
    score -= 10;
  }

  return Math.max(10, Math.min(100, Math.round(score)));
}

/**
 * Computes category distribution breakdown.
 */
function computeCategoryDistribution(
  categories: BudgetCategoryTarget[],
  totalBudgetTarget: number
): BudgetSummary['categoryDistribution'] {
  const groups: Record<string, number> = {
    'Essential Spending': 0,
    Lifestyle: 0,
    Giving: 0,
    Financial: 0,
    Other: 0,
  };

  for (const c of categories) {
    const g = c.group;
    if (g === 'Essential Spending') groups['Essential Spending'] += c.currentTarget;
    else if (g === 'Lifestyle') groups.Lifestyle += c.currentTarget;
    else if (g === 'Giving') groups.Giving += c.currentTarget;
    else if (g === 'Financial') groups.Financial += c.currentTarget;
    else groups.Other += c.currentTarget;
  }

  const pct = (val: number) => (totalBudgetTarget > 0 ? round2((val / totalBudgetTarget) * 100) : 0);

  return {
    essential: { amount: round2(groups['Essential Spending']), percentOfBudget: pct(groups['Essential Spending']) },
    lifestyle: { amount: round2(groups.Lifestyle), percentOfBudget: pct(groups.Lifestyle) },
    giving: { amount: round2(groups.Giving), percentOfBudget: pct(groups.Giving) },
    financial: { amount: round2(groups.Financial), percentOfBudget: pct(groups.Financial) },
    other: { amount: round2(groups.Other), percentOfBudget: pct(groups.Other) },
  };
}

/**
 * Calculates personalized budgeting report from verified transaction history.
 */
export function computePersonalizedBudget(
  transactions: Transaction[],
  overrides: Record<string, number> = {},
  currency: Currency = 'NGN'
): BudgetReport {
  const audit = auditFinancialCalculations(transactions, 0, 0, currency);

  // Group actual expenses by category
  const categoryMap = new Map<
    TransactionCategory,
    { actualSpend: number; transactionCount: number }
  >();

  for (const t of transactions) {
    if (!t.isExpense || isExcludedFromLivingExpenses(t)) continue;
    const cat = t.category;
    const existing = categoryMap.get(cat) || { actualSpend: 0, transactionCount: 0 };
    existing.actualSpend += t.debit || t.amount;
    existing.transactionCount += 1;
    categoryMap.set(cat, existing);
  }

  // Calculate period days
  const dates = transactions.map((t) => t.date).filter(Boolean).sort();
  let periodDays = 30;
  if (dates.length >= 2) {
    const start = new Date(dates[0]).getTime();
    const end = new Date(dates[dates.length - 1]).getTime();
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (diff > 0 && diff <= 365) periodDays = diff;
  }

  // Build category targets
  const categories: BudgetCategoryTarget[] = [];

  for (const [cat, data] of categoryMap.entries()) {
    const group = getCategoryGroup(cat);
    const actualSpend = round2(data.actualSpend);
    const { recommendedTarget, recommendationReason } = recommendTargetForCategory(
      cat,
      actualSpend,
      group,
      audit.expenses.grossLivingExpenses,
      audit.income.totalIncome
    );

    const isUserEdited = Object.prototype.hasOwnProperty.call(overrides, cat);
    const currentTarget = isUserEdited ? round2(overrides[cat]) : recommendedTarget;
    const variance = round2(actualSpend - currentTarget);
    const { status, utilizationPercent } = evaluateBudgetStatus(actualSpend, currentTarget);

    categories.push({
      category: cat,
      group,
      actualSpend,
      transactionCount: data.transactionCount,
      recommendedTarget,
      currentTarget,
      variance,
      utilizationPercent,
      status,
      recommendationReason,
      isUserEdited,
    });
  }

  // Sort categories by actual spend descending
  categories.sort((a, b) => b.actualSpend - a.actualSpend);

  // Compute summary totals
  const totalActualSpend = round2(categories.reduce((s, c) => s + c.actualSpend, 0));
  const totalBudgetTarget = round2(categories.reduce((s, c) => s + c.currentTarget, 0));
  const unallocatedIncome = round2(audit.income.totalIncome - totalBudgetTarget);
  const budgetSurplusOrDeficit = round2(totalBudgetTarget - totalActualSpend);
  const budgetHealthScore = computeBudgetHealthScore(audit.income.totalIncome, totalBudgetTarget, categories);
  const categoryDistribution = computeCategoryDistribution(categories, totalBudgetTarget);

  const summary: BudgetSummary = {
    totalIncome: audit.income.totalIncome,
    totalActualSpend,
    totalBudgetTarget,
    unallocatedIncome,
    budgetSurplusOrDeficit,
    budgetHealthScore,
    periodDays,
    categoryDistribution,
  };

  return {
    currency,
    periodDays,
    summary,
    categories,
    overrides,
  };
}

/**
 * Recomputes the budget report with updated user target overrides.
 */
export function applyBudgetOverrides(
  existingReport: BudgetReport,
  overrides: Record<string, number>,
  transactions: Transaction[]
): BudgetReport {
  return computePersonalizedBudget(transactions, overrides, existingReport.currency);
}

/**
 * Generates preset scenarios for quick adjustments:
 * - "conservative": 10% trim on lifestyle, leaving essentials/giving untouched.
 * - "aggressive": 25% trim on lifestyle, 0 on betting, maximizing savings buffer.
 */
export function getPresetOverrides(
  categories: BudgetCategoryTarget[],
  preset: 'recommended' | 'conservative' | 'aggressive'
): Record<string, number> {
  const overrides: Record<string, number> = {};

  if (preset === 'recommended') {
    return overrides; // empty overrides reverts to recommended
  }

  for (const c of categories) {
    if (preset === 'conservative') {
      if (c.group === 'Lifestyle') {
        overrides[c.category] = Math.round((c.actualSpend * 0.9) / 100) * 100;
      } else if (c.category === 'Betting & Gambling') {
        overrides[c.category] = 0;
      } else {
        overrides[c.category] = c.recommendedTarget;
      }
    } else if (preset === 'aggressive') {
      if (c.group === 'Lifestyle') {
        overrides[c.category] = Math.round((c.actualSpend * 0.75) / 100) * 100;
      } else if (c.category === 'Betting & Gambling' || c.category === 'Impulse Spending') {
        overrides[c.category] = 0;
      } else if (c.group === 'Essential Spending' && (c.category === 'Airtime' || c.category === 'Data')) {
        overrides[c.category] = Math.round((c.actualSpend * 0.9) / 100) * 100;
      } else {
        overrides[c.category] = c.recommendedTarget;
      }
    }
  }

  return overrides;
}
